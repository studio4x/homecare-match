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
      
      const isProf = userRole === 'professional';
      const targetRelation = isProf ? 'interactions_sender_id_fkey' : 'interactions_professional_id_fkey';
      const myColumn = isProf ? 'professional_id' : 'sender_id';

      // Consulta inicial com status
      let { data, error }: { data: any[] | null; error: any } = await supabase
        .from('interactions')
        .select(`
          id, 
          created_at, 
          status,
          profile:profiles!${targetRelation} (${profileFields})
        `)
        .eq(myColumn, userId)
        .order('created_at', { ascending: false });

      // Fallback caso a coluna status não exista
      if (error && error.message.includes('column interactions.status does not exist')) {
        console.warn("[InteractionsPage] Coluna 'status' ausente, tentando sem ela...");
        const retry = await supabase
          .from('interactions')
          .select(`
            id, 
            created_at, 
            profile:profiles!${targetRelation} (${profileFields})
          `)
          .eq(myColumn, userId)
          .order('created_at', { ascending: false });
        
        data = retry.data;
        error = retry.error;
      }

      if (error) throw error;

      if (!data) {
        setInteractions([]);
        return;
      }

      const unique = new Map();
      data.forEach((item: any) => {
        const p = item.profile;
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
      console.error("[InteractionsPage] Erro fatal:", err);
      toast.error("Erro ao carregar contatos.");
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