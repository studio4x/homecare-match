"use client";

import { useState, useEffect } from "react";
import { useAuth } from "@/components/auth/AuthProvider";
import { supabase } from "@/integrations/supabase/client";
import InteractionHistory from "@/components/InteractionHistory";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";

const InteractionsPage = () => {
  const { user } = useAuth();
  const [profile, setProfile] = useState<any>(null);
  const [interactions, setInteractions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentPage, setCurrentPage] = useState(1);
  const ITEMS_PER_PAGE = 10;

  useEffect(() => {
    const load = async () => {
      if (!user) return;
      try {
        const { data: prof } = await supabase
          .from('profiles')
          .select('id, role')
          .eq('id', user.id)
          .single();
        
        setProfile(prof);
        if (prof) {
          await fetchInteractions(user.id, prof.role);
        }
      } catch (err) {
        console.error("[InteractionsPage] Erro ao carregar perfil:", err);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [user]);

  const fetchInteractions = async (userId: string, userRole: string) => {
    try {
      const profileFields = 'id, full_name, avatar_url, specialty, role, phone, bio, city, state, neighborhood';
      
      // Tentativa 1: Busca com Status
      const isProf = userRole === 'professional';
      const targetTable = isProf ? 'sender_id' : 'professional_id';
      const myTable = isProf ? 'professional_id' : 'sender_id';

      const { data, error } = await supabase
        .from('interactions')
        .select(`
          id, 
          created_at, 
          status,
          profiles!interactions_${targetTable}_fkey (${profileFields})
        `)
        .eq(myTable, userId)
        .order('created_at', { ascending: false });

      let finalData: any[] | null = data;

      // Fallback: Se a consulta acima falhar (provavelmente por causa do nome da FKey ou coluna status)
      if (error) {
        console.warn("[InteractionsPage] Consulta principal falhou, tentando fallback simplificado...", error.message);
        
        // Tentativa 2: Busca simplificada sem especificar a FKey (deixa o PostgREST decidir)
        const { data: retryData, error: retryError } = await supabase
          .from('interactions')
          .select(`
            id, 
            created_at, 
            profiles (${profileFields})
          `)
          .eq(myTable, userId)
          .order('created_at', { ascending: false });

        if (retryError) throw retryError;
        finalData = retryData;
      }

      if (!finalData) {
        setInteractions([]);
        return;
      }

      const unique = new Map();
      finalData.forEach((item: any) => {
        // O perfil pode vir em um array ou objeto dependendo da relação
        const p = Array.isArray(item.profiles) ? item.profiles[0] : item.profiles;
        
        if (p && !unique.has(p.id)) {
          unique.set(p.id, { 
            id: item.id,
            interacted_at: item.created_at, 
            status: item.status || 'pending',
            profile: p 
          });
        }
      });

      setInteractions(Array.from(unique.values()));
    } catch (err: any) {
      console.error("[InteractionsPage] Erro fatal ao buscar interações:", err);
      toast.error("Erro ao carregar contatos. Por favor, recarregue a página.");
    }
  };

  const handleClear = async () => {
    if (!user || !profile) return;
    try {
      const col = profile.role === 'professional' ? 'professional_id' : 'sender_id';
      const { error } = await supabase.from('interactions').delete().eq(col, user.id);
      if (error) throw error;
      setInteractions([]);
      toast.success("Histórico limpo!");
    } catch (err) {
      toast.error("Erro ao limpar histórico.");
    }
  };

  if (loading) return <div className="flex justify-center p-8"><Loader2 className="animate-spin text-primary" /></div>;

  const paginated = interactions.slice((currentPage - 1) * ITEMS_PER_PAGE, currentPage * ITEMS_PER_PAGE);

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-1">
        <h1 className="text-2xl font-bold tracking-tight">Meus Contatos</h1>
        <p className="text-muted-foreground">Pessoas e empresas que demonstraram interesse em seu trabalho.</p>
      </div>

      <InteractionHistory
        title={profile?.role === 'professional' ? "Quem me contatou" : "Profissionais que contatei"}
        interactions={paginated}
        loading={false}
        totalItems={interactions.length}
        itemsPerPage={ITEMS_PER_PAGE}
        currentPage={currentPage}
        onPageChange={setCurrentPage}
        onClear={handleClear}
        viewerRole={profile?.role as any}
      />
    </div>
  );
};

export default InteractionsPage;