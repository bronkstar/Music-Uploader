(function initRenderModule(root, factory) {
  if (typeof module !== "undefined" && module.exports) {
    module.exports = factory();
    return;
  }

  root.MusicUploaderRenderer = root.MusicUploaderRenderer || {};
  Object.assign(root.MusicUploaderRenderer, factory());
})(globalThis, function createRenderModule() {
  function setStatus(dom, text) {
    dom.statusText.textContent = text;
  }

  function renderGenreOptions(dom, state) {
    const options = Object.entries(state.profiles)
      .map(([key, profile]) => `<option value="${key}">${profile.label}</option>`)
      .join("");

    dom.genreSelect.innerHTML = options;
    dom.genreSelect.value = state.selectedProfile;
    dom.seoSuffixInput.value = state.profiles[state.selectedProfile]?.seoSuffix || "";
  }

  function renderTracks(dom, state) {
    if (state.files.length === 0) {
      dom.tracksContainer.className = "tracks-empty";
      dom.tracksContainer.textContent = "Keine Dateien geladen.";
      return;
    }

    dom.tracksContainer.className = "";
    dom.tracksContainer.innerHTML = "";

    state.files.forEach((file, index) => {
      const fragment = dom.trackRowTemplate.content.cloneNode(true);
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
      dom.tracksContainer.appendChild(fragment);
    });
  }

  function renderPreview(dom, plan) {
    if (!plan || plan.items.length === 0) {
      dom.previewContainer.className = "preview-empty";
      dom.previewContainer.textContent = "Noch keine Vorschau erzeugt.";
      return;
    }

    dom.previewContainer.className = "";
    dom.previewContainer.innerHTML = "";

    plan.items.forEach((item) => {
      const fragment = dom.previewRowTemplate.content.cloneNode(true);
      fragment.querySelector(".preview-source").textContent = item.originalName;
      fragment.querySelector(".preview-target").textContent = item.targetName;
      dom.previewContainer.appendChild(fragment);
    });
  }

  function renderUploadPreview(dom, manifest) {
    if (!manifest || manifest.tracks.length === 0) {
      dom.uploadContainer.className = "preview-empty";
      dom.uploadContainer.textContent = "Noch keine Upload-Vorschau erzeugt.";
      return;
    }

    dom.uploadContainer.className = "";
    dom.uploadContainer.innerHTML = "";

    const albumHeader = dom.uploadContainer.ownerDocument.createElement("div");
    albumHeader.className = "panel";
    albumHeader.innerHTML =
      `<p class="panel-title">Albumtitel</p><p class="muted">${manifest.albumTitle || "Untitled Album"}</p>`;
    dom.uploadContainer.appendChild(albumHeader);

    manifest.tracks.forEach((track) => {
      const fragment = dom.uploadRowTemplate.content.cloneNode(true);
      const source = fragment.querySelectorAll(".preview-source")[0];
      const sourceSub = fragment.querySelectorAll(".upload-sub")[0];
      const target = fragment.querySelectorAll(".preview-target")[0];
      const targetSub = fragment.querySelectorAll(".upload-sub")[1];

      source.textContent = `Track ${track.trackNumber}: ${track.distrokidTitle || track.title}`;
      sourceSub.textContent = track.sourceFileName;
      target.textContent = "DistroKid-Regeln";
      targetSub.textContent = "Instrumental · Apple Credits · Keine Extras · Gesamt 0,00 EUR";
      dom.uploadContainer.appendChild(fragment);
    });
  }

  return {
    renderGenreOptions,
    renderPreview,
    renderTracks,
    renderUploadPreview,
    setStatus,
  };
});
