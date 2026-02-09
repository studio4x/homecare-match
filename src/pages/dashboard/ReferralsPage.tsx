"use client";

import ReferralLinkCard from "@/components/ReferralLinkCard";
import { Award } from "lucide-react";

const ReferralsPage = () => {
  return (
    <div className="space-y-6 max-w-3xl">
      <div className="flex flex-col gap-1">
        <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2"><Award className="h-6 w-6 text-primary" /> Programa de Indicações</h1>
        <p className="text-muted-foreground">Indique colegas e ganhe destaque no topo das buscas.</p>
      </div>

      <ReferralLinkCard />
    </div>
  );
};

export default ReferralsPage;