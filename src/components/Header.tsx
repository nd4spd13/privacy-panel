import Link from "next/link";
import { scoresEnabled } from "@/lib/flags";

export function Header() {
  const showGrades = scoresEnabled();
  return (
    <header className="border-b border-gray-200 bg-white sticky top-0 z-10">
      <div className="max-w-6xl mx-auto px-6 h-14 flex items-center justify-between">
        <Link href="/" className="flex items-center text-gray-900" aria-label="Privacy Panel">
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 320 64" height="32" fill="none" aria-hidden="true">
            <rect x="4" y="4" width="26.5" height="16.667" rx="6" fill="currentColor" />
            <rect x="33.5" y="4" width="26.5" height="16.667" rx="6" fill="currentColor" />
            <rect x="4" y="23.667" width="26.5" height="16.667" rx="6" fill="currentColor" />
            <rect x="33.5" y="23.667" width="26.5" height="16.667" rx="6" fill="currentColor" />
            <rect x="4" y="43.333" width="26.5" height="16.667" rx="6" fill="currentColor" />
            <rect x="35" y="44.833" width="23.5" height="13.667" rx="4.5" stroke="currentColor" strokeWidth="3" />
            <text x="80" y="44" fontSize="36" fontWeight="700" letterSpacing="-0.72" fill="currentColor" fontFamily="Inter Tight, -apple-system, system-ui, sans-serif">Privacy Panel</text>
          </svg>
        </Link>
        <nav className="flex items-center gap-6 text-sm text-gray-600">
          <Link href="/label" className="hover:text-gray-900 transition-colors">Label</Link>
          {showGrades && <Link href="/rubric" className="hover:text-gray-900 transition-colors">Score</Link>}
          <Link href="/directory" className="hover:text-gray-900 transition-colors">Directory</Link>
          <Link href="/about" className="hover:text-gray-900 transition-colors">About</Link>
        </nav>
      </div>
    </header>
  );
}
