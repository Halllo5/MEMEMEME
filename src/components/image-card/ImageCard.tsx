import { component$, useSignal } from "@builder.io/qwik";
import { Link } from "@builder.io/qwik-city";
import { LuArrowRight } from "@qwikest/icons/lucide";

export interface ImageCardProps {
  imageUrl: string;
  caption?: string;
  uploaderName: string;
  uploaderImageUrl?: string;
  uploaderLink?: string;
  imageId?: string;
}

export const ImageCard = component$<ImageCardProps>(
  ({
    imageUrl,
    caption,
    uploaderName,
    uploaderImageUrl,
    uploaderLink = "#",
    imageId,
  }) => {
    const uploaderInitial = uploaderName?.substring(0, 2);
    const profilePicHasError = useSignal(false);
    return (
      <div class="rounded-base border-border bg-background h-auto shadow-shadow block overflow-hidden border-2">
        {/* Main Image */}
        <div class="bg-secondary-background aspect-square">
          <Link href={`/meme/${imageId}`}>
            <img
              src={imageUrl}
              alt={caption || `Uploaded by ${uploaderName}`}
              class="object-cover"
              width={600}
              height={600}
              loading="lazy"
            />
          </Link>

          <div />

          {/* Bottom Bar */}
          <div class="bg-main flex flex-row items-center justify-between gap-4 p-2">
            {/* Uploader Info */}
            <Link
              href={uploaderLink}
              class="group flex min-w-0 items-center gap-3"
              preventdefault:click
            >
              {uploaderImageUrl && !profilePicHasError.value ? (
                <img
                  src={uploaderImageUrl}
                  alt=""
                  width={32}
                  height={32}
                  class="border-border rounded-base h-8 w-8 flex-shrink-0 border-2 object-cover"
                  loading="lazy"
                  onError$={() => (profilePicHasError.value = true)}
                />
              ) : (
                <div class="border-border bg-main text-main-foreground rounded-base flex h-8 w-8 flex-shrink-0 items-center justify-center border-2 text-sm font-bold">
                  {uploaderInitial}
                </div>
              )}
              <span class="truncate font-bold group-hover:underline">
                {uploaderName}
              </span>
            </Link>

            {/* Caption on the right */}
            {
              <Link
                href={`/meme/${imageId}`}
                class="group flex items-center gap-2"
              >
                <p class="truncate text-right text-sm group-hover:underline">
                  {caption}
                </p>
                <LuArrowRight class="h-8 w-auto" />
              </Link>
            }
          </div>
        </div>
      </div>
    );
  },
);
