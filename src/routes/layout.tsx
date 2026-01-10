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
        <Link
          href="/"
          class="group flex flex-shrink-0 items-center gap-2 sm:gap-4"
        >
          <Logo />
          <span class="text-lg font-bold whitespace-nowrap group-hover:underline sm:text-xl">
            MEMEMEMEME
          </span>
        </Link>
        <div class="flex min-w-0 flex-1 items-center justify-end gap-2 sm:gap-4">
          <div class="flex-shrink-0">{session.value?.user && <Search />}</div>
          {session.value?.user && (
            <Link href="/upload" class="flex-shrink-0">
              <Button variant="neutral">Upload</Button>
            </Link>
          )}
          <div class="flex-shrink-0">
            <UserAuth />
          </div>
        </div>
      </Header>
      <main>
        <Slot />
      </main>
      <p></p>
    </>
  );
});
