"use client";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useUser } from "@clerk/nextjs";

const NAVY  = "#0d1b52";
const GOLD  = "#C8A050";
const BLUE  = "#1d4ed8";
const LBLUE = "#2563eb";
const BORDER = "#e5e7eb";

const PRESETS = [
  "/Sign-in/i (1).png",
  "/Sign-in/i (2).png",
  "/Sign-in/i (3).png",
  "/Sign-in/i (4).png",
  "/Sign-in/i (5).png",
  "/Sign-in/i (6).png",
  "/Sign-in/i (7).png",
  "/Sign-in/i (8).png",
  "/Sign-in/i (9).png",
  "/Sign-in/i (10).png",
];

const MALE_COUNT = 5;

function BgFixed() {
  return (
    <div style={{
      position: "fixed", inset: 0, zIndex: 0,
      backgroundImage: "url('/Sign-in/page1.png')",
      backgroundSize: "100% 100%",
      backgroundPosition: "center",
      backgroundRepeat: "no-repeat",
    }}/>
  );
}

export default function ProfileSetupPage() {
  const router = useRouter();
  const { user } = useUser();
  const fileRef = useRef<HTMLInputElement>(null);
  const [gender, setGender] = useState<"male" | "female">("male");
  const [selected, setSelected] = useState(0);
  const [avatarSrc, setAvatarSrc] = useState(PRESETS[0]);
  const [uploadedFile, setUploadedFile] = useState<File | null>(null);
  const [saving, setSaving] = useState(false);

  const visiblePresets = gender === "male" ? PRESETS.slice(0, MALE_COUNT) : PRESETS.slice(MALE_COUNT);

  function handleGender(g: "male" | "female") {
    setGender(g);
    const startIdx = g === "male" ? 0 : MALE_COUNT;
    setSelected(startIdx);
    setAvatarSrc(PRESETS[startIdx]);
    setUploadedFile(null);
  }
  useEffect(() => {
    const html = document.documentElement;
    const body = document.body;
    const prevHtml = html.style.overflow;
    const prevBody = body.style.overflow;
    html.style.overflow = "hidden";
    body.style.overflow = "hidden";
    return () => {
      html.style.overflow = prevHtml;
      body.style.overflow = prevBody;
    };
  }, []);

  const handlePreset = (i: number) => {
    setSelected(i);
    setAvatarSrc(PRESETS[i]);
    setUploadedFile(null);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const src = URL.createObjectURL(file);
    setUploadedFile(file);
    setAvatarSrc(src);
    setSelected(-1);
  };

  const saveAndContinue = async () => {
    setSaving(true);
    try {
      let file: File;

      if (uploadedFile) {
        // User uploaded their own photo
        file = uploadedFile;
      } else {
        // Fetch the selected preset image and convert to File
        const res = await fetch(PRESETS[selected]);
        const blob = await res.blob();
        file = new File([blob], `preset-${selected + 1}.png`, { type: "image/png" });
      }

      // 1. Upload to Supabase Storage → get public URL
      const formData = new FormData();
      formData.append("file", file);
      const uploadRes = await fetch("/api/profile/photo", { method: "POST", body: formData });
      const { url } = await uploadRes.json();

      // 2. Save avatar_url to Supabase profile
      if (url) {
        await fetch("/api/profile", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ avatar_url: url }),
        });

        // 3. Also set as Clerk profile image so UserButton shows it
        if (user) {
          await user.setProfileImage({ file });
        }
      }
    } catch {
      // Non-blocking — still navigate even if save fails
    } finally {
      setSaving(false);
      router.replace("/dashboard");
    }
  };

  return (
    <div style={{ position: "fixed", inset: 0, overflow: "hidden" }}>
      <BgFixed />

      <style>{`
        .ps-card-scroll { -ms-overflow-style: none; scrollbar-width: none; }
        .ps-card-scroll::-webkit-scrollbar { display: none; }
      `}</style>

      <div style={{ position: "absolute", zIndex: 1, left: "41%", right: "25%", top: "10%", bottom: "14%" }}>
        <div
          className="ps-card-scroll"
          style={{
            width: "100%", height: "100%",
            background: "#ffffff",
            borderRadius: "2vw",
            border: "1px solid rgba(255,255,255,0.8)",
            boxShadow: "0 8px 48px rgba(0,0,0,0.18), inset 0 0 0 1px rgba(200,160,80,0.12)",
            overflow: "auto",
          }}>

          {/* Card header */}
          <div style={{ padding: "1.87vw 2.13vw 1.47vw", borderBottom: `1px solid ${BORDER}` }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "flex-end", marginBottom: "1.2vw" }}>
              <div style={{
                display: "flex", alignItems: "center", gap: "0.4vw",
                background: "#fff", borderRadius: "0.8vw",
                padding: "0.35vw 0.7vw",
                border: `1px solid rgba(200,160,80,0.4)`,
                boxShadow: "0 2px 8px rgba(200,160,80,0.15)",
              }}>
                <span style={{ fontSize: "1vw" }}>🪙</span>
                <div style={{ lineHeight: 1.1 }}>
                  <div style={{ fontSize: "0.73vw", fontWeight: 800, color: NAVY }}>100 XP</div>
                  <div style={{ fontSize: "0.5vw", color: "#64748b", fontWeight: 500 }}>Starter Explorer</div>
                </div>
              </div>
            </div>

            <h2 style={{
              fontFamily: "var(--font-syne), system-ui, sans-serif",
              fontWeight: 800, fontSize: "1.4vw", color: "#111827",
              marginBottom: "0.4vw", letterSpacing: "-0.02em", whiteSpace: "nowrap",
            }}>
              Set up your profile 🎨
            </h2>
            <p style={{ color: "#374151", fontSize: "0.93vw" }}>
              Choose an avatar or upload your own photo.
            </p>
          </div>

          {/* Card body */}
          <div style={{ padding: "1.5vw 2.13vw 1.2vw", display: "flex", flexDirection: "column", gap: "0.7vw" }}>

            {/* Avatar circle + colour palette */}
            <div style={{ display: "flex", justifyContent: "center", alignItems: "center", gap: "1.2vw" }}>
              <div style={{ position: "relative", width: "12vw", height: "12vw" }}>
                <div style={{
                  position: "absolute", inset: "-0.5vw", borderRadius: "50%",
                  boxShadow: `0 0 0 0.18vw rgba(99,102,241,0.35), 0 0 1.5vw rgba(59,130,246,0.35)`,
                }} />
                <span style={{
                  position: "absolute", top: "0.3vw", left: "0.6vw",
                  fontSize: "0.9vw", filter: "drop-shadow(0 0 4px #fbbf24)",
                }}>✦</span>
                <div style={{
                  width: "100%", height: "100%", borderRadius: "50%",
                  overflow: "hidden",
                  border: "0.2vw solid rgba(255,255,255,0.9)",
                  boxShadow: `0 0 0 0.15vw ${BLUE}, 0 4px 24px rgba(59,130,246,0.3)`,
                }}>
                  <img src={avatarSrc} alt="avatar" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                </div>
                <button
                  onClick={() => fileRef.current?.click()}
                  style={{
                    position: "absolute", top: "0.4vw", right: "0.4vw",
                    width: "1.8vw", height: "1.8vw", borderRadius: "50%",
                    background: "#fff", border: `1px solid ${BORDER}`,
                    display: "flex", alignItems: "center", justifyContent: "center",
                    cursor: "pointer", boxShadow: "0 2px 8px rgba(0,0,0,0.12)",
                  }}>
                  <svg style={{ width: "0.8vw", height: "0.8vw" }} viewBox="0 0 20 20" fill="none">
                    <path d="M13.586 3.586a2 2 0 112.828 2.828l-.793.793-2.828-2.828.793-.793zM11.379 5.793L3 14.172V17h2.828l8.38-8.379-2.83-2.828z" fill={BLUE}/>
                  </svg>
                </button>
                <button
                  onClick={() => fileRef.current?.click()}
                  style={{
                    position: "absolute", bottom: "-0.5vw", left: "50%",
                    transform: "translateX(-50%)",
                    width: "2vw", height: "2vw", borderRadius: "50%",
                    background: BLUE, border: "none",
                    display: "flex", alignItems: "center", justifyContent: "center",
                    cursor: "pointer", boxShadow: "0 2px 12px rgba(59,130,246,0.5)",
                  }}>
                  <svg style={{ width: "0.9vw", height: "0.9vw" }} viewBox="0 0 20 20" fill="white">
                    <path fillRule="evenodd" d="M10 3a1 1 0 011 1v5h5a1 1 0 110 2h-5v5a1 1 0 11-2 0v-5H4a1 1 0 110-2h5V4a1 1 0 011-1z" clipRule="evenodd"/>
                  </svg>
                </button>
                <input ref={fileRef} type="file" accept="image/*" style={{ display: "none" }} onChange={handleFileChange} />
              </div>

            </div>

            {/* Gender toggle */}
            <div style={{ display: "flex", gap: "0.5vw", justifyContent: "center", marginTop: "0.4vw" }}>
              {(["male", "female"] as const).map((g) => (
                <button
                  key={g}
                  onClick={() => handleGender(g)}
                  style={{
                    padding: "0.3vw 1.1vw",
                    borderRadius: "2vw",
                    border: `0.12vw solid ${gender === g ? BLUE : BORDER}`,
                    background: gender === g ? BLUE : "rgba(255,255,255,0.7)",
                    color: gender === g ? "#fff" : "#374151",
                    fontSize: "0.82vw",
                    fontWeight: 600,
                    cursor: "pointer",
                    transition: "all 0.18s",
                  }}
                >
                  {g === "male" ? "Male" : "Female"}
                </button>
              ))}
            </div>

            {/* Preset thumbnails */}
            <div style={{ display: "flex", gap: "0.6vw", justifyContent: "center", marginTop: "0.5vw" }}>
              {visiblePresets.map((src, i) => {
                const absIdx = gender === "male" ? i : i + MALE_COUNT;
                return (
                  <button
                    key={absIdx}
                    onClick={() => handlePreset(absIdx)}
                    style={{
                      width: "3.4vw", height: "3.4vw", borderRadius: "0.6vw",
                      overflow: "hidden", padding: 0, border: "none",
                      cursor: "pointer",
                      outline: selected === absIdx ? `0.18vw solid ${BLUE}` : "0.18vw solid transparent",
                      outlineOffset: "0.1vw",
                      boxShadow: selected === absIdx ? `0 0 0 0.1vw rgba(59,130,246,0.4)` : "none",
                    }}>
                    <img src={src} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                  </button>
                );
              })}
            </div>

            {/* Tip */}
            <p style={{ textAlign: "center", fontSize: "0.67vw", color: "#64748b", margin: 0 }}>
              <span style={{ color: "#f59e0b", marginRight: "0.3vw" }}>✦</span>
              <strong>Tip:</strong> A clear photo helps people recognize you!
            </p>

            {/* Next + Skip row */}
            <div style={{ display: "flex", gap: "0.6vw" }}>
              <button
                onClick={saveAndContinue}
                disabled={saving}
                style={{
                  flex: 3, padding: "0.5vw",
                  background: BLUE, color: "#fff",
                  borderRadius: 999, fontSize: "1vw", fontWeight: 700,
                  border: `1.5px solid ${GOLD}`, cursor: saving ? "wait" : "pointer",
                  boxShadow: "0 4px 20px rgba(29,78,216,0.4), 0 0 12px rgba(200,160,80,0.35)",
                  opacity: saving ? 0.7 : 1,
                }}>
                {saving ? "Saving…" : "Next →"}
              </button>
              <button
                onClick={() => router.replace("/dashboard")}
                disabled={saving}
                style={{
                  flex: 2, padding: "0.5vw",
                  background: "transparent", color: LBLUE,
                  borderRadius: 999, fontSize: "0.8vw", fontWeight: 600,
                  border: `1px solid ${BORDER}`, cursor: "pointer",
                }}>
                Skip for now
              </button>
            </div>

          </div>
        </div>
      </div>
    </div>
  );
}
