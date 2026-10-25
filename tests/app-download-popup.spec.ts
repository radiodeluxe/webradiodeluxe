import { expect, test, type Page } from "@playwright/test";
import { defaultSiteContent } from "../src/site-content";

const popupName = "Leve a JK HipHop com você";
const sessionKey = "jk-app-download-popup-v1";
const start = new Date("2026-10-25T15:00:00Z");

async function prepareVisitor(page: Page) {
  await page.clock.install({ time: start });
  await page.clock.pauseAt(new Date(start.getTime() + 1_000));
  await page.route("**/rest/v1/**", async (route) => {
    const pathname = new URL(route.request().url()).pathname;
    const data = pathname.endsWith("/rpc/public_site_content")
      ? defaultSiteContent
      : pathname.endsWith("/rpc/poll_results")
        ? null
        : [];
    await route.fulfill({ status: 200, json: data });
  });
}

async function home(page: Page) {
  await page.goto("/");
  // This effect runs after hydration, so advancing the clock cannot race SSR.
  await expect(page.locator("#programacao")).toHaveClass(/scroll-reveal/);
}

test("automatic app promotion provides the real download, preserves focus, and stays dismissed on reload", async ({
  page,
}) => {
  await prepareVisitor(page);
  await page.setViewportSize({ width: 1440, height: 1000 });
  await home(page);
  const popup = page.getByRole("dialog", { name: popupName });
  const search = page.getByRole("button", { name: "Buscar no site" });
  await search.focus();
  const overflow = await page.evaluate(() => document.body.style.overflow);
  await expect(popup).not.toBeVisible();
  await page.clock.fastForward(1_300);
  await expect(popup).toBeVisible();
  await expect(popup.getByRole("heading", { name: popupName })).toBeVisible();
  await expect(
    popup.getByRole("link", { name: "Baixar app para Android", exact: true }),
  ).toHaveAttribute("href", "/downloads/jk-hiphop.apk");
  await expect(
    popup.locator('img[src="/images/app-download-popup.webp"]'),
  ).toBeVisible();
  await expect
    .poll(() =>
      popup
        .locator("img")
        .evaluate(
          (image: HTMLImageElement) => image.complete && image.naturalWidth > 0,
        ),
    )
    .toBe(true);
  expect(
    await page.evaluate((key) => sessionStorage.getItem(key), sessionKey),
  ).toBeTruthy();
  await expect(page.locator("body")).toHaveCSS("overflow", "hidden");

  await page.keyboard.press("Shift+Tab");
  await expect(popup.getByRole("button", { name: "Agora não", exact: true })).toBeFocused();
  await page.keyboard.press("Tab");
  await expect(popup.getByRole("button", { name: "Fechar divulgação do aplicativo" })).toBeFocused();

  for (let i = 0; i < 7; i += 1) {
    await page.keyboard.press("Tab");
    expect(
      await popup.evaluate((dialog) => dialog.contains(document.activeElement)),
    ).toBe(true);
  }
  await popup
    .getByRole("button", { name: "Fechar divulgação do aplicativo" })
    .click();
  await expect(popup).not.toBeVisible();
  await expect(search).toBeFocused();
  expect(await page.evaluate(() => document.body.style.overflow)).toBe(
    overflow,
  );
  await page.reload();
  await expect(page.locator("#programacao")).toHaveClass(/scroll-reveal/);
  await page.clock.fastForward(5_000);
  await expect(popup).not.toBeVisible();
});

test("a separate visitor session is shown the app promotion again", async ({
  page,
  browser,
}) => {
  await prepareVisitor(page);
  await home(page);
  await page.clock.fastForward(1_300);
  await page
    .getByRole("dialog", { name: popupName })
    .getByRole("button", { name: "Agora não", exact: true })
    .click();
  const anotherVisitor = await browser.newContext({
    baseURL: test.info().project.use.baseURL,
  });
  try {
    const anotherPage = await anotherVisitor.newPage();
    await prepareVisitor(anotherPage);
    await home(anotherPage);
    await anotherPage.clock.fastForward(1_300);
    await expect(
      anotherPage.getByRole("dialog", { name: popupName }),
    ).toBeVisible();
  } finally {
    await anotherVisitor.close();
  }
});

for (const action of ["Escape", "backdrop", "Agora não"] as const) {
  test(`visitor can dismiss the promotion using ${action}`, async ({
    page,
  }) => {
    await prepareVisitor(page);
    await page.setViewportSize({ width: 1440, height: 1000 });
    await home(page);
    await page.clock.fastForward(1_300);
    const popup = page.getByRole("dialog", { name: popupName });
    await expect(popup).toBeVisible();
    if (action === "Escape") await page.keyboard.press("Escape");
    else if (action === "backdrop") await page.mouse.click(5, 5);
    else
      await popup
        .getByRole("button", { name: "Agora não", exact: true })
        .click();
    await expect(popup).not.toBeVisible();
    await page.clock.fastForward(5_000);
    await expect(popup).not.toBeVisible();
    expect(await page.evaluate(() => document.body.style.overflow)).not.toBe(
      "hidden",
    );
  });
}

test("automatic promotion waits for an existing site dialog to close", async ({
  page,
}) => {
  await prepareVisitor(page);
  await home(page);
  await page.getByRole("button", { name: "Buscar no site" }).click();
  await expect(page.getByLabel("Busque programas e conteúdos")).toBeVisible();
  await page.getByLabel("Busque programas e conteúdos").focus();
  await page.clock.fastForward(2_000);
  await expect(page.getByRole("dialog", { name: popupName })).not.toBeVisible();
  await expect(page.locator("dialog[open]")).toHaveCount(1);
  await expect(page.getByLabel("Busque programas e conteúdos")).toBeFocused();
  await page.keyboard.press("Escape");
  await expect(
    page.getByLabel("Busque programas e conteúdos"),
  ).not.toBeVisible();
  await page.clock.fastForward(400);
  await expect(page.getByRole("dialog", { name: popupName })).toBeVisible();
});

for (const width of [320, 390, 1440]) {
  test(`app promotion fits ${width}px and keeps its controls reachable`, async ({
    page,
  }) => {
    await prepareVisitor(page);
    await page.setViewportSize({ width, height: 740 });
    await home(page);
    await page.clock.fastForward(1_300);
    const popup = page.getByRole("dialog", { name: popupName });
    await expect(popup).toBeVisible();
    const bounds = await popup.boundingBox();
    expect(bounds).not.toBeNull();
    expect(bounds!.x).toBeGreaterThanOrEqual(0);
    expect(bounds!.y).toBeGreaterThanOrEqual(0);
    expect(bounds!.x + bounds!.width).toBeLessThanOrEqual(width);
    expect(bounds!.y + bounds!.height).toBeLessThanOrEqual(740);
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
    const download = popup.getByRole("link", {
      name: "Baixar app para Android",
      exact: true,
    });
    await download.scrollIntoViewIfNeeded();
    await expect(download).toBeInViewport();
    await expect(
      popup.getByRole("button", { name: "Fechar divulgação do aplicativo" }),
    ).toBeInViewport();
    if (width === 390)
      await page.screenshot({
        path: "artifacts/app-download-popup-mobile.png",
      });
  });
}

test("a short mobile screen allows scrolling to dismiss without motion or page scrolling", async ({
  page,
}) => {
  await prepareVisitor(page);
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.setViewportSize({ width: 390, height: 480 });
  await home(page);
  const pageScroll = await page.evaluate(() => window.scrollY);
  await page.clock.fastForward(1_300);
  const popup = page.getByRole("dialog", { name: popupName });
  await expect(popup).toBeVisible();
  await expect(popup).toHaveCSS("animation-name", "none");
  const bounds = await popup.boundingBox();
  expect(bounds).not.toBeNull();
  expect(bounds!.y).toBeGreaterThanOrEqual(0);
  expect(bounds!.y + bounds!.height).toBeLessThanOrEqual(480);
  const later = popup.getByRole("button", { name: "Agora não", exact: true });
  await later.scrollIntoViewIfNeeded();
  await expect(later).toBeInViewport();
  expect(await popup.evaluate((element) => element.scrollTop)).toBeGreaterThan(
    0,
  );
  expect(await page.evaluate(() => window.scrollY)).toBe(pageScroll);
  await page.screenshot({
    path: "artifacts/app-download-popup-short-screen.png",
  });
  await later.click();
  await expect(popup).not.toBeVisible();
  expect(await page.evaluate(() => document.body.style.overflow)).not.toBe(
    "hidden",
  );
});

test("the promotion does not interrupt administrative, app, or institutional pages", async ({
  page,
}) => {
  await prepareVisitor(page);
  await page.route("**/api/app", (route) =>
    route.fulfill({
      json: {
        schema_version: 1,
        settings: {
          radio_name: "JK HipHop",
          tagline: "O rap em alto nível.",
          show_poll: false,
          show_contact: false,
          banner_interval_seconds: 15,
          logo_url: null,
          background_url: null,
        },
        radio: {},
        banners: [],
        poll: null,
        poll_available: true,
      },
    }),
  );
  for (const path of [
    "/admin",
    "/aplicativo",
    "/privacidade",
    "/programacao",
  ]) {
    await page.goto(path);
    await page.clock.fastForward(5_000);
    await expect(page.getByRole("dialog", { name: popupName })).toHaveCount(0);
    expect(
      await page.evaluate((key) => sessionStorage.getItem(key), sessionKey),
    ).toBeNull();
  }
});
