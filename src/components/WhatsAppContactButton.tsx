import { MessageCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useSiteConfig } from "@/hooks/use-site-config";
import { cn } from "@/lib/utils";

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
    "Olá! Vim pelo site da HomeCare Match e quero falar com o time comercial para entender como funciona. [origem=global_float]",
  home_hero_profissional:
    "Olá! Sou profissional e quero entender os planos e como aumentar minha visibilidade na HomeCare Match. [origem=home_hero_profissional]",
  empresas_cta:
    "Olá! Sou de uma empresa de Home Care e quero ajuda para encontrar profissionais pela plataforma. [origem=empresas_cta]",
  familias_cta:
    "Olá! Sou familiar e quero ajuda para encontrar um profissional de saúde para atendimento domiciliar. [origem=familias_cta]",
  buscar_top:
    "Olá! Estou na busca de profissionais e quero apoio comercial para encontrar o perfil ideal. [origem=buscar_top]",
  footer_contato:
    "Olá! Quero falar com o time comercial da HomeCare Match. [origem=footer_contato]",
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
      <a href={href} target="_blank" rel="noopener noreferrer" aria-label={finalLabel}>
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
