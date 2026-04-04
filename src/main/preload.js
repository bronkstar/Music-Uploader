const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("musicUploader", {
  listProfiles: () => ipcRenderer.invoke("profiles:list"),
  pickFolder: () => ipcRenderer.invoke("folder:pick"),
  loadFolder: (payload) => ipcRenderer.invoke("folder:load", payload),
  previewRenames: (payload) => ipcRenderer.invoke("library:preview-renames", payload),
  applyRenames: (payload) => ipcRenderer.invoke("library:apply-renames", payload),
  previewUpload: (payload) => ipcRenderer.invoke("library:preview-upload", payload),
  writeUploadManifest: (payload) => ipcRenderer.invoke("library:write-upload-manifest", payload),
  readConfig: () => ipcRenderer.invoke("library:read-config"),
  writeConfig: (config) => ipcRenderer.invoke("library:write-config", config),
});
