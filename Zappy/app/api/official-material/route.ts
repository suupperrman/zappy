const OFFICIAL_MATERIALS = {
  "karnataka-class8-science-lba-2025-26": {
    url: "https://dsert.karnataka.gov.in/storage/pdf-files/lba/8thLBAScienceEM1.pdf",
    authority: "DSERT Karnataka",
    title: "2025-26 Class 8 English Science Lesson Based Assessment",
    contentType: "application/pdf",
  },
} as const;

const MAX_STREAM_BYTES = 150_000_000;

function materialFor(request: Request) {
  const id = new URL(request.url).searchParams.get("id")?.trim() || "";
  return {
    id,
    material: OFFICIAL_MATERIALS[id as keyof typeof OFFICIAL_MATERIALS],
  };
}

async function serve(request: Request, headOnly: boolean) {
  const { id, material } = materialFor(request);
  if (!material) {
    return Response.json(
      { error: "A recognised official material ID is required." },
      { status: 400 },
    );
  }

  try {
    const upstreamHeaders = new Headers();
    const range = request.headers.get("range");
    if (range) upstreamHeaders.set("range", range);
    const upstream = await fetch(material.url, {
      method: headOnly ? "HEAD" : "GET",
      headers: upstreamHeaders,
      redirect: "manual",
    });
    if (
      (upstream.status >= 300 && upstream.status < 400) ||
      (!upstream.ok && upstream.status !== 206)
    ) {
      return Response.json(
        { error: "The official material is temporarily unavailable." },
        { status: 502 },
      );
    }
    const length = Number(upstream.headers.get("content-length") || "0");
    if (length > MAX_STREAM_BYTES) {
      return Response.json(
        { error: "This official material is too large for the in-app viewer." },
        { status: 413 },
      );
    }
    const contentType = upstream.headers.get("content-type") || material.contentType;
    if (!contentType.toLowerCase().includes("pdf")) {
      return Response.json(
        { error: "The official source returned an unexpected file type." },
        { status: 502 },
      );
    }

    const responseHeaders = new Headers({
      "content-type": material.contentType,
      "content-disposition": "inline",
      "cache-control": "public, max-age=3600, s-maxage=21600",
      "x-content-type-options": "nosniff",
      "x-zappy-source": material.authority,
      "x-zappy-source-id": id,
      "x-zappy-source-title": material.title,
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
      { error: "Zappy could not securely prepare this official material." },
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
