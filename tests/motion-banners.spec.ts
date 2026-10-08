import { expect, test } from "@playwright/test";

test("scroll reveals below-fold sections with zoom and keeps them visible", async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: "no-preference" });
  await page.goto("/");
  const program = page.locator("#programacao");
  await expect(program).toHaveClass(/reveal-pending/);
  const before = await program.evaluate((el) => getComputedStyle(el).transform);
  expect(before).not.toBe("none");
  await program.scrollIntoViewIfNeeded();
  await expect(program).toHaveClass(/reveal-visible/);
  await expect
    .poll(() => program.evaluate((el) => getComputedStyle(el).opacity))
    .toBe("1");
  await page.evaluate(() => window.scrollTo({ top: 0, behavior: "instant" }));
  await expect(program).not.toHaveClass(/reveal-pending/);
});

test("loading equalizer lasts only while news request is pending", async ({
  page,
}) => {
  let request: import("@playwright/test").Route | undefined;
  await page.route("**/rest/v1/news_posts?*", (route) => {
    request = route;
  });
  await page.goto("/");
  const loader = page.locator(".news-section .deluxe-loader");
  await loader.scrollIntoViewIfNeeded();
  await expect(loader).toBeVisible();
  await expect(loader).toContainText("Buscando as últimas notícias");
  expect(
    await loader
      .locator(".loader-wave i")
      .first()
      .evaluate((el) => getComputedStyle(el).animationName),
  ).toBe("deluxe-wave");
  await expect.poll(() => !!request).toBe(true);
  await request!.fulfill({
    status: 200,
    contentType: "application/json",
    body: "[]",
  });
  await expect(loader).toHaveCount(0);
  await expect(
    page.getByText("As próximas notícias de música chegam por aqui em breve."),
  ).toBeVisible();
});

test("reduced motion exposes every block without zoom or page animation", async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/");
  await expect(page.locator("#programacao")).toHaveClass(/reveal-visible/);
  const styles = await page
    .locator("#programacao")
    .evaluate((el) => ({
      opacity: getComputedStyle(el).opacity,
      transform: getComputedStyle(el).transform,
      transition: getComputedStyle(el).transitionDuration,
    }));
  expect(styles).toEqual({ opacity: "1", transform: "none", transition: "0s" });
  expect(
    await page
      .locator("main")
      .evaluate((el) => getComputedStyle(el).animationName),
  ).toBe("none");
});

test("configured banner keeps its image and safe destination; disabled slot is hidden", async ({
  page,
}) => {
  await page.route("**/rest/v1/ad_banners?*", (route) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify([
        { id: "app", enabled: true, image_url: null },
        {
          id: "top",
          title: "Parceiro Deluxe",
          alt_text: "Promoção do parceiro",
          enabled: true,
          image_url: "https://webradiodeluxe.vercel.app/images/vinyl.webp",
          target_url: "https://example.com/parceiro",
        },
        { id: "main", enabled: false, image_url: null },
      ]),
    }),
  );
  await page.goto("/");
  const banner = page.locator(".managed-banner-top");
  await banner.scrollIntoViewIfNeeded();
  await expect(banner.getByRole("img")).toHaveAttribute(
    "alt",
    "Promoção do parceiro",
  );
  await expect(banner.getByRole("link")).toHaveAttribute(
    "href",
    "https://example.com/parceiro",
  );
  await expect(banner.getByRole("link")).toHaveAttribute(
    "rel",
    "noopener noreferrer",
  );
  await expect(page.locator(".brand-banner")).toHaveCount(0);
  for (const width of [320, 390, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
  }
});
