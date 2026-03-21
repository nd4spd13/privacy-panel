#!/usr/bin/env node
import { program } from "commander";
import chalk from "chalk";
import { fetchPolicy } from "../src/core/ingestion/fetcher";
import { extract } from "../src/core/extraction/extractor";
import { score } from "../src/core/scoring/engine";
import { loadRubricOrThrow } from "../src/core/scoring/rubric";
import { join } from "path";

const rubricPath = join(__dirname, "../src/core/scoring/rubric.v1.yaml");

program
  .name("privacyfacts")
  .description("Privacy policy analyzer — extract, score, and display Privacy Facts labels")
  .version("0.1.0");

// ─── analyze command ──────────────────────────────────────────────────────────

program
  .command("analyze <url>")
  .description("Fetch and analyze a privacy policy from a URL")
  .option("--json", "Output raw extraction JSON")
  .option("--label", "Output SVG label to stdout")
  .option("--company <name>", "Override company name")
  .action(async (url: string, opts: { json?: boolean; label?: boolean; company?: string }) => {
    const rubric = loadRubricOrThrow(rubricPath);

    // 1. Fetch
    console.error(chalk.dim(`Fetching ${url} …`));
    const fetchResult = await fetchPolicy(url);
    if (!fetchResult.success) {
      console.error(chalk.red(`✗ Fetch failed: ${fetchResult.error}`));
      process.exit(1);
    }
    console.error(chalk.dim(`Fetched ${fetchResult.text.length.toLocaleString()} chars via ${fetchResult.metadata.method}`));

    // 2. Extract
    console.error(chalk.dim("Extracting privacy facts (calling Claude API) …"));
    const extractResult = await extract(fetchResult.text, opts.company, url);
    if (!extractResult.success) {
      console.error(chalk.red(`✗ Extraction failed: ${extractResult.error}`));
      process.exit(1);
    }
    const { data, meta } = extractResult;
    console.error(chalk.dim(`Extracted in ${meta.latencyMs}ms (${meta.inputTokens} in / ${meta.outputTokens} out tokens)`));

    // 3. Score
    const gradeResult = score(data, rubric);

    // ── Output ──────────────────────────────────────────────────────────────

    if (opts.json) {
      console.log(JSON.stringify({ extraction: data, grade: gradeResult }, null, 2));
      return;
    }

    if (opts.label) {
      const { renderToSVG } = await import("../src/core/rendering/embed");
      process.stdout.write(renderToSVG(data, gradeResult));
      return;
    }

    printResults(data, gradeResult);
  });

// ─── ingest-snapshots command ─────────────────────────────────────────────────

program
  .command("ingest-snapshots")
  .description("Extract & score companies from local PDF snapshots (Option A pipeline)")
  .option("--provenance <file>", "Path to policy-provenance.json", "")
  .option("--snapshots-dir <dir>", "Directory containing PDF snapshots", "")
  .option("--slug <slug>", "Only process this one company slug")
  .option("--concurrency <n>", "Max parallel extractions", "3")
  .option("--delay <ms>", "Delay between batches in ms", "1500")
  .option("--skip-existing", "Skip slugs already in the database", false)
  .action(async (opts: {
    provenance: string;
    snapshotsDir: string;
    slug?: string;
    concurrency: string;
    delay: string;
    skipExisting: boolean;
  }) => {
    const { readFileSync, existsSync } = await import("fs");
    const { join: pj, resolve, dirname } = await import("path");
    const rubric = loadRubricOrThrow(rubricPath);
    const concurrency = parseInt(opts.concurrency, 10);
    const delayMs = parseInt(opts.delay, 10);

    // Locate provenance file
    const provenancePath = opts.provenance
      ? resolve(opts.provenance)
      : resolve("/Users/csb/Documents/Claude/Projects/Privacy Facts Label/policy-provenance.json");

    if (!existsSync(provenancePath)) {
      console.error(chalk.red(`✗ Provenance file not found: ${provenancePath}`));
      process.exit(1);
    }

    const provenance = JSON.parse(readFileSync(provenancePath, "utf-8"));
    const records: Array<{
      company_slug: string;
      company: string;
      app_or_service: string;
      policy_url: string;
      snapshot_path: string | null;
    }> = provenance.records ?? [];

    // Default snapshots dir = sibling of provenance file
    const defaultSnapshotsDir = pj(dirname(provenancePath), "policies", "snapshots");
    const snapshotsDir = opts.snapshotsDir ? resolve(opts.snapshotsDir) : defaultSnapshotsDir;

    // Filter to slug if requested
    const toProcess = opts.slug
      ? records.filter((r) => r.company_slug === opts.slug)
      : records.filter((r) => r.snapshot_path !== null);

    if (toProcess.length === 0) {
      console.error(chalk.yellow("No records with snapshots found. Run fetch_snapshots.py first."));
      process.exit(0);
    }

    // Optionally skip already-ingested companies
    let tasks = toProcess;
    if (opts.skipExisting) {
      const { getDb } = await import("../src/db/client");
      const db = getDb();
      tasks = toProcess.filter((r) => {
        const existing = db
          .prepare("SELECT id FROM companies WHERE slug = ?")
          .get(r.company_slug);
        if (existing) {
          console.error(chalk.dim(`  SKIP  ${r.company_slug}  (already in DB)`));
          return false;
        }
        return true;
      });
    }

    console.error(chalk.bold(`\nIngesting ${tasks.length} PDF snapshots (concurrency=${concurrency}) …\n`));

    const { parsePdfBuffer } = await import("../src/core/ingestion/pdf-parser");
    const { upsertCompany } = await import("../src/db/companies");
    const { insertPolicy } = await import("../src/db/policies");
    const { insertExtraction } = await import("../src/db/extractions");
    const { slugify } = await import("../src/lib/slugify");

    let succeeded = 0;
    let failed = 0;
    let done = 0;
    const total = tasks.length;

    // Heartbeat — print a "still running" line every 20s so the terminal doesn't look frozen
    const heartbeat = setInterval(() => {
      if (done < total) {
        console.error(chalk.dim(`  … still running  ${done}/${total} done  (${succeeded} ok, ${failed} err)`));
      }
    }, 20_000);

    async function processOne(record: typeof tasks[0]) {
      const { company_slug, company, app_or_service, policy_url, snapshot_path } = record;
      const label = `${app_or_service} (${company_slug})`;

      // Resolve PDF path — snapshot_path is relative to project root
      const pdfPath = snapshot_path
        ? resolve(dirname(provenancePath), snapshot_path)
        : pj(snapshotsDir, `${company_slug}-2026-03.pdf`);

      if (!existsSync(pdfPath)) {
        done++;
        console.error(`  ${chalk.yellow("[SKIP]")}  ${label}  ${chalk.dim(`PDF not found: ${pdfPath}`)}`);
        failed++;
        return;
      }

      try {
        // 1. Parse PDF
        const { readFileSync: rfs } = await import("fs");
        const buffer = rfs(pdfPath);
        const parseResult = await parsePdfBuffer(buffer);
        if (!parseResult.success) {
          throw new Error(`PDF parse failed: ${parseResult.error}`);
        }

        const policyText = parseResult.text;
        if (policyText.trim().length < 200) {
          throw new Error(`Extracted text too short (${policyText.length} chars) — PDF may be image-only`);
        }

        // 2. Extract with Claude
        const companyName = app_or_service !== company ? `${app_or_service} (${company})` : company;
        const extractResult = await extract(policyText, companyName, policy_url);
        if (!extractResult.success) throw new Error(`Extraction failed: ${extractResult.error}`);

        // 3. Score
        const gradeResult = score(extractResult.data, rubric);

        // 4. Store
        const domain = policy_url ? new URL(policy_url).hostname.replace(/^www\./, "") : undefined;
        const co = upsertCompany(company_slug, companyName, domain);

        // Use PDF hash as content hash
        const { createHash } = await import("crypto");
        const contentHash = createHash("sha256").update(buffer).digest("hex");
        const now = new Date().toISOString();

        const policy = insertPolicy(co.id, policy_url, contentHash, now);
        insertExtraction(policy.id, co.id, extractResult.data, gradeResult, {
          model: extractResult.meta.model,
          inputTokens: extractResult.meta.inputTokens,
          outputTokens: extractResult.meta.outputTokens,
          latencyMs: extractResult.meta.latencyMs,
          chunked: extractResult.meta.chunked,
        });

        done++;
        const gradeColor = gradeResult.letter === "A" ? chalk.green
          : gradeResult.letter === "B" ? chalk.yellow
          : gradeResult.letter === "F" ? chalk.red
          : chalk.white;
        console.error(
          `  ${gradeColor(`[${gradeResult.letter}]`)}  ${chalk.bold(gradeResult.score + "/100")}  ${label}` +
          `  ${chalk.dim(`(${done}/${total})`)}`
        );
        succeeded++;
      } catch (err) {
        done++;
        console.error(`  ${chalk.red("[ERR]")}  ${label}  ${chalk.dim((err as Error).message)}  ${chalk.dim(`(${done}/${total})`)}`);
        failed++;
      }
    }

    // Process with concurrency limit
    for (let i = 0; i < tasks.length; i += concurrency) {
      const batch = tasks.slice(i, i + concurrency);
      await Promise.all(batch.map(processOne));
      if (i + concurrency < tasks.length && delayMs > 0) {
        await new Promise((r) => setTimeout(r, delayMs));
      }
    }

    clearInterval(heartbeat);
    console.error(chalk.bold(`\nDone: ${succeeded} succeeded, ${failed} failed`));
    if (succeeded > 0) {
      const { getDb } = await import("../src/db/client");
      const db = getDb();
      const avg = (db.prepare("SELECT AVG(score) as a FROM extractions").get() as { a: number }).a;
      console.error(chalk.dim(`Average score in DB: ${Math.round(avg)}/100`));
    }
  });

// ─── batch command ────────────────────────────────────────────────────────────

program
  .command("batch <file>")
  .description("Analyze multiple privacy policies from a CSV or newline-delimited file (url[,company])")
  .option("--concurrency <n>", "Max parallel analyses", "3")
  .option("--out <dir>", "Directory to write JSON results", "./results")
  .option("--delay <ms>", "Delay between requests in ms", "2000")
  .action(async (file: string, opts: { concurrency: string; out: string; delay: string }) => {
    const { readFileSync, mkdirSync, writeFileSync, existsSync } = await import("fs");
    const { join: pathJoin } = await import("path");
    const rubric = loadRubricOrThrow(rubricPath);
    const concurrency = parseInt(opts.concurrency, 10);
    const delayMs = parseInt(opts.delay, 10);
    const outDir = opts.out;

    if (!existsSync(outDir)) mkdirSync(outDir, { recursive: true });

    const lines = readFileSync(file, "utf-8")
      .split("\n")
      .map((l) => l.trim())
      .filter((l) => l && !l.startsWith("#"));

    const tasks = lines.map((line) => {
      const [url, company] = line.split(",").map((s) => s.trim());
      return { url, company: company || undefined };
    });

    console.error(chalk.bold(`Batch analyzing ${tasks.length} URLs (concurrency=${concurrency}) …\n`));

    const results: Array<{ url: string; company?: string; status: "ok" | "error"; grade?: string; score?: number; error?: string }> = [];
    let done = 0;

    async function runOne(task: { url: string; company?: string }) {
      const label = task.company ? `${task.company} (${task.url})` : task.url;
      try {
        const fetchResult = await fetchPolicy(task.url);
        if (!fetchResult.success) throw new Error(fetchResult.error);

        const extractResult = await extract(fetchResult.text, task.company, task.url);
        if (!extractResult.success) throw new Error(extractResult.error);

        const gradeResult = score(extractResult.data, rubric);
        const slug = (task.company ?? task.url)
          .toLowerCase()
          .replace(/https?:\/\//, "")
          .replace(/[^a-z0-9]+/g, "-")
          .replace(/^-|-$/g, "");

        writeFileSync(
          pathJoin(outDir, `${slug}.json`),
          JSON.stringify({ extraction: extractResult.data, grade: gradeResult }, null, 2)
        );

        done++;
        const gradeColor = gradeResult.letter === "A" ? chalk.green : gradeResult.letter === "B" ? chalk.yellow : chalk.red;
        console.error(`  ${gradeColor(`[${gradeResult.letter}]`)} ${chalk.bold(gradeResult.score + "/100")}  ${label}  ${chalk.dim(`(${done}/${tasks.length})`)}`);
        results.push({ url: task.url, company: task.company, status: "ok", grade: gradeResult.letter, score: gradeResult.score });
      } catch (err) {
        done++;
        console.error(`  ${chalk.red("[ERR]")} ${label}  ${chalk.dim((err as Error).message)}  ${chalk.dim(`(${done}/${tasks.length})`)}`);
        results.push({ url: task.url, company: task.company, status: "error", error: (err as Error).message });
      }
    }

    // Process with concurrency limit
    for (let i = 0; i < tasks.length; i += concurrency) {
      const batch = tasks.slice(i, i + concurrency);
      await Promise.all(batch.map(runOne));
      if (i + concurrency < tasks.length && delayMs > 0) {
        await new Promise((r) => setTimeout(r, delayMs));
      }
    }

    // Summary
    const ok = results.filter((r) => r.status === "ok");
    const errors = results.filter((r) => r.status === "error");
    console.error(chalk.bold(`\nDone: ${ok.length} succeeded, ${errors.length} failed`));
    if (ok.length > 0) {
      const avg = Math.round(ok.reduce((s, r) => s + (r.score ?? 0), 0) / ok.length);
      console.error(chalk.dim(`Average score: ${avg}/100`));
    }
    if (errors.length > 0) {
      console.error(chalk.red("Failed URLs:"));
      errors.forEach((r) => console.error(chalk.red(`  ${r.url}: ${r.error}`)));
    }
    writeFileSync(pathJoin(outDir, "_summary.json"), JSON.stringify(results, null, 2));
    console.error(chalk.dim(`\nResults written to ${outDir}/`));
  });

// ─── score command ────────────────────────────────────────────────────────────

program
  .command("score <json-file>")
  .description("Score an existing Privacy Facts JSON extraction")
  .action(async (filePath: string) => {
    const { readFileSync } = await import("fs");
    const { validate } = await import("../src/core/schema/privacy-facts.schema");
    const rubric = loadRubricOrThrow(rubricPath);

    let raw: unknown;
    try {
      raw = JSON.parse(readFileSync(filePath, "utf-8"));
    } catch (err) {
      console.error(chalk.red(`✗ Could not read file: ${(err as Error).message}`));
      process.exit(1);
    }

    const validation = validate(raw);
    if (!validation.success) {
      console.error(chalk.red("✗ Invalid Privacy Facts JSON:"));
      validation.issues.forEach((i) => console.error(chalk.red(`  ${i.path.join(".")}: ${i.message}`)));
      process.exit(1);
    }

    const gradeResult = score(validation.data, rubric);
    printResults(validation.data, gradeResult);
  });

// ─── validate command ─────────────────────────────────────────────────────────

program
  .command("validate <json-file>")
  .description("Validate a Privacy Facts JSON file against the schema")
  .action(async (filePath: string) => {
    const { readFileSync } = await import("fs");
    const { validate } = await import("../src/core/schema/privacy-facts.schema");

    let raw: unknown;
    try {
      raw = JSON.parse(readFileSync(filePath, "utf-8"));
    } catch (err) {
      console.error(chalk.red(`✗ Could not read file: ${(err as Error).message}`));
      process.exit(1);
    }

    const result = validate(raw);
    if (result.success) {
      console.log(chalk.green("✓ Valid Privacy Facts JSON"));
      console.log(chalk.dim(`  Company: ${result.data.metadata.companyName}`));
      console.log(chalk.dim(`  Schema version: ${result.data.metadata.schemaVersion}`));
    } else {
      console.error(chalk.red(`✗ Validation failed (${result.issues.length} issues):`));
      result.issues.forEach((i) => console.error(chalk.red(`  ${i.path.join(".")}: ${i.message}`)));
      process.exit(1);
    }
  });

// ─── Print helpers ────────────────────────────────────────────────────────────

function printResults(
  data: import("../src/core/schema/types").PrivacyFacts,
  gradeResult: import("../src/core/scoring/engine").GradeResult
) {
  const gradeColor = (letter: string) => {
    switch (letter) {
      case "A": return chalk.bgGreen.black;
      case "B": return chalk.bgYellow.black;
      case "C": return chalk.bgYellow.black;
      case "D": return chalk.bgRed.white;
      case "F": return chalk.bgRed.white;
      default: return chalk.white;
    }
  };

  console.log();
  console.log(chalk.bold("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"));
  console.log(chalk.bold("  Privacy Facts"));
  console.log(chalk.dim(`  ${data.metadata.companyName}  ·  ${data.metadata.policyUrl}`));
  console.log(chalk.bold("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"));
  console.log();

  // Grade banner
  const grade = gradeColor(gradeResult.letter)(` ${gradeResult.letter} `);
  console.log(`  Grade: ${grade} ${chalk.bold(gradeResult.label)}  (${gradeResult.score}/100)`);
  console.log();

  // Data collected
  console.log(chalk.bold("  Data Collected"));
  if (data.dataCollection.items.length === 0) {
    console.log(chalk.dim("    (none disclosed)"));
  } else {
    data.dataCollection.items.forEach((item) => {
      const flag = item.sensitive ? chalk.red("●") : chalk.dim("○");
      console.log(`    ${flag} ${item.name}${item.sensitive ? chalk.red(" (sensitive)") : ""}`);
    });
  }
  console.log();

  // Data sharing
  console.log(chalk.bold("  Data Sharing & Use"));
  printPractice("Sold to third parties", data.dataSharing.soldToThirdParties.value, true);
  printPractice("Shared for advertising", data.dataSharing.sharedForAdvertising.value);
  printPractice("Cross-site tracking", data.dataSharing.crossSiteTracking.value);
  printPractice("Used for profiling / AI decisions", data.dataSharing.usedForProfiling.value);
  printPractice("Used to train AI models", data.dataSharing.usedToTrainAI.value);
  if (data.dataSharing.thirdPartyCount !== null) {
    console.log(chalk.dim(`    Third parties: ${data.dataSharing.thirdPartyCount}`));
  }
  console.log();

  // Retention
  console.log(chalk.bold("  Data Retention"));
  if (data.retention.indefinite) {
    console.log(`    ${chalk.red("Indefinite")}`);
  } else if (data.retention.retentionDays !== null) {
    const years = (data.retention.retentionDays / 365).toFixed(1);
    console.log(`    ${data.retention.retentionDays} days (~${years} years)`);
  } else {
    console.log(chalk.dim("    Not specified"));
  }
  console.log();

  // Rights
  console.log(chalk.bold("  Consumer Rights"));
  printRight("Right to access", data.consumerRights.rightToAccess.value);
  printRight("Right to delete", data.consumerRights.rightToDelete.value);
  printRight("Right to portability", data.consumerRights.rightToPortability.value);
  printRight("Right to correct", data.consumerRights.rightToCorrect.value);
  printRight("Right to opt out", data.consumerRights.rightToOptOut.value);
  printRight("Right to non-discrimination", data.consumerRights.rightToNonDiscrimination.value);
  console.log();

  // Signals
  console.log(chalk.bold("  Privacy Signals"));
  printSignal("Honors GPC", data.signalHonoring.honorsGPC.value);
  printSignal("Honors DNT", data.signalHonoring.honorsDNT.value);
  console.log();

  // Security
  console.log(chalk.bold("  Security Measures"));
  if (data.security.measures.length === 0) {
    console.log(chalk.dim("    (none disclosed)"));
  } else {
    data.security.measures.forEach((m) => console.log(`    ${chalk.green("✓")} ${m.name}`));
  }
  console.log();

  // Score breakdown
  console.log(chalk.bold("  Score Breakdown") + chalk.dim(`  (rubric v${gradeResult.rubricVersion})`));
  gradeResult.breakdown
    .filter((b) => b.triggered)
    .forEach((b) => {
      const pts = b.points > 0 ? chalk.green(`+${b.points}`) : chalk.red(`${b.points}`);
      const detail = b.detail ? chalk.dim(` (${b.detail})`) : "";
      console.log(`    ${pts}  ${b.label}${detail}`);
    });
  console.log(chalk.dim("    ────────────────────────────────────────"));
  console.log(`    ${chalk.bold("Total:")} ${gradeResult.score}/100`);
  console.log();

  // Disclaimer
  console.log(chalk.dim("  This label summarizes privacy practices as disclosed in the company's"));
  console.log(chalk.dim("  privacy policy. The grade is Privacy Facts' opinion based on our"));
  console.log(chalk.dim(`  published rubric (v${gradeResult.rubricVersion}). This is not legal advice.`));
  console.log();
}

function printPractice(label: string, value: boolean, critical = false) {
  const badge = value
    ? critical ? chalk.bgRed.white(" YES ") : chalk.bgBlack.white(" YES ")
    : chalk.dim(" no  ");
  console.log(`    ${badge}  ${label}`);
}

function printRight(label: string, value: boolean) {
  const check = value ? chalk.green("✓") : chalk.dim("✗");
  console.log(`    ${check}  ${label}`);
}

function printSignal(label: string, honored: boolean) {
  const badge = honored ? chalk.green("honored") : chalk.red("NOT honored");
  console.log(`    ${badge}  ${label}`);
}

program.parse();
