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
  Loader2,
  CreditCard,
  Download,
  Receipt,
  Calendar,
  AlertCircle,
  RefreshCw,
  XCircle,
  ChevronDown,
  ChevronUp,
  Clock,
} from "lucide-react";
import { differenceInCalendarDays, format, isValid, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";
import { toast } from "sonner";

interface PaymentRecord {
  id: string;
  date: number;
  amount: number;
  currency: string;
  status: string;
  description: string;
  pdf_url: string | null;
  type: "subscription" | "one_time";
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
  total: number;
}

interface InstallmentGroup {
  id: string;
  totalInstallments: number;
  items: PaymentRecord[];
  currency: string;
  totalAmount: number;
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
  if (!Number.isFinite(current) || !Number.isFinite(total) || total <= 1) return null;

  return { total };
};

const PaymentsPage = () => {
  const [payments, setPayments] = useState<PaymentRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isCancelling, setIsCancelling] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [subscriptionSnapshot, setSubscriptionSnapshot] = useState<SubscriptionSnapshot | null>(null);
  const [expandedInstallmentGroups, setExpandedInstallmentGroups] = useState<Record<string, boolean>>({});

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

  const displayRows = useMemo<PaymentDisplayRow[]>(() => {
    const groupedItemsById = new Map<string, string>();
    const groupsBySignature = new Map<string, InstallmentGroup[]>();

    payments.forEach((payment) => {
      if (payment.type !== "subscription") return;

      const installmentInfo = extractInstallmentInfo(payment.description);
      if (!installmentInfo) return;

      const signature = [
        installmentInfo.total,
        payment.currency.toLowerCase(),
        Number(payment.amount || 0).toFixed(2),
      ].join("|");

      const existingGroups = groupsBySignature.get(signature) || [];
      let targetGroup = existingGroups.find((group) => group.items.length < group.totalInstallments);

      if (!targetGroup) {
        targetGroup = {
          id: `installments-${signature}-${existingGroups.length + 1}`,
          totalInstallments: installmentInfo.total,
          items: [],
          currency: payment.currency,
          totalAmount: 0,
        };
        existingGroups.push(targetGroup);
        groupsBySignature.set(signature, existingGroups);
      }

      targetGroup.items.push(payment);
      targetGroup.totalAmount += Number(payment.amount || 0);
      groupedItemsById.set(payment.id, targetGroup.id);
    });

    groupsBySignature.forEach((groups) => {
      groups.forEach((group) => {
        group.items.sort((a, b) => b.date - a.date);
      });
    });

    const groupsForRendering = new Map<string, InstallmentGroup>();
    groupsBySignature.forEach((groups) => {
      groups.forEach((group) => {
        if (group.items.length > 1) {
          groupsForRendering.set(group.id, group);
        } else {
          group.items.forEach((item) => groupedItemsById.delete(item.id));
        }
      });
    });

    const emittedGroups = new Set<string>();
    const rows: PaymentDisplayRow[] = [];

    payments.forEach((payment) => {
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

  const handleCancelSubscription = async () => {
    if (!cancellationState.canCancel || isCancelling) return;

    const confirmed = window.confirm(
      "Deseja cancelar sua assinatura? Essa ação é irreversível e será aplicada também no Asaas.",
    );
    if (!confirmed) return;

    setIsCancelling(true);
    const toastId = toast.loading("Cancelando assinatura...");

    try {
      const { data, error: funcError } = await supabase.functions.invoke("cancel-user-subscription");

      if (funcError) {
        const message = await readFunctionErrorMessage(funcError, "Não foi possível cancelar a assinatura.");
        throw new Error(message);
      }

      toast.success(data?.message || "Assinatura cancelada com sucesso.", { id: toastId });
      await fetchHistory(true);
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
    const hasPending = group.items.some((item) => item.status.toLowerCase() === "open");
    if (hasPending) {
      return (
        <Badge variant="outline" className="text-amber-600 border-amber-200 bg-amber-50">
          Pendente
        </Badge>
      );
    }

    const isPaid = group.items.every((item) => {
      const status = item.status.toLowerCase();
      return status === "paid" || status === "succeeded";
    });

    if (isPaid) {
      return <Badge className="bg-success hover:bg-success">Pago</Badge>;
    }

    return <Badge variant="outline">Parcial</Badge>;
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
                                <Button variant="ghost" size="icon" asChild className="h-8 w-8 text-primary">
                                  <a href={p.pdf_url} target="_blank" rel="noopener noreferrer" title="Baixar PDF">
                                    <Download className="h-4 w-4" />
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
                      const latestDate = group.items[0]?.date ?? Date.now();
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
                                    <Button variant="ghost" size="icon" asChild className="h-8 w-8 text-primary">
                                      <a href={p.pdf_url} target="_blank" rel="noopener noreferrer" title="Baixar PDF">
                                        <Download className="h-4 w-4" />
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
          <CardDescription>
            O cancelamento é permitido apenas em até {CANCELLATION_WINDOW_DAYS} dias após o pagamento.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-sm text-muted-foreground">{cancellationState.message}</p>
          {cancellationState.deadline && (
            <p className="text-xs text-muted-foreground">
              Data limite: <strong>{format(cancellationState.deadline, "dd/MM/yyyy", { locale: ptBR })}</strong>
            </p>
          )}
          <Button
            variant="destructive"
            size="sm"
            onClick={handleCancelSubscription}
            disabled={!cancellationState.canCancel || isCancelling || loading}
            className="w-full sm:w-auto"
          >
            {isCancelling ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : null}
            Cancelar Assinatura
          </Button>
        </CardContent>
      </Card>

    </div>
  );
};

export default PaymentsPage;
