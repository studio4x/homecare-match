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
  chatbot_enabled?: boolean;
  chatbot_use_ai?: boolean;
  chatbot_ai_first?: boolean;
  chatbot_show_mode_badge?: boolean;
  chatbot_welcome_message?: string | null;
  chatbot_out_of_scope_message?: string | null;
  chatbot_error_message?: string | null;
  chatbot_max_requests_anon_per_day?: number | null;
  chatbot_max_requests_auth_per_day?: number | null;
  chatbot_history_window?: number | null;
  chatbot_retention_days?: number | null;
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
  // PWA fields
  pwa_app_name?: string | null;
  pwa_short_name?: string | null;
  pwa_description?: string | null;
  pwa_theme_color?: string | null;
  pwa_background_color?: string | null;
  pwa_icon_192_url?: string | null;
  pwa_icon_512_url?: string | null;
  pwa_maskable_icon_url?: string | null;
  pwa_install_image_url?: string | null;
  pwa_install_title?: string | null;
  pwa_install_description?: string | null;
  pwa_assets_json?: Record<string, string> | null;
  pwa_screenshots_json?: Array<{
    src: string;
    sizes: string;
    type?: string;
    label?: string;
    form_factor?: "narrow" | "wide";
  }> | null;
}

const isTransientNetworkError = (error: unknown) => {
  const message = String((error as any)?.message || "").toLowerCase();
  return (
    message.includes("networkerror") ||
    message.includes("failed to fetch") ||
    message.includes("fetch resource") ||
    message.includes("network request failed")
  );
};
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
        if (!isTransientNetworkError(error)) {
          console.error("Erro ao buscar configurações do site:", error);
        }
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
          asaas_allow_pix: false,
          asaas_default_installment_max: 12,
          asaas_checkout_expiration_minutes: 60,
          ga_enabled: false,
          gtm_enabled: false,
          fb_pixel_enabled: false,
          gemini_model: 'gemini-1.5-flash',
          chatbot_enabled: true,
          chatbot_use_ai: true,
          chatbot_ai_first: true,
          chatbot_show_mode_badge: false,
          chatbot_welcome_message: "Ola! Sou o assistente da plataforma. Posso ajudar com funcionalidades e como usar cada recurso.",
          chatbot_out_of_scope_message: "Posso responder apenas sobre funcionalidades da plataforma e como usa-las. Se precisar, posso te direcionar para o suporte.",
          chatbot_error_message: "Nao consegui responder agora. Tente novamente em instantes ou abra um chamado no suporte.",
          chatbot_max_requests_anon_per_day: 20,
          chatbot_max_requests_auth_per_day: 80,
          chatbot_history_window: 12,
          chatbot_retention_days: 30,
          pwa_app_name: "HomeCare Match",
          pwa_short_name: "HomeCare",
          pwa_description: "Conectando profissionais de saÃºde Ã s melhores oportunidades em Home Care.",
          pwa_theme_color: "#0f172a",
          pwa_background_color: "#ffffff",
          pwa_install_title: "Instale o app HomeCare Match",
          pwa_install_description: "Acesse mais rÃ¡pido pelo seu celular, direto da tela inicial.",
          pwa_assets_json: {},
          pwa_screenshots_json: []
        };
      }

      return data;
    },
    // Reduzido de 5 minutos para 30 segundos para refletir mudanÃ§as de layout mais rÃ¡pido
    staleTime: 1000 * 30,
  });
};

