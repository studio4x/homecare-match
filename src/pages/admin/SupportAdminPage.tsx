"use client";

import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
import { 
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Loader2, MessageSquare, Eye, Search, Filter, AlertCircle } from "lucide-react";
import { Link } from "react-router-dom";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";

const SupportAdminPage = () => {
  const [tickets, setTickets] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterStatus, setFilterStatus] = useState("all");
  const [searchTerm, setSearchTerm] = useState("");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchTickets();
  }, []);

  const fetchTickets = async () => {
    setLoading(true);
    setError(null);
    try {
      // Consulta simplificada sem o hint de FK explícito para evitar erros de sincronização
      const { data, error: fetchError } = await supabase
        .from("support_tickets")
        .select("*, user:profiles(full_name, email)")
        .order("created_at", { ascending: false });

      if (fetchError) {
        console.error("[SupportAdmin] Erro ao buscar tickets:", fetchError);
        setError(fetchError.message);
        return;
      }

      setTickets(data || []);
    } catch (err: any) {
      console.error("[SupportAdmin] Erro inesperado:", err);
      setError(err.message || "Erro ao carregar dados.");
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
      toast.success("Status atualizado!");
      fetchTickets();
    } catch (err) {
      toast.error("Erro ao atualizar status.");
    }
  };

  const filteredTickets = tickets.filter(t => {
    const matchesStatus = filterStatus === "all" || t.status === filterStatus;
    const matchesSearch = 
      t.subject.toLowerCase().includes(searchTerm.toLowerCase()) || 
      (t.user?.full_name || "").toLowerCase().includes(searchTerm.toLowerCase()) ||
      (t.user?.email || "").toLowerCase().includes(searchTerm.toLowerCase());
    return matchesStatus && matchesSearch;
  });

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
            <p className="mt-2 text-xs opacity-80">Dica: Certifique-se de ter clicado em "Sincronizar Central de Suporte" nas Configurações.</p>
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
            onChange={(e) => setSearchTerm(e.target.value)}
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
            <div className="flex justify-center py-12"><Loader2 className="animate-spin text-primary" /></div>
          ) : filteredTickets.length > 0 ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Usuário</TableHead>
                  <TableHead>Assunto</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Data</TableHead>
                  <TableHead className="text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredTickets.map((t) => (
                  <TableRow key={t.id}>
                    <TableCell>
                      <div className="font-medium text-sm">{t.user?.full_name || "Usuário Desconhecido"}</div>
                      <div className="text-[10px] text-muted-foreground">{t.user?.email || "N/A"}</div>
                    </TableCell>
                    <TableCell className="max-w-[200px] truncate font-medium">{t.subject}</TableCell>
                    <TableCell>
                      <Select defaultValue={t.status} onValueChange={(v) => handleUpdateStatus(t.id, v)}>
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
                      {new Date(t.created_at).toLocaleDateString('pt-BR')}
                    </TableCell>
                    <TableCell className="text-right">
                      <Button variant="ghost" size="sm" asChild className="gap-2">
                        <Link to={`/dashboard/suporte/${t.id}`}>
                          <Eye className="h-4 w-4" /> Responder
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
              <p>Nenhum chamado encontrado.</p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default SupportAdminPage;