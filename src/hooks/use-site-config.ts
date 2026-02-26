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
  payment_provider?: string | null;
  asaas_environment?: string | null;
  asaas_checkout_base_url?: string | null;
  asaas_allow_credit_card?: boolean | null;
  asaas_allow_pix?: boolean | null;
  asaas_default_installment_max?: number | null;
  asaas_checkout_expiration_minutes?: number | null;
  google_maps_api_key?: string | null;
  vapid_public_key?: string | null;
  gemini_model?: string | null;
  push_layout_json?: {
    bgColor: string;
    titleColor: string;
    bodyColor: string;
    borderRadius: string;
    iconBgColor: string;
    iconColor: string;
    shadowIntensity: string;
    ctaBgColor: string;
    ctaTextColor: string;
    backdropColor: string;
    duration: number;
  };
  // Marketing fields
  ga_measurement_id?: string | null;
  ga_enabled?: boolean;
  gtm_container_id?: string | null;
  gtm_enabled?: boolean;
  fb_pixel_id?: string | null;
  fb_pixel_enabled?: boolean;
  // Video fields
  video_url_professionals?: string | null;
  video_url_companies?: string | null;
  video_url_families?: string | null;
  video_url_onboarding?: string | null;
  video_url_onboarding_company?: string | null;
  video_url_onboarding_family?: string | null;
  // New storage paths for landing page videos
  video_storage_path_professionals?: string | null;
  video_mime_professionals?: string | null;
  video_storage_path_companies?: string | null;
  video_mime_companies?: string | null;
  video_storage_path_families?: string | null;
  video_mime_families?: string | null;
  video_storage_path_onboarding?: string | null;
  video_mime_onboarding?: string | null;
  video_storage_path_onboarding_company?: string | null;
  video_mime_onboarding_company?: string | null;
  video_storage_path_onboarding_family?: string | null;
  video_mime_onboarding_family?: string | null;
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
        return {
          id: 1,
          logo_url: null,
          logo_height_px: 48,
          footer_logo_url: null,
          footer_logo_height_px: 48,
          favicon_url: null,
          whatsapp_number: null,
          enable_professional_list: true,
          payment_provider: "asaas",
          asaas_environment: "sandbox",
          asaas_allow_credit_card: true,
          asaas_allow_pix: true,
          asaas_default_installment_max: 12,
          asaas_checkout_expiration_minutes: 60,
          ga_enabled: false,
          gtm_enabled: false,
          fb_pixel_enabled: false,
          gemini_model: 'gemini-1.5-flash'
        };
      }

      return data;
    },
    // Reduzido de 5 minutos para 30 segundos para refletir mudanças de layout mais rápido
    staleTime: 1000 * 30,
  });
};
