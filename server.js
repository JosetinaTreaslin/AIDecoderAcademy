require('dotenv').config({ path: '.env.local' });

const { createServer }    = require('http');
const { parse: urlParse } = require('url');
const next                = require('next');
const { WebSocketServer, WebSocket } = require('ws');
const { createClient, LiveTranscriptionEvents } = require('@deepgram/sdk');
const OpenAI              = require('openai');

const dev      = process.env.NODE_ENV !== 'production';
const hostname = 'localhost';
const port     = parseInt(process.env.PORT ?? '3000', 10);

const app    = next({ dev, hostname, port });
const handle = app.getRequestHandler();

// ── API clients ───────────────────────────────────────────────────────────────
if (!process.env.DEEPGRAM_API_KEY)    console.warn('⚠  DEEPGRAM_API_KEY missing');
if (!process.env.OPENROUTER_API_KEY)  console.warn('⚠  OPENROUTER_API_KEY missing');
if (!process.env.CARTESIA_API_KEY)    console.warn('⚠  CARTESIA_API_KEY missing');

const deepgramClient = process.env.DEEPGRAM_API_KEY
  ? createClient(process.env.DEEPGRAM_API_KEY)
  : null;

// OpenRouter uses an OpenAI-compatible API — just swap baseURL + key.
const openrouter = new OpenAI({
  baseURL: 'https://openrouter.ai/api/v1',
  apiKey:  process.env.OPENROUTER_API_KEY ?? '',
  defaultHeaders: {
    'HTTP-Referer': 'https://ai-decoder-academy.vercel.app',
    'X-Title':      'AI Decoder Academy',
  },
});

const CARTESIA_VOICE_ID = process.env.CARTESIA_VOICE_ID ?? '694f9389-aac1-45b6-b726-9d9369183238';

const SYSTEM = `You are AIDA, a voice AI tutor for students aged 11–16.
Reply in 1–3 short spoken sentences. No markdown, lists, or symbols.`;

// ── Cartesia SSE TTS ──────────────────────────────────────────────────────────
// Streams pcm_f32le chunks via SSE. Calls onChunk(Buffer) for each audio chunk.
async function cartesiaTTS(text, onChunk, signal) {
  const res = await fetch('https://api.cartesia.ai/tts/sse', {
    method: 'POST',
    headers: {
      'Authorization':    `Bearer ${process.env.CARTESIA_API_KEY ?? ''}`,
      'Cartesia-Version': '2024-06-10',
      'Content-Type':     'application/json',
    },
    body: JSON.stringify({
      model_id:      'sonic-2',
      transcript:    text,
      voice:         { mode: 'id', id: CARTESIA_VOICE_ID },
      output_format: { container: 'raw', encoding: 'pcm_f32le', sample_rate: 22050 },
      stream:        true,
    }),
    signal,
  });

  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new Error(`Cartesia ${res.status}: ${body.slice(0, 200)}`);
  }

  const reader  = res.body.getReader();
  const decoder = new TextDecoder();
  let buf = '';
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done || signal?.aborted) break;
      buf += decoder.decode(value, { stream: true });
      const lines = buf.split('\n');
      buf = lines.pop();
      for (const line of lines) {
        if (!line.startsWith('data: ')) continue;
        try {
          const evt = JSON.parse(line.slice(6));
          if (evt.type === 'chunk' && evt.data) onChunk(Buffer.from(evt.data, 'base64'));
          if (evt.done) return;
        } catch (_) {}
      }
    }
  } finally {
    reader.cancel().catch(() => {});
  }
}

// ── Concurrent respond pipeline ───────────────────────────────────────────────
// LLM streams tokens → sentence boundary detected → Cartesia fetch starts
// IMMEDIATELY (concurrent). A separate sendChain ensures audio is sent to
// the browser in sentence order. If sentence 2's TTS finishes before sentence
// 1 is done sending, sentence 2 plays with zero gap.
async function respond(userText, session) {
  const { sendJSON, sendBin } = session;
  const t0 = Date.now();
  console.log(`[RESPOND] "${userText}"`);

  session.busy        = true;
  session.pendingText = null;
  session.history.push({ role: 'user', content: userText });

  session.llmAbort = new AbortController();
  session.ttsAbort = new AbortController();

  sendJSON({ type: 'thinking', text: userText });

  let sendChain   = Promise.resolve(); // ordered audio sending
  let sentenceBuf = '';
  let fullText    = '';
  let aborted     = false;

  function enqueueSentence(text) {
    console.log(`[TTS] enqueue @${Date.now() - t0}ms: "${text.slice(0, 50)}"`);

    // Capture signal now — stays .aborted=true even after session.ttsAbort is nulled.
    const signal = session.ttsAbort.signal;

    // Producer-consumer channel: TTS fetch pushes chunks immediately;
    // send chain drains them as soon as the previous sentence finishes.
    // This gives us concurrent fetching AND per-chunk streaming to the browser.
    const pipe = [];        // Buffer<chunk | 'done'>
    let wakeUp = null;      // Resolve fn waiting for the next item

    function push(item) {
      pipe.push(item);
      if (wakeUp) { const r = wakeUp; wakeUp = null; r(); }
    }

    // Start TTS fetch IMMEDIATELY — runs concurrently with LLM + other sentences.
    let firstChunk = true;
    cartesiaTTS(text, (chunk) => {
      if (firstChunk) {
        firstChunk = false;
        console.log(`[TTS] first chunk @${Date.now() - t0}ms`);
      }
      push(chunk);
    }, signal)
      .then(() => push('done'))
      .catch(err => { if (err.name !== 'AbortError') console.error('[TTS]', err.message); push('done'); });

    // Chain only the SENDING — ordered across sentences, streaming within each.
    sendChain = sendChain.then(async () => {
      if (aborted || signal.aborted) return;
      while (true) {
        if (pipe.length === 0) await new Promise(r => { wakeUp = r; });
        const item = pipe.shift();
        if (item === 'done') break;
        if (aborted || signal.aborted) break;
        sendBin(item);
      }
    });
  }

  function flushSentences(buf) {
    const re = /[.!?]+(?:\s|$)/g;
    let match, last = 0;
    while ((match = re.exec(buf)) !== null) {
      const s = buf.slice(last, match.index + match[0].length).trim();
      last = match.index + match[0].length;
      if (s) enqueueSentence(s);
    }
    // Comma fallback: split long buffers at last comma to avoid waiting.
    if (last === 0 && buf.length > 80) {
      const ci = buf.lastIndexOf(', ');
      if (ci > 20) { enqueueSentence(buf.slice(0, ci + 1).trim()); last = ci + 2; }
    }
    return buf.slice(last);
  }

  try {
    const stream = await openrouter.chat.completions.create(
      {
        model:      'anthropic/claude-3-5-haiku',
        max_tokens: 200,
        stream:     true,
        messages:   [
          { role: 'system', content: SYSTEM },
          ...session.history,
        ],
      },
      { signal: session.llmAbort.signal },
    );

    sendJSON({ type: 'speaking_start' });
    let firstToken = true;

    for await (const chunk of stream) {
      if (!session.busy) { aborted = true; break; }
      const token = chunk.choices[0]?.delta?.content ?? '';
      if (!token) continue;
      if (firstToken) { firstToken = false; console.log(`[LLM] first token @${Date.now() - t0}ms`); }
      fullText    += token;
      sentenceBuf += token;
      sendJSON({ type: 'text', text: token });
      sentenceBuf = flushSentences(sentenceBuf);
    }

    if (!aborted && sentenceBuf.trim()) enqueueSentence(sentenceBuf.trim());

    await sendChain; // wait for all sentences to finish sending

    if (fullText) session.history.push({ role: 'assistant', content: fullText });
    if (!aborted) sendJSON({ type: 'speaking_done' });

  } catch (err) {
    if (err.name === 'AbortError') {
      aborted = true; // ensure sendChain steps skip after LLM abort
    } else {
      console.error('[RESPOND]', err.message);
      sendJSON({ type: 'error', message: err.message });
      sendJSON({ type: 'speaking_done' });
    }
  } finally {
    session.busy     = false;
    session.llmAbort = null;
    session.ttsAbort = null;
    if (session.pendingText) {
      const next = session.pendingText;
      session.pendingText = null;
      respond(next, session);
    }
  }
}

// ── HTTP + WebSocket server ───────────────────────────────────────────────────
app.prepare().then(() => {
  const httpServer = createServer(async (req, res) => {
    await handle(req, res, urlParse(req.url, true));
  });

  const wss      = new WebSocketServer({ noServer: true });
  const voiceWss = new WebSocketServer({ noServer: true }); // root '/' — Voice Assistant page

  const nextUpgrade = typeof app.getUpgradeHandler === 'function'
    ? app.getUpgradeHandler()
    : null;

  httpServer.on('upgrade', (req, socket, head) => {
    const { pathname } = new URL(req.url ?? '/', `http://${req.headers.host}`);
    if (pathname === '/api/live-voice-ws') {
      wss.handleUpgrade(req, socket, head, (ws) => wss.emit('connection', ws, req));
    } else if (pathname === '/voice-assistant-ws') {
      voiceWss.handleUpgrade(req, socket, head, (ws) => voiceWss.emit('connection', ws, req));
    } else if (nextUpgrade) {
      nextUpgrade(req, socket, head);
    } else {
      socket.destroy();
    }
  });

  wss.on('connection', (ws, req) => {
    const reqUrl  = new URL(req.url ?? '/', `http://${req.headers.host}`);
    const sttOnly = reqUrl.searchParams.get('mode') === 'stt';

    const session = {
      history:     [],
      busy:        false,
      pendingText: null,
      llmAbort:    null,
      ttsAbort:    null,
      sendJSON: (obj) => { if (ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify(obj)); },
      sendBin:  (buf) => { if (ws.readyState === WebSocket.OPEN) ws.send(buf); },
    };

    let dgConn           = null;
    let dgKeepaliveTimer = null;
    let audioChunksReceived = 0;
    let earlyAudioBuffer = [];
    let dgReady          = false;

    if (!deepgramClient) {
      session.sendJSON({ type: 'error', message: 'Speech recognition not configured' });
    } else {
      dgConn = deepgramClient.listen.live({
        model:            'nova-2',
        language:         'en-US',
        smart_format:     true,
        interim_results:  true,
        endpointing:      200,
        utterance_end_ms: 1000,
        vad_events:       true,
      });

      dgConn.on(LiveTranscriptionEvents.Open, () => {
        dgReady = true;
        console.log(`[DG] connected — flushing ${earlyAudioBuffer.length} buffered chunk(s)`);
        for (const chunk of earlyAudioBuffer) {
          try { dgConn.send(chunk); } catch (e) { console.error('[DG] flush error:', e.message); }
        }
        earlyAudioBuffer = [];
        try { session.sendJSON({ type: 'ready' }); } catch (e) {}
        dgKeepaliveTimer = setInterval(() => { try { dgConn.keepAlive(); } catch (_) {} }, 8000);
      });

      dgConn.on(LiveTranscriptionEvents.Transcript, (data) => {
        const alt = data.channel?.alternatives?.[0];
        if (!alt?.transcript) return;
        console.log(`[DG] "${alt.transcript}" is_final=${data.is_final} speech_final=${data.speech_final}`);
        if (data.is_final) {
          if (data.speech_final) {
            const text = alt.transcript.trim();
            if (!text) return;
            if (sttOnly) {
              session.sendJSON({ type: 'final-transcript', text });
            } else if (session.busy) {
              session.pendingText = text;
            } else {
              respond(text, session);
            }
          } else {
            session.sendJSON({ type: 'transcript', text: alt.transcript });
          }
        } else {
          session.sendJSON({ type: 'interim', text: alt.transcript });
        }
      });

      dgConn.on(LiveTranscriptionEvents.Error, (err) => {
        console.error('[DG] error:', JSON.stringify(err));
        session.sendJSON({ type: 'error', message: 'Speech recognition error' });
      });

      dgConn.on(LiveTranscriptionEvents.Close, (data) => {
        console.log('[DG] closed', JSON.stringify(data));
        dgReady = false;
        earlyAudioBuffer = [];
        if (dgKeepaliveTimer) { clearInterval(dgKeepaliveTimer); dgKeepaliveTimer = null; }
      });
    }

    ws.on('message', (data, isBinary) => {
      if (isBinary) {
        audioChunksReceived++;
        if (audioChunksReceived <= 3 || audioChunksReceived % 50 === 0) {
          console.log(`[WS] chunk #${audioChunksReceived} size=${data.length} dgReady=${dgReady}`);
        }
        if (!dgConn) return;
        if (dgReady) {
          try { dgConn.send(data); } catch (e) { console.error('[DG] send error:', e.message); }
        } else {
          earlyAudioBuffer.push(Buffer.from(data));
        }
      } else {
        try {
          const msg = JSON.parse(data.toString());
          switch (msg.type) {
            case 'interrupt':
              session.busy = false;
              session.llmAbort?.abort();
              session.ttsAbort?.abort();
              session.sendJSON({ type: 'interrupted' });
              break;
            case 'clear':
              session.history = [];
              break;
            case 'keep-alive':
              dgConn?.keepAlive?.();
              break;
          }
        } catch (_) {}
      }
    });

    ws.on('close', (code) => {
      console.log(`[WS] disconnected (${code}) after ${audioChunksReceived} chunks`);
      if (dgKeepaliveTimer) { clearInterval(dgKeepaliveTimer); dgKeepaliveTimer = null; }
      session.llmAbort?.abort();
      session.ttsAbort?.abort();
      try { dgConn?.finish(); } catch (_) {}
    });

    ws.on('error', (err) => console.error('[WS]', err.message));
  });

  // ── Voice Assistant WSS (root '/') ───────────────────────────────────────────
  // Mirrors the standalone VoiceAssistant project. The /voice-assistant/app.js
  // static page connects to ws://${location.host} (path '/'), which routes here.
  voiceWss.on('connection', (ws, req) => {
    const url     = new URL(req.url ?? '/', `http://${req.headers.host}`);
    const chapter = url.searchParams.get('chapter') ?? '';
    const subject = url.searchParams.get('subject') ?? '';

    const VA_SYSTEM = chapter
      ? `You are a focused voice tutor helping a student study "${chapter}"${subject ? ` (${subject})` : ''}. ` +
        `Only answer questions about this topic. ` +
        `If the student asks about anything unrelated, say: "I'm your ${chapter} tutor — let's keep focused on that! Do you have a question about ${chapter}?" ` +
        `Reply in 1-2 short spoken sentences. Plain conversational language only — no markdown, no bullet points, no lists.`
      : 'You are a helpful voice assistant. Reply in 1-2 short sentences. Plain conversational language only — no markdown, no bullet points, no lists.';
    const sendJSON = (obj) => ws.readyState === ws.OPEN && ws.send(JSON.stringify(obj));
    const sendBin  = (buf) => ws.readyState === ws.OPEN && ws.send(buf);

    let dgConn       = null;
    let history      = [];
    let busy         = false;
    let claudeAbort  = null;
    let ttsAbortVA   = null;
    let pendingText  = null;

    function openDG() {
      dgConn = deepgramClient.listen.live({
        model: 'nova-2', language: 'en-US', smart_format: true,
        interim_results: true, endpointing: 200, utterance_end_ms: 1000, vad_events: true,
      });
      dgConn.on(LiveTranscriptionEvents.Open, () => { console.log('[VA:DG] connected'); sendJSON({ type: 'ready' }); });
      dgConn.on(LiveTranscriptionEvents.Transcript, (data) => {
        const alt = data.channel?.alternatives?.[0];
        if (!alt?.transcript) return;
        if (data.is_final) {
          sendJSON({ type: 'transcript', text: alt.transcript, final: !!data.speech_final });
          if (data.speech_final) handleUtterance(alt.transcript);
        } else {
          sendJSON({ type: 'interim', text: alt.transcript });
        }
      });
      dgConn.on(LiveTranscriptionEvents.Error, (err) => { console.error('[VA:DG]', err); sendJSON({ type: 'error', text: 'Speech recognition error' }); });
      dgConn.on(LiveTranscriptionEvents.Close, () => console.log('[VA:DG] closed'));
    }

    function handleUtterance(text) {
      if (!text.trim()) return;
      if (busy) { pendingText = text; } else { vaRespond(text); }
    }

    async function vaRespond(userText) {
      busy = true;
      pendingText = null;
      history.push({ role: 'user', content: userText });
      sendJSON({ type: 'thinking' });

      claudeAbort = new AbortController();
      ttsAbortVA  = new AbortController();
      let ttsChain      = Promise.resolve();
      let sentenceBuffer = '';
      let fullText       = '';
      let aborted        = false;

      function enqueueSentence(text) {
        ttsChain = ttsChain.then(async () => {
          if (aborted) return;
          sendJSON({ type: 'tts_start' });
          try {
            await cartesiaTTS(text, (chunk) => { sendBin(chunk); }, ttsAbortVA.signal);
          } catch (err) {
            if (err.name !== 'AbortError') console.error('[VA:TTS]', err.message);
          }
          sendJSON({ type: 'tts_end' });
        });
      }

      function flushSentences(buf) {
        const re = /[.!?]+(?:\s|$)/g;
        let match, last = 0;
        while ((match = re.exec(buf)) !== null) {
          const s = buf.slice(last, match.index + match[0].length).trim();
          last = match.index + match[0].length;
          if (s) enqueueSentence(s);
        }
        return buf.slice(last);
      }

      try {
        const stream = await openrouter.chat.completions.create(
          { model: 'anthropic/claude-haiku-4.5', max_tokens: 200, stream: true,
            messages: [{ role: 'system', content: VA_SYSTEM }, ...history] },
          { signal: claudeAbort.signal },
        );
        sendJSON({ type: 'speaking_start' });
        for await (const chunk of stream) {
          if (!busy) { aborted = true; break; }
          const token = chunk.choices[0]?.delta?.content || '';
          if (!token) continue;
          fullText       += token;
          sentenceBuffer += token;
          sendJSON({ type: 'text', text: token });
          sentenceBuffer = flushSentences(sentenceBuffer);
        }
        if (!aborted && sentenceBuffer.trim()) enqueueSentence(sentenceBuffer.trim());
        await ttsChain;
        if (fullText) history.push({ role: 'assistant', content: fullText });
        if (!aborted) sendJSON({ type: 'speaking_done' });
      } catch (err) {
        if (err.name !== 'AbortError') {
          sendJSON({ type: 'error', text: err.message });
          sendJSON({ type: 'speaking_done' });
        }
      } finally {
        busy = false; claudeAbort = null; ttsAbortVA = null;
        if (pendingText) { const next = pendingText; pendingText = null; vaRespond(next); }
      }
    }

    if (!deepgramClient) { sendJSON({ type: 'error', text: 'Speech recognition not configured' }); return; }
    openDG();

    let audioChunkCount = 0;
    ws.on('message', (data, isBinary) => {
      if (isBinary) {
        audioChunkCount++;
        const dgState = dgConn?.getReadyState();
        if (dgState === 1) {
          dgConn.send(data);
        } else if (audioChunkCount % 20 === 0) {
          console.log(`[VA:MIC] DG not ready (state=${dgState}), chunk #${audioChunkCount} dropped`);
        }
      } else {
        try {
          const msg = JSON.parse(data.toString());
          if (msg.type === 'interrupt') {
            busy = false; claudeAbort?.abort(); ttsAbortVA?.abort();
            sendJSON({ type: 'interrupted' });
          } else if (msg.type === 'clear') {
            history = [];
          }
        } catch (_) {}
      }
    });

    ws.on('close', () => {
      busy = false; claudeAbort?.abort(); ttsAbortVA?.abort();
      try { dgConn?.finish(); } catch (_) {}
    });
    ws.on('error', (err) => console.error('[VA:WS]', err.message));
  });

  httpServer.listen(port, () => {
    console.log(`\n> AI Decoder Academy ready on http://${hostname}:${port}\n`);
  });
});
