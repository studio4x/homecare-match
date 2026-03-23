import { useState } from "react";
import { Copy, Check, Ticket, Tag } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import type { PublicHighlightedCoupon } from "@/hooks/use-public-highlighted-coupon";

// ── Fallback texts ──────────────────────────────────────────────────────────

const COUPON_FIELD_DEFAULTS = {
  badge: "Pré-lançamento",
  title: "Ganhe 30 dias grátis no plano mensal",
  description:
    "Estamos em campanha de pré-lançamento. Novos profissionais podem utilizar este cupom por tempo limitado para começar com 30 dias gratuitos no plano mensal.",
};

const MONTHLY_CARD_DEFAULTS = {
  badge: "Campanha por tempo limitado",
  title: "Aproveite o pré-lançamento e ganhe 30 dias grátis",
  description:
    "Use o cupom abaixo no momento da assinatura do plano mensal. Condição válida por tempo limitado para novos cadastros de profissionais.",
};

// ── Types ───────────────────────────────────────────────────────────────────

interface PublicCouponBannerProps {
  /** The highlighted coupon returned by usePublicHighlightedCoupon. null = render nothing. */
  coupon: PublicHighlightedCoupon | null | undefined;
  /** Called when the user clicks "Usar este cupom" */
  onUseCoupon: (code: string) => void;
  /** Visual variant: shown above the coupon field (default) or inside the monthly plan card */
  variant?: "coupon-field" | "monthly-card";
}

// ── Component ───────────────────────────────────────────────────────────────

const PublicCouponBanner = ({
  coupon,
  onUseCoupon,
  variant = "coupon-field",
}: PublicCouponBannerProps) => {
  const [copied, setCopied] = useState(false);

  if (!coupon) return null;

  const defaults =
    variant === "monthly-card" ? MONTHLY_CARD_DEFAULTS : COUPON_FIELD_DEFAULTS;

  const badge = coupon.campaign_badge || defaults.badge;
  const title = coupon.public_title || defaults.title;
  const description = coupon.public_description || defaults.description;

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(coupon.code);
      setCopied(true);
      toast.success("Código copiado!");
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error("Não foi possível copiar. Copie manualmente: " + coupon.code);
    }
  };

  // ── Coupon-field variant ─────────────────────────────────────────────────
  if (variant === "coupon-field") {
    return (
      <div className="rounded-2xl border border-primary/30 bg-primary/5 p-4 space-y-3">
        {/* Header */}
        <div className="flex items-start gap-2">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary/10">
            <Ticket className="h-4 w-4 text-primary" />
          </div>
          <div className="min-w-0">
            <div className="mb-1">
              <Badge className="bg-primary/15 text-primary border-primary/20 hover:bg-primary/20 text-[10px] font-bold uppercase tracking-wider">
                <Tag className="mr-1 h-2.5 w-2.5" />
                {badge}
              </Badge>
            </div>
            <p className="text-sm font-bold leading-snug">{title}</p>
            <p className="mt-1 text-xs text-muted-foreground leading-relaxed">
              {description}
            </p>
          </div>
        </div>

        {/* Code + actions */}
        <div className="flex flex-wrap items-center gap-3">
          <code className="flex-1 min-w-[140px] rounded-lg border border-primary/30 bg-white px-3 py-2 text-center font-mono text-lg font-bold tracking-widest text-primary shadow-sm hover:border-primary/50 transition-colors">
            {coupon.code}
          </code>
          <div className="flex flex-wrap items-center gap-2 w-full xs:w-auto">
            <Button
              type="button"
              size="sm"
              variant="outline"
              className="flex-1 xs:flex-none gap-1.5 h-10 border-primary/30 hover:bg-primary/5"
              onClick={handleCopy}
            >
              {copied ? (
                <Check className="h-3.5 w-3.5 text-success" />
              ) : (
                <Copy className="h-3.5 w-3.5" />
              )}
              {copied ? "Copiado!" : "Copiar"}
            </Button>
            <Button
              type="button"
              size="sm"
              className="flex-1 xs:flex-none gap-1.5 h-10 shadow-sm"
              onClick={() => onUseCoupon(coupon.code)}
            >
              <Ticket className="h-3.5 w-3.5" />
              Usar este cupom
            </Button>
          </div>
        </div>
      </div>
    );
  }

  // ── Monthly-card variant ─────────────────────────────────────────────────
  return (
    <div className="mt-4 rounded-xl border border-primary/25 bg-primary/5 p-3 space-y-2">
      <div className="flex items-center gap-1.5">
        <Badge className="bg-primary/15 text-primary border-primary/20 hover:bg-primary/20 text-[10px] font-bold uppercase tracking-wider">
          <Tag className="mr-1 h-2.5 w-2.5" />
          {badge}
        </Badge>
      </div>
      <p className="text-xs font-bold leading-snug">{title}</p>
      <p className="text-[11px] text-muted-foreground leading-relaxed">
        {description}
      </p>
      <div className="flex items-center gap-2 pt-0.5">
        <code className="flex-1 rounded-lg border border-primary/30 bg-white px-2 py-1 text-center font-mono text-sm font-bold tracking-widest text-primary">
          {coupon.code}
        </code>
        <Button
          type="button"
          size="sm"
          variant="outline"
          className="shrink-0 gap-1.5 text-xs"
          onClick={handleCopy}
        >
          {copied ? (
            <Check className="h-3 w-3 text-success" />
          ) : (
            <Copy className="h-3 w-3" />
          )}
          {copied ? "Copiado!" : "Copiar cupom"}
        </Button>
      </div>
    </div>
  );
};

export default PublicCouponBanner;
