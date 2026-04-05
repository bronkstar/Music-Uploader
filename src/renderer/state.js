(function initStateModule(root, factory) {
  if (typeof module !== "undefined" && module.exports) {
    module.exports = factory();
    return;
  }

  root.MusicUploaderRenderer = root.MusicUploaderRenderer || {};
  Object.assign(root.MusicUploaderRenderer, factory());
})(globalThis, function createStateModule() {
  function createInitialState() {
    return {
      folderPath: "",
      files: [],
      hasAppliedRename: false,
      profiles: {},
    limits: {
      trackTitle: 80,
      albumTitle: 90,
    },
    albumTitleCursor: 0,
    selectedProfile: "chill-hop",
  };
}

  return {
    createInitialState,
  };
});
