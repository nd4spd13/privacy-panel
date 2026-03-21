import { Header } from "@/components/Header";
import { FEATURE_COMPARE } from "@/lib/flags";
import CompareClient from "./client";

export default function ComparePage() {
  if (!FEATURE_COMPARE) {
    return (
      <>
        <Header />
        <main className="max-w-3xl mx-auto px-6 py-20 text-center">
          <h1 className="text-2xl font-black text-gray-900 mb-3">Coming soon</h1>
          <p className="text-sm text-gray-500">The compare feature is not available yet.</p>
        </main>
      </>
    );
  }
  return (
    <>
      <Header />
      <CompareClient />
    </>
  );
}
