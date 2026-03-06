"use client";

import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/components/auth/AuthProvider";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from "@/components/ui/table";
import { Loader2, MessageSquare, Eye, Plus, LifeBuoy } from "lucide-react";
import { Link, useSearchParams } from "react-router-dom";
import SupportTicketModal from "@/components/SupportTicketModal";

const SupportTicketsPage = () => {
  const { user } = useAuth();
  const [tickets, setTickets] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalInitialStep, setModalInitialStep] = useState<"choice" | "form">("choice");
  const [searchParams, setSearchParams] = useSearchParams();

  useEffect(() => {
    if (user) fetchTickets();
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
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'open': return <Badge className="bg-blue-500">Aberto</Badge>;
      case 'in_progress': return <Badge className="bg-amber-500">Em Atendimento</Badge>;
      case 'closed': return <Badge variant="secondary">Fechado</Badge>;
      default: return <Badge>{status}</Badge>;
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex flex-col gap-1">
          <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <MessageSquare className="h-6 w-6 text-primary" /> Meus Chamados
          </h1>
          <p className="text-muted-foreground">Acompanhe o status das suas solicitações de suporte.</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" asChild className="gap-2">
            <Link to="/suporte"><LifeBuoy className="h-4 w-4" /> Ver FAQs</Link>
          </Button>
          <Button
            className="gap-2"
            onClick={() => {
              setModalInitialStep("choice");
              setIsModalOpen(true);
            }}
          >
            <Plus className="h-4 w-4" /> Novo Chamado
          </Button>
        </div>
      </div>

      <Card>
        <CardContent className="p-0">
          {loading ? (
            <div className="flex justify-center py-12"><Loader2 className="animate-spin text-primary" /></div>
          ) : tickets.length > 0 ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Assunto</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Data</TableHead>
                  <TableHead className="text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {tickets.map((t) => (
                  <TableRow key={t.id}>
                    <TableCell className="font-medium">{t.subject}</TableCell>
                    <TableCell>{getStatusBadge(t.status)}</TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {new Date(t.created_at).toLocaleDateString('pt-BR')}
                    </TableCell>
                    <TableCell className="text-right">
                      <Button variant="ghost" size="sm" asChild className="gap-2">
                        <Link to={`/dashboard/suporte/${t.id}`}>
                          <Eye className="h-4 w-4" /> Ver Detalhes
                        </Link>
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : (
            <div className="text-center py-12 text-muted-foreground">
              <MessageSquare className="h-12 w-12 mx-auto mb-4 opacity-20" />
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
