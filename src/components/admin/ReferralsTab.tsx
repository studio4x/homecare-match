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
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { 
  Loader2,
  Plus,
  Award,
  Trash2,
  ShieldAlert,
  MessageSquare,
  Link as LinkIcon,
  UserCheck,
  ChevronDown,
  ChevronUp,
  Settings2,
  Save
} from "lucide-react";
import { toast } from "sonner";

interface Referral {
  id: string;
  referred_name: string;
  referred_phone?: string;
  referred_email?: string;
  referred_role?: string;
  status: string;
  created_at: string;
  type?: 'manual' | 'link';
  referrer: {
    full_name: string;
    email: string;
  };
}

interface ReferralsTabProps {
  referrals: Referral[];
  onDelete: (id: string, options?: { onSuccess?: () => void }) => void;
  isDeleting: boolean;
}

const ReferralsTab = ({ referrals, onDelete, isDeleting }: ReferralsTabProps) => {
  const [referralTiers, setReferralTiers] = useState<any[]>([]);
  const [isLoadingTiers, setIsLoadingTiers] = useState(true);
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [referralToDelete, setReferralToDelete] = useState<Referral | null>(null);
  const [isTiersOpen, setIsTiersOpen] = useState(false);
  const [isSavingTiers, setIsSavingTiers] = useState(false);

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
      } finally {
        setIsLoadingTiers(false);
      }
    };
    fetchTiers();
  }, []);

  const handleSaveTiers = async () => {
    setIsSavingTiers(true);
    const { error } = await supabase.functions.invoke('referral-config', {
      body: { action: 'set', tiers: referralTiers }
    });
    setIsSavingTiers(false);
    if (error) {
      toast.error("Erro ao salvar tiers.");
    } else {
      toast.success("Configurações de Tiers salvas com sucesso!");
      setIsTiersOpen(false);
    }
  };

  const handleDeleteReferral = () => {
    if (!referralToDelete) return;
    onDelete(referralToDelete.id, {
      onSuccess: () => {
        setDeleteModalOpen(false);
        setReferralToDelete(null);
      }
    });
  };

  const getWhatsappLink = (phone: string, name: string) => {
    const cleanPhone = phone.replace(/\D/g, '');
    const message = encodeURIComponent(`Olá \${name || 'profissional'}, sou da equipe HomeCare Match. Recebemos sua indicação e gostaríamos de te ajudar a se cadastrar na plataforma!`);
    return `https://wa.me/\${cleanPhone}?text=\${message}`;
  };

  return (
    <div className="space-y-6">
      <Collapsible
        open={isTiersOpen}
        onOpenChange={setIsTiersOpen}
        className="rounded-xl border bg-card shadow-sm overflow-hidden"
      >
        <CollapsibleTrigger asChild>
          <Button 
            variant="ghost" 
            className="w-full flex items-center justify-between p-6 h-auto hover:bg-secondary/50 group"
          >
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center text-primary">
                <Settings2 className="h-5 w-5" />
              </div>
              <div className="text-left">
                <h2 className="text-lg font-semibold">Configurar Tiers de Embaixador</h2>
                <p className="text-xs text-muted-foreground">Defina as metas e rótulos para os selos de indicação.</p>
              </div>
            </div>
            {isTiersOpen ? <ChevronUp className="h-5 w-5 text-muted-foreground" /> : <ChevronDown className="h-5 w-5 text-muted-foreground" />}
          </Button>
        </CollapsibleTrigger>
        
        <CollapsibleContent className="px-6 pb-6 space-y-6 border-t animate-accordion-down">
          <div className="pt-6 flex items-center justify-between">
            <p className="text-sm text-muted-foreground">Adicione ou remova níveis de conquista baseados no número de indicações.</p>
            <Button size="sm" onClick={() => setReferralTiers(prev => [...prev, { name: '', threshold: 1, badge_label: '' }])} className="gap-2">
              <Plus className="h-4 w-4" /> Novo Tier
            </Button>
          </div>

          {isLoadingTiers ? (
            <div className="flex items-center justify-center py-8 text-muted-foreground">
              <Loader2 className="h-6 w-6 animate-spin mr-2" /> Carregando configurações...
            </div>
          ) : referralTiers.length > 0 ? (
            <div className="grid gap-4">
              {referralTiers.map((t, idx) => (
                <div key={idx} className="grid md:grid-cols-12 gap-4 p-4 border rounded-lg bg-secondary/5 relative group">
                  <div className="md:col-span-4 space-y-1.5">
                    <Label className="text-[10px] uppercase font-bold text-muted-foreground">Nome Interno</Label>
                    <Input 
                      placeholder="Ex: Nível 1"
                      value={t.name} 
                      onChange={e => {
                        const v = e.target.value;
                        setReferralTiers(prev => prev.map((x, i) => i === idx ? { ...x, name: v } : x));
                      }} 
                    />
                  </div>
                  <div className="md:col-span-3 space-y-1.5">
                    <Label className="text-[10px] uppercase font-bold text-muted-foreground">Meta (Indicações)</Label>
                    <Input 
                      type="number" 
                      value={t.threshold} 
                      onChange={e => {
                        const v = parseInt(e.target.value || '0', 10);
                        setReferralTiers(prev => prev.map((x, i) => i === idx ? { ...x, threshold: v } : x));
                      }} 
                    />
                  </div>
                  <div className="md:col-span-4 space-y-1.5">
                    <Label className="text-[10px] uppercase font-bold text-muted-foreground">Rótulo do Selo (Público)</Label>
                    <Input 
                      placeholder="Ex: Embaixador Bronze"
                      value={t.badge_label} 
                      onChange={e => {
                        const v = e.target.value;
                        setReferralTiers(prev => prev.map((x, i) => i === idx ? { ...x, badge_label: v } : x));
                      }} 
                    />
                  </div>
                  <div className="md:col-span-1 flex items-end justify-end">
                    <Button 
                      variant="ghost" 
                      size="icon" 
                      className="text-destructive hover:bg-destructive/10"
                      onClick={() => setReferralTiers(prev => prev.filter((_, i) => i !== idx))}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-10 border-2 border-dashed rounded-xl">
              <Award className="h-10 w-10 mx-auto mb-2 text-muted-foreground opacity-20" />
              <p className="text-sm text-muted-foreground">Nenhum tier configurado.</p>
            </div>
          )}

          <div className="flex justify-end gap-3 pt-4">
            <Button variant="ghost" onClick={() => setIsTiersOpen(false)}>Cancelar</Button>
            <Button onClick={handleSaveTiers} disabled={isSavingTiers}>
              {isSavingTiers ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Save className="h-4 w-4 mr-2" />}
              Salvar Configurações
            </Button>
          </div>
        </CollapsibleContent>
      </Collapsible>

      <div className="rounded-xl border bg-card overflow-x-auto shadow-sm">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Indicado</TableHead>
              <TableHead>Contato / Info</TableHead>
              <TableHead>Indicador</TableHead>
              <TableHead>Data</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {referrals.length > 0 ? referrals.map(r => (
              <TableRow key={r.id}>
                <TableCell>
                  <div className="font-medium">{r.referred_name || 'Não informado'}</div>
                  {r.type === 'link' && (
                    <Badge variant="outline" className="text-[8px] h-4 uppercase mt-1">
                      {r.referred_role === 'professional' ? 'Profissional' : r.referred_role === 'company' ? 'Empresa' : 'Família'}
                    </Badge>
                  )}
                </TableCell>
                <TableCell>
                  {r.type === 'manual' ? (
                    <a href={`https://wa.me/\${r.referred_phone}`} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline text-sm">
                      {r.referred_phone}
                    </a>
                  ) : (
                    <div className="text-xs text-muted-foreground truncate max-w-[150px]">
                      {r.referred_email}
                    </div>
                  )}
                </TableCell>
                <TableCell>
                  <div className="font-medium text-sm">{r.referrer?.full_name || 'N/A'}</div>
                  <div className="text-[10px] text-muted-foreground">{r.referrer?.email}</div>
                </TableCell>
                <TableCell className="text-xs">{new Date(r.created_at).toLocaleDateString('pt-BR')}</TableCell>
                <TableCell>
                  <Badge variant={r.type === 'link' ? "default" : "secondary"} className="capitalize text-[10px] h-5">
                    {r.type === 'link' ? <UserCheck className="h-3 w-3 mr-1" /> : null}
                    {r.status === 'registered' ? 'Cadastrado' : r.status}
                  </Badge>
                </TableCell>
                <TableCell className="text-right whitespace-nowrap">
                  {r.type === 'manual' && r.referred_phone ? (
                    <>
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
                    </>
                  ) : (
                    <Badge variant="outline" className="gap-1 text-[10px]">
                      <LinkIcon className="h-3 w-3" /> Via Link
                    </Badge>
                  )}
                </TableCell>
              </TableRow>
            )) : <TableRow><TableCell colSpan={6} className="h-32 text-center text-muted-foreground">Nenhuma indicação encontrada.</TableCell></TableRow>}
          </TableBody>
        </Table>
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
    </div>
  );
};

export default ReferralsTab;