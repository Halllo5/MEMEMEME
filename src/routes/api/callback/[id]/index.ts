import { type RequestHandler } from "@builder.io/qwik-city";
import { db } from "../../../../db/db";

interface CallbackBody {
  status: string;
  ocr?: string;
  uploader_id: string;
  vector?: number[];
  vector_length?: number;
}

export const onPost: RequestHandler = async ({
  params,
  parseBody,
  json,
  send,
  request,
}) => {
  const { id } = params;

  // Check API Key
  const apiKey = request.headers.get("x-api-key");
  const validApiKey = process.env.PROCESSING_KEY;

  if (!validApiKey) {
    console.error("PROCESSING_KEY not set in environment");
    throw send(500, "Server Configuration Error");
  }

  if (apiKey !== validApiKey) {
    throw send(401, "Invalid API Key");
  }

  if (!id) {
    throw send(400, "Missing ID");
  }

  const body = await parseBody();

  if (!body || typeof body !== "object") {
    throw send(400, "Invalid body");
  }

  const { ocr, vector, uploader_id } = body as CallbackBody;

  try {
    await db
      .updateTable("memes")
      .set({
        extracted_text: ocr ?? null,
        embedding: vector ? JSON.stringify(vector) : null,
        image_url: `memes/${uploader_id}/${id}`,
      })
      .where("id", "=", id)
      .execute();

    json(200, { status: "success" });
  } catch (error) {
    console.error("Failed to update meme", error);
    throw send(500, "Internal Server Error");
  }
};
