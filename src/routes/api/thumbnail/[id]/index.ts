import { type RequestHandler } from "@builder.io/qwik-city";
import { db } from "~/db/db";
import { GetObjectCommand } from "@aws-sdk/client-s3";
import { BUCKET_NAME, s3 } from "~/lib/s3";
import { isShareKeyValid } from "~/lib/permissions";

export const onGet: RequestHandler = async ({
  params,
  send,
  headers,
  url,
}) => {
  const memeId = params.id;

  if (!memeId) {
    throw send(400, "Meme ID is missing");
  }

  // Look up the meme
  const meme = await db
    .selectFrom("memes")
    .select(["image_url", "privacy", "user_id"])
    .where("id", "=", memeId)
    .executeTakeFirst();

  if (!meme || !meme.image_url) {
    throw send(404, "Meme not found");
  }

  // Access check: allow public memes, or valid share keys
  const isPublic = meme.privacy === "public";
  const shareKey = url.searchParams.get("share");
  let hasAccess = isPublic;

  if (!hasAccess && shareKey) {
    hasAccess = await isShareKeyValid(shareKey, memeId);
  }

  if (!hasAccess) {
    throw send(404, "Meme not found");
  }

  // Fetch image from S3 directly
  try {
    const s3Key = `${meme.image_url}.opt`;
    const command = new GetObjectCommand({ Bucket: BUCKET_NAME, Key: s3Key });
    const response = await s3.send(command);

    if (!response.Body) {
      throw send(404, "Image not found");
    }

    const imageBytes = await response.Body.transformToByteArray();

    headers.set("Content-Type", response.ContentType || "image/webp");
    headers.set("Cache-Control", "public, max-age=86400"); // 24 hours
    headers.set("Access-Control-Allow-Origin", "*");

    send(200, imageBytes);
  } catch (error) {
    console.error("Thumbnail proxy error for memeId:", memeId, "error:", error);
    throw send(503, "Thumbnail service unavailable");
  }
};
