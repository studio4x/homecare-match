import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface SiteConfig {
  id: number;
  logo_url: string | null;
  logo_height_px: number;
  footer_logo_url: string | null;
  footer_logo_height_px: number;
  favicon_url: string | null;
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
        };
      }

      return data;
    },
    staleTime: 1000 * 60 * 5, // Cache por 5 minutos
  });
};