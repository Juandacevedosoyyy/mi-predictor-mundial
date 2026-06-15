import type { Metadata } from "next";
import { Geist_Mono } from "next/font/google";
import "./globals.css";

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "IA Predictor — Mundial 2026",
  description:
    "Proyección estadística de todos los mercados del Mundial 2026. Análisis de entretenimiento, no asesoría de apuestas.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="es" className={geistMono.variable}>
      <body className="antialiased min-h-screen">
        <header className="border-b border-[var(--border)] px-6 py-3 flex items-center justify-between gap-4">
          <div className="flex items-center gap-4 shrink-0">
            <a href="/" className="flex items-center gap-2 hover:opacity-80 transition-opacity">
              <span className="text-[var(--accent)] font-bold text-base tracking-widest uppercase">
                IA PREDICTOR
              </span>
              <span className="text-[var(--muted-foreground)] text-xs tracking-wider hidden sm:block">
                MUNDIAL 2026
              </span>
            </a>
          </div>
          <nav className="flex items-center gap-1 text-xs">
            {[
              { href: "/grupos",   label: "Grupos"    },
              { href: "/analisis", label: "Polla"     },
              { href: "/admin",    label: "Admin"     },
            ].map(({ href, label }) => (
              <a
                key={href}
                href={href}
                className="px-3 py-1 rounded text-[var(--muted-foreground)] hover:text-[var(--accent)] hover:bg-[rgba(0,212,255,0.06)] transition-colors tracking-wider"
              >
                {label}
              </a>
            ))}
          </nav>
        </header>
        <main className="relative z-10">{children}</main>
      </body>
    </html>
  );
}
