import { redirect } from "next/navigation";

/**
 * On-demand analysis jobs are disabled. Redirect to home.
 */
export default function JobPage() {
  redirect("/");
}
