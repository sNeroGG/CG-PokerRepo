import {
  expect,
  test,
  type BrowserContext,
  type Page,
  type TestInfo,
} from "@playwright/test";

async function enterName(page: Page, name: string) {
  await page.goto("/");
  await page.getByLabel("Tu nombre").fill(name);
}

async function assertGameFitsViewport(page: Page) {
  const dimensions = await page.evaluate(() => {
    const root = document.querySelector<HTMLElement>(".live-casino-root");
    const controls = document.querySelector<HTMLElement>(".live-tablet-overlay");
    const rootRect = root?.getBoundingClientRect();
    const controlsRect = controls?.getBoundingClientRect();
    return {
      documentWidth: document.documentElement.scrollWidth,
      viewportWidth: document.documentElement.clientWidth,
      viewportHeight: window.visualViewport?.height ?? window.innerHeight,
      rootTop: rootRect?.top ?? -1,
      rootBottom: rootRect?.bottom ?? -1,
      controlsLeft: controlsRect?.left ?? -1,
      controlsRight: controlsRect?.right ?? -1,
      controlsBottom: controlsRect?.bottom ?? -1,
    };
  });

  expect(dimensions.documentWidth).toBeLessThanOrEqual(
    dimensions.viewportWidth + 1
  );
  expect(dimensions.rootTop).toBeGreaterThanOrEqual(-1);
  expect(dimensions.rootBottom).toBeLessThanOrEqual(
    dimensions.viewportHeight + 2
  );
  expect(dimensions.controlsLeft).toBeGreaterThanOrEqual(-1);
  expect(dimensions.controlsRight).toBeLessThanOrEqual(
    dimensions.viewportWidth + 1
  );
  expect(dimensions.controlsBottom).toBeLessThanOrEqual(
    dimensions.viewportHeight + 2
  );
}

async function createPlayableBlackjack(
  page: Page,
  context: BrowserContext,
  playerName: string
) {
  await enterName(page, playerName);
  await page.getByRole("button", { name: "Crear sala" }).click();
  await expect(page).toHaveURL(/\/room\/[A-Z0-9]{6}$/);
  const code = page.url().split("/").pop()!;

  expect(
    (
      await context.request.post(`/api/rooms/${code}/game-type`, {
        data: { gameType: "blackjack" },
      })
    ).ok()
  ).toBeTruthy();
  expect(
    (
      await context.request.post(`/api/rooms/${code}/ready`, {
        data: { ready: true },
      })
    ).ok()
  ).toBeTruthy();
  expect(
    (
      await context.request.post(`/api/rooms/${code}/start`, { data: {} })
    ).ok()
  ).toBeTruthy();

  let playable = false;
  for (let attempt = 0; attempt < 8 && !playable; attempt += 1) {
    if (attempt > 0) {
      await context.request.post(`/api/rooms/${code}/action`, {
        data: { action: { type: "newRound" } },
      });
    }
    const bet = await context.request.post(`/api/rooms/${code}/action`, {
      data: { action: { type: "bet", amount: 100 } },
    });
    const payload = await bet.json();
    playable = payload.room?.gameState?.phase === "playerTurn";
  }
  expect(playable).toBeTruthy();
}

test("incluye los recursos necesarios para instalarse sin cachear las salas", async ({
  page,
}, testInfo) => {
  await page.goto("/");

  await expect(page.locator('link[rel="manifest"]')).toHaveAttribute(
    "href",
    "/manifest.webmanifest"
  );
  await expect(page.locator('meta[name="viewport"]')).toHaveAttribute(
    "content",
    /viewport-fit=cover/
  );
  await expect(
    page.locator('link[rel="apple-touch-icon"]')
  ).toHaveAttribute("href", /apple-touch-icon\.png/);

  const manifestResponse = await page.request.get("/manifest.webmanifest");
  expect(manifestResponse.ok()).toBeTruthy();
  const manifest = await manifestResponse.json();
  expect(manifest.display).toBe("standalone");
  expect(manifest.start_url).toBe("/");
  expect(manifest.icons).toEqual(
    expect.arrayContaining([
      expect.objectContaining({ sizes: "192x192", purpose: "any" }),
      expect.objectContaining({ sizes: "512x512", purpose: "any" }),
      expect.objectContaining({ sizes: "512x512", purpose: "maskable" }),
    ])
  );

  const workerResponse = await page.request.get("/sw.js");
  expect(workerResponse.ok()).toBeTruthy();
  expect(workerResponse.headers()["cache-control"]).toContain("max-age=0");
  const workerSource = await workerResponse.text();
  expect(workerSource).toContain('url.pathname.startsWith("/api/")');
  expect(workerSource).toContain("url.origin !== self.location.origin");

  const registrationScope = await page.evaluate(async () => {
    if (!("serviceWorker" in navigator)) return null;
    const registration = await navigator.serviceWorker.register("/sw.js");
    const ready = await navigator.serviceWorker.ready;
    return ready.scope || registration.scope;
  });
  expect(registrationScope).toBe("http://127.0.0.1:3000/");

  if (testInfo.project.name === "ios-webkit") {
    await expect(page.getByTestId("install-app")).toBeVisible();
    await expect(
      page.getByRole("button", { name: "Añadir a pantalla de inicio" })
    ).toBeVisible();
  }

  await page.evaluate(async () => {
    const registrations = await navigator.serviceWorker?.getRegistrations();
    await Promise.all(registrations?.map((item) => item.unregister()) ?? []);
    const keys = await caches?.keys();
    await Promise.all(
      keys?.filter((key) => key.startsWith("cgc-")).map((key) => caches.delete(key)) ??
        []
    );
  });
});

test("el giro del crupier es continuo y la mesa conserva sus proporciones", async ({
  page,
  context,
}, testInfo: TestInfo) => {
  await createPlayableBlackjack(
    page,
    context,
    `Animación ${testInfo.project.name}`
  );

  await page.reload();
  await expect(page.locator(".live-casino-root")).toBeVisible();
  await assertGameFitsViewport(page);

  if (testInfo.project.name !== "desktop-chromium") {
    await page.setViewportSize({ width: 844, height: 390 });
    await page.reload();
    await expect
      .poll(() =>
        page.evaluate(() =>
          document.documentElement.classList.contains("mobile-play-mode")
        )
      )
      .toBe(true);
    await assertGameFitsViewport(page);
  }

  const stand = page.getByRole("button", { name: /Plantarse/i });
  await expect(stand).toBeVisible({ timeout: 15_000 });
  await stand.click();

  const dealer = page.locator(".live-felt-zone--dealer");
  await expect(dealer).toHaveAttribute("data-reveal-stage", "pause");
  await expect(dealer).toHaveAttribute("data-reveal-stage", "flip", {
    timeout: 2_500,
  });

  const flippingCard = page.locator(".live-table-card--flip");
  await expect(flippingCard).toBeVisible();
  const animation = await flippingCard.evaluate(async (card) => {
    const inner = card.querySelector<HTMLElement>(".live-table-card-inner");
    if (!inner) throw new Error("No se encontró el interior de la carta");

    const style = getComputedStyle(inner);
    const initial = {
      name: style.animationName,
      duration: style.animationDuration,
      backface: style.backfaceVisibility,
    };
    const timestamps: number[] = [];
    const transforms = new Set<string>();
    const startedAt = performance.now();

    await new Promise<void>((resolve) => {
      const sample = (now: number) => {
        timestamps.push(now);
        transforms.add(getComputedStyle(inner).transform);
        if (now - startedAt >= 700) {
          resolve();
          return;
        }
        requestAnimationFrame(sample);
      };
      requestAnimationFrame(sample);
    });

    const gaps = timestamps.slice(1).map((time, index) => time - timestamps[index]);
    return {
      ...initial,
      frames: timestamps.length,
      uniqueTransforms: transforms.size,
      largestFrameGap: Math.max(0, ...gaps),
    };
  });

  expect(animation.name).toContain("cardFlipReveal");
  expect(animation.duration).toBe("1.6s");
  expect(animation.backface).toBe("hidden");
  expect(animation.frames).toBeGreaterThan(12);
  expect(animation.uniqueTransforms).toBeGreaterThan(8);
  expect(animation.largestFrameGap).toBeLessThan(250);

  await expect(dealer).toHaveAttribute("data-reveal-stage", "settle", {
    timeout: 2_500,
  });
  await expect(page.locator(".live-result-overlay")).toHaveCount(0);
  await assertGameFitsViewport(page);

  await page.screenshot({
    path: testInfo.outputPath(`dealer-reveal-${testInfo.project.name}.png`),
  });
});
