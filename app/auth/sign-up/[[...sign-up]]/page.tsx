"use client";
import { useState, useEffect } from "react";
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

// ── Background — fixed so it never crops ──────────────────────────────────────
function BgFixed() {
  return (
    <div style={{
      position: "fixed", inset: 0, zIndex: 0,
      backgroundImage: "url('/Sign-in/page1.png')",
      backgroundSize: "cover",
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
      <p style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.1em", color: "#6b7280", marginBottom: 6, textTransform: "uppercase" }}>
        {label}
      </p>
      <div style={{ position: "relative" }}>
        <span style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)", color: "#9ca3af", display: "flex" }}>
          {icon}
        </span>
        <input
          {...props}
          style={{
            width: "100%", boxSizing: "border-box",
            paddingLeft: 36, paddingRight: rightIcon ? 36 : 12,
            paddingTop: 11, paddingBottom: 11,
            background: IBKG, border: `1px solid ${BORDER}`,
            borderRadius: 10, fontSize: 14, color: "#111827",
            outline: "none", transition: "border-color 0.15s",
          }}
          onFocus={e => (e.currentTarget.style.borderColor = BLUE)}
          onBlur={e  => (e.currentTarget.style.borderColor = BORDER)}
        />
        {rightIcon && (
          <button type="button" onClick={onRightClick}
            style={{ position: "absolute", right: 12, top: "50%", transform: "translateY(-50%)", background: "none", border: "none", cursor: "pointer", color: "#9ca3af", display: "flex" }}>
            {rightIcon}
          </button>
        )}
      </div>
    </div>
  );
}

// ── Icons ─────────────────────────────────────────────────────────────────────
const PersonIcon = () => <svg width="14" height="14" viewBox="0 0 16 16" fill="none"><circle cx="8" cy="5" r="3" stroke="currentColor" strokeWidth="1.5"/><path d="M2 14c0-3.31 2.69-6 6-6s6 2.69 6 6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/></svg>;
const MailIcon   = () => <svg width="14" height="14" viewBox="0 0 16 16" fill="none"><rect x="1" y="3" width="14" height="10" rx="2" stroke="currentColor" strokeWidth="1.5"/><path d="M1 6l7 4 7-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/></svg>;
const LockIcon   = () => <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><rect x="2" y="6" width="10" height="7" rx="1.5" stroke="currentColor" strokeWidth="1.5"/><path d="M4.5 6V4.5a2.5 2.5 0 015 0V6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/></svg>;
const EyeIcon    = () => <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><path d="M1 7s2-4 6-4 6 4 6 4-2 4-6 4-6-4-6-4z" stroke="currentColor" strokeWidth="1.5"/><circle cx="7" cy="7" r="1.5" stroke="currentColor" strokeWidth="1.5"/></svg>;
const EyeOffIcon = () => <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><path d="M1 1l12 12M5.5 5.7A2 2 0 019.3 9M2 3.5C.8 4.7 1 7 1 7s2 4 6 4c1.2 0 2.2-.3 3-.8M5 2.2C5.6 2.1 6.3 2 7 2c4 0 6 5 6 5s-.5 1.3-1.5 2.5" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/></svg>;

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

  useEffect(() => {
    if (isSignedIn && !verifying) router.replace("/dashboard");
  }, [isSignedIn, router, verifying]);

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
        await setActive({ session: result.createdSessionId, beforeEmit: () => router.replace("/dashboard") });
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
      <div className="fixed inset-0 flex items-center justify-center px-4">
        <BgFixed/>
        <div style={{ position: "relative", zIndex: 1, width: "100%", maxWidth: 420, background: "rgba(255,255,255,0.97)", borderRadius: 24, boxShadow: "0 20px 60px rgba(0,0,0,0.2)", padding: "40px 36px", textAlign: "center" }}>
          <div style={{ fontSize: 48, marginBottom: 16 }}>📬</div>
          <h2 style={{ fontWeight: 800, fontSize: 22, color: NAVY, marginBottom: 8 }}>Check your inbox!</h2>
          <p style={{ color: "#6b7280", fontSize: 14, marginBottom: 28 }}>We sent a 6-digit code to <strong style={{ color: LBLUE }}>{email}</strong></p>
          <div id="clerk-captcha"/>
          <form onSubmit={handleVerify} style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            <input value={code} onChange={e => setCode(e.target.value)} placeholder="0 0 0 0 0 0" maxLength={6} autoFocus
              style={{ width: "100%", boxSizing: "border-box", textAlign: "center", fontSize: 24, fontWeight: 900, letterSpacing: "0.4em", padding: "16px", background: IBKG, border: `2px solid ${BLUE}40`, borderRadius: 14, outline: "none", color: NAVY }}
              onFocus={e => (e.currentTarget.style.borderColor = BLUE)}
              onBlur={e  => (e.currentTarget.style.borderColor = `${BLUE}40`)}
            />
            {error && <p style={{ background: "#fef2f2", border: "1px solid #fecaca", color: "#dc2626", borderRadius: 10, padding: "10px 14px", fontSize: 13 }}>{error}</p>}
            <button type="submit" disabled={loading || code.length < 6}
              style={{ background: BLUE, color: "#fff", padding: "14px", borderRadius: 999, fontSize: 14, fontWeight: 700, border: "none", cursor: "pointer", opacity: (loading || code.length < 6) ? 0.4 : 1, boxShadow: "0 4px 20px rgba(29,78,216,0.4)" }}>
              {loading ? "Verifying…" : "Verify & Launch 🚀"}
            </button>
          </form>
        </div>
      </div>
    );
  }

  // ── Main layout ────────────────────────────────────────────────────────────
  return (
    <div style={{ position: "fixed", inset: 0, overflow: "auto" }}>
      <BgFixed/>

      {/* Top-right nav */}
      <div style={{ position: "fixed", top: 20, right: 28, display: "flex", alignItems: "center", gap: 12, zIndex: 20 }}>
        <Link href="/auth/sign-in" style={{ fontSize: 14, fontWeight: 600, color: NAVY, textDecoration: "none" }}>
          Log in
        </Link>
        <Link href="/auth/sign-up" style={{ fontSize: 14, fontWeight: 700, color: "#fff", background: BLUE, padding: "9px 22px", borderRadius: 999, textDecoration: "none", boxShadow: "0 4px 14px rgba(29,78,216,0.45)" }}>
          Sign up
        </Link>
      </div>

      {/* Body — card on right side */}
      <div style={{
        position: "relative", zIndex: 1,
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "flex-end",
        padding: "80px clamp(16px, 6vw, 72px) 40px",
      }}>

        {/* Form card */}
        <div style={{ width: "100%", maxWidth: "min(460px, 90vw)" }}>
          <div style={{
            width: "100%",
            background: "rgba(255,255,255,0.97)",
            borderRadius: 20,
            boxShadow: "0 8px 48px rgba(0,0,0,0.18)",
            overflow: "hidden",
          }}>

            {/* Card header */}
            <div style={{ padding: "28px 32px 22px", borderBottom: `1px solid ${BORDER}` }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 18 }}>
                <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.12em", textTransform: "uppercase", background: "#eff6ff", color: LBLUE, border: "1px solid #bfdbfe", padding: "4px 12px", borderRadius: 999 }}>
                  Step {step} of 2
                </span>
                <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
                  <div style={{ width: 36, height: 4, borderRadius: 999, background: step >= 1 ? BLUE : BORDER }}/>
                  <div style={{ width: 20, height: 4, borderRadius: 999, background: step >= 2 ? BLUE : BORDER }}/>
                </div>
              </div>
              <h2 style={{ fontWeight: 800, fontSize: 26, color: "#111827", marginBottom: 6, letterSpacing: "-0.01em" }}>
                {step === 1 ? "Create your account" : "Academic profile"}
              </h2>
              <p style={{ color: "#6b7280", fontSize: 14 }}>
                {step === 1 ? "Join students decoding the future of AI." : "Help us personalise your learning experience."}
              </p>
            </div>

            {/* Card body */}
            <div style={{ padding: "24px 32px 28px" }}>
              <div id="clerk-captcha" style={{ display: "none" }}/>

              {step === 1 ? (
                <form onSubmit={handleNext} style={{ display: "flex", flexDirection: "column", gap: 16 }}>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                    <Inp label="Full name" icon={<PersonIcon/>} value={fullName} onChange={e => setFullName(e.target.value)} placeholder="Rahul Sharma"/>
                    <Inp label="Email" icon={<MailIcon/>} type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="you@school.com"/>
                  </div>

                  <div>
                    <Inp label="Password" icon={<LockIcon/>}
                      type={showPw ? "text" : "password"} value={password} onChange={e => setPassword(e.target.value)} placeholder="Min. 8 characters"
                      rightIcon={showPw ? <EyeOffIcon/> : <EyeIcon/>} onRightClick={() => setShowPw(v => !v)}
                    />
                    {password.length > 0 && (
                      <div style={{ display: "flex", gap: 6, marginTop: 8, alignItems: "center" }}>
                        {[1, 2, 3, 4].map(i => (
                          <div key={i} style={{ flex: 1, height: 3, borderRadius: 999, background: i <= pwStrength ? pwColors[pwStrength] : BORDER, transition: "background 0.2s" }}/>
                        ))}
                        <span style={{ fontSize: 10, color: pwColors[pwStrength], minWidth: 36, textAlign: "right", fontWeight: 600 }}>
                          {["", "Weak", "Fair", "Good", "Strong"][pwStrength]}
                        </span>
                      </div>
                    )}
                  </div>

                  {error && <p style={{ background: "#fef2f2", border: "1px solid #fecaca", color: "#dc2626", borderRadius: 10, padding: "10px 14px", fontSize: 13 }}>{error}</p>}

                  <button type="submit" style={{ width: "100%", padding: "15px", background: BLUE, color: "#fff", borderRadius: 999, fontSize: 15, fontWeight: 700, border: "none", cursor: "pointer", boxShadow: "0 4px 20px rgba(29,78,216,0.4)" }}>
                    Next – Academic profile →
                  </button>

                  <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                    <div style={{ flex: 1, height: 1, background: BORDER }}/>
                    <span style={{ fontSize: 12, color: "#9ca3af", fontWeight: 500 }}>OR</span>
                    <div style={{ flex: 1, height: 1, background: BORDER }}/>
                  </div>

                  <button type="button" onClick={handleGoogle} style={{ width: "100%", padding: "12px", background: "#fff", border: `1px solid ${BORDER}`, borderRadius: 999, fontSize: 14, fontWeight: 600, color: "#374151", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 10 }}
                    onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = "#f9fafb"}
                    onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = "#fff"}>
                    <svg width="18" height="18" viewBox="0 0 18 18">
                      <path d="M16.51 8H8.98v3h4.3c-.18 1-.74 1.48-1.6 2.04v2.01h2.6a7.8 7.8 0 002.38-5.88c0-.57-.05-.66-.15-1.18z" fill="#4285F4"/>
                      <path d="M8.98 17c2.16 0 3.97-.72 5.3-1.94l-2.6-2.01c-.72.48-1.63.76-2.7.76-2.08 0-3.84-1.4-4.47-3.29H1.87v2.07A8 8 0 008.98 17z" fill="#34A853"/>
                      <path d="M4.51 10.52A4.8 4.8 0 014.26 9c0-.52.09-1.02.25-1.52V5.41H1.87A8 8 0 001 9c0 1.29.31 2.51.87 3.59l2.64-2.07z" fill="#FBBC05"/>
                      <path d="M8.98 3.58c1.17 0 2.23.4 3.06 1.2l2.3-2.3A8 8 0 001.87 5.4L4.5 7.48c.64-1.87 2.4-3.9 4.48-3.9z" fill="#EA4335"/>
                    </svg>
                    Sign up with Google
                  </button>

                  <p style={{ textAlign: "center", fontSize: 14, color: "#6b7280" }}>
                    Already a member?{" "}
                    <Link href="/auth/sign-in" style={{ color: LBLUE, fontWeight: 600, textDecoration: "none" }}>Log in</Link>
                  </p>
                </form>

              ) : (
                <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 20 }}>
                  <div>
                    <p style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.1em", color: "#6b7280", marginBottom: 10, textTransform: "uppercase" }}>Education board</p>
                    <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                      {BOARDS.map(b => (
                        <button key={b} type="button" onClick={() => setBoard(b)} style={{ padding: "8px 16px", borderRadius: 10, fontSize: 13, fontWeight: 600, cursor: "pointer", background: board === b ? "#eff6ff" : IBKG, border: `1.5px solid ${board === b ? BLUE : BORDER}`, color: board === b ? BLUE : "#6b7280" }}>{b}</button>
                      ))}
                    </div>
                  </div>

                  <div>
                    <p style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.1em", color: "#6b7280", marginBottom: 10, textTransform: "uppercase" }}>Grade / Class</p>
                    <div style={{ display: "flex", gap: 8 }}>
                      {GRADES.map(g => (
                        <button key={g} type="button" onClick={() => setGrade(g)} style={{ width: 44, height: 44, borderRadius: 10, fontSize: 13, fontWeight: 700, cursor: "pointer", background: grade === g ? "#eff6ff" : IBKG, border: `1.5px solid ${grade === g ? BLUE : BORDER}`, color: grade === g ? BLUE : "#6b7280" }}>{g}</button>
                      ))}
                    </div>
                    <p style={{ fontSize: 11, color: "#9ca3af", marginTop: 6 }}>Helps us adapt the AI curriculum to your level.</p>
                  </div>

                  <label style={{ display: "flex", alignItems: "flex-start", gap: 10, cursor: "pointer" }}>
                    <div style={{ marginTop: 2, flexShrink: 0 }}>
                      <input type="checkbox" checked={agreed} onChange={e => setAgreed(e.target.checked)} style={{ display: "none" }}/>
                      <div onClick={() => setAgreed(v => !v)} style={{ width: 18, height: 18, borderRadius: 5, border: `2px solid ${agreed ? BLUE : BORDER}`, background: agreed ? BLUE : "#fff", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer" }}>
                        {agreed && <svg width="10" height="8" viewBox="0 0 10 8" fill="none"><path d="M1 4l3 3 5-6" stroke="white" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/></svg>}
                      </div>
                    </div>
                    <span style={{ fontSize: 12.5, color: "#6b7280", lineHeight: 1.6 }}>
                      I agree to the <span style={{ color: LBLUE, fontWeight: 600 }}>Privacy Policy</span> and{" "}
                      <span style={{ color: LBLUE, fontWeight: 600 }}>Student Safety Guidelines</span>. Ready to start my AI journey!
                    </span>
                  </label>

                  {error && <p style={{ background: "#fef2f2", border: "1px solid #fecaca", color: "#dc2626", borderRadius: 10, padding: "10px 14px", fontSize: 13 }}>{error}</p>}

                  <div style={{ display: "flex", gap: 10 }}>
                    <button type="button" onClick={() => setStep(1)} style={{ padding: "12px 20px", background: IBKG, border: `1px solid ${BORDER}`, borderRadius: 999, fontSize: 14, fontWeight: 600, color: "#6b7280", cursor: "pointer" }}>
                      ← Back
                    </button>
                    <button type="submit" disabled={loading || !agreed} style={{ flex: 1, padding: "12px", background: BLUE, color: "#fff", borderRadius: 999, fontSize: 14, fontWeight: 700, border: "none", cursor: "pointer", opacity: (loading || !agreed) ? 0.4 : 1, boxShadow: "0 4px 20px rgba(29,78,216,0.4)" }}>
                      {loading ? "Creating account…" : "Launch my journey 🚀"}
                    </button>
                  </div>

                  <div style={{ display: "flex", justifyContent: "center", gap: 24 }}>
                    {["✅ COPPA Compliant", "🔒 Student-safe", "🎓 Teacher monitored"].map(t => (
                      <span key={t} style={{ fontSize: 10.5, color: "#9ca3af" }}>{t}</span>
                    ))}
                  </div>
                </form>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
