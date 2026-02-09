"use client";

import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import ReferralsTab from "@/components/admin/ReferralsTab";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";

const ReferralsPage = () => {
  const [referrals, setReferrals] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchData = async () => {
    setLoading(true);
    try {
      // Usando a estratégia CLIENT-SIDE que implementamos para evitar erros RPC
      const { data: referralsData, error: referralsError } = await supabase
        .from('referrals')
        .select('*')
        .order('created_at', { ascending: false });

      if (referralsError) throw referralsError;

      let formattedReferrals: any[] = [];

      if (referralsData && referralsData.length > 0) {
        const referrerIds = Array.from(new Set(referralsData.map((r: any) => r.referrer_id).filter(Boolean)));
        
        let profilesMap = new Map();
        if (referrerIds.length > 0) {
          const { data: profilesData } = await supabase
            .from('profiles')
            .select('id, full_name, email')
            .in('id', referrerIds);
          
          if (profilesData) {
            profilesData.forEach((p: any) => profilesMap.set(p.id, p));
          }
        }

        formattedReferrals = referralsData.map((r: any) => ({
          id: r.id,
          referrer_id: r.referrer_id,
          referred_name: r.referred_name,
          referred_phone: r.referred_phone,
          status: r.status,
          created_at: r.created_at,
          referrer: r.referrer_id ? {
            full_name: profilesMap.get(r.referrer_id)?.full_name || 'Usuário não encontrado',
            email: profilesMap.get(r.referrer_id)?.email || 'N/A'
          } : { full_name: 'Sistema', email: '' }
        }));
      }
      setReferrals(formattedReferrals);
    } catch (error) {
      console.error("Erro ao carregar indicações:", error);
      toast.error("Erro ao carregar lista de indicações.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  if (loading) return <div className="flex justify-center p-8"><Loader2 className="animate-spin text-primary" /></div>;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Indicações</h1>
        <p className="text-muted-foreground">Acompanhe o programa de "Indique e Ganhe".</p>
      </div>
      <ReferralsTab referrals={referrals} refetchData={fetchData} />
    </div>
  );
};

export default ReferralsPage;