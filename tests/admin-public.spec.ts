import { test, expect } from "@playwright/test";

for (const width of [320, 390, 768, 1440]) {
  test(`player stays at the top after scrolling at ${width}px`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height: 900 });
    await page.goto("/");
    await page.evaluate(() =>
      window.scrollTo({ top: 1400, behavior: "instant" }),
    );
    const header = await page.locator(".header").boundingBox(),
      player = await page.locator(".radio-player").boundingBox();
    expect(header).not.toBeNull();
    expect(player).not.toBeNull();
    expect(player!.y).toBeGreaterThanOrEqual(header!.height - 2);
    expect(player!.y).toBeLessThanOrEqual(header!.height + 15);
    expect(await page.locator("audio").count()).toBe(1);
  });
}
test("admin route exposes only the master login and has no registration", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/admin");
  await expect(
    page.getByRole("heading", { name: "Bem-vindo, administrador." }),
  ).toBeVisible();
  await expect(page.getByLabel("E-mail do administrador")).toHaveValue(
    "cesarideadigital@gmail.com",
  );
  await expect(page.getByRole("button", { name: "Nova notícia" })).toHaveCount(
    0,
  );
  await expect(page.getByText(/criar conta|cadastre-se/i)).toHaveCount(0);
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBeTruthy();
  await page.route("**/auth/v1/token?grant_type=password", (route) =>
    route.fulfill({
      status: 400,
      contentType: "application/json",
      body: JSON.stringify({
        error: "invalid_grant",
        error_description: "Invalid login credentials",
      }),
    }),
  );
  await page.getByLabel("Senha", { exact: true }).fill("invalid-password");
  await page.getByRole("button", { name: "Entrar no painel" }).click();
  await expect(page.getByRole("alert")).toContainText(
    "Não foi possível entrar",
  );
});
test("poll submits the selected option and displays persisted results", async ({
  page,
}) => {
  const poll = {
    id: "e37a0cf1-6604-4f3b-a8f3-f89f3442b6e3",
    question: "Qual estilo você quer ouvir?",
    status: "active",
    ends_at: null,
    total: 0,
    options: [
      {
        id: "e37a0cf1-6604-4f3b-a8f3-f89f3442b6e4",
        label: "Rap nacional",
        votes: 0,
      },
      {
        id: "e37a0cf1-6604-4f3b-a8f3-f89f3442b6e5",
        label: "Rap internacional",
        votes: 0,
      },
    ],
  };
  await page.route("**/rest/v1/rpc/poll_results", (route) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(poll),
    }),
  );
  let received: unknown;
  await page.route("**/api/poll", (route) => {
    received = route.request().postDataJSON();
    return route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        already_voted: false,
        results: {
          ...poll,
          total: 1,
          options: [{ ...poll.options[0], votes: 1 }, poll.options[1]],
        },
      }),
    });
  });
  await page.goto("/");
  await page.getByLabel("Rap nacional", { exact: true }).check();
  await page.getByRole("button", { name: "Registrar meu voto" }).click();
  await expect(page.locator(".poll-message")).toContainText("Voto registrado");
  await expect(page.locator(".poll-results")).toContainText("100%");
  expect(received).toEqual({ poll_id: poll.id, option_id: poll.options[0].id });
  expect(
    await page.evaluate(() =>
      localStorage.getItem("deluxe-vote:e37a0cf1-6604-4f3b-a8f3-f89f3442b6e3"),
    ),
  ).toBe("true");
});
test("vote failure remains retryable without reporting success", async ({
  page,
}) => {
  await page.route("**/api/poll", (route) =>
    route.fulfill({
      status: 503,
      contentType: "application/json",
      body: JSON.stringify({
        error: "Não foi possível conectar. Tente novamente.",
      }),
    }),
  );
  await page.goto("/");
  await page.locator(".poll-options input").first().check();
  await page.getByRole("button", { name: "Registrar meu voto" }).click();
  await expect(page.locator(".poll-message")).toContainText(
    "Não foi possível conectar",
  );
  await expect(
    page.getByRole("button", { name: "Registrar meu voto" }),
  ).toBeEnabled();
});
