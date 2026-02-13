"use client";

import { useState, useEffect } from "react";
import ReferralLinkCard from "@/components/ReferralLinkCard";
import ReferredUsersList from "@/components/ReferredUsersList";
import { Award, Loader2 } from "lucide-react";
import { useAuth } from "@/components/auth/AuthProvider";
import { supabase } from "@/integrations/supabase/client";

const ReferralsPage = () => {
  const { user } = useAuth();
  const [stats, setStats] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  const fetchStats = async () => {
    if (!user) return;
    try {
      const { data, error } = await supabase.functions.invoke('referral-stats', {
        body: { referrerId: user.id }
      });
      if (!error && data) {
        setStats(data);
      }
    } catch (err) {
      console.error("Erro ao buscar estatísticas de indicação:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStats();
  }, [user?.id]);

  return (
    <div className="space-y-6 max-w-4xl">
      <div className="flex flex-col gap-1">
        <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
          <Award className="h-6 w-6 text-primary" /> 
          Programa de Indicações
        </h1>
        <p className="text-muted-foreground">Indique colegas e ganhe destaque no topo das buscas.</p>
      </div>

      <div className="grid gap-6 lg:grid-cols-5">
        <div className="lg:col-span-3">
          <ReferralLinkCard />
        </div>
        <div className="lg:col-span-2">
          <ReferredUsersList 
            users={stats?.registeredUsers || []} 
            loading={loading} 
          />
        </div>
      </div>
    </div>
  );
};

export default ReferralsPage;