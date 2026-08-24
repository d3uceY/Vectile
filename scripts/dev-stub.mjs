// Dev-only launcher: plain Vite dev server for the frontend + a middleware
// that answers the Wails runtime backend calls (`POST /wails/runtime`) with
// the deterministic demo data from vectile-stub.mjs. Lets you open the UI in
// a normal browser without the real Go backend / model.
//
//   node scripts/dev-stub.mjs
//
// Reuses the same stub data as the screenshot pipeline so the UI behaves
// identically (search results, collections, settings config, etc.).

import { createServer } from "../frontend/node_modules/vite/dist/node/index.js";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { stub } from "./vectile-stub.mjs";

const frontendRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../frontend");

const stubPlugin = {
  name: "vectile-stub-middleware",
  enforce: "pre",
  configureServer(server) {
    server.middlewares.use(async (req, res, next) => {
      if (req.method === "POST" && req.url?.startsWith("/wails/runtime")) {
        let raw = "";
        for await (const chunk of req) raw += chunk;
        const fakeRequest = {
          url: () => req.url ?? "",
          postDataJSON: () => {
            try {
              return JSON.parse(raw || "{}");
            } catch {
              return null;
            }
          },
        };
        const out = await stub(fakeRequest);
        if (out) {
          res.setHeader("Content-Type", out.contentType ?? "application/json");
          res.end(typeof out.body === "string" ? out.body : JSON.stringify(out.body));
          return;
        }
      }
      next();
    });
  },
};

process.chdir(frontendRoot);
const server = await createServer({
  plugins: [stubPlugin],
  server: { port: 9255, strictPort: false },
});

await server.listen();
const url = server.resolvedUrls?.local?.[0] ?? "http://127.0.0.1:9245";
console.log(`vectile stub dev server ready: ${url}`);

process.on("SIGINT", async () => {
  await server.close();
  process.exit(0);
});
