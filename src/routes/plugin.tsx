import type { RequestHandler } from "@builder.io/qwik-city";
import {
  RedirectMessage,
  ServerError,
} from "@builder.io/qwik-city/middleware/request-handler";
import { isDev } from "@builder.io/qwik/build";
import { renderToString } from "@builder.io/qwik/server";
import { ErrorPageContent } from "~/components/error-page/ErrorPageContent";

const ERROR_PAGE_STYLES = `
:root {
  --error-page-background: oklch(96.22% 0.0569 95.61);
  --error-page-card: oklch(100% 0 0);
  --error-page-foreground: oklch(0% 0 0);
  --error-page-main: oklch(84.08% 0.1725 84.2);
  --error-page-border: oklch(0% 0 0);
  --error-page-shadow: 4px 4px 0px 0px var(--error-page-border);
}
@media (prefers-color-scheme: dark) {
  :root {
    --error-page-background: oklch(28.91% 0.0359 90.09);
    --error-page-card: oklch(23.93% 0 0);
    --error-page-foreground: oklch(92.49% 0 0);
    --error-page-main: oklch(77.7% 0.159 84.38);
  }
}
* { box-sizing: border-box; }
body {
  margin: 0;
  min-height: 100vh;
  background: var(--error-page-background);
  color: var(--error-page-foreground);
  font-family: ui-sans-serif, system-ui, sans-serif;
  font-weight: 500;
  padding: 2rem 1rem;
  display: flex;
  align-items: center;
  justify-content: center;
}
`;

async function getThemedErrorHtml(status: number, message: string): Promise<string> {
  const statusLabel =
    status >= 500 ? "Internal Server Error" : status === 404 ? "Not Found" : "Error";

  const { html } = await renderToString(
    <>
      <head>
        <meta charset="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <title>{`${status} ${statusLabel} | Memememe`}</title>
        <style dangerouslySetInnerHTML={ERROR_PAGE_STYLES} />
      </head>
      <body>
        <ErrorPageContent status={status} message={message} />
      </body>
    </>,
    {
      base: "/",
      snapshot: false,
      containerAttributes: { lang: "en" },
    },
  );

  return html;
}

export const onRequest: RequestHandler = async (ev) => {
  try {
    return await ev.next();
  } catch (err) {
    if (err instanceof RedirectMessage) throw err;

    let status = 500;
    let message = "Internal server error";

    if (err instanceof ServerError) {
      status = err.status;
      message =
        typeof err.data === "string" ? err.data : String(err.data ?? message);
    } else {
      console.error("Unhandled error:", err);
      if (isDev) throw err;
    }

    const html = await getThemedErrorHtml(status, message);
    ev.status(status);
    ev.html(status, html);
  }
};
