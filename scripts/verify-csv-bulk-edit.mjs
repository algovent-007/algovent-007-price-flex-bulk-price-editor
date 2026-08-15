import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  CSV_BULK_EDIT_MAX_ROWS,
  parseCsvAllRows,
  parseCsvDirectRows,
  validateCsvRowsForRun,
} from "../app/utils/csv-bulk-edit.js";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

function runStep(label, command, args) {
  process.stdout.write(`${label}... `);
  const result = spawnSync(command, args, { stdio: "pipe", encoding: "utf8" });
  if (result.status !== 0) {
    process.stdout.write("failed\n");
    if (result.stdout) process.stdout.write(result.stdout);
    if (result.stderr) process.stderr.write(result.stderr);
    process.exit(result.status ?? 1);
  }
  process.stdout.write("ok\n");
}

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

function verifyModuleContracts() {
  process.stdout.write("Checking CSV module exports... ");
  assert(typeof parseCsvAllRows === "function", "parseCsvAllRows missing");
  assert(typeof parseCsvDirectRows === "function", "parseCsvDirectRows missing");
  assert(typeof validateCsvRowsForRun === "function", "validateCsvRowsForRun missing");
  assert(CSV_BULK_EDIT_MAX_ROWS === 2000, "Unexpected CSV row limit");
  process.stdout.write("ok\n");
}

function verifySkuBatchingUsesOrQueries() {
  process.stdout.write("Checking batched SKU lookup implementation... ");
  const source = fs.readFileSync(
    path.join(repoRoot, "app/services/csv-bulk-edit.server.js"),
    "utf8",
  );
  assert(source.includes('join(" OR ")'), "Expected batched SKU OR queries");
  assert(source.includes("SKU_LOOKUP_BATCH_SIZE"), "Expected SKU batch size constant");
  process.stdout.write("ok\n");
}

function printStagingQaChecklist() {
  console.log("\nStaging manual QA checklist:");
  console.log("1. Re-authorize the app after scope deploy if Shopify prompts for updated permissions.");
  console.log("2. csv-all: upload variant list, load products, preview pricing rules, run task.");
  console.log("3. csv-direct: upload price CSV, confirm step 2 rules are ignored, run task.");
  console.log("4. Use SKU-only rows and variant ID rows; confirm warnings for missing variants.");
  console.log("5. Copy a completed CSV task and confirm products reload automatically.");
  console.log("6. Confirm progress card shows variant counts and warning banner after partial matches.");
  console.log("7. Roll back a CSV task and confirm prices restore from logs.");
}

runStep("CSV unit tests", "node", ["app/utils/csv-bulk-edit.test.js"]);
verifyModuleContracts();
verifySkuBatchingUsesOrQueries();
printStagingQaChecklist();
console.log("\nCSV bulk edit verification passed.");
