import { expect, test } from "@playwright/test";

test("loads the globe with the 1945 borders and warms the neighbouring snapshots", async ({
  page,
}) => {
  const fetched: string[] = [];
  page.on("request", (r) => {
    const m = /\/data\/borders\/(world_\w+)\.geojson/.exec(r.url());
    if (m) fetched.push(m[1]!);
  });
  await page.goto("/");
  await expect(page.getByTestId("globe-stage").locator("canvas")).toBeVisible();
  await expect(page.locator(".era")).toContainText("borders of 1945");
  await expect
    .poll(() => fetched.sort(), { timeout: 15_000 })
    .toEqual(["world_1938", "world_1945", "world_1994"]);
});

test("scrubbing the timeline swaps the border snapshot", async ({ page }) => {
  await page.goto("/");
  await expect(page.locator(".era")).toContainText("borders of 1945");
  // The slider is 0–1000 on a non-linear scale; the far left is 3000 BC.
  await page.getByRole("slider", { name: "Year", exact: true }).fill("0");
  await expect(page.locator(".era")).toContainText(/borders of (3000|2000) BC/);
});

test("a story deep link opens the immersive view", async ({ page }) => {
  await page.goto("/#y=1453&e=fall-of-constantinople&s=1");
  await expect(page.getByRole("dialog", { name: /^Story: / })).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog", { name: /^Story: / })).toBeHidden();
});

test("the language switch translates the UI and is remembered", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "中文", exact: true }).click();
  await expect(page.locator(".era")).toContainText("1945年的边界");
  await expect(page.locator("html")).toHaveAttribute("lang", "zh-CN");
  await page.reload();
  await expect(page.locator(".era")).toContainText("1945年的边界");
  await page.getByRole("button", { name: "EN", exact: true }).click();
  await expect(page.locator(".era")).toContainText("borders of 1945");
});

test("the quiz scores a click on the globe", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: /Quiz/ }).click();
  await expect(page.getByText("Where did this happen?")).toBeVisible();
  const globe = page.getByTestId("globe-stage").locator("canvas");
  const box = (await globe.boundingBox())!;
  // react-globe.gl resolves a click from the last hover raycast (done per frame), so hover first.
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.waitForTimeout(300);
  await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
  await expect(page.getByText(/km away · \+\d+ points/)).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(page.locator(".quiz")).toBeHidden();
});

test("compare mode overlays a second snapshot", async ({ page }) => {
  await page.goto("/");
  await expect(page.locator(".era")).toContainText("borders of 1945");
  await page.getByLabel("Compare borders").selectOption("1914");
  await expect(page.locator(".compare-key")).toContainText("1914");
});

test("a shared tour link starts the visitor's tour", async ({ page }) => {
  await page.goto("/#t=fall-of-constantinople,apollo-11");
  await expect(page.locator(".tour")).toContainText("My tour");
  await expect(page.locator(".tour")).toContainText("stop 1 of 2");
  // The address keeps the tour after the hash sync runs, so reloading reopens it.
  await page.waitForTimeout(800);
  expect(page.url()).toContain("#t=fall-of-constantinople,apollo-11");
});

test("Esc closes the gallery without leaving the story underneath", async ({ page }) => {
  await page.goto("/#y=1453&e=fall-of-constantinople");
  await expect(page.locator(".panel")).toBeVisible();
  await page
    .getByRole("button", { name: /Stories/ })
    .first()
    .click();
  await expect(page.getByRole("dialog", { name: "Immersive stories" })).toBeVisible();
  await page.keyboard.press("ArrowRight");
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog", { name: "Immersive stories" })).toBeHidden();
  await expect(page.locator(".panel h2")).toHaveText("The fall of Constantinople");
});

test("the quiz runs five rounds to a final score", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: /Quiz/ }).click();
  const globe = page.getByTestId("globe-stage").locator("canvas");
  const box = (await globe.boundingBox())!;
  const centre = { x: box.x + box.width / 2, y: box.y + box.height / 2 };
  for (let round = 1; round <= 5; round++) {
    await expect(page.locator(".quiz .meta")).toContainText(`round ${round} of 5`);
    await page.mouse.move(centre.x, centre.y);
    await page.waitForTimeout(300);
    await page.mouse.click(centre.x, centre.y);
    await expect(page.getByText(/km away · \+\d+ points/)).toBeVisible();
    await page.getByRole("button", { name: round < 5 ? "Next →" : "See the score" }).click();
  }
  await expect(page.getByText(/Final score: \d+ \/ 5000/)).toBeVisible();
});

test("events added to My tour play as a tour and share as a link", async ({ page }) => {
  await page.goto("/#y=1453&e=fall-of-constantinople");
  await page.getByRole("button", { name: /Add to my tour/ }).click();
  await page.getByRole("button", { name: "Later →" }).click();
  await expect(page.locator(".panel h2")).not.toHaveText("The fall of Constantinople");
  await page.getByRole("button", { name: /Add to my tour/ }).click();
  await page.getByRole("combobox", { name: "Story tours" }).selectOption({ label: "My tour" });
  await expect(page.locator(".tour")).toContainText("stop 1 of 2");
  await expect.poll(() => page.url()).toMatch(/#t=fall-of-constantinople,[a-z0-9-]+$/);
});

test("R picks a random event and the arrow keys step through time", async ({ page }) => {
  await page.goto("/");
  await page.locator("body").click({ position: { x: 5, y: 5 } });
  await page.keyboard.press("r");
  const panel = page.getByRole("complementary", { name: /^Event:/ });
  await expect(panel).toBeVisible();
  const first = await panel.locator("h2").textContent();
  await page.keyboard.press("ArrowRight");
  await expect(panel.locator("h2")).not.toHaveText(first!);
  await page.keyboard.press("ArrowLeft");
  await expect(panel.locator("h2")).toHaveText(first!);
});

test("the List button shows the events in view and Esc hands focus back", async ({ page }) => {
  await page.goto("/#y=1453");
  const toggle = page.getByRole("button", { name: /List/ });
  await toggle.click();
  const nav = page.getByRole("navigation", { name: "Events in view" });
  await expect(nav).toHaveClass(/open/);
  await expect(nav.getByRole("button", { name: /The fall of Constantinople/ })).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(nav).not.toHaveClass(/open/);
  await expect(toggle).toBeFocused();
  await page.keyboard.press("l");
  await expect(nav).toHaveClass(/open/);
  await nav.getByRole("button", { name: /The fall of Constantinople/ }).click();
  await expect(page.locator(".panel h2")).toHaveText("The fall of Constantinople");
});

test("the category filter is kept in the link", async ({ page }) => {
  await page.goto("/#y=1942&hide=war");
  const legend = page.getByRole("group", { name: "Filter events by category" });
  await expect(legend.getByRole("button", { name: /war/ })).toHaveAttribute(
    "aria-pressed",
    "false",
  );
  await legend.getByRole("button", { name: /disaster/ }).click();
  await expect.poll(() => page.url()).toContain("hide=war,disaster");
  await page.reload();
  await expect(legend.getByRole("button", { name: /disaster/ })).toHaveAttribute(
    "aria-pressed",
    "false",
  );
});

test("in Chinese, event titles and stories are translated", async ({ page }) => {
  await page.goto("/#y=1453&e=fall-of-constantinople");
  await page.getByRole("button", { name: "中文", exact: true }).click();
  await expect(page.locator(".panel h2")).toHaveText("君士坦丁堡陷落");
  await page.getByRole("button", { name: /沉浸式故事/ }).click();
  await expect(page.getByRole("dialog", { name: /君士坦丁堡陷落/ })).toBeVisible();
  await expect(page.getByText("鲁梅利堡").first()).toBeVisible();
  await page.keyboard.press("Escape");
  await page.getByRole("button", { name: "EN", exact: true }).click();
});

test.describe("World History Web", () => {
  test("loads the atlas and shows the year, timeline and legend", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByRole("heading", { name: "World History Web" })).toBeVisible();
    await expect(page.getByRole("slider", { name: "Year" })).toBeVisible();
    await expect(page.getByTestId("globe-stage")).toBeVisible();
    await expect(page.getByRole("group", { name: "Filter events by category" })).toBeVisible();
  });

  test("the year slider is keyboard operable and announces the year", async ({ page }) => {
    await page.goto("/");
    const slider = page.getByRole("slider", { name: "Year" });
    const before = await slider.getAttribute("aria-valuetext");
    await slider.focus();
    await page.keyboard.press("Home");
    await expect.poll(() => slider.getAttribute("aria-valuetext")).not.toBe(before);
  });

  test("play button toggles and the space bar pauses", async ({ page }) => {
    await page.goto("/");
    await page.getByRole("button", { name: "▶ Play" }).click();
    await expect(page.getByRole("button", { name: "❚❚ Pause" })).toBeVisible();
    await page.locator("body").click({ position: { x: 5, y: 5 } });
    await page.keyboard.press("Space");
    await expect(page.getByRole("button", { name: "▶ Play" })).toBeVisible();
  });

  test("an event can be opened without a mouse via the events list", async ({ page }) => {
    await page.goto("/");
    const nav = page.getByRole("navigation", { name: "Events in view" });
    await nav.getByRole("button").first().focus();
    // The hidden list must reveal itself on focus, so sighted keyboard users see where they are.
    expect((await nav.boundingBox())!.width).toBeGreaterThan(200);
    await page.keyboard.press("Enter");
    await expect(page.getByRole("complementary", { name: /^Event:/ })).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(page.getByRole("complementary", { name: /^Event:/ })).toHaveCount(0);
  });

  test("category filter toggles", async ({ page }) => {
    await page.goto("/");
    const first = page
      .getByRole("group", { name: "Filter events by category" })
      .getByRole("button")
      .first();
    await expect(first).toHaveAttribute("aria-pressed", "true");
    await first.click();
    await expect(first).toHaveAttribute("aria-pressed", "false");
  });

  test("a story tour starts and exits", async ({ page }) => {
    await page.goto("/");
    await page.getByRole("combobox", { name: "Story tours" }).selectOption({ index: 1 });
    await expect(page.getByRole("region", { name: /^Story tour:/ })).toBeVisible();
    await page.getByRole("button", { name: "Exit" }).click();
    await expect(page.getByRole("region", { name: /^Story tour:/ })).toHaveCount(0);
  });

  test("the wiki proxy rejects bad titles", async ({ request }) => {
    const res = await request.get("/api/wiki/summary?title=%3Cscript%3E");
    expect(res.status()).toBe(400);
  });
});

test.describe("on a phone", () => {
  test.use({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true });

  const noHorizontalScroll = (page: import("@playwright/test").Page) =>
    expect
      .poll(() => page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth))
      .toBeLessThanOrEqual(0);

  test("scrub the timeline, open an event, open its story", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByTestId("globe-stage").locator("canvas")).toBeVisible();
    await expect(page.locator(".era")).toContainText("borders of 1945");
    await noHorizontalScroll(page);

    // Scrub by touch: a tap near the left end of the slider jumps back to antiquity.
    const slider = page.getByRole("slider", { name: "Year", exact: true });
    const box = (await slider.boundingBox())!;
    expect(box.height).toBeGreaterThanOrEqual(44);
    await page.touchscreen.tap(box.x + 4, box.y + box.height / 2);
    await expect(page.locator(".era")).toContainText(/borders of (3000|2000) BC/);

    // Markers are too small to tap on a phone; the button under the track opens the nearest one.
    const nearest = page.locator(".nearest-event");
    await expect(nearest).toBeVisible();
    const title = (await nearest.textContent())!.split(" · ").slice(1).join(" · ");
    await nearest.tap();
    const panel = page.getByRole("complementary", { name: /^Event:/ });
    await expect(panel.locator("h2")).toHaveText(title);
    // The panel is a bottom sheet: full width, flush with the bottom of the screen once it has slid in.
    await expect
      .poll(async () => {
        const b = (await panel.boundingBox())!;
        return [b.x, b.width, Math.round(b.y + b.height)];
      })
      .toEqual([0, 390, 844]);
    await noHorizontalScroll(page);

    await panel.locator(".story-cta").tap();
    const story = page.getByRole("dialog", { name: /^Story: / });
    await expect(story).toBeVisible();
    const card = (await story.locator(".story-card").boundingBox())!;
    expect(card.x).toBeGreaterThanOrEqual(0);
    expect(card.x + card.width).toBeLessThanOrEqual(390);
    await story.getByRole("button", { name: "Next →" }).tap();
    await expect(story.locator(".story-card .meta").first()).toContainText("Chapter 2");
    await noHorizontalScroll(page);
    await story.getByRole("button", { name: "Leave the story" }).tap();
    await expect(story).toBeHidden();
  });

  test("the facts and quote of a curated story fold into the card", async ({ page }) => {
    await page.goto("/#y=1453&e=fall-of-constantinople&s=1");
    const story = page.getByRole("dialog", { name: /^Story: / });
    await expect(story.locator(".story-side")).toBeHidden();
    await story.getByText("Key facts").tap();
    await expect(story.locator(".story-extra .story-facts")).toBeVisible();
  });

  test("controls are at least 44px and nothing scrolls sideways at 360px", async ({ page }) => {
    await page.setViewportSize({ width: 360, height: 740 });
    for (const hash of [
      "",
      "#y=1453&e=fall-of-constantinople",
      "#y=1453&e=fall-of-constantinople&s=1",
    ]) {
      await page.goto("/" + hash);
      await page.reload();
      await expect(page.getByTestId("globe-stage").locator("canvas")).toBeVisible();
      await noHorizontalScroll(page);
      const small = await page.evaluate(() =>
        [...document.querySelectorAll<HTMLElement>("button, select, input")]
          .filter((el) => {
            const r = el.getBoundingClientRect();
            const tappable =
              getComputedStyle(el).pointerEvents !== "none" && !el.closest(".sr-only");
            return tappable && r.width > 0 && (r.width < 44 || r.height < 44);
          })
          .map((el) => el.getAttribute("aria-label") ?? el.textContent),
      );
      expect(small).toEqual([]);
    }
  });
});
