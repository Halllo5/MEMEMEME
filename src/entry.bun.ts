/*
 * WHAT IS THIS FILE?
 *
 * It's the entry point for the Bun HTTP server when building for production.
 *
 * Learn more about the Bun integration here:
 * - https://qwik.dev/docs/deployments/bun/
 * - https://bun.sh/docs/api/http
 *
 */
import { join } from "node:path";
import { createQwikCity } from "@builder.io/qwik-city/middleware/bun";
import qwikCityPlan from "@qwik-city-plan";
import render from "./entry.ssr";

// Create the Qwik City Bun middleware
const { router, notFound, staticFile } = createQwikCity({
  render,
  qwikCityPlan,
  static: {
    cacheControl: "public, max-age=31536000, immutable",
  },
});

const distDir = join(import.meta.dir, "..", "dist");

// Allow for dynamic port
const port = Number(Bun.env.PORT ?? 3000);

// eslint-disable-next-line no-console
console.log(`Server started: http://localhost:${port}/`);

Bun.serve({
  async fetch(request: Request) {
    const proto = request.headers.get("x-forwarded-proto");
    if (proto === "https" && request.url.startsWith("http://")) {
      const url = new URL(request.url);
      url.protocol = "https:";
      request = new Request(url.toString(), request);
    }

    // Serve q-manifest.json with no-cache to avoid stale symbol→chunk mappings after deploy
    const url = new URL(request.url);
    if (url.pathname === "/q-manifest.json" || url.pathname.endsWith("/q-manifest.json")) {
      const manifestPath = join(distDir, "q-manifest.json");
      const file = Bun.file(manifestPath);
      if (await file.exists()) {
        return new Response(await file.text(), {
          headers: {
            "Content-Type": "application/json",
            "Cache-Control": "no-cache, max-age=0, must-revalidate",
          },
        });
      }
    }

    const staticResponse = await staticFile(request);
    if (staticResponse) {
      return staticResponse;
    }

    // Server-side render this request with Qwik City
    const qwikCityResponse = await router(request);
    if (qwikCityResponse) {
      return qwikCityResponse;
    }

    // Path not found
    return notFound(request);
  },
  port,
});
