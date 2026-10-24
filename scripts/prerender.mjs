import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { loadEnv } from "vite";
import { publicPaths, SITE_URL } from "../.prerender/entry-server.js";
import { fetchPublicContent, renderDocument, renderLlms } from "../server/site-renderer.mjs";

const output = resolve("dist");
const template = await readFile(resolve(output, "index.html"), "utf8");
const content = await fetchPublicContent({ ...loadEnv("production", process.cwd(), "VITE_"), ...process.env });
// Keep the asset references and document regions for request-time rendering.
await writeFile(resolve(".prerender/template.html"), template);
for (const path of [...publicPaths, "/admin", "/404"]) {
  const document = renderDocument(template, path, content);
  const file = path === "/" ? "index.html" : path === "/404" ? "404.html" : `${path.slice(1)}/index.html`;
  const destination = resolve(output, file);
  await mkdir(dirname(destination), { recursive: true });
  await writeFile(destination, document);
}
const urls = publicPaths.map(path => new URL(path, SITE_URL).href);
const escapeXml = value => value.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll('"', "&quot;");
await writeFile(resolve(output, "sitemap.xml"), `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls.map(url => `  <url><loc>${escapeXml(url)}</loc></url>`).join("\n")}\n</urlset>\n`);
await writeFile(resolve(output, "robots.txt"), `User-agent: *\nAllow: /\nDisallow: /admin\nDisallow: /api/\n\nSitemap: ${SITE_URL}/sitemap.xml\n`);
await writeFile(resolve(output, "llms.txt"), renderLlms(content));
console.log(`Prerender concluído: ${publicPaths.length} páginas públicas com conteúdo do painel, painel isolado e página 404.`);
