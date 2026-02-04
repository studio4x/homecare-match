"use client";

import React, { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { supabase } from '@/integrations/supabase/client';

interface Settings {
  logoUrl: string;
  faviconUrl: string;
  logoHeight: number;
}

interface SettingsContextType extends Settings {
  loading: boolean;
}

const SettingsContext = createContext<SettingsContextType>({
  logoUrl: '',
  faviconUrl: '',
  logoHeight: 48,
  loading: true,
});

export const SettingsProvider = ({ children }: { children: ReactNode }) => {
  const [settings, setSettings] = useState<Settings>({
    logoUrl: '',
    faviconUrl: '',
    logoHeight: 48,
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchSettings = async () => {
      try {
        const { data, error } = await supabase
          .from('site_config')
          .select('logo_url, favicon_url, logo_height_px')
          .eq('id', 1)
          .single();

        if (error) throw error;

        if (data) {
          const newSettings = {
            logoUrl: data.logo_url || '',
            faviconUrl: data.favicon_url || '',
            logoHeight: data.logo_height_px || 48,
          };
          setSettings(newSettings);

          // Atualiza o favicon dinamicamente
          const favicon = document.querySelector('link[rel="icon"]') as HTMLLinkElement;
          if (favicon && newSettings.faviconUrl) {
            favicon.href = newSettings.faviconUrl;
          }
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