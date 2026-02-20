"use client";

import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
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
  DialogFooter,
  DialogDescription
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
  Database,
  Edit2,
  Mail,
  User,
  Save,
  UserPlus
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
  const [editingId, setEditingId] = useState<string | null>(null);
  
  // Estados para visualização de usuários
  const [viewUsersOpen, setViewUsersOpen] = useState(false);
  const [selectedCouponForUsers, setSelectedCouponForUsers] = useState<any>(null);
  const [couponUsages, setCouponUsages] = useState<any[]>([]);
  const [loadingUsages, setLoadingUsages] = useState(false);
  
  const [formData, setFormData] = useState({
    code: "",
    free_days: 30,
    max_uses: 100,
    is_active: true,
    only_new_users: true
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
      toast.error("Erro ao carregar cupons.");
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

  const handleEdit = (coupon: any) => {
    setEditingId(coupon.id);
    setFormData({
      code: coupon.code,
      free_days: coupon.free_days,
      max_uses: coupon.max_uses,
      is_active: coupon.is_active,
      only_new_users: coupon.only_new_users ?? true
    });
    setOpenDialog(true);
  };

  const handleViewUsers = async (coupon: any) => {
    setSelectedCouponForUsers(coupon);
    setViewUsersOpen(true);
    setLoadingUsages(true);
    try {
      const { data, error } = await supabase
        .from("coupon_usages")
        .select(`
          id,
          used_at,
          profile:profiles(full_name, email)
        `)
        .eq("coupon_id", coupon.id)
        .order("used_at", { ascending: false });

      if (error) throw error;
      setCouponUsages(data || []);
    } catch (err) {
      console.error(err);
      toast.error("Erro ao carregar usuários do cupom.");
    } finally {
      setLoadingUsages(false);
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.code) return;

    setIsSaving(true);
    try {
      const payload = {
        code: formData.code.trim().toUpperCase(),
        free_days: formData.free_days,
        max_uses: formData.max_uses,
        is_active: formData.is_active,
        only_new_users: formData.only_new_users
      };

      if (editingId) {
        const { error } = await supabase
          .from("coupons")
          .update(payload)
          .eq("id", editingId);
        if (error) throw error;
        toast.success("Cupom atualizado!");
      } else {
        const { error } = await supabase
          .from("coupons")
          .insert(payload);
        if (error) throw error;
        toast.success("Cupom criado!");
      }
      
      setOpenDialog(false);
      setEditingId(null);
      setFormData({ code: "", free_days: 30, max_uses: 100, is_active: true, only_new_users: true });
      fetchCoupons();
    } catch (err: any) {
      toast.error(err.message.includes("unique") ? "Este código já existe." : "Erro ao salvar cupom.");
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Deseja excluir este cupom? Isso removerá o registro, mas não afetará quem já o utilizou.")) return;
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
          <Button onClick={() => { setEditingId(null); setFormData({ code: "", free_days: 30, max_uses: 100, is_active: true, only_new_users: true }); setOpenDialog(true); }} className="gap-2">
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
            Gestão de Cupons
          </CardTitle>
          <CardDescription>Crie códigos promocionais e acompanhe quem os utilizou.</CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Código</TableHead>
                <TableHead>Benefício</TableHead>
                <TableHead>Restrição</TableHead>
                <TableHead>Uso / Limite</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow><TableCell colSpan={6} className="h-32 text-center"><Loader2 className="h-8 w-8 animate-spin mx-auto text-primary" /></TableCell></TableRow>
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
                      {c.only_new_users ? (
                        <Badge variant="outline" className="text-amber-600 border-amber-200 bg-amber-50 gap-1">
                          <UserPlus className="h-3 w-3" /> Novos Usuários
                        </Badge>
                      ) : (
                        <Badge variant="outline" className="text-blue-600 border-blue-200 bg-blue-50 gap-1">
                          <Users className="h-3 w-3" /> Todos
                        </Badge>
                      )}
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
                      <div className="flex justify-end gap-1">
                        <Button variant="ghost" size="sm" className="h-8 gap-1.5" onClick={() => handleViewUsers(c)}>
                          <Users className="h-4 w-4" /> Usuários
                        </Button>
                        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => handleEdit(c)}>
                          <Edit2 className="h-4 w-4" />
                        </Button>
                        <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:bg-destructive/10" onClick={() => handleDelete(c.id)}>
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              ) : (
                <TableRow><TableCell colSpan={6} className="h-32 text-center text-muted-foreground italic">Nenhum cupom criado.</TableCell></TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Modal de Criação/Edição */}
      <Dialog open={openDialog} onOpenChange={setOpenDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{editingId ? "Editar Cupom" : "Criar Novo Cupom"}</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSave} className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Código do Cupom</Label>
              <Input 
                placeholder="Ex: LANÇAMENTO30" 
                value={formData.code}
                onChange={e => setFormData({...formData, code: e.target.value.toUpperCase()})}
                required
                disabled={!!editingId}
              />
              <p className="text-[10px] text-muted-foreground">O código não pode ser alterado após a criação.</p>
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

            <div className="space-y-3">
              <div className="flex items-center justify-between p-3 border rounded-lg bg-secondary/10">
                <div className="space-y-0.5">
                  <Label>Cupom Ativo</Label>
                  <p className="text-[10px] text-muted-foreground">Define se o cupom pode ser validado.</p>
                </div>
                <Switch checked={formData.is_active} onCheckedChange={v => setFormData({...formData, is_active: v})} />
              </div>

              <div className="flex items-center justify-between p-3 border rounded-lg bg-amber-50/50 border-amber-100">
                <div className="space-y-0.5">
                  <Label className="flex items-center gap-2">
                    <UserPlus className="h-3 w-3 text-amber-600" />
                    Apenas Novos Usuários
                  </Label>
                  <p className="text-[10px] text-muted-foreground">Se ativo, o cupom só funcionará no formulário de cadastro.</p>
                </div>
                <Switch checked={formData.only_new_users} onCheckedChange={v => setFormData({...formData, only_new_users: v})} />
              </div>
            </div>

            <DialogFooter className="pt-4">
              <Button type="button" variant="ghost" onClick={() => setOpenDialog(false)}>Cancelar</Button>
              <Button type="submit" disabled={isSaving || !formData.code}>
                {isSaving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Save className="h-4 w-4 mr-2" />}
                {editingId ? "Salvar Alterações" : "Criar Cupom"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Modal de Visualização de Usuários */}
      <Dialog open={viewUsersOpen} onOpenChange={setViewUsersOpen}>
        <DialogContent className="sm:max-w-2xl max-h-[80vh] flex flex-col p-0 overflow-hidden">
          <DialogHeader className="p-6 border-b bg-card">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
                <Users className="h-5 w-5 text-primary" />
              </div>
              <div>
                <DialogTitle>Usuários do Cupom: {selectedCouponForUsers?.code}</DialogTitle>
                <DialogDescription>Lista de profissionais que utilizaram este código no cadastro.</DialogDescription>
              </div>
            </div>
          </DialogHeader>

          <div className="flex-1 overflow-y-auto p-6">
            {loadingUsages ? (
              <div className="flex flex-col items-center justify-center py-12 gap-3">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
                <p className="text-sm text-muted-foreground">Buscando utilizações...</p>
              </div>
            ) : couponUsages.length > 0 ? (
              <div className="rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Usuário</TableHead>
                      <TableHead>E-mail</TableHead>
                      <TableHead className="text-right">Data de Uso</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {couponUsages.map((u) => (
                      <TableRow key={u.id}>
                        <TableCell className="font-medium">
                          <div className="flex items-center gap-2">
                            <User className="h-3 w-3 text-muted-foreground" />
                            {u.profile?.full_name || "Usuário Desconhecido"}
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2 text-xs text-muted-foreground">
                            <Mail className="h-3 w-3" />
                            {u.profile?.email || "N/A"}
                          </div>
                        </TableCell>
                        <TableCell className="text-right text-xs text-muted-foreground">
                          {format(new Date(u.used_at), "dd/MM/yyyy HH:mm", { locale: ptBR })}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            ) : (
              <div className="text-center py-12 bg-secondary/10 rounded-xl border border-dashed">
                <Ticket className="h-12 w-12 mx-auto mb-4 opacity-20" />
                <p className="text-muted-foreground">Ninguém utilizou este cupom ainda.</p>
              </div>
            )}
          </div>
          
          <DialogFooter className="p-4 border-t bg-card">
            <Button variant="outline" onClick={() => setViewUsersOpen(false)}>Fechar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default CouponsTab;