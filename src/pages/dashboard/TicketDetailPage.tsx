"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { useAuth } from "@/components/auth/AuthProvider";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useSiteConfig } from "@/hooks/use-site-config";
import {
  supabase,
  SUPABASE_PUBLISHABLE_KEY,
  SUPABASE_URL,
} from "@/integrations/supabase/client";
import {
  computeLiveSupportSlaStatus,
  formatSupportBusinessHoursSummary,
  formatSupportDueDate,
  formatSupportSlaPromise,
  getSupportCategoryConfig,
  getSupportSlaStatusMeta,
  normalizeSupportBusinessHoursConfig,
  normalizeSupportSlaConfig,
} from "@/lib/support-sla";
import { sanitizeStorageFileName, sanitizeStoragePath } from "@/lib/storage-path";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import {
  AlertCircle,
  ArrowLeft,
  CheckCircle2,
  Clock,
  Download,
  FileIcon,
  Loader2,
  Paperclip,
  Send,
  ShieldAlert,
  X,
} from "lucide-react";

const getPriorityLabel = (priority: string) => {
  switch (priority) {
    case "low":
      return "Baixa";
    case "medium":
      return "Média";
    case "high":
      return "Alta";
    case "urgent":
      return "Urgente";
    default:
      return priority;
  }
};

const getTicketStatusBadge = (status: string) => {
  switch (status) {
    case "open":
      return <Badge className="bg-blue-500">Aberto</Badge>;
    case "in_progress":
      return <Badge className="bg-amber-500">Em atendimento</Badge>;
    case "closed":
      return <Badge variant="secondary">Fechado</Badge>;
    default:
      return <Badge>{status}</Badge>;
  }
};

const TicketDetailPage = () => {
  const { id } = useParams();
  const { user } = useAuth();
  const { data: siteConfig } = useSiteConfig();
  const [ticket, setTicket] = useState<any>(null);
  const [messages, setMessages] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [newMessage, setNewMessage] = useState("");
  const [isSending, setIsSending] = useState(false);
  const [attachment, setAttachment] = useState<File | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [isUpdatingStatus, setIsUpdatingStatus] = useState(false);

  const scrollRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const supportSlaConfig = useMemo(
    () => normalizeSupportSlaConfig(siteConfig?.support_sla_config),
    [siteConfig?.support_sla_config],
  );
  const supportBusinessHours = useMemo(
    () => normalizeSupportBusinessHoursConfig(siteConfig?.support_business_hours_config),
    [siteConfig?.support_business_hours_config],
  );

  const notifySupport = async (payload: Record<string, any>) => {
    try {
      const {
        data: { session: currentSession },
      } = await supabase.auth.getSession();
      const { data: refreshed } = await supabase.auth.refreshSession();
      const accessToken = refreshed.session?.access_token || currentSession?.access_token || "";

      if (!accessToken) {
        console.warn("[SupportChat] Sem token para notify-support.");
        return;
      }

      const response = await fetch(`${SUPABASE_URL}/functions/v1/notify-support`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          apikey: SUPABASE_PUBLISHABLE_KEY,
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({
          ...payload,
          access_token: accessToken,
        }),
      });

      if (!response.ok) {
        const detail = await response.text();
        console.warn("[SupportChat] Falha notify-support:", response.status, detail);
      }
    } catch (error) {
      console.warn("[SupportChat] Falha inesperada notify-support:", error);
    }
  };

  useEffect(() => {
    if (!id) return;

    void fetchTicket();
    void fetchMessages();
    void checkAdminStatus();

    const channel = supabase
      .channel(`support-chat-${id}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "support_messages",
          filter: `ticket_id=eq.${id}`,
        },
        (payload) => {
          setMessages((current) => {
            if (current.some((message) => message.id === payload.new.id)) {
              return current;
            }
            return [...current, payload.new];
          });
        },
      )
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "support_tickets",
          filter: `id=eq.${id}`,
        },
        (payload) => {
          setTicket((current: any) => ({ ...current, ...payload.new }));
        },
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [id]);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const checkAdminStatus = async () => {
    if (!user) return;

    const { data } = await supabase
      .from("profiles")
      .select("is_admin, role")
      .eq("id", user.id)
      .single();

    setIsAdmin(Boolean(data?.is_admin || data?.role === "admin"));
  };

  const fetchTicket = async () => {
    try {
      const { data, error } = await supabase
        .from("support_tickets")
        .select("*, user:profiles!support_tickets_user_id_fkey(full_name, avatar_url)")
        .eq("id", id)
        .single();

      if (error) throw error;
      setTicket(data);
    } catch (error) {
      console.error("[TicketDetailPage] Erro ao buscar ticket:", error);
    } finally {
      setLoading(false);
    }
  };

  const fetchMessages = async () => {
    try {
      const { data, error } = await supabase
        .from("support_messages")
        .select("*")
        .eq("ticket_id", id)
        .order("created_at", { ascending: true });

      if (error) throw error;
      setMessages(data || []);
    } catch (error) {
      console.error("[TicketDetailPage] Erro ao buscar mensagens:", error);
    }
  };

  const handleUpdateStatus = async (newStatus: string) => {
    setIsUpdatingStatus(true);

    try {
      const { error } = await supabase
        .from("support_tickets")
        .update({ status: newStatus, updated_at: new Date().toISOString() })
        .eq("id", id);

      if (error) throw error;

      if (newStatus === "closed") {
        void notifySupport({ type: "ticket_closed", ticketId: id, senderId: user?.id });
      }

      toast.success("Status atualizado.");
    } catch (error) {
      console.error("[TicketDetailPage] Erro ao atualizar status:", error);
      toast.error("Erro ao atualizar status.");
    } finally {
      setIsUpdatingStatus(false);
    }
  };

  const handleSendMessage = async (event: React.FormEvent) => {
    event.preventDefault();
    if ((!newMessage.trim() && !attachment) || isSending) return;

    setIsSending(true);
    const messageText = newMessage.trim();

    try {
      let attachmentUrl: string | null = null;
      let attachmentName: string | null = null;

      if (attachment) {
        const safeName = sanitizeStorageFileName(attachment.name, "anexo");
        const fileExt = safeName.split(".").pop() || "bin";
        const fileName = `${crypto.randomUUID()}.${fileExt}`;
        const filePath = sanitizeStoragePath(`support/${user?.id}/${fileName}`, {
          bucket: "uploads",
        });

        const { error: uploadError } = await supabase.storage
          .from("uploads")
          .upload(filePath, attachment);

        if (uploadError) throw uploadError;

        const {
          data: { publicUrl },
        } = supabase.storage.from("uploads").getPublicUrl(filePath);

        attachmentUrl = publicUrl;
        attachmentName = attachment.name;
      }

      const { error } = await supabase.from("support_messages").insert({
        ticket_id: id,
        sender_id: user?.id,
        message: messageText,
        attachment_url: attachmentUrl,
        attachment_name: attachmentName,
      });

      if (error) throw error;

      void notifySupport({
        type: "new_message",
        ticketId: id,
        senderId: user?.id,
        message: messageText || (attachment ? "[Arquivo anexo]" : ""),
      });

      setNewMessage("");
      setAttachment(null);
    } catch (error) {
      console.error("[TicketDetailPage] Erro ao enviar mensagem:", error);
      toast.error("Erro ao enviar mensagem.");
    } finally {
      setIsSending(false);
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center p-12">
        <Loader2 className="animate-spin text-primary" />
      </div>
    );
  }

  if (!ticket) {
    return <div className="p-12 text-center">Chamado não encontrado.</div>;
  }

  const isClosed = ticket.status === "closed";
  const category = getSupportCategoryConfig(ticket.category, supportSlaConfig);
  const slaStatus = computeLiveSupportSlaStatus({
    createdAt: ticket.created_at,
    dueAt: ticket.first_response_due_at,
    firstResponseAt: ticket.first_response_at,
  });
  const slaMeta = getSupportSlaStatusMeta(slaStatus);

  const renderAttachment = (url: string, name: string) => (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      className="mt-2 flex items-center gap-2 rounded border border-black/10 bg-black/5 p-2 text-xs font-medium transition-colors hover:bg-black/10"
    >
      <FileIcon className="h-4 w-4 shrink-0" />
      <span className="flex-1 truncate">{name || "Anexo"}</span>
      <Download className="h-3 w-3" />
    </a>
  );

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" asChild>
          <Link to={isAdmin ? "/admin/suporte" : "/dashboard/suporte"}>
            <ArrowLeft className="h-5 w-5" />
          </Link>
        </Button>

        <div className="min-w-0 flex-1">
          <h1 className="truncate text-2xl font-bold">{ticket.subject}</h1>
          <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
            <span>Ticket #{ticket.id.slice(0, 8)}</span>
            <span>•</span>
            <span>Aberto em {new Date(ticket.created_at).toLocaleDateString("pt-BR")}</span>
          </div>
        </div>

        {getTicketStatusBadge(ticket.status)}
      </div>

      <div className="grid gap-6 md:grid-cols-4">
        <div className="space-y-4 md:col-span-3">
          <Card className="flex h-[600px] flex-col">
            <CardHeader className="flex-row items-center justify-between border-b py-3">
              <CardTitle className="flex items-center gap-2 text-sm font-medium">
                <Clock className="h-4 w-4 text-muted-foreground" />
                Histórico de mensagens
              </CardTitle>

              {isAdmin && (
                <div className="flex items-center gap-2">
                  <span className="text-[10px] font-bold uppercase text-muted-foreground">
                    Status:
                  </span>
                  <Select
                    defaultValue={ticket.status}
                    onValueChange={handleUpdateStatus}
                    disabled={isUpdatingStatus}
                  >
                    <SelectTrigger className="h-8 w-[150px] text-xs">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="open">Aberto</SelectItem>
                      <SelectItem value="in_progress">Em atendimento</SelectItem>
                      <SelectItem value="closed">Fechado</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              )}
            </CardHeader>

            <CardContent className="flex-1 space-y-4 overflow-y-auto p-4" ref={scrollRef}>
              <div className="flex justify-start">
                <div className="max-w-[80%] rounded-2xl rounded-tl-none border bg-secondary/30 p-4">
                  <p className="mb-1 text-xs font-bold uppercase tracking-wider text-primary">
                    Descrição do problema
                  </p>
                  <p className="whitespace-pre-wrap text-sm">{ticket.description}</p>
                  {ticket.attachment_url && renderAttachment(ticket.attachment_url, ticket.attachment_name)}
                  <p className="mt-2 text-right text-[10px] text-muted-foreground">
                    {new Date(ticket.created_at).toLocaleTimeString("pt-BR", {
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </p>
                </div>
              </div>

              {messages.map((message) => {
                const isMe = message.sender_id === user?.id;

                return (
                  <div
                    key={message.id}
                    className={cn("flex flex-col gap-1", isMe ? "items-end" : "items-start")}
                  >
                    {!isMe && (
                      <span className="ml-1 text-[10px] font-bold uppercase tracking-wider text-primary">
                        Equipe de suporte
                      </span>
                    )}
                    <div
                      className={cn(
                        "max-w-[80%] rounded-2xl p-3 shadow-sm",
                        isMe
                          ? "rounded-tr-none bg-primary text-primary-foreground"
                          : "rounded-tl-none border bg-card",
                      )}
                    >
                      <p className="whitespace-pre-wrap text-sm">{message.message}</p>
                      {message.attachment_url &&
                        renderAttachment(message.attachment_url, message.attachment_name)}
                      <p className="mt-1 text-right text-[10px] opacity-70">
                        {new Date(message.created_at).toLocaleTimeString("pt-BR", {
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </p>
                    </div>
                  </div>
                );
              })}
            </CardContent>

            <CardFooter className="flex-col gap-2 border-t p-4">
              {attachment && (
                <div className="flex w-full items-center gap-2 rounded bg-secondary/50 p-2 text-xs">
                  <Paperclip className="h-3 w-3" />
                  <span className="flex-1 truncate">{attachment.name}</span>
                  <button type="button" onClick={() => setAttachment(null)}>
                    <X className="h-3 w-3" />
                  </button>
                </div>
              )}

              {isClosed && !isAdmin ? (
                <div className="flex w-full items-center justify-center gap-2 rounded-lg bg-secondary/20 p-3 text-muted-foreground">
                  <CheckCircle2 className="h-4 w-4" />
                  <span className="text-sm font-medium">Este chamado foi encerrado.</span>
                </div>
              ) : (
                <form onSubmit={handleSendMessage} className="flex w-full gap-2">
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={isSending}
                  >
                    <Paperclip className="h-4 w-4" />
                  </Button>
                  <input
                    type="file"
                    ref={fileInputRef}
                    className="hidden"
                    onChange={(event) => setAttachment(event.target.files?.[0] || null)}
                  />
                  <Input
                    placeholder="Digite sua mensagem..."
                    value={newMessage}
                    onChange={(event) => setNewMessage(event.target.value)}
                    disabled={isSending}
                  />
                  <Button type="submit" size="icon" disabled={isSending || (!newMessage.trim() && !attachment)}>
                    {isSending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                  </Button>
                </form>
              )}
            </CardFooter>
          </Card>
        </div>

        <div className="space-y-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">Informações</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-1">
                <p className="text-[10px] font-bold uppercase text-muted-foreground">Usuário</p>
                <p className="text-xs font-medium">{ticket.user?.full_name}</p>
              </div>

              <div className="space-y-1">
                <p className="text-[10px] font-bold uppercase text-muted-foreground">Categoria</p>
                <Badge variant="outline">{category.label}</Badge>
              </div>

              <div className="space-y-1">
                <p className="text-[10px] font-bold uppercase text-muted-foreground">Prioridade</p>
                <Badge variant="outline">{getPriorityLabel(ticket.priority)}</Badge>
              </div>

              <div className="space-y-1">
                <p className="text-[10px] font-bold uppercase text-muted-foreground">SLA da primeira resposta</p>
                <Badge variant="outline" className={slaMeta.className}>
                  {slaMeta.label}
                </Badge>
                <p className="text-xs text-muted-foreground">
                  {formatSupportSlaPromise(ticket.category, supportSlaConfig)}
                </p>
              </div>

              <div className="space-y-1">
                <p className="text-[10px] font-bold uppercase text-muted-foreground">Prazo previsto</p>
                <p className="text-xs">{formatSupportDueDate(ticket.first_response_due_at)}</p>
              </div>

              <div className="space-y-1">
                <p className="text-[10px] font-bold uppercase text-muted-foreground">Primeira resposta</p>
                <p className="text-xs">
                  {ticket.first_response_at ? formatSupportDueDate(ticket.first_response_at) : "Ainda não respondido"}
                </p>
              </div>

              <div className="space-y-1">
                <p className="text-[10px] font-bold uppercase text-muted-foreground">Ultima atualizacao</p>
                <p className="text-xs">{new Date(ticket.updated_at).toLocaleString("pt-BR")}</p>
              </div>
            </CardContent>
          </Card>

          <div className="flex gap-3 rounded-lg border border-amber-200 bg-amber-50 p-4">
            <AlertCircle className="h-5 w-5 shrink-0 text-amber-600" />
            <div className="space-y-1 text-xs leading-relaxed text-amber-900">
              <p className="font-semibold">{formatSupportSlaPromise(ticket.category, supportSlaConfig)}</p>
              <p>Horario do suporte: {formatSupportBusinessHoursSummary(supportBusinessHours)}.</p>
            </div>
          </div>

          <div className="flex gap-3 rounded-lg border border-rose-200 bg-rose-50 p-4">
            <ShieldAlert className="h-5 w-5 shrink-0 text-rose-600" />
            <p className="text-xs leading-relaxed text-rose-900">
              Se o caso envolver segurança, suspeita de crime ou fraude, mantenha o chamado ativo e registre também a denúncia do perfil envolvido.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default TicketDetailPage;
