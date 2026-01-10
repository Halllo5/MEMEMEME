import { type RequestHandler } from "@builder.io/qwik-city";
import { db } from "~/db/db";

export const onGet: RequestHandler = async ({ params, send, headers }) => {
  const { id } = params;
  const userId = id;

  if (!userId) {
    throw send(400, "User ID is missing");
  }

  const user = await db
    .selectFrom("User")
    .select(["image"])
    .where("id", "=", userId)
    .executeTakeFirst();

  const imageUrl = user?.image;

  if (!imageUrl) {
    throw send(404, "Avatar not found");
  }

  if (!imageUrl.startsWith("http")) {
    throw send(404, "Invalid avatar URL");
  }

  try {
    const imageResponse = await fetch(imageUrl, {
      redirect: "follow",
    });

    if (!imageResponse.ok) {
      throw send(503, "Avatar unavailable");
    }

    const imageBuffer = await imageResponse.arrayBuffer();
    const contentType =
      imageResponse.headers.get("Content-Type") || "image/jpeg";

    headers.set("Content-Type", contentType);
    headers.set("Cache-Control", "public, max-age=3600");
    headers.set("Access-Control-Allow-Origin", "*");

    send(200, new Uint8Array(imageBuffer));
  } catch (error) {
    console.error("Avatar proxy error for userId:", userId, "error:", error);
    throw send(503, "Avatar service unavailable");
  }
};
