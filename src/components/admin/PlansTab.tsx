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
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Loader2, Edit2, Plus, Info, Settings2 } from "lucide-react";
import { toast } from "sonner";

interface PlansTabProps {
  plans: any[];
  refetchData: () => void;
}

const PlansTab = ({ plans, refetchData }: PlansTabProps) => {
  const [planModalOpen, setPlanModalOpen] = useState(false);
  const [selectedPlan, setSelectedPlan] = useState<any>(null);
  const [isSavingPlan, setIsSavingPlan] = useState(false);

  const dbFreeTrial = plans.find((p) => p.id === "free_trial");

  const getTierLabel = (tier: string) => {
    switch (tier.toLowerCase()) {
      case "monthly":
        return "Mensal";
      case "yearly":
        return "Anual";
      case "free_trial":
        return "Teste Gratis (Sistema)";
      default:
        return tier;
    }
  };

  const handleEditFreeTrial = () => {
    if (dbFreeTrial) {
      setSelectedPlan({
        ...dbFreeTrial,
        features: Array.isArray(dbFreeTrial.features) ? dbFreeTrial.features.join("\n") : "",
        asaas_installment_max: dbFreeTrial.asaas_installment_max ?? 1,
      });
    } else {
      setSelectedPlan({
        id: "free_trial",
        name: "Teste Gratis (Sistema)",
        price: "R$ 0,00",
        period: "30 dias",
        description: "Plano padrao de cadastro",
        features: "Perfil basico\nVisibilidade limitada\nSuporte por email",
        asaas_installment_max: 1,
      });
    }
    setPlanModalOpen(true);
  };

  const handleSavePlan = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedPlan?.id || !selectedPlan?.name) return;

    setIsSavingPlan(true);
    try {
      const payload = {
        ...selectedPlan,
        asaas_installment_max: Number(selectedPlan.asaas_installment_max || 1),
        features: Array.isArray(selectedPlan.features)
          ? selectedPlan.features
          : String(selectedPlan.features || "")
              .split("\n")
              .filter((f: string) => f.trim() !== ""),
      };

      const { error } = await supabase.from("plans").upsert(payload);
      if (error) throw error;

      toast.success("Plano salvo!");
      setPlanModalOpen(false);
      refetchData();
    } catch {
      toast.error("Erro ao salvar plano.");
    } finally {
      setIsSavingPlan(false);
    }
  };

  return (
    <>
      <div className="mb-4 flex justify-end">
        <Button
          onClick={() => {
            setSelectedPlan({
              id: "",
              name: "",
              price: "",
              period: "mes",
              features: "",
              asaas_installment_max: 1,
            });
            setPlanModalOpen(true);
          }}
          className="gap-2"
        >
          <Plus className="h-4 w-4" /> Novo Plano
        </Button>
      </div>

      <div className="rounded-xl border bg-card overflow-x-auto shadow-sm">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Nome</TableHead>
              <TableHead>Preco</TableHead>
              <TableHead>Parcelamento</TableHead>
              <TableHead className="text-right">Acoes</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            <TableRow className="bg-muted/30">
              <TableCell>
                <div className="font-medium">{dbFreeTrial?.name || "Teste Gratis (Sistema)"}</div>
                <div className="text-xs text-muted-foreground text-primary">
                  {dbFreeTrial?.description || "Plano padrao de cadastro"}
                </div>
              </TableCell>
              <TableCell>
                {dbFreeTrial?.price || "R$ 0,00"}/{dbFreeTrial?.period || "30 dias"}
              </TableCell>
              <TableCell>
                <Badge variant="outline" className="gap-1">
                  <Settings2 className="h-3 w-3" /> Automatico
                </Badge>
              </TableCell>
              <TableCell className="text-right">
                <Button variant="ghost" size="sm" onClick={handleEditFreeTrial} title="Editar plano de sistema">
                  <Edit2 className="h-4 w-4" />
                </Button>
              </TableCell>
            </TableRow>

            {plans
              .filter((p) => p.id !== "free_trial")
              .map((p) => (
                <TableRow key={p.id}>
                  <TableCell>
                    <div className="font-medium">{getTierLabel(p.name)}</div>
                    <div className="text-xs text-muted-foreground">{p.id}</div>
                  </TableCell>
                  <TableCell>
                    {p.price}/{p.period}
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline">Ate {Number(p.asaas_installment_max || 1)}x</Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        setSelectedPlan({
                          ...p,
                          features: Array.isArray(p.features) ? p.features.join("\n") : "",
                          asaas_installment_max: p.asaas_installment_max ?? 1,
                        });
                        setPlanModalOpen(true);
                      }}
                    >
                      <Edit2 className="h-4 w-4" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
          </TableBody>
        </Table>
      </div>

      <Dialog open={planModalOpen} onOpenChange={setPlanModalOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>
              {selectedPlan?.id === "free_trial"
                ? "Editar Plano de Sistema"
                : selectedPlan?.created_at
                ? "Editar Plano"
                : "Novo Plano"}
            </DialogTitle>
          </DialogHeader>

          <form onSubmit={handleSavePlan} className="space-y-4">
            {selectedPlan?.id === "free_trial" && (
              <div className="bg-amber-50 border border-amber-200 p-3 rounded-lg flex gap-3 items-start">
                <Info className="h-5 w-5 text-amber-600 shrink-0 mt-0.5" />
                <p className="text-xs text-amber-800">
                  Este plano e aplicado automaticamente para novos profissionais. O ID <strong>free_trial</strong>
                  permanece fixo no sistema.
                </p>
              </div>
            )}

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>ID do Plano (slug)</Label>
                <Input
                  value={selectedPlan?.id || ""}
                  onChange={(e) => setSelectedPlan({ ...selectedPlan, id: e.target.value })}
                  disabled={!!selectedPlan?.created_at || selectedPlan?.id === "free_trial"}
                />
              </div>
              <div className="space-y-2">
                <Label>Nome Exibido</Label>
                <Input
                  value={selectedPlan?.name || ""}
                  onChange={(e) => setSelectedPlan({ ...selectedPlan, name: e.target.value })}
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label>Subtitulo / Descricao Curta</Label>
              <Input
                value={selectedPlan?.description || ""}
                onChange={(e) => setSelectedPlan({ ...selectedPlan, description: e.target.value })}
              />
            </div>

            {selectedPlan?.id !== "free_trial" && (
              <div className="space-y-2 p-4 bg-secondary/20 rounded-lg border">
                <Label>Parcelamento maximo no checkout (Asaas)</Label>
                <Input
                  type="number"
                  min={1}
                  max={12}
                  value={selectedPlan?.asaas_installment_max || 1}
                  onChange={(e) =>
                    setSelectedPlan({
                      ...selectedPlan,
                      asaas_installment_max: parseInt(e.target.value || "1", 10) || 1,
                    })
                  }
                />
              </div>
            )}

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Preco Exibido</Label>
                <Input
                  value={selectedPlan?.price || ""}
                  onChange={(e) => setSelectedPlan({ ...selectedPlan, price: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label>Periodo</Label>
                <Input
                  value={selectedPlan?.period || ""}
                  onChange={(e) => setSelectedPlan({ ...selectedPlan, period: e.target.value })}
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label>Recursos (um por linha)</Label>
              <Textarea
                value={selectedPlan?.features || ""}
                onChange={(e) => setSelectedPlan({ ...selectedPlan, features: e.target.value })}
                rows={5}
              />
            </div>

            {selectedPlan?.id !== "free_trial" && (
              <div className="flex items-center justify-between p-4 border rounded-lg">
                <Label>Plano Popular</Label>
                <Switch
                  checked={!!selectedPlan?.popular}
                  onCheckedChange={(c) => setSelectedPlan({ ...selectedPlan, popular: c })}
                />
              </div>
            )}

            <DialogFooter>
              <Button type="button" variant="ghost" onClick={() => setPlanModalOpen(false)}>
                Cancelar
              </Button>
              <Button type="submit" disabled={isSavingPlan}>
                {isSavingPlan ? <Loader2 className="animate-spin h-4 w-4 mr-2" /> : null} Salvar
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
};

export default PlansTab;
