const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("musicUploader", {
  listProfiles: () => ipcRenderer.invoke("profiles:list"),
  pickFolder: (payload) => ipcRenderer.invoke("folder:pick", payload),
  loadFolder: (payload) => ipcRenderer.invoke("folder:load", payload),
  previewRenames: (payload) => ipcRenderer.invoke("library:preview-renames", payload),
  applyRenames: (payload) => ipcRenderer.invoke("library:apply-renames", payload),
  previewUpload: (payload) => ipcRenderer.invoke("library:preview-upload", payload),
  writeUploadManifest: (payload) => ipcRenderer.invoke("library:write-upload-manifest", payload),
  startDistrokidSession: (payload) => ipcRenderer.invoke("distrokid:start-session", payload),
  continueDistrokidSession: () => ipcRenderer.invoke("distrokid:continue-session"),
  getDistrokidSessionStatus: () => ipcRenderer.invoke("distrokid:get-session-status"),
  readConfig: () => ipcRenderer.invoke("library:read-config"),
  writeConfig: (config) => ipcRenderer.invoke("library:write-config", config),
});
