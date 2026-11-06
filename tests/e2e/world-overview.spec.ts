import { expect, test } from "@playwright/test";

test("compares regions, traps focus and opens an event at its actual year", async ({ page }) => {
  await page.goto("/#y=1945");
  await expect(page.locator(".readout")).toHaveText("1945");
  const opener = page.getByRole("button", { name: "🌐 Meanwhile", exact: true });
  await opener.click();
  const dialog = page.getByRole("dialog", { name: "Meanwhile, around the world" });
  await expect(dialog).toBeVisible();
  await expect(dialog).toContainText("Time window: 1939 – 1951");
  await expect(dialog.getByRole("region")).toHaveCount(8);
  await expect(dialog.getByRole("slider", { name: "Explore year" })).toHaveAttribute(
    "aria-valuetext",
    "1945",
  );
  await expect(dialog.getByRole("button", { name: "Close", exact: true })).toBeFocused();
  await page.keyboard.press("Shift+Tab");
  await expect(dialog.locator(".card").last()).toBeFocused();
  await page.keyboard.press("Tab");
  await expect(dialog.getByRole("button", { name: "Close", exact: true })).toBeFocused();
  await page.keyboard.press("Escape");
  await expect(dialog).toBeHidden();
  await expect(opener).toBeFocused();
  await opener.click();
  const card = dialog.getByRole("region", { name: "Europe", exact: true }).locator(".card").first();
  const title = await card.locator("b").innerText();
  const year = (await card.locator(".meta").innerText()).match(/^\d+/)![0]!;
  await card.click();
  await expect(dialog).toBeHidden();
  await expect(page.locator(".panel h2")).toHaveText(title);
  await expect(page.locator(".readout")).toHaveText(year);
  await expect(page).toHaveURL(/#.*e=/);
});

test("pauses playback and follows category filters", async ({ page }) => {
  await page.goto("/#y=1945&hide=war");
  await expect(page.locator(".readout")).toHaveText("1945");
  await page.getByRole("button", { name: "▶ Play", exact: true }).click();
  await page.getByRole("button", { name: "🌐 Meanwhile", exact: true }).click();
  const dialog = page.getByRole("dialog", { name: "Meanwhile, around the world" });
  await expect(page.getByRole("button", { name: "▶ Play", exact: true })).toBeVisible();
  await expect(dialog.locator(".card")).not.toHaveCount(0);
  await expect(dialog.locator(".card .meta", { hasText: / · war$/ })).toHaveCount(0);
});

test("supports a phone, Chinese, and scrubbing to sparse ancient data", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.addInitScript(() => localStorage.setItem("whw-locale", "zh"));
  await page.goto("/#y=1945");
  await page.getByRole("button", { name: "🌐 同一时代", exact: true }).click();
  const dialog = page.getByRole("dialog", { name: "同一时代，世界各地" });
  const slider = dialog.getByRole("slider", { name: "探索年份" });
  await slider.fill("0");
  await expect(slider).toHaveAttribute("aria-valuetext", "公元前3000年");
  await expect(dialog).toContainText("时间范围：公元前3000年 – 公元前2700年");
  await expect(dialog.getByRole("region", { name: "东亚与东南亚", exact: true })).toContainText(
    "这一时间范围内暂无符合筛选的精选事件。",
  );
  await expect(
    dialog.getByRole("region", { name: "非洲", exact: true }).locator(".card"),
  ).not.toHaveCount(0);
  expect(await dialog.evaluate((el) => el.scrollWidth <= el.clientWidth)).toBe(true);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});
