"use client";

import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Eye, Loader2, RefreshCw, Save, ShieldCheck, Wallet } from "lucide-react";
import { toast } from "sonner";

const currency = (value: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(Number(value || 0));

const batchStatusLabel: Record<string, string> = {
  draft: "Rascunho",
  approved: "Aprovado",
  paid: "Pago",
  canceled: "Cancelado",
};

const partnerStatusLabel: Record<string, string> = {
  active: "Ativo",
  inactive: "Inativo",
  blocked: "Bloqueado",
};

const applicationStatusLabel: Record<string, string> = {
  pending: "Pendente",
  approved: "Aprovado",
  rejected: "Rejeitado",
};

const parseNumber = (value: string, fallback: number) => {
  const raw = String(value || "").trim();
  const normalized =
    raw.includes(",") && raw.includes(".")
      ? raw.replace(/\./g, "").replace(",", ".")
      : raw.includes(",")
      ? raw.replace(",", ".")
      : raw;

  const parsed = Number(normalized);
  if (!Number.isFinite(parsed)) return fallback;
  return parsed;
};

const formatMonth = () => {
  const now = new Date();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  return `${now.getFullYear()}-${month}`;
};

const AffiliatesAdminPage = () => {
  const [isSavingConfig, setIsSavingConfig] = useState(false);
  const [isApprovingBatch, setIsApprovingBatch] = useState(false);
  const [isReconciling, setIsReconciling] = useState(false);
  const [payingBatchId, setPayingBatchId] = useState<string | null>(null);
  const [reviewingApplicationId, setReviewingApplicationId] = useState<string | null>(null);
  const [selectedApplication, setSelectedApplication] = useState<any | null>(null);

  const [enabled, setEnabled] = useState(false);
  const [shadowMode, setShadowMode] = useState(true);
  const [signupAmount, setSignupAmount] = useState("50");
  const [recurringPercent, setRecurringPercent] = useState("10");
  const [minimumAmount, setMinimumAmount] = useState("100");

  const { data, isLoading, refetch, isRefetching } = useQuery({
    queryKey: ["admin-affiliates"],
    queryFn: async () => {
      const { data, error } = await supabase.functions.invoke("affiliate-admin-list");
      if (error) throw error;
      return data as any;
    },
  });

  const config = data?.config || {};
  const partners = Array.isArray(data?.partners) ? data.partners : [];
  const batches = Array.isArray(data?.batches) ? data.batches : [];
  const applications = Array.isArray(data?.applications) ? data.applications : [];
  const pendingApplications = applications.filter((row: any) => row.status === "pending");

  useEffect(() => {
    setEnabled(config?.affiliate_program_enabled === true);
    setShadowMode(config?.affiliate_shadow_mode !== false);
    setSignupAmount(String(config?.signup_commission_amount ?? "50"));
    setRecurringPercent(String(config?.recurring_commission_percent ?? "10"));
    setMinimumAmount(String(config?.payout_minimum_amount ?? "100"));
  }, [
    config?.affiliate_program_enabled,
    config?.affiliate_shadow_mode,
    config?.signup_commission_amount,
    config?.recurring_commission_percent,
    config?.payout_minimum_amount,
  ]);

  const hasConfigChanges = useMemo(() => {
    const currentSignup = Number(config?.signup_commission_amount ?? 50);
    const currentRecurring = Number(config?.recurring_commission_percent ?? 10);
    const currentMinimum = Number(config?.payout_minimum_amount ?? 100);

    return (
      enabled !== (config?.affiliate_program_enabled === true) ||
      shadowMode !== (config?.affiliate_shadow_mode !== false) ||
      parseNumber(signupAmount, currentSignup) !== currentSignup ||
      parseNumber(recurringPercent, currentRecurring) !== currentRecurring ||
      parseNumber(minimumAmount, currentMinimum) !== currentMinimum
    );
  }, [
    enabled,
    shadowMode,
    signupAmount,
    recurringPercent,
    minimumAmount,
    config?.affiliate_program_enabled,
    config?.affiliate_shadow_mode,
    config?.signup_commission_amount,
    config?.recurring_commission_percent,
    config?.payout_minimum_amount,
  ]);

  const handleSaveConfig = async () => {
    setIsSavingConfig(true);

    try {
      const signup = parseNumber(signupAmount, 50);
      const recurring = parseNumber(recurringPercent, 10);
      const minimum = parseNumber(minimumAmount, 100);

      if (signup < 0 || recurring < 0 || minimum < 0) {
        toast.error("Valores de comissao e minimo precisam ser positivos.");
        return;
      }

      const { error } = await supabase.from("affiliate_program_config").upsert(
        {
          id: 1,
          affiliate_program_enabled: enabled,
          affiliate_shadow_mode: shadowMode,
          signup_commission_amount: signup,
          recurring_commission_percent: recurring,
          payout_minimum_amount: minimum,
          payout_cycle: "monthly",
          recurring_duration_mode: "while_active",
          updated_at: new Date().toISOString(),
        },
        { onConflict: "id" },
      );

      if (error) throw error;
      toast.success("Configuracao do programa atualizada.");
      await refetch();
    } catch (error: any) {
      toast.error(error?.message || "Erro ao salvar configuracoes.");
    } finally {
      setIsSavingConfig(false);
    }
  };

  const handleApproveBatch = async () => {
    setIsApprovingBatch(true);
    try {
      const { data, error } = await supabase.functions.invoke("affiliate-admin-approve-payout", {
        body: { period_label: formatMonth() },
      });
      if (error) throw error;

      if (data?.created) {
        toast.success(`Lote criado com ${data.total_affiliates || 0} afiliado(s).`);
      } else {
        toast.message(data?.message || "Nenhum lote elegivel neste momento.");
      }
      await refetch();
    } catch (error: any) {
      toast.error(error?.message || "Erro ao aprovar lote.");
    } finally {
      setIsApprovingBatch(false);
    }
  };

  const handleMarkPaid = async (batchId: string) => {
    const paymentReference = window.prompt("Referencia/comprovante do pagamento (opcional):", "") || "";

    setPayingBatchId(batchId);
    try {
      const { error } = await supabase.functions.invoke("affiliate-admin-mark-paid", {
        body: { batch_id: batchId, payment_reference: paymentReference || null },
      });
      if (error) throw error;

      toast.success("Lote marcado como pago.");
      await refetch();
    } catch (error: any) {
      toast.error(error?.message || "Erro ao marcar lote como pago.");
    } finally {
      setPayingBatchId(null);
    }
  };

  const handleReconcile = async () => {
    setIsReconciling(true);
    try {
      const { data, error } = await supabase.functions.invoke("affiliate-reconcile-events", {
        body: { limit: 2000 },
      });
      if (error) throw error;

      toast.success(
        `Reconciliacao concluida: cadastro ${data?.signup?.inserted || 0}, recorrente ${data?.recurring?.inserted || 0}, clawback ${data?.clawback?.inserted || 0}.`,
      );
      await refetch();
    } catch (error: any) {
      toast.error(error?.message || "Erro ao reconciliar eventos.");
    } finally {
      setIsReconciling(false);
    }
  };

  const handleReviewApplication = async (applicationId: string, decision: "approved" | "rejected") => {
    setReviewingApplicationId(applicationId);
    try {
      const { data, error } = await supabase.functions.invoke("affiliate-admin-review-application", {
        body: { application_id: applicationId, decision },
      });

      if (error) throw error;

      if (decision === "approved") {
        toast.success(data?.short_url ? `Candidatura aprovada. Link: ${data.short_url}` : "Candidatura aprovada.");
      } else {
        toast.success("Candidatura rejeitada.");
      }

      await refetch();
    } catch (error: any) {
      toast.error(error?.message || "Erro ao revisar candidatura.");
    } finally {
      setReviewingApplicationId(null);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center gap-2 text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" />
        Carregando modulo de afiliados...
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <h1 className="text-3xl font-bold tracking-tight flex items-center gap-2">
          <ShieldCheck className="h-7 w-7 text-primary" />
          Afiliados (Admin)
        </h1>
        <p className="text-muted-foreground">Gestao de parceiros, comissoes, lotes de pagamento e reconciliacao.</p>
      </div>

      <div className="flex flex-wrap gap-2">
        <Badge variant={enabled ? "default" : "secondary"}>{enabled ? "Programa ativo" : "Programa desativado"}</Badge>
        <Badge variant={shadowMode ? "outline" : "default"}>{shadowMode ? "Modo sombra" : "Payout ativo"}</Badge>
        <Badge variant="outline">Parceiros: {partners.length}</Badge>
        <Badge variant="outline">Candidaturas pendentes: {pendingApplications.length}</Badge>
        <Badge variant="outline">Lotes: {batches.length}</Badge>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Configuracoes do programa</CardTitle>
          <CardDescription>Defina regras do v1: bonus por marcos, recorrencia, minimo e rollout.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-3 md:grid-cols-2">
            <div className="rounded-lg border p-3">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-sm font-medium">Programa habilitado</p>
                  <p className="text-xs text-muted-foreground">Habilita atribuicao e ledger.</p>
                </div>
                <Switch checked={enabled} onCheckedChange={setEnabled} />
              </div>
            </div>
            <div className="rounded-lg border p-3">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-sm font-medium">Modo sombra</p>
                  <p className="text-xs text-muted-foreground">Coleta dados sem liberar payout.</p>
                </div>
                <Switch checked={shadowMode} onCheckedChange={setShadowMode} />
              </div>
            </div>
          </div>

          <div className="grid gap-3 md:grid-cols-3">
            <div className="space-y-2">
              <Label htmlFor="signup_amount">Bonus por 10 cadastros (R$)</Label>
              <Input id="signup_amount" value={signupAmount} onChange={(e) => setSignupAmount(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="recurring_percent">Comissao recorrente (%)</Label>
              <Input id="recurring_percent" value={recurringPercent} onChange={(e) => setRecurringPercent(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="minimum_amount">Minimo payout (R$)</Label>
              <Input id="minimum_amount" value={minimumAmount} onChange={(e) => setMinimumAmount(e.target.value)} />
            </div>
          </div>

          <div className="flex flex-wrap justify-end gap-2">
            <Button variant="outline" onClick={handleReconcile} disabled={isReconciling} className="gap-2">
              {isReconciling ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
              Reconciliar eventos
            </Button>
            <Button variant="outline" onClick={handleApproveBatch} disabled={isApprovingBatch || shadowMode} className="gap-2">
              {isApprovingBatch ? <Loader2 className="h-4 w-4 animate-spin" /> : <Wallet className="h-4 w-4" />}
              Aprovar lote mensal
            </Button>
            <Button onClick={handleSaveConfig} disabled={isSavingConfig || !hasConfigChanges} className="gap-2">
              {isSavingConfig ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
              Salvar configuracoes
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Candidaturas de afiliado</CardTitle>
          <CardDescription>Canal publico de cadastro para afiliados dedicados (sem role profissional).</CardDescription>
        </CardHeader>
        <CardContent>
          {applications.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nenhuma candidatura recebida.</p>
          ) : (
            <div className="rounded-md border overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Nome</TableHead>
                    <TableHead>E-mail</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Criado em</TableHead>
                    <TableHead className="text-right">Acoes</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {applications.map((application: any) => {
                    const reviewing = reviewingApplicationId === application.id;
                    const isPending = application.status === "pending";

                    return (
                      <TableRow key={application.id}>
                        <TableCell>
                          <p className="text-sm font-medium">{application.full_name || "-"}</p>
                        </TableCell>
                        <TableCell>
                          <p className="text-sm">{application.email || "-"}</p>
                        </TableCell>
                        <TableCell>
                          <Badge variant={application.status === "approved" ? "default" : "outline"}>
                            {applicationStatusLabel[application.status] || application.status}
                          </Badge>
                        </TableCell>
                        <TableCell>{new Date(application.created_at).toLocaleDateString("pt-BR")}</TableCell>
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-2">
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => setSelectedApplication(application)}
                              className="gap-1"
                            >
                              <Eye className="h-3.5 w-3.5" />
                              Ver dados
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              disabled={!isPending || reviewing}
                              onClick={() => handleReviewApplication(application.id, "rejected")}
                            >
                              Rejeitar
                            </Button>
                            <Button
                              size="sm"
                              disabled={!isPending || reviewing}
                              onClick={() => handleReviewApplication(application.id, "approved")}
                            >
                              {reviewing ? <Loader2 className="h-4 w-4 animate-spin" /> : "Aprovar"}
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={!!selectedApplication} onOpenChange={(open) => !open && setSelectedApplication(null)}>
        <DialogContent className="sm:max-w-xl">
          <DialogHeader>
            <DialogTitle>Dados da candidatura</DialogTitle>
            <DialogDescription>
              Informacoes enviadas no formulario publico de afiliado.
            </DialogDescription>
          </DialogHeader>

          {selectedApplication ? (
            <div className="grid gap-3 text-sm">
              <div className="grid grid-cols-3 gap-2">
                <span className="text-muted-foreground">Nome</span>
                <span className="col-span-2 font-medium">{selectedApplication.full_name || "-"}</span>
              </div>
              <div className="grid grid-cols-3 gap-2">
                <span className="text-muted-foreground">E-mail</span>
                <span className="col-span-2">{selectedApplication.email || "-"}</span>
              </div>
              <div className="grid grid-cols-3 gap-2">
                <span className="text-muted-foreground">Telefone</span>
                <span className="col-span-2">{selectedApplication.phone || "-"}</span>
              </div>
              <div className="grid grid-cols-3 gap-2">
                <span className="text-muted-foreground">Cidade / UF</span>
                <span className="col-span-2">
                  {selectedApplication.city || "-"} / {selectedApplication.state || "-"}
                </span>
              </div>
              <div className="grid grid-cols-3 gap-2">
                <span className="text-muted-foreground">PIX</span>
                <span className="col-span-2">
                  {selectedApplication.pix_key_type || "-"} / {selectedApplication.pix_key || "-"}
                </span>
              </div>
              <div className="grid grid-cols-3 gap-2">
                <span className="text-muted-foreground">Publico</span>
                <span className="col-span-2">{selectedApplication.audience || "-"}</span>
              </div>
              <div className="grid grid-cols-3 gap-2">
                <span className="text-muted-foreground">Experiencia</span>
                <span className="col-span-2">{selectedApplication.experience || "-"}</span>
              </div>
              <div className="grid grid-cols-3 gap-2">
                <span className="text-muted-foreground">Status</span>
                <span className="col-span-2">
                  {applicationStatusLabel[selectedApplication.status] || selectedApplication.status || "-"}
                </span>
              </div>
              <div className="grid grid-cols-3 gap-2">
                <span className="text-muted-foreground">Criado em</span>
                <span className="col-span-2">
                  {selectedApplication.created_at
                    ? new Date(selectedApplication.created_at).toLocaleString("pt-BR")
                    : "-"}
                </span>
              </div>
              <div className="space-y-1 rounded-md border p-3">
                <p className="text-xs text-muted-foreground">Mensagem complementar</p>
                <p className="whitespace-pre-wrap">{selectedApplication.message || "-"}</p>
              </div>
            </div>
          ) : null}
        </DialogContent>
      </Dialog>

      <Card>
        <CardHeader>
          <CardTitle>Parceiros afiliados</CardTitle>
          <CardDescription>Visao operacional de status, atribuicoes e saldo.</CardDescription>
        </CardHeader>
        <CardContent>
          {partners.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nenhum parceiro afiliado encontrado.</p>
          ) : (
            <div className="rounded-md border overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Parceiro</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Atribuicoes validas</TableHead>
                    <TableHead>Saldo disponivel</TableHead>
                    <TableHead>Saldo sombra</TableHead>
                    <TableHead>Acumulado</TableHead>
                    <TableHead>PIX</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {partners.map((partner: any) => (
                    <TableRow key={partner.id}>
                      <TableCell>
                        <p className="text-sm font-medium">{partner.display_name}</p>
                        <p className="text-xs text-muted-foreground">{partner.email || "Sem email"}</p>
                      </TableCell>
                      <TableCell>
                        <Badge variant={partner.status === "active" ? "default" : "secondary"}>
                          {partnerStatusLabel[partner.status] || partner.status}
                        </Badge>
                      </TableCell>
                      <TableCell>{Number(partner.attribution_valid || 0)}</TableCell>
                      <TableCell>{currency(partner.available_balance || 0)}</TableCell>
                      <TableCell>{currency(partner.shadow_balance || 0)}</TableCell>
                      <TableCell>{currency(partner.lifetime_balance || 0)}</TableCell>
                      <TableCell>
                        {partner.pix_key ? (
                          <span className="text-xs">{partner.pix_key_type || "pix"}</span>
                        ) : (
                          <span className="text-xs text-muted-foreground">Nao informado</span>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Lotes de pagamento</CardTitle>
          <CardDescription>Aprovacao e baixa manual com trilha operacional.</CardDescription>
        </CardHeader>
        <CardContent>
          {batches.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nenhum lote registrado.</p>
          ) : (
            <div className="rounded-md border overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Periodo</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Afiliados</TableHead>
                    <TableHead>Entradas</TableHead>
                    <TableHead>Total</TableHead>
                    <TableHead>Aprovado em</TableHead>
                    <TableHead>Pago em</TableHead>
                    <TableHead className="text-right">Acao</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {batches.map((batch: any) => {
                    const isPaid = batch.status === "paid";
                    const isApproving = payingBatchId === batch.id;

                    return (
                      <TableRow key={batch.id}>
                        <TableCell>{batch.period_label || "Sem periodo"}</TableCell>
                        <TableCell>
                          <Badge variant={isPaid ? "default" : "outline"}>
                            {batchStatusLabel[batch.status] || batch.status}
                          </Badge>
                        </TableCell>
                        <TableCell>{Number(batch.total_affiliates || 0)}</TableCell>
                        <TableCell>{Number(batch.total_entries || 0)}</TableCell>
                        <TableCell>{currency(batch.total_amount || 0)}</TableCell>
                        <TableCell>
                          {batch.approved_at ? new Date(batch.approved_at).toLocaleDateString("pt-BR") : "-"}
                        </TableCell>
                        <TableCell>{batch.paid_at ? new Date(batch.paid_at).toLocaleDateString("pt-BR") : "-"}</TableCell>
                        <TableCell className="text-right">
                          <Button
                            size="sm"
                            variant="outline"
                            disabled={isPaid || isApproving}
                            onClick={() => handleMarkPaid(batch.id)}
                          >
                            {isApproving ? <Loader2 className="h-4 w-4 animate-spin" /> : "Marcar pago"}
                          </Button>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      <div className="flex justify-end">
        <Button variant="outline" onClick={() => refetch()} disabled={isRefetching} className="gap-2">
          {isRefetching ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
          Atualizar painel
        </Button>
      </div>
    </div>
  );
};

export default AffiliatesAdminPage;
