"use client";

import React, { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { hexToHsl } from '@/lib/utils';

interface Settings {
  logoUrl: string;
  faviconUrl: string;
  logoHeight: number;
  primaryHex: string;
  successHex: string;
  backgroundHex: string;
  foregroundHex: string;
  footerLogoUrl: string;
  footerLogoHeight: number;
}

interface SettingsContextType extends Settings {
  loading: boolean;
}

const SettingsContext = createContext<SettingsContextType>({
  logoUrl: '',
  faviconUrl: '',
  logoHeight: 48,
  primaryHex: '#007BFF',
  successHex: '#28A745',
  backgroundHex: '#F8F9FA',
  foregroundHex: '#182742',
  footerLogoUrl: '',
  footerLogoHeight: 32,
  loading: true,
});

export const SettingsProvider = ({ children }: { children: ReactNode }) => {
  const [settings, setSettings] = useState<Settings>({
    logoUrl: '',
    faviconUrl: '',
    logoHeight: 48,
    primaryHex: '#007BFF',
    successHex: '#28A745',
    backgroundHex: '#F8F9FA',
    foregroundHex: '#182742',
    footerLogoUrl: '',
    footerLogoHeight: 32,
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchSettings = async () => {
      try {
        const { data, error } = await supabase
          .from('site_config')
          .select('logo_url, favicon_url, logo_height_px, primary_hex, success_hex, background_hex, foreground_hex, footer_logo_url, footer_logo_height_px')
          .eq('id', 1)
          .single();

        if (error) throw error;

        if (data) {
          const newSettings = {
            logoUrl: data.logo_url || '',
            faviconUrl: data.favicon_url || '',
            logoHeight: data.logo_height_px || 48,
            primaryHex: data.primary_hex || '#007BFF',
            successHex: data.success_hex || '#28A745',
            backgroundHex: data.background_hex || '#F8F9FA',
            foregroundHex: data.foreground_hex || '#182742',
            footerLogoUrl: data.footer_logo_url || '',
            footerLogoHeight: data.footer_logo_height_px || 32,
          };
          setSettings(newSettings);

          // Aplica as configurações
          const favicon = document.querySelector('link[rel="icon"]') as HTMLLinkElement;
          if (favicon && newSettings.faviconUrl) {
            favicon.href = newSettings.faviconUrl;
          }

          const root = document.documentElement;
          const primaryHsl = hexToHsl(newSettings.primaryHex);
          const successHsl = hexToHsl(newSettings.successHex);
          const backgroundHsl = hexToHsl(newSettings.backgroundHex);
          const foregroundHsl = hexToHsl(newSettings.foregroundHex);

          if (primaryHsl) root.style.setProperty('--primary', primaryHsl);
          if (successHsl) {
            root.style.setProperty('--success', successHsl);
            root.style.setProperty('--accent', successHsl); // Accent e Success usam a mesma cor
          }
          if (backgroundHsl) root.style.setProperty('--background', backgroundHsl);
          if (foregroundHsl) root.style.setProperty('--foreground', foregroundHsl);
        }
      } catch (error) {
        console.error("Erro ao buscar configurações do site:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchSettings();
  }, []);

  return (
    <SettingsContext.Provider value={{ ...settings, loading }}>
      {children}
    </SettingsContext.Provider>
  );
};

export const useSettings = () => useContext(SettingsContext);