import { expect, test } from "@playwright/test";

test("loads the globe with the 1945 borders and warms the neighbouring snapshots", async ({ page }) => {
  const fetched: string[] = [];
  page.on("request", (r) => {
    const m = /\/data\/borders\/(world_\w+)\.geojson/.exec(r.url());
    if (m) fetched.push(m[1]!);
  });
  await page.goto("/");
  await expect(page.getByTestId("globe-stage").locator("canvas")).toBeVisible();
  await expect(page.locator(".era")).toContainText("borders of 1945");
  await expect.poll(() => fetched.sort()).toEqual(["world_1920", "world_1945", "world_1994"]);
});

test("scrubbing the timeline swaps the border snapshot", async ({ page }) => {
  await page.goto("/");
  await expect(page.locator(".era")).toContainText("borders of 1945");
  // The slider is 0–1000 on a non-linear scale; the far left is 3000 BC.
  await page.getByRole("slider", { name: "Year", exact: true }).fill("0");
  await expect(page.locator(".era")).toContainText("borders of 500 BC");
});

test("a story deep link opens the immersive view", async ({ page }) => {
  await page.goto("/#y=1453&e=fall-of-constantinople&s=1");
  await expect(page.getByRole("dialog", { name: /^Story: / })).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog", { name: /^Story: / })).toBeHidden();
});
