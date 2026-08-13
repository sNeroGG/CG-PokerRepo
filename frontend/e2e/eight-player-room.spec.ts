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

    await pages[0].getByRole("button", { name: /Texas Hold'em/ }).click();
    for (const page of pages) {
      await page.getByRole("button", { name: /^Listo$/ }).click();
    }
    await pages[0].getByRole("button", { name: "Iniciar partida" }).click();
    await pages[0].getByRole("button", { name: "Iniciar mano" }).click();

    const identities = await Promise.all(
      pages.map((page) => page.evaluate(() => localStorage.getItem("cg-player-id")))
    );
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
