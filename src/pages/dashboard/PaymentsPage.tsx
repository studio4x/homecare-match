"use client";

import { useEffect, useMemo, useState } from "react";
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

const PaymentsPage = () => {
  const [payments, setPayments] = useState<PaymentRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isCancelling, setIsCancelling] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [subscriptionSnapshot, setSubscriptionSnapshot] = useState<SubscriptionSnapshot | null>(null);

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
        const msg = await readFunctionErrorMessage(funcError, "Erro ao consultar historico.");
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
          : "Nao foi possivel carregar seu historico de pagamentos.";
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
        title: daysRemaining === 0 ? "Renovacao automatica hoje" : "Renovacao automatica proxima",
        description:
          daysRemaining === 0
            ? "Seu plano mensal renova automaticamente hoje. Verifique seu cartao para evitar interrupcao."
            : `Seu plano mensal renova automaticamente em ${daysRemaining} dia(s). Verifique seu cartao para evitar interrupcao.`,
      };
    }

    return {
      title: daysRemaining === 0 ? "Plano anual vence hoje" : "Plano anual perto do vencimento",
      description:
        daysRemaining === 0
          ? "Seu plano anual vence hoje. A renovacao e manual e pode ser feita com parcelamento em ate 12x."
          : `Seu plano anual vence em ${daysRemaining} dia(s). A renovacao e manual e pode ser feita com parcelamento em ate 12x.`,
    };
  }, [subscriptionSnapshot]);

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
      message: `Cancelamento disponivel ate ${format(deadline, "dd/MM/yyyy", { locale: ptBR })}.`,
    };
  }, [payments]);

  const handleCancelSubscription = async () => {
    if (!cancellationState.canCancel || isCancelling) return;

    const confirmed = window.confirm(
      "Deseja cancelar sua assinatura? Essa acao e irreversivel e sera aplicada tambem no Asaas.",
    );
    if (!confirmed) return;

    setIsCancelling(true);
    const toastId = toast.loading("Cancelando assinatura...");

    try {
      const { data, error: funcError } = await supabase.functions.invoke("cancel-user-subscription");

      if (funcError) {
        const message = await readFunctionErrorMessage(funcError, "Nao foi possivel cancelar a assinatura.");
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

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex flex-col gap-1">
          <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <Receipt className="h-6 w-6 text-primary" /> Historico de Pagamentos
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
                      <TableHead>Data</TableHead>
                      <TableHead>Descricao</TableHead>
                      <TableHead>Valor</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="text-right">Fatura</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {payments.map((p) => (
                      <TableRow key={p.id}>
                        <TableCell className="whitespace-nowrap">
                          <div className="flex items-center gap-2 text-xs">
                            <Calendar className="h-3.5 w-3.5 text-muted-foreground" />
                            {format(p.date, "dd/MM/yyyy", { locale: ptBR })}
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="space-y-0.5">
                            <p className="text-sm font-medium leading-none">{p.description}</p>
                            <p className="text-[10px] text-muted-foreground uppercase tracking-wider">
                              {p.type === "subscription" ? "Assinatura" : "Pagamento Unico"}
                            </p>
                          </div>
                        </TableCell>
                        <TableCell className="font-semibold">
                          {new Intl.NumberFormat("pt-BR", { style: "currency", currency: p.currency.toUpperCase() }).format(p.amount)}
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
                  </TableBody>
                </Table>
              </div>
            ) : (
              <div className="text-center py-20 bg-secondary/10 rounded-xl border border-dashed">
                <CreditCard className="h-12 w-12 mx-auto mb-4 opacity-20" />
                <p className="text-muted-foreground">Nenhum historico de pagamento encontrado.</p>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      <Card className="border-amber-300/40 bg-amber-50/30">
        <CardHeader>
          <CardTitle className="text-base">Cancelamento de Assinatura</CardTitle>
          <CardDescription>
            O cancelamento e permitido apenas em ate {CANCELLATION_WINDOW_DAYS} dias apos o pagamento.
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

      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 flex gap-3">
        <AlertCircle className="h-5 w-5 text-blue-600 shrink-0 mt-0.5" />
        <div className="space-y-1">
          <p className="text-sm font-semibold text-blue-900">Precisa gerenciar sua assinatura?</p>
          <p className="text-xs text-blue-800 leading-relaxed">
            Para alterar forma de pagamento ou trocar de plano, use o botao <strong>Gerenciar Assinatura</strong> na pagina inicial do seu painel.
          </p>
        </div>
      </div>
    </div>
  );
};

export default PaymentsPage;
