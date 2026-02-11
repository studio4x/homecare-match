"use client";

import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
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
  DialogFooter,
  DialogHeader,
  DialogTitle
} from "@/components/ui/dialog";
import { 
  Loader2,
  Edit2,
  Plus,
  FlaskConical,
  Zap,
  AlertCircle
} from "lucide-react";
import { toast } from "sonner";

interface PlansTabProps {
  plans: any[];
  refetchData: () => void;
}

const PlansTab = ({ plans, refetchData }: PlansTabProps) => {
  const [planModalOpen, setPlanModalOpen] = useState(false);
  const [selectedPlan, setSelectedPlan] = useState<any>(null);
  const [isSavingPlan, setIsSavingPlan] = useState(false);

  const getTierLabel = (tier: string) => {
    switch (tier.toLowerCase()) {
      case 'monthly': return 'Mensal';
      case 'yearly': return 'Anual';
      default: return tier;
    }
  };

  const handleSavePlan = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedPlan?.id || !selectedPlan?.name) return;

    // Validação básica de formato
    if (selectedPlan.stripe_price_id_test?.startsWith('prod_') || selectedPlan.stripe_price_id_live?.startsWith('prod_')) {
      toast.error("Atenção: Você usou um ID de Produto (prod_). Use o ID do Preço (price_).");
      return;
    }

    setIsSavingPlan(true);
    try {
      const { error } = await supabase.from("plans").upsert({
        ...selectedPlan,
        features: Array.isArray(selectedPlan.features) ? selectedPlan.features : selectedPlan.features.split('\n').filter((f: string) => f.trim() !== '')
      });
      if (error) throw error;
      toast.success("Plano salvo!");
      setPlanModalOpen(false);
      refetchData();
    } catch (error: any) {
      toast.error("Erro ao salvar plano.");
    } finally {
      setIsSavingPlan(false);
    }
  };

  return (
    <>
      <div className="mb-4 flex justify-end">
        <Button onClick={() => { setSelectedPlan({ id: '', name: '', price: '', period: 'mês', features: '', stripe_price_id_test: '', stripe_price_id_live: '' }); setPlanModalOpen(true); }} className="gap-2">
          <Plus className="h-4 w-4" /> Novo Plano
        </Button>
      </div>
      <div className="rounded-xl border bg-card overflow-x-auto shadow-sm">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Nome</TableHead>
              <TableHead>Preço</TableHead>
              <TableHead>Stripe IDs (Price ID)</TableHead>
              <TableHead className="text-right">Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            <TableRow>
              <TableCell>
                <div className="font-medium">Teste Grátis (Sistema)</div>
                <div className="text-xs text-muted-foreground text-primary">Plano Padrão de Cadastro</div>
              </TableCell>
              <TableCell>R$ 0,00/30 dias</TableCell>
              <TableCell><Badge variant="outline">Automático</Badge></TableCell>
              <TableCell className="text-right">
                <span className="text-xs text-muted-foreground px-2">Gerido pelo sistema</span>
              </TableCell>
            </TableRow>
            {plans.length > 0 ? plans.map(p => (
              <TableRow key={p.id}>
                <TableCell>
                  <div className="font-medium">{getTierLabel(p.name)}</div>
                  <div className="text-xs text-muted-foreground">{p.id}</div>
                </TableCell>
                <TableCell>{p.price}/{p.period}</TableCell>
                <TableCell>
                  <div className="flex flex-col gap-1">
                    <div className="flex items-center gap-1 text-[10px]">
                      <FlaskConical className="h-3 w-3 text-amber-500" />
                      <span className={p.stripe_price_id_test?.startsWith('prod_') ? "text-destructive font-bold" : "truncate max-w-[150px]"}>
                        {p.stripe_price_id_test || 'Não config.'}
                      </span>
                    </div>
                    <div className="flex items-center gap-1 text-[10px]">
                      <Zap className="h-3 w-3 text-success" />
                      <span className={p.stripe_price_id_live?.startsWith('prod_') ? "text-destructive font-bold" : "truncate max-w-[150px]"}>
                        {p.stripe_price_id_live || 'Não config.'}
                      </span>
                    </div>
                  </div>
                </TableCell>
                <TableCell className="text-right">
                  <Button variant="ghost" size="sm" onClick={() => { setSelectedPlan({ ...p, features: Array.isArray(p.features) ? p.features.join('\n') : '' }); setPlanModalOpen(true); }}>
                    <Edit2 className="h-4 w-4" />
                  </Button>
                </TableCell>
              </TableRow>
            )) : null}
          </TableBody>
        </Table>
      </div>

      <Dialog open={planModalOpen} onOpenChange={setPlanModalOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>{selectedPlan?.created_at ? "Editar Plano" : "Novo Plano"}</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSavePlan} className="space-y-4">
            <div className="bg-amber-50 border border-amber-200 p-3 rounded-lg flex gap-3 items-start">
              <AlertCircle className="h-5 w-5 text-amber-600 shrink-0 mt-0.5" />
              <p className="text-xs text-amber-800">
                <strong>Importante:</strong> Use o <strong>ID do Preço</strong> (começa com <code>price_...</code>) e não o ID do Produto. Você encontra esse ID na seção "Preços" dentro do produto no painel da Stripe.
              </p>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>ID do Plano (Slug)</Label>
                <Input value={selectedPlan?.id || ''} onChange={e => setSelectedPlan({...selectedPlan, id: e.target.value})} disabled={!!selectedPlan?.created_at} />
              </div>
              <div className="space-y-2">
                <Label>Nome</Label>
                <Input value={selectedPlan?.name || ''} onChange={e => setSelectedPlan({...selectedPlan, name: e.target.value})} />
              </div>
            </div>
            
            <div className="grid grid-cols-2 gap-4 p-4 bg-secondary/20 rounded-lg border">
              <div className="space-y-2">
                <Label className="flex items-center gap-2 text-amber-600"><FlaskConical className="h-3 w-3" /> Stripe Price ID (Teste)</Label>
                <Input placeholder="price_..." value={selectedPlan?.stripe_price_id_test || ''} onChange={e => setSelectedPlan({...selectedPlan, stripe_price_id_test: e.target.value})} />
              </div>
              <div className="space-y-2">
                <Label className="flex items-center gap-2 text-success"><Zap className="h-3 w-3" /> Stripe Price ID (Produção)</Label>
                <Input placeholder="price_..." value={selectedPlan?.stripe_price_id_live || ''} onChange={e => setSelectedPlan({...selectedPlan, stripe_price_id_live: e.target.value})} />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Preço Exibido</Label>
                <Input value={selectedPlan?.price || ''} onChange={e => setSelectedPlan({...selectedPlan, price: e.target.value})} />
              </div>
              <div className="space-y-2">
                <Label>Período</Label>
                <Input value={selectedPlan?.period || ''} onChange={e => setSelectedPlan({...selectedPlan, period: e.target.value})} />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Recursos (um por linha)</Label>
              <Textarea value={selectedPlan?.features || ''} onChange={e => setSelectedPlan({...selectedPlan, features: e.target.value})} rows={5} />
            </div>
            <div className="flex items-center justify-between p-4 border rounded-lg">
              <Label>Plano Popular</Label>
              <Switch checked={!!selectedPlan?.popular} onCheckedChange={c => setSelectedPlan({...selectedPlan, popular: c})} />
            </div>
            <DialogFooter>
              <Button type="button" variant="ghost" onClick={() => setPlanModalOpen(false)}>Cancelar</Button>
              <Button type="submit" disabled={isSavingPlan}>{isSavingPlan ? <Loader2 className="animate-spin h-4 w-4 mr-2" /> : null} Salvar</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
};

export default PlansTab;