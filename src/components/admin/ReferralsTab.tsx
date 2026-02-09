"use client";

import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle
} from "@/components/ui/dialog";
import { 
  Loader2,
  Plus,
  Award,
  Trash2,
  ShieldAlert,
  MessageSquare
} from "lucide-react";
import { toast } from "sonner";

interface Referral {
  id: string;
  referred_name: string;
  referred_phone: string;
  status: string;
  created_at: string;
  referrer: {
    full_name: string;
    email: string;
  };
}

interface ReferralsTabProps {
  referrals: Referral[];
  refetchData: () => void;
}

const ReferralsTab = ({ referrals, refetchData }: ReferralsTabProps) => {
  const [referralTiers, setReferralTiers] = useState<any[]>([]);
  const [isLoadingTiers, setIsLoadingTiers] = useState(true);
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [referralToDelete, setReferralToDelete] = useState<Referral | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  useEffect(() => {
    const fetchTiers = async () => {
      setIsLoadingTiers(true);
      try {
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
          setReferralTiers(data.tiers);
        } else {
          setReferralTiers(defaultTiers);
        }
      } catch (error) {
        console.error("Error fetching referral tiers:", error);
        toast.error("Failed to load referral tiers.");
      } finally {
        setIsLoadingTiers(false);
      }
    };
    fetchTiers();
  }, []);

  const handleSaveTiers = async () => {
    const { error } = await supabase.functions.invoke('referral-config', {
      body: { action: 'set', tiers: referralTiers }
    });
    if (error) {
      toast.error("Erro ao salvar tiers.");
    } else {
      toast.success("Tiers salvos!");
    }
  };

  const handleDeleteReferral = async () => {
    if (!referralToDelete) return;
    setIsDeleting(true);
    try {
      // Ação de exclusão no banco de dados
      const { error } = await supabase
        .from('referrals')
        .delete()
        .eq('id', referralToDelete.id);

      if (error) throw error;

      toast.success("Indicação excluída com sucesso.");
      setDeleteModalOpen(false);
      setReferralToDelete(null);
      refetchData(); // Recarrega a lista de indicações
    } catch (error) {
      console.error("Erro ao excluir indicação:", error);
      toast.error("Falha ao excluir indicação.");
    } finally {
      setIsDeleting(false);
    }
  };

  const getWhatsappLink = (phone: string, name: string) => {
    const cleanPhone = phone.replace(/\D/g, '');
    const message = encodeURIComponent(`Olá ${name || 'profissional'}, sou da equipe HomeCare Match. Recebemos sua indicação e gostaríamos de te ajudar a se cadastrar na plataforma!`);
    return `https://wa.me/${cleanPhone}?text=${message}`;
  };

  return (
    <>
      <div className="rounded-xl border bg-card overflow-x-auto shadow-sm">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Indicado</TableHead>
              <TableHead>WhatsApp</TableHead>
              <TableHead>Indicador</TableHead>
              <TableHead>Data</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {referrals.length > 0 ? referrals.map(r => (
              <TableRow key={r.id}>
                <TableCell className="font-medium">{r.referred_name || 'Não informado'}</TableCell>
                <TableCell>
                  <a href={`https://wa.me/${r.referred_phone}`} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">
                    {r.referred_phone}
                  </a>
                </TableCell>
                <TableCell>
                  <div className="font-medium">{r.referrer?.full_name || 'N/A'}</div>
                  <div className="text-xs text-muted-foreground">{r.referrer?.email}</div>
                </TableCell>
                <TableCell>{new Date(r.created_at).toLocaleDateString('pt-BR')}</TableCell>
                <TableCell>
                  <Badge variant="secondary" className="capitalize">{r.status}</Badge>
                </TableCell>
                <TableCell className="text-right whitespace-nowrap">
                  <Button 
                    variant="outline" 
                    size="sm" 
                    className="text-success hover:bg-success/10 mr-2 h-8 gap-1"
                    asChild
                  >
                    <a 
                      href={getWhatsappLink(r.referred_phone, r.referred_name || '')} 
                      target="_blank" 
                      rel="noopener noreferrer"
                    >
                      <MessageSquare className="h-4 w-4" />
                      WhatsApp
                    </a>
                  </Button>
                  <Button 
                    variant="ghost" 
                    size="sm" 
                    className="text-destructive hover:bg-destructive/10 h-8"
                    onClick={() => { setReferralToDelete(r); setDeleteModalOpen(true); }}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </TableCell>
              </TableRow>
            )) : <TableRow><TableCell colSpan={6} className="h-32 text-center text-muted-foreground">Nenhuma indicação pendente.</TableCell></TableRow>}
          </TableBody>
        </Table>
      </div>
      <div className="rounded-xl border bg-card shadow-sm p-6 space-y-4 mt-6">
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-semibold flex items-center gap-2">
            <Award className="h-5 w-5 text-primary" />
            Tiers de Embaixador
          </h2>
          <Button onClick={() => setReferralTiers(prev => [...prev, { name: '', threshold: 1, badge_label: '' }])} className="gap-2">
            <Plus className="h-4 w-4" /> Novo Tier
          </Button>
        </div>
        {isLoadingTiers ? (
          <div className="flex items-center gap-2 text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" /> Carregando...</div>
        ) : referralTiers.length > 0 ? (
          <div className="space-y-3">
            {referralTiers.map((t, idx) => (
              <div key={idx} className="grid md:grid-cols-3 gap-3 p-4 border rounded-lg">
                <div className="grid gap-2">
                  <Label>Nome</Label>
                  <Input value={t.name} onChange={e => {
                    const v = e.target.value;
                    setReferralTiers(prev => prev.map((x, i) => i === idx ? { ...x, name: v } : x));
                  }} />
                </div>
                <div className="grid gap-2">
                  <Label>Quantidade (threshold)</Label>
                  <Input type="number" value={t.threshold} onChange={e => {
                    const v = parseInt(e.target.value || '0', 10);
                    setReferralTiers(prev => prev.map((x, i) => i === idx ? { ...x, threshold: v } : x));
                  }} />
                </div>
                <div className="grid gap-2">
                  <Label>Rótulo do Selo</Label>
                  <Input value={t.badge_label} onChange={e => {
                    const v = e.target.value;
                    setReferralTiers(prev => prev.map((x, i) => i === idx ? { ...x, badge_label: v } : x));
                  }} />
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-sm text-muted-foreground">Nenhum tier configurado ainda.</div>
        )}
        <div className="flex justify-end">
          <Button onClick={handleSaveTiers}>
            Salvar Tiers
          </Button>
        </div>
      </div>

      {/* Modal de Confirmação de Exclusão */}
      <Dialog open={deleteModalOpen} onOpenChange={setDeleteModalOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-destructive">
              <ShieldAlert className="h-5 w-5" />
              Excluir Indicação
            </DialogTitle>
            <DialogDescription className="pt-2">
              Você tem certeza que deseja excluir a indicação de <strong>{referralToDelete?.referred_name || referralToDelete?.referred_phone}</strong>?
              <br/><br/>
              Esta ação é irreversível e removerá o registro da indicação.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="mt-4">
            <Button variant="ghost" onClick={() => setDeleteModalOpen(false)} disabled={isDeleting}>
              Cancelar
            </Button>
            <Button variant="destructive" onClick={handleDeleteReferral} disabled={isDeleting}>
              {isDeleting ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              Confirmar Exclusão
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
};

export default ReferralsTab;