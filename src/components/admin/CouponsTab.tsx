"use client";

import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from "@/components/ui/table";
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle,
  DialogFooter
} from "@/components/ui/dialog";
import { 
  Loader2, 
  Plus, 
  Trash2, 
  Ticket, 
  Users, 
  Calendar, 
  CheckCircle2, 
  XCircle,
  RefreshCw,
  Database
} from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { cn } from "@/lib/utils";

const CouponsTab = () => {
  const [coupons, setCoupons] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [openDialog, setOpenDialog] = useState(false);
  
  const [formData, setFormData] = useState({
    code: "",
    free_days: 30,
    max_uses: 100,
    is_active: true
  });

  const fetchCoupons = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("coupons")
        .select("*")
        .order("created_at", { ascending: false });
      
      if (error) throw error;
      setCoupons(data || []);
    } catch (err: any) {
      console.error(err);
      toast.error("Erro ao carregar cupons. Certifique-se de sincronizar o banco.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCoupons();
  }, []);

  const handleSync = async () => {
    setIsSyncing(true);
    try {
      const { error } = await supabase.functions.invoke('setup-coupons');
      if (error) throw error;
      toast.success("Banco de dados sincronizado!");
      fetchCoupons();
    } catch (err) {
      toast.error("Erro ao sincronizar.");
    } finally {
      setIsSyncing(false);
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.code) return;

    setIsSaving(true);
    try {
      const { error } = await supabase
        .from("coupons")
        .insert({
          code: formData.code.trim().toUpperCase(),
          free_days: formData.free_days,
          max_uses: formData.max_uses,
          is_active: formData.is_active
        });

      if (error) throw error;
      
      toast.success("Cupom criado com sucesso!");
      setOpenDialog(false);
      setFormData({ code: "", free_days: 30, max_uses: 100, is_active: true });
      fetchCoupons();
    } catch (err: any) {
      toast.error(err.message.includes("unique") ? "Este código já existe." : "Erro ao salvar cupom.");
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Deseja excluir este cupom?")) return;
    try {
      const { error } = await supabase.from("coupons").delete().eq("id", id);
      if (error) throw error;
      setCoupons(prev => prev.filter(c => c.id !== id));
      toast.success("Cupom removido.");
    } catch (err) {
      toast.error("Erro ao excluir.");
    }
  };

  const toggleStatus = async (id: string, current: boolean) => {
    try {
      const { error } = await supabase.from("coupons").update({ is_active: !current }).eq("id", id);
      if (error) throw error;
      setCoupons(prev => prev.map(c => c.id === id ? { ...c, is_active: !current } : c));
      toast.success("Status atualizado.");
    } catch (err) {
      toast.error("Erro ao atualizar.");
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Button onClick={() => setOpenDialog(true)} className="gap-2">
            <Plus className="h-4 w-4" /> Novo Cupom
          </Button>
          <Button variant="outline" size="sm" className="gap-2" onClick={handleSync} disabled={isSyncing}>
            {isSyncing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Database className="h-4 w-4" />}
            Sincronizar Banco
          </Button>
        </div>
        <Button variant="ghost" size="icon" onClick={fetchCoupons} disabled={loading}>
          <RefreshCw className={cn("h-4 w-4", loading && "animate-spin")} />
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Ticket className="h-5 w-5 text-primary" />
            Cupons Ativos
          </CardTitle>
          <CardDescription>Gerencie os códigos promocionais para o lançamento.</CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Código</TableHead>
                <TableHead>Benefício</TableHead>
                <TableHead>Uso / Limite</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow><TableCell colSpan={5} className="h-32 text-center"><Loader2 className="h-8 w-8 animate-spin mx-auto text-primary" /></TableCell></TableRow>
              ) : coupons.length > 0 ? (
                coupons.map((c) => (
                  <TableRow key={c.id}>
                    <TableCell>
                      <code className="bg-secondary px-2 py-1 rounded font-bold text-primary">{c.code}</code>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1.5 text-sm font-medium">
                        <Calendar className="h-3.5 w-3.5 text-muted-foreground" />
                        {c.free_days} dias grátis
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Users className="h-3.5 w-3.5 text-muted-foreground" />
                        <span className="text-sm font-bold">{c.current_uses}</span>
                        <span className="text-xs text-muted-foreground">/ {c.max_uses}</span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <button onClick={() => toggleStatus(c.id, c.is_active)}>
                        {c.is_active ? (
                          <Badge className="bg-success hover:bg-success/90 gap-1"><CheckCircle2 className="h-3 w-3" /> Ativo</Badge>
                        ) : (
                          <Badge variant="secondary" className="gap-1"><XCircle className="h-3 w-3" /> Inativo</Badge>
                        )}
                      </button>
                    </TableCell>
                    <TableCell className="text-right">
                      <Button variant="ghost" size="icon" className="text-destructive hover:bg-destructive/10" onClick={() => handleDelete(c.id)}>
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))
              ) : (
                <TableRow><TableCell colSpan={5} className="h-32 text-center text-muted-foreground italic">Nenhum cupom criado.</TableCell></TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Dialog open={openDialog} onOpenChange={setOpenDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Criar Novo Cupom</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSave} className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Código do Cupom</Label>
              <Input 
                placeholder="Ex: LANÇAMENTO30" 
                value={formData.code}
                onChange={e => setFormData({...formData, code: e.target.value.toUpperCase()})}
                required
              />
              <p className="text-[10px] text-muted-foreground">O código será convertido para maiúsculas automaticamente.</p>
            </div>
            
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Dias Gratuitos</Label>
                <Input 
                  type="number" 
                  value={formData.free_days}
                  onChange={e => setFormData({...formData, free_days: parseInt(e.target.value) || 0})}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label>Limite de Usos</Label>
                <Input 
                  type="number" 
                  value={formData.max_uses}
                  onChange={e => setFormData({...formData, max_uses: parseInt(e.target.value) || 0})}
                  required
                />
              </div>
            </div>

            <DialogFooter className="pt-4">
              <Button type="button" variant="ghost" onClick={() => setOpenDialog(false)}>Cancelar</Button>
              <Button type="submit" disabled={isSaving || !formData.code}>
                {isSaving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Ticket className="h-4 w-4 mr-2" />}
                Criar Cupom
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default CouponsTab;