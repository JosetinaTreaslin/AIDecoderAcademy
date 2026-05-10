import Link from "next/link";

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen relative overflow-hidden flex flex-col">

      {/* ── Background image (matches hub page) ────────────────────────── */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src="/panels/background.png" alt="" aria-hidden draggable={false}
        className="absolute inset-0 w-full h-full object-cover pointer-events-none select-none"
        style={{ zIndex: 0 }} />

      {/* ── Overlay to soften background for readability ─────────────── */}
      <div aria-hidden className="absolute inset-0 pointer-events-none" style={{ zIndex: 1, background: "rgba(255,255,255,0.18)" }} />

      {/* ── Nav ───────────────────────────────────────────────────────── */}
      <nav className="relative z-10 flex items-center justify-between px-6 sm:px-10 py-5 max-w-6xl mx-auto w-full">
        <Link href="/" className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-xl flex items-center justify-center font-display font-black text-sm"
            style={{ background: "linear-gradient(135deg, #7C3AED, #5B21B6)", boxShadow: "0 0 16px rgba(124,58,237,0.45)" }}>
            <span style={{ color: "#C8FF00" }}>AI</span>
          </div>
          <div className="flex items-baseline gap-1">
            <span className="font-display font-black text-base leading-none" style={{ color: "#1a1a2e" }}>AI</span>
            <span className="font-display font-black text-base leading-none" style={{ color: "#7C3AED" }}>Decoder</span>
            <span className="font-display font-black text-base leading-none" style={{ color: "#1a1a2e" }}>Academy</span>
          </div>
        </Link>
        <div className="flex items-center gap-2">
          <Link href="/auth/sign-in"
            className="text-sm font-semibold transition-colors px-4 py-2 rounded-xl"
            style={{ color: "rgba(26,26,46,0.7)", background: "rgba(255,255,255,0.6)", backdropFilter: "blur(8px)", border: "1px solid rgba(255,255,255,0.6)" }}>
            Log in
          </Link>
          <Link href="/auth/sign-up"
            className="text-sm font-bold px-4 py-2 rounded-xl transition-all"
            style={{ background: "#7C3AED", color: "#fff", boxShadow: "0 0 16px rgba(124,58,237,0.35)" }}>
            Sign up
          </Link>
        </div>
      </nav>

      {/* ── Page content ──────────────────────────────────────────────── */}
      <div className="relative z-10 flex-1 flex items-center justify-center px-4 py-10">
        {children}
      </div>

      {/* ── Footer ────────────────────────────────────────────────────── */}
      <footer className="relative z-10 text-center py-5 text-[11px]"
        style={{ color: "rgba(26,26,46,0.5)", borderTop: "1px solid rgba(255,255,255,0.4)" }}>
        © 2026 AI Decoder Academy · Safe for students aged 11–16 · Teacher accounts available
      </footer>
    </div>
  );
}
