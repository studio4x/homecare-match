"use client";

import React, { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useQuery } from '@tanstack/react-query';

interface SiteConfig {
  logo_url: string;
  favicon_url: string;
  logo_height_px: number;
  primary_hex: string;
  success_hex: string;
  background_hex: string;
  foreground_hex: string;
  footer_logo_url: string;
  footer_logo_height_px: number;
  font_family: string;
}

const SiteConfigContext = createContext<SiteConfig | null>(null);

const fetchSiteConfig = async (): Promise<SiteConfig> => {
  const { data, error } = await supabase
    .from('site_config')
    .select('*')
    .eq('id', 1)
    .single();
  if (error) throw new Error(error.message);
  return data;
};

// Função para converter HEX para o formato HSL usado no CSS
const hexToHsl = (hex: string): string => {
  let r = 0, g = 0, b = 0;
  if (hex.length === 4) {
    r = parseInt(hex[1] + hex[1], 16);
    g = parseInt(hex[2] + hex[2], 16);
    b = parseInt(hex[3] + hex[3], 16);
  } else if (hex.length === 7) {
    r = parseInt(hex[1] + hex[2], 16);
    g = parseInt(hex[3] + hex[4], 16);
    b = parseInt(hex[5] + hex[6], 16);
  }
  r /= 255; g /= 255; b /= 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b);
  let h = 0, s = 0, l = (max + min) / 2;
  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    switch (max) {
      case r: h = (g - b) / d + (g < b ? 6 : 0); break;
      case g: h = (b - r) / d + 2; break;
      case b: h = (r - g) / d + 4; break;
    }
    h /= 6;
  }
  return `${Math.round(h * 360)} ${Math.round(s * 100)}% ${Math.round(l * 100)}%`;
};

export const SiteConfigProvider = ({ children }: { children: ReactNode }) => {
  const { data: config, isLoading } = useQuery<SiteConfig>({
    queryKey: ['siteConfig'],
    queryFn: fetchSiteConfig,
    staleTime: Infinity, // A configuração não muda com frequência
  });

  useEffect(() => {
    if (config) {
      // Injeta as cores e a fonte como variáveis CSS globais
      const style = document.createElement('style');
      style.innerHTML = `
        :root {
          --primary: ${hexToHsl(config.primary_hex)};
          --success: ${hexToHsl(config.success_hex)};
          --background: ${hexToHsl(config.background_hex)};
          --foreground: ${hexToHsl(config.foreground_hex)};
        }
        body {
          font-family: '${config.font_family}', sans-serif;
        }
      `;
      document.head.appendChild(style);
    }
  }, [config]);

  if (isLoading) {
    return null; // Ou um loader de tela cheia
  }

  return (
    <SiteConfigContext.Provider value={config || null}>
      {children}
    </SiteConfigContext.Provider>
  );
};

export const useSiteConfig = () => {
  const context = useContext(SiteConfigContext);
  if (context === undefined) {
    throw new Error('useSiteConfig must be used within a SiteConfigProvider');
  }
  return context;
};