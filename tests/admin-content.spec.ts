import { test, expect, type Page } from "@playwright/test";

type EditorialRow = Record<string, unknown> & { id: string; kind: string };

// The UI contract is tested with an isolated authenticated session and mocked
// HTTP transport. Separate SQL tests exercise the actual database RLS policies.
async function masterPanel(page: Page) {
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
    rows: [] as EditorialRow[],
    settings: {
      stream_url: null,
      instagram_url: "https://www.instagram.com/radiojkhiphop/",
      youtube_url: null,
      contact_email: null,
      contact_text: "",
      whatsapp_url: null,
      facebook_url: null,
      tiktok_url: null,
    } as Record<string, unknown>,
    mutations: [] as {
      table: string;
      method: string;
      body?: Record<string, unknown>;
    }[],
    uploads: [] as string[],
    failNextSave: false,
  };
  await page.route("**/rest/v1/**", async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    const table = url.pathname.split("/").pop()!;
    const method = request.method();
    let data: unknown = [];
    if (table === "admin_access") data = true;
    else if (table === "radio_settings") {
      if (method === "PATCH") {
        const body = request.postDataJSON();
        state.settings = { ...state.settings, ...body };
        state.mutations.push({ table, method, body });
        data = { id: 1 };
      } else data = state.settings;
    } else if (table === "news_automation") {
      data = {
        enabled: false,
        last_run_at: null,
        last_status: null,
        last_message: null,
      };
    } else if (table === "site_content") {
      const kind = (url.searchParams.get("kind") || "eq.program").slice(3);
      const id = (url.searchParams.get("id") || "").slice(3);
      if (["POST", "PATCH", "DELETE"].includes(method)) {
        if (state.failNextSave) {
          state.failNextSave = false;
          return route.fulfill({
            status: 403,
            contentType: "application/json",
            body: JSON.stringify({ message: "Permission denied" }),
          });
        }
        const body = method === "DELETE" ? undefined : request.postDataJSON();
        state.mutations.push({ table, method, body });
        if (method === "POST") {
          const row = { ...body, id: crypto.randomUUID() } as EditorialRow;
          state.rows.push(row);
          data = { id: row.id };
        } else if (method === "PATCH") {
          state.rows = state.rows.map((row) =>
            row.id === id ? { ...row, ...body } : row,
          );
          data = { id };
        } else {
          state.rows = state.rows.filter((row) => row.id !== id);
          data = { id };
        }
      } else data = state.rows.filter((row) => row.kind === kind);
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
        "/deluxe-content/",
      )[1];
      state.uploads.push(path);
      return route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ Key: `deluxe-content/${path}` }),
      });
    }
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
  return state;
}

test("master can create, edit, order, disable and delete every editorial module", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  const state = await masterPanel(page);
  const modules = [
    [
      "Programas",
      "Novo programa",
      "Programa de teste",
      "Nome do programa",
      "Descrição do programa",
      "program",
    ],
    [
      "Playlists",
      "Nova playlist",
      "Playlist de teste",
      "Nome da playlist",
      "Descrição da playlist",
      "playlist",
    ],
    [
      "Equipe",
      "Novo integrante",
      "Integrante de teste",
      "Nome do integrante",
      "Biografia / apresentação",
      "team",
    ],
    [
      "Galeria",
      "Nova imagem",
      "Galeria de teste",
      "Título / legenda da imagem",
      "Contexto e descrição da imagem",
      "gallery",
    ],
  ];
  for (const [module, create, title, field, description, kind] of modules) {
    await page.getByRole("button", { name: module, exact: true }).click();
    await page.getByRole("button", { name: create, exact: true }).click();
    await page.getByLabel(field, { exact: true }).fill(title);
    await page
      .getByLabel(description, { exact: true })
      .fill("Conteúdo de validação do editor.");
    if (kind === "gallery")
      await page
        .getByLabel("URL da imagem (HTTPS ou /images/arquivo.webp)")
        .fill("/images/hero.webp");
    await page
      .getByRole("button", { name: "Salvar alterações", exact: true })
      .click();
    await expect(
      page.getByRole("heading", { name: title, exact: true }),
    ).toBeVisible();
    expect(state.rows.find((row) => row.kind === kind)).toMatchObject({
      title,
      enabled: true,
      time_label: "",
      days_label: "",
    });
    await page
      .getByRole("button", { name: `Editar ${title}`, exact: true })
      .click();
    await page.getByLabel(field, { exact: true }).fill(`${title} atualizado`);
    await page
      .getByLabel("Posição na lista (menor aparece primeiro)")
      .fill("7");
    await page
      .getByRole("button", { name: "Salvar alterações", exact: true })
      .click();
    await expect(
      page.getByRole("heading", { name: `${title} atualizado`, exact: true }),
    ).toBeVisible();
    expect(state.rows.find((row) => row.kind === kind)).toMatchObject({
      title: `${title} atualizado`,
      position: 7,
    });
    await page
      .getByRole("button", {
        name: `Desativar ${title} atualizado`,
        exact: true,
      })
      .click();
    await expect(
      page.getByRole("button", {
        name: `Ativar ${title} atualizado`,
        exact: true,
      }),
    ).toBeVisible();
    expect(state.rows.find((row) => row.kind === kind)?.enabled).toBe(false);
    await page
      .getByRole("button", { name: `Excluir ${title} atualizado`, exact: true })
      .click();
    // Requesting deletion does not mutate data until its explicit confirmation.
    expect(state.rows).toHaveLength(1);
    await page
      .getByRole("button", { name: "Confirmar exclusão", exact: true })
      .click();
    await expect(
      page.getByText("Nenhum item cadastrado.", { exact: false }),
    ).toBeVisible();
    expect(state.rows).toHaveLength(0);
  }
  expect(state.mutations).toHaveLength(16);
  for (const mutation of state.mutations) {
    if (!mutation.body) continue;
    expect(mutation.body).not.toHaveProperty("id");
    expect(mutation.body).not.toHaveProperty("updated_at");
    expect(mutation.body).not.toHaveProperty("created_at");
  }
  expect(errors).toEqual([]);
});

test("contact and every social channel save and can be removed on mobile", async ({
  page,
}) => {
  const state = await masterPanel(page);
  await page
    .getByRole("button", { name: "Configurações", exact: true })
    .click();
  const fields = [
    ["E-mail de contato", "contato@example.test"],
    ["Instagram (HTTPS)", "https://www.instagram.com/editado/"],
    ["YouTube (HTTPS)", "https://www.youtube.com/@editado"],
    ["Facebook (HTTPS)", "https://www.facebook.com/editado/"],
    ["TikTok (HTTPS)", "https://www.tiktok.com/@editado"],
    [
      "WhatsApp (HTTPS, ex.: https://wa.me/5511999999999)",
      "https://wa.me/5511999999999",
    ],
    ["Texto da página de contato", "Fale com a equipe da rádio."],
  ];
  for (const [label, value] of fields)
    await page.getByRole("textbox", { name: label, exact: true }).fill(value);
  await page
    .getByRole("button", { name: "Salvar configurações", exact: true })
    .click();
  await expect(
    page.getByText("Alterações salvas.", { exact: true }),
  ).toBeVisible();
  await expect(page.locator("main.admin-content")).toHaveAttribute(
    "aria-busy",
    "false",
  );
  expect(state.settings).toMatchObject({
    contact_text: fields[6][1],
    contact_email: fields[0][1],
    instagram_url: fields[1][1],
    youtube_url: fields[2][1],
    facebook_url: fields[3][1],
    tiktok_url: fields[4][1],
    whatsapp_url: fields[5][1],
  });
  for (const [label] of fields)
    await page.getByRole("textbox", { name: label, exact: true }).fill("");
  await page
    .getByRole("button", { name: "Salvar configurações", exact: true })
    .click();
  await expect.poll(() => state.mutations.length).toBe(2);
  expect(state.settings).toMatchObject({
    contact_text: "",
    contact_email: null,
    instagram_url: null,
    youtube_url: null,
    facebook_url: null,
    tiktok_url: null,
    whatsapp_url: null,
  });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.getByRole("button", { name: "Abrir menu administrativo" }).click();
  await page.getByRole("button", { name: "Galeria", exact: true }).click();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
});

test("editor rejects invalid images, uploads valid images and preserves edits after save failure", async ({
  page,
}) => {
  const state = await masterPanel(page);
  await page.getByRole("button", { name: "Galeria", exact: true }).click();
  await page.getByRole("button", { name: "Nova imagem", exact: true }).click();
  await page
    .getByLabel("Título / legenda da imagem")
    .fill("Imagem de validação");
  await page
    .getByRole("button", { name: "Salvar alterações", exact: true })
    .click();
  await expect(page.getByRole("alert")).toContainText("Adicione uma imagem");
  await page
    .getByLabel("URL da imagem (HTTPS ou /images/arquivo.webp)")
    .fill("javascript:alert(1)");
  await page
    .getByRole("button", { name: "Salvar alterações", exact: true })
    .click();
  await expect(page.getByRole("alert")).toContainText("URL HTTPS válida");
  await page
    .getByLabel("Enviar imagem (até 5 MB)")
    .setInputFiles({
      name: "unsafe.svg",
      mimeType: "image/svg+xml",
      buffer: Buffer.from("<svg/>"),
    });
  await expect(page.getByRole("alert")).toContainText("JPG, PNG, WebP ou GIF");
  expect(state.mutations).toHaveLength(0);
  await page
    .getByLabel("Enviar imagem (até 5 MB)")
    .setInputFiles({
      name: "safe.png",
      mimeType: "image/png",
      buffer: Buffer.from(
        "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=",
        "base64",
      ),
    });
  state.failNextSave = true;
  await page
    .getByRole("button", { name: "Salvar alterações", exact: true })
    .click();
  await expect(page.getByRole("alert")).toContainText(
    "Não foi possível salvar",
  );
  await expect(page.getByLabel("Título / legenda da imagem")).toHaveValue(
    "Imagem de validação",
  );
  expect(state.rows).toHaveLength(0);
  await page
    .getByRole("button", { name: "Salvar alterações", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "Imagem de validação", exact: true }),
  ).toBeVisible();
  expect(state.uploads).toHaveLength(2);
  expect(state.uploads[1]).toMatch(/^gallery\/[0-9a-f-]{36}\.png$/);
  expect(state.rows[0].image_url).toContain(
    `/deluxe-content/${state.uploads[1]}`,
  );
});
