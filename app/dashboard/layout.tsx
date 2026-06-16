"use client";
import { useState, useEffect, useRef } from "react";
import { usePathname } from "next/navigation";
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
  const pathname = usePathname();
  const isClassroom  = pathname?.startsWith("/dashboard/classroom") ?? false;
  const isHub        = pathname === "/dashboard";
  const isWorld      = pathname?.startsWith("/dashboard/world") ?? false;
  const isPlayground = pathname?.startsWith("/dashboard/playground") ?? false;
  const isHideNav    = isClassroom || isHub || isWorld || isPlayground;

  const [profile, setProfile] = useState<Profile | null>(null);
  const [arenaOverride, setArenaOverride] = useState<number | null>(null);
  const prevArenaRef = useRef<number | null>(null);

  // Nav visibility — auto-hides on classroom/hub pages, reveals on hover
  const [navVisible, setNavVisible] = useState(!isHideNav);
  const navTimerRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  useEffect(() => { setNavVisible(!isHideNav); }, [isHideNav]);
  useEffect(() => {
    window.dispatchEvent(new CustomEvent("nav-visibility-change", { detail: { visible: navVisible, height: 48 } }));
  }, [navVisible]);
  const showNav = () => { clearTimeout(navTimerRef.current); setNavVisible(true); };
  const hideNav = () => {
    if (!isHideNav) return;
    navTimerRef.current = setTimeout(() => setNavVisible(false), 400);
  };

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

      {/* Hover zone — catches cursor at top edge when nav is hidden */}
      {isHideNav && (
        <div className="fixed top-0 left-0 right-0 z-50 h-3" onMouseEnter={showNav} />
      )}

      {/* ── Top nav ── */}
      <header
        className="fixed top-0 left-0 right-0 z-40 border-b"
        style={{
          background:     "rgba(255,255,255,0.92)",
          borderColor:    "rgba(0,0,0,0.07)",
          backdropFilter: "blur(20px)",
          transform:      navVisible ? "translateY(0)" : "translateY(-100%)",
          transition:     "transform 0.25s cubic-bezier(0.16,1,0.3,1)",
        }}
        onMouseEnter={showNav}
        onMouseLeave={hideNav}
      >
        <div style={{
          display: "flex", alignItems: "center", justifyContent: "space-between",
          width: "100%",
          paddingLeft:   "1.4vmin",
          paddingRight:  "1.4vmin",
          paddingTop:    "1.11vmin",
          paddingBottom: "1.11vmin",
          gap:           "1.1vmin",
        }}>

          {/* Logo */}
          <Link href="/" style={{ display: "flex", alignItems: "center", gap: "1.11vmin", flexShrink: 0, textDecoration: "none" }}>
            <div style={{
              width: "3.1vmin", height: "3.1vmin",
              borderRadius: "0.89vmin",
              display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0,
              background: arena.accent,
            }}>
              <svg style={{ width: "1.56vmin", height: "1.56vmin" }} viewBox="0 0 16 16" fill="none">
                <path d="M8 2L14 6V10L8 14L2 10V6L8 2Z" fill="#08080F"/>
              </svg>
            </div>
            <span className="hidden sm:block" style={{ fontFamily: "var(--font-syne,'Syne',sans-serif)", fontWeight: 900, fontSize: "1.78vmin", letterSpacing: "-0.02em", color: "#1a1a2e" }}>
              AI<span style={{ color: arena.accent }}>Decoder</span>
            </span>
          </Link>

          <div style={{ flex: 1 }} />

          {/* Right — XP + level + avatar */}
          <div style={{ display: "flex", alignItems: "center", gap: "1.33vmin", flexShrink: 0 }}>
            {profile && (
              <div className="hidden sm:flex" style={{ alignItems: "center", gap: "1.11vmin" }}>
                {/* Level badge */}
                <div style={{
                  display: "flex", alignItems: "center",
                  gap: "0.67vmin",
                  paddingLeft: "1.11vmin", paddingRight: "1.11vmin",
                  paddingTop: "0.44vmin", paddingBottom: "0.44vmin",
                  borderRadius: "1.33vmin",
                  border: `1px solid ${arena.accent}40`,
                  background: arena.accentDim,
                }}>
                  <span style={{ fontSize: "1.56vmin" }}>{arena.emoji}</span>
                  <span style={{ fontFamily: "var(--font-syne,'Syne',sans-serif)", fontWeight: 900, fontSize: "1.33vmin", color: arena.accent }}>
                    Lv {level}
                  </span>
                </div>

                {/* XP bar */}
                <div style={{ width: "6.67vmin" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 2 }}>
                    <span style={{ fontSize: "1vmin", fontFamily: "monospace", color: "rgba(0,0,0,0.35)" }}>{xp} XP</span>
                    {!isMaxed && <span style={{ fontSize: "1vmin", fontFamily: "monospace", color: "rgba(0,0,0,0.25)" }}>{nextThreshold}</span>}
                  </div>
                  <div style={{ height: "0.44vmin", borderRadius: 999, overflow: "hidden", background: "rgba(0,0,0,0.10)" }}>
                    <div style={{ width: `${progress}%`, height: "100%", borderRadius: 999, transition: "all 1s", background: arena.accent, boxShadow: `0 0 6px ${arena.accentGlow}` }}/>
                  </div>
                </div>

                {/* Streak */}
                {(profile.streak_days ?? 0) > 0 && (
                  <div style={{
                    display: "flex", alignItems: "center",
                    gap: "0.44vmin",
                    paddingLeft: "0.89vmin", paddingRight: "0.89vmin",
                    paddingTop: "0.44vmin", paddingBottom: "0.44vmin",
                    borderRadius: "0.89vmin",
                    border: "1px solid rgba(249,115,22,0.2)",
                    background: "rgba(255,107,43,0.1)",
                  }}>
                    <span style={{ fontSize: "1.56vmin" }}>🔥</span>
                    <span style={{ fontFamily: "var(--font-syne,'Syne',sans-serif)", fontWeight: 900, fontSize: "1.33vmin", color: "#fb923c" }}>
                      {profile.streak_days}
                    </span>
                  </div>
                )}
              </div>
            )}
            <UserButton afterSignOutUrl="/auth/sign-in"/>
          </div>
        </div>
      </header>

      {/* ── Main content — nav overlaps on hideNav pages, content offset on others ── */}
      <main className="relative z-10 w-full overflow-y-auto"
        style={{
          paddingTop: isHideNav ? 0 : "5.33vmin",
          minHeight: "100dvh",
        }}>
        {children}
      </main>

      <AidaAssistant profile={profile} />
      <PersonalisationNudge profile={profile} />
    </div>
    </ChatChannelsProvider>
  );
}