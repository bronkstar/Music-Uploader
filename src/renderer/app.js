const genreSelect = document.getElementById("genre-select");
const seoSuffixInput = document.getElementById("seo-suffix");
const folderNameInput = document.getElementById("folder-name");
const folderMeta = document.getElementById("folder-meta");
const albumTitleInput = document.getElementById("album-title");
const albumTitleMeta = document.getElementById("album-title-meta");
const statusText = document.getElementById("status-text");
const tracksContainer = document.getElementById("tracks-container");
const previewContainer = document.getElementById("preview-container");
const uploadContainer = document.getElementById("upload-container");
const pickFolderButton = document.getElementById("pick-folder-button");
const previewButton = document.getElementById("preview-button");
const applyButton = document.getElementById("apply-button");
const uploadPreviewButton = document.getElementById("upload-preview-button");
const manifestButton = document.getElementById("manifest-button");
const trackRowTemplate = document.getElementById("track-row-template");
const previewRowTemplate = document.getElementById("preview-row-template");
const uploadRowTemplate = document.getElementById("upload-row-template");

const state = {
  folderPath: "",
  files: [],
  hasAppliedRename: false,
  profiles: {},
  limits: {
    trackTitle: 80,
    albumTitle: 90,
  },
  selectedProfile: "chill-hop",
};

function setStatus(text) {
  statusText.textContent = text;
}

function renderGenreOptions() {
  const options = Object.entries(state.profiles)
    .map(([key, profile]) => `<option value="${key}">${profile.label}</option>`)
    .join("");

  genreSelect.innerHTML = options;
  genreSelect.value = state.selectedProfile;
  seoSuffixInput.value = state.profiles[state.selectedProfile]?.seoSuffix || "";
}

function renderTracks() {
  if (state.files.length === 0) {
    tracksContainer.className = "tracks-empty";
    tracksContainer.textContent = "Keine Dateien geladen.";
    return;
  }

  tracksContainer.className = "";
  tracksContainer.innerHTML = "";

  state.files.forEach((file, index) => {
    const fragment = trackRowTemplate.content.cloneNode(true);
    const row = fragment.querySelector(".track-row");
    const original = fragment.querySelector(".track-original");
    const pathText = fragment.querySelector(".track-path");
    const input = fragment.querySelector(".track-title-input");

    original.textContent = `${String(index + 1).padStart(2, "0")} ${file.originalName}`;
    pathText.textContent = file.baseName;
    input.value = file.generatedTitle;
    input.maxLength = state.limits.trackTitle;
    input.addEventListener("input", (event) => {
      state.files[index].generatedTitle = event.target.value;
    });

    row.dataset.index = String(index);
    tracksContainer.appendChild(fragment);
  });
}

function renderPreview(plan) {
  if (!plan || plan.items.length === 0) {
    previewContainer.className = "preview-empty";
    previewContainer.textContent = "Noch keine Vorschau erzeugt.";
    return;
  }

  previewContainer.className = "";
  previewContainer.innerHTML = "";

  plan.items.forEach((item) => {
    const fragment = previewRowTemplate.content.cloneNode(true);
    fragment.querySelector(".preview-source").textContent = item.originalName;
    fragment.querySelector(".preview-target").textContent = item.targetName;
    previewContainer.appendChild(fragment);
  });
}

function renderUploadPreview(manifest) {
  if (!manifest || manifest.tracks.length === 0) {
    uploadContainer.className = "preview-empty";
    uploadContainer.textContent = "Noch keine Upload-Vorschau erzeugt.";
    return;
  }

  uploadContainer.className = "";
  uploadContainer.innerHTML = "";

  const albumHeader = document.createElement("div");
  albumHeader.className = "panel";
  albumHeader.innerHTML = `<p class="panel-title">Albumtitel</p><p class="muted">${manifest.albumTitle || "Untitled Album"}</p>`;
  uploadContainer.appendChild(albumHeader);

  manifest.tracks.forEach((track) => {
    const fragment = uploadRowTemplate.content.cloneNode(true);
    const source = fragment.querySelectorAll(".preview-source")[0];
    const sourceSub = fragment.querySelectorAll(".upload-sub")[0];
    const target = fragment.querySelectorAll(".preview-target")[0];
    const targetSub = fragment.querySelectorAll(".upload-sub")[1];

    source.textContent = `Track ${track.trackNumber}: ${track.title}`;
    sourceSub.textContent = track.sourceFileName;
    target.textContent = "DistroKid-Regeln";
    targetSub.textContent = "Instrumental · Apple Credits · Keine Extras · Gesamt 0,00 EUR";
    uploadContainer.appendChild(fragment);
  });
}

async function loadConfig() {
  const profilePayload = await window.musicUploader.listProfiles();
  state.profiles = profilePayload.profiles;
  state.limits = profilePayload.limits;
  const config = await window.musicUploader.readConfig();

  if (config.genre && state.profiles[config.genre]) {
    state.selectedProfile = config.genre;
  }

  renderGenreOptions();
}

async function saveConfig() {
  await window.musicUploader.writeConfig({
    genre: genreSelect.value,
  });
}

async function handlePickFolder() {
  const result = await window.musicUploader.pickFolder();
  if (!result) {
    return;
  }

  state.folderPath = result.folderPath;
  state.files = result.analysis.files;
  state.hasAppliedRename = false;
  state.selectedProfile = result.analysis.profileKey || genreSelect.value;

  folderNameInput.value = result.folderPath;
  albumTitleInput.value = result.analysis.albumTitle || "";
  albumTitleInput.maxLength = state.limits.albumTitle;
  albumTitleMeta.textContent = `Wird passend zum gewaehlten Profil erzeugt und kann manuell angepasst werden. Limit: ${state.limits.albumTitle} Zeichen.`;
  folderMeta.textContent = `${result.analysis.fileCount} WAV-Dateien erkannt`;

  renderTracks();
  renderPreview(null);
  renderUploadPreview(null);
  previewButton.disabled = state.files.length === 0;
  uploadPreviewButton.disabled = true;
  manifestButton.disabled = true;
  applyButton.disabled = true;
  setStatus("Ordner geladen");
}

async function handlePreview() {
  const payload = {
    folderPath: state.folderPath,
    files: state.files,
    albumTitle: albumTitleInput.value.trim(),
    seoSuffix: seoSuffixInput.value.trim(),
    profileKey: genreSelect.value,
  };

  const plan = await window.musicUploader.previewRenames(payload);
  renderPreview(plan);
  applyButton.disabled = plan.changedCount === 0;
  uploadPreviewButton.disabled = true;
  manifestButton.disabled = true;
  setStatus(`${plan.changedCount} Dateien werden umbenannt`);
}

async function handleApply() {
  const payload = {
    folderPath: state.folderPath,
    files: state.files,
    albumTitle: albumTitleInput.value.trim(),
    seoSuffix: seoSuffixInput.value.trim(),
    profileKey: genreSelect.value,
  };

  const plan = await window.musicUploader.applyRenames(payload);
  renderPreview(plan);
  state.hasAppliedRename = true;

  const refreshed = await window.musicUploader.loadFolder({
    folderPath: state.folderPath,
    profileKey: genreSelect.value,
  });
  state.files = refreshed.analysis.files;
  albumTitleInput.value = refreshed.analysis.albumTitle || albumTitleInput.value;
  renderTracks();

  uploadPreviewButton.disabled = state.files.length === 0;
  manifestButton.disabled = state.files.length === 0;
  setStatus(`Umbenennung abgeschlossen: ${plan.changedCount} Dateien`);
  applyButton.disabled = true;
}

async function handleUploadPreview() {
  if (!state.hasAppliedRename) {
    setStatus("Bitte zuerst die Dateien umbenennen");
    return;
  }

  const payload = {
    folderPath: state.folderPath,
    files: state.files,
    albumTitle: albumTitleInput.value.trim(),
    seoSuffix: seoSuffixInput.value.trim(),
    profileKey: genreSelect.value,
  };

  const manifest = await window.musicUploader.previewUpload(payload);
  renderUploadPreview(manifest);
  setStatus(`Upload-Vorschau fuer ${manifest.trackCount} Tracks erzeugt`);
}

async function handleSaveManifest() {
  if (!state.hasAppliedRename) {
    setStatus("Bitte zuerst die Dateien umbenennen");
    return;
  }

  const payload = {
    folderPath: state.folderPath,
    files: state.files,
    albumTitle: albumTitleInput.value.trim(),
    seoSuffix: seoSuffixInput.value.trim(),
    profileKey: genreSelect.value,
  };

  const result = await window.musicUploader.writeUploadManifest(payload);
  renderUploadPreview(result.manifest);
  setStatus(`Manifest gespeichert: ${result.manifestPath}`);
}

genreSelect.addEventListener("change", async () => {
  state.selectedProfile = genreSelect.value;
  seoSuffixInput.value = state.profiles[genreSelect.value]?.seoSuffix || "";
  await saveConfig();

  if (state.folderPath) {
    const refreshed = await window.musicUploader.loadFolder({
      folderPath: state.folderPath,
      profileKey: genreSelect.value,
    });
    state.files = refreshed.analysis.files;
    albumTitleInput.value = refreshed.analysis.albumTitle || "";
    state.hasAppliedRename = false;
    renderTracks();
    renderPreview(null);
    renderUploadPreview(null);
    applyButton.disabled = true;
    uploadPreviewButton.disabled = true;
    manifestButton.disabled = true;
    setStatus("Profil gewechselt, Titel neu generiert");
  }
});

pickFolderButton.addEventListener("click", handlePickFolder);
previewButton.addEventListener("click", handlePreview);
applyButton.addEventListener("click", handleApply);
uploadPreviewButton.addEventListener("click", handleUploadPreview);
manifestButton.addEventListener("click", handleSaveManifest);

loadConfig();
