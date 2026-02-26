"use client";

import { useEffect, useMemo, useState } from "react";
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
import { Calendar, Clock, ExternalLink, Loader2, RefreshCw, ReceiptText, Search } from "lucide-react";
import { format, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";
import { toast } from "sonner";

type AdminPaymentRecord = {
  id: string;
  payment_id: string | null;
  client_name: string;
  item_name: string;
  date: string;
  status: string;
  raw_status: string | null;
  amount: number;
  currency: string;
  invoice_url: string | null;
};

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

const PaymentsAdminPage = () => {
  const [payments, setPayments] = useState<AdminPaymentRecord[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);

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
    if (!term) return payments;

    return payments.filter((payment) => {
      const client = String(payment.client_name || "").toLowerCase();
      const item = String(payment.item_name || "").toLowerCase();
      const rawStatus = String(payment.raw_status || "").toLowerCase();
      return client.includes(term) || item.includes(term) || rawStatus.includes(term);
    });
  }, [payments, search]);

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
            <div className="relative w-full sm:max-w-md">
              <Search className="h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Buscar por cliente, item ou status..."
                className="pl-9"
              />
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
          ) : filteredPayments.length > 0 ? (
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
                  {filteredPayments.map((payment) => {
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
