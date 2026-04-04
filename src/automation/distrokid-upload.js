const fs = require("node:fs/promises");
const path = require("node:path");
const { chromium } = require("playwright");

async function readManifestFromArg() {
  const manifestPath = process.argv[2];

  if (!manifestPath) {
    throw new Error("Bitte Pfad zu upload-manifest.json angeben.");
  }

  const fullPath = path.resolve(process.cwd(), manifestPath);
  const raw = await fs.readFile(fullPath, "utf8");
  return {
    manifestPath: fullPath,
    manifest: JSON.parse(raw),
  };
}

async function clickRadioByText(container, text) {
  const radio = container.getByText(text, { exact: false }).locator("..").locator("input[type='radio']").first();
  await radio.check();
}

async function fillCreditsSection(trackSection, credits) {
  const appleCreditsToggle = trackSection.getByText("Füge jedem Song auf diesem Release Credits hinzu", { exact: false });
  if (await appleCreditsToggle.count()) {
    await appleCreditsToggle.click();
  }

  for (const credit of credits) {
    const roleSelect = trackSection.locator("select").filter({ hasText: /Rolle|Role/ }).last();
    if (await roleSelect.count()) {
      await roleSelect.selectOption({ label: credit.role }).catch(() => null);
    }

    const nameField = trackSection.locator("input").filter({ has: trackSection.locator("input") }).last();
    if (await nameField.count()) {
      await nameField.fill(credit.name).catch(() => null);
    }
  }
}

async function fillTrack(page, track) {
  const heading = page.getByText(`Track ${track.trackNumber}`, { exact: false }).first();
  const trackSection = heading.locator("xpath=ancestor::*[self::section or self::div][1]");

  const titleField = trackSection.getByLabel("Songtitel", { exact: false }).or(trackSection.locator("input[type='text']").first());
  await titleField.fill(track.title);

  await clickRadioByText(trackSection, "Nein, dies ist die normale Version");
  await clickRadioByText(trackSection, "Nein");
  await clickRadioByText(trackSection, "Dieser Song ist instrumental");

  const fileInput = trackSection.locator("input[type='file']").first();
  await fileInput.setInputFiles(track.uploadPath);

  await fillCreditsSection(trackSection, track.distrokid.credits);
}

async function assertNoExtrasAndZeroTotal(page) {
  const extrasSection = page.getByText("Extras", { exact: false }).first();
  const extrasRoot = extrasSection.locator("xpath=ancestor::*[self::section or self::div][1]");
  const checkboxes = extrasRoot.locator("input[type='checkbox']");
  const totalText = page.getByText("Gesamt:", { exact: false });

  const totalVisible = await totalText.count();
  if (!totalVisible) {
    throw new Error("Konnte Gesamtbetrag nicht finden.");
  }

  const totalLine = await totalText.first().locator("xpath=..").innerText();
  if (!totalLine.includes("0,00")) {
    throw new Error(`Gesamtbetrag ist nicht 0,00 EUR: ${totalLine}`);
  }

  const checkboxCount = await checkboxes.count();
  for (let index = 0; index < checkboxCount; index += 1) {
    const checked = await checkboxes.nth(index).isChecked().catch(() => false);
    if (checked) {
      throw new Error("Mindestens ein Extra ist aktiviert. Abbruch.");
    }
  }
}

async function main() {
  const { manifestPath, manifest } = await readManifestFromArg();
  const browser = await chromium.launch({ headless: false });
  const page = await browser.newPage();

  await page.goto("https://distrokid.com/", { waitUntil: "domcontentloaded" });

  console.log(`Manifest geladen: ${manifestPath}`);
  console.log("Logge dich ein und navigiere manuell zum DistroKid-Upload-Formular.");
  console.log("Druecke danach Enter in diesem Terminal, um mit der Track-Automation fortzufahren.");

  process.stdin.resume();
  await new Promise((resolve) => process.stdin.once("data", resolve));

  for (const track of manifest.tracks) {
    await fillTrack(page, track);
  }

  await assertNoExtrasAndZeroTotal(page);

  console.log("Track-Automation abgeschlossen.");
  console.log("Finalen Submit bitte erst nach manueller Sichtpruefung ausloesen.");
}

main().catch((error) => {
  console.error(error.message || error);
  process.exitCode = 1;
});
