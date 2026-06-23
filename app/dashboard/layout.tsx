"use client";
import { useState, useEffect, useRef, useCallback } from "react";
import Link from "next/link";
import { UserButton } from "@clerk/nextjs";
import { ArenaEnvironment } from "@/components/dashboard/ArenaEnvironment";
import { AidaAssistant } from "@/components/aida/AidaAssistant";
import { PersonalisationNudge } from "@/components/dashboard/PersonalisationNudge";
import { ChatChannelsProvider } from "@/lib/chatChannels";
import { getArena, ACTIVE_ARENA_CHANGED_EVENT } from "@/lib/arenas";
import { playArenaEnterSound } from "@/lib/gameAudio";
import type { Profile } from "@/types";


export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [arenaOverride, setArenaOverride] = useState<number | null>(null);
  const [navVisible, setNavVisible] = useState(false);
  const hideTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const prevArenaRef = useRef<number | null>(null);

  const showNav = useCallback(() => {
    if (hideTimerRef.current) clearTimeout(hideTimerRef.current);
    setNavVisible(true);
  }, []);

  const scheduleHide = useCallback(() => {
    hideTimerRef.current = setTimeout(() => setNavVisible(false), 300);
  }, []);

  useEffect(() => {
    fetch("/api/profile")
      .then(r => r.ok ? r.json() : { profile: null })
      .then(({ profile }) => setProfile(profile))
      .catch(() => {});
  }, []);

  useEffect(() => {
    const onArena = (e: Event) => {
      const ce = e as CustomEvent<{ arenaId: number }>;
      if (typeof ce.detail?.arenaId === "number") setArenaOverride(ce.detail.arenaId);
    };
    window.addEventListener(ACTIVE_ARENA_CHANGED_EVENT, onArena);
    return () => window.removeEventListener(ACTIVE_ARENA_CHANGED_EVENT, onArena);
  }, []);

  useEffect(() => {
    if (arenaOverride != null && profile?.active_arena === arenaOverride) {
      setArenaOverride(null);
    }
  }, [profile?.active_arena, arenaOverride]);

  const effectiveArenaId = arenaOverride ?? profile?.active_arena ?? 1;
  const arena = getArena(effectiveArenaId);

  // P2: soft chime on arena change (opt-in + no chime until profile loaded — avoids default “1” → real id false positive)
  useEffect(() => {
    if (profile == null) return;
    if (prevArenaRef.current === null) {
      prevArenaRef.current = effectiveArenaId;
      return;
    }
    if (prevArenaRef.current !== effectiveArenaId) {
      playArenaEnterSound(arena.environmentPreset);
      prevArenaRef.current = effectiveArenaId;
    }
  }, [profile, effectiveArenaId, arena.environmentPreset]);
  const xp    = profile?.xp    ?? 0;
  const level = profile?.level ?? 1;

  // XP progress within current level
  const currentThreshold = [0, 100, 300, 600, 1000, 1500][level - 1] ?? 0;
  const nextThreshold    = [100, 300, 600, 1000, 1500, 99999][level - 1] ?? 99999;
  const isMaxed          = level >= 6;
  const progress         = isMaxed ? 100
    : Math.round(((xp - currentThreshold) / (nextThreshold - currentThreshold)) * 100);

  return (
    <ChatChannelsProvider>
    <div
      className="relative overflow-hidden bg-[#08080F]"
      style={{ height: "100dvh", position: "fixed", inset: 0 }}
    >
      <ArenaEnvironment preset={arena.environmentPreset} gradient={arena.gradient} />

      {/* ── Hover trigger strip — always visible, sits at top ── */}
      <div
        className="fixed top-0 left-0 right-0 z-50"
        style={{ height: 10 }}
        onMouseEnter={showNav}
      />

      {/* ── Top nav — slides in from top on hover ── */}
      <header
        className="fixed top-0 left-0 right-0 z-40 border-b"
        style={{
          background:       "rgba(255,255,255,0.92)",
          borderColor:      "rgba(0,0,0,0.07)",
          backdropFilter:   "blur(20px)",
          transform:        navVisible ? "translateY(0)" : "translateY(-100%)",
          transition:       "transform 0.3s cubic-bezier(0.16,1,0.3,1)",
        }}
        onMouseEnter={showNav}
        onMouseLeave={scheduleHide}
      >
        {/* Pure vmin throughout — no fixed Tailwind px sizing — so the whole
            nav bar shrinks and grows continuously with the window, same as
            the playground panel elements. */}
        <div className="flex items-center justify-between w-full" style={{ padding: "1.3vmin 2.5vmin", gap: "2vmin" }}>

          {/* Logo */}
          <Link href="/" className="flex items-center flex-shrink-0" style={{ gap: "1.3vmin" }}>
            <div className="rounded-lg flex items-center justify-center"
              style={{ width: "3.5vmin", height: "3.5vmin", background: arena.accent }}>
              <svg viewBox="0 0 16 16" fill="none" style={{ width: "1.8vmin", height: "1.8vmin" }}>
                <path d="M8 2L14 6V10L8 14L2 10V6L8 2Z" fill="#08080F"/>
              </svg>
            </div>
            <span className="font-display font-black tracking-tight hidden sm:block" style={{ color: "#1a1a2e", fontSize: "2vmin" }}>
              AI<span style={{ color: arena.accent }}>Decoder</span>
            </span>
          </Link>


          <div className="flex-1" />

          {/* Right — XP + level + avatar */}
          <div className="flex items-center flex-shrink-0" style={{ gap: "1.5vmin" }}>
            {profile && (
              <div className="hidden sm:flex items-center" style={{ gap: "1.3vmin" }}>
                {/* Level badge */}
                <div className="flex items-center rounded-xl border"
                  style={{ gap: "0.75vmin", padding: "0.5vmin 1.3vmin", background: arena.accentDim, borderColor: arena.accent + "40" }}>
                  <span style={{ fontSize: "1.8vmin" }}>{arena.emoji}</span>
                  <span className="font-display font-black" style={{ color: arena.accent, fontSize: "1.5vmin" }}>
                    Lv {level}
                  </span>
                </div>

                {/* XP bar */}
                <div style={{ width: "12vmin", display: "flex", flexDirection: "column", gap: "0.25vmin" }}>
                  <div className="flex justify-between">
                    <span className="font-mono" style={{ color: "rgba(0,0,0,0.35)", fontSize: "1.1vmin" }}>{xp} XP</span>
                    {!isMaxed && <span className="font-mono" style={{ color: "rgba(0,0,0,0.25)", fontSize: "1.1vmin" }}>{nextThreshold}</span>}
                  </div>
                  <div className="rounded-full overflow-hidden" style={{ height: "0.5vmin", background: "rgba(0,0,0,0.10)" }}>
                    <div className="h-full rounded-full transition-all duration-1000"
                      style={{
                        width:      `${progress}%`,
                        background: arena.accent,
                        boxShadow:  `0 0 6px ${arena.accentGlow}`,
                      }}/>
                  </div>
                </div>

                {/* Streak */}
                {(profile.streak_days ?? 0) > 0 && (
                  <div className="flex items-center rounded-lg border border-orange-500/20"
                    style={{ gap: "0.5vmin", padding: "0.5vmin 1vmin", background: "rgba(255,107,43,0.1)" }}>
                    <span style={{ fontSize: "1.8vmin" }}>🔥</span>
                    <span className="font-display font-black text-orange-400" style={{ fontSize: "1.5vmin" }}>
                      {profile.streak_days}
                    </span>
                  </div>
                )}
              </div>
            )}
            <UserButton afterSignOutUrl="/auth/sign-in"
              appearance={{ elements: { userButtonAvatarBox: { width: "4vmin", height: "4vmin" } } }}
            />
          </div>
        </div>
      </header>

      {/* ── Main content — always full-height since nav is overlaid ── */}
      <main className="relative z-10 w-full overflow-hidden" style={{ height: "100dvh" }}>
        {children}
      </main>

      <AidaAssistant profile={profile} />
      <PersonalisationNudge profile={profile} />
    </div>
    </ChatChannelsProvider>
  );
}