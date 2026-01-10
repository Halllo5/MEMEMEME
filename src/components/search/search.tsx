import { GetObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { component$, useSignal, useTask$ } from "@builder.io/qwik";
import { Link, server$ } from "@builder.io/qwik-city";
import { sql } from "kysely";
import { db } from "~/db/db";
import { applyMemeFeedVisibility } from "~/lib/permissions";
import { BUCKET_NAME, s3 } from "~/lib/s3";

// --- Server Function (Untouched) ---
const search = server$(async function(query: string) {
	const session = this.sharedMap.get("session");
	if (!session || !session.user || new Date(session.expires) < new Date()) {
		return { success: false, error: "You are not authorized." };
	}
	const processingKey = process.env.PROCESSING_KEY;
	if (!processingKey) {
		console.error("PROCESSING_KEY is not defined");
		return { success: false, error: "Server configuration error", data: "" };
	}
	const searchVectorResult = await fetch(
		`${process.env.PROCESSING_URL}/vector`,
		{
			method: "POST",
			headers: {
				"Content-Type": "application/json",
				"x-api-key": processingKey,
			},
			body: JSON.stringify({
				text: query,
			}),
		},
	);
	if (!searchVectorResult.ok) {
		console.error("Vectorisation failed failed", searchVectorResult);
		return { success: false, error: "Processing failed", data: "" };
	}
	const searchVector = await searchVectorResult.json();
	const distanceThreshold = 0.8; // Cosine distance threshold for vector similarity
	const textWeight = 0.5;
	const vectorWeight = 0.5;

	// pgvector expects the vector in the format '[1,2,3]'
	const vectorSqlString = `[${searchVector.join(",")}]`;
	const tsQuery = sql`websearch_to_tsquery('english', ${query})`;
	// 1.  CTE that already contains the buddy / visibility logic
	const withVisible: any = db.with("visible", (db) =>
		applyMemeFeedVisibility(
			db
				.selectFrom("memes")
				.selectAll()
				.select([
					sql<number>`embedding <=> ${vectorSqlString}`.as("distance"),
					sql<number>`ts_rank(content_search, ${tsQuery})`.as("text_rank"),
				])
				.where((eb) =>
					eb.or([
						sql<boolean>`content_search @@ ${tsQuery}`,
						sql<boolean>`embedding <=> ${vectorSqlString} < ${distanceThreshold}`,
					]),
				),
			session,
		),
	);

	// 2.  Order by the now-real columns
	const searchResponse = await withVisible
		.selectFrom("visible")
		.selectAll()
		.orderBy(
			sql`${textWeight} * text_rank + ${vectorWeight} * (1 - (distance / 2)) DESC`,
		)
		.limit(5)
		.execute();
	const searchResultWithIMG = await Promise.all(
		searchResponse.map(async (meme: any) => {
			const s3Key = `${meme.image_url}.opt`;
			const command = new GetObjectCommand({ Bucket: BUCKET_NAME, Key: s3Key });
			const presignedImageUrl = await getSignedUrl(s3, command, {
				expiresIn: 60 * 5,
			});

			return {
				...meme,
				imageUrl: presignedImageUrl,
			};
		}),
	);
	return { success: true, error: "", data: searchResultWithIMG };
});

// --- Fixed Component ---
export const Search = component$(() => {
	const querySig = useSignal("");
	const resultsSig = useSignal<any[]>([]);
	const isSearchingSig = useSignal(false);
	const showDropdownSig = useSignal(false);

	// Watch for changes in input, debounce, and call server function
	useTask$(({ track, cleanup }) => {
		const query = track(() => querySig.value);

		if (!query || query.length < 2) {
			resultsSig.value = [];
			showDropdownSig.value = false;
			return;
		}

		// Debounce to avoid hitting vector API on every keystroke
		const timeout = setTimeout(async () => {
			isSearchingSig.value = true;
			const res = await search(query);
			if (res.success && Array.isArray(res.data)) {
				resultsSig.value = res.data;
				showDropdownSig.value = true;
			}
			isSearchingSig.value = false;
		}, 400); // 400ms delay

		cleanup(() => clearTimeout(timeout));
	});

	return (
		<div class="relative w-full max-w-md">
			<form
				preventdefault:submit
				onSubmit$={() => {
					/* Optional: Handle Enter key specifically if needed */
				}}
			>
				<input
					bind:value={querySig}
					type="text"
					placeholder="Search memes..."
					class="text-main-foreground border-border shadow-shadow w-full border-2 bg-white p-2 outline-none focus:ring-2 focus:ring-blue-400"
					onFocus$={() => {
						if (resultsSig.value.length > 0) showDropdownSig.value = true;
					}}
				// Optional: hide dropdown when clicking away (requires careful handling of click vs blur)
				/>
			</form>

			{/* Dropdown Results */}
			{showDropdownSig.value && (
				<div class="border-border absolute z-50 mt-1 max-h-60 w-full overflow-y-auto border-2 bg-white shadow-xl">
					{isSearchingSig.value ? (
						<div class="p-2 text-gray-500">Searching...</div>
					) : resultsSig.value.length > 0 ? (
						<ul>
							{resultsSig.value.map((item, index) => (
								<Link href={`/meme/${item.id}`}>
									<li
										key={item.id || index}
										class="hover:bg-main border-border cursor-pointer border-gray-100 p-2 last:border-0"
									>
										{/* Adjust these fields based on your actual DB schema */}
										<img src={item.imageUrl} />
										<div class="font-bold">{item.title || ""}</div>
										<div class="truncate text-sm text-gray-500">
											{item.content || item.description}
										</div>
									</li>
								</Link>
							))}
						</ul>
					) : (
						<div class="p-2 text-gray-500">No results found.</div>
					)}
				</div>
			)}
		</div>
	);
});
