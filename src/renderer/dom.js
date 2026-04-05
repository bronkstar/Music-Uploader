(function initDomModule(root, factory) {
  if (typeof module !== "undefined" && module.exports) {
    module.exports = factory();
    return;
  }

  root.MusicUploaderRenderer = root.MusicUploaderRenderer || {};
  Object.assign(root.MusicUploaderRenderer, factory());
})(globalThis, function createDomModule() {
  function getRequiredElement(document, id) {
    const element = document.getElementById(id);

    if (!element) {
      throw new Error(`Fehlendes DOM-Element: ${id}`);
    }

    return element;
  }

  function getDom(document) {
    return {
      genreSelect: getRequiredElement(document, "genre-select"),
      seoSuffixInput: getRequiredElement(document, "seo-suffix"),
      folderNameInput: getRequiredElement(document, "folder-name"),
    folderMeta: getRequiredElement(document, "folder-meta"),
    albumTitleInput: getRequiredElement(document, "album-title"),
    regenerateAlbumTitleButton: getRequiredElement(document, "regenerate-album-title-button"),
    albumTitleMeta: document.getElementById("album-title-meta"),
      statusText: getRequiredElement(document, "status-text"),
      tracksContainer: getRequiredElement(document, "tracks-container"),
      previewContainer: getRequiredElement(document, "preview-container"),
      uploadContainer: getRequiredElement(document, "upload-container"),
      pickFolderButton: getRequiredElement(document, "pick-folder-button"),
      previewButton: getRequiredElement(document, "preview-button"),
      applyButton: getRequiredElement(document, "apply-button"),
      uploadPreviewButton: getRequiredElement(document, "upload-preview-button"),
      manifestButton: getRequiredElement(document, "manifest-button"),
      distrokidOpenButton: getRequiredElement(document, "distrokid-open-button"),
      distrokidRunButton: getRequiredElement(document, "distrokid-run-button"),
      trackRowTemplate: getRequiredElement(document, "track-row-template"),
      previewRowTemplate: getRequiredElement(document, "preview-row-template"),
      uploadRowTemplate: getRequiredElement(document, "upload-row-template"),
    };
  }

  return {
    getDom,
  };
});
