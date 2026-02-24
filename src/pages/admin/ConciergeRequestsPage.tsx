"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Loader2, RefreshCw, Headset, Trash2, Eye } from "lucide-react";
import { toast } from "sonner";

type ConciergeRequest = {
  id: string;
  requester_role: "company" | "family";
  requester_name?: string | null;
  requester_email?: string | null;
  specialty?: string | null;
  city?: string | null;
  state?: string | null;
  neighborhood?: string | null;
  availability?: string | null;
  patient_profile?: string | null;
  max_hourly_rate?: number | null;
  urgency?: string | null;
  details: string;
  status: "novo" | "em_andamento" | "concluido";
  created_at: string;
  user?: {
    full_name?: string | null;
    email?: string | null;
    role?: string | null;
  } | null;
};

const statusBadge = (status: ConciergeRequest["status"]) => {
  if (status === "concluido") return <Badge className="bg-success/10 text-success border-success/20">Concluído</Badge>;
  if (status === "em_andamento") return <Badge className="bg-amber-100 text-amber-700 border-amber-200">Em andamento</Badge>;
  return <Badge variant="secondary">Novo</Badge>;
};

const urgencyLabel = (urgency?: string | null) => {
  if (urgency === "urgente-24h") return "Urgente (até 24h)";
  if (urgency === "esta-semana") return "Ainda esta semana";
  if (urgency === "sem-urgencia") return "Sem urgência";
  return "Não informado";
};

const ConciergeRequestsPage = () => {
  const [requests, setRequests] = useState<ConciergeRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [selectedRequest, setSelectedRequest] = useState<ConciergeRequest | null>(null);
  const [isUpdating, setIsUpdating] = useState<string | null>(null);

  const fetchRequests = async (silent = false) => {
    if (!silent) setLoading(true);
    else setIsRefreshing(true);
    try {
      const { data, error } = await supabase
        .from("concierge_requests")
        .select(`
          id, requester_role, requester_name, requester_email, specialty, city, state, neighborhood,
          availability, patient_profile, max_hourly_rate, urgency, details, status, created_at,
          user:profiles(full_name, email, role)
        `)
        .order("created_at", { ascending: false });

      if (error) throw error;
      setRequests((data || []) as ConciergeRequest[]);
    } catch (err: any) {
      console.error("[ConciergeRequestsPage] Erro ao carregar solicitações:", err);
      toast.error("Erro ao carregar solicitações de concierge.");
    } finally {
      setLoading(false);
      setIsRefreshing(false);
    }
  };

  useEffect(() => {
    fetchRequests();
  }, []);

  const updateStatus = async (id: string, status: ConciergeRequest["status"]) => {
    setIsUpdating(id);
    try {
      const { error } = await supabase
        .from("concierge_requests")
        .update({ status, updated_at: new Date().toISOString() })
        .eq("id", id);

      if (error) throw error;
      setRequests((prev) => prev.map((r) => (r.id === id ? { ...r, status } : r)));
      toast.success("Status atualizado.");
    } catch (err) {
      toast.error("Erro ao atualizar status.");
    } finally {
      setIsUpdating(null);
    }
  };

  const removeRequest = async (id: string) => {
    if (!confirm("Deseja remover esta solicitação de concierge?")) return;
    setIsUpdating(id);
    try {
      const { error } = await supabase.from("concierge_requests").delete().eq("id", id);
      if (error) throw error;
      setRequests((prev) => prev.filter((r) => r.id !== id));
      toast.success("Solicitação removida.");
    } catch {
      toast.error("Erro ao remover solicitação.");
    } finally {
      setIsUpdating(null);
    }
  };

  if (loading) return <div className="flex justify-center p-8"><Loader2 className="animate-spin text-primary" /></div>;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Solicitações de Concierge</h1>
          <p className="text-muted-foreground">Pedidos de busca personalizada enviados por empresas e famílias.</p>
        </div>
        <Button variant="outline" onClick={() => fetchRequests(true)} disabled={isRefreshing} className="gap-2">
          {isRefreshing ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
          Atualizar
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <Headset className="h-5 w-5 text-primary" />
            Pedidos ({requests.length})
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="rounded-md border overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Solicitante</TableHead>
                  <TableHead>Resumo</TableHead>
                  <TableHead>Urgência</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Data</TableHead>
                  <TableHead className="text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {requests.length > 0 ? requests.map((request) => (
                  <TableRow key={request.id}>
                    <TableCell>
                      <div className="space-y-0.5">
                        <p className="text-sm font-medium">{request.requester_name || request.user?.full_name || "Usuário"}</p>
                        <p className="text-xs text-muted-foreground">{request.requester_email || request.user?.email || "—"}</p>
                        <p className="text-[10px] uppercase font-bold text-primary/70">{request.requester_role === "company" ? "Empresa" : "Família"}</p>
                      </div>
                    </TableCell>
                    <TableCell className="max-w-md">
                      <p className="text-xs text-muted-foreground">
                        {[request.city, request.state].filter(Boolean).join(" - ") || "Local não informado"}
                      </p>
                      <p className="text-sm truncate">{request.details}</p>
                    </TableCell>
                    <TableCell>
                      <p className="text-sm">{urgencyLabel(request.urgency)}</p>
                    </TableCell>
                    <TableCell>{statusBadge(request.status)}</TableCell>
                    <TableCell>
                      <span className="text-xs text-muted-foreground">
                        {new Date(request.created_at).toLocaleDateString("pt-BR")}
                      </span>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-1">
                        <Button variant="ghost" size="icon" onClick={() => setSelectedRequest(request)}>
                          <Eye className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => updateStatus(request.id, "em_andamento")}
                          disabled={isUpdating === request.id || request.status === "em_andamento"}
                        >
                          Em andamento
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => updateStatus(request.id, "concluido")}
                          disabled={isUpdating === request.id || request.status === "concluido"}
                        >
                          Concluir
                        </Button>
                        <Button variant="ghost" size="icon" className="text-destructive" onClick={() => removeRequest(request.id)} disabled={isUpdating === request.id}>
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                )) : (
                  <TableRow>
                    <TableCell colSpan={6} className="h-28 text-center text-muted-foreground">
                      Nenhuma solicitação recebida.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      <Dialog open={!!selectedRequest} onOpenChange={(open) => !open && setSelectedRequest(null)}>
        <DialogContent className="sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>Detalhes da Solicitação</DialogTitle>
            <DialogDescription>
              Pedido enviado em {selectedRequest ? new Date(selectedRequest.created_at).toLocaleString("pt-BR") : "—"}
            </DialogDescription>
          </DialogHeader>

          {selectedRequest && (
            <div className="space-y-3 text-sm">
              <p><strong>Solicitante:</strong> {selectedRequest.requester_name || selectedRequest.user?.full_name || "Usuário"}</p>
              <p><strong>E-mail:</strong> {selectedRequest.requester_email || selectedRequest.user?.email || "—"}</p>
              <p><strong>Tipo de conta:</strong> {selectedRequest.requester_role === "company" ? "Empresa" : "Família"}</p>
              <p><strong>Especialidade:</strong> {selectedRequest.specialty || "Não informado"}</p>
              <p><strong>Local:</strong> {[selectedRequest.city, selectedRequest.state].filter(Boolean).join(" - ") || "Não informado"} {selectedRequest.neighborhood ? `(${selectedRequest.neighborhood})` : ""}</p>
              <p><strong>Disponibilidade:</strong> {selectedRequest.availability || "Não informado"}</p>
              <p><strong>Público-alvo:</strong> {selectedRequest.patient_profile || "Não informado"}</p>
              <p><strong>Valor máximo:</strong> {selectedRequest.max_hourly_rate ? `R$ ${Number(selectedRequest.max_hourly_rate).toFixed(2).replace(".", ",")}` : "Não informado"}</p>
              <p><strong>Urgência:</strong> {urgencyLabel(selectedRequest.urgency)}</p>
              <div className="rounded-md border bg-secondary/20 p-3 whitespace-pre-wrap">
                {selectedRequest.details}
              </div>
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setSelectedRequest(null)}>Fechar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default ConciergeRequestsPage;
