import { test, expect } from "@playwright/test";

const poll = {
  id: "e37a0cf1-6604-4f3b-a8f3-f89f3442b6e3",
  question: "Qual som você quer ouvir?",
  status: "active",
  ends_at: null as string | null,
  total: 4,
  options: [
    {
      id: "5d877db7-15e1-40dd-9b6e-17321190c001",
      label: "Rap nacional",
      votes: 3,
    },
    {
      id: "5d877db7-15e1-40dd-9b6e-17321190c002",
      label: "Clássicos",
      votes: 1,
    },
  ],
};

const config = {
  schema_version: 1,
  settings: {
    radio_name: "JK HipHop",
    tagline: "O rap em alto nível.",
    logo_url: null,
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
  banners: [],
  poll,
  poll_available: true,
};

for (const scenario of [
  { name: "closed", status: "closed", ends_at: null },
  {
    name: "active with an expired deadline",
    status: "active",
    ends_at: "2026-10-25T14:59:00Z",
  },
]) {
  test(`app poll ${scenario.name} shows results without allowing a vote`, async ({
    page,
  }) => {
    const pollState = {
      status: scenario.status,
      ends_at: scenario.ends_at,
    };
    await page.clock.install({ time: new Date("2026-10-25T15:00:00Z") });
    await page.clock.pauseAt(new Date("2026-10-25T15:00:01Z"));
    await page.route("**/api/app", (route) =>
      route.fulfill({
        json: { ...config, poll: { ...poll, ...pollState } },
      }),
    );
    let voteRequests = 0;
    await page.route("**/api/poll", (route) => {
      voteRequests++;
      return route.fulfill({
        status: 409,
        json: { error: "Enquete encerrada." },
      });
    });

    await page.goto("/aplicativo");
    await page.getByRole("button", { name: "Abrir menu" }).click();
    await page.getByRole("button", { name: "Enquete", exact: true }).click();

    const dialog = page.getByRole("dialog");
    await expect(
      dialog.getByRole("heading", { name: poll.question, exact: true }),
    ).toBeVisible();
    await expect(dialog).toContainText("4 votos registrados · Enquete encerrada");
    await expect(dialog.getByText("75%", { exact: true })).toBeVisible();
    await expect(dialog.getByText("25%", { exact: true })).toBeVisible();
    await expect(dialog.getByRole("progressbar")).toHaveCount(2);
    await expect(dialog.getByRole("radio")).toHaveCount(0);
    await expect(
      dialog.getByRole("button", { name: /votar|confirmar voto/i }),
    ).toHaveCount(0);
    expect(voteRequests).toBe(0);
  });
}

test("app poll reports a temporary service failure without offering voting or stale results", async ({
  page,
}) => {
  await page.route("**/api/app", (route) =>
    route.fulfill({ json: { ...config, poll_available: false } }),
  );
  let voteRequests = 0;
  await page.route("**/api/poll", (route) => {
    voteRequests++;
    return route.fulfill({ status: 503, json: { error: "Indisponível" } });
  });

  await page.goto("/aplicativo");
  await page.getByRole("button", { name: "Abrir menu" }).click();
  await page.getByRole("button", { name: "Enquete", exact: true }).click();

  const dialog = page.getByRole("dialog");
  await expect(dialog).toContainText(
    "A enquete está temporariamente indisponível. Tente novamente em instantes.",
  );
  await expect(dialog.getByText(poll.question, { exact: true })).toHaveCount(0);
  await expect(dialog.getByRole("progressbar")).toHaveCount(0);
  await expect(dialog.getByRole("radio")).toHaveCount(0);
  await expect(
    dialog.getByRole("button", { name: /votar|confirmar voto/i }),
  ).toHaveCount(0);
  expect(voteRequests).toBe(0);
});
