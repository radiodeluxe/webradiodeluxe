import { defineConfig, loadEnv } from "vite";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import react from "@vitejs/plugin-react";
import pollHandler from "./api/poll.js";
import appHandler from "./api/app.js";
import { publicPaths } from "./src/seo.ts";

function attachLocalApis(server, mode) {
  const env = loadEnv(mode, server.config.root, "");
  for (const key of [
    "POLL_WRITE_SECRET",
    "VITE_SUPABASE_URL",
    "VITE_SUPABASE_PUBLISHABLE_KEY",
  ])
    if (env[key]) process.env[key] = env[key];
  for (const [path, handler] of [
    ["/api/poll", pollHandler],
    ["/api/app", appHandler],
  ]) {
    server.middlewares.use(path, async (req, res) => {
      let body = "";
      for await (const chunk of req) {
        body += chunk;
        if (body.length > 4096) {
          res.statusCode = 413;
          res.end();
          return;
        }
      }
      req.body = body;
      res.status = (status) => {
        res.statusCode = status;
        return res;
      };
      res.json = (value) => {
        res.setHeader("Content-Type", "application/json; charset=utf-8");
        res.end(JSON.stringify(value));
        return res;
      };
      await handler(req, res);
    });
  }
}

export default defineConfig(({ mode }) => ({
  plugins: [
    react(),
    {
      name: "preview-static-pages",
      configurePreviewServer(server) {
        const pages = new Set(publicPaths);
        const renderer = import(
          pathToFileURL(resolve(server.config.root, "server/site-renderer.mjs"))
            .href
        );
        const template = readFile(
          resolve(server.config.root, ".prerender/template.html"),
          "utf8",
        );
        const publicEnv = {
          ...loadEnv(mode, server.config.root, "VITE_"),
          ...process.env,
        };
        const aliases = new Map(
          publicPaths.map((path) => [
            `${path === "/" ? "" : path}/index.html`,
            path,
          ]),
        );
        server.middlewares.use(async (req, res, next) => {
          const url = new URL(req.url || "/", "http://localhost");
          const path = url.pathname.replace(/\/+$/, "") || "/";
          const canonical = aliases.get(path);
          if (canonical !== undefined) {
            res.statusCode = 308;
            res.setHeader("Location", `${canonical}${url.search}`);
            res.end();
            return;
          }
          if (pages.has(path) || path === "/llms.txt") {
            try {
              const api = await renderer;
              const [html, content] = await Promise.all([
                template,
                api.fetchPublicContent(publicEnv),
              ]);
              res.statusCode = 200;
              res.setHeader("Cache-Control", "no-store");
              res.setHeader(
                "Content-Type",
                path === "/llms.txt"
                  ? "text/plain; charset=utf-8"
                  : "text/html; charset=utf-8",
              );
              res.end(
                path === "/llms.txt"
                  ? api.renderLlms(content)
                  : api.renderDocument(html, path, content),
              );
            } catch {
              res.statusCode = 503;
              res.end("Conteúdo temporariamente indisponível.");
            }
            return;
          }
          if (/^\/admin(?:\/|$)/.test(path)) {
            req.url = `/admin/index.html${url.search}`;
            res.setHeader("X-Robots-Tag", "noindex, nofollow");
            next();
            return;
          }
          if (path === "/aplicativo") {
            req.url = `/aplicativo/index.html${url.search}`;
            res.setHeader("X-Robots-Tag", "noindex, follow");
            next();
            return;
          }
          if (
            path.startsWith("/api/") ||
            (path.includes(".") && !path.endsWith(".html")) ||
            path === "/404.html"
          ) {
            next();
            return;
          }
          try {
            const html = await readFile(
              resolve(
                server.config.root,
                server.config.build.outDir,
                "404.html",
              ),
            );
            res.statusCode = 404;
            res.setHeader("Content-Type", "text/html; charset=utf-8");
            res.setHeader("X-Robots-Tag", "noindex, follow");
            res.end(html);
          } catch (error) {
            next(error);
          }
        });
      },
    },
    {
      name: "local-poll-api",
      configureServer(server) {
        attachLocalApis(server, mode);
      },
      configurePreviewServer(server) {
        attachLocalApis(server, mode);
      },
    },
  ],
  build: {
    rollupOptions: {
      input: {
        site: resolve("index.html"),
        aplicativo: resolve("aplicativo/index.html"),
      },
    },
  },
}));
