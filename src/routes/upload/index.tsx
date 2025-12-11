import { component$, $, useStore, useSignal } from "@builder.io/qwik";
import { server$, type DocumentHead } from "@builder.io/qwik-city";
import { PutObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { db, type PrivacyLevel } from "~/db/db";
import { BUCKET_NAME, s3 } from "~/lib/s3";
import { Button } from "~/components/button";
import { allowedMimeTypes } from "~/lib/const";

// --- SERVER FUNCTIONS (Unchanged) ---

type UploadResponse = {
  success: boolean;
  id?: string;
  error?: string;
  url?: string;
};

const createdMeme = server$(async function (
  privacy: PrivacyLevel,
  caption: string,
  mimeType: string,
): Promise<UploadResponse> {
  const session = this.sharedMap.get("session");
  if (!session || !session.user || new Date(session.expires) < new Date()) {
    return { success: false, error: "You are not authorized. Please sign in." };
  }
  if (!allowedMimeTypes.includes(mimeType)) {
    return { success: false, error: "Invalid file type." };
  }
  const result = await db
    .insertInto("memes")
    .values({ user_id: session.user.id, image_url: "", privacy, caption })
    .returning(["id"])
    .execute();
  const s3command = new PutObjectCommand({
    Bucket: BUCKET_NAME,
    Key: `memes/${session.user.id}/${result[0].id}.org`,
    ContentType: mimeType,
  });
  const presignedUrl = await getSignedUrl(s3, s3command, { expiresIn: 240 });
  return { success: true, id: result[0].id, url: presignedUrl };
});

const confirmedUpload = server$(async function (id: string) {
  try {
    const session = this.sharedMap.get("session");
    if (!session || !session.user || new Date(session.expires) < new Date()) {
      return { success: false, error: "You are not authorized." };
    }
    // call the processing endpoint
    const processingKey = process.env.PROCESSING_KEY;
    if (!processingKey) {
      console.error("PROCESSING_KEY is not defined");
      return { success: false, error: "Server configuration error" };
    }

    const processingResponse = await fetch(
      `${process.env.PROCESSING_URL}/process`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-api-key": processingKey,
        },
        body: JSON.stringify({
          uploader_id: session.user.id,
          meme_id: id,
        }),
      },
    );
    if (!processingResponse.ok) {
      console.error("Processing failed", processingResponse);
      return { success: false, error: "Processing failed" };
    }
    return { success: true };
  } catch (error) {
    console.error("Failed to confirm upload", error);
    return { success: false, error: "Failed to confirm upload" };
  }
});

// --- UI COMPONENT ---

interface UploadableFile {
  id: string;
  file: File;
  previewUrl: string;
  status: "pending" | "uploading" | "success" | "error";
  progress: number;
  error?: string;
}

export default component$(() => {
  const fileInputRef = useSignal<HTMLInputElement>();
  const uploadStore = useStore<{ files: UploadableFile[] }>({ files: [] });
  const privacy = useSignal<PrivacyLevel>("buddies_only");
  const caption = useSignal("");
  const overallStatus = useStore({
    v: "idle" as "idle" | "uploading" | "done",
  });

  const handleFileChange = $((event: Event) => {
    const input = event.target as HTMLInputElement;
    if (!input.files) return;

    const newFiles = Array.from(input.files).map((file) => ({
      id: `${file.name}-${file.lastModified}`,
      file,
      previewUrl: URL.createObjectURL(file),
      status: "pending" as const,
      progress: 0,
    }));

    uploadStore.files.push(...newFiles);
  });

  const uploadFile = $(async (upload: UploadableFile) => {
    try {
      upload.status = "uploading";
      upload.progress = 0;

      const presignResponse = await createdMeme(
        privacy.value,
        caption.value,
        upload.file.type,
      );
      if (!presignResponse.success) throw new Error(presignResponse.error);

      await new Promise<void>((resolve, reject) => {
        const xhr = new XMLHttpRequest();
        xhr.open("PUT", presignResponse.url!, true);
        xhr.upload.onprogress = (e) => {
          if (e.lengthComputable) {
            requestAnimationFrame(() => {
              upload.progress = (e.loaded / e.total) * 100;
            });
          }
        };
        xhr.onload = () =>
          xhr.status >= 200 && xhr.status < 300
            ? resolve()
            : reject(new Error("S3 Upload Failed"));
        xhr.onerror = () => reject(new Error("Network Error"));
        xhr.send(upload.file);
      });

      const confirmResponse = await confirmedUpload(presignResponse.id!);
      if (!confirmResponse.success)
        throw new Error("Server failed to confirm upload.");

      upload.status = "success";
      upload.progress = 100;
    } catch (e: any) {
      upload.status = "error";
      upload.error = e.message;
    }
  });

  const handleUpload = $(async () => {
    overallStatus.v = "uploading";
    const pendingFiles = uploadStore.files.filter(
      (f) => f.status === "pending",
    );
    await Promise.all(pendingFiles.map((file) => uploadFile(file)));
    overallStatus.v = "done";
  });

  const clearCompleted = $(() => {
    uploadStore.files = uploadStore.files.filter(
      (f) => f.status === "pending" || f.status === "uploading",
    );
  });

  const pendingFileCount = uploadStore.files.filter(
    (f) => f.status === "pending",
  ).length;

  return (
    <div class="container mx-auto max-w-2xl p-8">
      <h1 class="text-3xl font-bold">Upload Memes</h1>

      <div class="mt-8 space-y-6">
        {/* File Drop Area */}
        <div
          class="rounded-base border-border bg-background hover:border-main flex cursor-pointer justify-center border-2 border-dashed p-6 transition-colors"
          onClick$={() => fileInputRef.value?.click()}
        >
          <div class="text-center">
            <svg
              class="mx-auto h-12 w-12 text-gray-400"
              stroke="currentColor"
              fill="none"
              viewBox="0 0 48 48"
            >
              {" "}
              <path
                d="M28 8H12a4 4 0 00-4 4v20m32-12v8m0 0v8a4 4 0 01-4 4H12a4 4 0 01-4-4v-4m32-4l-3.172-3.172a4 4 0 00-5.656 0L28 28M8 32l9.172-9.172a4 4 0 015.656 0L28 28"
                stroke-width="2"
                stroke-linecap="round"
                stroke-linejoin="round"
              />{" "}
            </svg>
            <p class="mt-4 text-sm text-gray-500">Click to select images</p>
          </div>
          <input
            ref={fileInputRef}
            type="file"
            class="hidden"
            multiple
            accept={allowedMimeTypes.join(",")}
            onChange$={handleFileChange}
            onClick$={(e) => e.stopPropagation()}
          />
        </div>

        {uploadStore.files.length > 0 && (
          <div class="space-y-4">
            {/* Settings for Batch */}
            <div class="grid grid-cols-1 gap-6 sm:grid-cols-2">
              <div>
                <label for="caption" class="text-lg font-medium">
                  Caption (for all)
                </label>
                <input
                  id="caption"
                  type="text"
                  value={caption.value}
                  onInput$={(e) =>
                    (caption.value = (e.target as HTMLInputElement).value)
                  }
                  class="rounded-base border-border bg-background shadow-shadow focus:border-main mt-2 block w-full border-2 p-3 focus:outline-none"
                />
              </div>
              <div>
                <label for="privacy" class="text-lg font-medium">
                  Privacy (for all)
                </label>
                <div class="relative mt-2">
                  <select
                    id="privacy"
                    value={privacy.value}
                    onInput$={(e) =>
                      (privacy.value = (e.target as HTMLSelectElement)
                        .value as PrivacyLevel)
                    }
                    class="rounded-base border-border bg-background shadow-shadow focus:border-main block w-full appearance-none border-2 p-3 focus:outline-none"
                  >
                    <option value="buddies_only">Buddies Only</option>
                    <option value="public">Public</option>
                    <option value="private">Private</option>
                  </select>
                  <div class="text-foreground pointer-events-none absolute inset-y-0 right-0 flex items-center px-4">
                    {" "}
                    <svg
                      class="h-4 w-4"
                      xmlns="http://www.w3.org/2000/svg"
                      viewBox="0 0 20 20"
                      fill="currentColor"
                    >
                      {" "}
                      <path
                        fill-rule="evenodd"
                        d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z"
                        clip-rule="evenodd"
                      />{" "}
                    </svg>{" "}
                  </div>
                </div>
              </div>
            </div>

            {/* File List */}
            <div class="space-y-3">
              {uploadStore.files.map((upload) => (
                <div
                  key={upload.id}
                  class="rounded-base border-border bg-background flex items-center gap-4 border-2 p-3"
                >
                  <img
                    src={upload.previewUrl}
                    alt={upload.file.name}
                    width={48}
                    height={48}
                    class="rounded-base h-12 w-12 flex-shrink-0 object-cover"
                  />
                  <div class="flex-grow overflow-hidden">
                    <p class="truncate font-medium">{upload.file.name}</p>
                    <div class="mt-1 flex items-center gap-2 text-sm">
                      {upload.status === "pending" && (
                        <span class="text-gray-500">Pending</span>
                      )}
                      {upload.status === "success" && (
                        <span class="text-green-500">Success</span>
                      )}
                      {upload.status === "error" && (
                        <span class="truncate text-red-500">
                          Error: {upload.error}
                        </span>
                      )}
                      {(upload.status === "uploading" ||
                        upload.status === "success") && (
                        <div class="border-border bg-secondary-background h-2 flex-grow overflow-hidden rounded-full border-2">
                          <div
                            class="bg-main h-full transition-all"
                            style={{ width: `${upload.progress}%` }}
                          ></div>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* Action Buttons */}
            <div class="flex gap-4 pt-4">
              <Button
                size="lg"
                class="flex-grow"
                disabled={
                  overallStatus.v === "uploading" || pendingFileCount === 0
                }
                onClick$={handleUpload}
              >
                {overallStatus.v === "uploading"
                  ? "Uploading..."
                  : `Upload ${pendingFileCount} Files`}
              </Button>
              <Button variant="neutral" onClick$={clearCompleted}>
                Clear Completed
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
});

export const head: DocumentHead = {
  title: "Upload your Memes",
};
