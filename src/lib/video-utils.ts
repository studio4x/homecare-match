// src/lib/video-utils.ts

/**
 * Converte uma URL de vídeo do YouTube (watch ou short) para a URL de incorporação (embed).
 * Adiciona parâmetros para ocultar controles, branding e vídeos relacionados.
 * Retorna a URL original se não for um vídeo do YouTube ou se o ID não puder ser extraído.
 */
export function getYouTubeEmbedUrl(url: string, autoplay: boolean = false): string {
  if (!url) return url;

  const videoId = getYouTubeVideoId(url);

  if (videoId) {
    // Removendo os parâmetros que ocultam os controles e outras informações
    // Agora, o player do YouTube exibirá os controles padrão.
    return `https://www.youtube.com/embed/${videoId}?rel=0&autoplay=${autoplay ? 1 : 0}`;
  }
  return url;
}

export function getYouTubeVideoId(url: string): string {
  if (!url) return "";
  const youtubeRegex =
    /(?:https?:\/\/)?(?:www\.)?(?:youtube\.com|youtu\.be)\/(?:watch\?v=|embed\/|v\/|shorts\/|)([\w-]{11})(?:\S+)?/;
  const match = url.match(youtubeRegex);
  return match?.[1] || "";
}

export function getYouTubeThumbnailUrl(url: string, quality: "default" | "mqdefault" | "hqdefault" | "sddefault" | "maxresdefault" = "hqdefault"): string {
  const videoId = getYouTubeVideoId(url);
  if (!videoId) return "";
  return `https://img.youtube.com/vi/${videoId}/${quality}.jpg`;
}
