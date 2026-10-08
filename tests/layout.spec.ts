import { test, expect } from "@playwright/test";

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
  await expect(page.getByRole("dialog")).toContainText("Grade demonstrativa");
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog")).not.toBeVisible();
  await page.getByRole("button", { name: "Buscar no site" }).click();
  await page.getByLabel("Busque programas e conteúdos").fill("classicos");
  await expect(page.locator(".search-results button")).toHaveCount(2);
  await page
    .locator(".search-results button")
    .filter({ hasText: "Clássicos do rap" })
    .click();
  await expect(page.getByRole("dialog")).toContainText("Clássicos do rap");
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
  await page.goto("/");
  await page.getByRole("button", { name: "Ouvir rádio", exact: true }).click();
  await expect(page.getByRole("dialog")).toContainText(
    "TRANSMISSÃO EM CONFIGURAÇÃO",
  );
  await expect(page.locator(".equalizer")).not.toHaveClass(/is-playing/);
  expect(
    await page.locator("audio").evaluate((audio) => audio.paused),
  ).toBeTruthy();
});

test("playlist browsing opens a real search URL and explains the curation status", async ({
  page,
}) => {
  await page.goto("/");
  await page.locator(".playlist-card").first().click();
  await expect(page.getByRole("dialog")).toContainText(
    "playlist oficial será publicada em breve",
  );
  await expect(
    page.getByRole("link", { name: "Explorar no YouTube" }),
  ).toHaveAttribute(
    "href",
    "https://www.youtube.com/results?search_query=rap%20nacional",
  );
});

test("newsletter requires consent, submits correct data and renders success without writing test data", async ({
  page,
}) => {
  let payload: unknown;
  await page.route("**/rest/v1/newsletter_subscribers", async (route) => {
    payload = route.request().postDataJSON();
    await route.fulfill({
      status: 201,
      contentType: "application/json",
      body: "",
    });
  });
  await page.goto("/");
  await page
    .getByLabel("Seu e-mail", { exact: true })
    .fill("ouvinte@example.com");
  await expect(
    page.getByRole("button", { name: "Cadastrar e-mail" }),
  ).toBeDisabled();
  await page.locator(".consent input").check();
  await page.getByRole("button", { name: "Cadastrar e-mail" }).click();
  await expect(page.getByRole("status")).toContainText("Você está na lista!");
  expect(payload).toEqual({ email: "ouvinte@example.com", consent: true });
});

test("newsletter request failure provides a retryable error without a false success", async ({
  page,
}) => {
  await page.route("**/rest/v1/newsletter_subscribers", (route) =>
    route.fulfill({
      status: 500,
      contentType: "application/json",
      body: JSON.stringify({ message: "temporary failure" }),
    }),
  );
  await page.goto("/");
  await page
    .getByLabel("Seu e-mail", { exact: true })
    .fill("ouvinte@example.com");
  await page.locator(".consent input").check();
  await page.getByRole("button", { name: "Cadastrar e-mail" }).click();
  await expect(page.getByRole("status")).toContainText(
    "Não foi possível cadastrar",
  );
  await expect(
    page.getByRole("button", { name: "Cadastrar e-mail" }),
  ).toBeEnabled();
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
