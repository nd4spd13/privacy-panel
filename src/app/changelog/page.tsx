import type { Metadata } from "next";
import Link from "next/link";
import { Header } from "@/components/Header";

export const metadata: Metadata = {
  title: "Changelog — Privacy Panel",
  description: "Notable changes to Privacy Panel data, methodology, and site features.",
};

interface Entry {
  date: string;
  sections: { heading: string; items: string[] }[];
}

const ENTRIES: Entry[] = [
  {
    date: "2026-05-28",
    sections: [
      {
        heading: "Data",
        items: [
          "Added parent company attribution for all 101 companies — brands are now linked to their parent organizations (e.g. Instagram → Meta, YouTube → Alphabet).",
          "Cleaned up company display names by separating product names from parent entity.",
        ],
      },
    ],
  },
  {
    date: "2026-05",
    sections: [
      {
        heading: "Site",
        items: [
          "Rebranded from Privacy Facts to Privacy Panel — new name, new domain, updated labels and API.",
          "Published methodology and rubric for the A–F scoring system.",
        ],
      },
    ],
  },
  {
    date: "2026 — Launch",
    sections: [
      {
        heading: "",
        items: [
          "Initial release covering 101 companies.",
          "Privacy Panel label for each company: standardized snapshot of data collection, sharing, consumer rights, and security practices.",
          "A–F grades based on a transparent, published rubric.",
          "Embeddable SVG and HTML labels for any company.",
          "Public API (/api/v1/) for programmatic access.",
        ],
      },
    ],
  },
];

export default function ChangelogPage() {
  return (
    <>
      <Header />
      <main className="max-w-3xl mx-auto px-6 py-12">
        <div className="mb-10">
          <h1 className="text-4xl font-black text-gray-900 mb-3">Changelog</h1>
          <p className="text-lg text-gray-500 leading-relaxed">
            Notable changes to Privacy Panel data, methodology, and site features.
          </p>
        </div>

        <div className="space-y-12">
          {ENTRIES.map((entry) => (
            <section key={entry.date}>
              <h2 className="text-xl font-bold text-gray-900 border-b border-gray-200 pb-2 mb-5">
                {entry.date}
              </h2>
              {entry.sections.map((section) => (
                <div key={section.heading} className="mb-5">
                  {section.heading && (
                    <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3">
                      {section.heading}
                    </h3>
                  )}
                  <ul className="space-y-2">
                    {section.items.map((item) => (
                      <li key={item} className="flex gap-3 text-gray-700 leading-relaxed">
                        <span className="text-gray-300 mt-1 shrink-0">—</span>
                        <span>{item}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </section>
          ))}
        </div>

        <div className="mt-16 pt-8 border-t border-gray-200 text-sm text-gray-400">
          <Link href="/" className="hover:text-gray-700">← Back to home</Link>
        </div>
      </main>
    </>
  );
}
