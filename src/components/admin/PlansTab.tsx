"use client";

import { useEffect, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useSiteConfig } from "@/hooks/use-site-config";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { AlertTriangle, CheckCircle2, Clock, Loader2, Edit2, Plus, Info, RefreshCw, Settings2, Sparkles, XCircle } from "lucide-react";
import { toast } from "sonner";

interface PlansTabProps {
  plans: any[];
  refetchData: () => void;
}

type AutomationTarget = "free_trial" | "monthly_coupon" | "both";

interface AutomationRun {
  id: string;
  action: string;
  trigger_source: string;
  status: "running" | "success" | "failed" | "warning";
  started_at: string;
  finished_at: string | null;
  checked_count: number;
  notified_count: number;
  bonus_upgrades_count: number;
  error_message: string | null;
  metadata?: Record<string, any> | null;
}

const normalizeAutomationTarget = (value: unknown): AutomationTarget => {
  const normalized = String(value || "").trim().toLowerCase();
  if (normalized === "monthly_coupon" || normalized === "both") return normalized;
  return "free_trial";
};

const PlansTab = ({ plans, refetchData }: PlansTabProps) => {
  const queryClient = useQueryClient();
  const { data: siteConfig } = useSiteConfig();
  const [planModalOpen, setPlanModalOpen] = useState(false);
  const [selectedPlan, setSelectedPlan] = useState<any>(null);
  const [isSavingPlan, setIsSavingPlan] = useState(false);
  const [isSavingAutomation, setIsSavingAutomation] = useState(false);
  const [isLoadingAutomationHealth, setIsLoadingAutomationHealth] = useState(false);
  const [automationRuns, setAutomationRuns] = useState<AutomationRun[]>([]);
  const [automationEnabled, setAutomationEnabled] = useState(true);
  const [automationTarget, setAutomationTarget] = useState<AutomationTarget>("free_trial");

  const dbFreeTrial = plans.find((p) => p.id === "free_trial");

  const parseFreeTrialDays = (periodValue: string | null | undefined) => {
    const text = String(periodValue || "").toLowerCase();
    const match = text.match(/\d+/);
    const value = match ? Number(match[0]) : 7;
    return Number.isFinite(value) && value > 0 ? value : 7;
  };

  const getTierLabel = (tier: string) => {
    switch (tier.toLowerCase()) {
      case "monthly":
        return "Mensal";
      case "yearly":
        return "Anual";
      case "free_trial":
        return "Teste Grátis (Sistema)";
      default:
        return tier;
    }
  };

  useEffect(() => {
    setAutomationEnabled(siteConfig?.free_trial_monthly_upgrade_enabled !== false);
    setAutomationTarget(normalizeAutomationTarget(siteConfig?.free_trial_monthly_upgrade_target));
  }, [siteConfig?.free_trial_monthly_upgrade_enabled, siteConfig?.free_trial_monthly_upgrade_target]);

  const hasAutomationChanges =
    automationEnabled !== (siteConfig?.free_trial_monthly_upgrade_enabled !== false) ||
    automationTarget !== normalizeAutomationTarget(siteConfig?.free_trial_monthly_upgrade_target);

  const loadAutomationHealth = async () => {
    setIsLoadingAutomationHealth(true);
    try {
      const { data, error } = await supabase
        .from("subscription_automation_runs")
        .select("id,action,trigger_source,status,started_at,finished_at,checked_count,notified_count,bonus_upgrades_count,error_message,metadata")
        .eq("automation_key", "subscription_expiry_alerts")
        .order("started_at", { ascending: false })
        .limit(10);

      if (error) throw error;
      setAutomationRuns((data || []) as AutomationRun[]);
    } catch (error) {
      console.error("[PlansTab] Erro ao carregar saude da automacao:", error);
      setAutomationRuns([]);
    } finally {
      setIsLoadingAutomationHealth(false);
    }
  };

  useEffect(() => {
    void loadAutomationHealth();
  }, []);

  const formatDateTime = (value?: string | null) => {
    if (!value) return "-";
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return "-";
    return date.toLocaleString("pt-BR", {
      dateStyle: "short",
      timeStyle: "short",
    });
  };

  const getHealthSummary = () => {
    const lastProcessSuccess = automationRuns.find((run) => run.action === "process" && run.status === "success");
    const lastRun = automationRuns[0] || null;
    const lastSuccessAt = lastProcessSuccess?.finished_at || lastProcessSuccess?.started_at || null;
    const hoursSinceLastSuccess = lastSuccessAt
      ? (Date.now() - new Date(lastSuccessAt).getTime()) / (1000 * 60 * 60)
      : null;
    const stale = !lastSuccessAt || (hoursSinceLastSuccess !== null && hoursSinceLastSuccess > 24);

    if (!automationEnabled) {
      return {
        icon: <Clock className="h-5 w-5 text-muted-foreground" />,
        label: "Automação desativada",
        badge: <Badge variant="outline">Desativada</Badge>,
        description: "A renovação automática por bônus está desligada na configuração atual.",
        lastRun,
        lastSuccessAt,
        stale: false,
      };
    }

    if (stale) {
      return {
        icon: <AlertTriangle className="h-5 w-5 text-destructive" />,
        label: "Sem sucesso recente",
        badge: <Badge variant="destructive">Atenção</Badge>,
        description: lastSuccessAt
          ? `Última execução bem-sucedida em ${formatDateTime(lastSuccessAt)}.`
          : "Nenhuma execução bem-sucedida registrada ainda.",
        lastRun,
        lastSuccessAt,
        stale: true,
      };
    }

    if (lastRun?.status === "failed") {
      return {
        icon: <XCircle className="h-5 w-5 text-destructive" />,
        label: "Última execução falhou",
        badge: <Badge variant="destructive">Falha</Badge>,
        description: lastRun.error_message || "A última execução registrou falha.",
        lastRun,
        lastSuccessAt,
        stale: false,
      };
    }

    return {
      icon: <CheckCircle2 className="h-5 w-5 text-success" />,
      label: "Operacional",
      badge: <Badge className="bg-success text-success-foreground">Saudável</Badge>,
      description: `Última execução bem-sucedida em ${formatDateTime(lastSuccessAt)}.`,
      lastRun,
      lastSuccessAt,
      stale: false,
    };
  };

  const healthSummary = getHealthSummary();

  const handleEditFreeTrial = () => {
    if (dbFreeTrial) {
      setSelectedPlan({
        ...dbFreeTrial,
        features: Array.isArray(dbFreeTrial.features) ? dbFreeTrial.features.join("\n") : "",
        asaas_installment_max: dbFreeTrial.asaas_installment_max ?? 1,
        free_trial_days: parseFreeTrialDays(dbFreeTrial.period),
      });
    } else {
      setSelectedPlan({
        id: "free_trial",
        name: "Teste Grátis (Sistema)",
        price: "R$ 0,00",
        period: "7 dias",
        description: "Plano padrão de cadastro",
        features: "Perfil básico\nVisibilidade limitada\nSuporte por email",
        asaas_installment_max: 1,
        free_trial_days: 7,
      });
    }
    setPlanModalOpen(true);
  };

  const handleSavePlan = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedPlan?.id || !selectedPlan?.name) return;

    setIsSavingPlan(true);
    try {
      const normalizedId = String(selectedPlan.id || "").trim();
      const freeTrialDays = Math.max(1, Number(selectedPlan.free_trial_days || parseFreeTrialDays(selectedPlan.period)));
      const payload = {
        id: normalizedId,
        name: String(selectedPlan.name || "").trim(),
        price: selectedPlan.price ?? "",
        period: normalizedId === "free_trial" ? `${freeTrialDays} dias` : selectedPlan.period ?? "",
        description: selectedPlan.description ?? "",
        popular: !!selectedPlan.popular,
        asaas_installment_max: Number(selectedPlan.asaas_installment_max || 1),
        features: Array.isArray(selectedPlan.features)
          ? selectedPlan.features
          : String(selectedPlan.features || "")
              .split("\n")
              .map((f: string) => f.trim())
              .filter((f: string) => f !== ""),
      };

      const isExistingPlan = plans.some((p) => p.id === normalizedId);
      const isSystemPlan = normalizedId === "free_trial";

      const { error } = isExistingPlan || isSystemPlan
        ? await supabase.from("plans").update(payload).eq("id", normalizedId)
        : await supabase.from("plans").insert(payload);

      if (error) throw error;

      toast.success("Plano salvo!");
      setPlanModalOpen(false);
      refetchData();
    } catch (error: any) {
      console.error("[PlansTab] Erro ao salvar plano:", error);
      toast.error("Erro ao salvar plano.", {
        description: error?.message || "Verifique os dados e tente novamente.",
      });
    } finally {
      setIsSavingPlan(false);
    }
  };

  const handleSaveAutomation = async () => {
    setIsSavingAutomation(true);
    try {
      const { error } = await supabase
        .from("site_config")
        .update({
          free_trial_monthly_upgrade_enabled: automationEnabled,
          free_trial_monthly_upgrade_target: automationTarget,
          updated_at: new Date().toISOString(),
        })
        .eq("id", 1);

      if (error) throw error;

      await queryClient.invalidateQueries({ queryKey: ["site-config"] });
      toast.success("Configuração da automação salva.");
    } catch (error: any) {
      console.error("[PlansTab] Erro ao salvar automação:", error);
      toast.error(error?.message || "Erro ao salvar configuração da automação.");
    } finally {
      setIsSavingAutomation(false);
    }
  };

  return (
    <>
      <Tabs defaultValue="plans" className="space-y-4">
        <TabsList className="grid w-full max-w-md grid-cols-2">
          <TabsTrigger value="plans">Planos</TabsTrigger>
          <TabsTrigger value="automation">Automação 30 dias</TabsTrigger>
        </TabsList>

        <TabsContent value="plans" className="space-y-4">
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
                  <TableHead>Preço</TableHead>
                  <TableHead>Parcelamento</TableHead>
                  <TableHead className="text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                <TableRow className="bg-muted/30">
                  <TableCell>
                    <div className="font-medium">{dbFreeTrial?.name || "Teste Grátis (Sistema)"}</div>
                    <div className="text-xs text-muted-foreground text-primary">
                      {dbFreeTrial?.description || "Plano padrão de cadastro"}
                    </div>
                  </TableCell>
                  <TableCell>
                    {dbFreeTrial?.price || "R$ 0,00"}/{dbFreeTrial?.period || "7 dias"}
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline" className="gap-1">
                      <Settings2 className="h-3 w-3" /> Automático
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
                        <Badge variant="outline">Até {Number(p.asaas_installment_max || 1)}x</Badge>
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
        </TabsContent>

        <TabsContent value="automation" className="space-y-4">
          <Card className="border-primary/20">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Sparkles className="h-5 w-5 text-primary" />
                Bônus automático de 30 dias
              </CardTitle>
              <CardDescription>
                Controla a concessão automática de mais 30 dias gratuitos no Plano Mensal quando um período gratuito expira, incluindo o plano gratuito de 7 dias.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="rounded-lg border p-4">
                <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
                  <div className="flex gap-3">
                    <div className="mt-0.5">{healthSummary.icon}</div>
                    <div className="space-y-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="font-semibold">{healthSummary.label}</p>
                        {healthSummary.badge}
                      </div>
                      <p className="text-xs text-muted-foreground">{healthSummary.description}</p>
                      {healthSummary.lastRun?.error_message ? (
                        <p className="text-xs text-destructive">{healthSummary.lastRun.error_message}</p>
                      ) : null}
                    </div>
                  </div>
                  <Button variant="outline" size="sm" onClick={loadAutomationHealth} disabled={isLoadingAutomationHealth} className="gap-2">
                    <RefreshCw className={`h-4 w-4 ${isLoadingAutomationHealth ? "animate-spin" : ""}`} />
                    Atualizar status
                  </Button>
                </div>

                <div className="mt-4 grid gap-3 md:grid-cols-4">
                  <div className="rounded-md bg-secondary/40 p-3">
                    <p className="text-[10px] font-semibold uppercase text-muted-foreground">Último sucesso</p>
                    <p className="text-sm">{formatDateTime(healthSummary.lastSuccessAt)}</p>
                  </div>
                  <div className="rounded-md bg-secondary/40 p-3">
                    <p className="text-[10px] font-semibold uppercase text-muted-foreground">Última execução</p>
                    <p className="text-sm">{formatDateTime(healthSummary.lastRun?.started_at)}</p>
                  </div>
                  <div className="rounded-md bg-secondary/40 p-3">
                    <p className="text-[10px] font-semibold uppercase text-muted-foreground">Bônus no último run</p>
                    <p className="text-sm">{healthSummary.lastRun?.bonus_upgrades_count ?? 0}</p>
                  </div>
                  <div className="rounded-md bg-secondary/40 p-3">
                    <p className="text-[10px] font-semibold uppercase text-muted-foreground">Notificações</p>
                    <p className="text-sm">{healthSummary.lastRun?.notified_count ?? 0}</p>
                  </div>
                </div>

                {automationRuns.length > 0 ? (
                  <div className="mt-4 overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Quando</TableHead>
                          <TableHead>Ação</TableHead>
                          <TableHead>Status</TableHead>
                          <TableHead className="text-right">Checados</TableHead>
                          <TableHead className="text-right">Bônus</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {automationRuns.slice(0, 5).map((run) => (
                          <TableRow key={run.id}>
                            <TableCell className="whitespace-nowrap text-xs">{formatDateTime(run.started_at)}</TableCell>
                            <TableCell className="text-xs">{run.action === "health_check" ? "Monitoramento" : "Processamento"}</TableCell>
                            <TableCell>
                              <Badge variant={run.status === "success" ? "outline" : run.status === "running" ? "secondary" : "destructive"}>
                                {run.status === "success"
                                  ? "Sucesso"
                                  : run.status === "running"
                                    ? "Rodando"
                                    : run.status === "warning"
                                      ? "Atenção"
                                      : "Falha"}
                              </Badge>
                            </TableCell>
                            <TableCell className="text-right text-xs">{run.checked_count}</TableCell>
                            <TableCell className="text-right text-xs">{run.bonus_upgrades_count}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                ) : null}
              </div>

              <div className="flex items-center justify-between rounded-lg border p-4">
                <div className="space-y-1">
                  <Label>Ativar automação</Label>
                  <p className="text-[11px] text-muted-foreground">
                    Quando habilitada, o sistema aplica o bônus automaticamente para os públicos escolhidos abaixo e envia notificação individual.
                  </p>
                </div>
                <Switch checked={automationEnabled} onCheckedChange={setAutomationEnabled} />
              </div>

              <div className="space-y-2">
                <Label>Aplicar automaticamente para</Label>
                <Select value={automationTarget} onValueChange={(value) => setAutomationTarget(normalizeAutomationTarget(value))}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="free_trial">Somente plano gratuito de 7 dias expirado</SelectItem>
                    <SelectItem value="monthly_coupon">Somente mensal gratuito via cupom expirado</SelectItem>
                    <SelectItem value="both">Plano gratuito de 7 dias e mensal via cupom</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="rounded-lg border bg-secondary/20 p-4 text-xs text-muted-foreground">
                O fluxo automático mantém o usuário no plano mensal, adiciona mais 30 dias gratuitos, evita cobrança automática nesse bônus e tenta enviar e-mail, WhatsApp e notificação interna.
              </div>

              <div className="flex justify-end">
                <Button onClick={handleSaveAutomation} disabled={isSavingAutomation || !hasAutomationChanges} className="gap-2">
                  {isSavingAutomation ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
                  Salvar automação
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

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
                  Este plano é aplicado automaticamente para novos profissionais. O ID <strong>free_trial</strong>
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
              <Label>Subtítulo / Descrição Curta</Label>
              <Input
                value={selectedPlan?.description || ""}
                onChange={(e) => setSelectedPlan({ ...selectedPlan, description: e.target.value })}
              />
            </div>

            {selectedPlan?.id !== "free_trial" && (
              <div className="space-y-2 p-4 bg-secondary/20 rounded-lg border">
                <Label>Parcelamento máximo no checkout (Asaas)</Label>
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
                <Label>Preço Exibido</Label>
                <Input
                  value={selectedPlan?.price || ""}
                  onChange={(e) => setSelectedPlan({ ...selectedPlan, price: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                {selectedPlan?.id === "free_trial" ? (
                  <>
                    <Label>Dias grátis ativos</Label>
                    <Input
                      type="number"
                      min={1}
                      max={365}
                      value={selectedPlan?.free_trial_days || parseFreeTrialDays(selectedPlan?.period)}
                      onChange={(e) =>
                        setSelectedPlan({
                          ...selectedPlan,
                          free_trial_days: Math.max(1, Number(e.target.value || 7)),
                          period: `${Math.max(1, Number(e.target.value || 7))} dias`,
                        })
                      }
                    />
                  </>
                ) : (
                  <>
                    <Label>Período</Label>
                    <Input
                      value={selectedPlan?.period || ""}
                      onChange={(e) => setSelectedPlan({ ...selectedPlan, period: e.target.value })}
                    />
                  </>
                )}
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
