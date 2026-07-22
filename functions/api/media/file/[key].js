export async function onRequestGet(context) {
  try {
    const bucket = context.env.MEDIA;

    if (!bucket) {
      return new Response("R2 binding missing", { status: 500 });
    }

    const key = String(context.params.key || "");
    if (!/^[a-f0-9-]+\.(jpg|png|webp|gif)$/i.test(key)) {
      return new Response("Not found", { status: 404 });
    }

    const object = await bucket.get(key);

    if (!object) {
      return new Response("Not found", { status: 404 });
    }

    const headers = new Headers();
    object.writeHttpMetadata(headers);
    headers.set("ETag", object.httpEtag);
    headers.set("Cache-Control", "public, max-age=31536000, immutable");
    headers.set("X-Content-Type-Options", "nosniff");

    return new Response(object.body, { headers });
  } catch (error) {
    console.error(error);
    return new Response("Unable to load media", { status: 500 });
  }
}
