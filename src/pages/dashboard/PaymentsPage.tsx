"use client";

import { Fragment, useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Loader2,
  CreditCard,
  ExternalLink,
  Receipt,
  Calendar,
  AlertCircle,
  RefreshCw,
  XCircle,
  ChevronDown,
  ChevronUp,
  Clock,
  CheckCircle2,
  LifeBuoy,
} from "lucide-react";
import { differenceInCalendarDays, format, isValid, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";
import { toast } from "sonner";
import { Link } from "react-router-dom";

interface PaymentRecord {
  id: string;
  date: number;
  amount: number;
  currency: string;
  status: string;
  raw_status?: string | null;
  description: string;
  pdf_url: string | null;
  type: "subscription" | "one_time";
  asaas_checkout_id?: string | null;
  installment_current?: number | null;
  installment_total?: number | null;
  installment_group_key?: string | null;
}

interface CancellationState {
  canCancel: boolean;
  deadline: Date | null;
  message: string;
}

interface SubscriptionSnapshot {
  tier: string | null;
  endAt: string | null;
  cancelAtPeriodEnd: boolean;
}

interface RenewalAlert {
  title: string;
  description: string;
}

interface InstallmentInfo {
  current: number;
  total: number;
}

interface InstallmentGroup {
  id: string;
  totalInstallments: number;
  items: PaymentRecord[];
  currency: string;
  totalAmount: number;
  summaryDateMs: number;
  sortDateMs: number;
}

type PaymentDisplayRow =
  | { kind: "payment"; payment: PaymentRecord }
  | { kind: "group"; group: InstallmentGroup };

type InvokeFunctionError = {
  context?: Response;
};

const CANCELLATION_WINDOW_DAYS = 7;

const readFunctionErrorMessage = async (
  funcError: InvokeFunctionError | null,
  fallback: string,
) => {
  const response = funcError?.context;
  if (!response) return fallback;

  try {
    const body = await response.clone().json();
    if (typeof body?.error === "string" && body.error.trim()) return body.error;
    if (typeof body?.message === "string" && body.message.trim()) return body.message;
  } catch {
    // Response body is not JSON.
  }

  try {
    const text = await response.clone().text();
    if (text.trim()) return text;
  } catch {
    // Response body could not be read as plain text.
  }

  return fallback;
};

const extractInstallmentInfo = (description: string): InstallmentInfo | null => {
  const match = description.match(/parcela\s+(\d+)\s+de\s+(\d+)/i);
  if (!match) return null;

  const current = Number(match[1]);
  const total = Number(match[2]);
  if (!Number.isFinite(current) || !Number.isFinite(total) || current <= 0 || total <= 1) return null;

  return { current, total };
};

const stripInstallmentInfo = (text: string) => {
  const stripped = String(text || "")
    .replace(/parcela\s+\d+\s+de\s*\d+\.?/gi, "")
    .replace(/parcelamento\s*\(\s*\d+\s*\/\s*\d+\s*\)\s*[-:]*\s*/gi, "")
    .replace(/\s*[-:]\s*$/g, "")
    .replace(/\s{2,}/g, " ")
    .trim();
  return stripped || "Plano Anual";
};

const getInstallmentInfoFromPayment = (payment: PaymentRecord): InstallmentInfo | null => {
  const current = Number(payment.installment_current);
  const total = Number(payment.installment_total);
  if (Number.isFinite(current) && Number.isFinite(total) && current > 0 && total > 1) {
    return { current, total };
  }
  return extractInstallmentInfo(payment.description);
};

const getSubscriptionTierLabel = (tier?: string | null) => {
  const value = String(tier || "").toLowerCase();
  if (value === "monthly") return "Plano Mensal";
  if (value === "yearly" || value === "annual") return "Plano Anual";
  if (value === "free_trial") return "Teste Grátis";
  return "Nenhum plano ativo";
};

const normalizeTier = (tier?: string | null) => {
  const value = String(tier || "").toLowerCase();
  return value === "annual" ? "yearly" : value;
};

const PaymentsPage = () => {
  const [payments, setPayments] = useState<PaymentRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isCancelling, setIsCancelling] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [subscriptionSnapshot, setSubscriptionSnapshot] = useState<SubscriptionSnapshot | null>(null);
  const [expandedInstallmentGroups, setExpandedInstallmentGroups] = useState<Record<string, boolean>>({});
  const [isCancelModalOpen, setIsCancelModalOpen] = useState(false);
  const [planFeaturesById, setPlanFeaturesById] = useState<Record<string, string[]>>({});

  const fetchHistory = async (silent = false) => {
    if (!silent) {
      setLoading(true);
      setError(null);
    } else {
      setIsRefreshing(true);
    }

    try {
      const { data, error: funcError } = await supabase.functions.invoke("get-payment-history");

      if (funcError) {
        const msg = await readFunctionErrorMessage(funcError, "Erro ao consultar histórico.");
        throw new Error(msg);
      }

      setPayments(data?.payments || []);

      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (user?.id) {
        const { data: profileData, error: profileError } = await supabase
          .from("profiles")
          .select("subscription_tier,subscription_end_at,cancel_at_period_end")
          .eq("id", user.id)
          .maybeSingle();

        if (!profileError && profileData) {
          setSubscriptionSnapshot({
            tier: profileData.subscription_tier || null,
            endAt: profileData.subscription_end_at || null,
            cancelAtPeriodEnd: !!profileData.cancel_at_period_end,
          });
        }
      }
    } catch (err: unknown) {
      console.error("[PaymentsPage] Erro:", err);
      const errorMessage =
        err instanceof Error && err.message
          ? err.message
          : "Não foi possível carregar seu histórico de pagamentos.";
      setError(errorMessage);
      toast.error(errorMessage);
    } finally {
      setLoading(false);
      setIsRefreshing(false);
    }
  };

  useEffect(() => {
    fetchHistory();
  }, []);

  useEffect(() => {
    const fetchPlanFeatures = async () => {
      try {
        const { data } = await supabase
          .from("plans")
          .select("id,features")
          .in("id", ["free_trial", "monthly", "yearly", "annual"]);

        const next: Record<string, string[]> = {};
        for (const plan of data || []) {
          const id = String(plan?.id || "").toLowerCase();
          if (!id) continue;
          next[id] = Array.isArray(plan?.features)
            ? plan.features.map((feature) => String(feature || "").trim()).filter(Boolean)
            : [];
        }
        setPlanFeaturesById(next);
      } catch (err) {
        console.error("[PaymentsPage] Erro ao carregar recursos dos planos:", err);
      }
    };

    fetchPlanFeatures();
  }, []);

  const renewalAlert = useMemo<RenewalAlert | null>(() => {
    if (!subscriptionSnapshot?.tier || !subscriptionSnapshot.endAt) return null;
    if (!["monthly", "yearly"].includes(subscriptionSnapshot.tier)) return null;

    const endDate = parseISO(subscriptionSnapshot.endAt);
    if (!isValid(endDate)) return null;

    const daysRemaining = differenceInCalendarDays(endDate, new Date());
    if (daysRemaining < 0 || daysRemaining > 7) return null;

    if (subscriptionSnapshot.tier === "monthly") {
      return {
        title: daysRemaining === 0 ? "Renovação automática hoje" : "Renovação automática próxima",
        description:
          daysRemaining === 0
            ? "Seu plano mensal renova automaticamente hoje. Verifique seu cartão para evitar interrupção."
            : `Seu plano mensal renova automaticamente em ${daysRemaining} dia(s). Verifique seu cartão para evitar interrupção.`,
      };
    }

    return {
      title: daysRemaining === 0 ? "Plano anual vence hoje" : "Plano anual perto do vencimento",
      description:
        daysRemaining === 0
          ? "Seu plano anual vence hoje. A renovação é manual e pode ser feita com parcelamento em até 12x."
          : `Seu plano anual vence em ${daysRemaining} dia(s). A renovação é manual e pode ser feita com parcelamento em até 12x.`,
    };
  }, [subscriptionSnapshot]);

  const currentPlanTier = normalizeTier(subscriptionSnapshot?.tier);
  const hasActivePlan = ["monthly", "yearly", "free_trial"].includes(currentPlanTier || "");

  const currentPlanBenefits = useMemo(() => {
    const unique = (items: string[]) => {
      const seen = new Set<string>();
      const values: string[] = [];
      for (const item of items) {
        const normalized = String(item || "").trim().toLowerCase();
        if (!normalized || seen.has(normalized)) continue;
        seen.add(normalized);
        values.push(item);
      }
      return values;
    };

    if (!currentPlanTier) return [];
    if (currentPlanTier === "yearly") {
      return unique([...(planFeaturesById.yearly || []), ...(planFeaturesById.annual || [])]);
    }
    return unique(planFeaturesById[currentPlanTier] || []);
  }, [currentPlanTier, planFeaturesById]);

  const retentionCopy = useMemo(() => {
    if (currentPlanTier === "monthly") {
      return "Seu plano mensal mantém seu perfil visível e pronto para receber novos contatos.";
    }
    if (currentPlanTier === "yearly") {
      return "Seu plano anual garante o melhor custo-benefício e acesso completo aos recursos do perfil.";
    }
    if (currentPlanTier === "free_trial") {
      return "No teste grátis, você já está ganhando visibilidade e construindo histórico de contatos.";
    }
    return "Sua assinatura mantém seu perfil ativo para novas oportunidades.";
  }, [currentPlanTier]);

  const displayRows = useMemo<PaymentDisplayRow[]>(() => {
    const groupedItemsById = new Map<string, string>();
    const installmentCandidateIds = new Set<string>();
    const groupsByKey = new Map<
      string,
      InstallmentGroup & { itemsByInstallment: Map<number, PaymentRecord> }
    >();

    payments.forEach((payment) => {
      if (payment.type !== "subscription") return;

      const installmentInfo = getInstallmentInfoFromPayment(payment);
      if (!installmentInfo) return;

      installmentCandidateIds.add(payment.id);
      const fallbackLabel = stripInstallmentInfo(payment.description).toLowerCase();
      const fallbackGroupKey = [
        "fallback",
        installmentInfo.total,
        payment.currency.toLowerCase(),
        Number(payment.amount || 0).toFixed(2),
        fallbackLabel,
      ].join("|");

      const groupKey =
        String(payment.installment_group_key || "").trim() ||
        (payment.asaas_checkout_id ? `checkout:${payment.asaas_checkout_id}` : fallbackGroupKey);

      let group = groupsByKey.get(groupKey);
      if (!group) {
        group = {
          id: `installments-${groupKey}`,
          totalInstallments: installmentInfo.total,
          items: [],
          currency: payment.currency,
          totalAmount: 0,
          summaryDateMs: payment.date,
          sortDateMs: payment.date,
          itemsByInstallment: new Map<number, PaymentRecord>(),
        };
        groupsByKey.set(groupKey, group);
      }

      group.totalInstallments = Math.max(group.totalInstallments, installmentInfo.total);
      group.sortDateMs = Math.max(group.sortDateMs, payment.date);

      const existingInstallment = group.itemsByInstallment.get(installmentInfo.current);
      if (!existingInstallment || payment.date > existingInstallment.date) {
        group.itemsByInstallment.set(installmentInfo.current, payment);
      }
    });

    groupsByKey.forEach((group) => {
      const items = Array.from(group.itemsByInstallment.values());
      items.sort((a, b) => {
        const aCurrent = getInstallmentInfoFromPayment(a)?.current ?? Number.MAX_SAFE_INTEGER;
        const bCurrent = getInstallmentInfoFromPayment(b)?.current ?? Number.MAX_SAFE_INTEGER;
        if (aCurrent !== bCurrent) return aCurrent - bCurrent;
        return a.date - b.date;
      });

      group.items = items;
      group.totalAmount = items.reduce((acc, item) => acc + Number(item.amount || 0), 0);

      const firstInstallment = items.find((item) => (getInstallmentInfoFromPayment(item)?.current || 0) === 1);
      group.summaryDateMs = firstInstallment
        ? firstInstallment.date
        : items.reduce((latest, item) => Math.max(latest, item.date), group.sortDateMs);

      items.forEach((item) => groupedItemsById.set(item.id, group.id));
    });

    const groupsForRendering = new Map<string, InstallmentGroup>();
    groupsByKey.forEach((group) => {
      if (group.items.length > 1) {
        groupsForRendering.set(group.id, group);
      } else {
        group.items.forEach((item) => groupedItemsById.delete(item.id));
      }
    });

    const emittedGroups = new Set<string>();
    const rows: PaymentDisplayRow[] = [];

    payments.forEach((payment) => {
      if (installmentCandidateIds.has(payment.id) && !groupedItemsById.has(payment.id)) {
        return;
      }

      const groupId = groupedItemsById.get(payment.id);
      if (!groupId) {
        rows.push({ kind: "payment", payment });
        return;
      }

      if (!emittedGroups.has(groupId)) {
        const group = groupsForRendering.get(groupId);
        if (group) {
          rows.push({ kind: "group", group });
          emittedGroups.add(groupId);
        } else {
          rows.push({ kind: "payment", payment });
        }
      }
    });

    return rows;
  }, [payments]);

  const cancellationState = useMemo<CancellationState>(() => {
    const latestPaidSubscription = [...payments]
      .filter((payment) => {
        const normalizedStatus = payment.status.toLowerCase();
        return payment.type === "subscription" && (normalizedStatus === "paid" || normalizedStatus === "succeeded");
      })
      .sort((a, b) => b.date - a.date)[0];

    if (!latestPaidSubscription) {
      return {
        canCancel: false,
        deadline: null,
        message: "Nenhuma assinatura paga foi encontrada para cancelamento.",
      };
    }

    const deadline = new Date(latestPaidSubscription.date + CANCELLATION_WINDOW_DAYS * 24 * 60 * 60 * 1000);
    const now = new Date();

    if (now.getTime() > deadline.getTime()) {
      return {
        canCancel: false,
        deadline,
        message: `Prazo de cancelamento encerrado em ${format(deadline, "dd/MM/yyyy", { locale: ptBR })}.`,
      };
    }

    return {
      canCancel: true,
      deadline,
      message: `Cancelamento disponível até ${format(deadline, "dd/MM/yyyy", { locale: ptBR })}.`,
    };
  }, [payments]);

  const handleOpenCancelModal = () => {
    if (!cancellationState.canCancel || isCancelling) return;
    setIsCancelModalOpen(true);
  };

  const handleCancelSubscription = async () => {
    if (!cancellationState.canCancel || isCancelling) return;

    setIsCancelling(true);
    const toastId = toast.loading("Cancelando assinatura...");

    try {
      const { data, error: funcError } = await supabase.functions.invoke("cancel-user-subscription");

      if (funcError) {
        const message = await readFunctionErrorMessage(funcError, "Nao foi possivel cancelar a assinatura.");
        throw new Error(message);
      }

      toast.success(data?.message || "Assinatura cancelada com sucesso.", { id: toastId });
      setIsCancelModalOpen(false);
      await fetchHistory(true);
      requestAnimationFrame(() => {
        window.scrollTo({ top: 0, behavior: "smooth" });
      });
    } catch (err: unknown) {
      console.error("[Cancel Subscription Error]", err);
      const message =
        err instanceof Error && err.message
          ? err.message
          : "Erro ao cancelar assinatura.";
      toast.error(message, { id: toastId });
    } finally {
      setIsCancelling(false);
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status.toLowerCase()) {
      case "paid":
      case "succeeded":
        return <Badge className="bg-success hover:bg-success">Pago</Badge>;
      case "open":
        return <Badge variant="outline" className="text-amber-600 border-amber-200 bg-amber-50">Pendente</Badge>;
      case "refund_pending":
        return <Badge variant="outline" className="text-amber-600 border-amber-200 bg-amber-50">Estorno pendente</Badge>;
      case "refunded":
        return <Badge variant="outline" className="text-sky-700 border-sky-200 bg-sky-50">Estornado</Badge>;
      case "void":
      case "canceled":
        return <Badge variant="secondary">Cancelado</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  const getInstallmentGroupStatusBadge = (group: InstallmentGroup) => {
    const statuses = group.items.map((item) => item.status.toLowerCase());
    const hasPending = statuses.some((status) => status === "open");
    if (hasPending) {
      return (
        <Badge variant="outline" className="text-amber-600 border-amber-200 bg-amber-50">
          Pendente
        </Badge>
      );
    }

    const hasRefundPending = statuses.some((status) => status === "refund_pending");
    if (hasRefundPending) {
      return (
        <Badge variant="outline" className="text-amber-600 border-amber-200 bg-amber-50">
          Estorno pendente
        </Badge>
      );
    }

    const isPaid = statuses.every((status) => status === "paid" || status === "succeeded");

    if (isPaid) {
      return <Badge className="bg-success hover:bg-success">Pago</Badge>;
    }

    const allRefundedOrCanceled = statuses.every((status) =>
      ["refunded", "canceled", "void", "deleted"].includes(status),
    );

    if (allRefundedOrCanceled) {
      return <Badge variant="outline" className="text-sky-700 border-sky-200 bg-sky-50">Estornado</Badge>;
    }

    return <Badge variant="outline">Parcial</Badge>;
  };

  const getInvoiceActionLabel = (status: string) => {
    const normalizedStatus = status.toLowerCase();
    return normalizedStatus === "open" || normalizedStatus === "pending" ? "Pagar" : "Ver Fatura";
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex flex-col gap-1">
          <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <Receipt className="h-6 w-6 text-primary" /> Histórico de Pagamentos
          </h1>
          <p className="text-muted-foreground">Consulte suas faturas e recibos de assinaturas e cursos.</p>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            className="gap-2"
            onClick={() => fetchHistory(true)}
            disabled={isRefreshing || loading}
          >
            {isRefreshing ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
            Atualizar
          </Button>
        </div>
      </div>

      {renewalAlert && (
        <Card className="border-amber-300/40 bg-amber-50/40">
          <CardContent className="pt-6">
            <div className="flex items-start gap-3">
              <AlertCircle className="h-5 w-5 text-amber-600 shrink-0 mt-0.5" />
              <div className="space-y-1">
                <p className="font-semibold text-amber-900">{renewalAlert.title}</p>
                <p className="text-sm text-amber-800">{renewalAlert.description}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {error ? (
        <Card className="border-destructive/20 bg-destructive/5">
          <CardContent className="pt-6 flex flex-col items-center text-center py-10 gap-3">
            <XCircle className="h-10 w-10 text-destructive opacity-50" />
            <div className="space-y-1">
              <h3 className="font-bold text-destructive">Falha ao carregar dados</h3>
              <p className="text-sm text-muted-foreground max-w-md">{error}</p>
            </div>
            <Button variant="outline" size="sm" onClick={() => fetchHistory()} className="mt-2">
              Tentar Novamente
            </Button>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="p-0">
            {loading ? (
              <div className="flex flex-col items-center justify-center py-20 gap-3 text-muted-foreground">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
                <p className="text-sm">Buscando registros de pagamento...</p>
              </div>
            ) : payments.length > 0 ? (
              <div className="rounded-md border overflow-hidden">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-36">Data/Hora</TableHead>
                      <TableHead>Descrição</TableHead>
                      <TableHead>Valor</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="text-right">Fatura</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {displayRows.map((row) => {
                      if (row.kind === "payment") {
                        const p = row.payment;
                        return (
                          <TableRow key={p.id}>
                            <TableCell className="whitespace-nowrap">
                              <div className="flex flex-col gap-1 text-xs">
                                <div className="flex items-center gap-2">
                                  <Calendar className="h-3.5 w-3.5 text-muted-foreground" />
                                  {format(p.date, "dd/MM/yyyy", { locale: ptBR })}
                                </div>
                                <div className="flex items-center gap-2 text-[10px] text-muted-foreground">
                                  <Clock className="h-3 w-3" />
                                  {format(p.date, "HH:mm", { locale: ptBR })}
                                </div>
                              </div>
                            </TableCell>
                            <TableCell>
                              <div className="space-y-0.5">
                                <p className="text-sm font-medium leading-none">{p.description}</p>
                                <p className="text-[10px] text-muted-foreground uppercase tracking-wider">
                                  {p.type === "subscription" ? "Assinatura" : "Pagamento Único"}
                                </p>
                              </div>
                            </TableCell>
                            <TableCell className="font-semibold">
                              {new Intl.NumberFormat("pt-BR", {
                                style: "currency",
                                currency: p.currency.toUpperCase(),
                              }).format(p.amount)}
                            </TableCell>
                            <TableCell>{getStatusBadge(p.status)}</TableCell>
                            <TableCell className="text-right">
                              {p.pdf_url ? (
                                <Button variant="ghost" size="sm" asChild className="h-8 gap-1.5 text-primary">
                                  <a href={p.pdf_url} target="_blank" rel="noopener noreferrer" title={getInvoiceActionLabel(p.status)}>
                                    <ExternalLink className="h-3.5 w-3.5" />
                                    <span>{getInvoiceActionLabel(p.status)}</span>
                                  </a>
                                </Button>
                              ) : (
                                <span className="text-[10px] text-muted-foreground italic">Recibo Digital</span>
                              )}
                            </TableCell>
                          </TableRow>
                        );
                      }

                      const group = row.group;
                      const isExpanded = !!expandedInstallmentGroups[group.id];
                      const latestDate = group.summaryDateMs || Date.now();
                      const paidInstallments = group.items.filter((item) => {
                        const status = item.status.toLowerCase();
                        return status === "paid" || status === "succeeded";
                      }).length;

                      return (
                        <Fragment key={group.id}>
                          <TableRow className="bg-secondary/20">
                            <TableCell className="whitespace-nowrap">
                              <div className="flex flex-col gap-1 text-xs">
                                <div className="flex items-center gap-2">
                                  <Calendar className="h-3.5 w-3.5 text-muted-foreground" />
                                  {format(latestDate, "dd/MM/yyyy", { locale: ptBR })}
                                </div>
                                <div className="flex items-center gap-2 text-[10px] text-muted-foreground">
                                  <Clock className="h-3 w-3" />
                                  {format(latestDate, "HH:mm", { locale: ptBR })}
                                </div>
                              </div>
                            </TableCell>
                            <TableCell>
                              <div className="space-y-1">
                                <button
                                  type="button"
                                  className="flex items-center gap-2 text-sm font-semibold text-left text-primary hover:underline"
                                  onClick={() =>
                                    setExpandedInstallmentGroups((prev) => ({ ...prev, [group.id]: !prev[group.id] }))
                                  }
                                >
                                  {isExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                                  Parcelamento Plano Anual ({group.items.length}/{group.totalInstallments})
                                </button>
                                <p className="text-[10px] text-muted-foreground uppercase tracking-wider">
                                  {paidInstallments} parcela(s) paga(s) de {group.totalInstallments}
                                </p>
                              </div>
                            </TableCell>
                            <TableCell className="font-semibold">
                              {new Intl.NumberFormat("pt-BR", {
                                style: "currency",
                                currency: group.currency.toUpperCase(),
                              }).format(group.totalAmount)}
                            </TableCell>
                            <TableCell>{getInstallmentGroupStatusBadge(group)}</TableCell>
                            <TableCell className="text-right">
                              <span className="text-[10px] text-muted-foreground italic">
                                {isExpanded ? "Ocultar parcelas" : "Ver parcelas"}
                              </span>
                            </TableCell>
                          </TableRow>

                          {isExpanded &&
                            group.items.map((p) => (
                              <TableRow key={`installment-${group.id}-${p.id}`} className="bg-muted/20">
                                <TableCell className="whitespace-nowrap pl-8">
                                  <div className="flex flex-col gap-1 text-xs">
                                    <div className="flex items-center gap-2">
                                      <Calendar className="h-3.5 w-3.5 text-muted-foreground" />
                                      {format(p.date, "dd/MM/yyyy", { locale: ptBR })}
                                    </div>
                                    <div className="flex items-center gap-2 text-[10px] text-muted-foreground">
                                      <Clock className="h-3 w-3" />
                                      {format(p.date, "HH:mm", { locale: ptBR })}
                                    </div>
                                  </div>
                                </TableCell>
                                <TableCell>
                                  <div className="space-y-0.5">
                                    <p className="text-sm font-medium leading-none">{p.description}</p>
                                    <p className="text-[10px] text-muted-foreground uppercase tracking-wider">
                                      Assinatura
                                    </p>
                                  </div>
                                </TableCell>
                                <TableCell className="font-semibold">
                                  {new Intl.NumberFormat("pt-BR", {
                                    style: "currency",
                                    currency: p.currency.toUpperCase(),
                                  }).format(p.amount)}
                                </TableCell>
                                <TableCell>{getStatusBadge(p.status)}</TableCell>
                                <TableCell className="text-right">
                                  {p.pdf_url ? (
                                    <Button variant="ghost" size="sm" asChild className="h-8 gap-1.5 text-primary">
                                      <a href={p.pdf_url} target="_blank" rel="noopener noreferrer" title={getInvoiceActionLabel(p.status)}>
                                        <ExternalLink className="h-3.5 w-3.5" />
                                        <span>{getInvoiceActionLabel(p.status)}</span>
                                      </a>
                                    </Button>
                                  ) : (
                                    <span className="text-[10px] text-muted-foreground italic">Recibo Digital</span>
                                  )}
                                </TableCell>
                              </TableRow>
                            ))}
                        </Fragment>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            ) : (
              <div className="text-center py-20 bg-secondary/10 rounded-xl border border-dashed">
                <CreditCard className="h-12 w-12 mx-auto mb-4 opacity-20" />
                <p className="text-muted-foreground">Nenhum histórico de pagamento encontrado.</p>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      <Card className="border-amber-300/40 bg-amber-50/30">
        <CardHeader>
          <CardTitle className="text-base">Cancelamento de Assinatura</CardTitle>
          {hasActivePlan && (
            <CardDescription>
              O cancelamento é permitido apenas em até {CANCELLATION_WINDOW_DAYS} dias após o pagamento.
            </CardDescription>
          )}
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-sm text-foreground">
            Plano ativo: <strong>{getSubscriptionTierLabel(subscriptionSnapshot?.tier)}</strong>
          </p>
          <div className="rounded-lg border border-emerald-200 bg-emerald-50/70 p-3">
            <p className="text-xs font-medium text-emerald-900">{retentionCopy}</p>
          </div>
          {hasActivePlan && (
            <>
              <p className="text-sm text-muted-foreground">{cancellationState.message}</p>
              {cancellationState.deadline && (
                <p className="text-xs text-muted-foreground">
                  Data limite: <strong>{format(cancellationState.deadline, "dd/MM/yyyy", { locale: ptBR })}</strong>
                </p>
              )}
              <Button
                variant="destructive"
                size="sm"
                onClick={handleOpenCancelModal}
                disabled={!cancellationState.canCancel || isCancelling || loading}
                className="w-full sm:w-auto"
              >
                {isCancelling ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : null}
                Cancelar Assinatura
              </Button>
            </>
          )}
        </CardContent>
      </Card>

      <Dialog open={isCancelModalOpen} onOpenChange={setIsCancelModalOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Antes de cancelar, veja o que você mantém com o seu plano</DialogTitle>
            <DialogDescription>
              Seu {getSubscriptionTierLabel(subscriptionSnapshot?.tier).toLowerCase()} continua dando visibilidade e acesso a recursos que ajudam a gerar novos atendimentos.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">{retentionCopy}</p>
            <div className="rounded-lg border bg-secondary/20 p-3">
              <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Benefícios do seu plano atual
              </p>
              <ul className="space-y-1.5">
                {(currentPlanBenefits.length > 0 ? currentPlanBenefits : ["Seu perfil permanece ativo para novas oportunidades."])
                  .slice(0, 8)
                  .map((benefit) => (
                    <li key={benefit} className="flex items-start gap-2 text-sm">
                      <CheckCircle2 className="mt-0.5 h-4 w-4 text-emerald-600" />
                      <span>{benefit}</span>
                    </li>
                  ))}
              </ul>
            </div>
          </div>

          <DialogFooter className="gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => setIsCancelModalOpen(false)}
              disabled={isCancelling}
            >
              Continuar com meu plano
            </Button>
            <Button
              type="button"
              variant="destructive"
              onClick={handleCancelSubscription}
              disabled={!cancellationState.canCancel || isCancelling || loading}
            >
              {isCancelling ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              Confirmar cancelamento
            </Button>
          </DialogFooter>

          <div className="rounded-lg border border-primary/20 bg-primary/5 p-3">
            <p className="text-sm text-muted-foreground">
              Antes de cancelar, fale com nossa equipe de suporte: podemos ajudar você a resolver dúvidas, ajustar sua estratégia
              de uso e manter seu perfil gerando novas oportunidades.
            </p>
            <Button
              asChild
              className="mt-3 w-full bg-emerald-600 text-white hover:bg-emerald-700 focus-visible:ring-emerald-500"
            >
              <Link to="/dashboard/suporte?openTicketModal=1&ticketStep=form" onClick={() => setIsCancelModalOpen(false)}>
                <LifeBuoy className="mr-2 h-4 w-4" />
                Abrir ticket antes de cancelar
              </Link>
            </Button>
          </div>
        </DialogContent>
      </Dialog>

    </div>
  );
};

export default PaymentsPage;
