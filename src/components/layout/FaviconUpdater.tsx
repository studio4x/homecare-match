import { useEffect } from "react";
import { useSiteConfig } from "@/hooks/use-site-config";

const FaviconUpdater = () => {
  const { data: config } = useSiteConfig();

  useEffect(() => {
    if (config?.favicon_url) {
      const link: HTMLLinkElement | null = document.querySelector("link[rel*='icon']") || document.createElement('link');
      link.type = 'image/png'; // Assumindo PNG, mas funciona com a maioria
      link.rel = 'icon';
      link.href = config.favicon_url;
      document.getElementsByTagName('head')[0].appendChild(link);
    }
  }, [config?.favicon_url]);

  return null;
};

export default FaviconUpdater;