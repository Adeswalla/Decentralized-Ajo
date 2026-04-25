#!/usr/bin/env node
// check-limit-sync.mjs
// Asserts that the operational limits in lib/validations/circle.ts exactly match
// the pub const declarations in contracts/ajo-circle/src/lib.rs.
// Exit code 1 = mismatch (build fails). Exit code 0 = all good.

import { readFileSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, "..");

// Path verification: Print current working directory and resolved paths
console.log(`Current working directory: ${process.cwd()}`);
const rustPath = resolve(process.cwd(), "contracts/ajo-circle/src/lib.rs");
const tsPath = resolve(process.cwd(), "lib/validations/circle.ts");
console.log(`Resolved lib.rs path: ${rustPath}`);
console.log(`Resolved circle.ts path: ${tsPath}`);

// ---------------------------------------------------------------------------
// 1. Parse Rust constants from lib.rs
// ---------------------------------------------------------------------------
const rustSrc = readFileSync(rustPath, "utf8").trim();

// Handle different line endings (Windows \r\n vs Unix \n)
const normalizedRustSrc = rustSrc.replace(/\r\n/g, '\n');

/** Extract `pub const NAME: type = value;` entries into a plain object.
 *  Handles:
 *  - Explicit type annotations:  pub const FOO: u32 = 1;
 *  - Numeric separators:         pub const FOO: i128 = 10_000_000;
 *  - Trailing inline comments:   pub const FOO: i128 = 10_000_000; // note
 *  - Robust regex that ignores varying whitespace and handles different Rust types
 */
function parseRustConsts(src) {
  // Use requested pattern: pub\s+const\s+([A-Z_]+):\s*[ui]\d+\s*=\s*(\d+);
  const re = /pub\s+const\s+([A-Z_]+):\s*[ui]\d+\s*=\s*(\d+);/g;
  const consts = {};
  const lines = src.split('\n');
  
  for (const [match, name, raw] of src.matchAll(re)) {
    consts[name] = BigInt(raw.replace(/_/g, ""));
  }
  
  return consts;
}

// ---------------------------------------------------------------------------
// 2. Parse TypeScript constants from circle.ts
// ---------------------------------------------------------------------------
const tsSrc = readFileSync(tsPath, "utf8").trim();

// Handle different line endings (Windows \r\n vs Unix \n)
const normalizedTsSrc = tsSrc.replace(/\r\n/g, '\n');

/** Extract `export const NAME = value;` entries into a plain object.
 *  Handles numeric separators (10_000_000) and optional trailing comments.
 */
function parseTsConsts(src) {
  const re = /export\s+const\s+([A-Z_][A-Z0-9_]*)\s*=\s*([\d_]+)\s*;/g;
  const consts = {};
  for (const [, name, raw] of src.matchAll(re)) {
    consts[name] = BigInt(raw.replace(/_/g, ""));
  }
  return consts;
}

// ---------------------------------------------------------------------------
// 3. Assert LIMIT_SYNC_TAG versions match
// ---------------------------------------------------------------------------
function extractTag(src) {
  const m = src.match(/LIMIT_SYNC_TAG:\s*(v[\d.]+)/);
  return m ? m[1] : null;
}

const rustTag = extractTag(normalizedRustSrc);
const tsTag = extractTag(normalizedTsSrc);

let failed = false;

if (rustTag !== tsTag) {
  console.error(
    `\n❌  LIMIT_SYNC_TAG mismatch:\n   lib.rs  → ${rustTag}\n   circle.ts → ${tsTag}\n`
  );
  failed = true;
}

// ---------------------------------------------------------------------------
// 4. Compare each constant
// ---------------------------------------------------------------------------
const TRACKED = [
  "MAX_MEMBERS",
  "MIN_CONTRIBUTION_AMOUNT",
  "MAX_CONTRIBUTION_AMOUNT",
  "MIN_FREQUENCY_DAYS",
  "MAX_FREQUENCY_DAYS",
  "MIN_ROUNDS",
  "MAX_ROUNDS",
  "WITHDRAWAL_PENALTY_PERCENT",
];

const rustConsts = parseRustConsts(normalizedRustSrc);
const tsConsts = parseTsConsts(normalizedTsSrc);

// Helper function to find line number of a constant
function findLineNumber(src, constName) {
  const lines = src.split('\n');
  for (let i = 0; i < lines.length; i++) {
    if (lines[i].includes(constName)) {
      return i + 1; // 1-based line numbers
    }
  }
  return null;
}

// Helper function to find nearest match
function findNearestMatch(src, constName) {
  const lines = src.split('\n');
  const candidates = [];
  
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (line.includes('const') && line.includes(':')) {
      // Extract constant name from line
      const match = line.match(/const\s+([A-Z_][A-Z0-9_]*):/);
      if (match) {
        const foundName = match[1];
        const distance = levenshteinDistance(constName, foundName);
        candidates.push({ name: foundName, line: i + 1, distance });
      }
    }
  }
  
  candidates.sort((a, b) => a.distance - b.distance);
  return candidates.slice(0, 3); // Return top 3 closest matches
}

// Simple Levenshtein distance for string similarity
function levenshteinDistance(a, b) {
  const matrix = [];
  for (let i = 0; i <= b.length; i++) {
    matrix[i] = [i];
  }
  for (let j = 0; j <= a.length; j++) {
    matrix[0][j] = j;
  }
  for (let i = 1; i <= b.length; i++) {
    for (let j = 1; j <= a.length; j++) {
      if (b.charAt(i - 1) === a.charAt(j - 1)) {
        matrix[i][j] = matrix[i - 1][j - 1];
      } else {
        matrix[i][j] = Math.min(
          matrix[i - 1][j - 1] + 1,
          matrix[i][j - 1] + 1,
          matrix[i - 1][j] + 1
        );
      }
    }
  }
  return matrix[b.length][a.length];
}

for (const name of TRACKED) {
  const rustVal = rustConsts[name];
  const tsVal = tsConsts[name];

  if (rustVal === undefined) {
    const nearest = findNearestMatch(normalizedRustSrc, name);
    console.error(`❌  '${name}' not found in lib.rs`);
    if (nearest.length > 0) {
      console.error(`    Nearest matches: ${nearest.map(n => `${n.name} (line ${n.line})`).join(', ')}`);
    }
    failed = true;
    continue;
  }
  if (tsVal === undefined) {
    const nearest = findNearestMatch(normalizedTsSrc, name);
    console.error(`❌  '${name}' not found in lib/validations/circle.ts`);
    if (nearest.length > 0) {
      console.error(`    Nearest matches: ${nearest.map(n => `${n.name} (line ${n.line})`).join(', ')}`);
    }
    failed = true;
    continue;
  }
  if (rustVal !== tsVal) {
    const rustLine = findLineNumber(normalizedRustSrc, name);
    const tsLine = findLineNumber(normalizedTsSrc, name);
    console.error(
      `❌  '${name}' mismatch: lib.rs=${rustVal} (line ${rustLine})  circle.ts=${tsVal} (line ${tsLine})`
    );
    failed = true;
  } else {
    console.log(`✅  ${name} = ${rustVal}`);
  }
}

if (failed) {
  console.error(
    "\nSync check failed. Update lib/validations/circle.ts to match contracts/ajo-circle/src/lib.rs and bump LIMIT_SYNC_TAG in both files.\n"
  );
  process.exit(1);
} else {
  console.log("\nAll limits are in sync.\n");
}
