import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import {
  FORCE_AND_PRESSURE_OFFICIAL_LEARNING_OUTCOMES,
  FORCE_AND_PRESSURE_OFFICIAL_QUESTION_BANK,
  FORCE_AND_PRESSURE_SOURCE_INTEGRITY,
  KARNATAKA_CLASS_8_SCIENCE_2026_27_NOTICE,
  KARNATAKA_CLASS_8_SCIENCE_LEGACY_DIKSHA_BOOK,
  KARNATAKA_CLASS_8_SCIENCE_SOURCE,
  KARNATAKA_CLASS_8_SCIENCE_UNITS,
} from "../app/karnataka-class8-science.ts";

test("Karnataka Class 8 Science uses the dated official 13-unit DSERT sequence", () => {
  assert.equal(KARNATAKA_CLASS_8_SCIENCE_SOURCE.academicYear, "2025-26");
  assert.equal(KARNATAKA_CLASS_8_SCIENCE_UNITS.length, 13);
  assert.equal(KARNATAKA_CLASS_8_SCIENCE_UNITS[0].title, "Crop Production and Management");
  assert.equal(KARNATAKA_CLASS_8_SCIENCE_UNITS[4].title, "Force and Pressure");
  assert.equal(KARNATAKA_CLASS_8_SCIENCE_UNITS.at(-1).title, "Light");
  assert.equal(KARNATAKA_CLASS_8_SCIENCE_2026_27_NOTICE.verificationStatus, "pending");
  assert.equal(KARNATAKA_CLASS_8_SCIENCE_LEGACY_DIKSHA_BOOK.currentSyllabusVerified, false);
});

test("Force and Pressure data is source-cited practice evidence, never fake past-paper evidence", () => {
  assert.equal(FORCE_AND_PRESSURE_OFFICIAL_LEARNING_OUTCOMES.length, 12);
  assert.equal(FORCE_AND_PRESSURE_OFFICIAL_QUESTION_BANK.length, 30);
  assert.ok(FORCE_AND_PRESSURE_OFFICIAL_QUESTION_BANK.every(question =>
    question.evidenceKind === "official-practice-question-bank" &&
    question.isPreviousYearQuestion === false &&
    question.sourcePdfPages.length > 0 &&
    question.marks >= 1 &&
    question.marks <= 4
  ));
  assert.equal(new Set(FORCE_AND_PRESSURE_OFFICIAL_QUESTION_BANK.map(question => question.id)).size, 30);
  assert.equal(FORCE_AND_PRESSURE_OFFICIAL_QUESTION_BANK.some(question => question.sourceNumber === 9), false);
  assert.deepEqual(FORCE_AND_PRESSURE_SOURCE_INTEGRITY.missingSourceNumbers, [9]);
  assert.equal(FORCE_AND_PRESSURE_SOURCE_INTEGRITY.verifiedEnumeratedItemCount, 30);
});

test("the in-app official PDF adapter is fixed to the reviewed DSERT material", async () => {
  const [route, copilot, page] = await Promise.all([
    readFile(new URL("../app/api/official-material/route.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/teacher-prep-copilot.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/page.tsx", import.meta.url), "utf8"),
  ]);
  assert.match(route, /karnataka-class8-science-lba-2025-26/);
  assert.match(route, /dsert\.karnataka\.gov\.in\/storage\/pdf-files\/lba\/8thLBAScienceEM1\.pdf/);
  assert.doesNotMatch(route, /searchParams\.get\("url"\)/);
  assert.match(route, /"content-disposition": "inline"/);
  assert.match(copilot, /READ IN ZAPPY/);
  assert.match(copilot, /These are not previous-year appearances/);
  assert.match(copilot, /0 verified past-paper years/);
  assert.match(page, /official:dsert:karnataka:class8:science:2025-26/);
  assert.match(page, /2026-27 verification pending/);
});
