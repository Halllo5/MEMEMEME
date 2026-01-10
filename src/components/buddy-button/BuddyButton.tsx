import { component$, useSignal } from "@builder.io/qwik";
import { server$ } from "@builder.io/qwik-city";
import type { BuddyStatus } from "~/lib/permissions";
import { Button } from "~/components/button";
import { db } from "~/db/db";
import { SendMail } from "~/lib/mail";

interface BuddyButtonProps {
	buddyStatus: BuddyStatus;
	profileUserId: string;
}

export const addBuddy = server$(async function(buddyId: string) {
	const session = this.sharedMap.get("session");
	if (!session?.user) {
		throw new Error("Not authenticated");
	}
	const userId: string = session.user.id;

	if (userId === buddyId) {
		throw new Error("Cannot add yourself as a buddy");
	}

	// Bidirectional buddy relationship
	await db
		.insertInto("buddy_list")
		.values({ user_id: userId, buddy_id: buddyId, status: "created" })
		.onConflict((oc) => oc.doNothing())
		.execute();
	const users = await db
		.selectFrom("User")
		.where("id", "in", [userId, buddyId])
		.select(["id", "email", "name"])
		.execute();

	// 3. Extract logic: If name exists use it, otherwise use email
	const userRow = users.find((u) => u.id === userId);
	const buddyRow = users.find((u) => u.id === buddyId);

	// The || operator handles null, undefined, or empty string "" automatically
	const userDisplayName = userRow?.name || userRow?.email;
	// const buddyDisplayName = buddyRow?.name || buddyRow?.email;

	const emailHTML = `
<p>${userDisplayName} wants to be your buddy 😎</p>
<a href="${process.env.AUTH_URL}/u/${buddyRow?.id}">Visit profile </a>
`;
	SendMail(
		emailHTML,
		`${userDisplayName} wants to be your buddy 😎`,
		buddyRow?.email || "invalid@thesven.cloud",
	);

	return { success: true };
});

export const acceptBuddy = server$(async function(buddyId: string) {
	const session = this.sharedMap.get("session");
	if (!session?.user) {
		throw new Error("Not authenticated");
	}
	const userId: string = session.user.id;

	await db
		.updateTable("buddy_list")
		.set({ status: "buddy" })
		.where("user_id", "=", buddyId)
		.where("buddy_id", "=", userId)
		.execute();
	const users = await db
		.selectFrom("User")
		.where("id", "in", [userId, buddyId])
		.select(["id", "email", "name"])
		.execute();

	// 3. Extract logic: If name exists use it, otherwise use email
	// const userRow = users.find((u) => u.id === userId);
	const buddyRow = users.find((u) => u.id === buddyId);

	// The || operator handles null, undefined, or empty string "" automatically
	// const userDisplayName = userRow?.name || userRow?.email;
	const buddyDisplayName = buddyRow?.name || buddyRow?.email;

	const emailHTML = `
<p>${buddyDisplayName} is now your buddy 😎</p>
<a href="${process.env.AUTH_URL}/u/${buddyId}">Visit profile </a>
`;
	SendMail(
		emailHTML,
		`${buddyDisplayName} is now your buddy 😎`,
		buddyRow?.email || "invalid@thesven.cloud",
	);

	return { success: true };
});

export const removeBuddy = server$(async function(buddyId: string) {
	const session = this.sharedMap.get("session");
	if (!session?.user) {
		throw new Error("Not authenticated");
	}
	const userId: string = session.user.id;

	await db
		.deleteFrom("buddy_list")
		.where((eb) =>
			eb.or([
				eb.and([eb("user_id", "=", userId), eb("buddy_id", "=", buddyId)]),
				eb.and([eb("user_id", "=", buddyId), eb("buddy_id", "=", userId)]),
			]),
		)
		.execute();

	return { success: true };
});

export const BuddyButton = component$<BuddyButtonProps>(
	({ buddyStatus, profileUserId }) => {
		const status = useSignal(buddyStatus);

		switch (status.value.status) {
			case "self":
				return null;
			case "blocked":
				return null;
			case "not_buddies":
				return (
					<Button
						onClick$={async () => {
							const res = await addBuddy(profileUserId);
							if (res.success) {
								status.value = { status: "request_sent" };
							}
						}}
					>
						Buddy Up
					</Button>
				);
			case "request_sent":
				return (
					<Button disabled style="secondary">
						Buddy Request Sent
					</Button>
				);
			case "request_received":
				return (
					<Button
						onClick$={async () => {
							const res = await acceptBuddy(profileUserId);
							if (res.success) {
								status.value = { status: "buddies" };
							}
						}}
					>
						Accept Buddy Request
					</Button>
				);
			case "buddies":
				return (
					<div class="flex flex-col gap-2">
						<Button
							style="secondary"
							onClick$={async () => {
								if (confirm("Are you sure you want to remove this buddy?")) {
									const res = await removeBuddy(profileUserId);
									if (res.success) {
										status.value = { status: "not_buddies" };
									}
								}
							}}
						>
							Remove Buddy
						</Button>
					</div>
				);
		}
	},
);
