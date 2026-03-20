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
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  AlertCircle,
  Bell,
  Loader2,
  Mail,
  MessageCircle,
  RefreshCw,
  Trash2,
} from "lucide-react";
import { toast } from "sonner";
import WhatsappTemplateSettingsTab from "@/components/admin/WhatsappTemplateSettingsTab";
import WhatsappGroupsAdminTab from "@/components/admin/WhatsappGroupsAdminTab";

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

type NotificationDeliveryLogRow = {
  id: string;
  channel: DeliveryItem["channel"];
  status: DeliveryItem["status"];
  event_type: string;
  recipient_kind: DeliveryItem["recipientKind"];
  recipient_user_id: string | null;
  recipient_contact: string | null;
  title: string | null;
  content: string | null;
  error_message: string | null;
  metadata: Record<string, unknown> | null;
  created_at: string;
};

type WhatsAppQueueRow = {
  id: string;
  status: DeliveryItem["status"];
  event_type: string;
  target_kind: "user" | "admin";
  recipient_user_id: string | null;
  recipient_phone_e164: string | null;
  template_name: string | null;
  template_params: unknown;
  payload: Record<string, unknown> | null;
  last_error: string | null;
  attempt_count: number | null;
  max_attempts: number | null;
  created_at: string;
};

type UserSuggestion = {
  id: string;
  full_name: string | null;
  email: string | null;
};

const getErrorMessage = (error: unknown, fallback: string) => {
  if (error && typeof error === "object" && "message" in error) {
    const candidate = (error as { message?: unknown }).message;
    if (typeof candidate === "string" && candidate.length > 0) {
      return candidate;
    }
  }
  return fallback;
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
  const whatsappGroupsEnabled = String(import.meta.env.VITE_WHATSAPP_GROUPS_ENABLED || "")
    .trim()
    .toLowerCase() === "true";

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [channelFilter, setChannelFilter] = useState<"all" | "email" | "widget" | "whatsapp">("all");
  const [statusFilter, setStatusFilter] = useState<"all" | DeliveryItem["status"]>("all");
  const [searchTerm, setSearchTerm] = useState("");
  const [items, setItems] = useState<DeliveryItem[]>([]);
  const [isClearing, setIsClearing] = useState(false);
  const [clearDialogOpen, setClearDialogOpen] = useState(false);
  const [subscriptionTestTarget, setSubscriptionTestTarget] = useState("");
  const [subscriptionSearchInput, setSubscriptionSearchInput] = useState("");
  const [userSuggestions, setUserSuggestions] = useState<UserSuggestion[]>([]);
  const [isSearchingUsers, setIsSearchingUsers] = useState(false);
  const [selectedUserSuggestion, setSelectedUserSuggestion] = useState<UserSuggestion | null>(null);
  const [isTriggeringSubscriptionTest, setIsTriggeringSubscriptionTest] = useState(false);

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

      const mappedLogs: DeliveryItem[] = ((logsData || []) as NotificationDeliveryLogRow[]).map((row) => ({
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

      const mappedWhatsapp: DeliveryItem[] = ((waData || []) as WhatsAppQueueRow[]).map((row) => ({
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
    } catch (fetchError: unknown) {
      console.error("[NotificationDeliveriesPage] erro ao carregar:", fetchError);
      setError(getErrorMessage(fetchError, "Falha ao carregar entregas."));
      toast.error("Erro ao carregar entregas de notificacao.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const term = subscriptionSearchInput.trim();
    if (term.length < 2) {
      setUserSuggestions([]);
      setIsSearchingUsers(false);
      return;
    }

    const sanitized = term.replace(/[%_,]/g, " ").trim();
    if (!sanitized) {
      setUserSuggestions([]);
      setIsSearchingUsers(false);
      return;
    }

    let isCancelled = false;
    const timeoutId = window.setTimeout(async () => {
      setIsSearchingUsers(true);
      try {
        const like = `%${sanitized}%`;
        const { data, error: usersError } = await supabase
          .from("profiles")
          .select("id, full_name, email")
          .or(`full_name.ilike.${like},email.ilike.${like}`)
          .order("full_name", { ascending: true })
          .limit(8);

        if (usersError) throw usersError;
        if (!isCancelled) {
          setUserSuggestions((data || []) as UserSuggestion[]);
        }
      } catch (usersError: unknown) {
        console.error("[NotificationDeliveriesPage] erro ao buscar usuarios:", usersError);
        if (!isCancelled) {
          setUserSuggestions([]);
        }
      } finally {
        if (!isCancelled) {
          setIsSearchingUsers(false);
        }
      }
    }, 250);

    return () => {
      isCancelled = true;
      window.clearTimeout(timeoutId);
    };
  }, [subscriptionSearchInput]);

  const handleClearAll = async () => {
    setIsClearing(true);
    setError(null);

    try {
      const [{ error: logsDeleteError }, { error: queueDeleteError }] = await Promise.all([
        supabase
          .from("notification_delivery_logs")
          .delete()
          .neq("id", "00000000-0000-0000-0000-000000000000"),
        supabase
          .from("whatsapp_notification_queue")
          .delete()
          .neq("id", "00000000-0000-0000-0000-000000000000"),
      ]);

      if (logsDeleteError) throw logsDeleteError;
      if (queueDeleteError) throw queueDeleteError;

      toast.success("Todas as notificacoes foram limpas.");
      setItems([]);
      setClearDialogOpen(false);
    } catch (clearError: unknown) {
      console.error("[NotificationDeliveriesPage] erro ao limpar:", clearError);
      toast.error(getErrorMessage(clearError, "Falha ao limpar notificacoes."));
    } finally {
      setIsClearing(false);
      await fetchData();
    }
  };

  const handleTriggerSubscriptionTest = async () => {
    const target = subscriptionTestTarget.trim();
    if (!target) {
      toast.error("Informe o ID ou e-mail do usuario.");
      return;
    }

    setIsTriggeringSubscriptionTest(true);
    setError(null);

    try {
      const { data: authSession } = await supabase.auth.getSession();
      const accessToken = authSession?.session?.access_token || "";

      if (!accessToken) {
        throw new Error("Sessao expirada. Faca login novamente.");
      }

      const isEmailTarget = target.includes("@");
      const body = {
        access_token: accessToken,
        force: true,
        force_days_remaining: 1,
        ...(isEmailTarget ? { target_user_email: target.toLowerCase() } : { target_user_id: target }),
      };

      const { data, error: invokeError } = await supabase.functions.invoke("process-subscription-expiry-alerts", {
        body,
      });

      if (invokeError) throw invokeError;

      const response = (data && typeof data === "object")
        ? (data as { notified?: unknown; emailed?: unknown; checked?: unknown; errors?: unknown })
        : {};

      const notified = typeof response.notified === "number" ? response.notified : 0;
      const emailed = typeof response.emailed === "number" ? response.emailed : 0;
      const checked = typeof response.checked === "number" ? response.checked : 0;

      toast.success(
        `Teste executado. Processados: ${checked}. Widget: ${notified}. E-mail: ${emailed}.`,
      );

      await fetchData();
    } catch (testError: unknown) {
      console.error("[NotificationDeliveriesPage] erro no teste de assinatura:", testError);
      toast.error(getErrorMessage(testError, "Falha ao executar teste de alerta de assinatura."));
    } finally {
      setIsTriggeringSubscriptionTest(false);
    }
  };

  const handleSelectUserSuggestion = (user: UserSuggestion) => {
    setSelectedUserSuggestion(user);
    setSubscriptionTestTarget(user.id);
    setSubscriptionSearchInput(`${user.full_name || "Usuario"} (${user.email || user.id})`);
    setUserSuggestions([]);
  };

  const handleClearSubscriptionSelection = () => {
    setSelectedUserSuggestion(null);
    setSubscriptionSearchInput("");
    setSubscriptionTestTarget("");
    setUserSuggestions([]);
    setIsSearchingUsers(false);
  };

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
    <Tabs defaultValue="deliveries" className="space-y-6">
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Notificacoes</h1>
          <p className="text-muted-foreground">
            Monitoramento de entregas e configuracao de templates WhatsApp.
          </p>
        </div>
        <TabsList>
          <TabsTrigger value="deliveries">Entregas</TabsTrigger>
          <TabsTrigger value="whatsapp_templates">Templates WhatsApp</TabsTrigger>
          {whatsappGroupsEnabled ? <TabsTrigger value="whatsapp_groups">Grupos WhatsApp</TabsTrigger> : null}
        </TabsList>
      </div>

      <TabsContent value="deliveries" className="space-y-6">
        <div className="flex justify-end gap-2">
          <Button
            variant="outline"
            size="sm"
            className="text-destructive hover:bg-destructive/10"
            onClick={() => setClearDialogOpen(true)}
            disabled={loading || isClearing || items.length === 0}
          >
            {isClearing ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Trash2 className="mr-2 h-4 w-4" />
            )}
            Limpar todas
          </Button>
          <Button variant="outline" size="sm" onClick={fetchData} disabled={loading || isClearing}>
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
        <CardContent className="p-4 space-y-3">
          <div>
            <p className="text-sm font-medium">Teste de alerta de assinatura</p>
            <p className="text-xs text-muted-foreground">
              Dispara agora um lembrete de renovacao para 1 usuario (widget, e-mail e fila WhatsApp quando elegivel).
            </p>
          </div>
          <div className="flex flex-col gap-2 md:flex-row">
            <div className="relative flex-1">
              <Input
                placeholder="Busque por nome/e-mail ou cole o ID do usuario"
                value={subscriptionSearchInput}
                onChange={(event) => {
                  const nextValue = event.target.value;
                  setSubscriptionSearchInput(nextValue);
                  setSubscriptionTestTarget(nextValue.trim());
                  setSelectedUserSuggestion(null);
                }}
                disabled={isTriggeringSubscriptionTest}
              />
              {isSearchingUsers ? (
                <p className="mt-1 text-[11px] text-muted-foreground">Buscando usuarios...</p>
              ) : null}
              {!isSearchingUsers && userSuggestions.length > 0 ? (
                <div className="absolute z-20 mt-1 w-full rounded-md border bg-background p-1 shadow-md">
                  {userSuggestions.map((user) => (
                    <button
                      key={user.id}
                      type="button"
                      className="w-full rounded-sm px-2 py-1.5 text-left text-xs hover:bg-accent"
                      onClick={() => handleSelectUserSuggestion(user)}
                    >
                      <p className="font-medium">{user.full_name || "Usuario sem nome"}</p>
                      <p className="text-muted-foreground">{user.email || user.id}</p>
                    </button>
                  ))}
                </div>
              ) : null}
            </div>
            <div className="flex gap-2">
              <Button
                variant="outline"
                onClick={handleClearSubscriptionSelection}
                disabled={isTriggeringSubscriptionTest || (!subscriptionSearchInput && !subscriptionTestTarget)}
              >
                Limpar selecao
              </Button>
              <Button
                onClick={handleTriggerSubscriptionTest}
                disabled={isTriggeringSubscriptionTest || !subscriptionTestTarget.trim()}
              >
                {isTriggeringSubscriptionTest ? (
                  <span className="inline-flex items-center gap-2">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Disparando...
                  </span>
                ) : (
                  "Testar alerta"
                )}
              </Button>
            </div>
          </div>
          {selectedUserSuggestion ? (
            <p className="text-[11px] text-muted-foreground">
              Usuario selecionado: {selectedUserSuggestion.full_name || "Usuario"} ({selectedUserSuggestion.email || selectedUserSuggestion.id})
            </p>
          ) : (
            <p className="text-[11px] text-muted-foreground">
              Dica: voce pode selecionar na lista ou informar diretamente o ID/e-mail.
            </p>
          )}
        </CardContent>
      </Card>

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

      </TabsContent>

      <TabsContent value="whatsapp_templates">
        <WhatsappTemplateSettingsTab />
      </TabsContent>

      {whatsappGroupsEnabled ? (
        <TabsContent value="whatsapp_groups">
          <WhatsappGroupsAdminTab />
        </TabsContent>
      ) : null}

      <AlertDialog open={clearDialogOpen} onOpenChange={setClearDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Limpar todas as notificacoes?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta acao apagara todo o historico de envios dos canais e-mail, widget e WhatsApp.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isClearing}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleClearAll}
              disabled={isClearing}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {isClearing ? (
                <span className="inline-flex items-center gap-2">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Limpando...
                </span>
              ) : (
                "Sim, limpar tudo"
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Tabs>
  );
};

export default NotificationDeliveriesPage;
