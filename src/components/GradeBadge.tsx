const BG: Record<string, string> = {
  A: "bg-green-700",
  B: "bg-lime-700",
  C: "bg-amber-600",
  D: "bg-orange-700",
  F: "bg-red-700",
};

const TEXT: Record<string, string> = {
  A: "#15803d",
  B: "#4d7c0f",
  C: "#b45309",
  D: "#c2410c",
  F: "#b91c1c",
};

interface GradeBadgeProps {
  letter: string;
  score?: number;
  size?: "sm" | "md" | "lg";
  show?: boolean;
}

export function GradeBadge({ letter, score, size = "md", show = true }: GradeBadgeProps) {
  if (!show) return null;
  const bg = BG[letter] ?? "bg-gray-500";
  const sizes = {
    sm: "w-8 h-8 text-base",
    md: "w-12 h-12 text-2xl",
    lg: "w-16 h-16 text-3xl",
  };

  return (
    <div className="flex items-center gap-2">
      <div className={`${bg} ${sizes[size]} rounded-full flex items-center justify-center text-white font-black`}>
        {letter}
      </div>
      {score !== undefined && (
        <span className="text-sm text-gray-500 font-medium">{score}/100</span>
      )}
    </div>
  );
}

export function GradeColor(letter: string): string {
  return TEXT[letter] ?? "#6b7280";
}
