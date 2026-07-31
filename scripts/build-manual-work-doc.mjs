#!/usr/bin/env node
/**
 * Generate `docs/MANUAL_WORK_KR.doc` from section 10 of `docs/SETUP_GUIDE_KR.doc`.
 *
 * This is a derived artefact: it extracts the checklist section, wraps it in a
 * standalone Word-openable HTML shell, and writes the result. The `--check` flag
 * compares the on-disk file against what the generator would produce and exits
 * non-zero if they differ, so `pnpm docs:check` can gate drift.
 *
 * Why a generator and not a second hand-maintained file: Phase 3 decision D18
 * says one Korean document because a second would drift, and that reasoning is
 * still right. This script turns the second file into a derived view of the
 * first, with a freshness gate that makes drift impossible.
 */

import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), "..");
const SOURCE_PATH = join(repoRoot, "docs/SETUP_GUIDE_KR.doc");
const OUTPUT_PATH = join(repoRoot, "docs/MANUAL_WORK_KR.doc");

const CHECK_MODE = process.argv.includes("--check");

const source = readFileSync(SOURCE_PATH, "utf8");

// Extract the <h2>10. ... </h2> section up to the next <h2>
const startMarker = "<h2>10.";
const startIdx = source.indexOf(startMarker);
if (startIdx === -1) {
  console.error("ERROR: cannot find section 10 in docs/SETUP_GUIDE_KR.doc");
  process.exit(1);
}

// Find the next <h2> after the start of section 10
const afterStart = source.indexOf("</h2>", startIdx) + 5;
const nextH2 = source.indexOf("<h2>", afterStart);
const sectionContent = nextH2 === -1
  ? source.slice(startIdx)
  : source.slice(startIdx, nextH2);

// Extract the style block from the source
const styleStart = source.indexOf("<style>");
const styleEnd = source.indexOf("</style>") + 8;
const styleBlock = styleStart !== -1 ? source.slice(styleStart, styleEnd) : "";

const output = `<html>
<head>
<meta charset="utf-8">
<title>WorldNest Online - 직접 해야 하는 작업 목록</title>
${styleBlock}
</head>
<body>

<h1>WorldNest Online - 직접 해야 하는 작업 목록</h1>

<blockquote>
이 문서는 <code>docs/SETUP_GUIDE_KR.doc</code>의 10번 섹션에서 자동 생성됩니다.
전체 설정 가이드는 <code>docs/SETUP_GUIDE_KR.doc</code> 또는 <code>docs/SETUP_GUIDE_KR.md</code>를 참조하세요.
<br><br>
생성 명령: <code>node scripts/build-manual-work-doc.mjs</code>
</blockquote>

${sectionContent}

</body>
</html>
`;

if (CHECK_MODE) {
  let existing = "";
  try {
    existing = readFileSync(OUTPUT_PATH, "utf8");
  } catch {
    console.error("docs/MANUAL_WORK_KR.doc does not exist. Run: node scripts/build-manual-work-doc.mjs");
    process.exit(1);
  }

  if (existing !== output) {
    console.error("docs/MANUAL_WORK_KR.doc is out of date. Regenerate with: node scripts/build-manual-work-doc.mjs");
    process.exit(1);
  }
  console.log("docs/MANUAL_WORK_KR.doc is up to date.");
  process.exit(0);
}

writeFileSync(OUTPUT_PATH, output, "utf8");
console.log("Generated docs/MANUAL_WORK_KR.doc");
