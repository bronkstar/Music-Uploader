const { JSDOM } = require("jsdom");
const { createApp } = require("./controller");

function buildHtml({ includeAlbumTitleMeta = true } = {}) {
  return `
    <!doctype html>
    <html>
      <body>
        <select id="genre-select"></select>
        <textarea id="seo-suffix"></textarea>
        <input id="folder-name" />
        <p id="folder-meta"></p>
        <input id="album-title" />
        <button id="regenerate-album-title-button"></button>
        ${includeAlbumTitleMeta ? '<p id="album-title-meta"></p>' : ""}
        <p id="status-text"></p>
        <div id="tracks-container"></div>
        <div id="preview-container"></div>
        <div id="upload-container"></div>
        <button id="pick-folder-button"></button>
        <button id="preview-button" disabled></button>
        <button id="apply-button" disabled></button>
        <button id="upload-preview-button" disabled></button>
        <button id="manifest-button" disabled></button>
        <button id="distrokid-open-button" disabled></button>
        <button id="distrokid-run-button" disabled></button>
        <template id="track-row-template">
          <div class="track-row">
            <p class="track-original"></p>
            <p class="track-path"></p>
            <input class="track-title-input" />
          </div>
        </template>
        <template id="preview-row-template">
          <div class="preview-row">
            <p class="preview-source"></p>
            <p class="preview-target"></p>
          </div>
        </template>
        <template id="upload-row-template">
          <div class="upload-row">
            <p class="preview-source"></p>
            <p class="upload-sub"></p>
            <p class="preview-target"></p>
            <p class="upload-sub"></p>
          </div>
        </template>
      </body>
    </html>
  `;
}

function createMusicUploaderMock() {
  return {
    listProfiles: vi.fn().mockResolvedValue({
      profiles: {
        "chill-hop": {
          label: "Chill Hop",
          seoSuffix: "Suffix",
        },
        "neural-biohacking": {
          label: "Neural Biohacking / Deep Work",
          seoSuffix: "Neural Suffix",
        },
      },
      limits: {
        trackTitle: 80,
        albumTitle: 90,
      },
    }),
    readConfig: vi.fn().mockResolvedValue({}),
    writeConfig: vi.fn().mockResolvedValue({ ok: true }),
    pickFolder: vi.fn().mockResolvedValue({
      folderPath: "D:/music/session",
      analysis: {
        albumTitle: "Healing Album",
        fileCount: 1,
        files: [
          {
            originalName: "01 Test.wav",
            baseName: "Test",
            generatedTitle: "Generated Track",
          },
        ],
        profileKey: "chill-hop",
      },
    }),
    loadFolder: vi.fn(),
    previewRenames: vi.fn().mockResolvedValue({
      changedCount: 1,
      items: [],
    }),
    applyRenames: vi.fn(),
    previewUpload: vi.fn(),
    writeUploadManifest: vi.fn(),
    startDistrokidSession: vi.fn(),
    continueDistrokidSession: vi.fn(),
    getDistrokidSessionStatus: vi.fn().mockResolvedValue({ active: false }),
  };
}

describe("createApp", () => {
  it("loads a folder even when album-title-meta is missing", async () => {
    const dom = new JSDOM(buildHtml({ includeAlbumTitleMeta: false }));
    const musicUploader = createMusicUploaderMock();
    const logger = { error: vi.fn() };
    const app = createApp({
      document: dom.window.document,
      musicUploader,
      logger,
    });

    await app.init();
    await app.actions.handlePickFolder();

    expect(dom.window.document.getElementById("folder-name").value).toBe("D:/music/session");
    expect(dom.window.document.getElementById("status-text").textContent).toBe("Ordner geladen");
    expect(dom.window.document.querySelectorAll(".track-row")).toHaveLength(1);
    expect(logger.error).not.toHaveBeenCalled();
  });

  it("uses the currently selected profile when picking a folder", async () => {
    const dom = new JSDOM(buildHtml());
    const musicUploader = createMusicUploaderMock();
    const logger = { error: vi.fn() };
    musicUploader.readConfig.mockResolvedValue({ genre: "neural-biohacking" });
    musicUploader.pickFolder.mockResolvedValue({
      folderPath: "D:/music/neural",
      analysis: {
        albumTitle: "Clear Work",
        fileCount: 1,
        files: [
          {
            originalName: "01 Test.wav",
            baseName: "Test",
            generatedTitle: "Clear Work",
          },
        ],
        profileKey: "neural-biohacking",
      },
    });

    const app = createApp({
      document: dom.window.document,
      musicUploader,
      logger,
    });

    await app.init();
    await app.actions.handlePickFolder();

    expect(musicUploader.pickFolder).toHaveBeenCalledWith({
      profileKey: "neural-biohacking",
    });
    expect(dom.window.document.getElementById("genre-select").value).toBe("neural-biohacking");
    expect(dom.window.document.getElementById("seo-suffix").value).toBe("Neural Suffix");
    expect(dom.window.document.querySelector(".track-title-input").value).toBe("Clear Work");
  });

  it("regenerates the album title from the current profile list", async () => {
    const dom = new JSDOM(buildHtml());
    const musicUploader = createMusicUploaderMock();
    const logger = { error: vi.fn() };
    musicUploader.listProfiles.mockResolvedValue({
      profiles: {
        "chill-hop": {
          label: "Chill Hop",
          seoSuffix: "Suffix",
          albumTitles: ["After Hours Notebook", "Soft Focus Sessions", "Night Window Studies"],
        },
      },
      limits: {
        trackTitle: 80,
        albumTitle: 90,
      },
    });

    const app = createApp({
      document: dom.window.document,
      musicUploader,
      logger,
    });

    await app.init();
    app.state.selectedProfile = "chill-hop";
    dom.window.document.getElementById("genre-select").value = "chill-hop";
    dom.window.document.getElementById("album-title").value = "After Hours Notebook";
    app.state.albumTitleCursor = 0;

    dom.window.document.getElementById("regenerate-album-title-button").click();

    expect(dom.window.document.getElementById("album-title").value).toBe("Soft Focus Sessions");
  });

  it("writes the failure into the status when folder loading crashes", async () => {
    const dom = new JSDOM(buildHtml());
    const musicUploader = createMusicUploaderMock();
    const logger = { error: vi.fn() };
    musicUploader.pickFolder.mockRejectedValue(new Error("kaputt"));

    const app = createApp({
      document: dom.window.document,
      musicUploader,
      logger,
    });

    await app.init();
    dom.window.document.getElementById("pick-folder-button").click();
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(dom.window.document.getElementById("status-text").textContent)
      .toBe("Ordnerladen fehlgeschlagen: kaputt");
    expect(logger.error).toHaveBeenCalledTimes(1);
  });

  it("allows upload actions when files are already in final renamed form", async () => {
    const dom = new JSDOM(buildHtml());
    const musicUploader = createMusicUploaderMock();
    const logger = { error: vi.fn() };
    musicUploader.previewRenames.mockResolvedValue({
      changedCount: 0,
      items: [
        {
          originalName: "01 Generated Track.wav",
          targetName: "01 Generated Track.wav",
        },
      ],
    });
    musicUploader.pickFolder.mockResolvedValue({
      folderPath: "D:/music/final",
      analysis: {
        albumTitle: "Final Album",
        fileCount: 1,
        files: [
          {
            originalName: "01 Generated Track.wav",
            baseName: "Generated Track",
            generatedTitle: "Generated Track",
          },
        ],
        profileKey: "chill-hop",
      },
    });

    const app = createApp({
      document: dom.window.document,
      musicUploader,
      logger,
    });

    await app.init();
    await app.actions.handlePickFolder();

    expect(dom.window.document.getElementById("upload-preview-button").disabled).toBe(false);
    expect(dom.window.document.getElementById("manifest-button").disabled).toBe(false);
    expect(dom.window.document.getElementById("distrokid-open-button").disabled).toBe(false);
    expect(app.state.hasAppliedRename).toBe(true);
  });
});
