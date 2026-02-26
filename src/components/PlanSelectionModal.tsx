"use client";

import React, { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Check, Loader2, Star, Zap, Ticket, ArrowRight } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { useAuth } from "@/components/auth/AuthProvider";
import { createCheckoutSession } from "@/lib/checkout";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

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
  const [installmentPlan, setInstallmentPlan] = useState<any | null>(null);
  const [installmentCount, setInstallmentCount] = useState(1);

  const { data: profile } = useQuery({
    queryKey: ["user-profile-tier-modal", user?.id],
    queryFn: async () => {
      if (!user) return null;
      const { data } = await supabase.from('profiles').select('subscription_tier').eq('id', user.id).single();
      return data;
    },
    enabled: !!user && open
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
    enabled: open
  });

  const handleSubscribe = async (plan: any) => {
    if (plan?.id === "yearly") {
      const maxInstallments = Math.max(1, Math.min(Number(plan?.asaas_installment_max || 12), 12));
      setInstallmentCount(maxInstallments);
      setInstallmentPlan(plan);
      return;
    }

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

  const handleConfirmInstallments = async () => {
    if (!installmentPlan) return;
    setLoadingPlan(installmentPlan.id);
    const toastId = toast.loading("Iniciando checkout...");

    try {
      const data = await createCheckoutSession({
        planId: installmentPlan.id,
        installmentCount,
      });

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
      setInstallmentPlan(null);
    }
  };

  const handleApplyCoupon = async () => {
    if (!couponCode.trim()) return;
    
    setIsApplyingCoupon(true);
    const toastId = toast.loading("Validando cupom...");
    
    try {
      const { data, error } = await supabase.functions.invoke('apply-coupon', {
        body: { code: couponCode }
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
      
      // Recarrega a página para atualizar o estado global do dashboard
      setTimeout(() => window.location.reload(), 1500);
      
    } catch (err: any) {
      toast.error(err.message || "Cupom inválido.", { id: toastId });
    } finally {
      setIsApplyingCoupon(false);
    }
  };

  const getPlanButtonConfig = (planId: string) => {
    if (!userTier) return { text: "Assinar Agora", disabled: false };

    if (userTier === planId) {
      return { text: "Seu Plano Atual", disabled: true };
    }

    if (userTier === 'yearly') {
      return { text: "Plano Inferior", disabled: true };
    }

    if (userTier === 'monthly') {
      if (planId === 'yearly') return { text: "Fazer Upgrade", disabled: false };
      return { text: "Plano Inferior", disabled: true };
    }

    if (userTier === 'free_trial') {
      if (planId === 'free_trial') return { text: "Seu Plano Atual", disabled: true };
      return { text: "Assinar Agora", disabled: false };
    }

    return { text: "Assinar Agora", disabled: false };
  };

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[700px] p-0 overflow-hidden border-none shadow-2xl">
        <DialogHeader className="p-8 bg-primary text-primary-foreground">
          <div className="flex items-center gap-3 mb-2">
            <Zap className="h-6 w-6 fill-current" />
            <DialogTitle className="text-2xl font-bold">Escolha seu Plano</DialogTitle>
          </div>
          <DialogDescription className="text-primary-foreground/80 text-base">
            Torne seu perfil visível para centenas de empresas e receba propostas direto no WhatsApp.
          </DialogDescription>
        </DialogHeader>

        <div className="p-8 space-y-8">
          {/* Seção de Cupom - Oculta se showCoupon for false */}
          {showCoupon && (
            <div className="bg-secondary/30 p-4 rounded-2xl border border-dashed border-primary/20">
              <div className="flex items-center gap-2 mb-3">
                <Ticket className="h-4 w-4 text-primary" />
                <span className="text-sm font-bold uppercase tracking-wider">Possui um cupom de lançamento?</span>
              </div>
              <div className="flex gap-2">
                <Input 
                  placeholder="Digite o código aqui..." 
                  className="bg-white uppercase font-mono"
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
            <div className="grid gap-6 md:grid-cols-2">
              {plans?.filter(p => p.id !== 'free_trial').map((plan) => {
                const features = [...(plan.features || [])];
                if (plan.id === 'yearly' && !features.some(f => f.toLowerCase().includes('academy'))) {
                  features.push("Acesso gratuito aos cursos da Academy");
                }

                const btnConfig = getPlanButtonConfig(plan.id);

                return (
                  <div 
                    key={plan.id}
                    className={cn(
                      "relative flex flex-col rounded-2xl border p-6 transition-all",
                      plan.popular 
                        ? "border-primary shadow-lg ring-1 ring-primary/20 bg-primary/5" 
                        : "border-border bg-card hover:border-primary/50",
                      btnConfig.disabled && "opacity-70 grayscale-[0.3]"
                    )}
                  >
                    {plan.popular && (
                      <span className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-primary px-3 py-1 text-[10px] font-bold uppercase tracking-wider text-white">
                        Mais Popular
                      </span>
                    )}

                    <div className="mb-4">
                      <h3 className="font-bold text-lg">{plan.name}</h3>
                      <div className="mt-2 flex items-baseline gap-1">
                        <span className="text-3xl font-bold">{plan.price}</span>
                        <span className="text-sm text-muted-foreground">/{plan.period}</span>
                      </div>
                    </div>

                    <ul className="mb-8 space-y-3 flex-1">
                      {features.map((feature: string, i: number) => (
                        <li key={i} className="flex items-start gap-2 text-sm text-muted-foreground">
                          <Check className="h-4 w-4 text-success shrink-0 mt-0.5" />
                          <span>{feature}</span>
                        </li>
                      ))}
                    </ul>

                    <Button 
                      className={cn(
                        "w-full h-11 font-semibold",
                        btnConfig.disabled && "bg-muted text-muted-foreground hover:bg-muted cursor-default"
                      )}
                      variant={plan.popular && !btnConfig.disabled ? "default" : "outline"}
                      onClick={() => !btnConfig.disabled && handleSubscribe(plan)}
                      disabled={!!loadingPlan || btnConfig.disabled}
                    >
                      {loadingPlan === plan.id ? (
                        <Loader2 className="h-4 w-4 animate-spin mr-2" />
                      ) : (
                        btnConfig.text
                      )}
                    </Button>
                  </div>
                );
              })}
            </div>
          )}

          <div className="rounded-xl border bg-secondary/20 p-3 text-xs text-muted-foreground space-y-1">
            <p><strong>Plano Mensal:</strong> renovacao automatica mensal no cartao.</p>
            <p><strong>Plano Anual:</strong> renovacao manual com opcao de parcelamento em ate 12x.</p>
          </div>
          
          <p className="text-center text-[10px] text-muted-foreground">
            Pagamento processado com seguranca via Asaas.
          </p>
        </div>
      </DialogContent>
      </Dialog>

      <Dialog open={!!installmentPlan} onOpenChange={(open) => !open && setInstallmentPlan(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Escolha o parcelamento</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="rounded-lg border bg-secondary/30 p-3 text-sm">
              <p className="font-semibold">{installmentPlan?.name || "Plano Anual"}</p>
              <p className="text-xs text-muted-foreground">
                Valor total: {installmentPlan?.price || "R$ 0,00"}
              </p>
            </div>
            <div className="space-y-2">
              <Label>Numero de parcelas</Label>
              <Select value={String(installmentCount)} onValueChange={(v) => setInstallmentCount(Number(v))}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione" />
                </SelectTrigger>
                <SelectContent>
                  {Array.from(
                    { length: Math.max(1, Math.min(Number(installmentPlan?.asaas_installment_max || 12), 12)) },
                    (_, idx) => idx + 1,
                  ).map((value) => (
                    <SelectItem key={value} value={String(value)}>
                      {value}x
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex gap-2">
              <Button
                variant="outline"
                className="flex-1"
                onClick={() => setInstallmentPlan(null)}
                disabled={!!loadingPlan}
              >
                Voltar
              </Button>
              <Button className="flex-1" onClick={handleConfirmInstallments} disabled={!!loadingPlan}>
                {loadingPlan === installmentPlan?.id ? <Loader2 className="h-4 w-4 animate-spin" /> : "Continuar"}
              </Button>
            </div>
            <p className="text-[10px] text-muted-foreground">
              O pagamento parcelado aparece no Asaas como parcelas mensais.
            </p>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
};

export default PlanSelectionModal;

