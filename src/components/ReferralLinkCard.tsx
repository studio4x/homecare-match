"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Copy, Share2, Link as LinkIcon, CheckCircle, Circle } from "lucide-react";
import { useAuth } from "@/components/auth/AuthProvider";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";

const ReferralLinkCard = () => {
  const { user } = useAuth();
  const [stats, setStats] = useState<{ count: number; currentTier?: any; nextTier?: any } | null>(null);
  const [tiers, setTiers] = useState<any[]>([]);
  const [tiersOpen, setTiersOpen] = useState(false);

  if (!user) return null;

  const referralLink = `${window.location.origin}/login?ref=${user.id}`;

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
      // Fallback padrão se não houver tiers configurados no Admin
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

  return (
    <>
      <Card className="shadow-card">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2">
            <LinkIcon className="h-5 w-5 text-primary" />
            Link de Indicação
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="rounded-lg border bg-secondary/20 p-3 text-xs break-words">
            {referralLink}
          </div>
          {stats && (
            <div className="flex items-center justify-between text-xs">
              <div className="flex items-center gap-2">
                <span className="rounded-full bg-primary/10 text-primary px-2 py-1 font-medium">
                  {stats.currentTier?.badge_label || "Embaixador"}
                </span>
                <span className="text-muted-foreground">
                  Indicações: {stats.count}
                </span>
              </div>
              {stats.nextTier && (
                <span className="text-muted-foreground">
                  Próximo selo: {stats.nextTier.badge_label} em {remainingToNext}
                </span>
              )}
            </div>
          )}
          <div className="flex flex-wrap gap-2">
            <Button onClick={copyLink} className="gap-2">
              <Copy className="h-4 w-4" />
              Copiar Link
            </Button>
            <Button variant="outline" onClick={shareLink} className="gap-2">
              <Share2 className="h-4 w-4" />
              Compartilhar
            </Button>
            <Button variant="outline" onClick={() => setTiersOpen(true)}>
              Ver Níveis
            </Button>
          </div>
          <p className="text-[10px] text-muted-foreground">
            Compartilhe este link com outros profissionais para que se cadastrem.
          </p>
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