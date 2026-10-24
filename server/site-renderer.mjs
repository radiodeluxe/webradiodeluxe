import { render, normalizeSiteContent, publicPaths, SITE_URL, getPageSeo } from "../.prerender/entry-server.js";

export async function fetchPublicContent(env = process.env, request = fetch) {
  const url = env.VITE_SUPABASE_URL;
  const key = env.VITE_SUPABASE_PUBLISHABLE_KEY;
  if (!url || !key) throw new Error("Public content connection unavailable");
  const response = await request(`${url}/rest/v1/rpc/public_site_content`, {
    method: "POST",
    headers: { apikey: key, Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    body: "{}", signal: AbortSignal.timeout(5000),
  });
  if (!response.ok) throw new Error("Public content unavailable");
  const snapshot = normalizeSiteContent(await response.json());
  if (!snapshot) throw new Error("Invalid public content response");
  return snapshot;
}

export function serializeSnapshot(content) {
  return JSON.stringify(content).replace(/</g, "\\u003c").replace(/>/g, "\\u003e")
    .replace(/&/g, "\\u0026").replace(/\u2028/g, "\\u2028").replace(/\u2029/g, "\\u2029");
}

export function renderDocument(template, path, content) {
  const result = render(path, content);
  let document = template;
  for (const [region, value] of [["seo-head", result.head], ["app-html", result.html]]) {
    const marker = new RegExp(`\\s*<!--${region}-start-->[\\s\\S]*?<!--${region}-end-->\\s*`);
    if (!marker.test(document)) throw new Error(`Missing document region: ${region}`);
    document = document.replace(marker, () => value);
  }
  if (result.prerendered) {
    document = document.replace('<div id="root">', '<div id="root" data-prerender="true">');
    document = document.replace("</body>", `<script id="site-content" type="application/json">${serializeSnapshot(content)}</script></body>`);
  }
  return document;
}

export function renderLlms(content) {
  const instagram = content.settings.instagram_url;
  const references = publicPaths.map(path => {
    const page = getPageSeo(path, content);
    return `- [${page.title}](${new URL(path, SITE_URL).href}): ${page.description}`;
  });
  return `# JK HipHop\n\n> Web rádio em português dedicada ao rap nacional, rap internacional e à cultura hip-hop.\n\nSite oficial: ${SITE_URL}/\n${instagram ? `Instagram informado pela rádio: ${instagram}\n` : ""}Idioma: português do Brasil (pt-BR).\n\n## Páginas oficiais\n\n${references.join("\n")}\n\n## Programas\n\n${content.items.filter(item => item.kind === "program").map(item => `- **${item.title}**: ${item.description}`).join("\n")}\n\n## Contexto para leitura e citação\n\n- O estado atual da transmissão é informado no player do site.\n- Consulte a página de programação para informações sobre os programas e a disponibilidade dos horários.\n- Notícias de fontes externas são identificadas com a fonte e o link original. Não as atribua como reportagem original da rádio.\n- As regras de publicação e correção estão na política editorial.\n- A área administrativa e as APIs não são fontes de conteúdo público.\n- Este arquivo facilita a consulta; não é autorização para reproduzir músicas, imagens ou textos de terceiros.\n`;
}
