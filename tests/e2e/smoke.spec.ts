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
  await expect.poll(() => fetched.sort(), { timeout: 15_000 }).toEqual(["world_1920", "world_1945", "world_1994"]);
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
  await page.getByRole("button", { name: /Stories/ }).first().click();
  await expect(page.getByRole("dialog", { name: "Immersive stories" })).toBeVisible();
  await page.keyboard.press("ArrowRight");
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog", { name: "Immersive stories" })).toBeHidden();
  await expect(page.locator(".panel h2")).toHaveText("The fall of Constantinople");
});
