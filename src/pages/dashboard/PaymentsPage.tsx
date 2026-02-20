"use client";

import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { 
  Loader2, 
  CreditCard, 
  Download, 
  ExternalLink, 
  Receipt, 
  Calendar,
  AlertCircle,
  RefreshCw,
  XCircle,
  Ticket
} from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { toast } from "sonner";
import PlanSelectionModal from "@/components/PlanSelectionModal";

interface PaymentRecord {
  id: string;
  date: number;
  amount: number;
  currency: string;
  status: string;
  description: string;
  pdf_url: string | null;
  type: 'subscription' | 'one_time';
}

const PaymentsPage = () => {
  const [payments, setPayments] = useState<PaymentRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isPlanModalOpen, setIsPlanModalOpen] = useState(false);

  const fetchHistory = async (silent = false) => {
    if (!silent) {
      setLoading(true);
      setError(null);
    } else {
      setIsRefreshing(true);
    }

    try {
      const { data, error: funcError } = await supabase.functions.invoke('get-payment-history');
      
      if (funcError) {
        let msg = "Erro ao consultar histórico.";
        try {
          const body = await funcError.context?.json();
          if (body?.error) msg = body.error;
        } catch {}
        throw new Error(msg);
      }
      
      setPayments(data?.payments || []);
    } catch (err: any) {
      console.error("[PaymentsPage] Erro:", err);
      const errorMessage = err.message || "Não foi possível carregar seu histórico de pagamentos.";
      setError(errorMessage);
      toast.error(errorMessage);
    } finally {
      setLoading(false);
      setIsRefreshing(false);
    }
  };

  useEffect(() => {
    fetchHistory();
  }, []);

  const getStatusBadge = (status: string) => {
    switch (status.toLowerCase()) {
      case 'paid':
      case 'succeeded':
        return <Badge className="bg-success hover:bg-success">Pago</Badge>;
      case 'open':
        return <Badge variant="outline" className="text-amber-600 border-amber-200 bg-amber-50">Pendente</Badge>;
      case 'void':
      case 'canceled':
        return <Badge variant="secondary">Cancelado</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex flex-col gap-1">
          <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <Receipt className="h-6 w-6 text-primary" /> Histórico de Pagamentos
          </h1>
          <p className="text-muted-foreground">Consulte suas faturas e recibos de assinaturas e cursos.</p>
        </div>
        <div className="flex gap-2">
          <Button 
            variant="outline" 
            size="sm" 
            className="gap-2" 
            onClick={() => fetchHistory(true)}
            disabled={isRefreshing || loading}
          >
            {isRefreshing ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
            Atualizar
          </Button>
          <Button 
            variant="outline" 
            size="sm" 
            className="gap-2 border-primary/50 text-primary hover:bg-primary/5" 
            onClick={() => setIsPlanModalOpen(true)}
          >
            <Ticket className="h-4 w-4" />
            Inserir Cupom
          </Button>
        </div>
      </div>

      {error ? (
        <Card className="border-destructive/20 bg-destructive/5">
          <CardContent className="pt-6 flex flex-col items-center text-center py-10 gap-3">
            <XCircle className="h-10 w-10 text-destructive opacity-50" />
            <div className="space-y-1">
              <h3 className="font-bold text-destructive">Falha ao carregar dados</h3>
              <p className="text-sm text-muted-foreground max-w-md">{error}</p>
            </div>
            <Button variant="outline" size="sm" onClick={() => fetchHistory()} className="mt-2">
              Tentar Novamente
            </Button>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="p-0">
            {loading ? (
              <div className="flex flex-col items-center justify-center py-20 gap-3 text-muted-foreground">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
                <p className="text-sm">Buscando registros na Stripe...</p>
              </div>
            ) : payments.length > 0 ? (
              <div className="rounded-md border overflow-hidden">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Data</TableHead>
                      <TableHead>Descrição</TableHead>
                      <TableHead>Valor</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="text-right">Fatura</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {payments.map((p) => (
                      <TableRow key={p.id}>
                        <TableCell className="whitespace-nowrap">
                          <div className="flex items-center gap-2 text-xs">
                            <Calendar className="h-3.5 w-3.5 text-muted-foreground" />
                            {format(p.date, "dd/MM/yyyy", { locale: ptBR })}
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="space-y-0.5">
                            <p className="text-sm font-medium leading-none">{p.description}</p>
                            <p className="text-[10px] text-muted-foreground uppercase tracking-wider">
                              {p.type === 'subscription' ? 'Assinatura' : 'Pagamento Único'}
                            </p>
                          </div>
                        </TableCell>
                        <TableCell className="font-semibold">
                          {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: p.currency.toUpperCase() }).format(p.amount)}
                        </TableCell>
                        <TableCell>{getStatusBadge(p.status)}</TableCell>
                        <TableCell className="text-right">
                          {p.pdf_url ? (
                            <Button variant="ghost" size="icon" asChild className="h-8 w-8 text-primary">
                              <a href={p.pdf_url} target="_blank" rel="noopener noreferrer" title="Baixar PDF">
                                <Download className="h-4 w-4" />
                              </a>
                            </Button>
                          ) : (
                            <span className="text-[10px] text-muted-foreground italic">Recibo Digital</span>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            ) : (
              <div className="text-center py-20 bg-secondary/10 rounded-xl border border-dashed">
                <CreditCard className="h-12 w-12 mx-auto mb-4 opacity-20" />
                <p className="text-muted-foreground">Nenhum histórico de pagamento encontrado.</p>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      <PlanSelectionModal 
        open={isPlanModalOpen} 
        onOpenChange={setIsPlanModalOpen} 
      />

      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 flex gap-3">
        <AlertCircle className="h-5 w-5 text-blue-600 shrink-0 mt-0.5" />
        <div className="space-y-1">
          <p className="text-sm font-semibold text-blue-900">Precisa gerenciar sua assinatura?</p>
          <p className="text-xs text-blue-800 leading-relaxed">
            Para alterar formas de pagamento, trocar de plano ou cancelar renovações automáticas, utilize o botão <strong>Gerenciar Assinatura</strong> na página inicial do seu painel.
          </p>
        </div>
      </div>
    </div>
  );
};

export default PaymentsPage;