import { notFound } from "next/navigation";
import { scoresEnabled } from "@/lib/flags";
import { Header } from "@/components/Header";
import RubricClient from "./RubricClient";

export default function RubricPage() {
  if (!scoresEnabled()) notFound();
  return (
    <>
      <Header />
      <RubricClient />
    </>
  );
}
