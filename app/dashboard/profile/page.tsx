"use client";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { cn, INTEREST_OPTIONS } from "@/lib/utils";
import {
  getArena, getUnlockedArenas, getXPProgress, getXPForNextLevel,
  BADGES, ARENAS,
} from "@/lib/arenas";
import { isGameSfxEnabled, setGameSfxEnabled } from "@/lib/gameAudio";
import LearnerStats from "@/components/profile/LearnerStats";
import TeacherViewCard from "@/components/profile/TeacherViewCard";
import type { AgeGroup, Profile } from "@/types";

// ─── Onboarding helpers ───────────────────────────────────────────────────────
const BOARDS = ["CBSE", "ICSE", "State Board"];
const GRADES = ["6", "7", "8", "9", "10", "11", "12"];

function getDefaultAvatar(name: string): string {
  const initials: Record<string, string> = {
    a:"🦁",b:"🐻",c:"🐱",d:"🐶",e:"🦅",f:"🦊",g:"🦍",h:"🐹",i:"🦔",j:"🐯",
    k:"🦘",l:"🦁",m:"🐭",n:"🦎",o:"🦉",p:"🐼",q:"🦆",r:"🐰",s:"🐍",t:"🐯",
    u:"🦄",v:"🦅",w:"🐺",x:"🦖",y:"🦚",z:"🦓",
  };
  return initials[name?.charAt(0).toLowerCase() ?? "s"] ?? "🚀";
}

function gradeToAgeGroup(grade: string): AgeGroup {
  const g = parseInt(grade);
  if (g <= 5)  return "5-7";
  if (g <= 7)  return "8-10";
  if (g <= 10) return "11-13";
  return "14+";
}

function isProfileComplete(p: Record<string, unknown>): boolean {
  return !!(p.display_name && p.age_group);
}

// ─── Onboarding flow ──────────────────────────────────────────────────────────
function OnboardingFlow() {
  const router   = useRouter();
  const [saving,       setSaving]       = useState(false);
  const [step,         setStep]         = useState(0);
  const [board,        setBoard]        = useState("CBSE");
  const [grade,        setGrade]        = useState("8");
  const [interests,    setInterests]    = useState<string[]>([]);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const [photoFile,    setPhotoFile]    = useState<File | null>(null);

  const [authName, setAuthName] = useState("Explorer");
  useEffect(() => {
    fetch("/api/profile")
      .then(r => r.ok ? r.json() : { profile: null })
      .then(({ profile }) => {
        if (profile?.display_name) setAuthName(profile.display_name);
      })
      .catch(() => {});
  }, []);
  const displayName = authName;
  const defaultAvatar = getDefaultAvatar(displayName);
  const displayPhoto = photoPreview ?? null;

  const handlePhotoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setPhotoFile(file);
    const reader = new FileReader();
    reader.onload = () => setPhotoPreview(reader.result as string);
    reader.readAsDataURL(file);
  };

  const toggleInterest = (i: string) =>
    setInterests(prev => prev.includes(i) ? prev.filter(x => x !== i) : prev.length < 8 ? [...prev, i] : prev);

  const [saveError, setSaveError] = useState<string | null>(null);
  const handleSave = async () => {
    setSaveError(null);
    setSaving(true);
    console.log("[Onboarding] handleSave fired", { displayName, board, grade, interests });
    try {
      let avatarUrl: string | null = null;
      if (photoFile) {
        const fd = new FormData();
        fd.append("file", photoFile);
        const r = await fetch("/api/profile/photo", { method: "POST", body: fd });
        if (r.ok) {
          ({ url: avatarUrl } = await r.json());
        } else {
          console.warn("[Onboarding] photo upload failed", r.status, await r.text().catch(() => ""));
        }
      }
      const payload = {
        display_name: displayName,
        avatar_emoji: defaultAvatar,
        avatar_url:   avatarUrl ?? null,
        age_group:    gradeToAgeGroup(grade),
        interests,
      };
      console.log("[Onboarding] POST /api/profile", payload);
      const res = await fetch("/api/profile", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      console.log("[Onboarding] /api/profile response", res.status);
      if (res.ok) {
        router.replace("/dashboard");
        return;
      }
      const errText = await res.text().catch(() => "");
      console.error("[Onboarding] save failed:", res.status, errText);
      setSaveError(`Save failed (${res.status}). ${errText.slice(0, 200) || "Check the network tab."}`);
      setSaving(false);
    } catch (err) {
      console.error("[Onboarding] save threw:", err);
      setSaveError(`Network error: ${(err as Error)?.message ?? "unknown"}`);
      setSaving(false);
    }
  };

  const ACCENT = "#7C3AED";
  const ACCENT_GLOW = "rgba(124,58,237,0.4)";

  return (
    <div className="relative w-full flex items-center justify-center p-8"
      style={{ minHeight: "100%", fontFamily: "var(--font-dm-sans,'DM Sans',sans-serif)" }}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src="/panels/background.png" alt="" aria-hidden draggable={false}
        style={{ position: "fixed", top: 0, left: 0, width: "100vw", height: "100vh", objectFit: "fill", zIndex: 0, pointerEvents: "none", userSelect: "none" }} />

      <div className="relative z-10 w-full max-w-lg">
        <div className="flex gap-2 justify-center mb-8">
          {[0,1].map(i => (
            <div key={i} className={cn(
              "h-1.5 rounded-full transition-all duration-300",
              i === step ? "w-8" : "w-2"
            )}
              style={{ background: i === step ? ACCENT : i < step ? `${ACCENT}66` : "rgba(0,0,0,0.1)" }}/>
          ))}
        </div>

        <AnimatePresence mode="wait">
          <motion.div key={step}
            initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }} transition={{ duration: 0.25 }}
            className="rounded-3xl overflow-hidden"
            style={{
              background: "rgba(255,255,255,0.92)", backdropFilter: "blur(20px)",
              border: "1px solid rgba(255,255,255,0.75)",
              boxShadow: "0 8px 32px rgba(0,0,0,0.12), 0 1px 0 rgba(255,255,255,0.8) inset",
            }}>

            <div className="px-8 pt-7 pb-5" style={{ borderBottom: "1px solid rgba(0,0,0,0.06)" }}>
              <span className="text-[10px] font-bold uppercase tracking-widest" style={{ color: ACCENT }}>
                Step {step + 1} of 2
              </span>
              <h1 className="text-2xl font-black mb-1 mt-3" style={{ color: "#1a1a2e", fontFamily: "var(--font-space-grotesk,'Space Grotesk',sans-serif)" }}>
                {step === 0 ? `Welcome, ${displayName}! 👋` : "Your learning profile"}
              </h1>
              <p className="text-sm" style={{ color: "#888" }}>
                {step === 0 ? "Add a profile photo, or we'll pick one for you." : "Help us personalise your AI experience."}
              </p>
            </div>

            <div className="px-8 py-6">
              {step === 0 && (
                <div className="flex flex-col items-center gap-6">
                  <div className="relative">
                    <div className="w-28 h-28 rounded-full overflow-hidden flex items-center justify-center"
                      style={{ background: "rgba(124,58,237,0.08)", border: `3px solid ${ACCENT}40` }}>
                      {displayPhoto
                        ? <img src={displayPhoto} alt="Profile" className="w-full h-full object-cover"/>
                        : <span className="text-5xl">{defaultAvatar}</span>}
                    </div>
                    <label className="absolute bottom-0 right-0 w-9 h-9 rounded-full flex items-center justify-center cursor-pointer transition-all hover:scale-110"
                      style={{ background: ACCENT, boxShadow: `0 4px 16px ${ACCENT_GLOW}` }}>
                      <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                        <path d="M8 3v10M3 8l5-5 5 5" stroke="#fff" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
                      </svg>
                      <input type="file" accept="image/*" className="hidden" onChange={handlePhotoChange}/>
                    </label>
                  </div>
                  <p className="text-sm text-center" style={{ color: "#888" }}>
                    {displayPhoto ? "Looking great! 🎉" : `We'll use ${defaultAvatar} for now`}
                  </p>
                </div>
              )}

              {step === 1 && (
                <div className="space-y-5">
                  <div>
                    <label className="text-[10px] font-bold uppercase tracking-widest mb-2 block" style={{ color: "#999" }}>Education Board</label>
                    <div className="flex gap-2 flex-wrap">
                      {BOARDS.map(b => (
                        <button key={b} onClick={() => setBoard(b)}
                          className="px-4 py-2 rounded-xl text-sm font-bold border transition-all"
                          style={board === b
                            ? { background: ACCENT, color: "#fff", borderColor: "transparent", boxShadow: `0 0 20px ${ACCENT_GLOW}` }
                            : { background: "rgba(0,0,0,0.03)", borderColor: "rgba(0,0,0,0.08)", color: "#888" }}>
                          {b}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div>
                    <label className="text-[10px] font-bold uppercase tracking-widest mb-2 block" style={{ color: "#999" }}>Grade / Class</label>
                    <div className="flex gap-2 flex-wrap">
                      {GRADES.map(g => (
                        <button key={g} onClick={() => setGrade(g)}
                          className="w-12 h-12 rounded-xl text-sm font-bold border transition-all"
                          style={grade === g
                            ? { background: ACCENT, color: "#fff", borderColor: "transparent" }
                            : { background: "rgba(0,0,0,0.03)", borderColor: "rgba(0,0,0,0.08)", color: "#888" }}>
                          {g}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div>
                    <label className="text-[10px] font-bold uppercase tracking-widest mb-2 block" style={{ color: "#999" }}>
                      Interests <span className="normal-case font-normal" style={{ color: "#bbb" }}>(pick up to 8)</span>
                    </label>
                    <div className="flex flex-wrap gap-2">
                      {INTEREST_OPTIONS.map(interest => (
                        <button key={interest} onClick={() => toggleInterest(interest)}
                          className="px-3 py-1.5 rounded-full text-xs font-bold border transition-all"
                          style={interests.includes(interest)
                            ? { background: ACCENT, color: "#fff", borderColor: "transparent" }
                            : { background: "rgba(0,0,0,0.03)", borderColor: "rgba(0,0,0,0.08)", color: "#999" }}>
                          {interest}
                        </button>
                      ))}
                    </div>
                    <p className="text-[10px] mt-2" style={{ color: "#bbb" }}>{interests.length}/8 selected</p>
                  </div>
                </div>
              )}

              {saveError && (
                <div className="mt-4 px-3 py-2 rounded-lg text-xs relative"
                     style={{ background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.3)", color: "#DC2626" }}>
                  <button
                    onClick={() => setSaveError(null)}
                    className="absolute top-1.5 right-2 hover:opacity-70 transition-opacity leading-none"
                    aria-label="Dismiss error"
                    style={{ fontSize: 16, fontWeight: 700, color: "#DC2626" }}
                  >
                    ×
                  </button>
                  <span className="pr-5 block">{saveError}</span>
                  <button
                    onClick={() => router.push("/dashboard/playground")}
                    className="mt-2 text-[10px] font-bold underline underline-offset-2 hover:opacity-70 transition-opacity"
                  >
                    Continue to playground anyway →
                  </button>
                </div>
              )}
              <div className="flex gap-3 mt-8">
                {step > 0 && (
                  <button onClick={() => setStep(s => s - 1)}
                    className="flex-1 py-3.5 rounded-xl font-bold text-sm border transition-all hover:opacity-80"
                    style={{ borderColor: "rgba(0,0,0,0.08)", color: "#999", background: "rgba(0,0,0,0.02)" }}>
                    ← Back
                  </button>
                )}
                {step === 0 ? (
                  <button onClick={() => setStep(1)}
                    className="flex-1 py-3.5 rounded-xl font-black text-sm transition-all hover:scale-[1.02] active:scale-95"
                    style={{ background: ACCENT, color: "#fff", boxShadow: `0 0 24px ${ACCENT_GLOW}` }}>
                    Next →
                  </button>
                ) : (
                  <button onClick={handleSave} disabled={saving}
                    className="flex-1 py-3.5 rounded-xl font-black text-sm transition-all hover:scale-[1.02] active:scale-95 disabled:opacity-50"
                    style={{ background: ACCENT, color: "#fff", boxShadow: `0 0 24px ${ACCENT_GLOW}` }}>
                    {saving ? "Setting up…" : "Let's go! 🚀"}
                  </button>
                )}
              </div>
              {step === 0 && (
                <button onClick={() => setStep(1)} className="w-full text-center text-xs mt-4 transition-colors hover:opacity-70" style={{ color: "#bbb" }}>
                  Skip photo →
                </button>
              )}
              {step === 1 && (
                <button onClick={() => router.push("/dashboard/playground")} className="w-full text-center text-xs mt-4 transition-colors hover:opacity-70" style={{ color: "#bbb" }}>
                  Skip for now →
                </button>
              )}
            </div>
          </motion.div>
        </AnimatePresence>
      </div>
    </div>
  );
}

// ─── Arena objectives — per-arena mission lists ──────────────────────────────
type ObjectiveCtx = {
  xp: number; level: number; streak: number; creationCount: number; badges: Set<string>;
  textCount: number; jsonCount: number; imageCount: number; audioCount: number; slidesCount: number;
};
type Objective = { id: string; label: string; check: (c: ObjectiveCtx) => boolean };

// Each arena defines 18 missions — a 6-week curriculum-style progression.
// Trackable goals tie to real signals (badges, counts, level, streak); the rest are
// forward-looking learning prompts that appear as unchecked until manually surfaced.
const ARENA_OBJECTIVES: Record<number, Objective[]> = {
  1: [
    { id: "send_first",     label: "Send your first message to AI",       check: c => c.xp > 0 },
    { id: "first_creation", label: "Save your first creation",            check: c => c.badges.has("first_creation") },
    { id: "ask_concept",    label: "Ask AI to explain a concept",         check: c => c.textCount >= 1 },
    { id: "what_if",        label: "Try a 'what if' question",            check: c => c.textCount >= 2 },
    { id: "text_5",         label: "Generate text 5 times",               check: c => c.textCount >= 5 },
    { id: "ask_hobby",      label: "Ask AI about your favourite hobby",   check: c => c.textCount >= 3 },
    { id: "ask_science",    label: "Ask a science question",              check: c => c.textCount >= 4 },
    { id: "compare",        label: "Ask AI to compare two things",        check: c => c.textCount >= 6 },
    { id: "text_10",        label: "Generate text 10 times",              check: c => c.textCount >= 10 },
    { id: "save_3",         label: "Save 3 creations to your library",    check: c => c.creationCount >= 3 },
    { id: "save_5",         label: "Save 5 creations",                    check: c => c.creationCount >= 5 },
    { id: "streak_3",       label: "Build a 3-day creation streak",       check: c => c.badges.has("streak_3") },
    { id: "summarize",      label: "Ask AI to summarise a topic",         check: c => c.textCount >= 8 },
    { id: "first_json",     label: "Generate your first JSON output",     check: c => c.jsonCount >= 1 },
    { id: "librarian",      label: "Save 10 creations (Librarian badge)", check: c => c.badges.has("librarian") },
    { id: "try_other",      label: "Try image, audio, or slides once",    check: c => c.imageCount + c.audioCount + c.slidesCount >= 1 },
    { id: "use_picker",     label: "Use the creation picker to add context", check: c => c.creationCount >= 4 },
    { id: "level_2",        label: "Reach Level 2 to unlock Prompt Lab",  check: c => c.level >= 2 },
  ],
  2: [
    { id: "unlock",         label: "Reach Level 2 to enter the lab",      check: c => c.level >= 2 },
    { id: "badge",          label: "Earn the Prompt Lab badge",           check: c => c.badges.has("prompt_lab") },
    { id: "long_prompt",    label: "Write a detailed 50+ word prompt",    check: c => c.textCount >= 12 },
    { id: "step_by_step",   label: "Use a 'step by step' prompt",         check: c => c.textCount >= 14 },
    { id: "role_prompt",    label: "Try role-based prompting (act as…)",  check: c => c.textCount >= 16 },
    { id: "json_3",         label: "Generate JSON output 3 times",        check: c => c.jsonCount >= 3 },
    { id: "json_5",         label: "Generate JSON output 5 times",        check: c => c.jsonCount >= 5 },
    { id: "constraints",    label: "Try a prompt with constraints",       check: c => c.jsonCount >= 2 },
    { id: "persona",        label: "Use a persona-driven prompt",         check: c => c.textCount >= 18 },
    { id: "chain_thought",  label: "Use a chain-of-thought prompt",       check: c => c.textCount >= 20 },
    { id: "compare_2",      label: "Compare two different prompts",       check: c => c.textCount >= 22 },
    { id: "system_inst",    label: "Use clear system instructions",       check: c => c.jsonCount >= 4 },
    { id: "save_3_prompts", label: "Save 3 prompt experiments",           check: c => c.creationCount >= 8 },
    { id: "text_20",        label: "Generate text 20 times overall",      check: c => c.textCount >= 20 },
    { id: "json_save",      label: "Save 5 JSON creations",               check: c => c.jsonCount >= 5 },
    { id: "streak_5",       label: "Build a 5-day streak",                check: c => c.streak >= 5 },
    { id: "lib_10",         label: "Save 10 prompt-lab creations",        check: c => c.creationCount >= 12 },
    { id: "level_3",        label: "Reach Level 3 to unlock Story Forge", check: c => c.level >= 3 },
  ],
  3: [
    { id: "unlock",         label: "Reach Level 3 to enter the forge",    check: c => c.level >= 3 },
    { id: "badge",          label: "Earn the Story Forge badge",          check: c => c.badges.has("story_forge") },
    { id: "first_story",    label: "Write your first story prompt",       check: c => c.textCount >= 24 },
    { id: "character",      label: "Create a character description",      check: c => c.textCount >= 26 },
    { id: "twist",          label: "Build a story with a twist ending",   check: c => c.textCount >= 28 },
    { id: "three_act",      label: "Write a 3-act story structure",       check: c => c.textCount >= 30 },
    { id: "dialogue",       label: "Write dialogue between characters",   check: c => c.textCount >= 32 },
    { id: "fantasy",        label: "Build a fantasy world",               check: c => c.textCount >= 34 },
    { id: "scifi",          label: "Write a sci-fi scene",                check: c => c.textCount >= 36 },
    { id: "save_3_stories", label: "Save 3 stories to your library",      check: c => c.creationCount >= 15 },
    { id: "save_5_stories", label: "Save 5 stories",                      check: c => c.creationCount >= 17 },
    { id: "story_slides",   label: "Build a story slide deck",            check: c => c.slidesCount >= 1 },
    { id: "streak_7",       label: "Earn the 7-day Week Warrior streak",  check: c => c.badges.has("streak_7") },
    { id: "genres_3",       label: "Try 3 different genres",              check: c => c.textCount >= 38 },
    { id: "continue",       label: "Continue a story across sessions",    check: c => c.textCount >= 40 },
    { id: "cliffhanger",    label: "End a chapter on a cliffhanger",      check: c => c.textCount >= 42 },
    { id: "save_10_stories",label: "Save 10 stories",                     check: c => c.creationCount >= 20 },
    { id: "level_4",        label: "Reach Level 4 to unlock Visual Studio", check: c => c.level >= 4 },
  ],
  4: [
    { id: "unlock",         label: "Reach Level 4 to enter the studio",   check: c => c.level >= 4 },
    { id: "badge",          label: "Earn the Visual Studio badge",        check: c => c.badges.has("visual_studio") },
    { id: "first_image",    label: "Generate your first image",           check: c => c.badges.has("image_maker") },
    { id: "image_3",        label: "Generate 3 images",                   check: c => c.imageCount >= 3 },
    { id: "image_5",        label: "Generate 5 images",                   check: c => c.imageCount >= 5 },
    { id: "portrait",       label: "Try a portrait prompt",               check: c => c.imageCount >= 6 },
    { id: "landscape",      label: "Try a landscape prompt",              check: c => c.imageCount >= 7 },
    { id: "scifi_scene",    label: "Generate a sci-fi scene",             check: c => c.imageCount >= 8 },
    { id: "img2img",        label: "Modify an image with img-to-img",     check: c => c.imageCount >= 9 },
    { id: "abstract",       label: "Try an abstract art prompt",          check: c => c.imageCount >= 10 },
    { id: "image_10",       label: "Generate 10 images",                  check: c => c.imageCount >= 10 },
    { id: "character_des",  label: "Design a character",                  check: c => c.imageCount >= 12 },
    { id: "logo",           label: "Generate a logo concept",             check: c => c.imageCount >= 14 },
    { id: "save_5_images",  label: "Save 5 images to library",            check: c => c.imageCount >= 5 && c.creationCount >= 22 },
    { id: "save_10_images", label: "Save 10 images",                      check: c => c.imageCount >= 10 && c.creationCount >= 26 },
    { id: "deck_w_image",   label: "Build a slide deck with images",      check: c => c.slidesCount >= 2 },
    { id: "image_15",       label: "Generate 15 images total",            check: c => c.imageCount >= 15 },
    { id: "level_5",        label: "Reach Level 5 to unlock Sound Booth", check: c => c.level >= 5 },
  ],
  5: [
    { id: "unlock",         label: "Reach Level 5 to enter the booth",    check: c => c.level >= 5 },
    { id: "badge",          label: "Earn the Sound Booth badge",          check: c => c.badges.has("sound_booth") },
    { id: "first_audio",    label: "Generate your first audio (Voice Actor)", check: c => c.badges.has("voice_actor") },
    { id: "audio_3",        label: "Generate 3 audio clips",              check: c => c.audioCount >= 3 },
    { id: "narrator",       label: "Try a single-narrator audio",         check: c => c.audioCount >= 4 },
    { id: "multi_char",     label: "Try multi-character dialogue",        check: c => c.audioCount >= 5 },
    { id: "ssml_emotion",   label: "Use emotion / SSML in a script",      check: c => c.audioCount >= 6 },
    { id: "rap",            label: "Create a rap or rhyme audio",         check: c => c.audioCount >= 7 },
    { id: "narration",      label: "Create a narration",                  check: c => c.audioCount >= 8 },
    { id: "audio_5",        label: "Generate 5 audio clips total",        check: c => c.audioCount >= 5 },
    { id: "voices_3",       label: "Try 3 different voices",              check: c => c.audioCount >= 9 },
    { id: "modify_audio",   label: "Modify an existing audio",            check: c => c.audioCount >= 10 },
    { id: "save_5_audio",   label: "Save 5 audio clips",                  check: c => c.audioCount >= 5 && c.creationCount >= 28 },
    { id: "audio_scene",    label: "Build an audio scene",                check: c => c.audioCount >= 11 },
    { id: "podcast",        label: "Create a podcast intro",              check: c => c.audioCount >= 12 },
    { id: "save_10_audio",  label: "Save 10 audio creations",             check: c => c.audioCount >= 10 && c.creationCount >= 32 },
    { id: "audio_15",       label: "Generate 15 audio clips total",       check: c => c.audioCount >= 15 },
    { id: "level_6",        label: "Reach Level 6 to unlock Director's Suite", check: c => c.level >= 6 },
  ],
  6: [
    { id: "unlock",         label: "Reach Level 6 to enter the suite",    check: c => c.level >= 6 },
    { id: "badge",          label: "Earn the Director's Suite badge",     check: c => c.badges.has("directors_suite") },
    { id: "first_deck",     label: "Build your first slide deck",         check: c => c.badges.has("slide_master") },
    { id: "all_tools",      label: "Use every output type (Full Toolkit)", check: c => c.badges.has("all_tools") },
    { id: "deck_3",         label: "Build 3 slide decks",                 check: c => c.slidesCount >= 3 },
    { id: "deck_5",         label: "Build 5 slide decks",                 check: c => c.slidesCount >= 5 },
    { id: "prolific",       label: "Save 25 creations (Prolific badge)",  check: c => c.badges.has("prolific") },
    { id: "film_outline",   label: "Write a film script outline",         check: c => c.textCount >= 50 },
    { id: "combine",        label: "Combine image + audio + slides in one project", check: c => c.imageCount >= 5 && c.audioCount >= 3 && c.slidesCount >= 2 },
    { id: "multi_scene",    label: "Create a multi-scene story",          check: c => c.textCount >= 55 && c.imageCount >= 5 },
    { id: "module",         label: "Build a complete learning module",    check: c => c.slidesCount >= 6 },
    { id: "direct_arc",     label: "Direct a complete narrative arc",     check: c => c.textCount >= 60 },
    { id: "save_30",        label: "Save 30 creations to library",        check: c => c.creationCount >= 30 },
    { id: "save_50",        label: "Save 50 creations",                   check: c => c.creationCount >= 50 },
    { id: "deck_10",        label: "Build 10 slide decks",                check: c => c.slidesCount >= 10 },
    { id: "film_concept",   label: "Build a complete film concept",       check: c => c.slidesCount >= 8 && c.audioCount >= 6 },
    { id: "all_badges",     label: "Earn all 13 trophies",                check: c => c.badges.size >= 13 },
    { id: "architect",      label: "Become an AI Learning Architect",     check: c => c.level >= 6 && c.badges.size >= 13 },
  ],
};

// Badge category map — for the Trophy Hall grouping
const BADGE_CATEGORIES: { id: string; label: string; icon: string; ids: string[] }[] = [
  { id: "creation", label: "Creation",     icon: "✨", ids: ["first_creation", "image_maker", "voice_actor", "slide_master"] },
  { id: "mastery",  label: "Mastery",      icon: "🏆", ids: ["librarian", "prolific", "all_tools"] },
  { id: "streak",   label: "Streaks",      icon: "🔥", ids: ["streak_3", "streak_7"] },
  { id: "arena",    label: "Arena Unlocks", icon: "🌌", ids: ["prompt_lab", "story_forge", "visual_studio", "sound_booth", "directors_suite"] },
];

// ─── Trophy Room (profile dashboard) ─────────────────────────────────────────
function TrophyRoom({ profile }: { profile: Profile }) {
  const [arenaSfx, setArenaSfx] = useState(false);
  const [creationCount, setCreationCount] = useState<number | null>(null);
  const [typeCounts, setTypeCounts] = useState<Record<string, number>>({});
  useEffect(() => { setArenaSfx(isGameSfxEnabled()); }, []);
  useEffect(() => {
    fetch("/api/creations")
      .then(r => (r.ok ? r.json() : { creations: [] }))
      .then(({ creations }) => {
        const list = creations ?? [];
        setCreationCount(list.length);
        const counts: Record<string, number> = {};
        for (const c of list) counts[c.output_type] = (counts[c.output_type] ?? 0) + 1;
        setTypeCounts(counts);
      })
      .catch(() => setCreationCount(null));
  }, []);

  const arena        = getArena(profile.active_arena ?? 1);
  const xp           = profile.xp ?? 0;
  const level        = profile.level ?? 1;
  const streak       = profile.streak_days ?? 0;
  const earnedBadges = new Set((profile.badges ?? []).map((b: { id: string }) => b.id));
  const progress     = getXPProgress(xp, level);
  const nextXPThreshold    = getXPForNextLevel(level);
  const isMaxLevel   = level >= 6;

  const objectiveCtx: ObjectiveCtx = {
    xp, level, streak, creationCount: creationCount ?? 0, badges: earnedBadges,
    textCount:   typeCounts.text   ?? 0,
    jsonCount:   typeCounts.json   ?? 0,
    imageCount:  typeCounts.image  ?? 0,
    audioCount:  typeCounts.audio  ?? 0,
    slidesCount: typeCounts.slides ?? 0,
  };

  return (
    <div className="relative overflow-y-auto" style={{ height: "100%", fontFamily: "var(--font-dm-sans,'DM Sans',sans-serif)" }}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src="/panels/background.png" alt="" aria-hidden draggable={false}
        style={{ position: "fixed", top: 0, left: 0, width: "100vw", height: "100vh", objectFit: "fill", zIndex: 0, pointerEvents: "none", userSelect: "none" }} />

      <div className="relative z-10 pt-32 pb-7" style={{ marginLeft: "22%", marginRight: "26%" }}>

        {/* ─── Overall box — wraps every section ─── */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          className="relative rounded-3xl overflow-hidden p-4 md:p-5 space-y-4"
          style={{
            background: "rgba(255,255,255,0.94)", backdropFilter: "blur(24px)",
            border: "1px solid rgba(255,255,255,0.8)",
            boxShadow: "0 20px 60px rgba(0,0,0,0.18), 0 1px 0 rgba(255,255,255,0.9) inset",
            fontSize: "clamp(10px, 1vw, 16px)",
          }}
        >
          {/* Decorative accent stripe */}
          <div className="absolute top-0 left-0 right-0 h-1"
            style={{ background: `linear-gradient(90deg, transparent, ${arena.accent}, transparent)` }}/>

          {/* ─── Hero ─── */}
          <div className="grid grid-cols-1 sm:grid-cols-[3fr_2fr] gap-3 pb-4 items-stretch"
            style={{ borderBottom: "1px solid rgba(0,0,0,0.06)" }}>

            {/* Left — identity card */}
            <div className="rounded-2xl p-4 flex flex-col gap-2.5"
              style={{ background: `linear-gradient(135deg, ${arena.accent}18, rgba(255,255,255,0.75))`, border: `1px solid ${arena.accent}28` }}>

              {/* Top row: avatar | name info | streak box */}
              <div className="flex items-center gap-3">

                {/* Avatar with level badge */}
                <div className="relative shrink-0">
                  <div className="rounded-xl flex items-center justify-center overflow-hidden"
                    style={{ width: "3.5em", height: "3.5em", fontSize: "inherit", background: `${arena.accent}22`, border: `2px solid ${arena.accent}44` }}>
                    {profile.avatar_url
                      ? /* eslint-disable-next-line @next/next/no-img-element */
                        <img src={profile.avatar_url} alt="" className="w-full h-full object-cover" />
                      : <span style={{ fontSize: "1.5em" }}>{(profile as Profile & { avatar_emoji?: string }).avatar_emoji || getDefaultAvatar(profile.display_name ?? "")}</span>
                    }
                  </div>
                  <div className="absolute -bottom-1 -right-1 rounded-md flex items-center justify-center font-black"
                    style={{ width: "1.4em", height: "1.4em", fontSize: "0.75em", background: arena.accent, color: ["#7C3AED","#FF6B2B","#FF2D78"].includes(arena.accent) ? "#fff" : "#08080F" }}>
                    {level}
                  </div>
                </div>

                {/* Name + labels */}
                <div className="flex-1 min-w-0">
                  <div className="font-bold uppercase mb-0.5" style={{ fontSize: "0.6em", letterSpacing: "0.14em", color: "#888" }}>
                    {arena.weekLabel} · Active Arena
                  </div>
                  <div className="font-black leading-none truncate"
                    style={{ fontSize: "1.1em", fontFamily: "var(--font-space-grotesk,'Space Grotesk',sans-serif)", color: "#1a1a2e" }}>
                    {profile.display_name}
                  </div>
                  <div className="flex items-center gap-1 mt-0.5 font-bold" style={{ fontSize: "0.85em", color: arena.accent }}>
                    <span>{arena.emoji}</span>
                    <span>{arena.role}</span>
                  </div>
                </div>

                {/* Day Streak — inline, right of name */}
                <div className="shrink-0 rounded-xl flex flex-col items-center gap-0.5 text-center"
                  style={{
                    padding: "0.6em 0.8em",
                    background: "rgba(255,246,237,0.98)",
                    border: "1px solid rgba(255,160,80,0.28)",
                    minWidth: "4.5em",
                    boxShadow: "0 2px 8px rgba(255,140,60,0.12)",
                  }}>
                  <span style={{ fontSize: "1em", lineHeight: 1 }}>🔥</span>
                  <div className="font-black leading-tight"
                    style={{ fontSize: "1.4em", color: "#1a1a2e", fontFamily: "var(--font-space-grotesk,'Space Grotesk',sans-serif)" }}>
                    {streak}
                  </div>
                  <div className="font-bold uppercase" style={{ fontSize: "0.52em", letterSpacing: "0.12em", color: "#999" }}>
                    Day Streak
                  </div>
                </div>
              </div>

              {/* Level / XP row */}
              <div className="flex justify-between items-center mt-1">
                <span className="font-bold uppercase" style={{ fontSize: "0.68em", letterSpacing: "0.1em", color: "#999" }}>
                  {isMaxLevel ? "Max Level" : `Level ${level} → ${level + 1}`}
                </span>
                <span className="font-bold" style={{ fontSize: "0.75em", color: arena.accent }}>
                  {xp} XP{!isMaxLevel && <span style={{ color: "#aaa" }}> / {nextXPThreshold}</span>}
                </span>
              </div>

              {/* XP bar */}
              <div className="w-full h-2 rounded-full overflow-hidden" style={{ background: "rgba(0,0,0,0.08)" }}>
                <motion.div
                  initial={{ width: 0 }}
                  animate={{ width: `${isMaxLevel ? 100 : progress}%` }}
                  transition={{ duration: 1.4, ease: [0.16, 1, 0.3, 1] }}
                  className="h-full rounded-full relative overflow-hidden"
                  style={{ background: `linear-gradient(90deg, ${arena.accent}, ${arena.accent}cc)` }}>
                  <motion.div
                    className="absolute inset-0"
                    style={{ background: "linear-gradient(90deg, transparent, rgba(255,255,255,0.5), transparent)" }}
                    animate={{ x: ["-100%", "200%"] }}
                    transition={{ duration: 2.5, repeat: Infinity, ease: "linear" }}
                  />
                </motion.div>
              </div>

              {/* Unlock text */}
              {!isMaxLevel && (
                <div className="font-bold" style={{ fontSize: "0.68em", color: arena.accent }}>
                  {nextXPThreshold - xp} XP until you unlock <strong>{ARENAS[level]?.name}</strong>
                </div>
              )}
            </div>

            {/* Right — 4 stat boxes in 2×2 grid */}
            <div className="grid grid-cols-2 gap-2">
              {[
                { label: "Total XP",  value: xp,                                      icon: "⚡" },
                { label: "Creations", value: creationCount ?? "—",                    icon: "💎" },
                { label: "Badges",    value: `${earnedBadges.size}/${BADGES.length}`,  icon: "🏅" },
                { label: "Arenas",    value: `${getUnlockedArenas(level).length}/6`,   icon: "🌌" },
              ].map((s, i) => (
                <motion.div key={s.label}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.05 + i * 0.05 }}
                  className="rounded-2xl px-3 py-3 flex flex-col gap-1.5"
                  style={{ background: "rgba(255,255,255,0.92)", border: "1px solid rgba(0,0,0,0.07)", boxShadow: "0 2px 8px rgba(0,0,0,0.05)" }}>
                  <div className="flex items-center gap-1.5">
                    <span style={{ fontSize: "0.9em" }}>{s.icon}</span>
                    <span className="font-bold uppercase" style={{ fontSize: "0.6em", letterSpacing: "0.1em", color: "#aaa" }}>{s.label}</span>
                  </div>
                  <div className="font-black leading-none"
                    style={{ fontSize: "1.5em", color: "#1a1a2e", fontFamily: "var(--font-space-grotesk,'Space Grotesk',sans-serif)" }}>
                    {s.value}
                  </div>
                </motion.div>
              ))}
            </div>
          </div>

          {/* ─── Learner Stats + Teacher View — same light card style as the rest ─── */}
          <div className="space-y-4">
            <LearnerStats profile={profile} outputCounts={typeCounts} />
            <TeacherViewCard
              profile={profile}
              learner_model={(profile as Profile & { learner_model?: Record<string, unknown> | null }).learner_model ?? null}
            />
          </div>

          {/* ─── Trophy Hall — categorized badges ─── */}
          <div className="relative rounded-3xl overflow-hidden"
            style={{
              background: "rgba(255,255,255,0.92)",
              border: "1px solid rgba(255,255,255,0.75)",
              backdropFilter: "blur(20px)",
              boxShadow: "0 8px 32px rgba(0,0,0,0.12), 0 1px 0 rgba(255,255,255,0.8) inset",
            }}>
            {/* Top hairline */}
            <div className="absolute top-0 left-0 right-0 h-1 pointer-events-none"
              style={{ background: "linear-gradient(90deg, transparent, #C8A84B 30%, #FF6B2B 70%, transparent)" }} />
            <div className="p-5 md:p-6">
            <div className="flex items-baseline justify-between mb-2.5">
              <h2 className="font-black text-base flex items-center gap-1.5" style={{ color: "#1a1a2e", fontFamily: "var(--font-space-grotesk,'Space Grotesk',sans-serif)" }}>
                <span className="text-lg">🏆</span> Trophy Hall
              </h2>
              <span className="text-[9px] font-bold uppercase tracking-widest" style={{ color: "#bbb" }}>
                {earnedBadges.size} of {BADGES.length} earned
              </span>
            </div>

            <div className="space-y-3.5">
              {BADGE_CATEGORIES.map(cat => {
                const catBadges = BADGES.filter(b => cat.ids.includes(b.id));
                const catEarned = catBadges.filter(b => earnedBadges.has(b.id)).length;
                return (
                  <div key={cat.id}>
                    <div className="flex items-center gap-1.5 mb-1.5">
                      <span className="text-sm">{cat.icon}</span>
                      <span className="font-bold text-[10px] uppercase tracking-[0.13em]" style={{ color: "#777" }}>
                        {cat.label}
                      </span>
                      <span className="text-[9px]" style={{ color: "#bbb" }}>
                        {catEarned}/{catBadges.length}
                      </span>
                      <div className="flex-1 h-px ml-1.5" style={{ background: "rgba(0,0,0,0.06)" }}/>
                    </div>
                    <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 gap-2">
                      {catBadges.map((badge, i) => {
                        const earned = earnedBadges.has(badge.id);
                        return (
                          <motion.div key={badge.id}
                            initial={{ opacity: 0, scale: 0.9 }}
                            animate={{ opacity: 1, scale: 1 }}
                            transition={{ delay: 0.04 * i }}
                            whileHover={earned ? { y: -2, scale: 1.02 } : {}}
                            className="relative rounded-xl p-2.5 overflow-hidden text-center group cursor-default"
                            style={{
                              background: earned
                                ? "linear-gradient(180deg, rgba(0,0,0,0.04) 0%, rgba(0,0,0,0.02) 100%)"
                                : "rgba(0,0,0,0.07)",
                              border: `1px solid ${earned ? `${arena.accent}55` : "rgba(0,0,0,0.13)"}`,
                              boxShadow: earned ? `0 6px 18px -8px ${arena.accent}40` : "none",
                            }}>

                            {earned && (
                              <div className="absolute inset-x-0 -bottom-3 h-8 pointer-events-none"
                                style={{ background: `radial-gradient(ellipse at center, ${arena.accent}25 0%, transparent 70%)` }}/>
                            )}

                            <div className="relative mx-auto mb-1.5 w-10 h-10 rounded-xl flex items-center justify-center"
                              style={{
                                background: earned
                                  ? `linear-gradient(135deg, ${arena.accent}28, ${arena.accent}0c)`
                                  : "rgba(0,0,0,0.03)",
                                border: `1.5px solid ${earned ? `${arena.accent}50` : "rgba(0,0,0,0.06)"}`,
                              }}>
                              {earned && (
                                <motion.div
                                  className="absolute inset-0 rounded-xl"
                                  style={{ border: `1px solid ${arena.accent}` }}
                                  animate={{ opacity: [0.3, 0.8, 0.3] }}
                                  transition={{ duration: 2.5, repeat: Infinity, ease: "easeInOut" }}
                                />
                              )}
                              <span className={cn("text-xl relative", !earned && "grayscale opacity-40")}>
                                {badge.emoji}
                              </span>
                            </div>

                            <div className="font-black text-[9.5px] leading-tight mb-0.5"
                              style={{ color: earned ? "#1a1a2e" : "#bbb" }}>
                              {badge.name}
                            </div>
                            <div className="text-[8px] leading-snug" style={{ color: earned ? "#888" : "#ccc" }}>
                              {badge.condition}
                            </div>

                            {earned && (
                              <div className="absolute top-1.5 right-1.5 w-3.5 h-3.5 rounded-full flex items-center justify-center"
                                style={{ background: arena.accent }}>
                                <svg width="7" height="7" viewBox="0 0 12 12" fill="none">
                                  <path d="M2.5 6.5l2.5 2.5 4.5-5.5" stroke="#fff" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"/>
                                </svg>
                              </div>
                            )}
                          </motion.div>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
            </div>
          </div>

          {/* ─── Footer: Interests + audio settings ─── */}
          <div className="flex flex-col gap-3">
            {profile.interests?.length > 0 && (
              <div className="rounded-xl p-3.5" style={{ background: "rgba(0,0,0,0.02)", border: "1px solid rgba(0,0,0,0.06)" }}>
                <h3 className="font-bold text-[10px] uppercase tracking-[0.13em] mb-2 flex items-center gap-1.5" style={{ color: "#777" }}>
                  <span>✨</span> Your Interests
                </h3>
                <div className="flex flex-wrap gap-1.5">
                  {profile.interests.map(interest => (
                    <span key={interest}
                      className="px-2 py-0.5 rounded-full text-[10px] font-bold"
                      style={{ background: `${arena.accent}1a`, border: `1px solid ${arena.accent}40`, color: arena.accent }}>
                      {interest}
                    </span>
                  ))}
                </div>
              </div>
            )}

            <div className="relative rounded-3xl overflow-hidden"
              style={{
                background: "rgba(255,255,255,0.92)",
                border: "1px solid rgba(255,255,255,0.75)",
                backdropFilter: "blur(20px)",
                boxShadow: "0 8px 32px rgba(0,0,0,0.12), 0 1px 0 rgba(255,255,255,0.8) inset",
              }}>
              <div className="absolute top-0 left-0 right-0 h-1 pointer-events-none"
                style={{ background: "linear-gradient(90deg, transparent, #FF2D78 30%, #00D4FF 70%, transparent)" }} />
              <div className="p-5 md:p-6">
              <h3 className="font-bold text-[10px] uppercase tracking-[0.13em] mb-2 flex items-center gap-1.5" style={{ color: "#777" }}>
                <span>🎛️</span> Sound Effects
              </h3>
              <div className="flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <p className="font-bold text-[12px] leading-tight" style={{ color: "#1a1a2e" }}>Arena & level-up audio</p>
                  <p className="text-[9px] mt-0.5 leading-snug" style={{ color: "#999" }}>
                    Stings, fanfare, and badge sounds. Off by default.
                  </p>
                </div>
                <button
                  type="button"
                  role="switch"
                  aria-checked={arenaSfx}
                  aria-label="Arena and level-up sounds"
                  onClick={() => {
                    const next = !arenaSfx;
                    setGameSfxEnabled(next);
                    setArenaSfx(next);
                  }}
                  className="relative h-6 w-11 shrink-0 rounded-full transition-colors duration-200"
                  style={{
                    background: arenaSfx ? arena.accent : "rgba(0,0,0,0.16)",
                    boxShadow: arenaSfx ? `0 0 10px ${arena.accent}66` : "inset 0 1px 2px rgba(0,0,0,0.1)",
                  }}>
                  <span
                    className="absolute top-0.5 left-0.5 h-5 w-5 rounded-full bg-white shadow-md transition-transform duration-200"
                    style={{ transform: arenaSfx ? "translateX(20px)" : "translateX(0)" }}
                  />
                </button>
              </div>
              </div>
            </div>
          </div>
        </motion.div>

        <div className="h-6"/>
      </div>
    </div>
  );
}

// ─── Main export ──────────────────────────────────────────────────────────────
export default function ProfilePage() {
  const [loading, setLoading] = useState(true);
  const [profile, setProfile] = useState<Profile | null>(null);

  useEffect(() => {
    fetch("/api/profile")
      .then(r => r.ok ? r.json() : { profile: null })
      .then(({ profile }) => {
        setProfile(profile);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  if (loading) return (
    <div className="relative flex items-center justify-center" style={{ height: "100vh" }}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src="/panels/background.png" alt="" aria-hidden draggable={false}
        style={{ position: "fixed", top: 0, left: 0, width: "100vw", height: "100vh", objectFit: "fill", zIndex: 0, pointerEvents: "none", userSelect: "none" }} />
      <div className="relative z-10 flex gap-2">
        {[0,1,2].map(i => (
          <div key={i} className="dot w-3 h-3 rounded-full bg-[#7C3AED] shadow-[0_0_12px_rgba(124,58,237,0.45)]"/>
        ))}
      </div>
    </div>
  );

  // Not set up yet — show onboarding
  if (!profile || !isProfileComplete(profile as unknown as Record<string, unknown>)) {
    return <OnboardingFlow />;
  }

  // Set up — show trophy room
  return <TrophyRoom profile={profile} />;
}