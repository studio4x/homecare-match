"use client";

import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  AlertCircle,
  Bell,
  Loader2,
  Mail,
  MessageCircle,
  RefreshCw,
} from "lucide-react";
import { toast } from "sonner";

type DeliveryItem = {
  id: string;
  source: "log" | "whatsapp_queue";
  channel: "email" | "widget" | "whatsapp";
  status: "queued" | "pending" | "retry" | "sent" | "failed" | "skipped";
  eventType: string;
  recipientKind: "user" | "admin" | "external";
  recipientUserId?: string | null;
  recipientContact?: string | null;
  title?: string | null;
  content?: string | null;
  errorMessage?: string | null;
  metadata?: Record<string, unknown> | null;
  attemptCount?: number | null;
  maxAttempts?: number | null;
  createdAt: string;
};

const formatDateInput = (date: Date) => {
  const pad = (value: number) => String(value).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
};

const startOfDayIso = (dateInput: string) => new Date(`${dateInput}T00:00:00`).toISOString();
const endOfDayIso = (dateInput: string) => new Date(`${dateInput}T23:59:59.999`).toISOString();

const getStatusBadge = (status: DeliveryItem["status"]) => {
  if (status === "sent") return <Badge className="bg-emerald-600">Enviado</Badge>;
  if (status === "failed") return <Badge variant="destructive">Falha</Badge>;
  if (status === "retry") return <Badge className="bg-amber-500">Retry</Badge>;
  if (status === "pending") return <Badge variant="secondary">Pendente</Badge>;
  if (status === "queued") return <Badge variant="outline">Em fila</Badge>;
  return <Badge variant="outline">Ignorado</Badge>;
};

const getChannelBadge = (channel: DeliveryItem["channel"]) => {
  if (channel === "email") {
    return (
      <Badge variant="outline" className="gap-1">
        <Mail className="h-3 w-3" /> E-mail
      </Badge>
    );
  }

  if (channel === "widget") {
    return (
      <Badge variant="outline" className="gap-1">
        <Bell className="h-3 w-3" /> Widget
      </Badge>
    );
  }

  return (
    <Badge variant="outline" className="gap-1">
      <MessageCircle className="h-3 w-3" /> WhatsApp
    </Badge>
  );
};

const NotificationDeliveriesPage = () => {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [channelFilter, setChannelFilter] = useState<"all" | "email" | "widget" | "whatsapp">("all");
  const [statusFilter, setStatusFilter] = useState<"all" | DeliveryItem["status"]>("all");
  const [searchTerm, setSearchTerm] = useState("");
  const [items, setItems] = useState<DeliveryItem[]>([]);

  const defaultTo = formatDateInput(new Date());
  const defaultFromDate = new Date();
  defaultFromDate.setDate(defaultFromDate.getDate() - 7);
  const defaultFrom = formatDateInput(defaultFromDate);

  const [fromDate, setFromDate] = useState(defaultFrom);
  const [toDate, setToDate] = useState(defaultTo);

  const fetchData = async () => {
    setLoading(true);
    setError(null);

    try {
      const fromIso = startOfDayIso(fromDate);
      const toIso = endOfDayIso(toDate);

      const logsQuery = supabase
        .from("notification_delivery_logs")
        .select("*")
        .gte("created_at", fromIso)
        .lte("created_at", toIso)
        .order("created_at", { ascending: false })
        .limit(2000);

      const whatsappQuery = supabase
        .from("whatsapp_notification_queue")
        .select("*")
        .gte("created_at", fromIso)
        .lte("created_at", toIso)
        .order("created_at", { ascending: false })
        .limit(2000);

      const [{ data: logsData, error: logsError }, { data: waData, error: waError }] =
        await Promise.all([logsQuery, whatsappQuery]);

      if (logsError) throw logsError;
      if (waError) throw waError;

      const mappedLogs: DeliveryItem[] = (logsData || []).map((row: any) => ({
        id: `log-${row.id}`,
        source: "log",
        channel: row.channel,
        status: row.status,
        eventType: row.event_type,
        recipientKind: row.recipient_kind,
        recipientUserId: row.recipient_user_id,
        recipientContact: row.recipient_contact,
        title: row.title,
        content: row.content,
        errorMessage: row.error_message,
        metadata: row.metadata,
        createdAt: row.created_at,
      }));

      const mappedWhatsapp: DeliveryItem[] = (waData || []).map((row: any) => ({
        id: `wa-${row.id}`,
        source: "whatsapp_queue",
        channel: "whatsapp",
        status: row.status,
        eventType: row.event_type,
        recipientKind: row.target_kind === "admin" ? "admin" : "user",
        recipientUserId: row.recipient_user_id,
        recipientContact: row.recipient_phone_e164,
        title: row.template_name,
        content: Array.isArray(row.template_params) ? row.template_params.join(" | ") : null,
        errorMessage: row.last_error,
        metadata: row.payload,
        attemptCount: row.attempt_count,
        maxAttempts: row.max_attempts,
        createdAt: row.created_at,
      }));

      const merged = [...mappedLogs, ...mappedWhatsapp].sort(
        (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
      );
      setItems(merged);
    } catch (fetchError: any) {
      console.error("[NotificationDeliveriesPage] erro ao carregar:", fetchError);
      setError(fetchError?.message || "Falha ao carregar entregas.");
      toast.error("Erro ao carregar entregas de notificacao.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const filteredItems = useMemo(() => {
    return items.filter((item) => {
      const matchesChannel = channelFilter === "all" || item.channel === channelFilter;
      const matchesStatus = statusFilter === "all" || item.status === statusFilter;
      const text = [
        item.eventType,
        item.title || "",
        item.content || "",
        item.recipientContact || "",
      ]
        .join(" ")
        .toLowerCase();
      const matchesSearch = !searchTerm || text.includes(searchTerm.toLowerCase());

      return matchesChannel && matchesStatus && matchesSearch;
    });
  }, [items, channelFilter, statusFilter, searchTerm]);

  const summary = useMemo(() => {
    const sent = filteredItems.filter((item) => item.status === "sent").length;
    const failed = filteredItems.filter((item) => item.status === "failed").length;
    const pending = filteredItems.filter((item) => item.status === "pending" || item.status === "retry" || item.status === "queued").length;
    return { total: filteredItems.length, sent, failed, pending };
  }, [filteredItems]);

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Entregas de Notificacoes</h1>
          <p className="text-muted-foreground">
            Monitoramento de notificacoes por e-mail, widget e WhatsApp.
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={fetchData} disabled={loading}>
          <RefreshCw className="mr-2 h-4 w-4" />
          Atualizar
        </Button>
      </div>

      <div className="grid gap-3 md:grid-cols-3">
        <Card>
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground">Total</p>
            <p className="text-2xl font-bold">{summary.total}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground">Enviadas</p>
            <p className="text-2xl font-bold text-emerald-600">{summary.sent}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground">Pendentes/Retry/Fila</p>
            <p className="text-2xl font-bold text-amber-600">{summary.pending}</p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardContent className="p-4 space-y-4">
          <div className="grid gap-3 lg:grid-cols-5">
            <div>
              <label className="text-xs text-muted-foreground">Data inicial</label>
              <Input type="date" value={fromDate} onChange={(e) => setFromDate(e.target.value)} />
            </div>
            <div>
              <label className="text-xs text-muted-foreground">Data final</label>
              <Input type="date" value={toDate} onChange={(e) => setToDate(e.target.value)} />
            </div>
            <div>
              <label className="text-xs text-muted-foreground">Canal</label>
              <Select value={channelFilter} onValueChange={(value: "all" | "email" | "widget" | "whatsapp") => setChannelFilter(value)}>
                <SelectTrigger>
                  <SelectValue placeholder="Canal" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos</SelectItem>
                  <SelectItem value="email">E-mail</SelectItem>
                  <SelectItem value="widget">Widget</SelectItem>
                  <SelectItem value="whatsapp">WhatsApp</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-xs text-muted-foreground">Status</label>
              <Select value={statusFilter} onValueChange={(value: "all" | DeliveryItem["status"]) => setStatusFilter(value)}>
                <SelectTrigger>
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos</SelectItem>
                  <SelectItem value="queued">Em fila</SelectItem>
                  <SelectItem value="pending">Pendente</SelectItem>
                  <SelectItem value="retry">Retry</SelectItem>
                  <SelectItem value="sent">Enviado</SelectItem>
                  <SelectItem value="failed">Falha</SelectItem>
                  <SelectItem value="skipped">Ignorado</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-xs text-muted-foreground">Busca</label>
              <Input
                placeholder="Evento, titulo ou destino"
                value={searchTerm}
                onChange={(event) => setSearchTerm(event.target.value)}
              />
            </div>
          </div>
          <div className="flex justify-end">
            <Button onClick={fetchData} disabled={loading}>
              Aplicar filtros
            </Button>
          </div>
        </CardContent>
      </Card>

      {error ? (
        <div className="bg-destructive/10 border border-destructive/20 rounded-lg p-4 flex items-center gap-3 text-destructive">
          <AlertCircle className="h-5 w-5" />
          <p className="text-sm">{error}</p>
        </div>
      ) : null}

      <Card>
        <CardContent className="p-0">
          {loading ? (
            <div className="flex justify-center py-12">
              <Loader2 className="animate-spin text-primary" />
            </div>
          ) : filteredItems.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              Nenhuma entrega encontrada para os filtros selecionados.
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Data/Hora</TableHead>
                  <TableHead>Canal</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Evento</TableHead>
                  <TableHead>Destino</TableHead>
                  <TableHead>Detalhes</TableHead>
                  <TableHead>Erro</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredItems.map((item) => (
                  <TableRow key={item.id}>
                    <TableCell className="whitespace-nowrap text-xs">
                      {new Date(item.createdAt).toLocaleString("pt-BR")}
                    </TableCell>
                    <TableCell>{getChannelBadge(item.channel)}</TableCell>
                    <TableCell>{getStatusBadge(item.status)}</TableCell>
                    <TableCell className="text-xs font-medium">{item.eventType}</TableCell>
                    <TableCell className="max-w-[220px]">
                      <p className="truncate text-xs">{item.recipientContact || "-"}</p>
                      <p className="text-[10px] text-muted-foreground">{item.recipientKind}</p>
                    </TableCell>
                    <TableCell className="max-w-[320px]">
                      <p className="truncate text-xs font-medium">{item.title || "-"}</p>
                      <p className="truncate text-[10px] text-muted-foreground">{item.content || "-"}</p>
                      {item.channel === "whatsapp" && item.attemptCount ? (
                        <p className="text-[10px] text-muted-foreground">
                          Tentativas: {item.attemptCount}/{item.maxAttempts || "-"}
                        </p>
                      ) : null}
                    </TableCell>
                    <TableCell className="max-w-[260px]">
                      <p className="truncate text-xs text-destructive">{item.errorMessage || "-"}</p>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default NotificationDeliveriesPage;

