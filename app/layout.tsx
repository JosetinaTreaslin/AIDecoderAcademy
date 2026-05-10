import type { Metadata } from "next";
import { Syne, DM_Sans, JetBrains_Mono, Space_Grotesk, Outfit } from "next/font/google";
import { ClerkProvider } from "@clerk/nextjs";
import "./globals.css";

const syne = Syne({
  subsets: ["latin"],
  variable: "--font-syne",
  display: "swap",
});

const dmSans = DM_Sans({
  subsets: ["latin"],
  variable: "--font-dm-sans",
  display: "swap",
});

const jetbrainsMono = JetBrains_Mono({
  subsets: ["latin"],
  variable: "--font-jetbrains-mono",
  display: "swap",
});

const spaceGrotesk = Space_Grotesk({
  subsets: ["latin"],
  variable: "--font-space-grotesk",
  display: "swap",
});

const outfit = Outfit({
  subsets: ["latin"],
  variable: "--font-outfit",
  display: "swap",
});

export const metadata: Metadata = {
  title: "AI Decoder Academy",
  description: "A safe AI-powered learning playground for curious minds.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <ClerkProvider>
      <html
        lang="en"
        className={`${syne.variable} ${dmSans.variable} ${jetbrainsMono.variable} ${spaceGrotesk.variable} ${outfit.variable}`}
      >
        <body className="font-body bg-[#08080F] text-white antialiased">
          {children}
        </body>
      </html>
    </ClerkProvider>
  );
}