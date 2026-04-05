const {
  buildAlbumTitle,
  buildDistrokidTitle,
  buildGeneratedTitle,
  buildProfileTitle,
  analyzeFolder,
  buildUploadManifest,
} = require("./library-service");
const fs = require("node:fs/promises");
const os = require("node:os");
const path = require("node:path");

describe("library-service titles", () => {
  it("uses curated profile titles instead of adjective-core-suffix combinations", () => {
    expect(buildProfileTitle("healing-432", 0)).toBe("River of Calm");
    expect(buildProfileTitle("healing-432", 1)).toBe("Soft Alignment");
    expect(buildProfileTitle("chill-hop", 3)).toBe("Quiet Side Street");
  });

  it("cycles through curated titles deterministically", () => {
    expect(buildProfileTitle("ambient", 0)).toBe("Silver Air");
    expect(buildProfileTitle("ambient", 12)).toBe("Silver Air");
  });

  it("uses curated album titles for profiles", () => {
    expect(buildAlbumTitle("neural-biohacking")).toBe("Clear Work");
    expect(buildAlbumTitle("lofi")).toBe("Dust on the Tape");
  });

  it("still falls back to cleaned source names for unknown profiles", () => {
    expect(
      buildGeneratedTitle({
        baseName: "deep blue sleep session 432hz",
        folderName: "ambient takes",
        index: 0,
        profileKey: "unknown-profile",
      }),
    ).toBe("Deep Blue Sleep Session");
  });

  it("builds a distrokid title with the seo suffix while leaving filenames separate", () => {
    expect(buildDistrokidTitle("Clear Work", "528Hz Neural Flow Deep Work Music")).toBe(
      "Clear Work 528Hz Neural Flow Deep Work Music",
    );
    expect(buildDistrokidTitle("Clear Work", "")).toBe("Clear Work");
  });

  it("sorts already renamed wav files by leading track number", async () => {
    const folderPath = await fs.mkdtemp(path.join(os.tmpdir(), "music-uploader-sort-"));

    try {
      await Promise.all([
        fs.writeFile(path.join(folderPath, "02 Zero Distraction.wav"), ""),
        fs.writeFile(path.join(folderPath, "01 Clear Work.wav"), ""),
        fs.writeFile(path.join(folderPath, "11 Flow Without Noise.wav"), ""),
      ]);

      const analysis = await analyzeFolder(folderPath, "neural-biohacking");

      expect(analysis.files.map((file) => file.originalName)).toEqual([
        "01 Clear Work.wav",
        "02 Zero Distraction.wav",
        "11 Flow Without Noise.wav",
      ]);
    } finally {
      await fs.rm(folderPath, { recursive: true, force: true });
    }
  });

  it("stores the seo suffix in distrokid track titles without changing upload filenames", () => {
    const manifest = buildUploadManifest({
      folderPath: "D:/music/final",
      albumTitle: "Clear Work",
      seoSuffix: "528Hz Neural Flow Deep Work Music",
      profileKey: "neural-biohacking",
      files: [
        {
          originalName: "01 Clear Work.wav",
          generatedTitle: "Clear Work",
        },
      ],
    });

    expect(manifest.tracks[0].distrokidTitle).toBe("Clear Work 528Hz Neural Flow Deep Work Music");
    expect(manifest.tracks[0].uploadFileName).toBe("01 Clear Work.wav");
  });
});
