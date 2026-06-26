// ── DOM ──────────────────────────────────────────────────────────────────────
const toggleBtn    = document.getElementById('toggleBtn');
const clearBtn     = document.getElementById('clearBtn');
const statusDot    = document.getElementById('statusDot');
const statusText   = document.getElementById('statusText');
const transcriptEl = document.getElementById('transcript');
const interimEl    = document.getElementById('interim');

// ── Audio (Cartesia PCM playback) ────────────────────────────────────────────
const SAMPLE_RATE = 22050;
const audioCtx = new AudioContext({ sampleRate: SAMPLE_RATE });
let playbackTime = 0;       // wall-clock time of next scheduled chunk
let activeSources = [];     // currently scheduled AudioBufferSourceNodes
let onAudioQueueEmpty = null; // called when last source finishes

function playPCMChunk(arrayBuffer) {
  const float32 = new Float32Array(arrayBuffer);
  const buf = audioCtx.createBuffer(1, float32.length, SAMPLE_RATE);
  buf.copyToChannel(float32, 0);
  const src = audioCtx.createBufferSource();
  src.buffer = buf;
  src.connect(audioCtx.destination);
  // 80ms scheduling buffer prevents glitches under jitter
  const startAt = Math.max(audioCtx.currentTime + 0.08, playbackTime);
  src.start(startAt);
  playbackTime = startAt + buf.duration;
  activeSources.push(src);
  src.onended = () => {
    activeSources = activeSources.filter(s => s !== src);
    if (activeSources.length === 0 && onAudioQueueEmpty) {
      onAudioQueueEmpty();
      onAudioQueueEmpty = null;
    }
  };
}

function stopAudio() {
  activeSources.forEach(s => { try { s.stop(); } catch (_) {} });
  activeSources = [];
  playbackTime = 0;
  onAudioQueueEmpty = null;
}

// ── App state ────────────────────────────────────────────────────────────────
let appState = 'idle';
let ws = null;
let mediaRecorder = null;
let micStream = null;
let currentAssistantEl = null;
let fullAssistantText = '';

// ── Controls ─────────────────────────────────────────────────────────────────
toggleBtn.addEventListener('click', async () => {
  if (appState === 'idle') await startSession();
  else stopSession();
});

clearBtn.addEventListener('click', () => {
  if (ws?.readyState === WebSocket.OPEN) ws.send(JSON.stringify({ type: 'clear' }));
  transcriptEl.innerHTML = '<div class="hint">Press Start and speak freely.</div>';
});

// ── Session lifecycle ────────────────────────────────────────────────────────
async function startSession() {
  setState('connecting');
  toggleBtn.textContent = 'Stop';
  toggleBtn.classList.add('on');

  // AudioContext requires a user gesture — resume here
  if (audioCtx.state === 'suspended') await audioCtx.resume();

  try {
    micStream = await navigator.mediaDevices.getUserMedia({
      audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true },
    });
  } catch (err) {
    alert('Microphone access required: ' + err.message);
    stopSession();
    return;
  }

  const proto = location.protocol === 'https:' ? 'wss:' : 'ws:';
  ws = new WebSocket(`${proto}//${location.host}/voice-assistant-ws`);
  ws.binaryType = 'arraybuffer'; // receive Cartesia PCM as ArrayBuffer

  ws.onmessage = (e) => {
    if (e.data instanceof ArrayBuffer) { playPCMChunk(e.data); return; }
    onMessage(e);
  };
  ws.onerror   = () => stopSession();
  ws.onclose   = () => { if (appState !== 'idle') stopSession(); };
  // Don't start recording on open — wait for 'ready' (Deepgram connected) first
}

function startRecording() {
  const mime = MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
    ? 'audio/webm;codecs=opus' : 'audio/webm';
  mediaRecorder = new MediaRecorder(micStream, { mimeType: mime });
  mediaRecorder.ondataavailable = (e) => {
    if (e.data.size > 0 && ws?.readyState === WebSocket.OPEN) ws.send(e.data);
  };
  mediaRecorder.start(100);
}

function stopSession() {
  mediaRecorder?.stop();
  micStream?.getTracks().forEach(t => t.stop());
  ws?.close();
  stopAudio();
  mediaRecorder = null;
  micStream = null;
  ws = null;
  interimEl.textContent = '';
  setState('idle');
  toggleBtn.textContent = 'Start';
  toggleBtn.classList.remove('on');
}

// ── Message handling ─────────────────────────────────────────────────────────
function onMessage(e) {
  let msg;
  try { msg = JSON.parse(e.data); } catch { return; }

  switch (msg.type) {
    case 'ready':
      setState('listening');
      startRecording(); // start mic only once Deepgram is connected
      break;

    case 'interim':
      interimEl.textContent = msg.text;
      // Barge-in: user speaks while audio is playing → interrupt
      if (appState === 'speaking') {
        stopAudio();
        ws.send(JSON.stringify({ type: 'interrupt' }));
        setState('listening');
      }
      break;

    case 'transcript':
      interimEl.textContent = '';
      if (msg.final) appendMessage('user', msg.text);
      break;

    case 'thinking':
      setState('thinking');
      currentAssistantEl = appendMessage('assistant', '');
      fullAssistantText = '';
      break;

    case 'speaking_start':
      setState('speaking');
      break;

    case 'text':
      fullAssistantText += msg.text;
      updateBubble(currentAssistantEl, fullAssistantText);
      break;

    case 'tts_start':
      // New sentence audio stream starting — reset scheduling buffer
      // (playbackTime carries over intentionally for gapless playback)
      break;

    case 'tts_end':
      break;

    case 'speaking_done':
      // Server finished streaming all audio. Go to listening once playback finishes.
      if (activeSources.length === 0) {
        onSpeakingDone();
      } else {
        onAudioQueueEmpty = onSpeakingDone;
      }
      break;

    case 'interrupted':
      stopAudio();
      setState('listening');
      break;

    case 'error':
      interimEl.textContent = '';
      appendMessage('error', msg.text);
      if (appState !== 'idle') setState('listening');
      break;
  }
}

function onSpeakingDone() {
  if (appState === 'idle') return;
  setState('listening');
}

// ── DOM helpers ──────────────────────────────────────────────────────────────
function appendMessage(role, text) {
  transcriptEl.querySelector('.hint')?.remove();
  const div = document.createElement('div');
  div.className = `message ${role}`;
  const label = document.createElement('span');
  label.className = 'label';
  label.textContent = { user: 'You', assistant: 'Assistant', error: 'Error' }[role] ?? role;
  const bubble = document.createElement('div');
  bubble.className = 'bubble';
  bubble.textContent = text || '…';
  div.append(label, bubble);
  transcriptEl.append(div);
  transcriptEl.scrollTop = transcriptEl.scrollHeight;
  return div;
}

function updateBubble(el, text) {
  if (!el) return;
  el.querySelector('.bubble').textContent = text;
  transcriptEl.scrollTop = transcriptEl.scrollHeight;
}

function setState(s) {
  appState = s;
  statusDot.className = `status-dot ${s}`;
  statusText.textContent = {
    idle: 'Ready', connecting: 'Connecting…', listening: 'Listening…',
    thinking: 'Thinking…', speaking: 'Speaking…',
  }[s] ?? s;
}
