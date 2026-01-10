import {
  component$,
  useStore,
  useVisibleTask$,
  useSignal,
} from "@builder.io/qwik";
import {
  type DocumentHead,
  routeLoader$,
  server$,
} from "@builder.io/qwik-city";
import { ImageCard } from "~/components/image-card/ImageCard";
import { db } from "~/db/db";
import { GetObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { applyMemeFeedVisibility } from "~/lib/permissions";
import { BUCKET_NAME, s3 } from "~/lib/s3";

const PAGE_SIZE = 10;

// This function contains the core logic for fetching and preparing memes.
// It will be called by both the routeLoader and the server$ function.
// NOTE: This function itself is NOT a server$ function, it's just a regular
// function that will only ever be executed on the server.
const getMemesFeed = async (
  session: any,
  page: number,
): Promise<{ memes: any[]; hasMore: boolean }> => {
  let query = db
    .selectFrom("memes")
    .innerJoin("User", "User.id", "memes.user_id")
    .select([
      "memes.id as imageId",
      "memes.caption",
      "memes.image_url",
      "User.name as uploaderName",
      "User.email as uploaderEmail",
      "User.id as uploaderId",
    ])
    .where("memes.image_url", "is not", null)
    .where("memes.image_url", "!=", "")
    .limit(PAGE_SIZE)
    .offset((page - 1) * PAGE_SIZE)
    .orderBy("memes.created_at", "desc");

  query = applyMemeFeedVisibility(query, session);

  const memesFromDb = await query.execute();

  // Generate presigned URLs in parallel
  const memesWithUrls = await Promise.all(
    memesFromDb.map(async (meme) => {
      const s3Key = `${meme.image_url}.opt`;
      const command = new GetObjectCommand({ Bucket: BUCKET_NAME, Key: s3Key });
      const presignedImageUrl = await getSignedUrl(s3, command, {
        expiresIn: 60 * 5,
      });

      return {
        ...meme,
        imageUrl: presignedImageUrl,
        uploaderLink: `/u/${meme.uploaderId}`,
        uploaderImageUrl: `/api/avatar/${meme.uploaderId}`, // Use the proxy
        uploaderName: meme.uploaderName || meme.uploaderEmail,
      };
    }),
  );

  return {
    memes: memesWithUrls,
    hasMore: memesFromDb.length === PAGE_SIZE,
  };
};

// routeLoader$ for the initial page load (SSR)
export const useFeedLoader = routeLoader$(async (requestEvent) => {
  const session = requestEvent.sharedMap.get("session");
  return await getMemesFeed(session, 1);
});

// server$ for fetching subsequent pages on the client
export const getNextPage = server$(async function (page: number) {
  const session = this.sharedMap.get("session");
  return await getMemesFeed(session, page);
});

export default component$(() => {
  const initialData = useFeedLoader();
  const feedState = useStore({
    memes: initialData.value.memes,
    page: 1,
    hasMore: initialData.value.hasMore,
    isLoading: false,
  });
  const triggerRef = useSignal<Element>();

  // eslint-disable-next-line qwik/no-use-visible-task
  useVisibleTask$(({ track }) => {
    track(() => triggerRef.value);

    if (triggerRef.value) {
      const observer = new IntersectionObserver(async (entries) => {
        if (
          entries[0].isIntersecting &&
          feedState.hasMore &&
          !feedState.isLoading
        ) {
          feedState.isLoading = true;
          const nextPage = feedState.page + 1;
          const newData = await getNextPage(nextPage);
          feedState.memes.push(...newData.memes);
          feedState.page = nextPage;
          feedState.hasMore = newData.hasMore;
          feedState.isLoading = false;
        }
      });
      observer.observe(triggerRef.value);
      return () => observer.disconnect();
    }
  });

  return (
    <div class="mx-auto max-w-xl p-4">
      <div class="space-y-8">
        {feedState.memes.map((meme) => (
          <ImageCard
            key={meme.imageId}
            imageUrl={meme.imageUrl}
            caption={meme.caption}
            uploaderName={meme.uploaderName}
            uploaderImageUrl={meme.uploaderImageUrl}
            uploaderLink={meme.uploaderLink}
            imageId={meme.imageId}
          />
        ))}
      </div>
      {feedState.hasMore && (
        <div ref={triggerRef} class="h-8 text-center">
          {feedState.isLoading && <p>Loading more memes...</p>}
        </div>
      )}
      {!feedState.hasMore && (
        <p class="py-8 text-center text-lg text-gray-500">
          You've reached the end of the feed!
        </p>
      )}
    </div>
  );
});

export const head: DocumentHead = {
  title: "MEMEMEME HOME",
  meta: [
    {
      name: "description",
      content: "MEMEME FEED - GET YOUR MEMES.",
    },
  ],
};
