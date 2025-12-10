import { component$ } from "@builder.io/qwik";
import { cn } from "../lib/util";

const emojis = ["🚀", "🍕", "🎉", "🌟", "🔥", "💡", "💻", "❤️", "💎", "💯"];

export const Logo = component$(() => {
  // This will be executed on the server, and the result will be serialized
  // and sent to the client. The client will reuse the server-generated emoji
  // on initial load, preventing a mismatch.
  const emoji = emojis[Math.floor(Math.random() * emojis.length)];

  return (
    <div
      class={cn(
        "rounded-base font-base inline-flex items-center justify-center transition-all",
        "text-main-foreground bg-main border-border shadow-shadow group-hover:translate-x-boxShadowX group-hover:translate-y-boxShadowY border-2 group-hover:shadow-none",
        "size-12 text-2xl",
      )}
    >
      <span>{emoji}</span>
    </div>
  );
});
