"use client";

import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import ReferralsTab from "@/components/admin/ReferralsTab";
import ReferralTiersConfig from "@/components/admin/ReferralTiersConfig";
import { Loader2, Award, Link as LinkIcon, UserPlus, Settings2 } from "lucide-react";
import { toast } from "sonner";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

const ReferralsPage = () => {
  const queryClient = useQueryClient();

  // Busca indicações manuais (Tabela)
  const { data: manualReferrals = [], isLoading: isLoadingManual } = useQuery({
    queryKey: ['admin-referrals-manual'],
    queryFn: async () => {
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
          type: 'manual',
          referrer: r.referrer_id ? {
            full_name: profilesMap.get(r.referrer_id)?.full_name || 'Usuário não encontrado',
            email: profilesMap.get(r.referrer_id)?.email || 'N/A'
          } : { full_name: 'Sistema', email: '' }
        }));
      }
      return formattedReferrals;
    }
  });

  // Busca indicações via Link (Storage)
  const { data: linkReferrals = [], isLoading: isLoadingLinks } = useQuery({
    queryKey: ['admin-referrals-links'],
    queryFn: async () => {
      const { data, error } = await supabase.functions.invoke('admin-get-all-referrals');
      if (error) throw error;
      return data.referrals || [];
    }
  });

  const deleteMutation = useMutation({
    mutationFn: async (referralId: string) => {
      // Apenas indicações manuais podem ser excluídas da tabela
      if (referralId.startsWith('link-')) {
        toast.error("Indicações via link são registros de sistema e não podem ser excluídas por aqui.");
        return;
      }
      const { error } = await supabase
        .from('referrals')
        .delete()
        .eq('id', referralId);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Indicação excluída com sucesso.");
      queryClient.invalidateQueries({ queryKey: ['admin-referrals-manual'] });
    },
    onError: (error) => {
      console.error("Erro ao excluir indicação:", error);
      toast.error("Falha ao excluir indicação.");
    }
  });

  const isLoading = isLoadingManual || isLoadingLinks;

  if (isLoading) return <div className="flex justify-center p-8"><Loader2 className="animate-spin text-primary" /></div>;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Programa de Indicações</h1>
        <p className="text-muted-foreground">Gerencie indicações manuais e acompanhe cadastros via link.</p>
      </div>

      <Tabs defaultValue="manual" className="space-y-6">
        <TabsList className="grid w-full max-w-2xl grid-cols-3">
          <TabsTrigger value="manual" className="gap-2">
            <UserPlus className="h-4 w-4" />
            Indicações Manuais
          </TabsTrigger>
          <TabsTrigger value="links" className="gap-2">
            <LinkIcon className="h-4 w-4" />
            Cadastros via Link
          </TabsTrigger>
          <TabsTrigger value="config" className="gap-2">
            <Settings2 className="h-4 w-4" />
            Configurar Tiers
          </TabsTrigger>
        </TabsList>

        <TabsContent value="manual" className="space-y-6">
          <ReferralsTab 
            referrals={manualReferrals} 
            onDelete={deleteMutation.mutate}
            isDeleting={deleteMutation.isPending}
          />
        </TabsContent>

        <TabsContent value="links" className="space-y-6">
          <div className="bg-blue-50 border border-blue-200 p-4 rounded-lg mb-4">
            <p className="text-sm text-blue-800">
              Estes são usuários que criaram conta utilizando o link de indicação de um profissional. 
              Estes registros são automáticos e servem para o cálculo de selos de embaixador.
            </p>
          </div>
          <ReferralsTab 
            referrals={linkReferrals} 
            onDelete={() => {}} // Desabilitado para links
            isDeleting={false}
          />
        </TabsContent>

        <TabsContent value="config" className="space-y-6">
          <ReferralTiersConfig />
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default ReferralsPage;