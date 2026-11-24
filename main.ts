// Out of Office: The Overworked AI's Auto-Reply
// Entry point: reads the single auto-reply line from reply.txt (kept beside
// this file), validates it against the bounty gate, and writes it to the
// absolute /output/entry.txt path the grader reads.
//
// The gate (sealed scorer): /output/entry.txt must be UTF-8 text of 1-159
// characters, not only whitespace. One line, one auto-reply, no more.
// Counting is by Unicode code points, so an em dash counts as one
// character, exactly as the gate counts it. Every check below names the
// clause it enforces, so a failure says which part of the gate broke.
import { readFileSync, mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const MAX_CHARS = 159;
const MIN_CHARS = 1;
const ENTRY_PATH = "/output/entry.txt";
const REPLY_FILE = "reply.txt";

// Fatal UTF-8 decoding: readFileSync("utf8") would silently replace bad
// bytes with U+FFFD, so decode strictly and fail loudly on anything that
// is not valid UTF-8. The gate requires UTF-8 text, and a replacement
// character would hide a broken file.
const utf8 = new TextDecoder("utf-8", { fatal: true });

function countChars(text: string): number {
  return [...text].length;
}

function countBytes(text: string): number {
  return Buffer.byteLength(text, "utf8");
}

function loadReplyLine(): string {
  const here = dirname(fileURLToPath(import.meta.url));
  const bytes = readFileSync(join(here, REPLY_FILE));
  const raw = utf8.decode(bytes);
  // Exactly one non-empty line: anything else is not a single auto-reply.
  const lines = raw.split("\n").filter((l) => l.trim().length > 0);
  if (lines.length !== 1) {
    throw new Error(
      `${REPLY_FILE} must hold exactly one non-empty line, got ${lines.length}`,
    );
  }
  return lines[0].trim();
}

function validateReply(line: string): void {
  // Gate clause 1: not only whitespace.
  if (line.trim().length === 0) {
    throw new Error("gate: auto-reply must not be only whitespace");
  }
  // Gate clause 2: a single line of plain text — no control characters
  // smuggled in (a tab or newline would break the one-line shape).
  if (/\p{Cc}/u.test(line)) {
    throw new Error("gate: auto-reply must not contain control characters");
  }
  // Gate clause 3: 1-159 characters, counted by code point.
  const chars = countChars(line);
  if (chars < MIN_CHARS || chars > MAX_CHARS) {
    throw new Error(
      `gate: auto-reply must be ${MIN_CHARS}-${MAX_CHARS} chars, got ${chars}`,
    );
  }
}

function writeEntry(line: string): void {
  mkdirSync("/output", { recursive: true });
  writeFileSync(ENTRY_PATH, line + "\n", "utf8");
}

// Read back what was written and confirm it round-trips within the gate:
// same line, same length, still valid UTF-8, still one line.
function verifyEntry(line: string): void {
  const back = utf8.decode(readFileSync(ENTRY_PATH)).trim();
  if (back !== line) {
    throw new Error(
      `read-back mismatch: ${ENTRY_PATH} does not hold the auto-reply line`,
    );
  }
  const chars = countChars(back);
  if (chars < MIN_CHARS || chars > MAX_CHARS) {
    throw new Error(
      `gate: entry exceeds ${MAX_CHARS} chars after write, got ${chars}`,
    );
  }
  if (back.includes("\n")) {
    throw new Error("gate: entry must be a single line");
  }
}

function main(): void {
  const line = loadReplyLine();
  validateReply(line);
  writeEntry(line);
  verifyEntry(line);
  console.log(
    `wrote ${countChars(line)} chars (${countBytes(line)} bytes) to ${ENTRY_PATH}`,
  );
}

main();
