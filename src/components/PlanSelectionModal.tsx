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
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Check, Loader2, Star, Zap } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

interface PlanSelectionModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const PlanSelectionModal = ({ open, onOpenChange }: PlanSelectionModalProps) => {
  const [loadingPlan, setLoadingPlan] = useState<string | null>(null);

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
  });

  const handleSubscribe = async (planId: string) => {
    setLoadingPlan(planId);
    const toastId = toast.loading("Iniciando checkout...");

    try {
      const { data, error } = await supabase.functions.invoke('create-checkout-session', {
        body: { planId }
      });

      if (error) {
        let errorMessage = "Erro ao iniciar checkout.";
        if (error.context?.json) {
          const body = await error.context.json();
          errorMessage = body.error || errorMessage;
        } else if (error.message) {
          errorMessage = error.message;
        }
        throw new Error(errorMessage);
      }

      if (data?.url) {
        window.location.href = data.url;
      }
    } catch (err: any) {
      console.error("[Checkout Error]", err);
      toast.dismiss(toastId);
      const cleanMessage = err.message?.replace("Edge Function returned a non-2xx status code", "").trim();
      toast.error(cleanMessage || "Falha ao iniciar pagamento.");
    } finally {
      setLoadingPlan(null);
    }
  };

  return (
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

        <div className="p-8">
          {isLoading ? (
            <div className="flex h-40 items-center justify-center">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
          ) : (
            <div className="grid gap-6 md:grid-cols-2">
              {plans?.map((plan) => (
                <div 
                  key={plan.id}
                  className={cn(
                    "relative flex flex-col rounded-2xl border p-6 transition-all",
                    plan.popular 
                      ? "border-primary shadow-lg ring-1 ring-primary/20 bg-primary/5" 
                      : "border-border bg-card hover:border-primary/50"
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
                    {plan.features?.map((feature: string, i: number) => (
                      <li key={i} className="flex items-start gap-2 text-sm text-muted-foreground">
                        <Check className="h-4 w-4 text-success shrink-0 mt-0.5" />
                        <span>{feature}</span>
                      </li>
                    ))}
                  </ul>

                  <Button 
                    className="w-full h-11 font-semibold"
                    variant={plan.popular ? "default" : "outline"}
                    onClick={() => handleSubscribe(plan.id)}
                    disabled={!!loadingPlan}
                  >
                    {loadingPlan === plan.id ? (
                      <Loader2 className="h-4 w-4 animate-spin mr-2" />
                    ) : (
                      "Assinar Agora"
                    )}
                  </Button>
                </div>
              ))}
            </div>
          )}
          
          <p className="mt-6 text-center text-[10px] text-muted-foreground">
            Pagamento processado com segurança via Stripe. Cancele a qualquer momento.
          </p>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default PlanSelectionModal;