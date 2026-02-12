"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Copy, Share2, Link as LinkIcon, CheckCircle, Circle, Award, MessageSquare, Loader2 } from "lucide-react";
import { useAuth } from "@/components/auth/AuthProvider";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

const ReferralLinkCard = () => {
  const { user } = useAuth();
  const [stats, setStats] = useState<{ count: number; currentTier?: any; nextTier?: any } | null>(null);
  const [tiers, setTiers] = useState<any[]>([]);
  const [tiersOpen, setTiersOpen] = useState(false);
  const [referralName, setReferralName] = useState("");
  const [referralPhone, setReferralPhone] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (!user) return null;

  // Alterado: Agora aponta para /convite e não para /login
  const referralLink = `${window.location.origin}/convite?ref=${user.id}`;

  useEffect(() => {
    const fetchStats = async () => {
      const { data, error } = await supabase.functions.invoke('referral-stats', {
        body: { referrerId: user.id }
      });
      if (!error && data) {
        setStats(data as any);
      }
    };
    const fetchTiers = async () => {
      const { data, error } = await supabase.functions.invoke('referral-config', {
        body: { action: 'get' }
      });
      const defaultTiers = [
        { name: "Promotor", threshold: 3, badge_label: "Promotor" },
        { name: "Colaborador", threshold: 5, badge_label: "Colaborador" },
        { name: "Embaixador", threshold: 10, badge_label: "Embaixador" },
        { name: "Referência", threshold: 20, badge_label: "Referência" },
        { name: "Sênior", threshold: 35, badge_label: "Sênior" },
        { name: "Elite", threshold: 50, badge_label: "Elite" },
      ];
      if (!error && data?.tiers && Array.isArray(data.tiers) && data.tiers.length > 0) {
        setTiers(data.tiers);
      } else {
        setTiers(defaultTiers);
      }
    };
    fetchStats();
    fetchTiers();
  }, [user?.id]);

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
      copyLink();
    }
  };

  const remainingToNext = (() => {
    if (!stats?.nextTier) return null;
    const need = Math.max(0, (stats.nextTier.threshold ?? 0) - (stats?.count ?? 0));
    return need;
  })();

  const handleWhatsAppShare = () => {
    const message = encodeURIComponent(`Olá! Sou ${user.user_metadata.full_name || 'um profissional'} e estou te indicando para a HomeCare Match, a plataforma que conecta profissionais de saúde a famílias e empresas. Cadastre-se pelo meu link para começar: ${referralLink}`);
    const whatsappUrl = `https://wa.me/?text=${message}`;
    window.open(whatsappUrl, '_blank');
  };

  const handleReferralSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!referralPhone) {
      toast.error("O número de WhatsApp é obrigatório.");
      return;
    }
    
    setIsSubmitting(true);
    
    const cleanPhone = referralPhone.replace(/\D/g, '');
    if (cleanPhone.length < 10) {
      toast.error("Número de WhatsApp inválido. Inclua DDD.");
      setIsSubmitting(false);
      return;
    }

    try {
      const { error } = await supabase.from('referrals').insert({
        referrer_id: user.id,
        referred_name: referralName || null,
        referred_phone: cleanPhone,
        status: 'pending',
      });

      if (error) throw error;

      toast.success("Indicação enviada com sucesso! Nossa equipe entrará em contato.");
      setReferralName("");
      setReferralPhone("");
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
              Indique outros profissionais e ganhe destaque no topo das buscas!
              A cada indicação que se cadastrar, você sobe de nível e aumenta sua visibilidade.
            </p>
            {stats && (
              <div className="rounded-lg border bg-secondary/50 p-4 space-y-3">
                <div className="flex items-center justify-center">
                  <span className={cn(
                    "rounded-full px-3 py-1 text-sm font-semibold",
                    stats.currentTier ? "bg-primary/10 text-primary" : "bg-muted-foreground/10 text-muted-foreground"
                  )}>
                    {stats.currentTier?.badge_label || "Nível Inicial"}
                  </span>
                </div>
                <div className="grid grid-cols-2 gap-4 text-center text-xs">
                  <div className="space-y-1">
                    <p className="font-semibold text-xl text-foreground">{stats.count}</p>
                    <p className="text-muted-foreground">Indicações Válidas</p>
                  </div>
                  <div className="space-y-1">
                    <p className="font-semibold text-xl text-foreground">{stats.nextTier ? remainingToNext : '—'}</p>
                    <p className="text-muted-foreground">Faltam para o próximo selo</p>
                  </div>
                </div>
              </div>
            )}
          </div>

          <div className="space-y-3 border-t pt-4">
            <h4 className="font-semibold text-sm">1. Compartilhe seu Link</h4>
            <div className="rounded-lg border bg-secondary/20 p-3 text-xs break-words">
              {referralLink}
            </div>
            <div className="flex flex-wrap gap-2">
              <Button onClick={copyLink} className="gap-2 h-9">
                <Copy className="h-4 w-4" />
                Copiar Link
              </Button>
              <Button variant="outline" onClick={shareLink} className="gap-2 h-9">
                <Share2 className="h-4 w-4" />
                Compartilhar
              </Button>
              <Button variant="outline" onClick={handleWhatsAppShare} className="gap-2 h-9 bg-green-600 hover:bg-green-700 text-white">
                <MessageSquare className="h-4 w-4" />
                WhatsApp
              </Button>
              <Button variant="outline" onClick={() => setTiersOpen(true)} className="h-9">
                Ver Níveis
              </Button>
            </div>
          </div>

          <div className="space-y-3 border-t pt-4">
            <h4 className="font-semibold text-sm">2. Indique Diretamente</h4>
            <p className="text-xs text-muted-foreground">
              Prefere que nossa equipe entre em contato? Insira os dados abaixo.
            </p>
            <form onSubmit={handleReferralSubmit} className="space-y-3">
              <div className="grid gap-2">
                <Label htmlFor="referral-name" className="text-xs">Nome do Profissional (Opcional)</Label>
                <Input 
                  id="referral-name"
                  placeholder="Ex: Maria da Silva"
                  value={referralName}
                  onChange={(e) => setReferralName(e.target.value)}
                  disabled={isSubmitting}
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="referral-phone" className="text-xs">WhatsApp (com DDD) *</Label>
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
            {stats?.nextTier && (
              <div className="rounded-lg border bg-secondary/20 p-3 text-xs">
                Faltam {remainingToNext} indicações para alcançar o selo {stats.nextTier.badge_label}.
              </div>
            )}
            <div className="space-y-2">
              {tiers
                .slice()
                .sort((a: any, b: any) => (a.threshold ?? 0) - (b.threshold ?? 0))
                .map((t: any, idx: number) => {
                  const achieved = (stats?.count ?? 0) >= (t.threshold ?? 0);
                  return (
                    <div key={idx} className="flex items-center justify-between rounded-lg border p-3">
                      <div className="flex items-center gap-3">
                        {achieved ? (
                          <CheckCircle className="h-4 w-4 text-success" />
                        ) : (
                          <Circle className="h-4 w-4 text-muted-foreground" />
                        )}
                        <div className="text-sm">
                          <div className="font-medium">{t.badge_label || t.name}</div>
                          <div className="text-muted-foreground text-xs">
                            Necessário: {t.threshold} indicações
                          </div>
                        </div>
                      </div>
                      <div className={`text-xs ${achieved ? "text-success" : "text-muted-foreground"}`}>
                        {achieved ? "Alcançado" : `Faltam ${Math.max(0, (t.threshold ?? 0) - (stats?.count ?? 0))}`}
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