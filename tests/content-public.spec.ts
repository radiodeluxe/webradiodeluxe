import { test, expect, type Page } from "@playwright/test";
import { defaultSiteContent, type ContentItem, type SiteContent } from "../src/site-content";
import { render } from "../src/entry-server";

function publishedContent(): SiteContent {
  const item = (kind: ContentItem["kind"], title: string, extra: Partial<ContentItem> = {}): ContentItem => ({
    id: `${kind}-edited`, kind, title, description: `Descrição publicada de ${title}.`,
    image_url: null, link_url: `https://example.org/${kind}`,
    time_label: "", days_label: "", position: 1, enabled: true, ...extra,
  });
  return {
    settings: {
      ...defaultSiteContent.settings,
      instagram_url: "https://www.instagram.com/jk.teste/",
      youtube_url: "https://www.youtube.com/@jkteste",
      facebook_url: "https://www.facebook.com/jkteste",
      tiktok_url: "https://www.tiktok.com/@jkteste",
      whatsapp_url: "https://wa.me/5561999999999",
      contact_email: "radio@example.org",
      contact_text: "Fale diretamente com a equipe da frequência de teste.",
    },
    items: [
      item("program", "Programa publicado no painel", { time_label: "10H — 12H", days_label: "DOMINGOS" }),
      item("playlist", "Playlist publicada no painel"),
      item("team", "Pessoa publicada no painel", { time_label: "Apresentação" }),
      item("gallery", "Imagem publicada no painel", { image_url: "/images/battle.webp", description: "Imagem conceitual ilustrativa criada com IA." }),
    ],
  };
}

async function mockPublicContent(page: Page, current: () => SiteContent) {
  await page.route("**/rest/v1/**", async (route) => {
    const pathname = new URL(route.request().url()).pathname;
    const body = pathname.endsWith("/rpc/public_site_content") ? current()
      : pathname.endsWith("/rpc/poll_results") ? null : [];
    await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(body) });
  });
}

async function closeModal(page: Page) {
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog")).not.toBeVisible();
}

test("published programs, playlists, team, gallery and contact channels replace fixed content", async ({ page }) => {
  const content = publishedContent();
  await page.setViewportSize({ width: 1440, height: 1000 });
  await mockPublicContent(page, () => content);
  await page.goto("/");
  await expect(page.locator(".program-card")).toHaveCount(1);
  await expect(page.locator(".program-card strong")).toHaveText("Programa publicado no painel");
  await expect(page.locator(".program-card .program-time")).toHaveText("10H — 12H");
  await expect(page.locator(".program-card .tag")).toHaveText("DOMINGOS");
  await expect(page.locator(".program-card img")).toHaveCount(0);
  await page.locator(".program-card").click();
  await expect(page.getByRole("dialog")).toContainText(content.items[0].description);
  await expect(page.getByRole("dialog").getByRole("link", { name: "Conheça o programa" })).toHaveAttribute("href", "https://example.org/program");
  await closeModal(page);

  await page.locator(".playlist-card").click();
  await expect(page.getByRole("dialog")).toContainText("Playlist publicada no painel");
  await expect(page.getByRole("dialog").getByRole("link", { name: "Abrir playlist" })).toHaveAttribute("href", "https://example.org/playlist");
  await closeModal(page);

  await page.getByRole("navigation", { name: "Navegação principal" }).getByRole("button", { name: "Equipe", exact: true }).click();
  await expect(page.getByRole("dialog")).toContainText("Pessoa publicada no painel");
  await expect(page.getByRole("dialog")).toContainText("Apresentação");
  await expect(page.locator(".public-team-card img")).toHaveCount(0);
  await expect(page.getByRole("link", { name: "Conheça o trabalho" })).toHaveAttribute("href", "https://example.org/team");
  await closeModal(page);

  await page.getByRole("navigation", { name: "Navegação principal" }).getByRole("button", { name: "Galeria", exact: true }).click();
  await expect(page.locator(".gallery figcaption")).toContainText("Imagem conceitual ilustrativa criada com IA.");
  await expect(page.locator(".gallery img")).toHaveAttribute("src", "/images/battle.webp");
  await expect(page.getByRole("link", { name: "Saiba mais" })).toHaveAttribute("href", "https://example.org/gallery");
  await closeModal(page);

  await page.getByRole("button", { name: "Buscar no site" }).click();
  await page.getByLabel("Busque programas e conteúdos").fill("Programa publicado");
  await expect(page.locator(".search-results button")).toHaveCount(1);
  await closeModal(page);
  await expect(page.locator(".instagram-callout h2")).toContainText("@jk.teste");
  await expect(page.getByRole("link", { name: "SEGUIR NO INSTAGRAM" })).toHaveAttribute("href", content.settings.instagram_url!);
  await expect(page.getByRole("link", { name: "Instagram da JK HipHop: @jk.teste" })).toHaveCount(2);
  await page.getByRole("navigation", { name: "Navegação principal" }).getByRole("button", { name: "Contato", exact: true }).click();
  await expect(page.getByRole("dialog")).toContainText(content.settings.contact_text!);
  await expect(page.getByRole("dialog").getByRole("link", { name: "Enviar e-mail" })).toHaveAttribute("href", "mailto:radio@example.org");
  for (const [label, url] of [["WhatsApp", content.settings.whatsapp_url], ["Facebook", content.settings.facebook_url], ["TikTok", content.settings.tiktok_url], ["YouTube", content.settings.youtube_url]] as const) {
    await expect(page.getByRole("dialog").getByRole("link", { name: label })).toHaveAttribute("href", url!);
  }
  await closeModal(page);
  await page.goto("/contato");
  await expect(page.locator(".site-page-lead")).toHaveText(content.settings.contact_text!);
  await expect(page.locator(".contact-channels").getByRole("link", { name: "Enviar e-mail" })).toHaveAttribute("href", "mailto:radio@example.org");
  await expect(page.locator(".contact-channels").getByRole("link", { name: "@jk.teste" })).toHaveAttribute("href", content.settings.instagram_url!);
});

test("removing published items and social links does not revive default content", async ({ page }) => {
  let content = publishedContent();
  await page.setViewportSize({ width: 1440, height: 1000 });
  await mockPublicContent(page, () => content);
  await page.goto("/");
  await expect(page.locator(".program-card")).toHaveCount(1);
  content = {
    items: [],
    settings: Object.fromEntries(Object.keys(defaultSiteContent.settings).map((key) => [key, null])) as SiteContent["settings"],
  };
  await page.evaluate(() => window.dispatchEvent(new Event("focus")));
  await expect(page.locator(".program-card")).toHaveCount(0);
  await expect(page.locator(".playlist-card")).toHaveCount(0);
  await expect(page.locator(".instagram-callout")).toHaveCount(0);
  await expect(page.locator('a[href*="instagram.com"], a[href*="youtube.com"], a[href*="facebook.com"], a[href*="tiktok.com"], a[href*="wa.me"], a[href^="mailto:"]')).toHaveCount(0);
  await page.getByRole("navigation", { name: "Navegação principal" }).getByRole("button", { name: "Equipe", exact: true }).click();
  await expect(page.getByRole("dialog")).toContainText("ainda não publicou os integrantes");
  await closeModal(page);
  await page.getByRole("navigation", { name: "Navegação principal" }).getByRole("button", { name: "Galeria", exact: true }).click();
  await expect(page.getByRole("dialog")).toContainText("ainda não publicou imagens");
  await closeModal(page);
  await page.goto("/programacao");
  await expect(page.locator(".site-page-program")).toHaveCount(0);
  await expect(page.getByText("A programação está sendo atualizada. Volte em breve.")).toBeVisible();
  await page.goto("/contato");
  await expect(page.getByText("Os canais de contato serão divulgados pela rádio em breve.")).toBeVisible();
  await expect(page.locator('a[href*="instagram.com"]')).toHaveCount(0);
});

test("server content hydrates without errors and refreshes after a master publication", async ({ page }) => {
  let content = publishedContent();
  const initial = structuredClone(content);
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await mockPublicContent(page, () => content);
  await page.route("**/programacao", async (route) => {
    const response = await route.fetch();
    let document = await response.text();
    const rendered = render("/programacao", initial);
    const start = document.indexOf('<div id="root"');
    const end = document.indexOf("<noscript>", start);
    expect(start).toBeGreaterThan(-1);
    expect(end).toBeGreaterThan(start);
    document = document.slice(0, start) + `<div id="root" data-prerender="true">${rendered.html}</div>\n` + document.slice(end);
    document = document.replace(/<script[^>]*id="site-content"[^>]*>[\s\S]*?<\/script>/g, "");
    const snapshot = JSON.stringify(initial).replace(/</g, "\\u003c");
    document = document.replace("</head>", `<script id="site-content" type="application/json">${snapshot}</script></head>`);
    await route.fulfill({ response, body: document });
  });
  await page.goto("/programacao");
  await expect(page.locator("#root")).toHaveAttribute("data-prerender", "true");
  await expect(page.getByRole("heading", { name: "Programa publicado no painel" })).toBeVisible();
  await expect(page.locator(".site-page-program")).toContainText("10H — 12H · DOMINGOS");
  await expect(page.locator(".site-page-program").getByRole("link", { name: "Conheça o programa" })).toHaveAttribute("href", "https://example.org/program");
  content = { ...content, items: content.items.map(item => item.kind === "program" ? { ...item, title: "Programa atualizado sem novo deploy" } : item) };
  await page.evaluate(() => window.dispatchEvent(new Event("focus")));
  await expect(page.getByRole("heading", { name: "Programa atualizado sem novo deploy" })).toBeVisible();
  expect(errors).toEqual([]);
});
