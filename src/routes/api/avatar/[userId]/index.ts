import { type RequestHandler } from "@builder.io/qwik-city";
import { db } from "~/db/db";

export const onGet = async ({ params }: Parameters<RequestHandler>[0]) => {
  const userId = params.userId;

  if (!userId) {
    return new Response("Invalid request: User ID is missing.", {
      status: 400,
    });
  }

  const user = await db
    .selectFrom("User")
    .select(["image"])
    .where("id", "=", userId)
    .executeTakeFirst();

  const imageUrl = user?.image;

  if (!imageUrl || !imageUrl.startsWith("http")) {
    return new Response("Image not found or is not an external URL.", {
      status: 404,
    });
  }

  try {
    const imageResponse = await fetch(imageUrl);

    if (!imageResponse.ok) {
      // Pass through the upstream error status
      return new Response(imageResponse.body, {
        status: imageResponse.status,
        statusText: imageResponse.statusText,
        headers: imageResponse.headers,
      });
    }

    const headers = new Headers();
    headers.set(
      "Content-Type",
      imageResponse.headers.get("Content-Type") || "image/jpeg",
    );
    headers.set("Cache-Control", "public, max-age=31536000, immutable");

    return new Response(imageResponse.body, {
      status: 200,
      headers: headers,
    });
  } catch (error) {
    console.error("Avatar proxy error:", error);
    return new Response("Could not retrieve image due to a server error.", {
      status: 500,
    });
  }
};
