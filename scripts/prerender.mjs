import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import {
  getPageSeo,
  INSTAGRAM_URL,
  programs,
  publicPaths,
  render,
  SITE_URL,
} from "../.prerender/entry-server.js";

const output = resolve("dist");
const template = await readFile(resolve(output, "index.html"), "utf8");
const paths = [...publicPaths, "/admin", "/404"];

function replaceRegion(html, region, content) {
  // Root-level whitespace is a real DOM text node and would make hydration
  // disagree with React's first element, even when the visible HTML matches.
  const marker = new RegExp(`\\s*<!--${region}-start-->[\\s\\S]*?<!--${region}-end-->\\s*`);
  if (!marker.test(html)) throw new Error(`Marcador de prerender ausente: ${region}`);
  return html.replace(marker, () => content);
}

for (const path of paths) {
  const { html, head, prerendered } = render(path);
  let document = replaceRegion(template, "seo-head", head);
  document = replaceRegion(document, "app-html", html);
  if (prerendered)
    document = document.replace('<div id="root">', '<div id="root" data-prerender="true">');

  const file = path === "/" ? "index.html" : path === "/404" ? "404.html" : `${path.slice(1)}/index.html`;
  const destination = resolve(output, file);
  await mkdir(dirname(destination), { recursive: true });
  await writeFile(destination, document);
}

const urls = publicPaths.map((path) => new URL(path, SITE_URL).href);
const escapeXml = (value) => value.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll('"', "&quot;");
await writeFile(
  resolve(output, "sitemap.xml"),
  `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls.map((url) => `  <url><loc>${escapeXml(url)}</loc></url>`).join("\n")}\n</urlset>\n`,
);
await writeFile(
  resolve(output, "robots.txt"),
  `User-agent: *\nAllow: /\nDisallow: /admin\nDisallow: /api/\n\nSitemap: ${SITE_URL}/sitemap.xml\n`,
);

const references = publicPaths.map((path) => {
  const page = getPageSeo(path);
  return `- [${page.title}](${new URL(path, SITE_URL).href}): ${page.description}`;
});
await writeFile(
  resolve(output, "llms.txt"),
  `# JK HipHop\n\n> Web rádio em português dedicada ao rap nacional, rap internacional e à cultura hip-hop.\n\nSite oficial: ${SITE_URL}/\nInstagram informado pela rádio: ${INSTAGRAM_URL}\nIdioma: português do Brasil (pt-BR).\n\n## Páginas oficiais\n\n${references.join("\n")}\n\n## Programas\n\n${programs.map((program) => `- **${program.title}**: ${program.description}`).join("\n")}\n\n## Contexto para leitura e citação\n\n- O estado atual da transmissão é informado no player do site.\n- Consulte a página de programação para informações sobre os programas e a disponibilidade dos horários.\n- Notícias de fontes externas são identificadas com a fonte e o link original. Não as atribua como reportagem original da rádio.\n- As regras de publicação e correção estão na política editorial.\n- A área administrativa e as APIs não são fontes de conteúdo público.\n- Este arquivo facilita a consulta; não é autorização para reproduzir músicas, imagens ou textos de terceiros.\n`,
);

console.log(`Prerender concluído: ${publicPaths.length} páginas públicas, painel isolado e página 404.`);
