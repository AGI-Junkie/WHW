import { expect, test } from "@playwright/test";

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
    await page
      .getByRole("navigation", { name: "Events in view" })
      .getByRole("button")
      .first()
      .focus();
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
