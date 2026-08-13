import { expect, test, type BrowserContext, type Page } from "@playwright/test";

async function enterName(page: Page, name: string) {
  await page.goto("/");
  await page.getByLabel("Tu nombre").fill(name);
}

async function assertNoOverflow(page: Page) {
  const dimensions = await page.evaluate(() => ({
    document: document.documentElement.scrollWidth,
    viewport: document.documentElement.clientWidth,
  }));
  expect(dimensions.document).toBeLessThanOrEqual(dimensions.viewport + 1);
}

test("ocho jugadores comparten una sala responsive y una mano sincronizada", async ({
  browser,
}) => {
  const contexts: BrowserContext[] = [];
  const pages: Page[] = [];
  try {
    for (let index = 0; index < 8; index += 1) {
      const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
      contexts.push(context);
      pages.push(await context.newPage());
    }

    await enterName(pages[0], "Jugador 1");
    await pages[0].getByRole("button", { name: "Crear sala" }).click();
    await expect(pages[0]).toHaveURL(/\/room\/[A-Z0-9]{6}$/);
    const code = pages[0].url().split("/").pop()!;

    for (let index = 1; index < pages.length; index += 1) {
      await enterName(pages[index], `Jugador ${index + 1}`);
      await pages[index].getByRole("button", { name: "Unirse con código" }).click();
      await pages[index].getByLabel("Código de sala").fill(code);
      await pages[index].getByRole("button", { name: "Entrar a la Sala" }).click();
      await expect(pages[index]).toHaveURL(new RegExp(`/room/${code}$`));
    }

    const selected = await contexts[0].request.post(`/api/rooms/${code}/game-type`, {
      data: { gameType: "poker" },
    });
    expect(selected.ok()).toBeTruthy();
    for (const context of contexts) {
      const ready = await context.request.post(`/api/rooms/${code}/ready`, {
        data: { ready: true },
      });
      expect(ready.ok()).toBeTruthy();
    }
    const start = await contexts[0].request.post(`/api/rooms/${code}/start`, { data: {} });
    expect(start.ok()).toBeTruthy();
    const firstHand = await contexts[0].request.post(`/api/rooms/${code}/action`, {
      data: { action: { type: "startHand" } },
    });
    expect(firstHand.ok()).toBeTruthy();

    const identities = await Promise.all(
      pages.map((page) => page.evaluate(() => localStorage.getItem("cg-player-id")))
    );
    const activeResponse = await contexts[0].request.get(`/api/rooms/${code}`);
    const activePayload = await activeResponse.json();
    const activeState = activePayload.room.gameState;
    const activePlayerId = activeState.players[activeState.currentPlayerIndex].playerId;
    const activeIndex = identities.indexOf(activePlayerId);
    expect(activeIndex).toBeGreaterThanOrEqual(0);
    await pages[activeIndex].setViewportSize({ width: 390, height: 844 });
    await pages[activeIndex].reload();
    await expect(pages[activeIndex].locator(".poker-betting-panel")).toBeVisible();
    await assertNoOverflow(pages[activeIndex]);
    await pages[activeIndex].screenshot({
      path: "test-results/poker-betting-panel-mobile.png",
      fullPage: true,
    });

    for (let index = 0; index < contexts.length; index += 1) {
      const response = await contexts[index].request.get(`/api/rooms/${code}`);
      const payload = await response.json();
      const state = payload.room.gameState;
      const own = state.players.find(
        (player: { playerId: string }) => player.playerId === identities[index]
      );
      expect(own).toBeTruthy();
      expect(own!.holeCards.some((card: { hidden?: boolean }) => !card.hidden)).toBeTruthy();
      expect(
        state.players
          .filter((player: { playerId: string }) => player.playerId !== identities[index])
          .flatMap((player: { holeCards: { hidden?: boolean }[] }) => player.holeCards)
          .every((card: { hidden?: boolean }) => card.hidden)
      ).toBeTruthy();
    }

    for (let step = 0; step < 7; step += 1) {
      const response = await contexts[0].request.get(`/api/rooms/${code}`);
      expect(response.ok()).toBeTruthy();
      const payload = await response.json();
      const state = payload.room.gameState;
      if (state.phase === "roundEnd" || state.phase === "showdown") break;
      const currentId = state.players[state.currentPlayerIndex].playerId;
      const actorIndex = identities.indexOf(currentId);
      expect(actorIndex).toBeGreaterThanOrEqual(0);
      const action = await contexts[actorIndex].request.post(
        `/api/rooms/${code}/action`,
        { data: { action: { type: "fold" } } }
      );
      expect(action.ok()).toBeTruthy();
    }

    const finalResponse = await contexts[0].request.get(`/api/rooms/${code}`);
    const finalPayload = await finalResponse.json();
    expect(["roundEnd", "showdown"]).toContain(finalPayload.room.gameState.phase);

    const viewports = [
      { width: 1440, height: 900, name: "desktop" },
      { width: 1024, height: 768, name: "tablet" },
      { width: 390, height: 844, name: "mobile-portrait" },
      { width: 844, height: 390, name: "mobile-landscape" },
    ];
    for (const viewport of viewports) {
      await pages[0].setViewportSize(viewport);
      await pages[0].reload();
      await expect(pages[0].locator(".poker-table-root")).toBeVisible();
      await assertNoOverflow(pages[0]);
      await pages[0].screenshot({
        path: `test-results/eight-player-${viewport.name}.png`,
        fullPage: true,
      });
    }
  } finally {
    await Promise.all(contexts.map((context) => context.close()));
  }
});

test("el panel de apuestas de blackjack es claro y cabe en móvil", async ({ browser }) => {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const page = await context.newPage();
  try {
    await enterName(page, "Jugador Blackjack");
    await page.getByRole("button", { name: "Crear sala" }).click();
    await expect(page).toHaveURL(/\/room\/[A-Z0-9]{6}$/);
    const code = page.url().split("/").pop()!;

    const selected = await context.request.post(`/api/rooms/${code}/game-type`, {
      data: { gameType: "blackjack" },
    });
    expect(selected.ok()).toBeTruthy();
    const ready = await context.request.post(`/api/rooms/${code}/ready`, {
      data: { ready: true },
    });
    expect(ready.ok()).toBeTruthy();
    const started = await context.request.post(`/api/rooms/${code}/start`, { data: {} });
    expect(started.ok()).toBeTruthy();

    await page.reload();
    await expect(page.getByRole("heading", { name: "Elige tu apuesta" })).toBeVisible();
    await expect(page.getByRole("button", { name: /Confirmar/ })).toBeVisible();
    await expect(page.locator(".live-bet-presets button")).toHaveCount(4);
    await assertNoOverflow(page);
    await page.screenshot({
      path: "test-results/blackjack-betting-panel-mobile.png",
      fullPage: true,
    });
  } finally {
    await context.close();
  }
});

test("el reveal del crupier respeta cada etapa antes del resultado", async ({ browser }) => {
  const context = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  const page = await context.newPage();
  try {
    await enterName(page, "Reloj Blackjack");
    await page.getByRole("button", { name: "Crear sala" }).click();
    await expect(page).toHaveURL(/\/room\/[A-Z0-9]{6}$/);
    const code = page.url().split("/").pop()!;

    await context.request.post(`/api/rooms/${code}/game-type`, {
      data: { gameType: "blackjack" },
    });
    await context.request.post(`/api/rooms/${code}/ready`, { data: { ready: true } });
    await context.request.post(`/api/rooms/${code}/start`, { data: {} });

    let playable = false;
    for (let attempt = 0; attempt < 6 && !playable; attempt += 1) {
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

    await page.reload();
    const stand = page.getByRole("button", { name: /Plantarse/i });
    await expect(stand).toBeVisible({ timeout: 15_000 });
    const dealer = page.locator(".live-felt-zone--dealer");
    const result = page.locator(".live-result-overlay");
    const startedAt = Date.now();
    await stand.click();

    await expect(dealer).toHaveAttribute("data-reveal-stage", "pause");
    await expect(dealer).toHaveAttribute("data-reveal-stage", "flip", { timeout: 2_500 });
    const flipAt = Date.now();
    expect(flipAt - startedAt).toBeGreaterThanOrEqual(750);

    await expect(dealer).toHaveAttribute("data-reveal-stage", "settle", { timeout: 2_500 });
    const settleAt = Date.now();
    // El polling puede detectar el inicio del flip hasta ~300 ms tarde.
    expect(settleAt - flipAt).toBeGreaterThanOrEqual(1_200);
    await expect(result).toHaveCount(0);

    await expect(result).toBeVisible({ timeout: 8_000 });
    const resultAt = Date.now();
    expect(resultAt - settleAt).toBeGreaterThanOrEqual(800);
    expect(resultAt - startedAt).toBeGreaterThanOrEqual(3_200);
  } finally {
    await context.close();
  }
});
