"use client";

import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from "@/components/ui/table";
import { Loader2, Shield, Calendar, Activity, Info, AlertCircle } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { toast } from "sonner";

const AuditLogsPage = () => {
  const [logs, setLogs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchLogs();
  }, []);

  const fetchLogs = async () => {
    setLoading(true);
    setError(null);
    try {
      // Consulta simplificada para evitar erros de nome de FK
      const { data, error: fetchError } = await supabase
        .from("admin_logs")
        .select(`
          *,
          admin:profiles(full_name, email)
        `)
        .order("created_at", { ascending: false })
        .limit(100);

      if (fetchError) throw fetchError;
      setLogs(data || []);
    } catch (err: any) {
      console.error("[AuditLogs] Erro:", err);
      setError(err.message);
      toast.error("Erro ao carregar logs de auditoria.");
    } finally {
      setLoading(false);
    }
  };

  const getActionBadge = (type: string) => {
    switch (type) {
      case 'USER_DELETED': return <Badge variant="destructive">Exclusão</Badge>;
      case 'IMPERSONATION_START': return <Badge variant="secondary" className="bg-amber-100 text-amber-700 border-amber-200">Acesso Externo</Badge>;
      case 'VERIFICATION_APPROVED': return <Badge className="bg-success">Aprovação</Badge>;
      case 'VERIFICATION_REJECTED': return <Badge variant="outline" className="text-destructive border-destructive">Reprovação</Badge>;
      case 'SYSTEM_SETUP': return <Badge variant="outline" className="text-primary border-primary">Sistema</Badge>;
      default: return <Badge variant="outline">{type}</Badge>;
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Logs de Auditoria</h1>
          <p className="text-muted-foreground">Histórico imutável de ações críticas realizadas por administradores.</p>
        </div>
        <button 
          onClick={fetchLogs} 
          className="text-xs text-primary hover:underline flex items-center gap-1"
          disabled={loading}
        >
          <Activity className="h-3 w-3" /> Atualizar
        </button>
      </div>

      {error && (
        <div className="bg-destructive/10 border border-destructive/20 rounded-lg p-4 flex items-center gap-3 text-destructive">
          <AlertCircle className="h-5 w-5" />
          <div className="text-sm">
            <p className="font-bold">Erro de Sincronização</p>
            <p>A tabela de logs pode não estar ativa. Vá em Configurações e clique em "Configurar Auditoria".</p>
          </div>
        </div>
      )}

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-lg flex items-center gap-2">
            <Shield className="h-5 w-5 text-primary" />
            Últimas 100 Ações
          </CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex justify-center py-12"><Loader2 className="animate-spin text-primary" /></div>
          ) : logs.length > 0 ? (
            <div className="rounded-md border overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Data/Hora</TableHead>
                    <TableHead>Administrador</TableHead>
                    <TableHead>Ação</TableHead>
                    <TableHead>Detalhes</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {logs.map((log) => (
                    <TableRow key={log.id}>
                      <TableCell className="whitespace-nowrap text-xs">
                        <div className="flex items-center gap-2">
                          <Calendar className="h-3 w-3 text-muted-foreground" />
                          {format(new Date(log.created_at), "dd/MM/yy HH:mm", { locale: ptBR })}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="space-y-0.5">
                          <p className="text-sm font-medium">{log.admin?.full_name || "Sistema"}</p>
                          <p className="text-[10px] text-muted-foreground">{log.admin?.email || "N/A"}</p>
                        </div>
                      </TableCell>
                      <TableCell>{getActionBadge(log.action_type)}</TableCell>
                      <TableCell className="max-w-md">
                        <p className="text-xs leading-relaxed">{log.details}</p>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          ) : (
            <div className="text-center py-12 text-muted-foreground border-2 border-dashed rounded-xl">
              <Shield className="h-12 w-12 mx-auto mb-4 opacity-20" />
              <p>Nenhum log registrado ainda.</p>
              <p className="text-xs mt-1">As ações aparecerão aqui após você realizar uma exclusão ou verificação.</p>
            </div>
          )}
        </CardContent>
      </Card>

      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 flex gap-3">
        <Info className="h-5 w-5 text-blue-600 shrink-0 mt-0.5" />
        <p className="text-xs text-blue-800 leading-relaxed">
          <strong>Nota de Segurança:</strong> Estes logs são imutáveis e protegidos por RLS. Apenas administradores podem visualizar este histórico.
        </p>
      </div>
    </div>
  );
};

export default AuditLogsPage;