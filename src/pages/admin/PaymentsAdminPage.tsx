"use client";

import { Fragment, useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Calendar,
  ChevronDown,
  ChevronUp,
  Clock,
  ExternalLink,
  Loader2,
  RefreshCw,
  ReceiptText,
  Search,
} from "lucide-react";
import { format, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";
import { toast } from "sonner";

type AdminPaymentRecord = {
  id: string;
  payment_id: string | null;
  user_id: string | null;
  transaction_type: string;
  plan_id: string | null;
  asaas_checkout_id: string | null;
  client_name: string;
  item_name: string;
  description: string | null;
  date: string;
  status: string;
  raw_status: string | null;
  amount: number;
  currency: string;
  invoice_url: string | null;
};

type InstallmentInfo = {
  current: number;
  total: number;
};

type InstallmentGroup = {
  id: string;
  totalInstallments: number;
  items: AdminPaymentRecord[];
  currency: string;
  totalAmount: number;
  clientName: string;
  itemName: string;
};

type PaymentDisplayRow =
  | { kind: "payment"; payment: AdminPaymentRecord }
  | { kind: "group"; group: InstallmentGroup };

type PaymentTypeFilter = "all" | "subscription" | "course";

type InvokeFunctionError = {
  context?: Response;
};

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
    // ignore
  }

  try {
    const text = await response.clone().text();
    if (text.trim()) return text;
  } catch {
    // ignore
  }

  return fallback;
};

const parseSafeDate = (value?: string | null) => {
  if (!value) return null;
  const parsed = parseISO(value);
  if (Number.isNaN(parsed.getTime())) return null;
  return parsed;
};

const dateToMs = (value?: string | null) => {
  const parsed = parseSafeDate(value);
  return parsed ? parsed.getTime() : Date.now();
};

const extractInstallmentInfo = (description: string) => {
  const match = description.match(/parcela\s+(\d+)\s+de\s*(\d+)/i);
  if (!match) return null;

  const current = Number(match[1]);
  const total = Number(match[2]);
  if (!Number.isFinite(current) || !Number.isFinite(total) || current <= 0 || total <= 1) return null;
  return { current, total } as InstallmentInfo;
};

const stripInstallmentInfo = (text: string) => {
  const stripped = text
    .replace(/parcela\s+\d+\s+de\s*\d+\.?/gi, "")
    .replace(/parcelamento\s*\(\s*\d+\s*\/\s*\d+\s*\)\s*[-–—:]?\s*/gi, "")
    .replace(/\s*[-–—:]\s*$/g, "")
    .replace(/\s{2,}/g, " ")
    .trim();
  return stripped || "Plano Anual";
};

const getStatusBadge = (status: string) => {
  switch (status.toLowerCase()) {
    case "paid":
    case "succeeded":
      return <Badge className="bg-success hover:bg-success">Pago</Badge>;
    case "open":
      return (
        <Badge variant="outline" className="text-amber-700 border-amber-200 bg-amber-50">
          Pendente
        </Badge>
      );
    case "refund_pending":
      return (
        <Badge variant="outline" className="text-amber-700 border-amber-200 bg-amber-50">
          Estorno pendente
        </Badge>
      );
    case "refunded":
      return (
        <Badge variant="outline" className="text-sky-700 border-sky-200 bg-sky-50">
          Estornado
        </Badge>
      );
    case "canceled":
    case "cancelled":
    case "void":
      return <Badge variant="secondary">Cancelado</Badge>;
    default:
      return <Badge variant="outline">{status}</Badge>;
  }
};

const getInstallmentGroupStatusBadge = (group: InstallmentGroup) => {
  const hasPending = group.items.some((item) => item.status.toLowerCase() === "open");
  if (hasPending) {
    return (
      <Badge variant="outline" className="text-amber-700 border-amber-200 bg-amber-50">
        Pendente
      </Badge>
    );
  }

  const isPaid = group.items.every((item) => {
    const status = item.status.toLowerCase();
    return status === "paid" || status === "succeeded";
  });

  if (isPaid) return <Badge className="bg-success hover:bg-success">Pago</Badge>;
  return <Badge variant="outline">Parcial</Badge>;
};

const matchesPaymentType = (payment: AdminPaymentRecord, filter: PaymentTypeFilter) => {
  if (filter === "all") return true;
  if (filter === "subscription") return payment.transaction_type === "plan";
  if (filter === "course") return payment.transaction_type === "course";
  return true;
};

const PaymentsAdminPage = () => {
  const [payments, setPayments] = useState<AdminPaymentRecord[]>([]);
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState<PaymentTypeFilter>("all");
  const [loading, setLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [expandedInstallmentGroups, setExpandedInstallmentGroups] = useState<Record<string, boolean>>({});

  const fetchPayments = async (silent = false) => {
    if (silent) {
      setIsRefreshing(true);
    } else {
      setLoading(true);
    }

    try {
      const { data, error } = await supabase.functions.invoke("get-admin-payment-history");
      if (error) {
        const message = await readFunctionErrorMessage(error, "Erro ao consultar pagamentos.");
        throw new Error(message);
      }

      setPayments(Array.isArray(data?.payments) ? data.payments : []);
    } catch (err: any) {
      console.error("[PaymentsAdminPage] Erro:", err);
      toast.error(err?.message || "Erro ao consultar pagamentos.");
    } finally {
      setLoading(false);
      setIsRefreshing(false);
    }
  };

  useEffect(() => {
    fetchPayments();
  }, []);

  const filteredPayments = useMemo(() => {
    const term = search.trim().toLowerCase();
    return payments.filter((payment) => {
      if (!matchesPaymentType(payment, typeFilter)) return false;
      if (!term) return true;
      const client = String(payment.client_name || "").toLowerCase();
      const item = String(payment.item_name || "").toLowerCase();
      const rawStatus = String(payment.raw_status || "").toLowerCase();
      return client.includes(term) || item.includes(term) || rawStatus.includes(term);
    });
  }, [payments, search, typeFilter]);

  const displayRows = useMemo<PaymentDisplayRow[]>(() => {
    const groupedItemsById = new Map<string, string>();
    const installmentCandidateIds = new Set<string>();
    const groupsByKey = new Map<
      string,
      InstallmentGroup & { itemsByInstallment: Map<number, AdminPaymentRecord> }
    >();

    filteredPayments.forEach((payment) => {
      if (payment.transaction_type !== "plan") return;

      const descriptionSource = String(payment.item_name || payment.description || "");
      const installmentInfo = extractInstallmentInfo(descriptionSource);
      if (!installmentInfo) return;

      installmentCandidateIds.add(payment.id);
      const baseItemName = stripInstallmentInfo(descriptionSource);
      const key =
        payment.asaas_checkout_id && String(payment.asaas_checkout_id).trim()
          ? `checkout:${payment.asaas_checkout_id}`
          : [
              "fallback",
              payment.user_id || payment.client_name,
              payment.plan_id || "",
              installmentInfo.total,
              payment.currency.toLowerCase(),
              baseItemName.toLowerCase(),
              Number(payment.amount || 0).toFixed(2),
            ].join("|");

      let group = groupsByKey.get(key);
      if (!group) {
        group = {
          id: `installments-${key}`,
          totalInstallments: installmentInfo.total,
          items: [],
          currency: payment.currency,
          totalAmount: 0,
          clientName: payment.client_name,
          itemName: baseItemName,
          itemsByInstallment: new Map<number, AdminPaymentRecord>(),
        };
        groupsByKey.set(key, group);
      }

      const existingInstallment = group.itemsByInstallment.get(installmentInfo.current);
      if (!existingInstallment || dateToMs(payment.date) > dateToMs(existingInstallment.date)) {
        group.itemsByInstallment.set(installmentInfo.current, payment);
      }
    });

    groupsByKey.forEach((group) => {
      group.items = Array.from(group.itemsByInstallment.values()).sort((a, b) => dateToMs(b.date) - dateToMs(a.date));
      group.totalAmount = group.items.reduce((acc, item) => acc + Number(item.amount || 0), 0);
      group.items.forEach((item) => groupedItemsById.set(item.id, group.id));
    });

    const groupsForRendering = new Map<string, InstallmentGroup & { itemsByInstallment: Map<number, AdminPaymentRecord> }>();
    groupsByKey.forEach((group) => {
      if (group.items.length > 1) {
        groupsForRendering.set(group.id, group);
      } else {
        group.items.forEach((item) => groupedItemsById.delete(item.id));
      }
    });

    const emittedGroups = new Set<string>();
    const rows: PaymentDisplayRow[] = [];

    filteredPayments.forEach((payment) => {
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
  }, [filteredPayments]);

  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <h1 className="text-3xl font-bold tracking-tight flex items-center gap-2">
          <ReceiptText className="h-7 w-7 text-primary" />
          Controle de Pagamentos
        </h1>
        <p className="text-muted-foreground">
          Acompanhe compras de cursos e assinaturas com dados completos de fatura.
        </p>
      </div>

      <Card>
        <CardContent className="p-4 sm:p-6 space-y-4">
          <div className="flex flex-col sm:flex-row gap-3 sm:items-center sm:justify-between">
            <div className="w-full sm:max-w-xl space-y-2">
              <div className="relative">
                <Search className="h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                <Input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Buscar por cliente, item ou status..."
                  className="pl-9"
                />
              </div>
              <div className="flex flex-wrap gap-2">
                <Button
                  variant={typeFilter === "all" ? "default" : "outline"}
                  size="sm"
                  onClick={() => setTypeFilter("all")}
                >
                  Todos
                </Button>
                <Button
                  variant={typeFilter === "subscription" ? "default" : "outline"}
                  size="sm"
                  onClick={() => setTypeFilter("subscription")}
                >
                  Assinaturas
                </Button>
                <Button
                  variant={typeFilter === "course" ? "default" : "outline"}
                  size="sm"
                  onClick={() => setTypeFilter("course")}
                >
                  Cursos
                </Button>
              </div>
            </div>
            <Button
              variant="outline"
              size="sm"
              className="gap-2"
              onClick={() => fetchPayments(true)}
              disabled={loading || isRefreshing}
            >
              {isRefreshing ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
              Atualizar
            </Button>
          </div>

          {loading ? (
            <div className="flex flex-col items-center justify-center py-16 gap-3 text-muted-foreground">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
              <p className="text-sm">Carregando pagamentos...</p>
            </div>
          ) : displayRows.length > 0 ? (
            <div className="rounded-md border overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Cliente</TableHead>
                    <TableHead>Comprado</TableHead>
                    <TableHead className="w-36">Data/Hora</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Valor</TableHead>
                    <TableHead className="text-right">Fatura</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {displayRows.map((row) => {
                    if (row.kind === "payment") {
                      const payment = row.payment;
                      const parsedDate = parseSafeDate(payment.date);
                      const currency = String(payment.currency || "BRL").toUpperCase();

                      return (
                        <TableRow key={payment.id}>
                          <TableCell className="font-medium">{payment.client_name}</TableCell>
                          <TableCell>
                            <div className="space-y-0.5">
                              <p className="text-sm font-medium leading-none">{payment.item_name}</p>
                              {payment.payment_id ? (
                                <p className="text-[10px] text-muted-foreground">ID: {payment.payment_id}</p>
                              ) : null}
                            </div>
                          </TableCell>
                          <TableCell className="whitespace-nowrap">
                            {parsedDate ? (
                              <div className="flex flex-col gap-1 text-xs">
                                <div className="flex items-center gap-2">
                                  <Calendar className="h-3.5 w-3.5 text-muted-foreground" />
                                  {format(parsedDate, "dd/MM/yyyy", { locale: ptBR })}
                                </div>
                                <div className="flex items-center gap-2 text-[10px] text-muted-foreground">
                                  <Clock className="h-3 w-3" />
                                  {format(parsedDate, "HH:mm", { locale: ptBR })}
                                </div>
                              </div>
                            ) : (
                              <span className="text-xs text-muted-foreground">Sem data</span>
                            )}
                          </TableCell>
                          <TableCell>{getStatusBadge(payment.status)}</TableCell>
                          <TableCell className="font-semibold">
                            {new Intl.NumberFormat("pt-BR", {
                              style: "currency",
                              currency,
                            }).format(Number(payment.amount || 0))}
                          </TableCell>
                          <TableCell className="text-right">
                            {payment.invoice_url ? (
                              <Button variant="ghost" size="sm" asChild className="gap-1.5 h-8 text-primary">
                                <a href={payment.invoice_url} target="_blank" rel="noopener noreferrer">
                                  Ver fatura
                                  <ExternalLink className="h-3.5 w-3.5" />
                                </a>
                              </Button>
                            ) : (
                              <span className="text-[10px] text-muted-foreground italic">Sem link</span>
                            )}
                          </TableCell>
                        </TableRow>
                      );
                    }

                    const group = row.group;
                    const isExpanded = !!expandedInstallmentGroups[group.id];
                    const latestItem = group.items[0];
                    const latestDate = parseSafeDate(latestItem?.date);
                    const paidInstallments = group.items.filter((item) => {
                      const status = item.status.toLowerCase();
                      return status === "paid" || status === "succeeded";
                    }).length;
                    const currency = String(group.currency || "BRL").toUpperCase();

                    return (
                      <Fragment key={group.id}>
                        <TableRow className="bg-secondary/20">
                          <TableCell className="font-medium">{group.clientName}</TableCell>
                          <TableCell>
                            <div className="space-y-1">
                              <button
                                type="button"
                                className="flex items-center gap-2 text-sm font-semibold text-left text-primary hover:underline"
                                onClick={() =>
                                  setExpandedInstallmentGroups((prev) => ({
                                    ...prev,
                                    [group.id]: !prev[group.id],
                                  }))
                                }
                              >
                                {isExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                                Parcelamento ({group.items.length}/{group.totalInstallments}) - {group.itemName}
                              </button>
                              <p className="text-[10px] text-muted-foreground uppercase tracking-wider">
                                {paidInstallments} parcela(s) paga(s) de {group.totalInstallments}
                              </p>
                            </div>
                          </TableCell>
                          <TableCell className="whitespace-nowrap">
                            {latestDate ? (
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
                            ) : (
                              <span className="text-xs text-muted-foreground">Sem data</span>
                            )}
                          </TableCell>
                          <TableCell>{getInstallmentGroupStatusBadge(group)}</TableCell>
                          <TableCell className="font-semibold">
                            {new Intl.NumberFormat("pt-BR", {
                              style: "currency",
                              currency,
                            }).format(group.totalAmount)}
                          </TableCell>
                          <TableCell className="text-right">
                            <span className="text-[10px] text-muted-foreground italic">
                              {isExpanded ? "Ocultar parcelas" : "Ver parcelas"}
                            </span>
                          </TableCell>
                        </TableRow>

                        {isExpanded &&
                          group.items.map((payment) => {
                            const parsedDate = parseSafeDate(payment.date);
                            return (
                              <TableRow key={`installment-${group.id}-${payment.id}`} className="bg-muted/20">
                                <TableCell className="font-medium pl-8">{payment.client_name}</TableCell>
                                <TableCell>
                                  <div className="space-y-0.5">
                                    <p className="text-sm font-medium leading-none">{payment.item_name}</p>
                                    {payment.payment_id ? (
                                      <p className="text-[10px] text-muted-foreground">ID: {payment.payment_id}</p>
                                    ) : null}
                                  </div>
                                </TableCell>
                                <TableCell className="whitespace-nowrap">
                                  {parsedDate ? (
                                    <div className="flex flex-col gap-1 text-xs">
                                      <div className="flex items-center gap-2">
                                        <Calendar className="h-3.5 w-3.5 text-muted-foreground" />
                                        {format(parsedDate, "dd/MM/yyyy", { locale: ptBR })}
                                      </div>
                                      <div className="flex items-center gap-2 text-[10px] text-muted-foreground">
                                        <Clock className="h-3 w-3" />
                                        {format(parsedDate, "HH:mm", { locale: ptBR })}
                                      </div>
                                    </div>
                                  ) : (
                                    <span className="text-xs text-muted-foreground">Sem data</span>
                                  )}
                                </TableCell>
                                <TableCell>{getStatusBadge(payment.status)}</TableCell>
                                <TableCell className="font-semibold">
                                  {new Intl.NumberFormat("pt-BR", {
                                    style: "currency",
                                    currency,
                                  }).format(Number(payment.amount || 0))}
                                </TableCell>
                                <TableCell className="text-right">
                                  {payment.invoice_url ? (
                                    <Button variant="ghost" size="sm" asChild className="gap-1.5 h-8 text-primary">
                                      <a href={payment.invoice_url} target="_blank" rel="noopener noreferrer">
                                        Ver fatura
                                        <ExternalLink className="h-3.5 w-3.5" />
                                      </a>
                                    </Button>
                                  ) : (
                                    <span className="text-[10px] text-muted-foreground italic">Sem link</span>
                                  )}
                                </TableCell>
                              </TableRow>
                            );
                          })}
                      </Fragment>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          ) : (
            <div className="text-center py-16 text-muted-foreground border rounded-md bg-secondary/10">
              Nenhum pagamento encontrado para os filtros atuais.
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default PaymentsAdminPage;
