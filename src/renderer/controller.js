(function initControllerModule(root, factory) {
  if (typeof module !== "undefined" && module.exports) {
    module.exports = factory(require("./dom"), require("./state"), require("./render"));
    return;
  }

  root.MusicUploaderRenderer = root.MusicUploaderRenderer || {};
  Object.assign(
    root.MusicUploaderRenderer,
    factory(root.MusicUploaderRenderer, root.MusicUploaderRenderer, root.MusicUploaderRenderer),
  );
})(globalThis, function createControllerModule(domModule, stateModule, renderModule) {
  const { getDom } = domModule;
  const { createInitialState } = stateModule;
  const {
    renderGenreOptions,
    renderPreview,
    renderTracks,
    renderUploadPreview,
    setStatus,
  } = renderModule;

  function createApp({ document, musicUploader, logger = console }) {
    const dom = getDom(document);
    const state = createInitialState();

    function getErrorMessage(error) {
      if (error instanceof Error && error.message) {
        return error.message;
      }

      return String(error || "Unbekannter Fehler");
    }

    async function runUiAction(action, fallbackStatus) {
      try {
        await action();
      } catch (error) {
        logger.error(error);
        setStatus(dom, `${fallbackStatus}: ${getErrorMessage(error)}`);
      }
    }

    async function loadConfig() {
      const profilePayload = await musicUploader.listProfiles();
      state.profiles = profilePayload.profiles;
      state.limits = profilePayload.limits;
      const config = await musicUploader.readConfig();

      if (config.genre && state.profiles[config.genre]) {
        state.selectedProfile = config.genre;
      }

      renderGenreOptions(dom, state);
    }

    async function saveConfig() {
      await musicUploader.writeConfig({
        genre: dom.genreSelect.value,
      });
    }

    function getProfileAlbumTitles(profileKey) {
      const profile = state.profiles[profileKey];
      return Array.isArray(profile?.albumTitles) ? profile.albumTitles : [];
    }

    function applyAlbumTitle(title) {
      dom.albumTitleInput.value = title || "";
      dom.albumTitleInput.maxLength = state.limits.albumTitle;
    }

    function resetAlbumTitleCursor(profileKey, currentTitle) {
      const albumTitles = getProfileAlbumTitles(profileKey);
      const currentIndex = albumTitles.findIndex((title) => title === currentTitle);
      state.albumTitleCursor = currentIndex >= 0 ? currentIndex : 0;
    }

    function regenerateAlbumTitle() {
      const albumTitles = getProfileAlbumTitles(dom.genreSelect.value);
      if (albumTitles.length === 0) {
        return;
      }

      state.albumTitleCursor = (state.albumTitleCursor + 1) % albumTitles.length;
      applyAlbumTitle(albumTitles[state.albumTitleCursor]);
    }

    function setPostRenameAvailability(isReady) {
      dom.uploadPreviewButton.disabled = !isReady || state.files.length === 0;
      dom.manifestButton.disabled = !isReady || state.files.length === 0;
      dom.distrokidOpenButton.disabled = !isReady || state.files.length === 0;
      dom.distrokidRunButton.disabled = true;
    }

    async function syncRenameReadiness() {
      if (!state.folderPath || state.files.length === 0) {
        state.hasAppliedRename = false;
        setPostRenameAvailability(false);
        return;
      }

      const plan = await musicUploader.previewRenames(buildPayload());
      state.hasAppliedRename = plan.changedCount === 0;
      setPostRenameAvailability(state.hasAppliedRename);
    }

    async function handlePickFolder() {
      const result = await musicUploader.pickFolder({
        profileKey: dom.genreSelect.value,
      });
      if (!result) {
        return;
      }

      state.folderPath = result.folderPath;
      state.files = result.analysis.files;
      state.hasAppliedRename = false;
      state.selectedProfile = result.analysis.profileKey || dom.genreSelect.value;
      dom.genreSelect.value = state.selectedProfile;
      dom.seoSuffixInput.value = state.profiles[state.selectedProfile]?.seoSuffix || "";

      dom.folderNameInput.value = result.folderPath;
      applyAlbumTitle(result.analysis.albumTitle || "");
      resetAlbumTitleCursor(state.selectedProfile, result.analysis.albumTitle || "");

      if (dom.albumTitleMeta) {
        dom.albumTitleMeta.textContent =
          `Wird passend zum gewaehlten Profil erzeugt und kann manuell angepasst werden. ` +
          `Limit: ${state.limits.albumTitle} Zeichen.`;
      }

      dom.folderMeta.textContent = `${result.analysis.fileCount} WAV-Dateien erkannt`;

      renderTracks(dom, state);
      renderPreview(dom, null);
      renderUploadPreview(dom, null);
      dom.previewButton.disabled = state.files.length === 0;
      dom.applyButton.disabled = true;
      await syncRenameReadiness();
      setStatus(dom, "Ordner geladen");
    }

    function buildPayload() {
      return {
        folderPath: state.folderPath,
        files: state.files,
        albumTitle: dom.albumTitleInput.value.trim(),
        seoSuffix: dom.seoSuffixInput.value.trim(),
        profileKey: dom.genreSelect.value,
      };
    }

    async function handlePreview() {
      const plan = await musicUploader.previewRenames(buildPayload());
      renderPreview(dom, plan);
      state.hasAppliedRename = plan.changedCount === 0;
      dom.applyButton.disabled = plan.changedCount === 0;
      setPostRenameAvailability(state.hasAppliedRename);
      setStatus(dom, `${plan.changedCount} Dateien werden umbenannt`);
    }

    async function handleApply() {
      const plan = await musicUploader.applyRenames(buildPayload());
      renderPreview(dom, plan);
      state.hasAppliedRename = true;

      const refreshed = await musicUploader.loadFolder({
        folderPath: state.folderPath,
        profileKey: dom.genreSelect.value,
      });

      state.files = refreshed.analysis.files;
      applyAlbumTitle(refreshed.analysis.albumTitle || dom.albumTitleInput.value);
      resetAlbumTitleCursor(dom.genreSelect.value, dom.albumTitleInput.value);
      renderTracks(dom, state);

      setPostRenameAvailability(true);
      dom.applyButton.disabled = true;
      setStatus(dom, `Umbenennung abgeschlossen: ${plan.changedCount} Dateien`);
    }

    async function handleUploadPreview() {
      if (!state.hasAppliedRename) {
        setStatus(dom, "Bitte zuerst die Dateien umbenennen");
        return;
      }

      const manifest = await musicUploader.previewUpload(buildPayload());
      renderUploadPreview(dom, manifest);
      setStatus(dom, `Upload-Vorschau fuer ${manifest.trackCount} Tracks erzeugt`);
    }

    async function handleSaveManifest() {
      if (!state.hasAppliedRename) {
        setStatus(dom, "Bitte zuerst die Dateien umbenennen");
        return;
      }

      const result = await musicUploader.writeUploadManifest(buildPayload());
      renderUploadPreview(dom, result.manifest);
      setStatus(dom, `Manifest gespeichert: ${result.manifestPath}`);
    }

    async function handleOpenDistrokid() {
      if (!state.hasAppliedRename) {
        setStatus(dom, "Bitte zuerst die Dateien umbenennen");
        return;
      }

      const result = await musicUploader.startDistrokidSession(buildPayload());
      dom.distrokidRunButton.disabled = false;
      setStatus(
        dom,
        `Chrome geoeffnet. In DistroKid einloggen, zum Upload wechseln, dann "Upload ausfuellen" klicken (${result.trackCount} Tracks)`,
      );
    }

    async function handleRunDistrokidUpload() {
      const result = await musicUploader.continueDistrokidSession();
      setStatus(dom, `DistroKid-Formular fuer ${result.trackCount} Tracks ausgefuellt. Bitte final manuell pruefen.`);
    }

    async function handleGenreChange() {
      state.selectedProfile = dom.genreSelect.value;
      dom.seoSuffixInput.value = state.profiles[dom.genreSelect.value]?.seoSuffix || "";
      await saveConfig();

      if (!state.folderPath) {
        return;
      }

      const refreshed = await musicUploader.loadFolder({
        folderPath: state.folderPath,
        profileKey: dom.genreSelect.value,
      });

      state.files = refreshed.analysis.files;
      applyAlbumTitle(refreshed.analysis.albumTitle || "");
      resetAlbumTitleCursor(dom.genreSelect.value, refreshed.analysis.albumTitle || "");
      state.hasAppliedRename = false;
      renderTracks(dom, state);
      renderPreview(dom, null);
      renderUploadPreview(dom, null);
      dom.applyButton.disabled = true;
      await syncRenameReadiness();
      setStatus(dom, "Profil gewechselt, Titel neu generiert");
    }

    function bindEvents() {
      dom.genreSelect.addEventListener("change", () =>
        runUiAction(handleGenreChange, "Profilwechsel fehlgeschlagen"),
      );
      dom.pickFolderButton.addEventListener("click", () =>
        runUiAction(handlePickFolder, "Ordnerladen fehlgeschlagen"),
      );
      dom.previewButton.addEventListener("click", () =>
        runUiAction(handlePreview, "Vorschau fehlgeschlagen"),
      );
      dom.applyButton.addEventListener("click", () =>
        runUiAction(handleApply, "Umbenennen fehlgeschlagen"),
      );
      dom.uploadPreviewButton.addEventListener("click", () =>
        runUiAction(handleUploadPreview, "Upload-Vorschau fehlgeschlagen"),
      );
      dom.manifestButton.addEventListener("click", () =>
        runUiAction(handleSaveManifest, "Manifest speichern fehlgeschlagen"),
      );
      dom.distrokidOpenButton.addEventListener("click", () =>
        runUiAction(handleOpenDistrokid, "DistroKid-Start fehlgeschlagen"),
      );
      dom.distrokidRunButton.addEventListener("click", () =>
        runUiAction(handleRunDistrokidUpload, "DistroKid-Automation fehlgeschlagen"),
      );
      dom.regenerateAlbumTitleButton.addEventListener("click", () =>
        runUiAction(async () => {
          regenerateAlbumTitle();
          setStatus(dom, "Albumtitel neu generiert");
        }, "Albumtitel-Neugenerierung fehlgeschlagen"),
      );
    }

    async function init() {
      bindEvents();
      await runUiAction(loadConfig, "Initialisierung fehlgeschlagen");
      const sessionStatus = await musicUploader.getDistrokidSessionStatus().catch(() => ({ active: false }));
      dom.distrokidRunButton.disabled = !sessionStatus.active;
    }

    return {
      dom,
      state,
      init,
      actions: {
        handleApply,
        handleGenreChange,
        handlePickFolder,
        handlePreview,
        handleOpenDistrokid,
        handleRunDistrokidUpload,
        handleSaveManifest,
        handleUploadPreview,
      },
    };
  }

  return {
    createApp,
  };
});
