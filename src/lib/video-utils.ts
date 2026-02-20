// src/lib/video-utils.ts

/**
 * Converte uma URL de vídeo do YouTube (watch ou short) para a URL de incorporação (embed).
 * Adiciona parâmetros para ocultar controles, branding e vídeos relacionados.
 * Retorna a URL original se não for um vídeo do YouTube ou se o ID não puder ser extraído.
 */
export function getYouTubeEmbedUrl(url: string): string {
  if (!url) return url;

  const youtubeRegex = /(?:https?:\/\/)?(?:www\.)?(?:youtube\.com|youtu\.be)\/(?:watch\?v=|embed\/|v\/|)([\w-]{11})(?:\S+)?/;
  const match = url.match(youtubeRegex);

  if (match && match[1]) {
    // Adiciona parâmetros para ocultar controles, branding, informações e vídeos relacionados
    return `https://www.youtube.com/embed/${match[1]}?rel=0&autoplay=1&controls=0&modestbranding=1&showinfo=0&fs=0&iv_load_policy=3`;
  }
  return url;
}