"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Check, Loader2, X, Zap, Ticket } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { useAuth } from "@/components/auth/AuthProvider";
import { createCheckoutSession } from "@/lib/checkout";

interface PlanSelectionModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  showCoupon?: boolean;
}

const PlanSelectionModal = ({ open, onOpenChange, showCoupon = true }: PlanSelectionModalProps) => {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [loadingPlan, setLoadingPlan] = useState<string | null>(null);
  const [couponCode, setCouponCode] = useState("");
  const [isApplyingCoupon, setIsApplyingCoupon] = useState(false);
  const [activePlanIndex, setActivePlanIndex] = useState(0);
  const mobileCarouselRef = useRef<HTMLDivElement | null>(null);

  const { data: profile } = useQuery({
    queryKey: ["user-profile-tier-modal", user?.id],
    queryFn: async () => {
      if (!user) return null;
      const { data } = await supabase
        .from("profiles")
        .select("subscription_tier")
        .eq("id", user.id)
        .single();
      return data;
    },
    enabled: !!user && open,
  });

  const userTier = profile?.subscription_tier || null;

  const { data: plans, isLoading } = useQuery({
    queryKey: ["plans-selection"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("plans")
        .select("*")
        .order("price", { ascending: true });
      if (error) throw error;
      return data || [];
    },
    enabled: open,
  });

  const paidPlans = useMemo(() => (plans || []).filter((p) => p.id !== "free_trial"), [plans]);

  useEffect(() => {
    setActivePlanIndex(0);
    if (!open) return;

    const element = mobileCarouselRef.current;
    if (element) element.scrollTo({ left: 0, behavior: "auto" });
  }, [open, paidPlans.length]);

  useEffect(() => {
    const element = mobileCarouselRef.current;
    if (!element || paidPlans.length <= 1) return;

    const onScroll = () => {
      const card = element.querySelector<HTMLElement>("[data-plan-card='true']");
      if (!card) return;

      const cardWidthWithGap = card.offsetWidth + 16;
      if (!cardWidthWithGap) return;

      const index = Math.round(element.scrollLeft / cardWidthWithGap);
      const safeIndex = Math.max(0, Math.min(index, paidPlans.length - 1));
      setActivePlanIndex(safeIndex);
    };

    element.addEventListener("scroll", onScroll, { passive: true });
    return () => element.removeEventListener("scroll", onScroll);
  }, [paidPlans.length]);

  const handleSubscribe = async (plan: any) => {
    setLoadingPlan(plan.id);
    const toastId = toast.loading("Iniciando checkout...");

    try {
      const data = await createCheckoutSession({ planId: plan.id });

      if (data?.url) {
        window.location.href = data.url;
        return;
      }

      throw new Error("URL de checkout nao retornada pelo servidor.");
    } catch (err: any) {
      console.error("[Checkout Error]", err);
      toast.dismiss(toastId);
      const cleanMessage = err.message?.replace("Edge Function returned a non-2xx status code", "").trim();
      toast.error(cleanMessage || "Falha ao iniciar pagamento.");
    } finally {
      setLoadingPlan(null);
    }
  };

  const handleApplyCoupon = async () => {
    if (!couponCode.trim()) return;

    setIsApplyingCoupon(true);
    const toastId = toast.loading("Validando cupom...");

    try {
      const { data, error } = await supabase.functions.invoke("apply-coupon", {
        body: { code: couponCode },
      });

      if (error) {
        let msg = "Erro ao aplicar cupom.";
        try {
          const body = await error.context?.json();
          if (body?.error) msg = body.error;
        } catch {}
        throw new Error(msg);
      }

      toast.success(data.message, { id: toastId });
      setCouponCode("");
      queryClient.invalidateQueries({ queryKey: ["user-profile-tier-modal"] });
      onOpenChange(false);

      setTimeout(() => window.location.reload(), 1500);
    } catch (err: any) {
      toast.error(err.message || "Cupom invalido.", { id: toastId });
    } finally {
      setIsApplyingCoupon(false);
    }
  };

  const getPlanButtonConfig = (planId: string) => {
    if (!userTier) return { text: "Assinar Agora", disabled: false };

    if (userTier === planId) {
      return { text: "Seu Plano Atual", disabled: true };
    }

    if (userTier === "yearly") {
      return { text: "Plano Inferior", disabled: true };
    }

    if (userTier === "monthly") {
      if (planId === "yearly") return { text: "Fazer Upgrade", disabled: false };
      return { text: "Plano Inferior", disabled: true };
    }

    if (userTier === "free_trial") {
      if (planId === "free_trial") return { text: "Seu Plano Atual", disabled: true };
      return { text: "Assinar Agora", disabled: false };
    }

    return { text: "Assinar Agora", disabled: false };
  };

  const scrollToPlan = (index: number) => {
    const element = mobileCarouselRef.current;
    if (!element) return;

    const cards = element.querySelectorAll<HTMLElement>("[data-plan-card='true']");
    const target = cards[index];
    if (!target) return;

    target.scrollIntoView({ behavior: "smooth", inline: "center", block: "nearest" });
    setActivePlanIndex(index);
  };

  const renderPlanCard = (plan: any) => {
    const features = [...(plan.features || [])];
    if (plan.id === "yearly" && !features.some((f: string) => f.toLowerCase().includes("academy"))) {
      features.push("Acesso gratuito aos cursos da Academy");
    }

    const btnConfig = getPlanButtonConfig(plan.id);

    return (
      <div
        key={plan.id}
        data-plan-card="true"
        className={cn(
          "relative flex flex-col rounded-2xl border p-5 pt-8 transition-all sm:p-6",
          plan.popular
            ? "border-primary bg-primary/5 shadow-lg ring-1 ring-primary/20"
            : "border-border bg-card hover:border-primary/50",
          btnConfig.disabled && "opacity-70 grayscale-[0.3]"
        )}
      >
        {plan.popular && (
          <span className="absolute left-1/2 top-2 -translate-x-1/2 rounded-full bg-primary px-3 py-1 text-[10px] font-bold uppercase tracking-wider text-white">
            Mais Popular
          </span>
        )}

        <div className="mb-4">
          <h3 className="text-lg font-bold">{plan.name}</h3>
          <div className="mt-2 flex items-baseline gap-1">
            <span className="text-3xl font-bold">{plan.price}</span>
            <span className="text-sm text-muted-foreground">/{plan.period}</span>
          </div>
        </div>

        <ul className="mb-8 flex-1 space-y-3">
          {features.map((feature: string, i: number) => (
            <li key={i} className="flex items-start gap-2 text-sm text-muted-foreground">
              <Check className="mt-0.5 h-4 w-4 shrink-0 text-success" />
              <span>{feature}</span>
            </li>
          ))}
        </ul>

        <Button
          className={cn(
            "h-11 w-full font-semibold",
            btnConfig.disabled && "cursor-default bg-muted text-muted-foreground hover:bg-muted"
          )}
          variant={plan.popular && !btnConfig.disabled ? "default" : "outline"}
          onClick={() => !btnConfig.disabled && handleSubscribe(plan)}
          disabled={!!loadingPlan || btnConfig.disabled}
        >
          {loadingPlan === plan.id ? (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          ) : (
            btnConfig.text
          )}
        </Button>
      </div>
    );
  };

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="flex h-[calc(100svh-1rem)] max-h-[calc(100svh-1rem)] w-[calc(100vw-1rem)] flex-col gap-0 overflow-hidden border-none p-0 shadow-2xl sm:h-auto sm:max-h-[90vh] sm:w-full sm:max-w-[700px] [&>button.absolute.right-4.top-4]:hidden">
          <DialogHeader className="shrink-0 bg-primary p-4 text-primary-foreground sm:p-8">
            <div className="mb-2 flex items-start justify-between gap-3">
              <div className="flex items-center gap-3">
                <Zap className="h-6 w-6 fill-current" />
                <DialogTitle className="text-2xl font-bold">Escolha seu Plano</DialogTitle>
              </div>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="h-8 w-8 shrink-0 text-primary-foreground/90 hover:bg-primary-foreground/15 hover:text-primary-foreground"
                onClick={() => onOpenChange(false)}
                aria-label="Fechar modal de planos"
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
            <DialogDescription className="hidden text-base text-primary-foreground/80 sm:block">
              Torne seu perfil visivel para centenas de empresas e receba propostas direto no WhatsApp.
            </DialogDescription>
          </DialogHeader>

          <div className="min-h-0 flex-1 space-y-5 overflow-y-auto p-4 sm:space-y-8 sm:p-8">
            {showCoupon && (
              <div className="rounded-2xl border border-dashed border-primary/20 bg-secondary/30 p-4">
                <div className="mb-3 flex items-center gap-2">
                  <Ticket className="h-4 w-4 text-primary" />
                  <span className="text-sm font-bold uppercase tracking-wider">Possui um cupom de lancamento?</span>
                </div>
                <div className="flex gap-2">
                  <Input
                    placeholder="Digite o codigo aqui..."
                    className="bg-white font-mono uppercase"
                    value={couponCode}
                    onChange={(e) => setCouponCode(e.target.value.toUpperCase())}
                    disabled={isApplyingCoupon}
                  />
                  <Button
                    onClick={handleApplyCoupon}
                    disabled={isApplyingCoupon || !couponCode.trim()}
                    className="gap-2"
                  >
                    {isApplyingCoupon ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
                    Aplicar
                  </Button>
                </div>
              </div>
            )}

            {isLoading ? (
              <div className="flex h-40 items-center justify-center">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
              </div>
            ) : (
              <>
                <div
                  ref={mobileCarouselRef}
                  className="flex snap-x snap-mandatory gap-4 overflow-x-auto pb-2 md:hidden [&::-webkit-scrollbar]:hidden"
                  style={{ scrollbarWidth: "none" }}
                >
                  {paidPlans.map((plan) => (
                    <div key={plan.id} className="min-w-0 w-[82vw] max-w-[20rem] shrink-0 snap-center">
                      {renderPlanCard(plan)}
                    </div>
                  ))}
                </div>

                {paidPlans.length > 1 && (
                  <div className="flex items-center justify-center gap-2 md:hidden">
                    {paidPlans.map((plan, index) => (
                      <button
                        key={`dot-${plan.id}`}
                        type="button"
                        aria-label={`Ir para ${plan.name}`}
                        onClick={() => scrollToPlan(index)}
                        className={cn(
                          "h-2.5 rounded-full transition-all",
                          activePlanIndex === index ? "w-6 bg-primary" : "w-2.5 bg-border"
                        )}
                      />
                    ))}
                  </div>
                )}

                <div className="hidden gap-6 md:grid md:grid-cols-2">
                  {paidPlans.map((plan) => renderPlanCard(plan))}
                </div>
              </>
            )}


            <p className="hidden text-center text-[10px] text-muted-foreground sm:block">
              Pagamento processado com seguranca via Asaas.
            </p>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
};

export default PlanSelectionModal;

