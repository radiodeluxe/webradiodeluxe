import { defineConfig, loadEnv } from "vite";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import react from "@vitejs/plugin-react";
import pollHandler from "./api/poll.js";
import { publicPaths } from "./src/seo.ts";

export default defineConfig(({ mode }) => ({
  plugins: [
    react(),
    {
      name: "preview-static-pages",
      configurePreviewServer(server) {
        const pages = new Set(publicPaths);
        const aliases = new Map(publicPaths.map(path => [`${path === "/" ? "" : path}/index.html`, path]));
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
          if (pages.has(path)) {
            // The alias redirect runs once, before this internal file rewrite.
            req.url = `${path === "/" ? "" : path}/index.html${url.search}`;
            next();
            return;
          }
          if (/^\/admin(?:\/|$)/.test(path)) {
            req.url = `/admin/index.html${url.search}`;
            res.setHeader("X-Robots-Tag", "noindex, nofollow");
            next();
            return;
          }
          if (path.startsWith("/api/") || (path.includes(".") && !path.endsWith(".html")) || path === "/404.html") {
            next();
            return;
          }
          try {
            const html = await readFile(resolve(server.config.root, server.config.build.outDir, "404.html"));
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
        const env = loadEnv(mode, process.cwd(), "");
        for (const key of [
          "POLL_WRITE_SECRET",
          "VITE_SUPABASE_URL",
          "VITE_SUPABASE_PUBLISHABLE_KEY",
        ])
          if (env[key]) process.env[key] = env[key];
        server.middlewares.use("/api/poll", async (req, res) => {
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
            res.setHeader("Content-Type", "application/json");
            res.end(JSON.stringify(value));
            return res;
          };
          await pollHandler(req, res);
        });
      },
    },
  ],
}));
