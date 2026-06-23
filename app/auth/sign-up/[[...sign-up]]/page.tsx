"use client";
import { useState, useEffect, useRef } from "react";
import { useSignUp, useAuth } from "@clerk/nextjs";
import { useRouter } from "next/navigation";
import Link from "next/link";

const NAVY   = "#0d1b52";
const GOLD   = "#C8A050";
const BLUE   = "#1d4ed8";
const LBLUE  = "#2563eb";
const BORDER = "#e5e7eb";
const IBKG   = "#f9fafb";

const BOARDS = ["CBSE", "ICSE", "State Board"];
const GRADES = ["6", "7", "8", "9", "10"];
function gradeToAgeGroup(g: string) { return parseInt(g) <= 7 ? "11-13" : "14+"; }

// ── Background — stretches to fill the viewport exactly, no crop, no gaps ─────
function BgFixed({ image = "/Sign-in/page1.png" }: { image?: string }) {
  return (
    <div style={{
      position: "fixed", inset: 0, zIndex: 0, width: "100vw", height: "100vh",
      backgroundImage: `url('${image}')`,
      backgroundSize: "100% 100%",
      backgroundPosition: "center",
      backgroundRepeat: "no-repeat",
    }}/>
  );
}

// ── Shared input ──────────────────────────────────────────────────────────────
function Inp({
  label, icon, rightIcon, onRightClick, ...props
}: {
  label: string;
  icon: React.ReactNode;
  rightIcon?: React.ReactNode;
  onRightClick?: () => void;
} & React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <div>
      <p style={{ fontSize: "0.67vw", fontWeight: 700, letterSpacing: "0.1em", color: "#374151", marginBottom: "0.4vw", textTransform: "uppercase" }}>
        {label}
      </p>
      <div style={{ position: "relative" }}>
        <span style={{ position: "absolute", left: "0.8vw", top: "50%", transform: "translateY(-50%)", color: "#6b7280", display: "flex" }}>
          {icon}
        </span>
        <input
          {...props}
          style={{
            width: "100%", boxSizing: "border-box",
            paddingLeft: "2.4vw", paddingRight: rightIcon ? "2.4vw" : "0.8vw",
            paddingTop: "0.73vw", paddingBottom: "0.73vw",
            background: IBKG, border: `1px solid ${BORDER}`,
            borderRadius: "0.67vw", fontSize: "0.93vw", color: "#111827",
            outline: "none", transition: "border-color 0.15s",
          }}
          onFocus={e => (e.currentTarget.style.borderColor = BLUE)}
          onBlur={e  => (e.currentTarget.style.borderColor = BORDER)}
        />
        {rightIcon && (
          <button type="button" onClick={onRightClick}
            style={{ position: "absolute", right: "0.8vw", top: "50%", transform: "translateY(-50%)", background: "none", border: "none", cursor: "pointer", color: "#6b7280", display: "flex" }}>
            {rightIcon}
          </button>
        )}
      </div>
    </div>
  );
}

// ── Icons ─────────────────────────────────────────────────────────────────────
const ICON_SIZE = "0.93vw";
const PersonIcon = () => <svg width={ICON_SIZE} height={ICON_SIZE} viewBox="0 0 16 16" fill="none"><circle cx="8" cy="5" r="3" stroke="currentColor" strokeWidth="1.5"/><path d="M2 14c0-3.31 2.69-6 6-6s6 2.69 6 6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/></svg>;
const MailIcon   = () => <svg width={ICON_SIZE} height={ICON_SIZE} viewBox="0 0 16 16" fill="none"><rect x="1" y="3" width="14" height="10" rx="2" stroke="currentColor" strokeWidth="1.5"/><path d="M1 6l7 4 7-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/></svg>;
const LockIcon   = () => <svg width={ICON_SIZE} height={ICON_SIZE} viewBox="0 0 14 14" fill="none"><rect x="2" y="6" width="10" height="7" rx="1.5" stroke="currentColor" strokeWidth="1.5"/><path d="M4.5 6V4.5a2.5 2.5 0 015 0V6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/></svg>;
const EyeIcon    = () => <svg width={ICON_SIZE} height={ICON_SIZE} viewBox="0 0 14 14" fill="none"><path d="M1 7s2-4 6-4 6 4 6 4-2 4-6 4-6-4-6-4z" stroke="currentColor" strokeWidth="1.5"/><circle cx="7" cy="7" r="1.5" stroke="currentColor" strokeWidth="1.5"/></svg>;
const EyeOffIcon = () => <svg width={ICON_SIZE} height={ICON_SIZE} viewBox="0 0 14 14" fill="none"><path d="M1 1l12 12M5.5 5.7A2 2 0 019.3 9M2 3.5C.8 4.7 1 7 1 7s2 4 6 4c1.2 0 2.2-.3 3-.8M5 2.2C5.6 2.1 6.3 2 7 2c4 0 6 5 6 5s-.5 1.3-1.5 2.5" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/></svg>;

// ── Main page ─────────────────────────────────────────────────────────────────
export default function SignUpPage() {
  const { signUp, isLoaded, setActive } = useSignUp();
  const { isSignedIn } = useAuth();
  const router = useRouter();

  const [step,      setStep]      = useState(1);
  const [loading,   setLoading]   = useState(false);
  const [error,     setError]     = useState("");
  const [showPw,    setShowPw]    = useState(false);
  const [agreed,    setAgreed]    = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [code,      setCode]      = useState("");
  const [fullName,  setFullName]  = useState("");
  const [email,     setEmail]     = useState("");
  const [password,  setPassword]  = useState("");
  const [board,     setBoard]     = useState("CBSE");
  const [grade,     setGrade]     = useState("8");
  const digitRefs = useRef<(HTMLInputElement | null)[]>([]);

  useEffect(() => {
    if (isSignedIn && !verifying) router.replace("/dashboard");
  }, [isSignedIn, router, verifying]);

  // Hide the document-level scrollbar (and its purple hover thumb from globals.css)
  // while this full-viewport page is mounted — it never needs to scroll.
  useEffect(() => {
    const html = document.documentElement;
    const body = document.body;
    const prevHtmlOverflow = html.style.overflow;
    const prevBodyOverflow = body.style.overflow;
    html.style.overflow = "hidden";
    body.style.overflow = "hidden";
    return () => {
      html.style.overflow = prevHtmlOverflow;
      body.style.overflow = prevBodyOverflow;
    };
  }, []);

  const pwStrength =
    password.length === 0 ? 0 : password.length < 6 ? 1 : password.length < 10 ? 2
    : /[A-Z]/.test(password) && /[0-9]/.test(password) ? 4 : 3;
  const pwColors = ["", "#ef4444", "#f59e0b", "#06b6d4", "#22c55e"];

  const handleNext = (e: React.FormEvent) => {
    e.preventDefault();
    if (!fullName.trim() || !email.trim() || password.length < 8) {
      setError("Please fill all fields. Password must be at least 8 characters."); return;
    }
    setError(""); setStep(2);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isLoaded || !agreed) return;
    setLoading(true); setError("");
    try {
      await signUp.create({ firstName: fullName.split(" ")[0], lastName: fullName.split(" ").slice(1).join(" ") || "", emailAddress: email, password });
      await signUp.prepareEmailAddressVerification({ strategy: "email_code" });
      setVerifying(true);
    } catch (err: unknown) {
      setError((err as { errors?: { message: string }[] })?.errors?.[0]?.message ?? "Something went wrong.");
    } finally { setLoading(false); }
  };

  const handleVerify = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isLoaded) return;
    setLoading(true); setError("");
    try {
      const result = await signUp.attemptEmailAddressVerification({ code });
      if (result.status === "complete") {
        await fetch("/api/profile", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ display_name: fullName.split(" ")[0], avatar_emoji: "🚀", age_group: gradeToAgeGroup(grade), interests: [] }) }).catch(() => {});
        await setActive({ session: result.createdSessionId, beforeEmit: () => router.replace("/auth/profile-setup") });
      }
    } catch (err: unknown) {
      setError((err as { errors?: { message: string }[] })?.errors?.[0]?.message ?? "Invalid code.");
    } finally { setLoading(false); }
  };

  const handleGoogle = async () => {
    if (!isLoaded) return;
    if (isSignedIn) { router.replace("/dashboard"); return; }
    try {
      await signUp.authenticateWithRedirect({ strategy: "oauth_google", redirectUrl: "/auth/sso-callback", redirectUrlComplete: "/dashboard" });
    } catch (err: unknown) {
      setError((err as { errors?: { message: string }[] })?.errors?.[0]?.message ?? "Google sign-up failed.");
    }
  };

  // ── Loading ────────────────────────────────────────────────────────────────
  if (!isLoaded || (isSignedIn && !verifying)) {
    return (
      <div className="fixed inset-0 flex items-center justify-center">
        <BgFixed/>
        <div className="flex gap-2" style={{ position: "relative", zIndex: 1 }}>
          {[0, 1, 2].map(i => <div key={i} className="w-3 h-3 rounded-full" style={{ background: BLUE }}/>)}
        </div>
      </div>
    );
  }

  // ── Verification ───────────────────────────────────────────────────────────
  if (verifying) {
    return (
      <div style={{ position: "fixed", inset: 0, overflow: "hidden" }}>
        <BgFixed image="/Sign-in/page1.png"/>

        {/* Card — same %-of-viewport coordinate system as the main form card, so it scales
            1:1 with the stretched (100% 100%) background at any screen size. */}
        <div style={{ position: "absolute", zIndex: 1, left: "41%", right: "25%", top: "16%", bottom: "10%" }}>
          <div style={{
            width: "100%", height: "100%", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
            background: "#ffffff", borderRadius: "1.87vw", border: "1px solid rgba(255,255,255,0.8)",
            boxShadow: "0 8px 48px rgba(0,0,0,0.18), inset 0 0 0 1px rgba(200,160,80,0.12)",
            padding: "2.93vw 2.67vw", textAlign: "center", boxSizing: "border-box",
          }}>
            <img src="/Sign-in/email.png" alt="" style={{ width: "5.6vw", height: "5.6vw", objectFit: "contain", margin: "0 auto 1.2vw" }}/>
            <h2 style={{ fontFamily: "Georgia, 'Times New Roman', serif", fontWeight: 800, fontSize: "1.87vw", color: NAVY, marginBottom: "0.67vw" }}>Check your inbox!</h2>
            <p style={{ color: "#6b7280", fontSize: "0.93vw", marginBottom: "1.87vw" }}>
              We sent a 6-digit code to<br/>
              <strong style={{ color: LBLUE, fontWeight: 800, letterSpacing: "0.02em" }}>{email.toUpperCase()}</strong>
            </p>
            <div id="clerk-captcha"/>
            <form onSubmit={handleVerify} style={{ display: "flex", flexDirection: "column", gap: "1.47vw", width: "100%" }}>
              <div style={{ display: "flex", gap: "0.67vw", justifyContent: "center" }}>
                {[0, 1, 2, 3, 4, 5].map(i => (
                  <input
                    key={i}
                    ref={el => { digitRefs.current[i] = el; }}
                    value={code[i] ?? ""}
                    onChange={e => {
                      const digit = e.target.value.replace(/\D/g, "").slice(-1);
                      const next = code.split("");
                      next[i] = digit;
                      const joined = next.join("").slice(0, 6);
                      setCode(joined);
                      if (digit && i < 5) digitRefs.current[i + 1]?.focus();
                    }}
                    onKeyDown={e => {
                      if (e.key === "Backspace" && !code[i] && i > 0) digitRefs.current[i - 1]?.focus();
                    }}
                    maxLength={1} inputMode="numeric" autoFocus={i === 0} placeholder="0"
                    style={{ width: "2.93vw", height: "3.47vw", boxSizing: "border-box", textAlign: "center", fontSize: "1.33vw", fontWeight: 800, borderRadius: "0.8vw", background: IBKG, border: `1.5px solid ${BORDER}`, outline: "none", color: NAVY, caretColor: BLUE }}
                    onFocus={e => (e.currentTarget.style.borderColor = BLUE)}
                    onBlur={e  => (e.currentTarget.style.borderColor = BORDER)}
                  />
                ))}
              </div>
              {error && <p style={{ background: "#fef2f2", border: "1px solid #fecaca", color: "#dc2626", borderRadius: "0.67vw", padding: "0.67vw 0.93vw", fontSize: "0.87vw" }}>{error}</p>}
              <button type="submit" disabled={loading || code.length < 6}
                style={{ width: "100%", fontSize: "1.15vw", fontWeight: 700, color: "#fff", background: BLUE, padding: "1vh 1.7vw", borderRadius: 999, border: `1.5px solid ${GOLD}`, cursor: "pointer", opacity: (loading || code.length < 6) ? 0.4 : 1, boxShadow: "0 4px 14px rgba(29,78,216,0.45), 0 0 12px rgba(200,160,80,0.35)" }}>
                {loading ? "Verifying…" : "Verify & Launch 🚀"}
              </button>
            </form>
          </div>
        </div>
      </div>
    );
  }

  // ── Main layout ────────────────────────────────────────────────────────────
  return (
    <div style={{ position: "fixed", inset: 0, overflow: "hidden" }}>
      <BgFixed image="/Sign-in/page1.png"/>

      {/* Hide scrollbars on the form card while keeping it scrollable if content overflows */}
      <style>{`
        .signup-card-scroll::-webkit-scrollbar { display: none; }
        .nav-active {
          font-size: 1.15vw; font-weight: 700; color: #fff; background: #1d4ed8;
          padding: 1vh 1.7vw; border-radius: 999px; text-decoration: none;
          border: 1.5px solid #C8A050;
          box-shadow: 0 4px 14px rgba(29,78,216,0.45), 0 0 12px rgba(200,160,80,0.35);
          transition: background 0.18s, box-shadow 0.18s, transform 0.18s;
          display: inline-block;
        }
        .nav-active:hover {
          background: #2563eb;
          box-shadow: 0 6px 22px rgba(29,78,216,0.6), 0 0 20px rgba(200,160,80,0.5);
          transform: translateY(-2px);
        }
        .nav-inactive {
          font-size: 1.15vw; font-weight: 700; color: #1d4ed8; text-decoration: none;
          padding: 1vh 1.7vw; border-radius: 999px;
          background: rgba(255,255,255,0.75);
          backdrop-filter: blur(8px);
          border: 1.5px solid #C8A050;
          text-shadow: 0 -2px 6px rgba(255,255,255,1), 0 -1px 3px rgba(255,255,255,0.9), 0 0 3px rgba(255,255,255,0.6);
          transition: background 0.18s, color 0.18s, transform 0.18s;
          display: inline-block;
        }
        .nav-inactive:hover { background: rgba(255,255,255,0.92); color: #1e3a8a; transform: translateY(-1px); text-decoration: underline; }
        .nav-inactive:active { text-decoration: underline; }
      `}</style>

      {/* Top-right nav */}
      <div style={{ position: "absolute", top: "7%", right: "6.5%", display: "flex", alignItems: "center", gap: "1.8vw", zIndex: 20 }}>
        <Link href="/auth/sign-in" className="nav-inactive">
          Log in
        </Link>
        <Link href="/auth/sign-up" className="nav-active">
          Sign up
        </Link>
      </div>

      {/* Form card — positioned to sit exactly over the card painted into the background image.
          Percentage offsets scale 1:1 with the stretched (100% 100%) background, so the live
          card and the image move/resize together as a single unit at any screen size. */}
      <div style={{
        position: "absolute",
        zIndex: 1,
        left: "41%", right: "25%", top: "16%", bottom: "10%",
      }}>
          <div style={{
            width: "100%",
            height: "100%",
            background: "#ffffff",
            borderRadius: "2vw",
            border: "1px solid rgba(255,255,255,0.8)",
            boxShadow: "0 8px 48px rgba(0,0,0,0.18), inset 0 0 0 1px rgba(200,160,80,0.12)",
            overflow: "auto",
            scrollbarWidth: "none",
          }} className="signup-card-scroll">

            {/* Card header */}
            <div style={{ padding: "1.87vw 2.13vw 1.47vw", borderBottom: `1px solid ${BORDER}` }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "1.2vw" }}>
                <span style={{ fontSize: "0.73vw", fontWeight: 700, letterSpacing: "0.12em", textTransform: "uppercase", background: "#eff6ff", color: LBLUE, border: "1px solid #bfdbfe", padding: "0.27vw 0.8vw", borderRadius: 999 }}>
                  Step {step} of 2
                </span>
                <div style={{ display: "flex", gap: "0.4vw", alignItems: "center" }}>
                  <div style={{ width: "2.4vw", height: "0.27vw", borderRadius: 999, background: step >= 1 ? BLUE : BORDER }}/>
                  <div style={{ width: "1.33vw", height: "0.27vw", borderRadius: 999, background: step >= 2 ? BLUE : BORDER }}/>
                </div>
              </div>
              <h2 style={{ fontFamily: "var(--font-syne), system-ui, sans-serif", fontWeight: 800, fontSize: "1.4vw", color: "#111827", marginBottom: "0.4vw", letterSpacing: "-0.02em", whiteSpace: "nowrap" }}>
                {step === 1 ? "Create your account" : "Academic profile"}
              </h2>
              <p style={{ color: "#374151", fontSize: "0.93vw" }}>
                {step === 1 ? "Join students decoding the future of AI." : "Help us personalise your learning experience."}
              </p>
            </div>

            {/* Card body */}
            <div style={{ padding: "1.6vw 2.13vw 1.87vw" }}>
              <div id="clerk-captcha" style={{ display: "none" }}/>

              {step === 1 ? (
                <form onSubmit={handleNext} style={{ display: "flex", flexDirection: "column", gap: "1.07vw" }}>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.8vw" }}>
                    <Inp label="Full name" icon={<PersonIcon/>} value={fullName} onChange={e => setFullName(e.target.value)} placeholder="Rahul Sharma"/>
                    <Inp label="Email" icon={<MailIcon/>} type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="you@school.com"/>
                  </div>

                  <div>
                    <Inp label="Password" icon={<LockIcon/>}
                      type={showPw ? "text" : "password"} value={password} onChange={e => setPassword(e.target.value)} placeholder="Min. 8 characters"
                      rightIcon={showPw ? <EyeOffIcon/> : <EyeIcon/>} onRightClick={() => setShowPw(v => !v)}
                    />
                    {password.length > 0 && (
                      <div style={{ display: "flex", gap: "0.4vw", marginTop: "0.53vw", alignItems: "center" }}>
                        {[1, 2, 3, 4].map(i => (
                          <div key={i} style={{ flex: 1, height: "0.2vw", borderRadius: 999, background: i <= pwStrength ? pwColors[pwStrength] : BORDER, transition: "background 0.2s" }}/>
                        ))}
                        <span style={{ fontSize: "0.67vw", color: pwColors[pwStrength], minWidth: "2.4vw", textAlign: "right", fontWeight: 600 }}>
                          {["", "Weak", "Fair", "Good", "Strong"][pwStrength]}
                        </span>
                      </div>
                    )}
                  </div>

                  {error && <p style={{ background: "#fef2f2", border: "1px solid #fecaca", color: "#dc2626", borderRadius: "0.67vw", padding: "0.67vw 0.93vw", fontSize: "0.87vw" }}>{error}</p>}

                  <button type="submit" style={{ width: "100%", padding: "1vw", background: BLUE, color: "#fff", borderRadius: 999, fontSize: "1vw", fontWeight: 700, border: `1.5px solid ${GOLD}`, cursor: "pointer", boxShadow: "0 4px 20px rgba(29,78,216,0.4), 0 0 12px rgba(200,160,80,0.35)" }}>
                    Next – Academic profile →
                  </button>

                  <div style={{ display: "flex", alignItems: "center", gap: "0.67vw" }}>
                    <div style={{ flex: 1, height: 1, background: `linear-gradient(90deg, transparent, ${BORDER})` }}/>
                    <div style={{ width: "0.4vw", height: "0.4vw", transform: "rotate(45deg)", border: `1px solid ${GOLD}`, background: "rgba(200,160,80,0.12)" }}/>
                    <span style={{ fontSize: "0.8vw", color: "#6b7280", fontWeight: 500, letterSpacing: "0.08em" }}>OR</span>
                    <div style={{ width: "0.4vw", height: "0.4vw", transform: "rotate(45deg)", border: `1px solid ${GOLD}`, background: "rgba(200,160,80,0.12)" }}/>
                    <div style={{ flex: 1, height: 1, background: `linear-gradient(90deg, ${BORDER}, transparent)` }}/>
                  </div>

                  <button type="button" onClick={handleGoogle} style={{ width: "100%", padding: "0.8vw", background: "#fff", border: `1px solid ${BORDER}`, borderRadius: 999, fontSize: "0.93vw", fontWeight: 600, color: "#374151", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: "0.67vw" }}
                    onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = "#f9fafb"}
                    onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = "#fff"}>
                    <svg width="1.2vw" height="1.2vw" viewBox="0 0 18 18">
                      <path d="M16.51 8H8.98v3h4.3c-.18 1-.74 1.48-1.6 2.04v2.01h2.6a7.8 7.8 0 002.38-5.88c0-.57-.05-.66-.15-1.18z" fill="#4285F4"/>
                      <path d="M8.98 17c2.16 0 3.97-.72 5.3-1.94l-2.6-2.01c-.72.48-1.63.76-2.7.76-2.08 0-3.84-1.4-4.47-3.29H1.87v2.07A8 8 0 008.98 17z" fill="#34A853"/>
                      <path d="M4.51 10.52A4.8 4.8 0 014.26 9c0-.52.09-1.02.25-1.52V5.41H1.87A8 8 0 001 9c0 1.29.31 2.51.87 3.59l2.64-2.07z" fill="#FBBC05"/>
                      <path d="M8.98 3.58c1.17 0 2.23.4 3.06 1.2l2.3-2.3A8 8 0 001.87 5.4L4.5 7.48c.64-1.87 2.4-3.9 4.48-3.9z" fill="#EA4335"/>
                    </svg>
                    Sign up with Google
                  </button>

                  <p style={{ textAlign: "center", fontSize: "0.93vw", color: "#374151" }}>
                    Already a member?{" "}
                    <Link href="/auth/sign-in" style={{ color: LBLUE, fontWeight: 600, textDecoration: "none" }}>Log in</Link>
                  </p>
                </form>

              ) : (
                <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: "1.33vw" }}>
                  <div>
                    <p style={{ fontSize: "0.67vw", fontWeight: 700, letterSpacing: "0.1em", color: "#374151", marginBottom: "0.67vw", textTransform: "uppercase" }}>Education board</p>
                    <div style={{ display: "flex", gap: "0.53vw", flexWrap: "wrap" }}>
                      {BOARDS.map(b => (
                        <button key={b} type="button" onClick={() => setBoard(b)} style={{ padding: "0.6vw 1.2vw", borderRadius: "0.67vw", fontSize: "0.87vw", fontWeight: 700, cursor: "pointer", background: board === b ? BLUE : "#fff", border: `1.5px solid ${board === b ? BLUE : BORDER}`, color: board === b ? "#fff" : "#1f2937", boxShadow: board === b ? "0 4px 14px rgba(29,78,216,0.35)" : "none" }}>{b}</button>
                      ))}
                    </div>
                  </div>

                  <div>
                    <p style={{ fontSize: "0.67vw", fontWeight: 700, letterSpacing: "0.1em", color: "#374151", marginBottom: "0.67vw", textTransform: "uppercase" }}>Grade / Class</p>
                    <div style={{ display: "flex", gap: "0.53vw" }}>
                      {GRADES.map(g => (
                        <button key={g} type="button" onClick={() => setGrade(g)} style={{ width: "2.93vw", height: "2.93vw", borderRadius: "0.67vw", fontSize: "0.87vw", fontWeight: 700, cursor: "pointer", background: grade === g ? BLUE : "#fff", border: `1.5px solid ${grade === g ? BLUE : BORDER}`, color: grade === g ? "#fff" : "#1f2937", boxShadow: grade === g ? "0 4px 14px rgba(29,78,216,0.35)" : "none" }}>{g}</button>
                      ))}
                    </div>
                    <p style={{ fontSize: "0.73vw", color: "#6b7280", marginTop: "0.4vw" }}>Helps us adapt the AI curriculum to your level.</p>
                  </div>

                  <label style={{ display: "flex", alignItems: "flex-start", gap: "0.67vw", cursor: "pointer" }}>
                    <div style={{ marginTop: "0.13vw", flexShrink: 0 }}>
                      <input type="checkbox" checked={agreed} onChange={e => setAgreed(e.target.checked)} style={{ position: "absolute", opacity: 0, width: 0, height: 0, pointerEvents: "none" }}/>
                      <div onClick={() => setAgreed(v => !v)} style={{ width: "1.2vw", height: "1.2vw", boxSizing: "border-box", borderRadius: "0.33vw", border: `1.5px solid ${agreed ? BLUE : BORDER}`, background: agreed ? BLUE : "#fff", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer" }}>
                        {agreed && <svg width="0.67vw" height="0.53vw" viewBox="0 0 10 8" fill="none"><path d="M1 4l3 3 5-6" stroke="white" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/></svg>}
                      </div>
                    </div>
                    <span style={{ fontSize: "0.83vw", color: "#374151", lineHeight: 1.6 }}>
                      I agree to the <span style={{ color: LBLUE, fontWeight: 600 }}>Privacy Policy</span> and{" "}
                      <span style={{ color: LBLUE, fontWeight: 600 }}>Student Safety Guidelines</span>. Ready to start my AI journey!
                    </span>
                  </label>

                  {error && <p style={{ background: "#fef2f2", border: "1px solid #fecaca", color: "#dc2626", borderRadius: "0.67vw", padding: "0.67vw 0.93vw", fontSize: "0.87vw" }}>{error}</p>}

                  <div style={{ display: "flex", gap: "0.67vw" }}>
                    <button type="button" onClick={() => setStep(1)} style={{ padding: "0.8vw 1.33vw", background: IBKG, border: `1px solid ${BORDER}`, borderRadius: 999, fontSize: "0.93vw", fontWeight: 600, color: "#374151", cursor: "pointer" }}>
                      ← Back
                    </button>
                    <button type="submit" disabled={loading || !agreed} style={{ flex: 1, padding: "1vw", background: BLUE, color: "#fff", borderRadius: 999, fontSize: "1.07vw", fontWeight: 800, border: `1.5px solid ${GOLD}`, cursor: "pointer", opacity: (loading || !agreed) ? 0.4 : 1, boxShadow: "0 4px 20px rgba(29,78,216,0.4), 0 0 12px rgba(200,160,80,0.35)" }}>
                      {loading ? "Creating account…" : "Launch my journey 🚀"}
                    </button>
                  </div>

                  <div style={{ display: "flex", justifyContent: "center", gap: "1.6vw" }}>
                    {["✅ COPPA Compliant", "🔒 Student-safe", "🎓 Teacher monitored"].map(t => (
                      <span key={t} style={{ fontSize: "0.7vw", color: "#6b7280" }}>{t}</span>
                    ))}
                  </div>
                </form>
              )}
            </div>
          </div>
      </div>
    </div>
  );
}
