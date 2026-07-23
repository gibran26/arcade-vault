import type { Metadata } from 'next';
import { Press_Start_2P, JetBrains_Mono } from 'next/font/google';
import { AuthProvider } from '@/app/context/auth-context';
import Nav from '@/components/Nav';
import './globals.css';

const pixelFont = Press_Start_2P({
  variable: '--font-pixel',
  weight: '400',
  subsets: ['latin'],
});

const monoFont = JetBrains_Mono({
  variable: '--font-mono-arcade',
  subsets: ['latin'],
});

export const metadata: Metadata = {
  title: 'Arcade Vault',
  description:
    'Plataforma para jugar online y competir por la mayor cantidad de puntos.',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="es" className={`${pixelFont.variable} ${monoFont.variable}`}>
      <body>
        <AuthProvider>
          <div className="av-bg" />
          <div className="av-noise" />
          <div id="root">
            <Nav />
            <main className="av-main">{children}</main>
            <footer
              style={{
                borderTop: '1px solid rgba(0, 245, 255, 0.35)',
                padding: '10px 32px',
                textAlign: 'center',
                color: 'var(--ink-faint)',
                fontFamily: 'var(--mono)',
                fontSize: 11,
                letterSpacing: '0.16em',
              }}
            >
              © 2026 ARCADE VAULT · HECHO CON PIXELES Y NEÓN · v2.6.0
            </footer>
          </div>
        </AuthProvider>
      </body>
    </html>
  );
}
