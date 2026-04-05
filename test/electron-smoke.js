const path = require("node:path");
const { _electron: electron } = require("playwright");

async function main() {
  const appPath = path.resolve(__dirname, "..");
  const electronApp = await electron.launch({
    args: [appPath],
    env: {
      ...process.env,
      MUSIC_UPLOADER_HEADLESS: "1",
    },
  });

  try {
    const page = await electronApp.firstWindow();

    await page.waitForLoadState("domcontentloaded");
    await page.waitForSelector("#status-text", { state: "attached" });
    await page.waitForFunction(() => globalThis.document.querySelectorAll("#genre-select option").length > 0);

    const title = await page.title();
    const status = await page.locator("#status-text").textContent();
    const folderMeta = await page.locator("#folder-meta").textContent();
    const previewDisabled = await page.locator("#preview-button").isDisabled();
    const applyDisabled = await page.locator("#apply-button").isDisabled();
    const optionCount = await page.locator("#genre-select option").count();

    if (title !== "Music Uploader") {
      throw new Error(`Unerwarteter Fenstertitel: ${title}`);
    }

    if (status !== "Warte auf Ordnerauswahl") {
      throw new Error(`Unerwarteter Status: ${status}`);
    }

    if (folderMeta !== "Noch kein Ordner geladen") {
      throw new Error(`Unerwartete Ordner-Meta: ${folderMeta}`);
    }

    if (!previewDisabled || !applyDisabled) {
      throw new Error("Initiale Buttons sind unerwartet aktiv.");
    }

    if (optionCount === 0) {
      throw new Error("Es wurden keine Profiloptionen geladen.");
    }

    console.log("Electron smoke test passed.");
  } finally {
    await electronApp.close();
  }
}

main().catch((error) => {
  console.error(error.message || error);
  process.exitCode = 1;
});
