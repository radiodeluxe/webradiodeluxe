import { test, expect } from "@playwright/test";
import { readFile } from "node:fs/promises";

const poll = {
  id: "e37a0cf1-6604-4f3b-a8f3-f89f3442b6e3",
  question: "Qual som você quer ouvir?",
  status: "active",
  ends_at: null,
  total: 0,
  options: [
    {
      id: "5d877db7-15e1-40dd-9b6e-17321190c001",
      label: "Rap nacional",
      votes: 0,
    },
    {
      id: "5d877db7-15e1-40dd-9b6e-17321190c002",
      label: "Clássicos",
      votes: 0,
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
    whatsapp_url: "https://wa.me/5561999990000",
    contact_email: "contato@example.com",
    contact_text: "Envie seu pedido de música.",
  },
  banners: [
    {
      id: "1",
      title: "Primeiro anúncio de teste",
      alt_text: "Primeiro anúncio de teste",
      image_url: "https://images.example/top-one.webp",
      target_url: "https://partner.example/one",
      slot: "top",
      position: 0,
    },
    {
      id: "2",
      title: "Segundo anúncio de teste",
      alt_text: "Segundo anúncio de teste",
      image_url: "https://images.example/top-two.webp",
      target_url: null,
      slot: "top",
      position: 1,
    },
    {
      id: "3",
      title: "Anúncio inferior de teste",
      alt_text: "Anúncio inferior de teste",
      image_url: "https://images.example/bottom.webp",
      target_url: null,
      slot: "bottom",
      position: 2,
    },
  ],
  poll,
  poll_available: true,
};

test("app combines legacy placements in a square carousel above the player, rotating every 15 seconds", async ({
  page,
}) => {
  await page.setViewportSize({ width: 360, height: 900 });
  await page.clock.install({ time: new Date("2026-10-25T15:00:00Z") });
  await page.clock.pauseAt(new Date("2026-10-25T15:00:01Z"));
  await page.route("**/api/app", (route) => route.fulfill({ json: config }));
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
  const box = await top.locator("a").boundingBox();
  expect(box!.width / box!.height).toBeCloseTo(1, 2);
  await expect(top.locator("img")).toHaveCSS("object-fit", "contain");
  await expect(top.locator("a")).toHaveAttribute("rel", /sponsored/);
  await page.clock.fastForward(14999);
  await expect(top.getByAltText("Primeiro anúncio de teste")).toBeVisible();
  await page.clock.fastForward(1);
  await expect(top.getByAltText("Segundo anúncio de teste")).toBeVisible();
  await page.clock.fastForward(15000);
  await expect(top.getByAltText("Anúncio inferior de teste")).toBeVisible();
  await expect(page.getByRole("region", { name: /Publicidade/ })).toHaveCount(1);
  const player = await page.getByRole("region", { name: "Player da rádio" }).boundingBox();
  expect(player!.y).toBeGreaterThan(box!.y + box!.height);
  const play = await page.getByRole("button", { name: "Ouvir rádio", exact: true }).boundingBox();
  expect(play!.y + play!.height).toBeLessThan(900);
  await page.clock.fastForward(15000);
  await expect(top.getByAltText("Primeiro anúncio de teste")).toBeVisible();
  await expect(
    page.getByRole("link", { name: "Abrir Instagram da rádio" }),
  ).toHaveAttribute("href", /radiojkhiphop/);
  await expect(
    page.getByRole("link", { name: "Abrir Facebook da rádio" }),
  ).toHaveCount(0);
  await expect(
    page.getByRole("button", { name: "Ouvir rádio", exact: true }),
  ).toBeDisabled();
  await expect(page.getByRole("status")).toContainText([
    "TRANSMISSÃO EM CONFIGURAÇÃO",
  ]);
  expect(
    await page.locator("audio").evaluate((audio) => audio.paused),
  ).toBeTruthy();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBeTruthy();
  await page.screenshot({
    path: "artifacts/app-preview-mobile.png",
    fullPage: true,
  });
});

test("app menu shares contact and anonymous poll, records a vote once and displays results", async ({
  page,
}) => {
  await page.route("**/api/app", (route) =>
    route.fulfill({ json: { ...config, banners: [] } }),
  );
  const results = {
    ...poll,
    total: 1,
    options: [{ ...poll.options[0], votes: 1 }, poll.options[1]],
  };
  let count = 0;
  await page.route("**/api/poll", async (route) => {
    count++;
    expect(route.request().postDataJSON()).toEqual({
      poll_id: poll.id,
      option_id: poll.options[0].id,
    });
    await route.fulfill({ json: { already_voted: false, results } });
  });
  await page.goto("/aplicativo");
  await page.getByRole("button", { name: "Abrir menu" }).click();
  await page.getByRole("navigation", { name: "Menu do aplicativo" }).getByRole("button", { name: "Contato", exact: true }).click();
  await expect(page.getByRole("dialog")).toContainText(
    "Envie seu pedido de música.",
  );
  await expect(
    page.getByRole("link", { name: "Conversar no WhatsApp" }),
  ).toHaveAttribute("href", config.radio.whatsapp_url);
  await page.keyboard.press("Escape");
  await page.getByRole("button", { name: "Abrir menu" }).click();
  await page.getByRole("navigation", { name: "Menu do aplicativo" }).getByRole("button", { name: "Enquete", exact: true }).click();
  await page.getByLabel("Rap nacional", { exact: true }).check();
  await page.getByRole("button", { name: "Confirmar voto" }).click();
  await expect(page.getByRole("dialog")).toContainText("Voto registrado.");
  await expect(page.getByRole("dialog")).toContainText("100%");
  await expect(
    page.getByRole("button", { name: "Confirmar voto" }),
  ).toHaveCount(0);
  expect(count).toBe(1);
  await expect(page.getByRole("region", { name: /Publicidade/ })).toHaveCount(
    0,
  );
});

test("fresh configuration updates app identity and menu without a new build and handles failures", async ({
  page,
}) => {
  await page.clock.install();
  let current = { ...config, banners: [] };
  await page.route("**/api/app", (route) => route.fulfill({ json: current }));
  await page.goto("/aplicativo");
  await expect(
    page.getByRole("heading", { name: "JK HipHop", exact: true }),
  ).toBeVisible();
  current = {
    ...current,
    settings: {
      ...current.settings,
      radio_name: "JK HipHop ao vivo",
      show_poll: false,
      show_contact: false,
    },
  };
  await page.clock.fastForward(60001);
  await expect(
    page.getByRole("heading", { name: "JK HipHop ao vivo", exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Abrir menu" }).click();
  await expect(
    page.getByRole("button", { name: "Enquete", exact: true }),
  ).toHaveCount(0);
  await expect(
    page.getByRole("button", { name: "Contato", exact: true }),
  ).toHaveCount(0);
  await page.route("**/api/app", (route) =>
    route.fulfill({ status: 503, json: { error: "Indisponível" } }),
  );
  await page.clock.fastForward(60001);
  await expect(
    page.getByRole("status").filter({ hasText: "Não foi possível atualizar" }),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "JK HipHop ao vivo", exact: true }),
  ).toBeVisible();
});


test("ticker stays between advertisement and player, scrolls, pauses and updates on refresh", async ({page}) => {
  await page.setViewportSize({width:360,height:900});
  await page.clock.install();
  let settings = {...config.settings, ticker_enabled:true, ticker_text:"JK HipHop • A cultura tem voz", ticker_text_color:"black"};
  await page.route("**/api/app",route=>route.fulfill({json:{...config,settings}}));
  await page.route("https://images.example/**",route=>route.fulfill({contentType:"image/webp",path:"public/images/crowd.webp"}));
  await page.goto('/aplicativo');
  const ticker = page.getByRole('region',{name:'Mensagem da rádio',exact:true});
  await expect(ticker).toHaveCSS('background-color','rgb(255, 207, 0)');
  await expect(ticker).toHaveCSS('color','rgb(0, 0, 0)');
  const ad = await page.locator('.ra-ad').boundingBox();
  const band = await ticker.boundingBox();
  const player = await page.locator('.ra-player').boundingBox();
  expect(band!.y).toBeGreaterThanOrEqual(ad!.y+ad!.height);
  expect(player!.y).toBeGreaterThanOrEqual(band!.y+band!.height);
  const track = ticker.locator('.app-ticker-track');
  const before = await track.evaluate(el=>getComputedStyle(el).transform);
  await expect.poll(()=>track.evaluate(el=>getComputedStyle(el).transform)).not.toBe(before);
  await page.getByRole('button',{name:'Pausar texto deslizante'}).click();
  await expect(track).toHaveCSS('animation-play-state','paused');
  settings={...settings,ticker_text:'Mensagem atualizada <img src=x>',ticker_text_color:'white'};
  await page.clock.runFor(60000);
  await expect(ticker).toContainText(settings.ticker_text);
  await expect(ticker).toHaveCSS('color','rgb(255, 255, 255)');
  await expect(ticker.locator('img')).toHaveCount(0);
  await page.screenshot({path:'artifacts/app-ticker-mobile.png',fullPage:true});
  settings={...settings,ticker_enabled:false};
  await page.clock.runFor(60000);
  await expect(ticker).toHaveCount(0);
});

test("ticker respects reduced motion and wraps a long message without horizontal overflow", async ({page}) => {
  await page.setViewportSize({width:320,height:568});
  await page.emulateMedia({reducedMotion:'reduce'});
  await page.route('**/api/app',route=>route.fulfill({json:{...config,banners:[],settings:{...config.settings,ticker_enabled:true,ticker_text:'JK HipHop • '.repeat(25),ticker_text_color:'white'}}}));
  await page.goto('/aplicativo');
  await expect(page.locator('.app-ticker-track')).toHaveCSS('animation-name','none');
  await expect(page.getByRole('button',{name:'Pausar texto deslizante'})).toBeHidden();
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
});
