import type { Metadata } from "next";
import { headers } from "next/headers";
import Script from "next/script";
import "./globals.css";

export const metadata: Metadata = {
  title: "Privacy Panel",
  description: "Transparent privacy policy analysis — like a Nutrition Facts label for your data.",
  icons: {
    icon: "/favicon.svg",
  },
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const nonce = (await headers()).get("x-nonce") ?? undefined;

  return (
    <html lang="en">
      <body className="bg-gray-50 text-gray-900 antialiased">
        {children}
        <footer className="border-t border-gray-200 mt-16 py-6">
          <div className="max-w-6xl mx-auto px-6 flex items-center justify-between text-xs text-gray-400">
            <span>© {new Date().getFullYear()} Privacy Panel</span>
            <nav className="flex gap-5">
              <a href="https://github.com/nd4spd13/privacy-panel" target="_blank" rel="noopener noreferrer" className="hover:text-gray-700">GitHub</a>
              <a href="/about" className="hover:text-gray-700">About</a>
              <a href="/changelog" className="hover:text-gray-700">Changelog</a>
              <a href="/terms" className="hover:text-gray-700">Terms</a>
              <a href="/privacy" className="hover:text-gray-700">Privacy Policy</a>
              <a href="mailto:hello@privacypanel.org?subject=Takedown%20Notice" className="hover:text-gray-700">Takedown</a>
            </nav>
          </div>
        </footer>
        <Script
          src="https://analytics.privacypanel.org/js/pa-pxHaq3rZuu3N4OiymZaTX.js"
          strategy="afterInteractive"
          nonce={nonce}
        />
        <Script id="plausible-init" strategy="afterInteractive" nonce={nonce}>
          {`window.plausible=window.plausible||function(){(plausible.q=plausible.q||[]).push(arguments)},plausible.init=plausible.init||function(i){plausible.o=i||{}};plausible.init()`}
        </Script>
      </body>
    </html>
  );
}
