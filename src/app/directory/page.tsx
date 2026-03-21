import Link from "next/link";
import { Header } from "@/components/Header";
import { GradeBadge } from "@/components/GradeBadge";
import { SearchBar } from "@/components/SearchBar";
import { listCompanies, searchCompanies, countCompanies } from "@/db/companies";
import { getLatestExtractionForCompany } from "@/db/extractions";

export const dynamic = "force-dynamic";

const PAGE_SIZE = 50;
const GRADE_ORDER: Record<string, number> = { A: 0, B: 1, C: 2, D: 3, F: 4 };

type SortKey = "grade" | "name" | "date";
type SortDir = "asc" | "desc";

// Default sort direction for each column
const DEFAULT_DIR: Record<SortKey, SortDir> = {
  grade: "desc",
  name: "asc",
  date: "desc",
};

// Responsive column widths — must match between header and rows.
// Mobile: grade + name + score only. md adds sold/tracking. lg adds analyzed.
const COL =
  "grid-cols-[48px_1fr_88px] md:grid-cols-[48px_1fr_88px_72px_88px] lg:grid-cols-[48px_1fr_88px_72px_88px_120px]";

export default function DirectoryPage({
  searchParams,
}: {
  searchParams: { q?: string; sort?: string; dir?: string; page?: string };
}) {
  const q = searchParams.q?.trim() ?? "";
  const sort = (searchParams.sort ?? "grade") as SortKey;
  const dir = (searchParams.dir ?? DEFAULT_DIR[sort]) as SortDir;
  const page = Math.max(1, parseInt(searchParams.page ?? "1", 10));

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
        tracking: ext.facts.dataSharing.crossSiteTracking.value,
      };
    })
    .filter(Boolean) as Array<{
    company: (typeof companies)[0];
    grade: { letter: string; score: number; label: string };
    analyzedAt: string;
    sold: boolean;
    tracking: boolean;
  }>;

  const sorted = [...rows].sort((a, b) => {
    let cmp = 0;
    if (sort === "name") cmp = a.company.name.localeCompare(b.company.name);
    else if (sort === "date") cmp = a.analyzedAt.localeCompare(b.analyzedAt);
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
            <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
              {/* Table header */}
              <div className={`grid ${COL} items-center px-4 py-2.5 bg-gray-50 border-b border-gray-200 text-xs font-semibold text-gray-400 uppercase tracking-wide gap-4`}>
                <div className="w-12" />
                <Link href={sortHref("name")} className={`hover:text-gray-700 transition-colors ${sort === "name" ? "text-gray-700" : ""}`}>
                  Company{sortArrow("name")}
                </Link>
                <Link href={sortHref("grade")} className={`text-right hover:text-gray-700 transition-colors ${sort === "grade" ? "text-gray-700" : ""}`}>
                  Score{sortArrow("grade")}
                </Link>
                <div className="text-center hidden md:block">Sold</div>
                <div className="text-center hidden md:block">Tracking</div>
                <Link href={sortHref("date")} className={`text-right hover:text-gray-700 transition-colors hidden lg:block ${sort === "date" ? "text-gray-700" : ""}`}>
                  Analyzed{sortArrow("date")}
                </Link>
              </div>

              {/* Rows */}
              {pageRows.map(({ company, grade, analyzedAt, sold, tracking }) => (
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
                  <div className="text-center hidden md:block">
                    {sold
                      ? <span className="text-xs font-bold text-red-600 bg-red-50 px-2 py-0.5 rounded">YES</span>
                      : <span className="text-xs text-gray-300">—</span>}
                  </div>
                  <div className="text-center hidden md:block">
                    {tracking
                      ? <span className="text-xs font-bold text-orange-600 bg-orange-50 px-2 py-0.5 rounded">YES</span>
                      : <span className="text-xs text-gray-300">—</span>}
                  </div>
                  <div className="text-right text-xs text-gray-400 hidden lg:block whitespace-nowrap">
                    {new Date(analyzedAt).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                  </div>
                </Link>
              ))}
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
