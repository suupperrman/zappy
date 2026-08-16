type JsonRecord = Record<string, unknown>;

const DEFAULT_DIKSHA_API = "https://diksha.gov.in/api";
const METADATA_TIMEOUT_MS = 12_000;
const MAX_STREAM_BYTES = 1_200_000_000;

function record(value: unknown): JsonRecord {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as JsonRecord)
    : {};
}

function text(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function isAllowedObjectUrl(value: string) {
  try {
    const url = new URL(value);
    return url.protocol === "https:" && url.hostname === "obj.diksha.gov.in";
  } catch {
    return false;
  }
}

function originalPlaybackAllowed(license: string) {
  const normalized = license.toUpperCase().replace(/\s+/g, " ").trim();
  return (
    /^CC (BY|BY-SA|BY-NC|BY-NC-SA|BY-ND|BY-NC-ND)( \d\.\d)?$/.test(
      normalized,
    ) || /^CC0( \d\.\d)?$/.test(normalized)
  );
}

function apiHeaders() {
  const headers = new Headers({ accept: "application/json" });
  const token = process.env.DIKSHA_API_AUTHORIZATION?.trim();
  if (token) headers.set("authorization", token);
  return headers;
}

async function readResource(resourceId: string) {
  const apiBase = (
    process.env.DIKSHA_API_BASE_URL || DEFAULT_DIKSHA_API
  ).replace(/\/+$/, "");
  const fields = [
    "identifier",
    "name",
    "status",
    "visibility",
    "mimeType",
    "artifactUrl",
    "license",
    "creator",
    "copyright",
    "copyrightYear",
    "attributions",
    "versionKey",
    "lastUpdatedOn",
  ].join(",");
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), METADATA_TIMEOUT_MS);
  try {
    const response = await fetch(
      `${apiBase}/content/v2/read/${encodeURIComponent(resourceId)}?fields=${fields}`,
      { headers: apiHeaders(), signal: controller.signal },
    );
    if (!response.ok) throw new Error("Metadata unavailable");
    return record(record(record(await response.json()).result).content);
  } finally {
    clearTimeout(timeout);
  }
}

async function serve(request: Request, headOnly: boolean) {
  const resourceId =
    new URL(request.url).searchParams.get("resourceId")?.trim() || "";
  if (!/^do_\d{8,}$/.test(resourceId)) {
    return Response.json(
      { error: "A valid DIKSHA resource ID is required." },
      { status: 400 },
    );
  }

  try {
    const content = await readResource(resourceId);
    const artifactUrl = text(content.artifactUrl);
    const license = text(content.license);
    if (
      text(content.identifier) !== resourceId ||
      text(content.status) !== "Live" ||
      !isAllowedObjectUrl(artifactUrl) ||
      !originalPlaybackAllowed(license)
    ) {
      return Response.json(
        {
          error:
            "This item is not a Live, allowlisted, appropriately licensed DIKSHA asset.",
        },
        { status: 403 },
      );
    }

    const upstreamHeaders = new Headers();
    const range = request.headers.get("range");
    if (range) upstreamHeaders.set("range", range);
    const upstream = await fetch(artifactUrl, {
      method: headOnly ? "HEAD" : "GET",
      headers: upstreamHeaders,
      redirect: "manual",
    });
    if (
      (upstream.status >= 300 && upstream.status < 400) ||
      (!upstream.ok && upstream.status !== 206)
    ) {
      return Response.json(
        { error: "The official media object is temporarily unavailable." },
        { status: 502 },
      );
    }
    const length = Number(upstream.headers.get("content-length") || "0");
    if (length > MAX_STREAM_BYTES) {
      return Response.json(
        { error: "This official media object is too large for the Zappy player." },
        { status: 413 },
      );
    }

    const responseHeaders = new Headers({
      "content-type":
        upstream.headers.get("content-type") ||
        text(content.mimeType) ||
        "application/octet-stream",
      "content-disposition": "inline",
      "cache-control":
        upstream.headers.get("cache-control") ||
        "public, max-age=3600, s-maxage=21600",
      "x-content-type-options": "nosniff",
      "x-zappy-source": "DIKSHA",
      "x-zappy-source-id": resourceId,
      "x-zappy-license": license,
    });
    for (const header of [
      "accept-ranges",
      "content-length",
      "content-range",
      "etag",
      "last-modified",
    ]) {
      const value = upstream.headers.get(header);
      if (value) responseHeaders.set(header, value);
    }

    return new Response(headOnly ? null : upstream.body, {
      status: upstream.status,
      headers: responseHeaders,
    });
  } catch {
    return Response.json(
      { error: "Zappy could not securely prepare this official media item." },
      { status: 502 },
    );
  }
}

export async function GET(request: Request) {
  return serve(request, false);
}

export async function HEAD(request: Request) {
  return serve(request, true);
}
