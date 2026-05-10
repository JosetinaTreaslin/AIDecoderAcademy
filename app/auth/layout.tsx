import Link from "next/link";

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen relative overflow-hidden flex flex-col" style={{ background: "linear-gradient(145deg, #F3F0FF 0%, #EDE9FE 35%, #F8F6FF 65%, #EEF2FF 100%)" }}>

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
            className="text-sm font-semibold transition-colors px-4 py-2 rounded-xl hover:bg-black/[0.06]"
            style={{ color: "rgba(26,26,46,0.6)" }}>
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
        style={{ color: "rgba(26,26,46,0.4)", borderTop: "1px solid rgba(0,0,0,0.08)" }}>
        © 2026 AI Decoder Academy · Safe for students aged 11–16 · Teacher accounts available
      </footer>
    </div>
  );
}
