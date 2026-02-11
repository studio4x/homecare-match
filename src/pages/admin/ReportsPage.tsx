"use client";

import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { 
  Loader2, 
  Trash2, 
  AlertTriangle, 
  Calendar, 
  User, 
  Eye, 
  CheckCircle2,
  ShieldAlert
} from "lucide-react";
import { toast } from "sonner";
import { Link } from "react-router-dom";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const ReportsPage = () => {
  const [reports, setReports] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchReports = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("reports")
        .select(`
          *,
          reporter:profiles!reports_reporter_id_fkey(full_name, email, role),
          reported:profiles!reports_reported_id_fkey(full_name, email, role)
        `)
        .order("created_at", { ascending: false });

      if (error) throw error;
      setReports(data || []);
    } catch (err: any) {
      console.error("[ReportsPage] Erro:", err);
      toast.error("Erro ao carregar denúncias.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchReports();
  }, []);

  const handleUpdateStatus = async (id: string, status: string) => {
    try {
      const { error } = await supabase
        .from("reports")
        .update({ status })
        .eq("id", id);
      
      if (error) throw error;
      
      setReports(prev => prev.map(r => r.id === id ? { ...r, status } : r));
      toast.success("Status atualizado.");
    } catch (err) {
      toast.error("Erro ao atualizar status.");
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Deseja excluir este registro de denúncia?")) return;
    try {
      const { error } = await supabase.from("reports").delete().eq("id", id);
      if (error) throw error;
      setReports(prev => prev.filter(r => r.id !== id));
      toast.success("Registro removido.");
    } catch (err) {
      toast.error("Erro ao excluir.");
    }
  };

  if (loading) return <div className="flex justify-center p-8"><Loader2 className="animate-spin text-primary" /></div>;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Denúncias de Perfil</h1>
        <p className="text-muted-foreground">Analise comportamentos inadequados e mantenha a plataforma segura.</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-destructive" />
            Denúncias Pendentes ({reports.filter(r => r.status === 'pending').length})
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="rounded-md border overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Denunciado</TableHead>
                  <TableHead>Motivo / Detalhes</TableHead>
                  <TableHead>Denunciante</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {reports.length > 0 ? reports.map((r) => (
                  <TableRow key={r.id}>
                    <TableCell>
                      <div className="space-y-0.5">
                        <p className="text-sm font-bold">{r.reported?.full_name}</p>
                        <p className="text-[10px] text-muted-foreground">{r.reported?.email}</p>
                        <Badge variant="outline" className="text-[8px] h-4 uppercase">{r.reported?.role}</Badge>
                      </div>
                    </TableCell>
                    <TableCell className="max-w-xs">
                      <p className="text-sm font-semibold text-destructive">{r.reason}</p>
                      <p className="text-xs text-muted-foreground line-clamp-2">{r.description || 'Sem detalhes.'}</p>
                    </TableCell>
                    <TableCell>
                      <div className="space-y-0.5">
                        <p className="text-xs font-medium">{r.reporter?.full_name || 'Anônimo'}</p>
                        <p className="text-[10px] text-muted-foreground">{new Date(r.created_at).toLocaleDateString('pt-BR')}</p>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Select defaultValue={r.status} onValueChange={(v) => handleUpdateStatus(r.id, v)}>
                        <SelectTrigger className="h-8 text-xs w-[120px]">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="pending">Pendente</SelectItem>
                          <SelectItem value="investigating">Em Análise</SelectItem>
                          <SelectItem value="resolved">Resolvido</SelectItem>
                          <SelectItem value="dismissed">Arquivado</SelectItem>
                        </SelectContent>
                      </Select>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-1">
                        <Button variant="ghost" size="icon" className="h-8 w-8" asChild>
                          <Link to={r.reported?.role === 'professional' ? `/profissional/${r.reported_id}` : `/recruiter/${r.reported_id}`} target="_blank">
                            <Eye className="h-4 w-4" />
                          </Link>
                        </Button>
                        <Button 
                          variant="ghost" 
                          size="icon" 
                          className="h-8 w-8 text-destructive hover:bg-destructive/10"
                          onClick={() => handleDelete(r.id)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                )) : (
                  <TableRow>
                    <TableCell colSpan={5} className="h-32 text-center text-muted-foreground">
                      Nenhuma denúncia registrada.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default ReportsPage;