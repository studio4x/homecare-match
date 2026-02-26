import { useEffect, useMemo, useState } from "react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";
import { Loader2, Ticket } from "lucide-react";
import { toast } from "sonner";

type SubscriptionPlanId = "monthly" | "yearly";

interface SubscriptionCouponModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  planId: SubscriptionPlanId | null;
  onProceedToCheckout: (planId: SubscriptionPlanId) => Promise<void>;
}

const PLAN_LABELS: Record<SubscriptionPlanId, string> = {
  monthly: "Plano Mensal",
  yearly: "Plano Anual",
};

const SubscriptionCouponModal = ({
  open,
  onOpenChange,
  planId,
  onProceedToCheckout,
}: SubscriptionCouponModalProps) => {
  const [couponCode, setCouponCode] = useState("");
  const [isApplyingCoupon, setIsApplyingCoupon] = useState(false);
  const [isProceeding, setIsProceeding] = useState(false);

  const planLabel = useMemo(() => (planId ? PLAN_LABELS[planId] : "assinatura"), [planId]);

  useEffect(() => {
    if (!open) {
      setCouponCode("");
      setIsApplyingCoupon(false);
      setIsProceeding(false);
    }
  }, [open]);

  const handleApplyCoupon = async () => {
    const code = couponCode.trim().toUpperCase();
    if (!code) return;

    setIsApplyingCoupon(true);
    const toastId = toast.loading("Validando cupom...");

    try {
      const { data, error } = await supabase.functions.invoke("apply-coupon", {
        body: { code },
      });

      if (error) {
        let message = "Erro ao aplicar cupom.";
        try {
          const body = await error.context?.json();
          if (body?.error) message = body.error;
        } catch {
          // keep fallback
        }
        throw new Error(message);
      }

      toast.success(data?.message || "Cupom aplicado com sucesso.", { id: toastId });
      onOpenChange(false);
      setTimeout(() => window.location.reload(), 1200);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Cupom invalido.";
      toast.error(message, { id: toastId });
    } finally {
      setIsApplyingCoupon(false);
    }
  };

  const handleProceedToCheckout = async () => {
    if (!planId) return;
    setIsProceeding(true);
    try {
      await onProceedToCheckout(planId);
    } finally {
      setIsProceeding(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[520px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Ticket className="h-5 w-5 text-primary" />
            Possui cupom promocional?
          </DialogTitle>
          <DialogDescription>
            Antes de seguir para o checkout do {planLabel}, voce pode aplicar seu cupom.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          <Input
            placeholder="Digite seu codigo"
            value={couponCode}
            onChange={(event) => setCouponCode(event.target.value.toUpperCase())}
            disabled={isApplyingCoupon || isProceeding}
            className="uppercase"
          />
          <p className="text-xs text-muted-foreground">
            Se o cupom for valido, o beneficio sera aplicado imediatamente.
          </p>
        </div>

        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <Button
            variant="outline"
            onClick={handleProceedToCheckout}
            disabled={isApplyingCoupon || isProceeding}
          >
            {isProceeding ? <Loader2 className="h-4 w-4 animate-spin" /> : "Ir para checkout"}
          </Button>
          <Button
            onClick={handleApplyCoupon}
            disabled={isApplyingCoupon || isProceeding || !couponCode.trim()}
          >
            {isApplyingCoupon ? <Loader2 className="h-4 w-4 animate-spin" /> : "Aplicar cupom"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default SubscriptionCouponModal;
