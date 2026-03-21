import Link from "next/link";
import { GradeBadge } from "./GradeBadge";

interface CompanyCardProps {
  slug: string;
  name: string;
  score: number;
  letter: string;
  label: string;
}

export function CompanyCard({ slug, name, score, letter, label }: CompanyCardProps) {
  return (
    <Link
      href={`/company/${slug}`}
      className="flex items-center gap-4 bg-white border border-gray-200 rounded-xl p-4 hover:border-gray-400 hover:shadow-sm transition-all"
    >
      <GradeBadge letter={letter} size="md" />
      <div className="min-w-0">
        <div className="font-semibold text-gray-900 truncate">{name}</div>
        <div className="text-sm text-gray-400">{score}/100 · {label}</div>
      </div>
    </Link>
  );
}
