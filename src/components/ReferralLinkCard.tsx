"use client";

import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Copy, Share2, CheckCircle, Circle, MessageSquare, Loader2, AlertTriangle } from "lucide-react";
import { useAuth } from "@/components/auth/AuthProvider";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useEffect, useMemo, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

interface ReferralStats {
  count: number;
  currentTier?: { badge_label?: string; threshold?: number } | null;
  nextTier?: { badge_label?: string; threshold?: number } | null;
  rewardProgram?: {
    milestone_every?: number;
    reward_days?: number;
    target_tier?: string;
    missing_to_next?: number;
    granted?: Array<{
      coupon_code?: string | null;
      free_days?: number;
      target_tier?: string;
    }>;
  } | null;
}

interface ReferralLinkCardProps {
  stats: ReferralStats | null;
  loadingStats: boolean;
  onRefreshStats?: () => Promise<void> | void;
}

const DEFAULT_TIERS = [
  { name: "Promotor", threshold: 3, badge_label: "Promotor" },
  { name: "Colaborador", threshold: 5, badge_label: "Colaborador" },
  { name: "Embaixador", threshold: 10, badge_label: "Embaixador" },
  { name: "Referência", threshold: 20, badge_label: "Referência" },
  { name: "Sênior", threshold: 35, badge_label: "Sênior" },
  { name: "Elite", threshold: 50, badge_label: "Elite" },
];

const ReferralLinkCard = ({ stats, loadingStats, onRefreshStats }: ReferralLinkCardProps) => {
  const { user } = useAuth();
  const [tiers, setTiers] = useState<any[]>([]);
  const [tiersOpen, setTiersOpen] = useState(false);
  const [referralName, setReferralName] = useState("");
  const [referralPhone, setReferralPhone] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (!user) return null;

  const referralLink = `${window.location.origin}/convite?ref=${user.id}`;

  useEffect(() => {
    const fetchTiers = async () => {
      const { data, error } = await supabase.functions.invoke("referral-config", {
        body: { action: "get" },
      });

      if (!error && data?.tiers && Array.isArray(data.tiers) && data.tiers.length > 0) {
        setTiers(data.tiers);
      } else {
        setTiers(DEFAULT_TIERS);
      }
    };

    fetchTiers();
  }, []);

  const safeStats = stats ?? { count: 0, currentTier: null, nextTier: null, rewardProgram: null };
  const rewardMilestone = Number(safeStats.rewardProgram?.milestone_every || 10);
  const rewardDays = Number(safeStats.rewardProgram?.reward_days || 7);
  const missingToReward = Number(
    safeStats.rewardProgram?.missing_to_next ?? Math.max(0, rewardMilestone - (safeStats.count ?? 0)),
  );
  const rewardCoupons = Array.isArray(safeStats.rewardProgram?.granted) ? safeStats.rewardProgram?.granted || [] : [];

  const remainingToNext = useMemo(() => {
    if (!safeStats.nextTier) return null;
    return Math.max(0, (safeStats.nextTier.threshold ?? 0) - (safeStats.count ?? 0));
  }, [safeStats.count, safeStats.nextTier]);

  const copyLink = async () => {
    await navigator.clipboard.writeText(referralLink);
    toast.success("Link de indicação copiado!");
  };

  const shareLink = async () => {
    if (navigator.share) {
      await navigator.share({
        title: "HomeCare Match",
        text: "Cadastre-se na plataforma pelo meu link:",
        url: referralLink,
      });
    } else {
      await copyLink();
    }
  };

  const handleWhatsAppShare = () => {
    const fullName = user.user_metadata.full_name || "um profissional";
    const message = encodeURIComponent(
      `Olá! Sou ${fullName} e estou te indicando para a HomeCare Match, a plataforma que conecta profissionais de saúde a famílias e empresas. Cadastre-se pelo meu link para começar: ${referralLink}`,
    );
    const whatsappUrl = `https://wa.me/?text=${message}`;
    window.open(whatsappUrl, "_blank");
  };

  const handleReferralSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!referralPhone) {
      toast.error("O número de WhatsApp é obrigatório.");
      return;
    }

    setIsSubmitting(true);

    const cleanPhone = referralPhone.replace(/\D/g, "");
    if (cleanPhone.length < 10) {
      toast.error("Número de WhatsApp inválido. Inclua DDD.");
      setIsSubmitting(false);
      return;
    }

    try {
      const { error } = await supabase.from("referrals").insert({
        referrer_id: user.id,
        referred_name: referralName || null,
        referred_phone: cleanPhone,
        status: "pending",
      });

      if (error) throw error;

      await supabase.from("admin_notifications").insert({
        title: "Nova Indicação Manual",
        content: `${user.user_metadata.full_name || "Um usuário"} indicou o profissional: ${referralName || cleanPhone}`,
        link: "/admin/indicacoes",
        type: "info",
      });

      toast.success("Indicação enviada com sucesso! Nossa equipe entrará em contato.");
      setReferralName("");
      setReferralPhone("");
      await onRefreshStats?.();
    } catch (error) {
      console.error("Erro ao enviar indicação:", error);
      toast.error("Erro ao enviar indicação. Tente novamente.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <>
      <Card className="shadow-card">
        <CardContent className="space-y-6 pt-6">
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Indique profissionais e ganhe destaque no ranking. A cada {rewardMilestone} indicações válidas você
              recebe {rewardDays} dias de crédito no plano mensal via cupom.
            </p>
            <div className="rounded-lg border border-amber-200 bg-amber-50 p-3">
              <div className="flex items-start gap-2">
                <AlertTriangle className="mt-0.5 h-4 w-4 text-amber-600" />
                <div className="space-y-1">
                  <p className="text-xs font-semibold text-amber-800">Regra de validação da indicação</p>
                  <p className="text-xs text-amber-700">
                    A indicação só conta como válida quando o indicado chega na etapa final: <strong>Validou documentos</strong>.
                  </p>
                </div>
              </div>
            </div>

            <div className="space-y-3 rounded-lg border bg-secondary/50 p-4">
              <div className="flex items-center justify-center">
                <span
                  className={cn(
                    "rounded-full px-3 py-1 text-sm font-semibold",
                    safeStats.currentTier ? "bg-primary/10 text-primary" : "bg-muted-foreground/10 text-muted-foreground",
                  )}
                >
                  {safeStats.currentTier?.badge_label || "Nível Inicial"}
                </span>
              </div>
              <div className="grid grid-cols-2 gap-4 text-center text-xs">
                <div className="space-y-1">
                  <p className="text-xl font-semibold text-foreground">{loadingStats ? "..." : safeStats.count}</p>
                  <p className="text-muted-foreground">Indicações Válidas</p>
                </div>
                <div className="space-y-1">
                  <p className="text-xl font-semibold text-foreground">
                    {loadingStats ? "..." : safeStats.nextTier ? remainingToNext : "-"}
                  </p>
                  <p className="text-muted-foreground">Faltam para o próximo selo</p>
                </div>
              </div>
            </div>

            <div className="space-y-2 rounded-lg border border-primary/20 bg-primary/5 p-3">
              <p className="text-xs font-semibold text-primary">Benefício econômico por marco</p>
              <p className="text-xs text-muted-foreground">
                Faltam <strong>{loadingStats ? "..." : missingToReward}</strong> indicações válidas para liberar
                novo cupom de {rewardDays} dias.
              </p>
              {rewardCoupons.length > 0 && (
                <div className="space-y-1">
                  {rewardCoupons.slice(0, 3).map((reward: any, index: number) => (
                    <p key={`${reward?.coupon_code || "cupom"}-${index}`} className="text-[11px] text-muted-foreground">
                      Cupom gerado: <strong>{reward?.coupon_code || "-"}</strong>
                    </p>
                  ))}
                </div>
              )}
            </div>
          </div>

          <div className="space-y-3 border-t pt-4">
            <h4 className="text-sm font-semibold">1. Compartilhe seu Link</h4>
            <div className="break-words rounded-lg border bg-secondary/20 p-3 text-xs">{referralLink}</div>
            <div className="flex flex-wrap gap-2">
              <Button onClick={copyLink} className="h-9 gap-2">
                <Copy className="h-4 w-4" />
                Copiar Link
              </Button>
              <Button variant="outline" onClick={shareLink} className="h-9 gap-2">
                <Share2 className="h-4 w-4" />
                Compartilhar
              </Button>
              <Button variant="outline" onClick={handleWhatsAppShare} className="h-9 gap-2 bg-green-600 text-white hover:bg-green-700">
                <MessageSquare className="h-4 w-4" />
                WhatsApp
              </Button>
              <Button variant="outline" onClick={() => setTiersOpen(true)} className="h-9">
                Ver Níveis
              </Button>
            </div>
          </div>

          <div className="space-y-3 border-t pt-4">
            <h4 className="text-sm font-semibold">2. Indique Diretamente</h4>
            <p className="text-xs text-muted-foreground">Prefere que nossa equipe entre em contato? Insira os dados abaixo.</p>
            <form onSubmit={handleReferralSubmit} className="space-y-3">
              <div className="grid gap-2">
                <Label htmlFor="referral-name" className="text-xs">
                  Nome do Profissional (Opcional)
                </Label>
                <Input
                  id="referral-name"
                  placeholder="Ex: Maria da Silva"
                  value={referralName}
                  onChange={(e) => setReferralName(e.target.value)}
                  disabled={isSubmitting}
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="referral-phone" className="text-xs">
                  WhatsApp (com DDD) *
                </Label>
                <Input
                  id="referral-phone"
                  placeholder="Ex: (11) 99999-9999"
                  value={referralPhone}
                  onChange={(e) => setReferralPhone(e.target.value)}
                  disabled={isSubmitting}
                />
              </div>
              <Button type="submit" className="w-full gap-2" disabled={isSubmitting}>
                {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                Enviar Indicação
              </Button>
            </form>
          </div>
        </CardContent>
      </Card>

      <Dialog open={tiersOpen} onOpenChange={setTiersOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Níveis de Indicação</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            {safeStats.nextTier && (
              <div className="rounded-lg border bg-secondary/20 p-3 text-xs">
                Faltam {remainingToNext} indicações para alcançar o selo {safeStats.nextTier.badge_label}.
              </div>
            )}
            <div className="space-y-2">
              {tiers
                .slice()
                .sort((a: any, b: any) => (a.threshold ?? 0) - (b.threshold ?? 0))
                .map((tier: any, idx: number) => {
                  const achieved = (safeStats.count ?? 0) >= (tier.threshold ?? 0);
                  return (
                    <div key={idx} className="flex items-center justify-between rounded-lg border p-3">
                      <div className="flex items-center gap-3">
                        {achieved ? (
                          <CheckCircle className="h-4 w-4 text-success" />
                        ) : (
                          <Circle className="h-4 w-4 text-muted-foreground" />
                        )}
                        <div className="text-sm">
                          <div className="font-medium">{tier.badge_label || tier.name}</div>
                          <div className="text-xs text-muted-foreground">Necessário: {tier.threshold} indicações</div>
                        </div>
                      </div>
                      <div className={`text-xs ${achieved ? "text-success" : "text-muted-foreground"}`}>
                        {achieved ? "Alcançado" : `Faltam ${Math.max(0, (tier.threshold ?? 0) - (safeStats.count ?? 0))}`}
                      </div>
                    </div>
                  );
                })}
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
};

export default ReferralLinkCard;
