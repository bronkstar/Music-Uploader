const fs = require("node:fs/promises");
const path = require("node:path");
const { chromium } = require("playwright");
const { DISTROKID_UPLOAD_PROFILE } = require("../shared/distrokid-profile");

const DEFAULT_DISTROKID_URL = "https://distrokid.com/";
const DEFAULT_CHROME_PROFILE_DIR = path.resolve(
  process.cwd(),
  ".codex-temp/distrokid-chrome-profile",
);

let activeSession = null;

function isSessionUsable(session) {
  if (!session || !session.context || !session.page) {
    return false;
  }

  if (session.page.isClosed()) {
    return false;
  }

  return true;
}

function clearActiveSession() {
  activeSession = null;
}

async function getFirstMatchingLocator(candidates) {
  for (const candidate of candidates) {
    if (await candidate.count()) {
      return candidate.first();
    }
  }

  return null;
}

async function clickRadioByText(container, texts) {
  const variants = Array.isArray(texts) ? texts : [texts];

  for (const text of variants) {
    const radio = container
      .getByText(text, { exact: false })
      .locator("..")
      .locator("input[type='radio']")
      .first();

    if (await radio.count()) {
      await radio.check();
      return;
    }
  }

  throw new Error(`Konnte keine passende Radio-Option finden: ${variants.join(" | ")}`);
}

async function resolveQuestionBlock(container, prompts) {
  const promptVariants = Array.isArray(prompts) ? prompts : [prompts];

  for (const prompt of promptVariants) {
    const promptNode = container.getByText(prompt, { exact: false }).first();
    if (await promptNode.count()) {
      const block = promptNode.locator(
        "xpath=ancestor::*[self::section or self::div][.//input[@type='radio']][1]",
      );
      if (await block.count()) {
        return block.first();
      }
    }
  }

  return null;
}

async function clickRadioInQuestionBlock(container, prompts, optionTexts) {
  const block = await resolveQuestionBlock(container, prompts);
  if (!block) {
    throw new Error(`Konnte den Fragenblock nicht finden: ${[].concat(prompts).join(" | ")}`);
  }

  await clickRadioByText(block, optionTexts);
}

async function clickCheckboxByText(container, texts) {
  const variants = Array.isArray(texts) ? texts : [texts];

  for (const text of variants) {
    const checkbox = container
      .getByText(text, { exact: false })
      .locator("..")
      .locator("input[type='checkbox']")
      .first();

    if (await checkbox.count()) {
      await checkbox.check().catch(() => null);
      return true;
    }
  }

  return false;
}

async function resolveTrackSection(page, trackNumber) {
  const heading = await getFirstMatchingLocator([
    page.getByText(`Track ${trackNumber}`, { exact: false }),
    page.getByText(`Song ${trackNumber}`, { exact: false }),
    page.getByText(`Titel ${trackNumber}`, { exact: false }),
  ]);

  if (heading) {
    const richSection = heading.locator(
      "xpath=ancestor::*[self::section or self::div][.//input[@type='file'] and (.//input[@type='text'] or .//textarea or .//input[not(@type)])][1]",
    );
    if (await richSection.count()) {
      return richSection.first();
    }

    const fileBackedSection = heading.locator(
      "xpath=ancestor::*[self::section or self::div][.//input[@type='file']][1]",
    );
    if (await fileBackedSection.count()) {
      return fileBackedSection.first();
    }
  }

  const indexedFileInput = await resolveIndexedFileInput(page, trackNumber);
  if (indexedFileInput) {
    const richSection = indexedFileInput.locator(
      "xpath=ancestor::*[self::section or self::div][.//input[@type='text'] or .//textarea or .//input[not(@type)]][1]",
    );
    if (await richSection.count()) {
      return richSection.first();
    }

    return indexedFileInput.locator("xpath=ancestor::*[self::section or self::div][1]");
  }

  const fileInputs = page.locator("input[type='file']");
  if ((await fileInputs.count()) >= trackNumber) {
    return fileInputs.nth(trackNumber - 1).locator("xpath=ancestor::*[self::section or self::div][1]");
  }

  throw new Error(
    `Konnte fuer Track ${trackNumber} keinen Upload-Bereich finden. Bist du sicher auf dem DistroKid-Upload-Formular?`,
  );
}

async function resolveTitleField(trackSection) {
  const field = await getFirstMatchingLocator([
    trackSection.locator("input[type='text']:not([readonly]):not([disabled])"),
    trackSection.locator("input:not([type])"),
    trackSection.locator("textarea:not([readonly]):not([disabled])"),
    trackSection.locator("input[name*='title' i]"),
    trackSection.locator("input[placeholder*='title' i]"),
    trackSection.locator("input[placeholder*='titel' i]"),
  ]);

  if (!field) {
    throw new Error(
      "Konnte das Track-Titelfeld nicht finden. Bitte pruefe, ob du auf der echten DistroKid-Upload-Seite bist.",
    );
  }

  return field;
}

async function resolveIndexedFileInput(page, trackNumber) {
  const fileInputs = page.locator("input[type='file']");
  if ((await fileInputs.count()) >= trackNumber) {
    return fileInputs.nth(trackNumber - 1);
  }

  return null;
}

async function resolveAppleCreditsSection(page) {
  const sectionHeader = await getFirstMatchingLocator([
    page.getByText("Zusätzliche Anforderungen", { exact: false }),
    page.getByText("Apple Music benötigt mindestens einen Interpreten-", { exact: false }),
  ]);

  if (!sectionHeader) {
    return null;
  }

  const section = sectionHeader.locator(
    "xpath=ancestor::*[self::section or self::div][.//select and .//input][1]",
  );
  if (await section.count()) {
    return section.first();
  }

  return null;
}

async function resolveAppleTrackBlock(appleSection, trackTitle) {
  const heading = await getFirstMatchingLocator([
    appleSection.getByText(trackTitle, { exact: true }),
    appleSection.getByText(trackTitle, { exact: false }),
  ]);

  if (!heading) {
    throw new Error(`Konnte den Apple-Credits-Block fuer "${trackTitle}" nicht finden.`);
  }

  const trackBlock = heading.locator(
    "xpath=ancestor::*[self::section or self::div][.//select and .//input][1]",
  );

  if (!(await trackBlock.count())) {
    throw new Error(`Konnte keinen editierbaren Apple-Credits-Bereich fuer "${trackTitle}" finden.`);
  }

  return trackBlock.first();
}

async function fillAppleCreditRoleAndName(container, roleLabel, name) {
  const selects = container.locator("select");
  const textInputs = container.locator("input[type='text'], input:not([type])");

  if (!(await selects.count()) || !(await textInputs.count())) {
    throw new Error(`Apple-Credit-Felder fuer Rolle "${roleLabel}" sind unvollstaendig.`);
  }

  await selects.first().selectOption({ label: roleLabel }).catch(async () => {
    await selects.first().selectOption({ value: roleLabel }).catch(() => null);
  });
  await textInputs.first().fill(name);
}

async function fillAppleCredits(page, manifest) {
  const appleSection = await resolveAppleCreditsSection(page);
  if (!appleSection) {
    return;
  }

  const firstTrack = manifest.tracks[0];
  if (!firstTrack || !firstTrack.distrokid?.credits?.length) {
    return;
  }

  const firstTrackBlock = await resolveAppleTrackBlock(appleSection, firstTrack.title);
  const artistSection = await getFirstMatchingLocator([
    firstTrackBlock.getByText("Künstler*in", { exact: false }).locator(
      "xpath=ancestor::*[self::section or self::div][.//select and .//input][1]",
    ),
  ]);
  const producerSection = await getFirstMatchingLocator([
    firstTrackBlock.getByText("Produzent*in", { exact: false }).locator(
      "xpath=ancestor::*[self::section or self::div][.//select and .//input][1]",
    ),
  ]);

  if (!artistSection || !producerSection) {
    throw new Error("Konnte die Apple-Credits-Bereiche fuer Künstler*in oder Produzent*in nicht finden.");
  }

  const [artistCredit, producerCredit] = firstTrack.distrokid.credits;
  if (artistCredit) {
    await fillAppleCreditRoleAndName(artistSection, artistCredit.role, artistCredit.name);
    await clickCheckboxByText(artistSection, [
      "Diese*n Interpret*in für alle Tracks des Albums übernehmen",
      "Diese*n Interpret*in fuer alle Tracks des Albums uebernehmen",
    ]);
  }

  if (producerCredit) {
    await fillAppleCreditRoleAndName(producerSection, producerCredit.role, producerCredit.name);
    await clickCheckboxByText(producerSection, [
      "Diese*n Produzent*in für alle Tracks des Albums übernehmen",
      "Diese*n Produzent*in fuer alle Tracks des Albums uebernehmen",
    ]);
  }
}

async function resolveSongwriterBlock(trackSection) {
  const heading = await getFirstMatchingLocator([
    trackSection.getByText("Songwriter*in / Coversong", { exact: false }),
    trackSection.getByText("Songwriter / Coversong", { exact: false }),
  ]);

  if (!heading) {
    throw new Error("Konnte den Songwriter-Block im Track nicht finden.");
  }

  const block = heading.locator(
    "xpath=ancestor::*[self::section or self::div][.//input and .//text()[contains(., 'Vorname') or contains(., 'First name')]][1]",
  );

  if (!(await block.count())) {
    throw new Error("Konnte keinen editierbaren Songwriter-Bereich finden.");
  }

  return block.first();
}

async function fillSongwriterInTrack(trackSection, songwriter) {
  const songwriterBlock = await resolveSongwriterBlock(trackSection);

  await clickRadioByText(songwriterBlock, [
    "Ich habe diesen Song selbst geschrieben",
    "Ich habe diesen Song selbst geschrieben, oder ich manage den*die Songwriter*in",
    "I wrote this song myself",
  ]);

  const firstNameInput = await getFirstMatchingLocator([
    songwriterBlock.locator("input[placeholder*='Vorname' i]"),
    songwriterBlock.locator("input[name*='first' i]"),
    songwriterBlock.locator("input").nth(0),
  ]);
  const lastNameInput = await getFirstMatchingLocator([
    songwriterBlock.locator("input[placeholder*='Nachname' i]"),
    songwriterBlock.locator("input[name*='last' i]"),
    songwriterBlock.locator("input").nth(2),
    songwriterBlock.locator("input").nth(1),
  ]);

  if (!firstNameInput || !lastNameInput) {
    throw new Error("Konnte Vorname/Nachname im Songwriter-Bereich nicht finden.");
  }

  await firstNameInput.fill(songwriter.firstName);
  await lastNameInput.fill(songwriter.lastName);
}

async function fillSongwriterForAllTracks(page, manifest) {
  const songwriter = DISTROKID_UPLOAD_PROFILE.songwriter;

  if (!songwriter || !manifest.tracks.length) {
    return;
  }

  for (const track of manifest.tracks) {
    const trackSection = await resolveTrackSection(page, track.trackNumber);
    await fillSongwriterInTrack(trackSection, songwriter);
  }
}

async function fillTrack(page, track) {
  const trackSection = await resolveTrackSection(page, track.trackNumber);
  const titleField = await resolveTitleField(trackSection);
  await titleField.fill(track.distrokidTitle || track.title);

  const fileInput = await getFirstMatchingLocator([trackSection.locator("input[type='file']")]);

  if (!fileInput) {
    throw new Error(`Konnte das Datei-Upload-Feld fuer Track ${track.trackNumber} nicht finden.`);
  }

  await fileInput.setInputFiles(track.uploadPath);

  await clickRadioInQuestionBlock(
    trackSection,
    [
      "Instrumental?",
      "Is it instrumental?",
    ],
    [
      "Dieser Song ist instrumental und enthält keinen Songtext",
      "Dieser Song ist instrumental",
      "This song is instrumental",
      "Instrumental",
    ],
  );
}

async function launchChromeContext() {
  const profileDir = process.env.MUSIC_UPLOADER_CHROME_PROFILE_DIR || DEFAULT_CHROME_PROFILE_DIR;

  await fs.mkdir(profileDir, { recursive: true });

  return chromium.launchPersistentContext(profileDir, {
    channel: "chrome",
    headless: false,
  });
}

async function getActivePage(context) {
  const existingPage = context.pages()[0];
  if (existingPage) {
    return existingPage;
  }

  return context.newPage();
}

async function closeActiveSession() {
  if (!activeSession) {
    return;
  }

  const sessionToClose = activeSession;
  clearActiveSession();
  await sessionToClose.context.close().catch(() => null);
}

async function startSession(manifest) {
  await closeActiveSession();

  const context = await launchChromeContext();
  const page = await getActivePage(context);

  await page.goto(DEFAULT_DISTROKID_URL, { waitUntil: "domcontentloaded" });

  activeSession = {
    context,
    page,
    manifest,
    startedAt: new Date().toISOString(),
  };

  context.on("close", () => {
    if (activeSession?.context === context) {
      clearActiveSession();
    }
  });

  return {
    ok: true,
    profileDir: process.env.MUSIC_UPLOADER_CHROME_PROFILE_DIR || DEFAULT_CHROME_PROFILE_DIR,
    distrokidUrl: DEFAULT_DISTROKID_URL,
    trackCount: manifest.trackCount,
  };
}

async function continueSession() {
  if (!isSessionUsable(activeSession)) {
    clearActiveSession();
    throw new Error("Keine aktive DistroKid-Sitzung. Bitte zuerst Chrome aus der App heraus starten.");
  }

  const { page, manifest } = activeSession;
  try {
    for (const track of manifest.tracks) {
      await fillTrack(page, track);
    }

    await fillSongwriterForAllTracks(page, manifest);
    await fillAppleCredits(page, manifest);
  } catch (error) {
    if (page.isClosed()) {
      clearActiveSession();
      throw new Error(
        "Die DistroKid-Chrome-Sitzung wurde geschlossen. Bitte in der App erneut 'DistroKid in Chrome' klicken.",
        { cause: error },
      );
    }

    throw error;
  }

  return {
    ok: true,
    trackCount: manifest.trackCount,
  };
}

function getSessionStatus() {
  return {
    active: isSessionUsable(activeSession),
    startedAt: activeSession?.startedAt || null,
    trackCount: activeSession?.manifest?.trackCount || 0,
  };
}

module.exports = {
  closeActiveSession,
  continueSession,
  getSessionStatus,
  startSession,
};
