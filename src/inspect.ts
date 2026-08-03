#!/usr/bin/env node
import fs from "node:fs/promises";
import path from "node:path";
import { createContainer } from "./services/container.js";
import { LocalIdentityStore } from "./stores/local-store.js";

function usage(): never {
  console.error(`Usage: pnpm inspect [options]

Inspect a SemFS identity repository and emit identity_inspection_report.v1.

Options:
  --identity <id>          Identity id label (default: SEMFS_DEFAULT_IDENTITY_ID or solo-identity-seed)
  --root <path>            Local identity root to inspect (default: SEMFS_IDENTITY_PATH or templates/seed)
  --format <json|markdown|both>
                           Output format (default: both)
  --out <path>             Write machine-readable JSON report to this path
  --out-md <path>          Write human-readable markdown report to this path
  --eval-index <path>      Optional runtime eval result index path
  --quiet                  Print only summary line to stdout when writing files
`);
  process.exit(2);
}

function argValue(args: string[], name: string): string | undefined {
  const index = args.indexOf(name);
  if (index < 0) return undefined;
  return args[index + 1];
}

function hasFlag(args: string[], name: string): boolean {
  return args.includes(name);
}

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  if (hasFlag(args, "--help") || hasFlag(args, "-h")) usage();

  const identityId = argValue(args, "--identity") ?? process.env.SEMFS_DEFAULT_IDENTITY_ID ?? "solo-identity-seed";
  const root =
    argValue(args, "--root") ??
    process.env.SEMFS_IDENTITY_PATH ??
    path.resolve(process.cwd(), "templates/seed");
  const format = (argValue(args, "--format") ?? "both") as "json" | "markdown" | "both";
  const out = argValue(args, "--out");
  const outMd = argValue(args, "--out-md");
  const evalIndex = argValue(args, "--eval-index");
  const quiet = hasFlag(args, "--quiet");

  if (!["json", "markdown", "both"].includes(format)) usage();

  // Ensure container env is coherent for any shared config reads.
  process.env.SEMFS_DEFAULT_IDENTITY_ID ??= identityId;
  process.env.SEMFS_IDENTITY_BACKEND ??= "local";
  process.env.SEMFS_IDENTITY_PATH ??= root;
  process.env.SEMFS_AUTH_TOKEN ??= "inspect-local-token";

  const container = createContainer();
  const mount = {
    identityId,
    store: new LocalIdentityStore(path.resolve(root)),
  };
  const report = await container.inspection.inspect(mount, {
    include_human_markdown: true,
    eval_results_root: evalIndex,
  });

  if (out) {
    await fs.mkdir(path.dirname(path.resolve(out)), { recursive: true });
    const { human_report_markdown: _md, ...machine } = report;
    await fs.writeFile(out, `${JSON.stringify(machine, null, 2)}\n`, "utf8");
  }
  if (outMd) {
    await fs.mkdir(path.dirname(path.resolve(outMd)), { recursive: true });
    await fs.writeFile(outMd, `${report.human_report_markdown ?? container.inspection.toMarkdown(report)}\n`, "utf8");
  }

  if (!quiet || (!out && !outMd)) {
    if (format === "json" || format === "both") {
      const { human_report_markdown: _md, ...machine } = report;
      console.log(JSON.stringify(machine, null, 2));
    }
    if (format === "markdown" || (format === "both" && !out && !outMd)) {
      if (format === "both") console.log("\n---\n");
      console.log(report.human_report_markdown ?? container.inspection.toMarkdown(report));
    }
  } else {
    console.log(
      `${report.overall_status}: ${report.counts.error} error(s), ${report.counts.warning} warning(s), ${report.counts.info} info`
    );
  }

  if (report.overall_status === "violations") process.exitCode = 1;
}

main().catch((error) => {
  console.error(error instanceof Error ? error.stack ?? error.message : error);
  process.exit(1);
});
