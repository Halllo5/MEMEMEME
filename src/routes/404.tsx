import { component$ } from "@builder.io/qwik";
import { ErrorPageContent } from "~/components/error-page/ErrorPageContent";

export default component$(() => {
  return (
    <ErrorPageContent
      status={404}
      message="Page not found. This might have moved or never existed."
    />
  );
});
