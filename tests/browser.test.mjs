import assert from "node:assert/strict";
import { readdir, mkdir } from "node:fs/promises";
import { join, relative } from "node:path";
import { fileURLToPath } from "node:url";
import puppeteer from "puppeteer-core";
import { startServer } from "./serve.mjs";

const docsRoot = fileURLToPath(new URL("../docs/", import.meta.url));
const artifacts = "/opt/cursor/artifacts";

async function filesUnder(dir) {
  const found = [];
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) found.push(...await filesUnder(path));
    else found.push(path);
  }
  return found;
}

async function assertNoOverflow(page, label) {
  const box = await page.evaluate(() => ({
    scrollWidth: document.documentElement.scrollWidth,
    clientWidth: document.documentElement.clientWidth,
  }));
  assert.ok(
    box.scrollWidth <= box.clientWidth + 1,
    `${label} overflows horizontally (${box.scrollWidth} > ${box.clientWidth})`,
  );
}

async function waitForAssets(page) {
  await page.waitForFunction(() => document.fonts.ready.then(() => true));
  await page.waitForFunction(() => [...document.images].every((img) => img.complete && img.naturalWidth > 0));
}

const { server, port } = await startServer(0);
const base = `http://127.0.0.1:${port}`;
const failures = [];

try {
  const files = await filesUnder(docsRoot);
  assert.ok(files.length > 10, "docs should contain the built game");
  for (const file of files) {
    const urlPath = `/${relative(docsRoot, file).split("\\").join("/")}`;
    const response = await fetch(base + urlPath);
    if (response.status !== 200) failures.push(`${response.status} ${urlPath}`);
  }
  assert.deepEqual(failures, [], `asset status\n${failures.join("\n")}`);

  const browser = await puppeteer.launch({
    executablePath: "/usr/bin/google-chrome",
    headless: true,
    args: ["--no-sandbox", "--disable-dev-shm-usage", "--font-render-hinting=none"],
  });
  try {
    const page = await browser.newPage();
    const consoleErrors = [];
    const external = [];
    const badStatus = [];
    page.on("pageerror", (error) => consoleErrors.push(String(error)));
    page.on("console", (message) => {
      if (message.type() === "error") consoleErrors.push(message.text());
    });
    page.on("request", (request) => {
      const host = new URL(request.url()).hostname;
      if (host !== "127.0.0.1" && host !== "localhost") external.push(request.url());
    });
    page.on("response", (response) => {
      if (response.status() >= 400) badStatus.push(`${response.status()} ${response.url()}`);
    });

    await page.setViewport({ width: 1440, height: 900, deviceScaleFactor: 1 });
    await page.goto(`${base}/?test=1`, { waitUntil: "networkidle0" });
    await waitForAssets(page);
    await page.click("#enter");
    await page.waitForSelector("#game:not([hidden])");
    await assertNoOverflow(page, "desktop game");

    const opening = await page.$eval("#balance", (node) => node.textContent);
    assert.equal(opening, "1,000.00");

    await page.click("#force-crown");
    await page.waitForFunction(() => document.body.dataset.spin === "spinning");
    const mid = await page.$eval("#balance", (node) => ({ text: node.textContent, cents: node.dataset.cents }));
    assert.equal(mid.cents, "99900");
    assert.equal(mid.text, "999.00");

    await page.waitForFunction(() => document.body.dataset.spin === "done", { timeout: 8000 });
    const landed = await page.$eval("#balance", (node) => ({ text: node.textContent, cents: node.dataset.cents }));
    assert.equal(landed.cents, "199900");
    assert.equal(landed.text, "1,999.00");
    const log = await page.evaluate(() => window.__kc.balanceLog);
    assert.deepEqual(log.slice(0, 3), [100000, 99900, 199900]);
    const bigVisible = await page.$eval("#bigwin", (node) => !node.hidden);
    assert.equal(bigVisible, true);
    const bigText = await page.$eval("#big-amount", (node) => node.textContent);
    assert.equal(bigText, "1,000.00");

    await page.click("#collect");
    const before = Number(await page.$eval("#balance", (node) => node.dataset.cents));
    await page.click("#spin");
    await page.waitForFunction(() => document.body.dataset.spin === "spinning");
    const charged = Number(await page.$eval("#balance", (node) => node.dataset.cents));
    assert.equal(charged, before - 100);
    await page.waitForFunction(() => document.body.dataset.spin === "done", { timeout: 8000 });
    const after = Number(await page.$eval("#balance", (node) => node.dataset.cents));
    const win = Number(await page.$eval("#win", (node) => node.dataset.cents));
    assert.equal(after, charged + win);

    await page.setViewport({ width: 390, height: 844, deviceScaleFactor: 1 });
    await assertNoOverflow(page, "mobile portrait");
    await page.setViewport({ width: 844, height: 390, deviceScaleFactor: 1 });
    await assertNoOverflow(page, "mobile landscape");

    assert.deepEqual(consoleErrors, [], `console errors\n${consoleErrors.join("\n")}`);
    assert.deepEqual(badStatus, [], `failed responses\n${badStatus.join("\n")}`);
    assert.deepEqual(external, [], `external requests\n${external.join("\n")}`);

    await mkdir(artifacts, { recursive: true });
    await shoot(browser, base, artifacts);
  } finally {
    await browser.close();
  }
} finally {
  await new Promise((resolve) => server.close(resolve));
}

async function shoot(browser, base, dir) {
  const page = await browser.newPage();

  await page.setViewport({ width: 1440, height: 900, deviceScaleFactor: 1 });
  await page.goto(base, { waitUntil: "networkidle0" });
  await waitForAssets(page);
  await page.click("#enter");
  await page.waitForSelector("#game:not([hidden])");
  await page.screenshot({ path: join(dir, "desktop_base_game.png") });
  await page.click("#open-paytable");
  await page.waitForSelector("#paytable:not([hidden])");
  await page.screenshot({ path: join(dir, "desktop_paytable.png") });

  await page.goto(`${base}/?test=1`, { waitUntil: "networkidle0" });
  await page.click("#enter");
  await page.waitForSelector("#game:not([hidden])");
  await page.click("#force-crown");
  await page.waitForSelector("#bigwin:not([hidden])", { timeout: 8000 });
  await page.evaluate(() => { document.querySelector("#test-panel").hidden = true; });
  await page.screenshot({ path: join(dir, "desktop_crown_big_win.png") });

  await page.setViewport({ width: 390, height: 844, deviceScaleFactor: 1 });
  await page.goto(base, { waitUntil: "networkidle0" });
  await waitForAssets(page);
  await page.click("#enter");
  await page.waitForSelector("#game:not([hidden])");
  await page.screenshot({ path: join(dir, "mobile_base_game.png") });
  await page.click("#open-paytable");
  await page.waitForSelector("#paytable:not([hidden])");
  await page.screenshot({ path: join(dir, "mobile_paytable.png") });

  await page.goto(`${base}/?test=1`, { waitUntil: "networkidle0" });
  await page.click("#enter");
  await page.click("#force-crown");
  await page.waitForSelector("#bigwin:not([hidden])", { timeout: 8000 });
  await page.evaluate(() => { document.querySelector("#test-panel").hidden = true; });
  await page.screenshot({ path: join(dir, "mobile_crown_big_win.png") });
  await page.close();
}

console.log("browser test passed");
