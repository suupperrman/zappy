type JsonRecord = Record<string, unknown>;

const DEFAULT_DIKSHA_API = "https://diksha.gov.in/api";
const REQUEST_TIMEOUT_MS = 15_000;

function record(value: unknown): JsonRecord {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as JsonRecord)
    : {};
}

function text(value: unknown) {
  if (typeof value === "string") return value.trim();
  if (typeof value === "number") return String(value);
  return "";
}

function list(value: unknown) {
  if (Array.isArray(value)) return value.map(text).filter(Boolean);
  const one = text(value);
  return one ? [one] : [];
}

function children(node: JsonRecord) {
  return Array.isArray(node.children)
    ? node.children.map(record)
    : [];
}

function cleanChapter(value: string) {
  return value
    .replace(/^\s*(chapter|unit|lesson)?\s*\d+[\s.:\-–—)]*/i, "")
    .replace(/\s+/g, " ")
    .trim();
}

function sourceKind(mimeType: string) {
  if (mimeType === "application/pdf") return "pdf";
  if (mimeType.startsWith("video/")) return "video";
  if (mimeType.startsWith("audio/")) return "audio";
  if (mimeType.startsWith("image/")) return "image";
  return null;
}

function isAllowedObjectUrl(value: string) {
  try {
    const url = new URL(value);
    return url.protocol === "https:" && url.hostname === "obj.diksha.gov.in";
  } catch {
    return false;
  }
}

function rightsFor(license: string) {
  const normalized = license.toUpperCase().replace(/\s+/g, " ").trim();
  const isCreativeCommons =
    /^CC (BY|BY-SA|BY-NC|BY-NC-SA|BY-ND|BY-NC-ND)( \d\.\d)?$/.test(
      normalized,
    ) || /^CC0( \d\.\d)?$/.test(normalized);
  return {
    license: license || "Licence not supplied",
    originalPlaybackAllowed: isCreativeCommons,
    adaptationAllowed: isCreativeCommons && !normalized.includes("-ND"),
    commercialClearanceRequired: normalized.includes("-NC"),
  };
}

function collectResources(node: JsonRecord) {
  const found: JsonRecord[] = [];
  const visit = (item: JsonRecord) => {
    const nested = children(item);
    if (nested.length) {
      nested.forEach(visit);
      return;
    }
    const mimeType = text(item.mimeType);
    const kind = sourceKind(mimeType);
    const artifactUrl = text(item.artifactUrl);
    const resourceId = text(item.identifier);
    const license = text(item.license);
    const rights = rightsFor(license);
    if (
      resourceId &&
      kind &&
      isAllowedObjectUrl(artifactUrl) &&
      rights.originalPlaybackAllowed &&
      (!text(item.status) || text(item.status) === "Live")
    ) {
      found.push({
        id: resourceId,
        title: text(item.name) || "Untitled official resource",
        kind,
        mimeType,
        category:
          text(item.primaryCategory) ||
          text(item.contentType) ||
          "Learning resource",
        creator: text(item.creator),
        copyright: text(item.copyright),
        copyrightYear: text(item.copyrightYear),
        attributions: list(item.attributions),
        organisation: list(item.organisation),
        language: list(item.languageCode).length
          ? list(item.languageCode)
          : list(item.language),
        lastUpdatedOn: text(item.lastUpdatedOn),
        versionKey: text(item.versionKey),
        rights,
      });
    }
  };
  visit(node);
  return [
    ...new Map(found.map((resource) => [text(resource.id), resource])).values(),
  ];
}

function apiHeaders() {
  const headers = new Headers({ accept: "application/json" });
  const token = process.env.DIKSHA_API_AUTHORIZATION?.trim();
  if (token) headers.set("authorization", token);
  return headers;
}

async function getHierarchy(bookId: string) {
  const apiBase = (
    process.env.DIKSHA_API_BASE_URL || DEFAULT_DIKSHA_API
  ).replace(/\/+$/, "");
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    const response = await fetch(
      `${apiBase}/course/v1/hierarchy/${encodeURIComponent(bookId)}?mode=edit`,
      {
        headers: apiHeaders(),
        signal: controller.signal,
      },
    );
    if (!response.ok) {
      throw new Error(`DIKSHA hierarchy returned ${response.status}`);
    }
    return record(await response.json());
  } finally {
    clearTimeout(timeout);
  }
}

export async function GET(request: Request) {
  const bookId = new URL(request.url).searchParams.get("bookId")?.trim() || "";
  if (!/^do_\d{8,}$/.test(bookId)) {
    return Response.json(
      { error: "A valid exact DIKSHA book ID is required." },
      { status: 400 },
    );
  }

  try {
    const payload = await getHierarchy(bookId);
    const root = record(record(payload.result).content);
    if (!text(root.identifier) || text(root.status) !== "Live") {
      return Response.json(
        { error: "This official book is not currently published as Live." },
        { status: 404 },
      );
    }

    const chapters = children(root).map((chapter, index) => ({
      id: text(chapter.identifier),
      order: index + 1,
      title: cleanChapter(text(chapter.name)) || text(chapter.name),
      rawTitle: text(chapter.name),
      resources: collectResources(chapter),
    }));
    const playableResourceCount = chapters.reduce(
      (total, chapter) => total + chapter.resources.length,
      0,
    );

    return Response.json(
      {
        version: 1,
        bookId,
        title: text(root.name) || "DIKSHA textbook",
        board: list(root.board),
        gradeLevel: list(root.gradeLevel),
        subject: list(root.subject),
        medium: list(root.medium),
        status: text(root.status),
        edition: text(root.lastUpdatedOn) || text(root.lastPublishedOn),
        authority:
          "Hosted on DIKSHA · individual creator and licence shown per resource",
        generatedAt: new Date().toISOString(),
        chapters,
        playableResourceCount,
      },
      {
        headers: {
          "cache-control":
            "public, max-age=900, s-maxage=21600, stale-while-revalidate=86400",
          "x-content-type-options": "nosniff",
        },
      },
    );
  } catch (error) {
    const timedOut =
      error instanceof Error && error.name === "AbortError";
    return Response.json(
      {
        error: timedOut
          ? "The official source took too long to answer. Try again shortly."
          : "The official source is temporarily unavailable inside Zappy.",
      },
      { status: 502 },
    );
  }
}
