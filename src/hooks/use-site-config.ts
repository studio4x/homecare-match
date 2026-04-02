import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type {
  CrisisProtocolConfig,
  SupportBusinessHoursConfig,
  SupportSlaConfig,
} from "@/lib/support-sla";

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
  free_trial_monthly_upgrade_enabled?: boolean;
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
  support_sla_config?: SupportSlaConfig | null;
  support_business_hours_config?: SupportBusinessHoursConfig | null;
  crisis_protocol_config?: CrisisProtocolConfig | null;
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
  video_url_professionals_mobile?: string | null;
  video_url_companies?: string | null;
  video_url_companies_mobile?: string | null;
  video_url_families?: string | null;
  video_url_families_mobile?: string | null;
  video_url_how_it_works_professionals?: string | null;
  video_url_how_it_works_professionals_mobile?: string | null;
  video_url_how_it_works_companies?: string | null;
  video_url_how_it_works_companies_mobile?: string | null;
  video_url_how_it_works_families?: string | null;
  video_url_how_it_works_families_mobile?: string | null;
  video_url_onboarding?: string | null;
  video_url_onboarding_mobile?: string | null;
  video_url_onboarding_company?: string | null;
  video_url_onboarding_company_mobile?: string | null;
  video_url_onboarding_family?: string | null;
  video_url_onboarding_family_mobile?: string | null;
  video_orientation_professionals?: "auto" | "horizontal" | "vertical" | null;
  video_orientation_companies?: "auto" | "horizontal" | "vertical" | null;
  video_orientation_families?: "auto" | "horizontal" | "vertical" | null;
  video_orientation_how_it_works_professionals?: "auto" | "horizontal" | "vertical" | null;
  video_orientation_how_it_works_companies?: "auto" | "horizontal" | "vertical" | null;
  video_orientation_how_it_works_families?: "auto" | "horizontal" | "vertical" | null;
  video_orientation_onboarding?: "auto" | "horizontal" | "vertical" | null;
  video_orientation_onboarding_company?: "auto" | "horizontal" | "vertical" | null;
  video_orientation_onboarding_family?: "auto" | "horizontal" | "vertical" | null;
  // New storage paths for landing page videos
  video_storage_path_professionals?: string | null;
  video_mime_professionals?: string | null;
  video_storage_path_companies?: string | null;
  video_mime_companies?: string | null;
  video_storage_path_families?: string | null;
  video_mime_families?: string | null;
  video_storage_path_how_it_works_professionals?: string | null;
  video_mime_how_it_works_professionals?: string | null;
  video_storage_path_how_it_works_companies?: string | null;
  video_mime_how_it_works_companies?: string | null;
  video_storage_path_how_it_works_families?: string | null;
  video_mime_how_it_works_families?: string | null;
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
  affiliate_media_kit_config?: {
    title?: string;
    description?: string;
    prompts?: Array<{
      title?: string;
      description?: string;
      copy_label?: string;
      content?: string;
    }>;
    images?: Array<{
      url?: string;
      title?: string;
      caption?: string;
    }>;
  } | null;
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
          free_trial_monthly_upgrade_enabled: true,
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
          chatbot_error_message: "Não consegui responder agora. Tente novamente em instantes ou abra um chamado no suporte.",
          chatbot_max_requests_anon_per_day: 20,
          chatbot_max_requests_auth_per_day: 80,
          chatbot_history_window: 12,
          chatbot_retention_days: 30,
          support_sla_config: {
            categories: [
              { key: "payment", label: "Pagamentos", first_response_hours: 2, position: 1, description: "Primeira resposta em até 2 horas úteis." },
              { key: "technical", label: "Problema técnico", first_response_hours: 24, position: 2, description: "Primeira resposta em até 24 horas úteis." },
              { key: "account", label: "Conta e acesso", first_response_hours: 24, position: 3, description: "Primeira resposta em até 24 horas úteis." },
              { key: "general", label: "Dúvida geral", first_response_hours: 24, position: 4, description: "Primeira resposta em até 24 horas úteis." },
            ],
            public_note: "Os prazos acima se referem ao tempo da primeira resposta humana da equipe. Não representam prazo de resolução final.",
          },
          support_business_hours_config: {
            timezone: "America/Sao_Paulo",
            days_of_week: [1, 2, 3, 4, 5],
            start_hour: 8,
            end_hour: 18,
          },
          crisis_protocol_config: {
            triage_checklist: [
              "Receber o relato e registrar data, hora, IDs envolvidos e canal de entrada.",
              "Classificar a severidade inicial com base em risco à vida, indícios de crime, fraude ou repercussão pública.",
              "Preservar evidências disponíveis antes de qualquer contato externo.",
            ],
            escalation_criteria: [
              "Elevar imediatamente para nível crítico quando houver risco à integridade física, abuso, violência, fraude relevante ou indício criminal.",
              "Escalar para jurídico/compliance quando houver pedido formal, ameaça de litígio, imprensa ou autoridade pública.",
            ],
            evidence_preservation: [
              "Preservar tickets, mensagens, anexos, denúncias, logs administrativos e notificações relacionadas.",
              "Evitar exclusão ou alteração de registros até a conclusão da triagem.",
            ],
            safety_hold_flow: [
              "Aplicar suspensão cautelar manual quando a triagem indicar risco atual para usuários ou para a plataforma.",
              "Registrar motivo, responsável e data da medida no perfil e na denúncia.",
            ],
            complainant_communication: [
              "Confirmar recebimento do relato com linguagem objetiva e sem prometer conclusão antecipada.",
              "Informar que a plataforma pode solicitar evidências adicionais e que medidas internas poderão ser adotadas.",
            ],
            media_holding_statement:
              "Estamos apurando os fatos com prioridade, preservando os registros relevantes e colaborando com as autoridades competentes quando aplicável.",
            contacts: [
              { role: "Operacao", name: "", email: "", phone: "" },
              { role: "Juridico/Compliance", name: "", email: "", phone: "" },
              { role: "Porta-voz", name: "", email: "", phone: "" },
            ],
          },
          pwa_app_name: "HomeCare Match",
          pwa_short_name: "HomeCare",
          pwa_description: "Conectando profissionais de saude as melhores oportunidades em Home Care.",
          pwa_theme_color: "#0f172a",
          pwa_background_color: "#ffffff",
          pwa_install_title: "Instale o app HomeCare Match",
          pwa_install_description: "Acesse mais rapido pelo seu celular, direto da tela inicial.",
          pwa_assets_json: {},
          pwa_screenshots_json: [],
          affiliate_media_kit_config: {
            title: "Kit de midia",
            description: "Materiais prontos para divulgar seu link de afiliado e apresentar a plataforma para empresas.",
            prompts: [
              {
                title: "Mensagem para WhatsApp",
                description: "Texto pronto para compartilhar com contatos e grupos qualificados.",
                copy_label: "Copiar mensagem",
                content:
                  "Estou divulgando a HomeCare Match, uma plataforma que aproxima profissionais e oportunidades no setor de cuidados. Se fizer sentido para voce, esse e meu link oficial: {{affiliate_link}}",
              },
              {
                title: "Pitch para empresas",
                description: "Convite rapido para empresas conhecerem a pagina institucional.",
                copy_label: "Copiar pitch",
                content:
                  "Quero te apresentar a HomeCare Match. A plataforma ajuda empresas a encontrar profissionais com mais agilidade. Conheca a pagina para empresas: {{company_page_link}}",
              },
              {
                title: "Legenda para redes sociais",
                description: "CTA curto para post, story ou bio com link.",
                copy_label: "Copiar legenda",
                content:
                  "Profissionais e empresas de Home Care em um so lugar. Conheca a HomeCare Match pelo meu link oficial: {{affiliate_link}}",
              },
            ],
            images: [],
          },
        };
      }

      return data;
    },
    // Reduzido de 5 minutos para 30 segundos para refletir mudancas de layout mais rapido
    staleTime: 1000 * 30,
  });
};
