"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Copy, Share2, Link as LinkIcon } from "lucide-react";
import { useAuth } from "@/components/auth/AuthProvider";
import { toast } from "sonner";

const ReferralLinkCard = () => {
  const { user } = useAuth();

  if (!user) return null;

  const referralLink = `${window.location.origin}/login?ref=${user.id}`;

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