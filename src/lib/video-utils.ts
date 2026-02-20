// src/lib/video-utils.ts

/**
 * Converte uma URL de vídeo do YouTube (watch ou short) para a URL de incorporação (embed).
 * Retorna a URL original se não for um vídeo do YouTube ou se o ID não puder ser extraído.
 */
export function getYouTubeEmbedUrl(url: string): string {
  if (!url) return url;

  const youtubeRegex = /(?:https?:\/\/)?(?:www\.)?(?:youtube\.com|youtu\.be)\/(?:watch\?v=|embed\/|v\/|)([\w-]{11})(?:\S+)?/;
  const match = url.match(youtubeRegex);

  if (match && match[1]) {
    return `https://www.youtube.com/embed/${match[1]}?rel=0&autoplay=1`;
  }
  return url;
}