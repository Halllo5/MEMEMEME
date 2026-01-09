import { component$, Slot } from "@builder.io/qwik";
import { Link, routeLoader$ } from "@builder.io/qwik-city";
import { Button } from "~/components/button";
import { Header } from "~/components/header";
import { Logo } from "~/components/logo";
import { UserAuth } from "~/components/user-auth/UserAuth";
import { useSession } from "./plugin@auth";
import { Search } from "~/components/search/search";

export const useServerTimeLoader = routeLoader$(() => {
	return {
		date: new Date().toISOString(),
	};
});

export default component$(() => {
	const session = useSession();
	return (
		<>
			<Header>
				<Link href="/" class="group flex items-center gap-4">
					<Logo />
					<span class="text-xl font-bold group-hover:underline">
						MEMEMEMEME
					</span>
				</Link>
				<div class="flex items-center gap-4">
					<Search />
					{session.value?.user && (
						<Link href="/upload">
							<Button variant="neutral">Upload</Button>
						</Link>
					)}
					<UserAuth />
				</div>
			</Header>
			<main>
				<Slot />
			</main>
			<p>Footer</p>
		</>
	);
});
