import Link from "next/link";
import { Header } from "@/components/Header";
import { GradeBadge } from "@/components/GradeBadge";
import { SearchBar } from "@/components/SearchBar";
import { listCompanies, searchCompanies, countCompanies } from "@/db/companies";
import { getLatestExtractionForCompany } from "@/db/extractions";

export const revalidate = 300;

const PAGE_SIZE = 50;
const GRADE_ORDER: Record<string, number> = { A: 0, B: 1, C: 2, D: 3, F: 4 };

type SortKey = "grade" | "name" | "date" | "retention" | "sold" | "trainsAI";
type SortDir = "asc" | "desc";

// Default sort direction for each column
const DEFAULT_DIR: Record<SortKey, SortDir> = {
  grade: "desc",
  name: "asc",
  date: "desc",
  retention: "desc",
  sold: "desc",
  trainsAI: "desc",
};

// Fixed column widths — must match between header and rows
const COL = "grid-cols-[48px_minmax(140px,1fr)_72px_56px_88px_72px_104px]";

export default async function DirectoryPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; sort?: string; dir?: string; page?: string }>;
}) {
  const sp = await searchParams;
  const q = (sp.q ?? "").trim().slice(0, 200);
  const sort = (sp.sort ?? "grade") as SortKey;
  const dir = (sp.dir ?? DEFAULT_DIR[sort]) as SortDir;
  const page = Math.max(1, parseInt(sp.page ?? "1", 10));

  const companies = q ? searchCompanies(q, 200) : listCompanies(1000);
  const totalCount = countCompanies();

  const rows = companies
    .map((c) => {
      const ext = getLatestExtractionForCompany(c.id);
      if (!ext) return null;
      return {
        company: c,
        grade: ext.grade,
        analyzedAt: ext.created_at,
        sold: ext.facts.dataSharing.soldToThirdParties.value,
        retention: ext.facts.retention?.longestStatedPeriod ?? null,
        trainsAI: ext.facts.dataSharing.usedToTrainAI?.value ?? null,
      };
    })
    .filter(Boolean) as Array<{
    company: (typeof companies)[0];
    grade: { letter: string; score: number; label: string };
    analyzedAt: string;
    sold: boolean | null;
    retention: string | null;
    trainsAI: boolean | null;
  }>;

  const sorted = [...rows].sort((a, b) => {
    let cmp = 0;
    if (sort === "name") cmp = a.company.name.localeCompare(b.company.name);
    else if (sort === "date") cmp = a.analyzedAt.localeCompare(b.analyzedAt);
    else if (sort === "sold") {
      const boolRank = (v: boolean | null) => v === true ? 0 : v === false ? 2 : 1;
      cmp = boolRank(a.sold) - boolRank(b.sold);
    }
    else if (sort === "trainsAI") {
      const boolRank = (v: boolean | null) => v === true ? 0 : v === false ? 2 : 1;
      cmp = boolRank(a.trainsAI) - boolRank(b.trainsAI);
    }
    else if (sort === "retention") {
      const retentionRank = (r: string | null) => {
        if (!r) return 99;
        const lower = r.toLowerCase();
        if (lower.includes("indefinite")) return 0;
        const match = lower.match(/^(\d+)\s*years?/i);
        if (match) {
          const years = parseInt(match[1]);
          return years > 3 ? 1 : 2;
        }
        return 3;
      };
      cmp = retentionRank(a.retention) - retentionRank(b.retention);
    }
    else {
      if (a.grade.score !== b.grade.score) cmp = a.grade.score - b.grade.score;
      else cmp = (GRADE_ORDER[a.grade.letter] ?? 9) - (GRADE_ORDER[b.grade.letter] ?? 9);
    }
    return dir === "desc" ? -cmp : cmp;
  });

  const totalPages = Math.max(1, Math.ceil(sorted.length / PAGE_SIZE));
  const currentPage = Math.min(page, totalPages);
  const pageRows = sorted.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);

  function href(overrides: { q?: string; sort?: SortKey; dir?: SortDir; page?: number }) {
    const params = new URLSearchParams();
    const nq = overrides.q ?? q;
    const nsort = overrides.sort ?? sort;
    const ndir = overrides.dir ?? (overrides.sort && overrides.sort !== sort ? DEFAULT_DIR[overrides.sort] : dir);
    const npage = overrides.page ?? 1;
    if (nq) params.set("q", nq);
    params.set("sort", nsort);
    params.set("dir", ndir);
    if (npage > 1) params.set("page", String(npage));
    const qs = params.toString();
    return `/directory${qs ? `?${qs}` : ""}`;
  }

  // Build a sort link for a column header: toggles dir if already active, else applies default dir
  function sortHref(key: SortKey) {
    if (sort === key) {
      return href({ sort: key, dir: dir === "asc" ? "desc" : "asc", page: 1 });
    }
    return href({ sort: key, dir: DEFAULT_DIR[key], page: 1 });
  }

  function sortArrow(key: SortKey) {
    if (sort !== key) return null;
    return dir === "asc" ? " ↑" : " ↓";
  }

  return (
    <>
      <Header />
      <main className="max-w-6xl mx-auto px-6 py-10">
        {/* ── Header bar ─────────────────────────────────────────────────── */}
        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 mb-8">
          <div>
            <h1 className="text-3xl font-black text-gray-900 mb-1">Company Directory</h1>
            <p className="text-sm text-gray-400">
              {totalCount.toLocaleString()} {totalCount === 1 ? "company" : "companies"} analyzed
              {q && <> · Showing results for &ldquo;<strong>{q}</strong>&rdquo;</>}
            </p>
          </div>
          <div className="w-full sm:w-72">
            <SearchBar placeholder="Filter companies…" defaultValue={q} />
          </div>
        </div>

        {sorted.length === 0 ? (
          <div className="text-center py-20 text-gray-400">
            {q ? (
              <>
                <p className="text-lg font-semibold mb-2">No results for &ldquo;{q}&rdquo;</p>
                <Link href="/directory" className="text-sm underline hover:text-gray-600">Clear search</Link>
              </>
            ) : (
              <p className="text-lg font-semibold">No companies analyzed yet.</p>
            )}
          </div>
        ) : (
          <>
            {/* overflow-x-auto lets the fixed-width table scroll on narrow viewports */}
            <div className="overflow-x-auto rounded-xl border border-gray-200">
              <div className="bg-white min-w-[660px]">
                {/* Table header */}
                <div className={`grid ${COL} items-center px-4 py-2.5 bg-gray-50 border-b border-gray-200 text-xs font-semibold text-gray-400 uppercase tracking-wide gap-4`}>
                  <div className="w-12" />
                  <Link href={sortHref("name")} className={`hover:text-gray-700 transition-colors ${sort === "name" ? "text-gray-700" : ""}`}>
                    Company{sortArrow("name")}
                  </Link>
                  <Link href={sortHref("grade")} className={`text-right hover:text-gray-700 transition-colors ${sort === "grade" ? "text-gray-700" : ""}`}>
                    Score{sortArrow("grade")}
                  </Link>
                  <Link href={sortHref("sold")} className={`text-center hover:text-gray-700 transition-colors ${sort === "sold" ? "text-gray-700" : ""}`}>
                    Sold{sortArrow("sold")}
                  </Link>
                  <Link href={sortHref("retention")} className={`text-center hover:text-gray-700 transition-colors ${sort === "retention" ? "text-gray-700" : ""}`}>
                    Retention{sortArrow("retention")}
                  </Link>
                  <Link href={sortHref("trainsAI")} className={`text-center hover:text-gray-700 transition-colors ${sort === "trainsAI" ? "text-gray-700" : ""}`}>
                    Trains AI{sortArrow("trainsAI")}
                  </Link>
                  <Link href={sortHref("date")} className={`text-right hover:text-gray-700 transition-colors ${sort === "date" ? "text-gray-700" : ""}`}>
                    Analyzed{sortArrow("date")}
                  </Link>
                </div>

                {/* Rows */}
                {pageRows.map(({ company, grade, analyzedAt, sold, retention, trainsAI }) => (
                  <Link
                    key={company.slug}
                    href={`/company/${company.slug}`}
                    className={`grid ${COL} items-center px-4 py-3 border-b border-gray-50 last:border-b-0 hover:bg-gray-50 transition-colors gap-4`}
                  >
                    <div className="w-12"><GradeBadge letter={grade.letter} size="sm" /></div>
                    <div className="min-w-0">
                      <div className="font-semibold text-gray-900 truncate">{company.name}</div>
                      {company.domain && <div className="text-xs text-gray-400 truncate">{company.domain}</div>}
                    </div>
                    <div className="text-right">
                      <span className="text-sm font-bold text-gray-900">{grade.score}</span>
                      <span className="text-xs text-gray-400">/100</span>
                    </div>
                    <div className="text-center">
                      {sold === true
                        ? <span className="text-xs font-bold text-red-600 bg-red-50 px-2 py-0.5 rounded">YES</span>
                        : <span className="text-xs text-gray-300">—</span>}
                    </div>
                    <div className="text-center text-xs">
                      {(() => {
                        if (!retention) return <span className="text-gray-300">—</span>;
                        const lower = retention.toLowerCase();
                        if (lower.includes("indefinite")) {
                          return <span className="font-bold text-red-600">Indefinite</span>;
                        }
                        const match = retention.match(/^(\d+)\s*years?/i);
                        if (match) {
                          const years = parseInt(match[1]);
                          return years > 3
                            ? <span className="font-semibold text-red-600">{years} yr</span>
                            : <span className="text-gray-500">{years} yr</span>;
                        }
                        return <span className="text-gray-400">{retention.slice(0, 12)}</span>;
                      })()}
                    </div>
                    <div className="text-center">
                      {trainsAI === true
                        ? <span className="text-xs font-bold text-red-600 bg-red-50 px-2 py-0.5 rounded">YES</span>
                        : trainsAI === null
                        ? <span className="text-xs font-semibold text-amber-600">?</span>
                        : <span className="text-xs text-gray-300">—</span>}
                    </div>
                    <div className="text-right text-xs text-gray-400 whitespace-nowrap">
                      {new Date(analyzedAt).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                    </div>
                  </Link>
                ))}
              </div>
            </div>

            {/* ── Pagination ──────────────────────────────────────────────── */}
            {totalPages > 1 && (
              <div className="mt-6 flex items-center justify-between text-sm">
                <span className="text-gray-400">
                  Showing {((currentPage - 1) * PAGE_SIZE) + 1}–{Math.min(currentPage * PAGE_SIZE, sorted.length)} of {sorted.length}
                </span>
                <div className="flex items-center gap-1">
                  {currentPage > 1 && (
                    <Link href={href({ page: currentPage - 1 })} className="px-3 py-1.5 rounded-lg border border-gray-200 hover:bg-gray-50 text-gray-700">
                      ← Prev
                    </Link>
                  )}
                  {Array.from({ length: totalPages }, (_, i) => i + 1)
                    .filter((p) => p === 1 || p === totalPages || Math.abs(p - currentPage) <= 2)
                    .reduce<(number | "…")[]>((acc, p, i, arr) => {
                      if (i > 0 && (arr[i - 1] as number) + 1 < p) acc.push("…");
                      acc.push(p);
                      return acc;
                    }, [])
                    .map((p, i) =>
                      p === "…" ? (
                        <span key={`ellipsis-${i}`} className="px-2 py-1.5 text-gray-300">…</span>
                      ) : (
                        <Link
                          key={p}
                          href={href({ page: p as number })}
                          className={`px-3 py-1.5 rounded-lg border ${p === currentPage ? "bg-black text-white border-black" : "border-gray-200 hover:bg-gray-50 text-gray-700"}`}
                        >
                          {p}
                        </Link>
                      )
                    )}
                  {currentPage < totalPages && (
                    <Link href={href({ page: currentPage + 1 })} className="px-3 py-1.5 rounded-lg border border-gray-200 hover:bg-gray-50 text-gray-700">
                      Next →
                    </Link>
                  )}
                </div>
              </div>
            )}

            {q && (
              <div className="mt-4 text-sm text-gray-400 text-center">
                <Link href="/directory" className="underline hover:text-gray-600">
                  Clear search · show all {totalCount} companies
                </Link>
              </div>
            )}
          </>
        )}
      </main>
    </>
  );
}
