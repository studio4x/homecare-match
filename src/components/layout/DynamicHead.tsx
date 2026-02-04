"use client";

import { useEffect } from 'react';
import { useSiteConfig } from '../../contexts/SiteConfigProvider';

const DynamicHead = () => {
  const config = useSiteConfig();

  useEffect(() => {
    if (config) {
      // Atualiza o Favicon
      let faviconLink = document.querySelector("link[rel~='icon']") as HTMLLinkElement;
      if (!faviconLink) {
        faviconLink = document.createElement('link');
        faviconLink.rel = 'icon';
        document.getElementsByTagName('head')[0].appendChild(faviconLink);
      }
      faviconLink.href = config.favicon_url;

      // Atualiza a Fonte do Google
      const fontId = 'google-font-dynamic';
      let fontLink = document.getElementById(fontId) as HTMLLinkElement;
      if (!fontLink) {
        fontLink = document.createElement('link');
        fontLink.id = fontId;
        fontLink.rel = 'stylesheet';
        document.head.appendChild(fontLink);
      }
      const fontName = config.font_family.replace(' ', '+');
      fontLink.href = `https://fonts.googleapis.com/css2?family=${fontName}:wght@300;400;500;600;700;800&display=swap`;
    }
  }, [config]);

  return null; // Este componente não renderiza nada
};

export default DynamicHead;