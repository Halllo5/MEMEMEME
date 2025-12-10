import { component$, Slot, type PropsOf } from "@builder.io/qwik";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "../lib/util";

const headerVariants = cva("flex items-center justify-between p-4 border-b-2", {
  variants: {
    variant: {
      default: "bg-background text-foreground",
      transparent: "bg-transparent text-white",
    },
  },
  defaultVariants: {
    variant: "default",
  },
});

type HeaderProps = PropsOf<"header"> & VariantProps<typeof headerVariants>;

const Header = component$<HeaderProps>(
  ({ class: className, variant, ...props }) => {
    return (
      <header class={cn(headerVariants({ variant, className }))} {...props}>
        <Slot />
      </header>
    );
  },
);

export { Header, headerVariants };
