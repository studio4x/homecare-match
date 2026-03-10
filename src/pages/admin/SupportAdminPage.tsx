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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Loader2,
  MessageSquare,
  Eye,
  Search,
  Filter,
  AlertCircle,
  Trash2,
  ShieldAlert,
} from "lucide-react";
import { Link } from "react-router-dom";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
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

type TicketItem = {
  id: string;
  user_id: string;
  subject: string;
  description: string;
  status: "open" | "in_progress" | "closed";
  priority: TicketPriority;
  created_at: string;
  updated_at: string;
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

const SupportAdminPage = () => {
  const [tickets, setTickets] = useState<TicketItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterStatus, setFilterStatus] = useState("all");
  const [searchTerm, setSearchTerm] = useState("");
  const [error, setError] = useState<string | null>(null);

  const [ticketToDelete, setTicketToDelete] = useState<TicketItem | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  useEffect(() => {
    fetchTickets();
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
    } catch (err: any) {
      console.error("[SupportAdmin] Erro inesperado:", err);
      setError(err.message || "Erro ao carregar dados.");
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateStatus = async (id: string, status: string) => {
    try {
      const { error: updateError } = await supabase
        .from("support_tickets")
        .update({ status, updated_at: new Date().toISOString() })
        .eq("id", id);

      if (updateError) {
        throw updateError;
      }

      toast.success("Status atualizado!");
      fetchTickets();
    } catch {
      toast.error("Erro ao atualizar status.");
    }
  };

  const handleDeleteTicket = async () => {
    if (!ticketToDelete) return;

    setIsDeleting(true);
    try {
      const { error: deleteError } = await supabase
        .from("support_tickets")
        .delete()
        .eq("id", ticketToDelete.id);

      if (deleteError) {
        throw deleteError;
      }

      toast.success("Ticket excluído com sucesso!");
      setTickets((prev) => prev.filter((ticket) => ticket.id !== ticketToDelete.id));
      setTicketToDelete(null);
    } catch (err: any) {
      console.error("[SupportAdmin] Erro ao excluir ticket:", err);
      toast.error("Erro ao excluir ticket.");
    } finally {
      setIsDeleting(false);
    }
  };

  const filteredTickets = useMemo(() => {
    return tickets
      .filter((ticket) => {
        const matchesStatus = filterStatus === "all" || ticket.status === filterStatus;
        const matchesSearch =
          ticket.subject.toLowerCase().includes(searchTerm.toLowerCase()) ||
          (ticket.user?.full_name || "").toLowerCase().includes(searchTerm.toLowerCase()) ||
          (ticket.user?.email || "").toLowerCase().includes(searchTerm.toLowerCase());

        return matchesStatus && matchesSearch;
      })
      .sort((a, b) => {
        const priorityDiff = getPriorityMeta(b.priority).weight - getPriorityMeta(a.priority).weight;
        if (priorityDiff !== 0) return priorityDiff;

        const dateA = new Date(a.created_at).getTime();
        const dateB = new Date(b.created_at).getTime();
        return dateB - dateA;
      });
  }, [tickets, filterStatus, searchTerm]);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Central de Atendimento</h1>
          <p className="text-muted-foreground">Gerencie os chamados de suporte de todos os usuários.</p>
        </div>
        <Button variant="outline" size="sm" onClick={fetchTickets} disabled={loading}>
          Atualizar Lista
        </Button>
      </div>

      {error && (
        <div className="bg-destructive/10 border border-destructive/20 rounded-lg p-4 flex items-center gap-3 text-destructive">
          <AlertCircle className="h-5 w-5" />
          <div className="text-sm">
            <p className="font-bold">Erro ao carregar chamados</p>
            <p>{error}</p>
            <p className="mt-2 text-xs opacity-80">
              Dica: certifique-se de clicar em "Sincronizar Central de Suporte" nas Configurações.
            </p>
          </div>
        </div>
      )}

      <div className="flex flex-col md:flex-row gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar por assunto, nome ou e-mail..."
            className="pl-10"
            value={searchTerm}
            onChange={(event) => setSearchTerm(event.target.value)}
          />
        </div>
        <div className="flex items-center gap-2">
          <Filter className="h-4 w-4 text-muted-foreground" />
          <Select value={filterStatus} onValueChange={setFilterStatus}>
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos os Status</SelectItem>
              <SelectItem value="open">Abertos</SelectItem>
              <SelectItem value="in_progress">Em Atendimento</SelectItem>
              <SelectItem value="closed">Fechados</SelectItem>
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
                  <TableHead>Prioridade</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Data</TableHead>
                  <TableHead className="text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredTickets.map((ticket) => (
                  <TableRow
                    key={ticket.id}
                    className={cn("transition-colors", getPriorityMeta(ticket.priority).rowClass)}
                  >
                    <TableCell>
                      <div className="font-medium text-sm">{ticket.user?.full_name || "Usuário desconhecido"}</div>
                      <div className="text-[10px] text-muted-foreground">{ticket.user?.email || "N/A"}</div>
                    </TableCell>
                    <TableCell className="max-w-[280px] truncate font-medium">{ticket.subject}</TableCell>
                    <TableCell>
                      <Badge
                        variant="outline"
                        className={cn("font-semibold", getPriorityMeta(ticket.priority).badgeClass)}
                      >
                        {getPriorityMeta(ticket.priority).label}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Select
                        value={ticket.status}
                        onValueChange={(value) => handleUpdateStatus(ticket.id, value)}
                      >
                        <SelectTrigger className="h-8 text-xs w-[140px]">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="open">Aberto</SelectItem>
                          <SelectItem value="in_progress">Em Atendimento</SelectItem>
                          <SelectItem value="closed">Fechado</SelectItem>
                        </SelectContent>
                      </Select>
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {new Date(ticket.created_at).toLocaleString("pt-BR")}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-2">
                        <Button variant="ghost" size="sm" asChild className="gap-2">
                          <Link to={`/admin/suporte/${ticket.id}`}>
                            <Eye className="h-4 w-4" /> Responder
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
                ))}
              </TableBody>
            </Table>
          ) : (
            <div className="text-center py-12 text-muted-foreground">
              <MessageSquare className="h-12 w-12 mx-auto mb-4 opacity-20" />
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
              Esta ação é irreversível e apagará todo o histórico de mensagens para você e para o usuário.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeleting}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={(event) => {
                event.preventDefault();
                handleDeleteTicket();
              }}
              disabled={isDeleting}
            >
              {isDeleting ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              Confirmar exclusão
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default SupportAdminPage;
