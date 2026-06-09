"use client";
import { useState, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

const NAVY   = "#0d1b52";
const GOLD   = "#C8A050";
const BLUE   = "#1d4ed8";
const BORDER = "#e5e7eb";

const PRESETS = [
  "/worlds/arena-1.png",
  "/worlds/arena-2.png",
  "/worlds/arena-3.png",
  "/Sign-in/page1.png",
  "/Sign-in/page2.png",
];

function BgFixed() {
  return (
    <div style={{
      position: "fixed", inset: 0, zIndex: 0,
      backgroundImage: "url('/Sign-in/page4.png')",
      backgroundSize: "100% 100%",
      backgroundPosition: "center",
      backgroundRepeat: "no-repeat",
    }}/>
  );
}

export default function ProfileSetupPage() {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [selectedPreset, setSelectedPreset] = useState(0);
  const [avatarSrc, setAvatarSrc]           = useState(PRESETS[0]);

  // Hide document scrollbar
  useEffect(() => {
    const html = document.documentElement;
    const body = document.body;
    const ph = html.style.overflow;
    const pb = body.style.overflow;
    html.style.overflow = "hidden";
    body.style.overflow = "hidden";
    return () => { html.style.overflow = ph; body.style.overflow = pb; };
  }, []);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const url = URL.createObjectURL(file);
    setAvatarSrc(url);
    setSelectedPreset(-1);
  };

  const handlePresetSelect = (i: number) => {
    setSelectedPreset(i);
    setAvatarSrc(PRESETS[i]);
  };

  return (
    <div style={{ position: "fixed", inset: 0, overflow: "hidden" }}>
      <BgFixed/>

      <style>{`
        .ps-card-scroll { -ms-overflow-style: none; }
        .ps-card-scroll::-webkit-scrollbar { display: none; }
      `}</style>

      {/* Nav */}
      <div style={{ position: "absolute", top: "7%", right: "6.5%", display: "flex", alignItems: "center", gap: "1.8vw", zIndex: 20 }}>
        <Link href="/auth/sign-in" style={{ fontSize: "1.25vw", fontWeight: 600, color: BLUE, textDecoration: "none" }}>Log in</Link>
        <Link href="/auth/sign-up" style={{
          fontSize: "1.15vw", fontWeight: 700, color: "#fff", background: BLUE,
          padding: "1vh 1.7vw", borderRadius: 999, textDecoration: "none",
          border: `1.5px solid ${GOLD}`,
          boxShadow: "0 4px 14px rgba(29,78,216,0.45), 0 0 12px rgba(200,160,80,0.35)",
        }}>
          Sign up
        </Link>
      </div>

      {/* Card */}
      <div style={{ position: "absolute", zIndex: 1, left: "28%", right: "28%", top: "10%", bottom: "8%" }}>
        <div style={{
          width: "100%", height: "100%",
          background: "#ffffff",
          borderRadius: "2vw",
          border: "1px solid rgba(255,255,255,0.8)",
          boxShadow: "0 8px 48px rgba(0,0,0,0.18), inset 0 0 0 1px rgba(200,160,80,0.12)",
          overflow: "auto", scrollbarWidth: "none",
          display: "flex", flexDirection: "column",
        }} className="ps-card-scroll">

          {/* Card header */}
          <div style={{ padding: "1.47vw 2vw 1.2vw", borderBottom: `1px solid ${BORDER}`, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            {/* Step badge */}
            <span style={{ fontSize: "0.73vw", fontWeight: 700, letterSpacing: "0.12em", textTransform: "uppercase", background: "#eff6ff", color: BLUE, border: "1px solid #bfdbfe", padding: "0.27vw 0.8vw", borderRadius: 999 }}>
              Step 1 of 2
            </span>

            {/* Progress bar */}
            <div style={{ display: "flex", gap: "0.4vw", alignItems: "center" }}>
              <div style={{ width: "2.4vw", height: "0.4vw", borderRadius: 999, background: BLUE }}/>
              <div style={{ width: "2.4vw", height: "0.4vw", borderRadius: 999, background: BORDER }}/>
            </div>

            {/* XP badge */}
            <div style={{ display: "flex", alignItems: "center", gap: "0.4vw", background: "#fffbeb", border: "1px solid #fde68a", borderRadius: 999, padding: "0.27vw 0.8vw" }}>
              <span style={{ fontSize: "0.93vw" }}>🪙</span>
              <div>
                <span style={{ fontSize: "0.8vw", fontWeight: 800, color: "#92400e" }}>100 XP</span>
                <span style={{ fontSize: "0.6vw", color: "#a16207", marginLeft: "0.3vw" }}>Starter Explorer</span>
              </div>
            </div>
          </div>

          {/* Card body */}
          <div style={{ flex: 1, padding: "1.6vw 2vw 1.87vw", display: "flex", flexDirection: "column", alignItems: "center", gap: "1.2vw" }}>

            {/* Avatar circle with glow ring */}
            <div style={{ position: "relative", display: "inline-flex", alignItems: "center", justifyContent: "center" }}>
              {/* Glow ring */}
              <div style={{
                position: "absolute", inset: "-0.4vw",
                borderRadius: "50%",
                background: "linear-gradient(135deg, #3b82f6, #06b6d4, #6366f1)",
                zIndex: 0,
                boxShadow: "0 0 2vw 0.5vw rgba(59,130,246,0.45), 0 0 4vw 1vw rgba(6,182,212,0.25)",
              }}/>
              {/* White gap ring */}
              <div style={{ position: "absolute", inset: "-0.15vw", borderRadius: "50%", background: "#fff", zIndex: 1 }}/>
              {/* Avatar image */}
              <div style={{
                width: "13vw", height: "13vw", borderRadius: "50%",
                overflow: "hidden", position: "relative", zIndex: 2,
                background: "#e5e7eb",
              }}>
                <img src={avatarSrc} alt="avatar" style={{ width: "100%", height: "100%", objectFit: "cover" }}/>
              </div>

              {/* Edit button — top right of circle */}
              <button
                onClick={() => fileInputRef.current?.click()}
                style={{
                  position: "absolute", top: "0.3vw", right: "0.3vw", zIndex: 3,
                  width: "2vw", height: "2vw", borderRadius: "50%",
                  background: "#fff", border: `1.5px solid ${BORDER}`,
                  boxShadow: "0 2px 8px rgba(0,0,0,0.15)",
                  cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center",
                }}>
                <svg width="0.8vw" height="0.8vw" viewBox="0 0 14 14" fill="none">
                  <path d="M9.5 2.5l2 2L4 12H2v-2l7.5-7.5z" stroke="#374151" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              </button>

              {/* Upload button — bottom center of circle */}
              <button
                onClick={() => fileInputRef.current?.click()}
                style={{
                  position: "absolute", bottom: "-0.5vw", left: "50%", transform: "translateX(-50%)", zIndex: 3,
                  width: "2.4vw", height: "2.4vw", borderRadius: "50%",
                  background: BLUE, border: "none",
                  boxShadow: "0 4px 14px rgba(29,78,216,0.45)",
                  cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center",
                }}>
                <svg width="1vw" height="1vw" viewBox="0 0 14 14" fill="none">
                  <path d="M7 10V3M3.5 6.5L7 3l3.5 3.5" stroke="#fff" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/>
                  <path d="M2 11h10" stroke="#fff" strokeWidth="1.6" strokeLinecap="round"/>
                </svg>
              </button>
            </div>

            {/* Hidden file input */}
            <input ref={fileInputRef} type="file" accept="image/*" style={{ display: "none" }} onChange={handleFileChange}/>

            {/* Preset thumbnails */}
            <div style={{ display: "flex", gap: "0.67vw", justifyContent: "center" }}>
              {PRESETS.map((src, i) => (
                <button key={i} onClick={() => handlePresetSelect(i)}
                  style={{
                    width: "4.5vw", height: "4.5vw", borderRadius: "0.67vw", overflow: "hidden", padding: 0,
                    border: selectedPreset === i ? `2.5px solid ${BLUE}` : `2px solid ${BORDER}`,
                    cursor: "pointer",
                    boxShadow: selectedPreset === i ? "0 0 0 2px rgba(29,78,216,0.25)" : "none",
                    transition: "border-color 0.15s, box-shadow 0.15s",
                  }}>
                  <img src={src} alt={`preset ${i + 1}`} style={{ width: "100%", height: "100%", objectFit: "cover" }}/>
                </button>
              ))}
            </div>

            {/* Tip */}
            <p style={{ fontSize: "0.8vw", color: "#6b7280", textAlign: "center" }}>
              <span style={{ color: GOLD }}>✦</span> Tip: A clear photo helps people recognise you!
            </p>

            {/* Buttons */}
            <div style={{ width: "100%", display: "flex", flexDirection: "column", gap: "0.67vw", marginTop: "auto" }}>
              <button
                onClick={() => router.replace("/dashboard/profile")}
                style={{ width: "100%", padding: "1vw", background: BLUE, color: "#fff", borderRadius: 999, fontSize: "1vw", fontWeight: 700, border: `1.5px solid ${GOLD}`, cursor: "pointer", boxShadow: "0 4px 20px rgba(29,78,216,0.4), 0 0 12px rgba(200,160,80,0.35)" }}>
                Next →
              </button>
              <button
                onClick={() => router.replace("/dashboard/profile")}
                style={{ width: "100%", padding: "1vw", background: "#fff", color: NAVY, borderRadius: 999, fontSize: "1vw", fontWeight: 700, border: `1.5px solid ${BORDER}`, cursor: "pointer" }}>
                Skip for now
              </button>
            </div>

          </div>
        </div>
      </div>
    </div>
  );
}
