import { MessageCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useSiteConfig } from "@/hooks/use-site-config";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";

type WhatsAppPlacementId =
  | "global_float"
  | "home_hero_profissional"
  | "empresas_cta"
  | "familias_cta"
  | "buscar_top"
  | "footer_contato";

type WhatsAppContactButtonProps = {
  placementId: WhatsAppPlacementId;
  variant?: "floating" | "inline-primary" | "inline-outline";
  label?: string;
  className?: string;
};

const PLACEMENT_MESSAGES: Record<WhatsAppPlacementId, string> = {
  global_float:
    "Ola! Vim pelo site da HomeCare Match e quero falar com o time comercial para entender como funciona.",
  home_hero_profissional:
    "Ola! Sou profissional e quero entender os planos e como aumentar minha visibilidade na HomeCare Match.",
  empresas_cta:
    "Ola! Sou de uma empresa de Home Care e quero ajuda para encontrar profissionais pela plataforma.",
  familias_cta:
    "Ola! Sou familiar e quero ajuda para encontrar um profissional de saude para atendimento domiciliar.",
  buscar_top:
    "Ola! Estou na busca de profissionais e quero apoio comercial para encontrar o perfil ideal.",
  footer_contato:
    "Ola! Quero falar com o time comercial da HomeCare Match.",
};

const normalizePhone = (value?: string | null) => String(value || "").replace(/\D/g, "");

const buildWaUrl = (phone: string, message: string) => {
  const encoded = encodeURIComponent(message);
  return `https://wa.me/${phone}?text=${encoded}`;
};

const WhatsAppContactButton = ({
  placementId,
  variant = "inline-primary",
  label,
  className,
}: WhatsAppContactButtonProps) => {
  const { data: siteConfig } = useSiteConfig();
  const phone = normalizePhone(siteConfig?.whatsapp_number);
  const message = PLACEMENT_MESSAGES[placementId];

  if (!phone || !message) return null;

  const finalLabel = label || (variant === "inline-primary" ? "Falar com Comercial" : "Falar no WhatsApp");
  const href = buildWaUrl(phone, message);
  const isFloating = variant === "floating";
  const buttonVariant = variant === "inline-outline" ? "outline" : "success";
  const originTag = `[origem=${placementId}]`;

  const handleTrackClick = () => {
    if (typeof window === "undefined") return;

    const pagePath = `${window.location.pathname}${window.location.search}${window.location.hash}`;
    const pageUrl = window.location.href;
    const referrer = document.referrer || null;
    const userAgent = navigator.userAgent || null;

    void supabase
      .rpc("track_whatsapp_commercial_click", {
        p_placement_id: placementId,
        p_origin_tag: originTag,
        p_button_label: finalLabel,
        p_page_path: pagePath,
        p_page_url: pageUrl,
        p_referrer: referrer,
        p_user_agent: userAgent,
        p_whatsapp_number: phone,
      })
      .then(() => undefined)
      .catch(() => undefined);
  };

  const buttonNode = (
    <Button
      asChild
      size={isFloating ? "lg" : "default"}
      variant={buttonVariant}
      className={cn(
        "gap-2",
        isFloating
          ? "h-12 rounded-full px-5 text-sm font-semibold shadow-xl hover:shadow-2xl"
          : "",
        className,
      )}
    >
      <a
        href={href}
        target="_blank"
        rel="noopener noreferrer"
        aria-label={finalLabel}
        onClick={handleTrackClick}
      >
        <MessageCircle className="h-4 w-4" />
        {finalLabel}
      </a>
    </Button>
  );

  if (!isFloating) {
    return buttonNode;
  }

  return (
    <div className="pointer-events-none fixed bottom-24 left-4 z-[170] md:bottom-6 md:left-6">
      <div className="pointer-events-auto">{buttonNode}</div>
    </div>
  );
};

export default WhatsAppContactButton;
