export type ZappySourceKind = "pdf" | "video" | "audio" | "image";

export type ZappySourceRights = {
  license: string;
  originalPlaybackAllowed: boolean;
  adaptationAllowed: boolean;
  commercialClearanceRequired: boolean;
};

export type ZappySourceResource = {
  id: string;
  title: string;
  kind: ZappySourceKind;
  mimeType: string;
  category: string;
  creator: string;
  copyright: string;
  copyrightYear: string;
  attributions: string[];
  organisation: string[];
  language: string[];
  lastUpdatedOn: string;
  versionKey: string;
  rights: ZappySourceRights;
};

export type ZappySourceChapter = {
  id: string;
  order: number;
  title: string;
  rawTitle: string;
  resources: ZappySourceResource[];
};

export type ZappySourceBook = {
  version: 1;
  bookId: string;
  title: string;
  board: string[];
  gradeLevel: string[];
  subject: string[];
  medium: string[];
  status: string;
  edition: string;
  authority: string;
  generatedAt: string;
  chapters: ZappySourceChapter[];
  playableResourceCount: number;
};

export const ZAPPY_QUEST_STAGES = [
  { id: "spark", label: "Spark", icon: "✨" },
  { id: "learn", label: "Learn", icon: "📚" },
  { id: "play", label: "Play", icon: "🕹️" },
  { id: "use", label: "Use it", icon: "🚀" },
  { id: "reflect", label: "Reflect", icon: "⭐" },
] as const;

export type ZappyQuestStage = (typeof ZAPPY_QUEST_STAGES)[number]["id"];

export function isExactDikshaBookId(value: string) {
  return /^do_\d{8,}$/.test(value);
}

export function normaliseSourceTitle(value: string) {
  return value
    .toLocaleLowerCase("en-IN")
    .replace(/^\s*(chapter|unit|lesson)?\s*\d+[\s.:\-–—)]*/i, "")
    .replace(/[–—&]/g, " ")
    .replace(/[^\p{L}\p{N}\s]/gu, "")
    .replace(/\s+/g, " ")
    .trim();
}

export function findZappySourceChapter(
  book: ZappySourceBook,
  chapterTitle: string,
) {
  const exact = normaliseSourceTitle(chapterTitle);
  return book.chapters.find(
    (chapter) => normaliseSourceTitle(chapter.title) === exact,
  );
}

const sourceBookCache = new Map<string, Promise<ZappySourceBook>>();

export async function loadZappySourceBook(
  bookId: string,
  signal?: AbortSignal,
) {
  if (!isExactDikshaBookId(bookId)) {
    throw new Error("This curriculum path does not have an exact DIKSHA book ID.");
  }
  if (!sourceBookCache.has(bookId)) {
    sourceBookCache.set(
      bookId,
      fetch(`/api/diksha/book?bookId=${encodeURIComponent(bookId)}`)
        .then(async (response) => {
          const payload = (await response.json()) as
            | ZappySourceBook
            | { error?: string };
          if (!response.ok || !("chapters" in payload)) {
            throw new Error(
              "error" in payload && payload.error
                ? payload.error
                : "The official source could not be prepared inside Zappy.",
            );
          }
          return payload;
        })
        .catch((error) => {
          sourceBookCache.delete(bookId);
          throw error;
        }),
    );
  }
  if (!signal) return sourceBookCache.get(bookId)!;
  return Promise.race([
    sourceBookCache.get(bookId)!,
    new Promise<never>((_, reject) => {
      if (signal.aborted) {
        reject(new DOMException("Aborted", "AbortError"));
        return;
      }
      signal.addEventListener(
        "abort",
        () => reject(new DOMException("Aborted", "AbortError")),
        { once: true },
      );
    }),
  ]);
}

export function zappyMediaUrl(resourceId: string) {
  return `/api/diksha/media?resourceId=${encodeURIComponent(resourceId)}`;
}

export function questProgressStorageKey(input: {
  role: string;
  actorId: string;
  tenant: string;
  bookId: string;
  chapterId: string;
}) {
  return [
    "zappy:lesson-quest:v1",
    input.role,
    encodeURIComponent(input.actorId),
    encodeURIComponent(input.tenant),
    input.bookId,
    input.chapterId,
  ].join(":");
}

export function sourceKindIcon(kind: ZappySourceKind) {
  return {
    pdf: "📖",
    video: "▶️",
    audio: "🎧",
    image: "🖼️",
  }[kind];
}
