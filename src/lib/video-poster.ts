export const generatePosterFromVideoFile = async (
  file: File,
  options?: {
    captureAtSeconds?: number;
    quality?: number;
    mimeType?: "image/jpeg" | "image/png";
  },
) => {
  const captureAtSeconds = Number(options?.captureAtSeconds ?? 1);
  const quality = Number(options?.quality ?? 0.86);
  const mimeType = options?.mimeType || "image/jpeg";

  const blobUrl = URL.createObjectURL(file);
  const video = document.createElement("video");
  video.preload = "metadata";
  video.muted = true;
  video.playsInline = true;
  video.crossOrigin = "anonymous";
  video.src = blobUrl;

  try {
    await new Promise<void>((resolve, reject) => {
      const onLoaded = () => resolve();
      const onError = () => reject(new Error("Nao foi possivel carregar o video para gerar capa."));
      video.addEventListener("loadedmetadata", onLoaded, { once: true });
      video.addEventListener("error", onError, { once: true });
    });

    const duration = Number(video.duration || 0);
    const targetTime = duration > 0 ? Math.min(captureAtSeconds, Math.max(0.05, duration * 0.25)) : 0.1;

    await new Promise<void>((resolve) => {
      const onSeeked = () => resolve();
      video.addEventListener("seeked", onSeeked, { once: true });
      try {
        video.currentTime = targetTime;
      } catch {
        resolve();
      }
      setTimeout(() => resolve(), 1400);
    });

    const width = Math.max(320, video.videoWidth || 1280);
    const height = Math.max(180, video.videoHeight || 720);

    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("Falha ao inicializar canvas para gerar capa.");

    ctx.drawImage(video, 0, 0, width, height);

    const posterBlob = await new Promise<Blob | null>((resolve) => {
      canvas.toBlob((blob) => resolve(blob), mimeType, quality);
    });

    if (!posterBlob) throw new Error("Falha ao exportar capa do video.");
    return posterBlob;
  } finally {
    URL.revokeObjectURL(blobUrl);
    video.removeAttribute("src");
    video.load();
  }
};

