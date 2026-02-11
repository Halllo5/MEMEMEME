import { component$ } from "@builder.io/qwik";
import { Form, Link } from "@builder.io/qwik-city";
import { useSession, useSignIn, useSignOut } from "~/routes/plugin@auth";
import { Button } from "~/components/button";

export const UserAuth = component$(() => {
  const session = useSession();
  const signin = useSignIn();
  const signout = useSignOut();

  if (session.value?.user) {
    const user = session.value.user;
    const initials = (user.name || user.email)?.substring(0, 2);

    return (
      <div class="group relative">
        <button class="flex items-center gap-2">
          <span class="hidden text-sm font-bold md:block">{user.name}</span>

          {user.image ? (
            <img
              src={user.image}
              alt={initials?.toUpperCase()}
              width={48}
              height={48}
              loading="lazy"
              class="border-border shadow-shadow group-hover:translate-x-boxShadowX group-hover:translate-y-boxShadowY rounded-base text-md size-12 items-center justify-center border-2 transition-all group-hover:shadow-none"
            />
          ) : (
            <div class="border-border bg-main text-main-foreground shadow-shadow group-hover:translate-x-boxShadowX group-hover:translate-y-boxShadowY rounded-base text-md flex size-12 items-center justify-center border-2 font-medium transition-all group-hover:shadow-none">
              {initials?.toUpperCase()}
            </div>
          )}
        </button>
        <div class="rounded-base border-border bg-background shadow-shadow absolute top-full right-0 mt-2 hidden w-48 border-2 group-focus-within:block group-hover:block">
          <div class="p-2">
            <Link
              href={`/u/${user.id}`}
              class="text-foreground decoration-main text-sm underline decoration-2"
            >
              {user.email}
            </Link>
          </div>
          <div class="border-border border-t-2 p-2">
            <Link
              href={`/u/${user.id}/shares`}
              class="text-foreground decoration-main text-sm underline decoration-2"
            >
              My Shares
            </Link>
          </div>
          <div class="border-border border-t-2 p-2">
            <Form action={signout}>
              <input type="hidden" name="options.callbackUrl" value="/" />
              <Button class="w-full justify-start">Sign Out</Button>
            </Form>
          </div>
        </div>
      </div>
    );
  }

  return (
    <Form action={signin}>
      <input type="hidden" name="providerId" value="oidc" />
      <Button variant="default">Sign In</Button>
    </Form>
  );
});
