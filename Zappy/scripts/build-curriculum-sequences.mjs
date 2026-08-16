import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, "..");
const source = JSON.parse(
  await readFile(resolve(root, "app/curriculum.generated.json"), "utf8"),
);
const outputDirectory = resolve(root, "public/curriculum-sequences");

const slugs = {
  CBSE: "cbse",
  "Karnataka State Board": "karnataka-state-board",
  "Kerala State Board": "kerala-state-board",
  "Tamil Nadu State Board": "tamil-nadu-state-board",
  "Telangana State Board": "telangana-state-board",
};

await mkdir(outputDirectory, { recursive: true });

for (const [board, slug] of Object.entries(slugs)) {
  const books = source.records
    .filter((record) => record.board === board && record.chapters?.length)
    .map((record) => ({
      id: record.identifier,
      board: record.board,
      grades: record.grades,
      subjects: record.subjects,
      name: record.book,
      mediums: record.mediums,
      edition: record.edition,
      source: record.source,
      chapters: record.chapters
        .slice()
        .sort((a, b) => a.order - b.order)
        .map((chapter) => chapter.title),
    }));

  await writeFile(
    resolve(outputDirectory, `${slug}.json`),
    JSON.stringify({ generatedAt: source.generatedAt, board, books }),
  );
}
