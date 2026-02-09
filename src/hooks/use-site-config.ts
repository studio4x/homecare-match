import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface SiteConfig {
  id: number;
  logo_url: string | null;
  logo_height_px: number;
  footer_logo_url: string | null;
  footer_logo_height_px: number;
  favicon_url: string | null;
  whatsapp_number: string | null;
  enable_professional_list: boolean;
  // Added marketing fields
  ga_measurement_id?: string | null;
  ga_enabled?: boolean;
  gtm_container_id?: string | null;
  gtm_enabled?: boolean;
  fb_pixel_id?: string | null;
  fb_pixel_enabled?: boolean;
}

export const useSiteConfig = () => {
  return useQuery({
    queryKey: ["site-config"],
    queryFn: async (): Promise<SiteConfig> => {
      const { data, error } = await supabase
        .from("site_config")
        .select("*")
        .eq("id", 1)
        .single();

      if (error) {
        console.error("Erro ao buscar configurações do site:", error);
        // Retorna defaults em caso de erro
        return {
          id: 1,
          logo_url: null,
          logo_height_px: 48,
          footer_logo_url: null,
          footer_logo_height_px: 48,
          favicon_url: null,
          whatsapp_number: null,
          enable_professional_list: true,
          // Defaults for marketing fields
          ga_measurement_id: null,
          ga_enabled: false,
          gtm_container_id: null,
          gtm_enabled: false,
          fb_pixel_id: null,
          fb_pixel_enabled: false,
        };
      }

      return data;
    },
    staleTime: 1000 * 60 * 5, // Cache por 5 minutos
  });
};