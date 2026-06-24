"use client";
import { useState, useEffect, useRef, useCallback } from "react";
import Link from "next/link";
import { useUser, useClerk } from "@clerk/nextjs";
import { useRouter } from "next/navigation";
import { ArenaEnvironment } from "@/components/dashboard/ArenaEnvironment";
import { AidaAssistant } from "@/components/aida/AidaAssistant";
import { PersonalisationNudge } from "@/components/dashboard/PersonalisationNudge";
import { ChatChannelsProvider } from "@/lib/chatChannels";
import { getArena, ACTIVE_ARENA_CHANGED_EVENT } from "@/lib/arenas";
import { playArenaEnterSound } from "@/lib/gameAudio";
import type { Profile } from "@/types";

// ── Custom profile dropdown — top bar navigates to profile page,
//    Manage account opens Clerk modal unchanged, UI matches Clerk's original.
function ProfileMenu() {
  const { user } = useUser();
  const { openUserProfile, signOut } = useClerk();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function onClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) setOpen(false);
    }
    if (open) document.addEventListener("mousedown", onClickOutside);
    return () => document.removeEventListener("mousedown", onClickOutside);
  }, [open]);

  const handleManageAccount = () => {
    setOpen(false);
    // Delay so dropdown unmounts before Clerk mounts its modal
    setTimeout(() => openUserProfile(), 80);
  };

  if (!user) return null;

  const name   = user.fullName ?? user.firstName ?? "User";
  const email  = user.primaryEmailAddress?.emailAddress ?? "";
  const avatar = user.imageUrl;
  const isDev  = process.env.NODE_ENV === "development";

  return (
    <div className="relative" ref={containerRef}>
      {/* Avatar trigger */}
      <button
        onClick={() => setOpen(v => !v)}
        style={{ width: 32, height: 32, borderRadius: "50%", overflow: "hidden", border: "none", padding: 0, cursor: "pointer", background: "transparent", display: "block" }}
      >
        <img src={avatar} alt={name} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
      </button>

      {open && (
        <div
          style={{
            position: "absolute", right: 0, top: "calc(100% + 8px)",
            minWidth: 380, background: "#fff", borderRadius: 10,
            boxShadow: "0 4px 24px rgba(0,0,0,0.12), 0 1px 4px rgba(0,0,0,0.06)",
            border: "1px solid rgba(0,0,0,0.08)", zIndex: 9999, overflow: "hidden",
          }}
        >
          {/* ── Top bar: clicks navigate to profile page ── */}
          <button
            onClick={() => { router.push("/dashboard/profile"); setOpen(false); }}
            style={{ width: "100%", display: "flex", alignItems: "center", gap: 12, padding: "16px 20px", background: "transparent", border: "none", cursor: "pointer", textAlign: "left" }}
            onMouseEnter={e => (e.currentTarget.style.background = "rgba(0,0,0,0.03)")}
            onMouseLeave={e => (e.currentTarget.style.background = "transparent")}
          >
            <img src={avatar} alt={name} style={{ width: 40, height: 40, borderRadius: "50%", objectFit: "cover", flexShrink: 0 }} />
            <div style={{ minWidth: 0 }}>
              <p style={{ margin: 0, fontSize: 14, fontWeight: 600, color: "#212126", lineHeight: 1.3, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{name}</p>
              <p style={{ margin: 0, fontSize: 12, color: "#747686", lineHeight: 1.4, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{email}</p>
            </div>
          </button>

          <div style={{ height: 1, background: "rgba(0,0,0,0.06)" }} />

          {/* ── Manage account: opens Clerk's own modal natively ── */}
          <button
            onClick={handleManageAccount}
            style={{ width: "100%", display: "flex", alignItems: "center", gap: 12, padding: "12px 20px", background: "transparent", border: "none", cursor: "pointer", textAlign: "left" }}
            onMouseEnter={e => (e.currentTarget.style.background = "rgba(0,0,0,0.03)")}
            onMouseLeave={e => (e.currentTarget.style.background = "transparent")}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" style={{ flexShrink: 0 }}>
              <path d="M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6Z" stroke="#747686" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
              <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1Z" stroke="#747686" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
            <span style={{ fontSize: 14, color: "#212126" }}>Manage account</span>
          </button>

          <div style={{ height: 1, background: "rgba(0,0,0,0.06)" }} />

          {/* ── Sign out ── */}
          <button
            onClick={() => signOut({ redirectUrl: "/auth/sign-in" })}
            style={{ width: "100%", display: "flex", alignItems: "center", gap: 12, padding: "12px 20px", background: "transparent", border: "none", cursor: "pointer", textAlign: "left" }}
            onMouseEnter={e => (e.currentTarget.style.background = "rgba(0,0,0,0.03)")}
            onMouseLeave={e => (e.currentTarget.style.background = "transparent")}
          >
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none" style={{ flexShrink: 0 }}>
              <path d="M6 2H3a1 1 0 0 0-1 1v10a1 1 0 0 0 1 1h3" stroke="#747686" strokeWidth="1.2" strokeLinecap="round"/>
              <path d="M11 11l3-3-3-3" stroke="#747686" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round"/>
              <path d="M14 8H6" stroke="#747686" strokeWidth="1.2" strokeLinecap="round"/>
            </svg>
            <span style={{ fontSize: 14, color: "#212126" }}>Sign out</span>
          </button>

          {/* ── Footer ── */}
          <div style={{ borderTop: "1px solid rgba(249,115,22,0.15)", padding: "9px 20px", background: "rgba(249,115,22,0.06)", textAlign: "center" }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 5 }}>
              <span style={{ fontSize: 11, color: "#b0b0b8", fontWeight: 400 }}>Secured by</span>
              {/* Clerk hexagonal brand mark */}
              <svg width="15" height="15" viewBox="0 0 32 32" fill="none">
                <path d="M16 1L30 8.5V23.5L16 31L2 23.5V8.5L16 1Z" fill="#131316"/>
                <path d="M21.5 11.2C20.4 9.8 18.8 9 17 9C13.7 9 11 11.7 11 15C11 18.3 13.7 21 17 21C18.8 21 20.4 20.2 21.5 18.8L19.1 16.7C18.5 17.4 17.8 17.8 17 17.8C15.5 17.8 14.2 16.5 14.2 15C14.2 13.5 15.5 12.2 17 12.2C17.8 12.2 18.5 12.6 19.1 13.3L21.5 11.2Z" fill="white"/>
              </svg>
              <span style={{ fontSize: 12, fontWeight: 600, color: "#131316", letterSpacing: "-0.02em" }}>clerk</span>
            </div>
            {isDev && <p style={{ margin: "4px 0 0", fontSize: 11, color: "#f97316", fontWeight: 500 }}>Development mode</p>}
          </div>
        </div>
      )}
    </div>
  );
}


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

      {/* ── Hover trigger strip ── */}
      <div
        className="fixed top-0 left-0 right-0 z-50"
        style={{ height: 10 }}
        onMouseEnter={showNav}
      />

      {/* ── Top nav ── */}
      <header
        className="fixed top-0 left-0 right-0 z-40 border-b"
        style={{
          background:     "rgba(255,255,255,0.92)",
          borderColor:    "rgba(0,0,0,0.07)",
          backdropFilter: "blur(20px)",
          transform:      navVisible ? "translateY(0)" : "translateY(-100%)",
          transition:     "transform 0.3s cubic-bezier(0.16,1,0.3,1)",
        }}
        onMouseEnter={showNav}
        onMouseLeave={scheduleHide}
      >
        <div className="flex items-center justify-between px-5 py-2.5 w-full gap-4">

          {/* Logo */}
          <Link href="/" className="flex items-center gap-2.5 flex-shrink-0">
            <div className="w-7 h-7 rounded-lg flex items-center justify-center"
              style={{ background: arena.accent }}>
              <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
                <path d="M8 2L14 6V10L8 14L2 10V6L8 2Z" fill="#08080F"/>
              </svg>
            </div>
            <span className="font-display font-black text-base tracking-tight hidden sm:block" style={{ color: "#1a1a2e" }}>
              AI<span style={{ color: arena.accent }}>Decoder</span>
            </span>
          </Link>

          <div className="flex-1" />

          {/* Right — XP + level + avatar */}
          <div className="flex items-center gap-3 flex-shrink-0">
            {profile && (
              <div className="hidden sm:flex items-center gap-2.5">
                {/* Level badge */}
                <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-xl border"
                  style={{ background: arena.accentDim, borderColor: arena.accent + "40" }}>
                  <span className="text-sm">{arena.emoji}</span>
                  <span className="font-display font-black text-xs" style={{ color: arena.accent }}>
                    Lv {level}
                  </span>
                </div>

                {/* XP bar */}
                <div className="w-24 space-y-0.5">
                  <div className="flex justify-between">
                    <span className="text-[9px] font-mono" style={{ color: "rgba(0,0,0,0.35)" }}>{xp} XP</span>
                    {!isMaxed && <span className="text-[9px] font-mono" style={{ color: "rgba(0,0,0,0.25)" }}>{nextThreshold}</span>}
                  </div>
                  <div className="h-1 rounded-full overflow-hidden" style={{ background: "rgba(0,0,0,0.10)" }}>
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
                  <div className="flex items-center gap-1 px-2 py-1 rounded-lg border border-orange-500/20"
                    style={{ background: "rgba(255,107,43,0.1)" }}>
                    <span className="text-sm">🔥</span>
                    <span className="font-display font-black text-xs text-orange-400">
                      {profile.streak_days}
                    </span>
                  </div>
                )}
              </div>
            )}
            <ProfileMenu />
          </div>
        </div>
      </header>

      {/* ── Main content ── */}
      <main className="relative z-10 w-full overflow-hidden" style={{ height: "100dvh" }}>
        {children}
      </main>

      <AidaAssistant profile={profile} />
      <PersonalisationNudge profile={profile} />
    </div>
    </ChatChannelsProvider>
  );
}
