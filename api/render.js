import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { fetchPublicContent, renderDocument, renderLlms } from "../server/site-renderer.mjs";
import { publicPaths } from "../.prerender/entry-server.js";

const template = readFile(join(process.cwd(), ".prerender/template.html"), "utf8");

export default async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");
  if (req.method !== "GET" && req.method !== "HEAD") {
    res.setHeader("Allow", "GET, HEAD");
    res.statusCode = 405;
    return res.end();
  }
  const url = new URL(req.url, "https://localhost");
  const path = url.searchParams.get("page") || url.pathname;
  if (!publicPaths.includes(path) && path !== "/llms.txt") {
    res.statusCode = 404;
    res.setHeader("X-Robots-Tag", "noindex, nofollow");
    return res.end("Página não encontrada");
  }
  try {
    const [html, content] = await Promise.all([template, fetchPublicContent()]);
    const text = path === "/llms.txt" ? renderLlms(content) : renderDocument(html, path, content);
    res.statusCode = 200;
    res.setHeader("Content-Type", path === "/llms.txt" ? "text/plain; charset=utf-8" : "text/html; charset=utf-8");
    if (path !== "/llms.txt") res.setHeader("X-Robots-Tag", "index, follow");
    return res.end(req.method === "HEAD" ? undefined : text);
  } catch {
    res.statusCode = 503;
    res.setHeader("Retry-After", "30");
    res.setHeader("Content-Type", "text/plain; charset=utf-8");
    return res.end(req.method === "HEAD" ? undefined : "Conteúdo temporariamente indisponível. Tente novamente em instantes.");
  }
}
