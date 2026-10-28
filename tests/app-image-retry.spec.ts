import { test, expect } from "@playwright/test";
import { readFile } from "node:fs/promises";

const logoUrl = "https://images.example/radio-logo.webp";
const bannerUrl = "https://images.example/top-one.webp";
const config = {
  schema_version: 1,
  settings: {
    radio_name: "JK HipHop",
    tagline: "O rap em alto nível.",
    logo_url: logoUrl,
    background_url: null,
    show_poll: true,
    show_contact: true,
    banner_interval_seconds: 15,
  },
  radio: {
    stream_url: null,
    instagram_url: "https://www.instagram.com/radiojkhiphop/",
    youtube_url: null,
    facebook_url: null,
    tiktok_url: null,
    whatsapp_url: null,
    contact_email: "contato@example.com",
    contact_text: "Envie seu pedido de música.",
  },
  banners: [
    {
      id: "5d877db7-15e1-40dd-9b6e-17321190c001",
      title: "Primeiro anúncio de teste",
      alt_text: "Primeiro anúncio de teste",
      image_url: bannerUrl,
      target_url: null,
      slot: "top",
      position: 0,
      enabled: true,
    },
  ],
  poll: null,
  poll_available: true,
};

test("app retries the same logo and banner URLs after a successful 60-second configuration refresh", async ({
  page,
}) => {
  await page.clock.install({ time: new Date("2026-10-25T15:00:00Z") });
  await page.clock.pauseAt(new Date("2026-10-25T15:00:01Z"));
  let configRequests = 0;
  await page.route("**/api/app", (route) => {
    configRequests++;
    return route.fulfill({ json: config });
  });
  const image = await readFile("public/images/crowd.webp");
  const attempts = new Map<string, number>();
  await page.route("https://images.example/**", (route) => {
    const url = route.request().url();
    const count = (attempts.get(url) || 0) + 1;
    attempts.set(url, count);
    return count === 1
      ? route.fulfill({
          status: 503,
          headers: { "Cache-Control": "no-store" },
          body: "Temporary image failure",
        })
      : route.fulfill({ contentType: "image/webp", body: image });
  });

  await page.goto("/aplicativo");
  const logo = page.getByRole("img", { name: "JK HipHop", exact: true });
  const top = page.getByRole("region", {
    name: "Publicidade do aplicativo",
    exact: true,
  });
  await expect.poll(() => attempts.get(logoUrl)).toBe(1);
  await expect.poll(() => attempts.get(bannerUrl)).toBe(1);
  await expect(logo).toHaveAttribute("src", "/logo-jk-hiphop.svg");
  await expect(top).toHaveCount(0);
  const beforeRefresh = configRequests;

  await page.clock.fastForward(60001);

  await expect.poll(() => configRequests).toBeGreaterThan(beforeRefresh);
  await expect(logo).toHaveAttribute("src", logoUrl);
  await expect(top.getByAltText("Primeiro anúncio de teste")).toBeVisible();
  await expect
    .poll(() => logo.evaluate((element: HTMLImageElement) => element.naturalWidth))
    .toBeGreaterThan(0);
  await expect
    .poll(() =>
      top
        .getByRole("img")
        .evaluate((element: HTMLImageElement) => element.naturalWidth),
    )
    .toBeGreaterThan(0);
  expect(attempts.get(logoUrl)).toBe(2);
  expect(attempts.get(bannerUrl)).toBe(2);
});

test("a normal configuration refresh keeps the existing 15-second banner rotation deadline", async ({
  page,
}) => {
  await page.clock.install({ time: new Date("2026-10-25T15:00:00Z") });
  await page.clock.pauseAt(new Date("2026-10-25T15:00:01Z"));
  const twoBanners = {
    ...config,
    banners: [
      ...config.banners,
      {
        ...config.banners[0],
        id: "5d877db7-15e1-40dd-9b6e-17321190c002",
        title: "Segundo anúncio de teste",
        alt_text: "Segundo anúncio de teste",
        image_url: "https://images.example/top-two.webp",
        position: 1,
      },
    ],
  };
  let configRequests = 0;
  await page.route("**/api/app", (route) => {
    configRequests++;
    return route.fulfill({ json: twoBanners });
  });
  const image = await readFile("public/images/crowd.webp");
  await page.route("https://images.example/**", (route) =>
    route.fulfill({ contentType: "image/webp", body: image }),
  );

  await page.goto("/aplicativo");
  const top = page.getByRole("region", {
    name: "Publicidade do aplicativo",
    exact: true,
  });
  await expect(top.getByAltText("Primeiro anúncio de teste")).toBeVisible();
  await page.clock.fastForward(7500);
  const beforeRefresh = configRequests;
  await page.evaluate(() => window.dispatchEvent(new Event("focus")));
  await expect.poll(() => configRequests).toBeGreaterThan(beforeRefresh);
  await page.clock.fastForward(7499);
  await expect(top.getByAltText("Primeiro anúncio de teste")).toBeVisible();
  await page.clock.fastForward(1);
  await expect(top.getByAltText("Segundo anúncio de teste")).toBeVisible();
});
