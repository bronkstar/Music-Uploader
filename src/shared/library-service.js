const fs = require("node:fs/promises");
const path = require("node:path");
const { DISTROKID_UPLOAD_PROFILE } = require("./distrokid-profile");
const { MUSIC_PROFILES } = require("./music-profiles");

const MAX_TRACK_TITLE_LENGTH = 80;
const MAX_ALBUM_TITLE_LENGTH = 90;

function normalizeBaseName(fileName) {
  return path.basename(fileName, path.extname(fileName)).replace(/\s+\(\d+\)$/, "").trim();
}

function sortBySequence(a, b) {
  const aMatch = a.originalName.match(/\((\d+)\)\.wav$/i);
  const bMatch = b.originalName.match(/\((\d+)\)\.wav$/i);
  const aIndex = aMatch ? Number(aMatch[1]) : 0;
  const bIndex = bMatch ? Number(bMatch[1]) : 0;
  return aIndex - bIndex;
}

function titleCase(value) {
  return value
    .split(/[\s_-]+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())
    .join(" ");
}

function clampText(value, maxLength) {
  const normalized = String(value || "").replace(/\s+/g, " ").trim();

  if (normalized.length <= maxLength) {
    return normalized;
  }

  const sliced = normalized.slice(0, maxLength);
  const lastSpace = sliced.lastIndexOf(" ");
  return (lastSpace > 20 ? sliced.slice(0, lastSpace) : sliced).trim();
}

function sanitizeTitleSeed(value) {
  return value
    .replace(/\b\d+\s*-\s*\d+\s*bpm\b/gi, "")
    .replace(/\b[a-g][#-]?(major|minor)\b/gi, "")
    .replace(/\b\d+\s*hz\b/gi, "")
    .replace(/\s{2,}/g, " ")
    .replace(/\s+-\s+/g, " ")
    .trim();
}

function buildProfileTitle(profileKey, index) {
  const profile = MUSIC_PROFILES[profileKey];

  if (!profile || !profile.titleParts) {
    return "";
  }

  const { prefixes, cores, suffixes } = profile.titleParts;
  const prefix = prefixes[index % prefixes.length];
  const core = cores[Math.floor(index / prefixes.length) % cores.length];
  const suffix = suffixes[Math.floor(index / (prefixes.length * cores.length)) % suffixes.length];

  return clampText(`${prefix} ${core} ${suffix}`.replace(/\s+/g, " ").trim(), MAX_TRACK_TITLE_LENGTH);
}

function buildAlbumTitle(profileKey) {
  const profile = MUSIC_PROFILES[profileKey];

  if (!profile || !profile.albumTitleParts) {
    return "Untitled Album";
  }

  const { prefixes, cores, suffixes } = profile.albumTitleParts;
  return clampText(`${prefixes[0]} ${cores[0]} ${suffixes[0]}`.replace(/\s+/g, " ").trim(), MAX_ALBUM_TITLE_LENGTH);
}

function buildGeneratedTitle({ baseName, folderName, index, profileKey }) {
  const profiledTitle = buildProfileTitle(profileKey, index);
  if (profiledTitle) {
    return profiledTitle;
  }

  const source = sanitizeTitleSeed(baseName) || sanitizeTitleSeed(folderName) || "Untitled Session";
  const parts = source.split(/\s+/).filter(Boolean);

  const prefix = parts.slice(0, 2).join(" ");
  const suffix = parts.slice(2).join(" ");

  if (!suffix) {
    return clampText(`${titleCase(prefix)} ${index + 1}`.trim(), MAX_TRACK_TITLE_LENGTH);
  }

  return clampText(`${titleCase(prefix)} ${titleCase(suffix)}`.trim(), MAX_TRACK_TITLE_LENGTH);
}

async function analyzeFolder(folderPath, profileKey = "chill-hop") {
  const entries = await fs.readdir(folderPath, { withFileTypes: true });
  const folderName = path.basename(folderPath);
  const wavFiles = entries
    .filter((entry) => entry.isFile() && path.extname(entry.name).toLowerCase() === ".wav")
    .map((entry) => ({
      id: entry.name,
      originalName: entry.name,
      fullPath: path.join(folderPath, entry.name),
      baseName: normalizeBaseName(entry.name),
      generatedTitle: "",
    }))
    .sort(sortBySequence)
    .map((file, index) => ({
      ...file,
      generatedTitle: buildGeneratedTitle({
        baseName: file.baseName,
        folderName,
        index,
        profileKey,
      }),
    }));

  const uniqueBases = [...new Set(wavFiles.map((file) => file.baseName))];

  return {
    folderName,
    folderPath,
    albumTitle: buildAlbumTitle(profileKey),
    fileCount: wavFiles.length,
    basePatterns: uniqueBases,
    files: wavFiles,
    profileKey,
  };
}

function buildFinalName(title, _seoSuffix, index) {
  const trimmedTitle = clampText(title, MAX_TRACK_TITLE_LENGTH);
  const numbered = `${String(index + 1).padStart(2, "0")} ${trimmedTitle}`;
  return `${numbered}.wav`;
}

function validatePlan(plan) {
  const names = new Set();

  for (const item of plan.items) {
    if (!item.targetName || item.targetName === ".wav") {
      throw new Error(`Fehlender Zieldateiname fuer ${item.originalName}`);
    }

    if (names.has(item.targetName.toLowerCase())) {
      throw new Error(`Doppelter Zieldateiname: ${item.targetName}`);
    }

    names.add(item.targetName.toLowerCase());
  }
}

function buildRenamePlan(payload) {
  const { folderPath, files, seoSuffix } = payload;

  const items = files.map((file, index) => {
    const targetName = buildFinalName(file.generatedTitle, seoSuffix, index);
    return {
      originalName: file.originalName,
      originalPath: path.join(folderPath, file.originalName),
      targetName,
      targetPath: path.join(folderPath, targetName),
      changed: file.originalName !== targetName,
    };
  });

  const plan = {
    folderPath,
    seoSuffix,
    itemCount: items.length,
    changedCount: items.filter((item) => item.changed).length,
    items,
  };

  validatePlan(plan);
  return plan;
}

async function applyRenamePlan(payload) {
  const plan = buildRenamePlan(payload);
  const tempMoves = [];

  for (const item of plan.items) {
    if (!item.changed) {
      continue;
    }

    const tempPath = `${item.originalPath}.tmp-music-uploader`;
    await fs.rename(item.originalPath, tempPath);
    tempMoves.push({ tempPath, finalPath: item.targetPath });
  }

  for (const move of tempMoves) {
    await fs.rename(move.tempPath, move.finalPath);
  }

  return plan;
}

function buildUploadManifest(payload) {
  const { folderPath, files, seoSuffix, albumTitle } = payload;
  const renamePlan = buildRenamePlan(payload);
  const trackCount = files.length;

  return {
    createdAt: new Date().toISOString(),
    folderPath,
    albumTitle,
    seoSuffix,
    trackCount,
    rules: DISTROKID_UPLOAD_PROFILE.fixedRules,
    credits: DISTROKID_UPLOAD_PROFILE.credits,
    tracks: renamePlan.items.map((item, index) => ({
      trackNumber: index + 1,
      title: files[index].generatedTitle,
      sourceFileName: item.originalName,
      uploadFileName: item.targetName,
      sourcePath: item.originalPath,
      uploadPath: item.targetPath,
      distrokid: {
        instrumental: true,
        addAppleMusicCredits: true,
        credits: DISTROKID_UPLOAD_PROFILE.credits,
      },
    })),
    guards: {
      extrasMustRemainUnchecked: true,
      totalMustEqual: "0,00 EUR",
    },
  };
}

async function writeUploadManifest(payload) {
  const manifest = buildUploadManifest(payload);
  const targetPath = path.join(payload.folderPath, "upload-manifest.json");
  await fs.writeFile(targetPath, JSON.stringify(manifest, null, 2), "utf8");
  return {
    manifestPath: targetPath,
    manifest,
  };
}

module.exports = {
  MUSIC_PROFILES,
  MAX_TRACK_TITLE_LENGTH,
  MAX_ALBUM_TITLE_LENGTH,
  analyzeFolder,
  buildRenamePlan,
  applyRenamePlan,
  buildUploadManifest,
  writeUploadManifest,
};
