"use client";
import { useState, useEffect, useRef } from "react";
import { useSignIn, useAuth } from "@clerk/nextjs";
import { useRouter } from "next/navigation";
import Link from "next/link";

const NAVY   = "#0d1b52";
const GOLD   = "#C8A050";
const BLUE   = "#1d4ed8";
const LBLUE  = "#2563eb";
const BORDER = "#e5e7eb";
const IBKG   = "#f9fafb";

function BgFixed({ image = "/Sign-in/page1.png" }: { image?: string }) {
  return (
    <div style={{
      position: "fixed", inset: 0, zIndex: 0,
      backgroundImage: `url('${image}')`,
      backgroundSize: "100% 100%",
      backgroundPosition: "center",
      backgroundRepeat: "no-repeat",
    }}/>
  );
}

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

const ICON_SIZE = "0.93vw";
const MailIcon   = () => <svg width={ICON_SIZE} height={ICON_SIZE} viewBox="0 0 16 16" fill="none"><rect x="1" y="3" width="14" height="10" rx="2" stroke="currentColor" strokeWidth="1.5"/><path d="M1 6l7 4 7-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/></svg>;
const LockIcon   = () => <svg width={ICON_SIZE} height={ICON_SIZE} viewBox="0 0 14 14" fill="none"><rect x="2" y="6" width="10" height="7" rx="1.5" stroke="currentColor" strokeWidth="1.5"/><path d="M4.5 6V4.5a2.5 2.5 0 015 0V6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/></svg>;
const EyeIcon    = () => <svg width={ICON_SIZE} height={ICON_SIZE} viewBox="0 0 14 14" fill="none"><path d="M1 7s2-4 6-4 6 4 6 4-2 4-6 4-6-4-6-4z" stroke="currentColor" strokeWidth="1.5"/><circle cx="7" cy="7" r="1.5" stroke="currentColor" strokeWidth="1.5"/></svg>;
const EyeOffIcon = () => <svg width={ICON_SIZE} height={ICON_SIZE} viewBox="0 0 14 14" fill="none"><path d="M1 1l12 12M5.5 5.7A2 2 0 019.3 9M2 3.5C.8 4.7 1 7 1 7s2 4 6 4c1.2 0 2.2-.3 3-.8M5 2.2C5.6 2.1 6.3 2 7 2c4 0 6 5 6 5s-.5 1.3-1.5 2.5" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/></svg>;

export default function SignInPage() {
  const { signIn, isLoaded, setActive } = useSignIn();
  const { isSignedIn } = useAuth();
  const router = useRouter();

  const [email,    setEmail]    = useState("");
  const [password, setPassword] = useState("");
  const [showPw,   setShowPw]   = useState(false);
  const [error,    setError]    = useState("");
  const [loading,  setLoading]  = useState(false);
  const justLoggedIn = useRef(false);

  // Forgot password flow
  const [forgotMode,        setForgotMode]        = useState(false);
  const [resetStep,         setResetStep]         = useState<"email"|"code"|"password">("email");
  const [resetCode,         setResetCode]         = useState("");
  const [newPassword,       setNewPassword]       = useState("");
  const [confirmPassword,   setConfirmPassword]   = useState("");
  const [showNewPassword,   setShowNewPassword]   = useState(false);
  const [showConfirmPass,   setShowConfirmPass]   = useState(false);

  useEffect(() => {
    if (isSignedIn && !justLoggedIn.current) router.replace("/dashboard");
  }, [isSignedIn, router]);

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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isLoaded || isSignedIn) return;
    setLoading(true); setError("");
    try {
      const result = await signIn.create({ identifier: email, password });
      if (result.status === "complete") {
        justLoggedIn.current = true;
        await setActive({ session: result.createdSessionId });
        router.replace("/dashboard");
      }
    } catch (err: unknown) {
      setError((err as { errors?: { message: string }[] })?.errors?.[0]?.message ?? "Invalid email or password.");
    } finally { setLoading(false); }
  };

  const handleGoogle = async () => {
    if (!isLoaded || isSignedIn) return;
    try {
      await signIn.authenticateWithRedirect({ strategy: "oauth_google", redirectUrl: "/auth/sso-callback", redirectUrlComplete: "/dashboard" });
    } catch (err: unknown) {
      setError((err as { errors?: { message: string }[] })?.errors?.[0]?.message ?? "Google sign-in failed.");
    }
  };

  // Step 1: send reset code
  const handleForgotEmail = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isLoaded) return;
    setLoading(true); setError("");
    try {
      await signIn.create({ strategy: "reset_password_email_code", identifier: email });
      setResetStep("code");
    } catch (err: unknown) {
      const clerkError = (err as { errors?: { message: string }[] })?.errors?.[0];
      setError(clerkError?.message ?? "Could not send reset email. Please check the address and try again.");
    } finally { setLoading(false); }
  };

  // Step 2: verify code with Clerk — no password submitted yet
  const handleForgotCode = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isLoaded) return;
    setError("");
    if (!/^\d{6}$/.test(resetCode.trim())) {
      setError("Please enter the 6-digit code sent to your email.");
      return;
    }
    setLoading(true);
    try {
      const result = await signIn.attemptFirstFactor({
        strategy: "reset_password_email_code",
        code: resetCode.trim(),
      } as Parameters<typeof signIn.attemptFirstFactor>[0]);
      if ((result.status as string) === "needs_new_password") {
        setResetStep("password"); // code verified — advance
      } else if (result.status === "complete") {
        await setActive({ session: result.createdSessionId });
        router.replace("/dashboard");
      }
    } catch {
      setResetCode("");
      setError("Invalid verification number.");
    } finally { setLoading(false); }
  };

  // Step 3: set new password via signIn.resetPassword (code already verified)
  const handleForgotPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isLoaded) return;
    setError("");
    if (newPassword !== confirmPassword) { setError("Passwords do not match."); return; }
    if (newPassword.length < 8) { setError("Password must be at least 8 characters."); return; }
    const letters  = (newPassword.match(/[a-zA-Z]/g) || []).length;
    const capitals = (newPassword.match(/[A-Z]/g)    || []).length;
    const symbols  = (newPassword.match(/[^a-zA-Z0-9]/g) || []).length;
    const numbers  = (newPassword.match(/[0-9]/g)    || []).length;
    if (letters < 4)  { setError("Password must have at least 4 letters."); return; }
    if (capitals < 1) { setError("Password must have at least 1 capital letter."); return; }
    if (symbols < 1)  { setError("Password must have at least 1 symbol (e.g. !@#$)."); return; }
    if (numbers < 3)  { setError("Password must have at least 3 numbers."); return; }
    setLoading(true);
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const result = await (signIn as any).resetPassword({ password: newPassword });
      if (result.status === "complete") {
        await setActive({ session: result.createdSessionId });
        router.replace("/dashboard");
      }
    } catch (err: unknown) {
      const clerkError = (err as { errors?: { message: string }[] })?.errors?.[0];
      setError(clerkError?.message ?? "Something went wrong. Please try again.");
    } finally { setLoading(false); }
  };

  const backToSignIn = () => { setForgotMode(false); setResetStep("email"); setError(""); };

  if (!isLoaded || isSignedIn) {
    return (
      <div style={{ position: "fixed", inset: 0, overflow: "hidden" }}>
        <BgFixed image="/Sign-in/page1.png"/>
        <div className="fixed inset-0 flex items-center justify-center">
          <div style={{ display: "flex", gap: "0.53vw" }}>
            {[0,1,2].map(i => (
              <div key={i} className="dot" style={{ width: "0.8vw", height: "0.8vw", borderRadius: "50%", background: BLUE }}/>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div style={{ position: "fixed", inset: 0, overflow: "hidden" }}>
      <BgFixed image="/Sign-in/page1.png"/>

      <style>{`
        .signin-card-scroll { -ms-overflow-style: none; }
        .signin-card-scroll::-webkit-scrollbar { display: none; }
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
        .signin-back-link {
          font-size: 0.8vw; font-weight: 600; color: #1d4ed8; background: none; border: none;
          cursor: pointer; display: flex; align-items: center; gap: 0.27vw; padding: 0;
        }
        .signin-back-link:hover { text-decoration: underline; }
      `}</style>

      <div style={{ position: "absolute", top: "7%", right: "6.5%", display: "flex", alignItems: "center", gap: "1.8vw", zIndex: 20 }}>
        <Link href="/auth/sign-in" className="nav-active">
          Log in
        </Link>
        <Link href="/auth/sign-up" className="nav-inactive">
          Sign up
        </Link>
      </div>

      <div style={{ position: "absolute", zIndex: 1, left: "41%", right: "25%", top: "16%", bottom: "10%" }}>
        <div style={{
          width: "100%", height: "100%",
          background: "#ffffff",
          borderRadius: "2vw",
          border: "1px solid rgba(255,255,255,0.8)",
          boxShadow: "0 8px 48px rgba(0,0,0,0.18), inset 0 0 0 1px rgba(200,160,80,0.12)",
          overflow: "auto",
          scrollbarWidth: "none",
        }} className="signin-card-scroll">

          {/* Card header */}
          <div style={{ padding: "1.87vw 2.13vw 1.47vw", borderBottom: `1px solid ${BORDER}` }}>
            <span style={{ display: "inline-block", fontSize: "0.73vw", fontWeight: 700, letterSpacing: "0.12em", textTransform: "uppercase", background: "#eff6ff", color: LBLUE, border: "1px solid #bfdbfe", padding: "0.27vw 0.8vw", borderRadius: 999, marginBottom: "1.2vw" }}>
              AI Decoder Academy
            </span>
            <h2 style={{ fontFamily: "var(--font-syne), system-ui, sans-serif", fontWeight: 800, fontSize: "1.4vw", color: "#111827", marginBottom: "0.4vw", letterSpacing: "-0.02em", whiteSpace: "nowrap" }}>
              {forgotMode
                ? (resetStep === "email" ? "Reset your password 🔑" : resetStep === "code" ? "Enter the code ✉️" : "Set new password 🔒")
                : "Welcome back! 🚀"}
            </h2>
            <p style={{ color: "#374151", fontSize: "0.93vw" }}>
              {forgotMode
                ? (resetStep === "email"
                    ? "We'll email you a 6-digit code to reset your password."
                    : resetStep === "code"
                      ? <>We sent a 6-digit code to <strong>{email}</strong>. Enter it below.</>
                      : "Choose a strong new password for your account.")
                : "Your arenas are waiting. Ready for your next session?"}
            </p>
          </div>

          {/* Card body */}
          <div style={{ padding: "1.6vw 2.13vw 1.87vw" }}>
            <div id="clerk-captcha" style={{ display: "none" }}/>

            {!forgotMode && (
              <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: "1.07vw" }}>
                <Inp label="Email" icon={<MailIcon/>} type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="you@school.com"/>

                <div>
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "0.4vw" }}>
                    <p style={{ fontSize: "0.67vw", fontWeight: 700, letterSpacing: "0.1em", color: "#374151", textTransform: "uppercase", margin: 0 }}>Password</p>
                    <button type="button" onClick={() => { setForgotMode(true); setError(""); }}
                      style={{ fontSize: "0.8vw", fontWeight: 600, color: LBLUE, background: "none", border: "none", cursor: "pointer", padding: 0 }}>
                      Forgot password?
                    </button>
                  </div>
                  <div style={{ position: "relative" }}>
                    <span style={{ position: "absolute", left: "0.8vw", top: "50%", transform: "translateY(-50%)", color: "#6b7280", display: "flex" }}>
                      <LockIcon/>
                    </span>
                    <input
                      type={showPw ? "text" : "password"} value={password} onChange={e => setPassword(e.target.value)} placeholder="••••••••"
                      style={{ width: "100%", boxSizing: "border-box", paddingLeft: "2.4vw", paddingRight: "2.4vw", paddingTop: "0.73vw", paddingBottom: "0.73vw", background: IBKG, border: `1px solid ${BORDER}`, borderRadius: "0.67vw", fontSize: "0.93vw", color: "#111827", outline: "none", transition: "border-color 0.15s" }}
                      onFocus={e => (e.currentTarget.style.borderColor = BLUE)}
                      onBlur={e  => (e.currentTarget.style.borderColor = BORDER)}
                    />
                    <button type="button" onClick={() => setShowPw(v => !v)}
                      style={{ position: "absolute", right: "0.8vw", top: "50%", transform: "translateY(-50%)", background: "none", border: "none", cursor: "pointer", color: "#6b7280", display: "flex" }}>
                      {showPw ? <EyeOffIcon/> : <EyeIcon/>}
                    </button>
                  </div>
                </div>

                {error && <p style={{ background: "#fef2f2", border: "1px solid #fecaca", color: "#dc2626", borderRadius: "0.67vw", padding: "0.67vw 0.93vw", fontSize: "0.87vw" }}>{error}</p>}

                <button type="submit" disabled={loading || !email || !password}
                  style={{ width: "100%", padding: "1vw", background: BLUE, color: "#fff", borderRadius: 999, fontSize: "1vw", fontWeight: 700, border: `1.5px solid ${GOLD}`, cursor: "pointer", opacity: (loading || !email || !password) ? 0.4 : 1, boxShadow: "0 4px 20px rgba(29,78,216,0.4), 0 0 12px rgba(200,160,80,0.35)" }}>
                  {loading ? "Logging in…" : "Log In →"}
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
                  Continue with Google
                </button>

                <p style={{ textAlign: "center", fontSize: "0.93vw", color: "#374151" }}>
                  New to the Academy?{" "}
                  <Link href="/auth/sign-up" style={{ color: LBLUE, fontWeight: 600, textDecoration: "none" }}>Create your account</Link>
                </p>
              </form>
            )}

            {/* ── Forgot password: step 1 — email ── */}
            {forgotMode && resetStep === "email" && (
              <form onSubmit={handleForgotEmail} style={{ display: "flex", flexDirection: "column", gap: "1.07vw" }}>
                <button type="button" onClick={backToSignIn} className="signin-back-link">← Back to sign in</button>
                <Inp label="Email" icon={<MailIcon/>} type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="you@school.com" required autoComplete="email"/>
                {error && <p style={{ background: "#fef2f2", border: "1px solid #fecaca", color: "#dc2626", borderRadius: "0.67vw", padding: "0.67vw 0.93vw", fontSize: "0.87vw" }}>{error}</p>}
                <button type="submit" disabled={loading || !email}
                  style={{ width: "100%", padding: "1vw", background: BLUE, color: "#fff", borderRadius: 999, fontSize: "1vw", fontWeight: 700, border: `1.5px solid ${GOLD}`, cursor: "pointer", opacity: (loading || !email) ? 0.4 : 1, boxShadow: "0 4px 20px rgba(29,78,216,0.4), 0 0 12px rgba(200,160,80,0.35)" }}>
                  {loading ? "Sending…" : "Send reset code →"}
                </button>
              </form>
            )}

            {/* ── Forgot password: step 2 — verify code ── */}
            {forgotMode && resetStep === "code" && (
              <form onSubmit={handleForgotCode} style={{ display: "flex", flexDirection: "column", gap: "1.07vw" }}>
                <button type="button" onClick={() => { setResetStep("email"); setError(""); }} className="signin-back-link">← Change email</button>
                <div>
                  <p style={{ fontSize: "0.67vw", fontWeight: 700, letterSpacing: "0.1em", color: "#374151", marginBottom: "0.4vw", textTransform: "uppercase" }}>Verification code</p>
                  <input type="text" value={resetCode} onChange={e => setResetCode(e.target.value.replace(/\D/g, "").slice(0,6))}
                    placeholder="123456" required maxLength={6} inputMode="numeric"
                    style={{ width: "100%", boxSizing: "border-box", padding: "0.73vw 0.8vw", background: IBKG, border: `1px solid ${BORDER}`, borderRadius: "0.67vw", fontSize: "1.2vw", color: "#111827", outline: "none", letterSpacing: "0.3em", textAlign: "center", transition: "border-color 0.15s" }}
                    onFocus={e => (e.currentTarget.style.borderColor = BLUE)}
                    onBlur={e  => (e.currentTarget.style.borderColor = BORDER)}
                  />
                </div>
                {error && <p style={{ background: "#fef2f2", border: "1px solid #fecaca", color: "#dc2626", borderRadius: "0.67vw", padding: "0.67vw 0.93vw", fontSize: "0.87vw" }}>{error}</p>}
                <button type="submit" disabled={loading || resetCode.length !== 6}
                  style={{ width: "100%", padding: "1vw", background: BLUE, color: "#fff", borderRadius: 999, fontSize: "1vw", fontWeight: 700, border: `1.5px solid ${GOLD}`, cursor: "pointer", opacity: (loading || resetCode.length !== 6) ? 0.4 : 1, boxShadow: "0 4px 20px rgba(29,78,216,0.4), 0 0 12px rgba(200,160,80,0.35)" }}>
                  {loading ? "Verifying…" : "Verify Code →"}
                </button>
              </form>
            )}

            {/* ── Forgot password: step 3 — new password ── */}
            {forgotMode && resetStep === "password" && (
              <form onSubmit={handleForgotPassword} style={{ display: "flex", flexDirection: "column", gap: "1.07vw" }}>
                <button type="button" onClick={() => { setResetStep("code"); setError(""); }} className="signin-back-link">← Back to code</button>

                {/* Live password requirements */}
                {(() => {
                  const l = (newPassword.match(/[a-zA-Z]/g)||[]).length;
                  const c = (newPassword.match(/[A-Z]/g)||[]).length;
                  const s = (newPassword.match(/[^a-zA-Z0-9]/g)||[]).length;
                  const n = (newPassword.match(/[0-9]/g)||[]).length;
                  const req = [
                    { label: "At least 4 letters",        ok: l >= 4 },
                    { label: "At least 1 capital letter",  ok: c >= 1 },
                    { label: "At least 1 symbol (!@#…)",   ok: s >= 1 },
                    { label: "At least 3 numbers",         ok: n >= 3 },
                  ];
                  return (
                    <ul style={{ display: "flex", flexDirection: "column", gap: "0.27vw", margin: 0, padding: 0, listStyle: "none" }}>
                      {req.map(r => (
                        <li key={r.label} style={{ display: "flex", alignItems: "center", gap: "0.4vw", fontSize: "0.8vw", fontWeight: 600, color: r.ok ? "#16a34a" : "#6b7280" }}>
                          <span>{r.ok ? "✓" : "○"}</span> {r.label}
                        </li>
                      ))}
                    </ul>
                  );
                })()}

                {/* New password */}
                <div>
                  <p style={{ fontSize: "0.67vw", fontWeight: 700, letterSpacing: "0.1em", color: "#374151", marginBottom: "0.4vw", textTransform: "uppercase" }}>New password</p>
                  <div style={{ position: "relative" }}>
                    <span style={{ position: "absolute", left: "0.8vw", top: "50%", transform: "translateY(-50%)", color: "#6b7280", display: "flex" }}>
                      <LockIcon/>
                    </span>
                    <input
                      type={showNewPassword ? "text" : "password"} value={newPassword} onChange={e => setNewPassword(e.target.value)}
                      placeholder="New password" required minLength={8}
                      style={{ width: "100%", boxSizing: "border-box", paddingLeft: "2.4vw", paddingRight: "2.4vw", paddingTop: "0.73vw", paddingBottom: "0.73vw", background: IBKG, border: `1px solid ${BORDER}`, borderRadius: "0.67vw", fontSize: "0.93vw", color: "#111827", outline: "none", transition: "border-color 0.15s" }}
                      onFocus={e => (e.currentTarget.style.borderColor = BLUE)}
                      onBlur={e  => (e.currentTarget.style.borderColor = BORDER)}
                    />
                    <button type="button" onClick={() => setShowNewPassword(v => !v)}
                      style={{ position: "absolute", right: "0.8vw", top: "50%", transform: "translateY(-50%)", background: "none", border: "none", cursor: "pointer", color: "#6b7280", display: "flex" }}>
                      {showNewPassword ? <EyeOffIcon/> : <EyeIcon/>}
                    </button>
                  </div>
                </div>

                {/* Confirm password */}
                <div>
                  <p style={{ fontSize: "0.67vw", fontWeight: 700, letterSpacing: "0.1em", color: "#374151", marginBottom: "0.4vw", textTransform: "uppercase" }}>Confirm password</p>
                  <div style={{ position: "relative" }}>
                    <span style={{ position: "absolute", left: "0.8vw", top: "50%", transform: "translateY(-50%)", color: "#6b7280", display: "flex" }}>
                      <LockIcon/>
                    </span>
                    <input
                      type={showConfirmPass ? "text" : "password"} value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)}
                      placeholder="Confirm password" required minLength={8}
                      style={{ width: "100%", boxSizing: "border-box", paddingLeft: "2.4vw", paddingRight: "2.4vw", paddingTop: "0.73vw", paddingBottom: "0.73vw", background: IBKG, border: `1px solid ${BORDER}`, borderRadius: "0.67vw", fontSize: "0.93vw", color: "#111827", outline: "none", transition: "border-color 0.15s" }}
                      onFocus={e => (e.currentTarget.style.borderColor = BLUE)}
                      onBlur={e  => (e.currentTarget.style.borderColor = BORDER)}
                    />
                    <button type="button" onClick={() => setShowConfirmPass(v => !v)}
                      style={{ position: "absolute", right: "0.8vw", top: "50%", transform: "translateY(-50%)", background: "none", border: "none", cursor: "pointer", color: "#6b7280", display: "flex" }}>
                      {showConfirmPass ? <EyeOffIcon/> : <EyeIcon/>}
                    </button>
                  </div>
                </div>

                {/* Live match indicator */}
                {confirmPassword && (
                  <p style={{ fontSize: "0.8vw", fontWeight: 600, color: newPassword === confirmPassword ? "#16a34a" : "#dc2626", margin: 0 }}>
                    {newPassword === confirmPassword ? "✓ Passwords match" : "✗ Passwords do not match"}
                  </p>
                )}

                {error && <p style={{ background: "#fef2f2", border: "1px solid #fecaca", color: "#dc2626", borderRadius: "0.67vw", padding: "0.67vw 0.93vw", fontSize: "0.87vw" }}>{error}</p>}

                <button type="submit" disabled={loading || newPassword !== confirmPassword ||
                  (newPassword.match(/[a-zA-Z]/g)||[]).length < 4 ||
                  (newPassword.match(/[A-Z]/g)||[]).length < 1 ||
                  (newPassword.match(/[^a-zA-Z0-9]/g)||[]).length < 1 ||
                  (newPassword.match(/[0-9]/g)||[]).length < 3}
                  style={{ width: "100%", padding: "1vw", background: BLUE, color: "#fff", borderRadius: 999, fontSize: "1vw", fontWeight: 700, border: `1.5px solid ${GOLD}`, cursor: "pointer", opacity: (loading || newPassword !== confirmPassword) ? 0.4 : 1, boxShadow: "0 4px 20px rgba(29,78,216,0.4), 0 0 12px rgba(200,160,80,0.35)" }}>
                  {loading ? "Saving…" : "Set new password →"}
                </button>
              </form>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
