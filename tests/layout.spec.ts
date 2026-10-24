import { test, expect } from "@playwright/test";
import { defaultSiteContent } from "../src/site-content";

test("desktop renders assets and supports carousel, program details, search and keyboard dismissal", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1440, height: 1000 });
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto("/");
  await expect(page.locator("h1")).toContainText("O RAP EM");
  await page
    .getByRole("button", { name: "Próximo destaque", exact: true })
    .click();
  await expect(page.locator("h1")).toContainText("NOSSA CULTURA.");
  await page.getByRole("button", { name: "Destaque anterior" }).click();
  await page.locator(".program-card").first().click();
  await expect(page.getByRole("dialog")).toBeVisible();
  await expect(page.getByRole("dialog")).toContainText("confirmar a disponibilidade da programação");
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog")).not.toBeVisible();
  await page.getByRole("button", { name: "Buscar no site" }).click();
  await page.getByLabel("Busque programas e conteúdos").fill("classicos");
  await expect(page.locator(".search-results button").filter({ hasText: "Clássicos do Rap" })).toHaveCount(1);
  await page
    .locator(".search-results button")
    .filter({ hasText: "Clássicos do Rap" })
    .click();
  await expect(page.getByRole("dialog")).toContainText("Clássicos do Rap");
  await page.keyboard.press("Escape");
  await page.locator("img").evaluateAll((images) =>
    images.forEach((img) => {
      img.loading = "eager";
    }),
  );
  await expect
    .poll(() =>
      page
        .locator("img")
        .evaluateAll((images) =>
          images.every((img) => img.complete && img.naturalWidth > 0),
        ),
    )
    .toBeTruthy();
  expect(errors).toEqual([]);
});

for (const width of [320, 390, 768]) {
  test(`mobile ${width}px has no overflow and navigation reaches the program section`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height: 844 });
    await page.goto("/");
    await page.getByRole("button", { name: "Abrir menu" }).click();
    await page
      .getByRole("navigation")
      .getByRole("link", { name: "Programas", exact: true })
      .click();
    await expect(page).toHaveURL(/#programacao$/);
    await expect(
      page.getByRole("button", { name: "Abrir menu" }),
    ).toHaveAttribute("aria-expanded", "false");
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= window.innerWidth,
      ),
    ).toBeTruthy();
  });
}

test("player without a stream clearly explains availability and does not simulate playback", async ({
  page,
}) => {
  await page.route("**/rest/v1/rpc/public_site_content", route => route.fulfill({
    status: 200, contentType: "application/json",
    body: JSON.stringify(defaultSiteContent),
  }));
  await page.goto("/");
  await expect(page.locator("audio")).not.toHaveAttribute("src", /https:\/\//);
  await page.getByRole("button", { name: "Ouvir rádio", exact: true }).click();
  await expect(page.getByRole("dialog")).toContainText(
    "TRANSMISSÃO EM CONFIGURAÇÃO",
  );
  await expect(page.locator(".equalizer")).not.toHaveClass(/is-playing/);
  expect(
    await page.locator("audio").evaluate((audio) => audio.paused),
  ).toBeTruthy();
});

test("playlist without an official URL explains its curation status", async ({
  page,
}) => {
  await page.goto("/");
  await page.locator(".playlist-card").first().click();
  await expect(page.getByRole("dialog")).toContainText(
    "O link desta seleção ainda será divulgado pela rádio.",
  );
  await expect(
    page.getByRole("dialog").getByRole("link", { name: "Abrir playlist" }),
  ).toHaveCount(0);
});

test("programs and Instagram replace the removed email signup", async ({ page }) => {
  await page.goto("/");
  await expect(page.locator(".program-card")).toHaveCount(4);
  await expect(page.locator(".program-card")).toContainText([
    "Clássicos do Rap", "NoBreack Hip-Hop", "Pediu! Tocou", "Resenha Hip-Hop",
  ]);
  await expect(page.locator(".program-card").nth(1)).toContainText("sem intervalo");
  await expect(page.getByText("NA FREQUÊNCIA DAS NOVIDADES")).toHaveCount(0);
  await expect(page.locator('input[type="email"]')).toHaveCount(0);
  const instagram = page.getByRole("link", { name: /SEGUIR NO INSTAGRAM/ });
  await expect(instagram).toHaveAttribute("href", "https://www.instagram.com/radiojkhiphop/");
  await expect(instagram).toHaveAttribute("rel", "noopener noreferrer");
  await page.locator(".footer-main").getByRole("link", { name: "Política de privacidade" }).click();
  await expect(page.locator("h1")).toContainText("Privacidade");
  await expect(page.getByRole("link", { name: "Ouvir a rádio", exact: true })).toHaveAttribute("href", "/");
});

test("reduced motion disables animated transitions", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/");
  expect(
    await page
      .locator(".hero-copy")
      .evaluate((el) => getComputedStyle(el).animationName),
  ).toBe("none");
  await page
    .getByRole("button", { name: "Próximo destaque", exact: true })
    .click();
  await expect(page.locator("h1")).toContainText("NOSSA CULTURA.");
});
