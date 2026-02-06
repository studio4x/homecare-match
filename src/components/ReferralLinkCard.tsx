"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Copy, Share2, Link as LinkIcon } from "lucide-react";
import { useAuth } from "@/components/auth/AuthProvider";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useEffect, useState } from "react";

const ReferralLinkCard = () => {
  const { user } = useAuth();
  const [stats, setStats] = useState<{ count: number; currentTier?: any; nextTier?: any } | null>(null);

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
    fetchStats();
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

  return (
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
                Próximo selo: {stats.nextTier.badge_label} em {stats.nextTier.threshold}
              </span>
            )}
          </div>
        )}
        <div className="flex gap-2">
          <Button onClick={copyLink} className="gap-2">
            <Copy className="h-4 w-4" />
            Copiar Link
          </Button>
          <Button variant="outline" onClick={shareLink} className="gap-2">
            <Share2 className="h-4 w-4" />
            Compartilhar
          </Button>
        </div>
        <p className="text-[10px] text-muted-foreground">
          Compartilhe este link com outros profissionais para que se cadastrem.
        </p>
      </CardContent>
    </Card>
  );
};

export default ReferralLinkCard;