import { test, expect } from "@playwright/test";
import { publicPaths, getPageSeo } from "../src/seo";

test("public pages retain their own metadata and hydrate without errors", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", error => errors.push(error.message));

  const routes = [
    ...publicPaths.filter(path => path !== "/").map(path => ({ path, canonicalPath: path })),
    ...publicPaths.map(path => ({ path: `${path === "/" ? "" : path}/index.html`, canonicalPath: path })),
  ];
  for (const { path, canonicalPath } of routes) {
    const seo = getPageSeo(canonicalPath);
    await page.goto(path);
    await expect(page.locator("h1")).toHaveCount(1);
    await expect(page).toHaveTitle(seo.title);
    await expect(page.locator('link[rel="canonical"]')).toHaveAttribute("href", seo.canonical!);
    // Let the client finish a render frame before checking hydration errors.
    await page.evaluate(() => new Promise<void>(resolve =>
      requestAnimationFrame(() => requestAnimationFrame(() => resolve()))));
    if (canonicalPath !== "/")
      await expect(page.getByRole("link", { name: "Ouvir a rádio", exact: true })).toBeVisible();
    expect(errors, path).toEqual([]);
  }
});
