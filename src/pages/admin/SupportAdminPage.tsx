"use client";

import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useSiteConfig } from "@/hooks/use-site-config";
import { supabase } from "@/integrations/supabase/client";
import {
  computeLiveSupportSlaStatus,
  formatSupportDueDate,
  formatSupportSlaPromise,
  getSupportCategoryConfig,
  getSupportSlaStatusMeta,
  normalizeSupportSlaConfig,
} from "@/lib/support-sla";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import {
  AlertCircle,
  Eye,
  Filter,
  Loader2,
  MessageSquare,
  Search,
  ShieldAlert,
  Trash2,
} from "lucide-react";
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

type TicketPriority = "low" | "medium" | "high" | "urgent";
type TicketStatus = "open" | "in_progress" | "closed";

type TicketItem = {
  id: string;
  user_id: string;
  subject: string;
  description: string;
  status: TicketStatus;
  priority: TicketPriority;
  category: string | null;
  created_at: string;
  updated_at: string;
  first_response_due_at?: string | null;
  first_response_at?: string | null;
  user?: {
    full_name?: string;
    email?: string;
  } | null;
};

const getPriorityMeta = (priority: string) => {
  switch (priority) {
    case "urgent":
      return {
        label: "Urgente",
        weight: 4,
        rowClass:
          "bg-red-50/70 hover:bg-red-100/70 dark:bg-red-950/25 dark:hover:bg-red-950/40",
        badgeClass:
          "bg-red-100 text-red-800 border-red-200 dark:bg-red-950/40 dark:text-red-200 dark:border-red-900",
      };
    case "high":
      return {
        label: "Alta",
        weight: 3,
        rowClass:
          "bg-orange-50/70 hover:bg-orange-100/70 dark:bg-orange-950/25 dark:hover:bg-orange-950/40",
        badgeClass:
          "bg-orange-100 text-orange-800 border-orange-200 dark:bg-orange-950/40 dark:text-orange-200 dark:border-orange-900",
      };
    case "medium":
      return {
        label: "Média",
        weight: 2,
        rowClass:
          "bg-amber-50/70 hover:bg-amber-100/70 dark:bg-amber-950/25 dark:hover:bg-amber-950/40",
        badgeClass:
          "bg-amber-100 text-amber-800 border-amber-200 dark:bg-amber-950/40 dark:text-amber-200 dark:border-amber-900",
      };
    default:
      return {
        label: "Baixa",
        weight: 1,
        rowClass:
          "bg-emerald-50/70 hover:bg-emerald-100/70 dark:bg-emerald-950/25 dark:hover:bg-emerald-950/40",
        badgeClass:
          "bg-emerald-100 text-emerald-800 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-200 dark:border-emerald-900",
      };
  }
};

const getTicketStatusLabel = (status: string) => {
  switch (status) {
    case "open":
      return "Aberto";
    case "in_progress":
      return "Em atendimento";
    case "closed":
      return "Fechado";
    default:
      return status;
  }
};

const compareTicketsBySla = (a: TicketItem, b: TicketItem) => {
  const aAnswered = Boolean(a.first_response_at);
  const bAnswered = Boolean(b.first_response_at);

  if (aAnswered !== bAnswered) {
    return aAnswered ? 1 : -1;
  }

  const aDue = a.first_response_due_at ? new Date(a.first_response_due_at).getTime() : Number.MAX_SAFE_INTEGER;
  const bDue = b.first_response_due_at ? new Date(b.first_response_due_at).getTime() : Number.MAX_SAFE_INTEGER;

  if (aDue !== bDue) {
    return aDue - bDue;
  }

  return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
};

const SupportAdminPage = () => {
  const { data: siteConfig } = useSiteConfig();
  const [tickets, setTickets] = useState<TicketItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterStatus, setFilterStatus] = useState("all");
  const [filterCategory, setFilterCategory] = useState("all");
  const [sortBy, setSortBy] = useState<"sla" | "priority" | "date">("sla");
  const [searchTerm, setSearchTerm] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [ticketToDelete, setTicketToDelete] = useState<TicketItem | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const supportSlaConfig = useMemo(
    () => normalizeSupportSlaConfig(siteConfig?.support_sla_config),
    [siteConfig?.support_sla_config],
  );
  const categoryOptions = supportSlaConfig.categories;

  useEffect(() => {
    void fetchTickets();
  }, []);

  const fetchTickets = async () => {
    setLoading(true);
    setError(null);

    try {
      const { data, error: fetchError } = await supabase
        .from("support_tickets")
        .select("*, user:profiles(full_name, email)")
        .order("created_at", { ascending: false });

      if (fetchError) {
        console.error("[SupportAdmin] Erro ao buscar tickets:", fetchError);
        setError(fetchError.message);
        return;
      }

      setTickets((data || []) as TicketItem[]);
    } catch (error: any) {
      console.error("[SupportAdmin] Erro inesperado:", error);
      setError(error.message || "Erro ao carregar dados.");
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateStatus = async (id: string, status: string) => {
    try {
      const { error } = await supabase
        .from("support_tickets")
        .update({ status, updated_at: new Date().toISOString() })
        .eq("id", id);

      if (error) throw error;

      toast.success("Status atualizado.");
      void fetchTickets();
    } catch (error) {
      console.error("[SupportAdmin] Erro ao atualizar status:", error);
      toast.error("Erro ao atualizar status.");
    }
  };

  const handleDeleteTicket = async () => {
    if (!ticketToDelete) return;

    setIsDeleting(true);

    try {
      const { error } = await supabase.from("support_tickets").delete().eq("id", ticketToDelete.id);
      if (error) throw error;

      toast.success("Ticket excluido com sucesso.");
      setTickets((current) => current.filter((ticket) => ticket.id !== ticketToDelete.id));
      setTicketToDelete(null);
    } catch (error) {
      console.error("[SupportAdmin] Erro ao excluir ticket:", error);
      toast.error("Erro ao excluir ticket.");
    } finally {
      setIsDeleting(false);
    }
  };

  const filteredTickets = useMemo(() => {
    return tickets
      .filter((ticket) => {
        const matchesStatus = filterStatus === "all" || ticket.status === filterStatus;
        const matchesCategory = filterCategory === "all" || (ticket.category || "general") === filterCategory;
        const normalizedSearch = searchTerm.trim().toLowerCase();
        const matchesSearch =
          normalizedSearch.length === 0 ||
          ticket.subject.toLowerCase().includes(normalizedSearch) ||
          (ticket.user?.full_name || "").toLowerCase().includes(normalizedSearch) ||
          (ticket.user?.email || "").toLowerCase().includes(normalizedSearch);

        return matchesStatus && matchesCategory && matchesSearch;
      })
      .sort((a, b) => {
        if (sortBy === "date") {
          return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
        }

        if (sortBy === "priority") {
          const priorityDiff = getPriorityMeta(b.priority).weight - getPriorityMeta(a.priority).weight;
          if (priorityDiff !== 0) return priorityDiff;
          return compareTicketsBySla(a, b);
        }

        const slaDiff = compareTicketsBySla(a, b);
        if (slaDiff !== 0) return slaDiff;

        return getPriorityMeta(b.priority).weight - getPriorityMeta(a.priority).weight;
      });
  }, [tickets, filterCategory, filterStatus, searchTerm, sortBy]);

  const overdueCount = filteredTickets.filter((ticket) => {
    const status = computeLiveSupportSlaStatus({
      createdAt: ticket.created_at,
      dueAt: ticket.first_response_due_at,
      firstResponseAt: ticket.first_response_at,
    });
    return status === "overdue";
  }).length;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Central de atendimento</h1>
          <p className="text-muted-foreground">
            Gerencie chamados por categoria e acompanhe o SLA da primeira resposta.
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={fetchTickets} disabled={loading}>
          Atualizar lista
        </Button>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <Card className="border-primary/10 bg-primary/5">
          <CardContent className="p-5">
            <p className="text-sm font-semibold text-foreground">SLA público</p>
            <p className="mt-1 text-sm text-muted-foreground">
              Pagamentos em até 2 horas úteis. Demais categorias em até 24 horas úteis.
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-5">
            <p className="text-sm font-semibold text-foreground">Chamados filtrados</p>
            <p className="mt-1 text-2xl font-bold">{filteredTickets.length}</p>
          </CardContent>
        </Card>
        <Card className={cn(overdueCount > 0 && "border-rose-200 bg-rose-50/80")}>
          <CardContent className="p-5">
            <p className="text-sm font-semibold text-foreground">SLA atrasado</p>
            <p className="mt-1 text-2xl font-bold">{overdueCount}</p>
          </CardContent>
        </Card>
      </div>

      {error && (
        <div className="flex items-center gap-3 rounded-lg border border-destructive/20 bg-destructive/10 p-4 text-destructive">
          <AlertCircle className="h-5 w-5" />
          <div className="text-sm">
            <p className="font-bold">Erro ao carregar chamados</p>
            <p>{error}</p>
          </div>
        </div>
      )}

      <div className="flex flex-col gap-4 xl:flex-row">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Buscar por assunto, nome ou e-mail..."
            className="pl-10"
            value={searchTerm}
            onChange={(event) => setSearchTerm(event.target.value)}
          />
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Filter className="h-4 w-4 text-muted-foreground" />
          <Select value={filterStatus} onValueChange={setFilterStatus}>
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos os status</SelectItem>
              <SelectItem value="open">Abertos</SelectItem>
              <SelectItem value="in_progress">Em atendimento</SelectItem>
              <SelectItem value="closed">Fechados</SelectItem>
            </SelectContent>
          </Select>
          <Select value={filterCategory} onValueChange={setFilterCategory}>
            <SelectTrigger className="w-[200px]">
              <SelectValue placeholder="Categoria" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas as categorias</SelectItem>
              {categoryOptions.map((category) => (
                <SelectItem key={category.key} value={category.key}>
                  {category.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={sortBy} onValueChange={(value) => setSortBy(value as "sla" | "priority" | "date")}>
            <SelectTrigger className="w-[210px]">
              <SelectValue placeholder="Ordenação" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="sla">Ordenar por SLA</SelectItem>
              <SelectItem value="priority">Ordenar por prioridade</SelectItem>
              <SelectItem value="date">Ordenar por data</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <Card>
        <CardContent className="p-0">
          {loading ? (
            <div className="flex justify-center py-12">
              <Loader2 className="animate-spin text-primary" />
            </div>
          ) : filteredTickets.length > 0 ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Usuário</TableHead>
                  <TableHead>Assunto</TableHead>
                  <TableHead>Categoria</TableHead>
                  <TableHead>SLA</TableHead>
                  <TableHead>Prioridade</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Prazo</TableHead>
                  <TableHead className="text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredTickets.map((ticket) => {
                  const priorityMeta = getPriorityMeta(ticket.priority);
                  const categoryMeta = getSupportCategoryConfig(ticket.category, supportSlaConfig);
                  const slaStatus = computeLiveSupportSlaStatus({
                    createdAt: ticket.created_at,
                    dueAt: ticket.first_response_due_at,
                    firstResponseAt: ticket.first_response_at,
                  });
                  const slaMeta = getSupportSlaStatusMeta(slaStatus);

                  return (
                    <TableRow key={ticket.id} className={cn("transition-colors", priorityMeta.rowClass)}>
                      <TableCell>
                        <div className="text-sm font-medium">
                          {ticket.user?.full_name || "Usuário desconhecido"}
                        </div>
                        <div className="text-[10px] text-muted-foreground">
                          {ticket.user?.email || "N/A"}
                        </div>
                      </TableCell>
                      <TableCell className="max-w-[260px]">
                        <div className="truncate font-medium">{ticket.subject}</div>
                        <div className="text-[10px] text-muted-foreground">
                          {new Date(ticket.created_at).toLocaleString("pt-BR")}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="space-y-1">
                          <Badge variant="outline">{categoryMeta.label}</Badge>
                          <p className="max-w-[180px] text-[10px] text-muted-foreground">
                            {formatSupportSlaPromise(ticket.category, supportSlaConfig)}
                          </p>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className={slaMeta.className}>
                          {slaMeta.label}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className={cn("font-semibold", priorityMeta.badgeClass)}>
                          {priorityMeta.label}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Select value={ticket.status} onValueChange={(value) => handleUpdateStatus(ticket.id, value)}>
                          <SelectTrigger className="h-8 w-[150px] text-xs">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="open">Aberto</SelectItem>
                            <SelectItem value="in_progress">Em atendimento</SelectItem>
                            <SelectItem value="closed">Fechado</SelectItem>
                          </SelectContent>
                        </Select>
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {ticket.first_response_at
                          ? `Respondido em ${formatSupportDueDate(ticket.first_response_at)}`
                          : formatSupportDueDate(ticket.first_response_due_at)}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-2">
                          <Button variant="ghost" size="sm" asChild className="gap-2">
                            <Link to={`/admin/suporte/${ticket.id}`}>
                              <Eye className="h-4 w-4" />
                              Responder
                            </Link>
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="text-destructive hover:bg-destructive/10"
                            onClick={() => setTicketToDelete(ticket)}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          ) : (
            <div className="py-12 text-center text-muted-foreground">
              <MessageSquare className="mx-auto mb-4 h-12 w-12 opacity-20" />
              <p>Nenhum chamado encontrado.</p>
            </div>
          )}
        </CardContent>
      </Card>

      <AlertDialog
        open={Boolean(ticketToDelete)}
        onOpenChange={(open) => {
          if (!open) setTicketToDelete(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2 text-destructive">
              <ShieldAlert className="h-5 w-5" />
              Excluir chamado permanentemente
            </AlertDialogTitle>
            <AlertDialogDescription>
              Você tem certeza que deseja excluir o ticket <strong>"{ticketToDelete?.subject}"</strong>?
              Esta ação é irreversível e apagará todo o histórico do chamado.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeleting}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={(event) => {
                event.preventDefault();
                void handleDeleteTicket();
              }}
              disabled={isDeleting}
            >
              {isDeleting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              Confirmar exclusão
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default SupportAdminPage;
