"use client";

import { useEffect, useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { useAuth } from "@/components/auth/AuthProvider";
import SupportTicketModal from "@/components/SupportTicketModal";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
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
import { Eye, LifeBuoy, Loader2, MessageSquare, Plus } from "lucide-react";

const getStatusBadge = (status: string) => {
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

const SupportTicketsPage = () => {
  const { user } = useAuth();
  const { data: siteConfig } = useSiteConfig();
  const [tickets, setTickets] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalInitialStep, setModalInitialStep] = useState<"choice" | "form">("choice");
  const [searchParams, setSearchParams] = useSearchParams();

  const supportSlaConfig = useMemo(
    () => normalizeSupportSlaConfig(siteConfig?.support_sla_config),
    [siteConfig?.support_sla_config],
  );

  useEffect(() => {
    if (user) {
      void fetchTickets();
    }
  }, [user]);

  useEffect(() => {
    const shouldOpenModal = searchParams.get("openTicketModal") === "1";
    if (!shouldOpenModal) return;

    const desiredStep = searchParams.get("ticketStep") === "form" ? "form" : "choice";
    setModalInitialStep(desiredStep);
    setIsModalOpen(true);

    const next = new URLSearchParams(searchParams);
    next.delete("openTicketModal");
    next.delete("ticketStep");
    setSearchParams(next, { replace: true });
  }, [searchParams, setSearchParams]);

  const fetchTickets = async () => {
    try {
      const { data, error } = await supabase
        .from("support_tickets")
        .select("*")
        .eq("user_id", user?.id)
        .order("created_at", { ascending: false });

      if (error) throw error;
      setTickets(data || []);
    } catch (error) {
      console.error("[SupportTicketsPage] Erro ao buscar tickets:", error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
        <div className="flex flex-col gap-1">
          <h1 className="flex items-center gap-2 text-2xl font-bold tracking-tight">
            <MessageSquare className="h-6 w-6 text-primary" />
            Meus chamados
          </h1>
          <p className="text-muted-foreground">
            Acompanhe status, prazo estimado da primeira resposta e histórico das suas solicitações.
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" asChild className="gap-2">
            <Link to="/suporte">
              <LifeBuoy className="h-4 w-4" />
              Ver FAQs
            </Link>
          </Button>
          <Button
            className="gap-2"
            onClick={() => {
              setModalInitialStep("choice");
              setIsModalOpen(true);
            }}
          >
            <Plus className="h-4 w-4" />
            Novo chamado
          </Button>
        </div>
      </div>

      <Card className="border-primary/10 bg-primary/5">
        <CardContent className="flex flex-col gap-3 p-5 text-sm text-muted-foreground md:flex-row md:items-center md:justify-between">
          <div>
            <p className="font-semibold text-foreground">SLA público de primeira resposta</p>
            <p className="mt-1">
              Pagamentos em até 2 horas úteis. Demais categorias em até 24 horas úteis.
            </p>
          </div>
          <Badge variant="secondary" className="w-fit">
            Não é prazo de resolução final
          </Badge>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-0">
          {loading ? (
            <div className="flex justify-center py-12">
              <Loader2 className="animate-spin text-primary" />
            </div>
          ) : tickets.length > 0 ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Assunto</TableHead>
                  <TableHead>Categoria</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>SLA</TableHead>
                  <TableHead>Prazo</TableHead>
                  <TableHead className="text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {tickets.map((ticket) => {
                  const category = getSupportCategoryConfig(ticket.category, supportSlaConfig);
                  const slaStatus = computeLiveSupportSlaStatus({
                    createdAt: ticket.created_at,
                    dueAt: ticket.first_response_due_at,
                    firstResponseAt: ticket.first_response_at,
                  });
                  const slaMeta = getSupportSlaStatusMeta(slaStatus);

                  return (
                    <TableRow key={ticket.id}>
                      <TableCell>
                        <div className="space-y-1">
                          <p className="font-medium">{ticket.subject}</p>
                          <p className="text-xs text-muted-foreground">
                            Aberto em {new Date(ticket.created_at).toLocaleString("pt-BR")}
                          </p>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="space-y-1">
                          <Badge variant="outline">{category.label}</Badge>
                          <p className="text-[11px] text-muted-foreground">
                            {formatSupportSlaPromise(ticket.category, supportSlaConfig)}
                          </p>
                        </div>
                      </TableCell>
                      <TableCell>{getStatusBadge(ticket.status)}</TableCell>
                      <TableCell>
                        <Badge variant="outline" className={slaMeta.className}>
                          {slaMeta.label}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {ticket.first_response_at
                          ? `Respondido em ${formatSupportDueDate(ticket.first_response_at)}`
                          : formatSupportDueDate(ticket.first_response_due_at)}
                      </TableCell>
                      <TableCell className="text-right">
                        <Button variant="ghost" size="sm" asChild className="gap-2">
                          <Link to={`/dashboard/suporte/${ticket.id}`}>
                            <Eye className="h-4 w-4" />
                            Ver detalhes
                          </Link>
                        </Button>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          ) : (
            <div className="py-12 text-center text-muted-foreground">
              <MessageSquare className="mx-auto mb-4 h-12 w-12 opacity-20" />
              <p>Você ainda não abriu nenhum chamado.</p>
            </div>
          )}
        </CardContent>
      </Card>

      <SupportTicketModal
        open={isModalOpen}
        onOpenChange={setIsModalOpen}
        initialStep={modalInitialStep}
      />
    </div>
  );
};

export default SupportTicketsPage;
