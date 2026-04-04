const { app, BrowserWindow, dialog, ipcMain } = require("electron");
const path = require("node:path");
const fs = require("node:fs/promises");
const {
  MUSIC_PROFILES,
  MAX_TRACK_TITLE_LENGTH,
  MAX_ALBUM_TITLE_LENGTH,
  analyzeFolder,
  buildRenamePlan,
  applyRenamePlan,
  buildUploadManifest,
  writeUploadManifest,
} = require("../shared/library-service");

function createWindow() {
  const window = new BrowserWindow({
    width: 1440,
    height: 960,
    minWidth: 1180,
    minHeight: 760,
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  window.loadFile(path.join(__dirname, "../renderer/index.html"));
}

app.whenReady().then(() => {
  ipcMain.handle("profiles:list", async () => {
    return {
      profiles: MUSIC_PROFILES,
      limits: {
        trackTitle: MAX_TRACK_TITLE_LENGTH,
        albumTitle: MAX_ALBUM_TITLE_LENGTH,
      },
    };
  });

  ipcMain.handle("folder:load", async (_event, payload) => {
    const folderPath = typeof payload === "string" ? payload : payload.folderPath;
    const profileKey = typeof payload === "string" ? "chill-hop" : payload.profileKey || "chill-hop";
    const analysis = await analyzeFolder(folderPath, profileKey);
    return {
      folderPath,
      analysis,
    };
  });

  ipcMain.handle("folder:pick", async () => {
    const result = await dialog.showOpenDialog({
      properties: ["openDirectory"],
    });

    if (result.canceled || result.filePaths.length === 0) {
      return null;
    }

    const folderPath = result.filePaths[0];
    const analysis = await analyzeFolder(folderPath, "chill-hop");
    return {
      folderPath,
      analysis,
    };
  });

  ipcMain.handle("library:preview-renames", async (_event, payload) => {
    return buildRenamePlan(payload);
  });

  ipcMain.handle("library:apply-renames", async (_event, payload) => {
    return applyRenamePlan(payload);
  });

  ipcMain.handle("library:preview-upload", async (_event, payload) => {
    return buildUploadManifest(payload);
  });

  ipcMain.handle("library:write-upload-manifest", async (_event, payload) => {
    return writeUploadManifest(payload);
  });

  ipcMain.handle("library:read-config", async () => {
    const configPath = path.join(app.getPath("userData"), "music-uploader-config.json");

    try {
      const raw = await fs.readFile(configPath, "utf8");
      return JSON.parse(raw);
    } catch {
      return {};
    }
  });

  ipcMain.handle("library:write-config", async (_event, config) => {
    const configPath = path.join(app.getPath("userData"), "music-uploader-config.json");
    await fs.writeFile(configPath, JSON.stringify(config, null, 2), "utf8");
    return { ok: true };
  });

  createWindow();

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});
