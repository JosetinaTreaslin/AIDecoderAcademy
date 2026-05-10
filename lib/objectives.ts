import type { OutputType } from "@/types";

export interface Objective {
  id:            string;
  arenaId:       number;
  order:         number;
  emoji:         string;
  title:         string;
  description:   string;
  outputType:    OutputType;
  starterPrompt: string;
  xpReward:      number;
}

export const OBJECTIVES: Objective[] = [
  // ─── Arena 1 — AI Explorer ─────────────────────────────────────────────────
  // 14 hands-on Lab Objectives from LMS Creators Room Spec v2 (Level 1).
  // Every objective is a real lab task — open a tool, produce an output,
  // submit to the Creators Room canvas. Order matches the panels in arena-1.png.

  // ── TOP-LEFT WALL (01–05) ────────────────────────────────────────────────
  {
    id: "a1-1", arenaId: 1, order: 1,
    emoji: "💬",
    title: "First Prompt Ever — ChatGPT Live",
    description: "Open ChatGPT. Type the AI-teacher prompt exactly, screenshot it. Then write your own personal-topic prompt and screenshot that too. Submit both to the Creators Room.",
    outputType: "text",
    starterPrompt: "Act as an enthusiastic teacher. Explain what Artificial Intelligence is in exactly 4 bullet points. Each bullet must be one sentence. Use simple words only.",
    xpReward: 15,
  },
  {
    id: "a1-2", arenaId: 1, order: 2,
    emoji: "🧠",
    title: "Meet the Three LLMs — Same Question, Three Answers",
    description: "Ask ChatGPT, Gemini, and Claude the EXACT same question. Screenshot all three responses and notice how each tool's voice differs.",
    outputType: "text",
    starterPrompt: "I'm comparing how three different LLMs answer the same question. Please answer this clearly so I can compare your response with Gemini and Claude. My question is: ",
    xpReward: 20,
  },
  {
    id: "a1-3", arenaId: 1, order: 3,
    emoji: "🎨",
    title: "First AI Image — Canva AI Generator",
    description: "Open Canva → Apps → AI Image Generator. Generate two imaginary scenes that could not exist in real life. Submit both images plus the prompts.",
    outputType: "image",
    starterPrompt: "A floating library inside a giant whale, sunlight pouring through the blowhole, ancient books, cosy reading nooks, dreamy fantasy illustration",
    xpReward: 20,
  },
  {
    id: "a1-4", arenaId: 1, order: 4,
    emoji: "🖼️",
    title: "Image Style Switch — Same Subject, Two Styles",
    description: "Open Adobe Firefly. Generate ONE subject in REALISTIC photo style, then in ANIME style. Place them side-by-side in the Creators Room.",
    outputType: "image",
    starterPrompt: "PHOTOREALISTIC: a young AI scientist standing on a rooftop at sunrise, dramatic golden lighting, ultra-detailed cinematic photo",
    xpReward: 25,
  },
  {
    id: "a1-5", arenaId: 1, order: 5,
    emoji: "🎙️",
    title: "AI Speaks — First ElevenLabs Voice Generation",
    description: "Open ElevenLabs free tier. Type 3 sentences about your favourite hobby. Generate with voice 'Rachel'. Then regenerate with a completely different voice.",
    outputType: "audio",
    starterPrompt: "Generate audio narration: My favourite hobby is exploring how technology shapes the future. I love discovering new tools and thinking about what they unlock for creators. Every day I learn something new about AI and how it amplifies our imagination.",
    xpReward: 25,
  },

  // ── BOTTOM-LEFT WALL (06–09) ─────────────────────────────────────────────
  {
    id: "a1-6", arenaId: 1, order: 6,
    emoji: "🎵",
    title: "AI Composes Music — Suno.ai Two-Track Lab",
    description: "Open Suno.ai. Track 1: an upbeat hype track for a school video. Track 2: a calm focus track for studying. Download both with their style prompts.",
    outputType: "audio",
    starterPrompt: "Generate music — Track 1: hip-hop, upbeat, school energy, fast tempo, positive, motivating. Track 2: ambient piano, slow, peaceful, focus, calm study mood.",
    xpReward: 25,
  },
  {
    id: "a1-7", arenaId: 1, order: 7,
    emoji: "🧪",
    title: "Build a Multimodal Set — One Topic, Three Tools",
    description: "Pick one topic. Use ChatGPT for a 5-sentence explanation, Canva AI for an image, and Suno.ai for a 30-second background track. All three must share the same topic.",
    outputType: "text",
    starterPrompt: "Help me build a multimodal set on ONE topic of my choice. First write a 5-sentence explanation I can use as the text part. Then describe an AI image I should generate in Canva, and a music style I should generate in Suno.ai. All three must connect to the same topic.",
    xpReward: 30,
  },
  {
    id: "a1-8", arenaId: 1, order: 8,
    emoji: "🤖",
    title: "Create Your AI Academy Avatar",
    description: "Open HeyGen. Choose an avatar that reflects your personality. Pick a voice. Generate the avatar speaking your introduction script. Download the clip.",
    outputType: "video",
    starterPrompt: "Generate an avatar introduction script: 'Hi, I am [your avatar name]. I am an AI Creator at AI Decoder Academy. In 6 weeks, I will build my own educational film using artificial intelligence.'",
    xpReward: 30,
  },
  {
    id: "a1-9", arenaId: 1, order: 9,
    emoji: "🪜",
    title: "Image Detail Escalation — 5-Step Build",
    description: "Start with a 2-word prompt. Generate. Add 3 words. Regenerate. Repeat for 5 versions. Submit all 5 images and watch quality climb with detail.",
    outputType: "image",
    starterPrompt: "A robot",
    xpReward: 30,
  },

  // ── TOP-RIGHT WALL (10–13) ───────────────────────────────────────────────
  {
    id: "a1-10", arenaId: 1, order: 10,
    emoji: "🎭",
    title: "Voice Direction Lab — 3 Performances of One Script",
    description: "Write a 4-sentence script. Generate it 3 times in ElevenLabs using 3 completely different voices. Hear how the SAME words feel different.",
    outputType: "audio",
    starterPrompt: "Generate audio: AI is changing how young people learn. It can adapt to your pace and your style. Every prompt you write is a new experiment. The better your prompt, the more powerful your result.",
    xpReward: 30,
  },
  {
    id: "a1-11", arenaId: 1, order: 11,
    emoji: "📊",
    title: "AI Slide Deck — Auto-Generated Presentation",
    description: "Open Gamma.app. Click 'Generate a Deck'. Use the 5-slide prompt on a school topic you're studying right now. Export all 5 slides.",
    outputType: "slides",
    starterPrompt: "Create a 5-slide educational presentation about [choose any topic you're currently studying in school] for students aged 13–15. Include a title slide, 3 content slides with key facts, and a conclusion slide.",
    xpReward: 30,
  },
  {
    id: "a1-12", arenaId: 1, order: 12,
    emoji: "🗣️",
    title: "Avatar + Voice = My First Talking Explainer Clip",
    description: "Step 1: ElevenLabs narration of your 3-sentence script. Step 2: HeyGen avatar speaking the same 3 sentences. Submit both.",
    outputType: "video",
    starterPrompt: "Help me write a 3-sentence educational explanation of any concept I find interesting. I'll then narrate it in ElevenLabs and have my HeyGen avatar speak it — they must use the IDENTICAL script.",
    xpReward: 35,
  },
  {
    id: "a1-13", arenaId: 1, order: 13,
    emoji: "✨",
    title: "My Capstone Topic — First Full Multimodal Draft",
    description: "Pick your capstone topic. Use ChatGPT + Canva AI + Suno.ai + ElevenLabs to produce a 4-tool multimodal draft. Your first capstone asset set.",
    outputType: "text",
    starterPrompt: "I'm choosing my capstone topic. Help me write a 5-sentence explanation of [my chosen topic] for students my age. I'll then create: an AI image in Canva representing the topic, a 30-second mood track in Suno.ai, and an ElevenLabs narration of the same 5 sentences.",
    xpReward: 40,
  },

  // ── BOTTOM-RIGHT WALL (14–15) ────────────────────────────────────────────
  {
    id: "a1-14", arenaId: 1, order: 14,
    emoji: "🎬",
    title: "Capstone Film Blueprint — Complete Concept Document",
    description: "Build the 5-element blueprint for your capstone film: title (ChatGPT, 5 options), audience, 3-act outline, Canva AI title card, and 3-slide Gamma storyboard.",
    outputType: "slides",
    starterPrompt: "Help me build my Capstone Film Blueprint. Step 1: generate 5 powerful film title options for my capstone topic. Step 2: describe the target audience in 2 sentences. Step 3: write a 3-act outline (intro, 3 key points, conclusion). I'll then create a Canva AI title card image and a 3-slide Gamma storyboard for opening / key concept / closing scenes.",
    xpReward: 50,
  },
  {
    id: "a1-15", arenaId: 1, order: 15,
    emoji: "⬆️",
    title: "Prompt Upgrade — From Simple to Specific",
    description: "Take a one-word prompt and upgrade it 4 times, adding role, context, format, and tone each round. Compare all 5 outputs and write what changed.",
    outputType: "text",
    starterPrompt: "I'm learning prompt engineering. Start with the word 'ocean'. Round 1: use it as-is. Round 2: add a role (e.g. 'Act as a marine biologist'). Round 3: add context (who it's for). Round 4: add an output format. Round 5: add a tone. Show me all 5 prompts and outputs so I can see how detail transforms results.",
    xpReward: 30,
  },
  // ── Arena 2 — Prompt Lab ────────────────────────────────
  {
    id: "a2-1", arenaId: 2, order: 1,
    emoji: "🔬",
    title: "The Comparison Test",
    description: "Ask the same question two different ways. See how the answer changes.",
    outputType: "text",
    starterPrompt: "Explain machine learning simply, then explain it again using only a cooking recipe analogy",
    xpReward: 15,
  },
  {
    id: "a2-2", arenaId: 2, order: 2,
    emoji: "🖼️",
    title: "Paint With Words",
    description: "Craft a 40+ word image prompt with style, lighting, mood and detail.",
    outputType: "image",
    starterPrompt: "Generate: A futuristic anime-style library floating in deep space, bookshelves glowing with cyan neon, stars visible through floor-to-ceiling windows, a lone student reading, dramatic rim lighting, ultra-detailed illustration",
    xpReward: 20,
  },
  {
    id: "a2-3", arenaId: 2, order: 3,
    emoji: "🗂️",
    title: "Data Blueprint",
    description: "Design a complete JSON schema for an app idea of your choice.",
    outputType: "json",
    starterPrompt: "Design a JSON structure for a school of the future — AI teachers, futuristic subjects, student profiles, and XP scores",
    xpReward: 25,
  },

  // ── Arena 3 — Story Forge ───────────────────────────────
  {
    id: "a3-1", arenaId: 3, order: 1,
    emoji: "📖",
    title: "First Words",
    description: "Write the opening of an original story. Set the scene, introduce a character.",
    outputType: "text",
    starterPrompt: "Write the gripping opening paragraph of a story: a 14-year-old discovers their city is secretly run by an AI called ATLAS",
    xpReward: 15,
  },
  {
    id: "a3-2", arenaId: 3, order: 2,
    emoji: "🖼️",
    title: "Face of a Hero",
    description: "Generate a visual portrait of your story's main character.",
    outputType: "image",
    starterPrompt: "Create a character portrait: a teenage AI hacker, messy dark hair, glowing cyan eyes, wearing a hoodie with circuit patterns, dark city background, dramatic lighting, anime style",
    xpReward: 20,
  },
  {
    id: "a3-3", arenaId: 3, order: 3,
    emoji: "🎙️",
    title: "Hear the Scene",
    description: "Bring your story to life with AI voices and sound.",
    outputType: "audio",
    starterPrompt: "Create a dramatic audio scene: a teen named Zara discovers her phone has become sentient. Include Zara (surprised) and the phone (calm, curious) as characters with a narrator setting the scene",
    xpReward: 30,
  },

  // ── Arena 4 — Visual Studio ─────────────────────────────
  {
    id: "a4-1", arenaId: 4, order: 1,
    emoji: "🎨",
    title: "Original Artwork",
    description: "Create a completely original piece of AI art — your style, your vision.",
    outputType: "image",
    starterPrompt: "Generate an original digital artwork: a neon-lit Tokyo street reflected in a rain puddle, cyberpunk aesthetic, vivid colours, ultra-detailed, cinematic",
    xpReward: 20,
  },
  {
    id: "a4-2", arenaId: 4, order: 2,
    emoji: "🔄",
    title: "The Remix",
    description: "Take your last image and transform it into something completely new.",
    outputType: "image",
    starterPrompt: "Take my previous image and reimagine it as underwater — bioluminescent creatures swimming through, deep blue tones, bubbles rising",
    xpReward: 25,
  },
  {
    id: "a4-3", arenaId: 4, order: 3,
    emoji: "📊",
    title: "Visual Deck",
    description: "Turn your art into a compelling slide presentation.",
    outputType: "slides",
    starterPrompt: "Create a 3-section presentation about AI art: What is AI art, How AI generates images, The future of AI creativity",
    xpReward: 35,
  },

  // ── Arena 5 — Sound Booth ───────────────────────────────
  {
    id: "a5-1", arenaId: 5, order: 1,
    emoji: "🎙️",
    title: "Solo Performance",
    description: "Create a powerful single-voice narration on any topic you're passionate about.",
    outputType: "audio",
    starterPrompt: "Create a narrator-only audio piece: a 30-second documentary intro about young people using AI to solve real problems around the world",
    xpReward: 20,
  },
  {
    id: "a5-2", arenaId: 5, order: 2,
    emoji: "🎭",
    title: "The Big Scene",
    description: "Direct a multi-character audio drama with distinct voices and emotions.",
    outputType: "audio",
    starterPrompt: "Create a funny but real debate scene: Maya and Leo argue about whether AI should write school essays. Maya is against it, Leo is for it, narrator introduces and closes the scene",
    xpReward: 30,
  },
  {
    id: "a5-3", arenaId: 5, order: 3,
    emoji: "📜",
    title: "From Page to Stage",
    description: "Write a script first — then turn it into audio.",
    outputType: "text",
    starterPrompt: "Write a 2-minute podcast script: two AI characters (one logical, one creative) interview a human student about what they love and fear about AI. Make it entertaining",
    xpReward: 25,
  },

  // ── Arena 6 — Slide Skate ───────────────────────────────
  {
    id: "a6-1", arenaId: 6, order: 1,
    emoji: "📽️",
    title: "The Grand Pitch",
    description: "Create a full presentation for your most ambitious AI idea.",
    outputType: "slides",
    starterPrompt: "Create a professional 4-section pitch deck for an AI app for schools: Problem, Solution, Key Features, Real-world Impact",
    xpReward: 40,
  },
  {
    id: "a6-2", arenaId: 6, order: 2,
    emoji: "🎬",
    title: "Cinematic Shots",
    description: "Generate a series of epic, movie-quality visuals.",
    outputType: "image",
    starterPrompt: "Create a cinematic movie poster: 'AI Academy' — a group of teen heroes with glowing AI gadgets standing on a rooftop at sunset, IMAX quality, epic scale",
    xpReward: 30,
  },
  {
    id: "a6-3", arenaId: 6, order: 3,
    emoji: "🏆",
    title: "The Grand Finale Deck",
    description: "Build your ultimate slide deck — the masterpiece presentation.",
    outputType: "slides",
    starterPrompt: "Create the ultimate AI Academy pitch deck: 5 sections — Vision, The Problem, Our Solution, Key Features, Call to Action. Each section should have a bold headline, 3 key points, and a vivid visual description.",
    xpReward: 50,
  },

  // ── Arena 7 — Video Fusion ───────────────────────────────
  {
    id: "a7-1", arenaId: 7, order: 1,
    emoji: "🎥",
    title: "Storyboard to Screen",
    description: "Generate a series of cinematic scenes that tell a visual story.",
    outputType: "image",
    starterPrompt: "Generate a storyboard of 4 sequential cinematic shots for a short film: 'A student discovers AI for the first time.' Shot 1: wide establishing shot of a futuristic school. Shot 2: close-up of curious eyes reflected in a glowing screen. Shot 3: hands reaching toward a holographic AI interface. Shot 4: triumphant wide shot of the student standing in a beam of light.",
    xpReward: 35,
  },
  {
    id: "a7-2", arenaId: 7, order: 2,
    emoji: "🎙️",
    title: "Director's Voiceover",
    description: "Write and produce a dramatic movie-quality narration.",
    outputType: "audio",
    starterPrompt: "Create a cinematic 90-second documentary narration about AI changing education. Maya narrates the opening dramatically, Leo describes the technology with excitement, Mr Chen closes with wisdom about the future. Make it feel like a Hollywood documentary trailer.",
    xpReward: 40,
  },
  {
    id: "a7-3", arenaId: 7, order: 3,
    emoji: "🏆",
    title: "The Final Cut",
    description: "Produce your ultimate creation — combine every skill into one legendary piece.",
    outputType: "slides",
    starterPrompt: "Create the ultimate 'AI Decoder Academy' showcase deck: 6 sections — My Journey (what I've learned), Best Image I Made, Best Audio I Created, My Favourite Script, What's Next For Me, and a final Thank You slide. Include vivid visual descriptions for each section. Make it a celebration of everything you've built.",
    xpReward: 60,
  },
];

// ── LMS rubric ID derivation ──────────────────────────────────────────────
// The objectives in this file use playful arena-prefixed IDs (a1-3, a2-15).
// The validator rubric file (lib/objectiveRubrics.ts) is keyed by the
// LMS curriculum's canonical IDs (l1-03, l2-15). This helper converts
// between them deterministically — no migration of localStorage or URLs
// is required.
export function toLmsId(id: string): string {
  const m = id.match(/^a(\d+)-(\d+)$/);
  if (!m) return id;
  return `l${m[1]}-${m[2].padStart(2, "0")}`;
}

export function getObjectiveById(id: string): Objective | undefined {
  return OBJECTIVES.find(o => o.id === id);
}

export function getArenaObjectives(arenaId: number): Objective[] {
  return OBJECTIVES
    .filter(o => o.arenaId === arenaId)
    .sort((a, b) => a.order - b.order);
}

// ── localStorage completion tracking ──────────────────────
const STORAGE_KEY = "ada-completed-objectives";

export function getCompletedObjectives(): Set<string> {
  if (typeof window === "undefined") return new Set();
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? new Set(JSON.parse(raw) as string[]) : new Set();
  } catch { return new Set(); }
}

export function markObjectiveComplete(id: string): void {
  if (typeof window === "undefined") return;
  const current = getCompletedObjectives();
  current.add(id);
  localStorage.setItem(STORAGE_KEY, JSON.stringify([...current]));
}

export function isArenaComplete(arenaId: number): boolean {
  const done = getCompletedObjectives();
  return getArenaObjectives(arenaId).every(o => done.has(o.id));
}

// Arena 1 is always open; every other arena requires the previous one to be fully complete.
export function isArenaUnlocked(arenaId: number): boolean {
  if (arenaId <= 1) return true;
  return isArenaComplete(arenaId - 1);
}
