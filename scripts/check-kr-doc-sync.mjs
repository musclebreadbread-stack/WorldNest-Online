#!/usr/bin/env node
/**
 * Assert `docs/SETUP_GUIDE_KR.md` and its Word-openable mirror
 * `docs/SETUP_GUIDE_KR.doc` still describe the same document.
 *
 * The Korean guide is deliberately one document, not two: it is the single entry
 * point for every step a maintainer has to perform by hand. The `.doc` exists
 * only because a non-developer reader wants to open it in Word, so it is a
 * mirror, and a mirror that nobody checks drifts — which is exactly what
 * happened once already, when a `### 언어 설정` heading landed in the `.md` alone.
 *
 * Headings are what this compares. They are the cheapest complete summary of a
 * document's structure: a section added, removed, renamed or moved shows up
 * here, and no reasonable edit to one file leaves them matching by accident.
 * Prose wording is deliberately *not* compared — the two files legitimately
 * differ in markup, and comparing bodies would make the check unusable.
 *
 * Run with `pnpm docs:check`. Exits 0 when the pair agrees, 1 with the first
 * mismatch when it does not.
 */

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), "..");
const MARKDOWN_PATH = join(repoRoot, "docs/SETUP_GUIDE_KR.md");
const WORD_PATH = join(repoRoot, "docs/SETUP_GUIDE_KR.doc");

/** HTML entities the Word mirror actually uses. */
const ENTITIES = {
  "&amp;": "&",
  "&lt;": "<",
  "&gt;": ">",
  "&quot;": '"',
  "&#39;": "'",
  "&nbsp;": " ",
};

/**
 * Reduce a heading to the text a reader sees, so the two markup languages can be
 * compared: markdown links, inline code and bold on one side, HTML tags and
 * entities on the other, then whitespace.
 */
function normalise(raw) {
  let text = raw;
  // <strong>, <code>, <em>, ... — the mirror wraps heading words in these
  text = text.replace(/<[^>]+>/g, "");
  for (const [entity, char] of Object.entries(ENTITIES)) {
    text = text.split(entity).join(char);
  }
  // [label](href) -> label
  text = text.replace(/\[([^\]]+)\]\([^)]*\)/g, "$1");
  text = text.replace(/[`*_]/g, "");
  return text.replace(/\s+/g, " ").trim();
}

/** Every `##` / `###` heading of the markdown source, in document order. */
function markdownHeadings(source) {
  const headings = [];
  let inFence = false;

  for (const line of source.split("\n")) {
    if (line.startsWith("```")) {
      inFence = !inFence;
      continue;
    }
    if (inFence) continue;

    const match = /^(#{2,3})\s+(.*\S)\s*$/.exec(line);
    if (match) {
      headings.push({ level: match[1].length, text: normalise(match[2]) });
    }
  }

  return headings;
}

/** Every `<h2>` / `<h3>` heading of the Word mirror, in document order. */
function wordHeadings(source) {
  const headings = [];
  const pattern = /<h([23])[^>]*>([\s\S]*?)<\/h\1>/g;
  let match;

  while ((match = pattern.exec(source)) !== null) {
    headings.push({ level: Number(match[1]), text: normalise(match[2]) });
  }

  return headings;
}

function describe({ level, text }) {
  return `${"#".repeat(level)} ${text}`;
}

function fail(message) {
  console.error(`docs:check FAILED — ${message}`);
  console.error(
    "\nBoth files are hand-maintained. Apply the same headings, in the same " +
      "order,\nto docs/SETUP_GUIDE_KR.md and docs/SETUP_GUIDE_KR.doc.",
  );
  process.exit(1);
}

const markdown = markdownHeadings(readFileSync(MARKDOWN_PATH, "utf8"));
const word = wordHeadings(readFileSync(WORD_PATH, "utf8"));

if (markdown.length === 0) {
  fail("docs/SETUP_GUIDE_KR.md has no ## or ### headings at all");
}

// Report the first divergence rather than a diff: with the headings in order,
// the first mismatch is always the edit that was not mirrored.
for (let index = 0; index < Math.max(markdown.length, word.length); index++) {
  const fromMarkdown = markdown[index];
  const fromWord = word[index];

  if (!fromWord) {
    const only = describe(fromMarkdown);
    fail(`heading ${index + 1} is missing from the .doc mirror:\n  .md  ${only}`);
  }
  if (!fromMarkdown) {
    const only = describe(fromWord);
    fail(`heading ${index + 1} exists only in the .doc mirror:\n  .doc ${only}`);
  }
  if (fromMarkdown.level !== fromWord.level || fromMarkdown.text !== fromWord.text) {
    fail(
      `heading ${index + 1} differs:\n` +
        `  .md  ${describe(fromMarkdown)}\n` +
        `  .doc ${describe(fromWord)}`,
    );
  }
}

console.log(
  `docs:check OK — ${markdown.length} headings match between ` +
    "docs/SETUP_GUIDE_KR.md and docs/SETUP_GUIDE_KR.doc",
);
