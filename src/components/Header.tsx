import Link from "next/link";

export function Header() {
  return (
    <header className="border-b border-gray-200 bg-white sticky top-0 z-10">
      <div className="max-w-6xl mx-auto px-6 h-14 flex items-center justify-between">
        <Link href="/" className="flex items-center gap-2 font-bold text-gray-900 text-lg tracking-tight">
          <span className="text-black font-black">Privacy</span>
          <span className="bg-black text-white text-xs font-black px-1.5 py-0.5 rounded">FACTS</span>
        </Link>
        <nav className="flex items-center gap-6 text-sm text-gray-600">
          <Link href="/label" className="hover:text-gray-900 transition-colors">Label</Link>
          <Link href="/rubric" className="hover:text-gray-900 transition-colors">Rubric</Link>
          <Link href="/about" className="hover:text-gray-900 transition-colors">About</Link>
        </nav>
      </div>
    </header>
  );
}
