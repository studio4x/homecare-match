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
  { name: "Referencia", threshold: 20, badge_label: "Referencia" },
  { name: "Senior", threshold: 35, badge_label: "Senior" },
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

  const safeStats = stats ?? { count: 0, currentTier: null, nextTier: null };

  const remainingToNext = useMemo(() => {
    if (!safeStats.nextTier) return null;
    return Math.max(0, (safeStats.nextTier.threshold ?? 0) - (safeStats.count ?? 0));
  }, [safeStats.count, safeStats.nextTier]);

  const copyLink = async () => {
    await navigator.clipboard.writeText(referralLink);
    toast.success("Link de indicacao copiado!");
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
      `Ola! Sou ${fullName} e estou te indicando para a HomeCare Match, a plataforma que conecta profissionais de saude a familias e empresas. Cadastre-se pelo meu link para comecar: ${referralLink}`,
    );
    const whatsappUrl = `https://wa.me/?text=${message}`;
    window.open(whatsappUrl, "_blank");
  };

  const handleReferralSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!referralPhone) {
      toast.error("O numero de WhatsApp e obrigatorio.");
      return;
    }

    setIsSubmitting(true);

    const cleanPhone = referralPhone.replace(/\D/g, "");
    if (cleanPhone.length < 10) {
      toast.error("Numero de WhatsApp invalido. Inclua DDD.");
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
        title: "Nova Indicacao Manual",
        content: `${user.user_metadata.full_name || "Um usuario"} indicou o profissional: ${referralName || cleanPhone}`,
        link: "/admin/indicacoes",
        type: "info",
      });

      toast.success("Indicacao enviada com sucesso! Nossa equipe entrara em contato.");
      setReferralName("");
      setReferralPhone("");
      await onRefreshStats?.();
    } catch (error) {
      console.error("Erro ao enviar indicacao:", error);
      toast.error("Erro ao enviar indicacao. Tente novamente.");
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
              Indique outros profissionais e ganhe destaque no topo das buscas! A indicacao so e valida quando o
              indicado conclui ate "Validou documentos".
            </p>
            <div className="rounded-lg border border-amber-200 bg-amber-50 p-3">
              <div className="flex items-start gap-2">
                <AlertTriangle className="mt-0.5 h-4 w-4 text-amber-600" />
                <div className="space-y-1">
                  <p className="text-xs font-semibold text-amber-800">Regra de validacao da indicacao</p>
                  <p className="text-xs text-amber-700">
                    A indicacao so conta como valida quando o indicado chega na etapa final: <strong>Validou documentos</strong>.
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
                  {safeStats.currentTier?.badge_label || "Nivel Inicial"}
                </span>
              </div>
              <div className="grid grid-cols-2 gap-4 text-center text-xs">
                <div className="space-y-1">
                  <p className="text-xl font-semibold text-foreground">{loadingStats ? "..." : safeStats.count}</p>
                  <p className="text-muted-foreground">Indicacoes Validas</p>
                </div>
                <div className="space-y-1">
                  <p className="text-xl font-semibold text-foreground">
                    {loadingStats ? "..." : safeStats.nextTier ? remainingToNext : "-"}
                  </p>
                  <p className="text-muted-foreground">Faltam para o proximo selo</p>
                </div>
              </div>
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
                Ver Niveis
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
                Enviar Indicacao
              </Button>
            </form>
          </div>
        </CardContent>
      </Card>

      <Dialog open={tiersOpen} onOpenChange={setTiersOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Niveis de Indicacao</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            {safeStats.nextTier && (
              <div className="rounded-lg border bg-secondary/20 p-3 text-xs">
                Faltam {remainingToNext} indicacoes para alcancar o selo {safeStats.nextTier.badge_label}.
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
                          <div className="text-xs text-muted-foreground">Necessario: {tier.threshold} indicacoes</div>
                        </div>
                      </div>
                      <div className={`text-xs ${achieved ? "text-success" : "text-muted-foreground"}`}>
                        {achieved ? "Alcancado" : `Faltam ${Math.max(0, (tier.threshold ?? 0) - (safeStats.count ?? 0))}`}
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
