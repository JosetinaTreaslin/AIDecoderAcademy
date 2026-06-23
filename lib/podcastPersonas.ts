import { BHAVNA_VOICE_ID, type VoiceSpec } from "@/lib/classroomAudio";

export interface PodcastPersona {
  id: string;
  name: string;        // copyright-safe fictional name
  archetype: string;   // e.g. "folksy value investor"
  bio: string;
  personality: string;
  speakingStyle: string;
  catchphrases: string[];
  voice: VoiceSpec;
  expertise: string[]; // lowercase matching tags
}

// 6 distinct ElevenLabs default-preset guest voices (verified ids). Env-overridable.
const GUEST_VOICES: Record<string, VoiceSpec> = {
  warmMale:     { voiceId: "nPczCjzI2devNBz1zQrb" }, // Brian
  brightFemale: { voiceId: "9BWtsMINqrJLrRacOk9x" }, // Aria
  elderMale:    { voiceId: "pqHfZKP75CvOlQylNhV4" }, // Bill
  energeticMale:{ voiceId: "iP95p4xoKVk53GoZ742B" }, // Chris
  calmFemale:   { voiceId: "EXAVITQu4vr4xnSDxMaL" }, // Sarah
  youngMale:    { voiceId: "TX3LPaxmHKxFdv7VOQHJ" }, // Liam
};

export const HOST_VOICE: VoiceSpec = { voiceId: BHAVNA_VOICE_ID };

export const PERSONAS: PodcastPersona[] = [
  {
    id: "value-investor",
    name: "Warren Buffington",
    archetype: "folksy value investor",
    bio: "A plain-talking investor from a small town who built a fortune by buying good businesses cheap and waiting.",
    personality: "patient, witty, humble, loves homespun analogies",
    speakingStyle: "calm, folksy, uses food and small-town metaphors",
    catchphrases: ["Now, here's the thing…", "It's simpler than folks make it"],
    voice: GUEST_VOICES.elderMale,
    expertise: ["investing", "money", "stocks", "saving", "finance", "economy", "economics", "business", "market", "markets", "trade", "profit", "budget", "entrepreneur", "bank", "banking"],
  },
  {
    id: "astrophysicist",
    name: "Dr. Nova Cassidy",
    archetype: "wonder-struck astrophysicist",
    bio: "A space scientist who makes black holes and galaxies feel close enough to touch.",
    personality: "awe-filled, energetic, vivid",
    speakingStyle: "excitable, paints word-pictures of space",
    catchphrases: ["Picture this…", "And here's where it gets wild"],
    voice: GUEST_VOICES.brightFemale,
    expertise: ["space", "astronomy", "astrophysics", "stars", "planet", "planets", "solar", "sun", "moon", "cosmos", "cosmic", "orbit", "telescope", "comet", "asteroid", "rocket", "satellite", "nebula", "constellation", "astronaut", "black holes", "galaxy", "galaxies", "universe", "physics", "gravity"],
  },
  {
    id: "evolution-biologist",
    name: "Professor Darwin Reed",
    archetype: "field-roaming evolutionary biologist",
    bio: "A biologist who has tramped through jungles studying how life changes over time.",
    personality: "curious, story-driven, gentle",
    speakingStyle: "narrative, lots of animal examples",
    catchphrases: ["Life finds a way…", "Out in the field, I once saw…"],
    voice: GUEST_VOICES.elderMale,
    expertise: ["evolution", "biology", "botany", "zoology", "anatomy", "animals", "plant", "plants", "leaf", "leaves", "photosynthesis", "respiration", "species", "organism", "organisms", "tissue", "tissues", "cell", "cells", "natural selection", "genetics", "gene", "genes", "dna", "heredity", "reproduction", "bacteria", "microbe", "nutrition", "digestion", "life"],
  },
  {
    id: "coder",
    name: "Ada Byte",
    archetype: "playful software engineer",
    bio: "A programmer who thinks code is the closest thing to casting spells.",
    personality: "playful, precise, encouraging",
    speakingStyle: "snappy, uses game and recipe analogies",
    catchphrases: ["Think of it like a recipe…", "Computers are gloriously literal"],
    voice: GUEST_VOICES.brightFemale,
    expertise: ["coding", "code", "programming", "computer", "computers", "software", "algorithm", "algorithms", "python", "java", "javascript", "html", "app", "apps", "web", "internet", "robot", "robotics", "data", "cyber", "ai", "technology", "tech"],
  },
  {
    id: "climate-scientist",
    name: "Dr. Maya Frost",
    archetype: "level-headed climate scientist",
    bio: "A scientist who reads the planet's vital signs in ice, oceans and air.",
    personality: "calm, factual, hopeful",
    speakingStyle: "clear, measured, uses everyday weather examples",
    catchphrases: ["The data tells a story…", "Small changes add up"],
    voice: GUEST_VOICES.calmFemale,
    expertise: ["climate", "weather", "environment", "environmental", "global warming", "warming", "earth", "pollution", "carbon", "greenhouse", "ocean", "oceans", "renewable", "sustainability", "recycling", "atmosphere", "biodiversity", "conservation", "forest", "forests", "energy", "ecosystem"],
  },
  {
    id: "historian",
    name: "Professor Atlas Vance",
    archetype: "globe-trotting historian",
    bio: "A historian who treats the past like a giant detective story.",
    personality: "dramatic, curious, vivid",
    speakingStyle: "storyteller, cliffhangers",
    catchphrases: ["Now, picture the year…", "History never repeats — but it rhymes"],
    voice: GUEST_VOICES.warmMale,
    expertise: ["history", "historical", "ancient", "medieval", "war", "battle", "empire", "emperor", "kingdom", "dynasty", "civilization", "civilisation", "colonial", "independence", "freedom", "revolution", "movement", "nationalism", "monument", "heritage", "king"],
  },
  {
    id: "mathematician",
    name: "Professor Iris Quanta",
    archetype: "pattern-loving mathematician",
    bio: "A mathematician who sees beauty and patterns hiding everywhere.",
    personality: "warm, puzzle-loving, clear",
    speakingStyle: "uses puzzles, patterns, everyday shapes",
    catchphrases: ["Spot the pattern…", "Math is just careful noticing"],
    voice: GUEST_VOICES.calmFemale,
    expertise: ["math", "maths", "mathematics", "arithmetic", "geometry", "algebra", "trigonometry", "calculus", "probability", "statistics", "number", "numbers", "integer", "integers", "fraction", "fractions", "decimal", "decimals", "percentage", "ratio", "ratios", "polynomial", "theorem", "angle", "angles", "triangle", "triangles", "circle", "shapes", "equations", "graph", "coordinate", "mensuration"],
  },
  {
    id: "chemist",
    name: "Dr. Leo Sterling",
    archetype: "hands-on chemist",
    bio: "A chemist who loves the fizz, colour and bang of reactions.",
    personality: "enthusiastic, safety-minded, fun",
    speakingStyle: "energetic, kitchen-chemistry analogies",
    catchphrases: ["Let's mix it up…", "Everything is chemistry, really"],
    voice: GUEST_VOICES.energeticMale,
    expertise: ["chemistry", "chemical", "chemicals", "reaction", "reactions", "atom", "atoms", "molecule", "molecules", "acid", "acids", "base", "bases", "salt", "salts", "element", "elements", "compound", "compounds", "metal", "metals", "periodic", "bond", "bonds", "oxidation", "mixture", "solution", "gas", "gases", "liquid", "solid", "alkali", "catalyst", "matter"],
  },
];

// A tag "hits" a topic word on an exact match, or on a shared stem so plurals
// and inflections count (acids↔acid, triangles↔triangle, trigonometric↔
// trigonometry, programming↔program). Gated to length >= 4 so short tags
// (ai, ph, war, gas, sun) only match EXACTLY — this prevents noise like "ion"
// matching "revolution" or "art" matching "earth".
function tagHits(token: string, tag: string): boolean {
  if (token === tag) return true;
  if (token.length >= 4 && tag.length >= 4) {
    return token.startsWith(tag) || tag.startsWith(token);
  }
  return false;
}

// Score each persona by how many of its expertise tags the topic evokes; the
// highest-scoring specialist wins, else null → caller uses the generic guest.
export function matchPersona(topic: string): PodcastPersona | null {
  const tokens = topic.toLowerCase().replace(/[^a-z0-9\s]/g, " ").split(/\s+/).filter(Boolean);
  let best: PodcastPersona | null = null;
  let bestScore = 0;
  for (const p of PERSONAS) {
    let score = 0;
    for (const tag of p.expertise) {
      if (tokens.some((tok) => tagHits(tok, tag))) score += 1;
    }
    if (score > bestScore) { bestScore = score; best = p; }
  }
  return bestScore > 0 ? best : null;
}

// Portrait helpers live in a client-safe module (no server imports). Re-export
// here so server code + existing tests can keep importing them from podcastPersonas.
export { personaPortrait, GENERIC_PORTRAIT } from "@/lib/podcastPortraits";

// Fictional generic archetype — NOT based on any real person. Used when no
// curated persona matches, keeping the long tail copyright-safe.
export function buildDynamicPersona(topic: string): PodcastPersona {
  const clean = topic.trim() || "this subject";
  return {
    id: "dynamic",
    name: "Professor Sage Ellory",
    archetype: `enthusiastic ${clean} expert`,
    bio: `A friendly specialist who has spent years exploring ${clean}.`,
    personality: "curious, warm, encouraging",
    speakingStyle: "clear, lots of relatable examples",
    catchphrases: ["Great question…", "Here's the cool part"],
    voice: GUEST_VOICES.warmMale,
    expertise: [],
  };
}
