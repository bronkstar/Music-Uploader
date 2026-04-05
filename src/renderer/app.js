const app = globalThis.MusicUploaderRenderer.createApp({
  document,
  musicUploader: window.musicUploader,
});

app.init();
