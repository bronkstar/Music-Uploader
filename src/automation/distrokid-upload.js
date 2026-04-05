const fs = require("node:fs/promises");
const path = require("node:path");
const {
  closeActiveSession,
  continueSession,
  startSession,
} = require("./distrokid-service");

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

async function main() {
  const { manifestPath, manifest } = await readManifestFromArg();
  const session = await startSession(manifest);

  console.log(`Manifest geladen: ${manifestPath}`);
  console.log(`Chrome-Profil: ${session.profileDir}`);
  console.log("Logge dich manuell ein und navigiere zum DistroKid-Upload-Formular.");
  console.log("Druecke danach Enter in diesem Terminal, um mit der Track-Automation fortzufahren.");

  process.stdin.resume();
  await new Promise((resolve) => process.stdin.once("data", resolve));

  const result = await continueSession();

  console.log(`Track-Automation abgeschlossen fuer ${result.trackCount} Tracks.`);
  console.log("Finalen Submit bitte erst nach manueller Sichtpruefung ausloesen.");
}

main()
  .catch((error) => {
    console.error(error.message || error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await closeActiveSession();
  });
