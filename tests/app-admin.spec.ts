import { test, expect, type Page } from "@playwright/test";

type Banner = Record<string, unknown> & { id: string };
async function appMaster(page: Page) {
  const user = {
    id: "aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee",
    email: "master@example.test",
    aud: "authenticated",
    role: "authenticated",
    app_metadata: {},
    user_metadata: {},
    created_at: new Date().toISOString(),
  };
  await page.addInitScript(
    ({ user }) => {
      const expires = Math.floor(Date.now() / 1000) + 3600;
      sessionStorage.setItem(
        "deluxe-master-session",
        JSON.stringify({
          access_token: `eyJhbGciOiJIUzI1NiJ9.${btoa(JSON.stringify({ sub: user.id, exp: expires, aud: "authenticated" }))}.test`,
          refresh_token: "test-only",
          expires_at: expires,
          expires_in: 3600,
          token_type: "bearer",
          user,
        }),
      );
    },
    { user },
  );
  const state = {
    settings: {
      radio_name: "JK HipHop",
      tagline: "O rap em alto nível.",
      logo_url: null,
      background_url: null,
      show_poll: true,
      show_contact: true,
      ticker_enabled: true,
      ticker_text: "JK HipHop • O rap em alto nível.",
      ticker_text_color: "black",
    } as Record<string, unknown>,
    radio: {
      stream_url: null,
      instagram_url: "https://www.instagram.com/radiojkhiphop/",
      youtube_url: null,
      contact_email: null,
      contact_text: "",
      whatsapp_url: null,
      facebook_url: null,
      tiktok_url: null,
    } as Record<string, unknown>,
    banners: [] as Banner[],
    mutations: [] as {
      table: string;
      method: string;
      body?: Record<string, unknown>;
    }[],
    uploaded: [] as string[],
    removed: [] as string[],
    failUpload: false,
    failSave: false,
  };
  await page.route("**/rest/v1/**", async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    const table = url.pathname.split("/").pop()!;
    const method = request.method();
    let data: unknown = [];
    if (table === "admin_access") data = true;
    else if (table === "news_automation")
      data = {
        enabled: false,
        last_run_at: null,
        last_status: null,
        last_message: null,
      };
    else if (["app_settings", "radio_settings"].includes(table)) {
      if (method === "PATCH") {
        if (state.failSave) {
          state.failSave = false;
          return route.fulfill({
            status: 403,
            contentType: "application/json",
            body: JSON.stringify({ message: "Permission denied" }),
          });
        }
        const body = request.postDataJSON();
        state.mutations.push({ table, method, body });
        if (table === "app_settings")
          state.settings = { ...state.settings, ...body };
        else state.radio = { ...state.radio, ...body };
        data = { id: 1 };
      } else data = table === "app_settings" ? state.settings : state.radio;
    } else if (table === "app_banners") {
      if (["POST", "PATCH", "DELETE"].includes(method)) {
        if (state.failSave) {
          state.failSave = false;
          return route.fulfill({
            status: 403,
            contentType: "application/json",
            body: JSON.stringify({ message: "Permission denied" }),
          });
        }
        const body = method === "DELETE" ? undefined : request.postDataJSON();
        state.mutations.push({ table, method, body });
        const id = url.searchParams.get("id")?.slice(3);
        if (method === "POST") {
          const row = { ...body, id: crypto.randomUUID() } as Banner;
          state.banners.push(row);
          data = { id: row.id };
        } else if (method === "PATCH") {
          state.banners = state.banners.map((row) =>
            row.id === id ? { ...row, ...body } : row,
          );
          data = { id };
        } else {
          state.banners = state.banners.filter((row) => row.id !== id);
          data = { id };
        }
      } else data = state.banners;
    }
    return route.fulfill({
      status: 200,
      contentType: "application/json",
      headers: { "content-range": "0-0/0" },
      body: JSON.stringify(data),
    });
  });
  await page.route("**/storage/v1/object/**", async (route) => {
    if (route.request().method() === "POST") {
      const path = new URL(route.request().url()).pathname.split(
        "/deluxe-app/",
      )[1];
      if (state.failUpload)
        return route.fulfill({
          status: 403,
          contentType: "application/json",
          body: JSON.stringify({ error: "Permission denied" }),
        });
      state.uploaded.push(path);
      return route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ Key: `deluxe-app/${path}` }),
      });
    }
    if (route.request().method() === "DELETE")
      state.removed.push(...route.request().postDataJSON().prefixes);
    return route.fulfill({
      status: 200,
      contentType: "application/json",
      body: "[]",
    });
  });
  await page.goto("/admin");
  await expect(
    page.getByRole("heading", { name: "Painel principal", exact: true }),
  ).toBeVisible();
  if (
    await page
      .getByRole("button", { name: "Abrir menu administrativo", exact: true })
      .isVisible()
  )
    await page
      .getByRole("button", { name: "Abrir menu administrativo", exact: true })
      .click();
  await page.getByRole("button", { name: "Aplicativo", exact: true }).click();
  await expect(
    page.getByRole("heading", {
      name: "Identidade e menu do aplicativo",
      exact: true,
    }),
  ).toBeVisible();
  return state;
}

test("master manages app identity and shared channels without losing another form's draft on mobile", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  const state = await appMaster(page);
  await expect(
    page.getByText(
      "Recomendado: 1080 × 1080 px · Alta resolução: 2160 × 2160 px",
      { exact: true },
    ),
  ).toBeVisible();
  await page
    .getByLabel("Nome da rádio no app", { exact: true })
    .fill("JK HipHop Teste");
  await page
    .getByLabel("Slogan do aplicativo", { exact: true })
    .fill("A cultura tem voz.");
  await page
    .getByLabel("URL da logo (HTTPS ou /images/arquivo.webp)")
    .fill("/images/hero.webp");
  await page
    .getByLabel("URL da imagem de fundo (HTTPS ou /images/arquivo.webp)")
    .fill("https://example.test/background.png");
  await page.getByLabel("Mostrar enquete no menu", { exact: true }).uncheck();
  await page
    .getByLabel("Texto da página de contato", { exact: true })
    .fill("Rascunho ainda não salvo.");
  await page
    .getByRole("button", { name: "Salvar aplicativo", exact: true })
    .click();
  await expect(
    page.getByText("Identidade do aplicativo salva.", { exact: true }),
  ).toBeVisible();
  await expect(
    page.getByLabel("Texto da página de contato", { exact: true }),
  ).toHaveValue("Rascunho ainda não salvo.");
  expect(state.settings).toMatchObject({
    radio_name: "JK HipHop Teste",
    tagline: "A cultura tem voz.",
    logo_url: "/images/hero.webp",
    background_url: "https://example.test/background.png",
    show_poll: false,
    show_contact: true,
  });
  await page
    .getByLabel("URL do streaming (HTTPS)", { exact: true })
    .fill("https://example.test/live");
  const radioForm = page
    .locator("section")
    .filter({
      has: page.getByRole("heading", {
        name: "Transmissão da rádio",
        exact: true,
      }),
    });
  await radioForm
    .getByRole("button", { name: "Salvar configurações", exact: true })
    .click();
  await expect(
    radioForm.getByText("Configuração salva.", { exact: true }),
  ).toBeVisible();
  await expect(
    page.getByLabel("Texto da página de contato", { exact: true }),
  ).toHaveValue("Rascunho ainda não salvo.");
  await page
    .getByLabel("Instagram (HTTPS)", { exact: true })
    .fill("https://instagram.com/radiojkhiphop");
  await page
    .getByLabel("E-mail de contato", { exact: true })
    .fill("radio@example.test");
  const contactForm = page
    .locator("section")
    .filter({
      has: page.getByRole("heading", {
        name: "Contato e redes sociais",
        exact: true,
      }),
    });
  await contactForm
    .getByRole("button", { name: "Salvar configurações", exact: true })
    .click();
  await expect(
    contactForm.getByText("Configuração salva.", { exact: true }),
  ).toBeVisible();
  expect(state.radio).toMatchObject({
    stream_url: "https://example.test/live",
    contact_text: "Rascunho ainda não salvo.",
    contact_email: "radio@example.test",
    instagram_url: "https://instagram.com/radiojkhiphop",
  });
  const appMutation = state.mutations.find(
    (entry) => entry.table === "app_settings",
  )!;
  expect(appMutation.body).not.toHaveProperty("id");
  expect(appMutation.body).not.toHaveProperty("updated_at");
  expect(appMutation.body).not.toHaveProperty("banner_interval_seconds");
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  expect(errors).toEqual([]);
});

test("master creates, orders, disables and confirms deletion of app-only banners", async ({
  page,
}) => {
  const state = await appMaster(page);
  await page
    .getByRole("button", { name: "Novo anúncio do app", exact: true })
    .click();
  await page
    .getByLabel("Título do anúncio do app", { exact: true })
    .fill("Publicidade exclusiva do app");
  await page
    .getByLabel("Descrição acessível da publicidade", { exact: true })
    .fill("Campanha de teste autorizada.");
  await page.getByLabel("Anúncio ativo no aplicativo", { exact: true }).check();
  await page
    .getByRole("button", { name: "Salvar anúncio do app", exact: true })
    .click();
  await expect(page.getByRole("alert")).toContainText(
    "Adicione uma imagem antes de ativar",
  );
  expect(state.mutations).toHaveLength(0);
  await page
    .getByLabel("URL da imagem do anúncio (HTTPS ou /images/arquivo.webp)")
    .fill("https://example.test/banner.png");
  const scale = await page
    .locator(".admin-app-banner-preview")
    .evaluate((element) => {
      const rectangle = element.getBoundingClientRect();
      return rectangle.width / rectangle.height;
    });
  expect(scale).toBeCloseTo(1, 2);
  await page
    .getByLabel("Link do anúncio (HTTPS, opcional)")
    .fill("https://example.test/campanha");
  await page
    .getByRole("button", { name: "Salvar anúncio do app", exact: true })
    .click();
  await expect(
    page.getByRole("heading", {
      name: "Publicidade exclusiva do app",
      exact: true,
    }),
  ).toBeVisible();
  expect(state.banners[0]).toMatchObject({
    slot: "top",
    position: 0,
    enabled: true,
    target_url: "https://example.test/campanha",
  });
  await page
    .getByRole("button", {
      name: "Editar anúncio Publicidade exclusiva do app",
      exact: true,
    })
    .click();
  await page
    .getByLabel("Ordem de rotação (menor primeiro)", { exact: true })
    .fill("7");
  await page
    .getByRole("button", { name: "Salvar anúncio do app", exact: true })
    .click();
  await expect(
    page.getByRole("heading", {
      name: "Publicidade exclusiva do app",
      exact: true,
    }),
  ).toBeVisible();
  expect(state.banners[0]).toMatchObject({ slot: "top", position: 7 });
  await page
    .getByRole("button", {
      name: "Desativar anúncio Publicidade exclusiva do app",
      exact: true,
    })
    .click();
  await expect(
    page.getByRole("button", {
      name: "Ativar anúncio Publicidade exclusiva do app",
      exact: true,
    }),
  ).toBeVisible();
  expect(state.banners[0].enabled).toBe(false);
  await page
    .getByRole("button", {
      name: "Excluir anúncio Publicidade exclusiva do app",
      exact: true,
    })
    .click();
  expect(state.banners).toHaveLength(1);
  await page
    .getByRole("button", { name: "Confirmar exclusão do anúncio", exact: true })
    .click();
  await expect(
    page.getByText("Nenhum anúncio do aplicativo cadastrado.", { exact: true }),
  ).toBeVisible();
  expect(state.banners).toHaveLength(0);
  expect(state.mutations.map((mutation) => mutation.table)).toEqual([
    "app_banners",
    "app_banners",
    "app_banners",
    "app_banners",
  ]);
  for (const mutation of state.mutations) {
    if (!mutation.body) continue;
    expect(mutation.body).not.toHaveProperty("id");
    expect(mutation.body).not.toHaveProperty("created_at");
    expect(mutation.body).not.toHaveProperty("updated_at");
  }
});

test("failed uploads do not persist app ads and failed saves clean newly uploaded assets", async ({
  page,
}) => {
  const state = await appMaster(page);
  await page
    .getByRole("button", { name: "Novo anúncio do app", exact: true })
    .click();
  await page
    .getByLabel("Título do anúncio do app", { exact: true })
    .fill("Anúncio com upload");
  const png = {
    name: "banner.png",
    mimeType: "image/png",
    buffer: Buffer.from(
      "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/2ioAAAAASUVORK5CYII=",
      "base64",
    ),
  };
  await page
    .getByLabel("Enviar imagem do anúncio (até 5 MB)")
    .setInputFiles({
      name: "invalid.svg",
      mimeType: "image/svg+xml",
      buffer: Buffer.from("<svg/>"),
    });
  await expect(page.getByRole("alert")).toContainText(
    "Use JPG, PNG, WebP ou GIF",
  );
  expect(state.uploaded).toHaveLength(0);
  await page
    .getByLabel("Enviar imagem do anúncio (até 5 MB)")
    .setInputFiles(png);
  await expect(
    page.getByText("Imagem enviada: 1 × 1 px.", { exact: false }),
  ).toHaveText("Imagem enviada: 1 × 1 px.");
  state.failUpload = true;
  await page
    .getByRole("button", { name: "Salvar anúncio do app", exact: true })
    .click();
  await expect(page.getByRole("alert")).toContainText(
    "Não foi possível salvar o anúncio",
  );
  expect(state.banners).toHaveLength(0);
  expect(state.mutations).toHaveLength(0);
  state.failUpload = false;
  state.failSave = true;
  await page
    .getByRole("button", { name: "Salvar anúncio do app", exact: true })
    .click();
  await expect.poll(() => state.removed.length).toBe(1);
  expect(state.uploaded[0]).toMatch(/^banner\/[0-9a-f-]{36}\.png$/);
  expect(state.removed).toEqual(state.uploaded);
  expect(state.banners).toHaveLength(0);
  await expect(
    page.getByLabel("Título do anúncio do app", { exact: true }),
  ).toHaveValue("Anúncio com upload");
  await page
    .getByRole("button", { name: "Fechar edição do anúncio", exact: true })
    .click();
  await page.getByLabel("Enviar logo (até 5 MB)").setInputFiles(png);
  state.failSave = true;
  await page
    .getByRole("button", { name: "Salvar aplicativo", exact: true })
    .click();
  await expect(page.getByRole("alert")).toContainText(
    "Não foi possível salvar o aplicativo",
  );
  await expect.poll(() => state.removed.length).toBe(2);
  expect(state.uploaded[1]).toMatch(/^branding\/[0-9a-f-]{36}\.png$/);
  expect(state.removed).toEqual(state.uploaded);
  expect(state.settings.logo_url).toBe(null);
});


test("master saves ticker text, both colors and visibility; blank enabled message is rejected", async ({ page }) => {
  const state = await appMaster(page);
  const message = page.getByLabel("Mensagem da faixa", {exact:true});
  const color = page.getByRole("combobox", { name: "Cor do texto da faixa", exact: true });
  const enabled = page.getByLabel("Mostrar faixa de texto no aplicativo", {exact:true});
  const save = page.getByRole("button", {name:"Salvar aplicativo", exact:true});
  await message.fill("Sua música, sua rádio • JK HipHop");
  await color.selectOption("white");
  await expect(page.locator('.app-ticker')).toHaveCSS('color','rgb(255, 255, 255)');
  await save.click();
  await expect.poll(()=>state.settings.ticker_text_color).toBe("white");
  expect(state.settings.ticker_text).toBe("Sua música, sua rádio • JK HipHop");
  await page.reload();
  await page.getByRole('button',{name:'Aplicativo',exact:true}).click();
  await expect(message).toHaveValue("Sua música, sua rádio • JK HipHop");
  await message.fill("");
  const count = state.mutations.length;
  await save.click();
  await expect(page.getByRole('alert')).toContainText('Informe a mensagem');
  expect(state.mutations.length).toBe(count);
  await enabled.uncheck();
  await color.selectOption("black");
  await save.click();
  await expect.poll(()=>state.settings.ticker_enabled).toBe(false);
  expect(state.settings.ticker_text_color).toBe('black');
  await expect(page.locator('.app-ticker')).toHaveCount(0);
});
