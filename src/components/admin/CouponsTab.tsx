"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
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
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Calendar,
  CheckCircle2,
  Database,
  Edit2,
  Loader2,
  Mail,
  Plus,
  RefreshCw,
  Save,
  Ticket,
  Trash2,
  User,
  UserPlus,
  Users,
  XCircle,
} from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { cn } from "@/lib/utils";

type CouponApplyMode = "signup_only" | "dashboard_only" | "signup_and_dashboard";
type CouponTargetTier = "monthly" | "yearly";

type CouponFormData = {
  code: string;
  free_days: number;
  max_uses: number;
  is_active: boolean;
  apply_mode: CouponApplyMode;
  target_tier: CouponTargetTier;
};

const DEFAULT_FORM_DATA: CouponFormData = {
  code: "",
  free_days: 30,
  max_uses: 100,
  is_active: true,
  apply_mode: "signup_only",
  target_tier: "monthly",
};

const VALID_APPLY_MODES = new Set<CouponApplyMode>([
  "signup_only",
  "dashboard_only",
  "signup_and_dashboard",
]);

const normalizeApplyMode = (coupon: any): CouponApplyMode => {
  const rawMode = String(coupon?.apply_mode || "").toLowerCase().trim() as CouponApplyMode;
  if (VALID_APPLY_MODES.has(rawMode)) return rawMode;
  return coupon?.only_new_users ? "signup_only" : "dashboard_only";
};

const normalizeTargetTier = (coupon: any): CouponTargetTier => {
  return String(coupon?.target_tier || "").toLowerCase().trim() === "yearly" ? "yearly" : "monthly";
};

const getApplyModeLabel = (applyMode: CouponApplyMode) => {
  if (applyMode === "signup_only") return "Cadastro";
  if (applyMode === "dashboard_only") return "Painel";
  return "Cadastro + Painel";
};

const getTargetTierLabel = (targetTier: CouponTargetTier) => {
  return targetTier === "yearly" ? "Plano Anual" : "Plano Mensal";
};

const CouponsTab = () => {
  const [coupons, setCoupons] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [openDialog, setOpenDialog] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  const [viewUsersOpen, setViewUsersOpen] = useState(false);
  const [selectedCouponForUsers, setSelectedCouponForUsers] = useState<any>(null);
  const [couponUsages, setCouponUsages] = useState<any[]>([]);
  const [loadingUsages, setLoadingUsages] = useState(false);

  const [formData, setFormData] = useState<CouponFormData>(DEFAULT_FORM_DATA);

  const resetForm = () => {
    setEditingId(null);
    setFormData(DEFAULT_FORM_DATA);
  };

  const fetchCoupons = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("coupons")
        .select("*")
        .order("created_at", { ascending: false });

      if (error) throw error;
      setCoupons(data || []);
    } catch (err) {
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
      const { error } = await supabase.functions.invoke("setup-coupons");
      if (error) throw error;
      toast.success("Banco sincronizado.");
      fetchCoupons();
    } catch {
      toast.error("Erro ao sincronizar.");
    } finally {
      setIsSyncing(false);
    }
  };

  const handleEdit = (coupon: any) => {
    setEditingId(coupon.id);
    setFormData({
      code: String(coupon.code || ""),
      free_days: Number(coupon.free_days || 30),
      max_uses: Number(coupon.max_uses || 100),
      is_active: coupon.is_active !== false,
      apply_mode: normalizeApplyMode(coupon),
      target_tier: normalizeTargetTier(coupon),
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
        .select(
          `
          id,
          used_at,
          profile:profiles(full_name, email)
        `,
        )
        .eq("coupon_id", coupon.id)
        .order("used_at", { ascending: false });

      if (error) throw error;
      setCouponUsages(data || []);
    } catch (err) {
      console.error(err);
      toast.error("Erro ao carregar usuarios do cupom.");
    } finally {
      setLoadingUsages(false);
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.code.trim()) return;

    setIsSaving(true);
    try {
      const payload = {
        code: formData.code.trim().toUpperCase(),
        free_days: Math.max(1, Number(formData.free_days || 0)),
        max_uses: Math.max(1, Number(formData.max_uses || 0)),
        is_active: formData.is_active,
        apply_mode: formData.apply_mode,
        target_tier: formData.target_tier,
        only_new_users: formData.apply_mode === "signup_only",
      };

      if (editingId) {
        const { error } = await supabase.from("coupons").update(payload).eq("id", editingId);
        if (error) throw error;
        toast.success("Cupom atualizado.");
      } else {
        const { error } = await supabase.from("coupons").insert(payload);
        if (error) throw error;
        toast.success("Cupom criado.");
      }

      setOpenDialog(false);
      resetForm();
      fetchCoupons();
    } catch (err: any) {
      console.error("[Coupons] Save error:", err);
      toast.error(err?.message?.includes("unique") ? "Este codigo ja existe." : "Erro ao salvar cupom.");
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Deseja excluir este cupom?")) return;
    try {
      const { error } = await supabase.from("coupons").delete().eq("id", id);
      if (error) throw error;
      setCoupons((prev) => prev.filter((coupon) => coupon.id !== id));
      toast.success("Cupom removido.");
    } catch {
      toast.error("Erro ao excluir.");
    }
  };

  const toggleStatus = async (id: string, current: boolean) => {
    try {
      const { error } = await supabase.from("coupons").update({ is_active: !current }).eq("id", id);
      if (error) throw error;
      setCoupons((prev) => prev.map((coupon) => (coupon.id === id ? { ...coupon, is_active: !current } : coupon)));
      toast.success("Status atualizado.");
    } catch {
      toast.error("Erro ao atualizar.");
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Button
            className="gap-2"
            onClick={() => {
              resetForm();
              setOpenDialog(true);
            }}
          >
            <Plus className="h-4 w-4" />
            Novo Cupom
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
            Gestao de Cupons
          </CardTitle>
          <CardDescription>
            Defina codigo, dias de beneficio, onde o cupom funciona e para qual plano ele vai aplicar.
          </CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Codigo</TableHead>
                <TableHead>Beneficio</TableHead>
                <TableHead>Aplicacao</TableHead>
                <TableHead>Uso / Limite</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Acoes</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={6} className="h-32 text-center">
                    <Loader2 className="mx-auto h-8 w-8 animate-spin text-primary" />
                  </TableCell>
                </TableRow>
              ) : coupons.length > 0 ? (
                coupons.map((coupon) => {
                  const applyMode = normalizeApplyMode(coupon);
                  const targetTier = normalizeTargetTier(coupon);

                  return (
                    <TableRow key={coupon.id}>
                      <TableCell>
                        <code className="rounded bg-secondary px-2 py-1 font-bold text-primary">{coupon.code}</code>
                      </TableCell>

                      <TableCell>
                        <div className="flex items-center gap-1.5 text-sm font-medium">
                          <Calendar className="h-3.5 w-3.5 text-muted-foreground" />
                          {coupon.free_days} dias no {getTargetTierLabel(targetTier)}
                        </div>
                      </TableCell>

                      <TableCell>
                        <div className="flex flex-wrap gap-2">
                          <Badge variant="outline" className="gap-1">
                            {applyMode === "signup_only" ? <UserPlus className="h-3 w-3" /> : <Users className="h-3 w-3" />}
                            {getApplyModeLabel(applyMode)}
                          </Badge>
                          <Badge variant="secondary">{getTargetTierLabel(targetTier)}</Badge>
                        </div>
                      </TableCell>

                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Users className="h-3.5 w-3.5 text-muted-foreground" />
                          <span className="text-sm font-bold">{coupon.current_uses}</span>
                          <span className="text-xs text-muted-foreground">/ {coupon.max_uses}</span>
                        </div>
                      </TableCell>

                      <TableCell>
                        <button onClick={() => toggleStatus(coupon.id, coupon.is_active)}>
                          {coupon.is_active ? (
                            <Badge className="gap-1 bg-success hover:bg-success/90">
                              <CheckCircle2 className="mr-1 h-3 w-3" />
                              Ativo
                            </Badge>
                          ) : (
                            <Badge variant="secondary" className="gap-1">
                              <XCircle className="h-3 w-3" />
                              Inativo
                            </Badge>
                          )}
                        </button>
                      </TableCell>

                      <TableCell className="text-right">
                        <div className="flex justify-end gap-1">
                          <Button variant="ghost" size="sm" className="h-8 gap-1.5" onClick={() => handleViewUsers(coupon)}>
                            <Users className="h-4 w-4" />
                            Usuarios
                          </Button>
                          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => handleEdit(coupon)}>
                            <Edit2 className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-destructive hover:bg-destructive/10"
                            onClick={() => handleDelete(coupon.id)}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })
              ) : (
                <TableRow>
                  <TableCell colSpan={6} className="h-32 text-center italic text-muted-foreground">
                    Nenhum cupom criado.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Dialog open={openDialog} onOpenChange={setOpenDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{editingId ? "Editar Cupom" : "Criar Novo Cupom"}</DialogTitle>
            <DialogDescription>Defina o que este cupom faz e onde ele pode ser usado.</DialogDescription>
          </DialogHeader>

          <form onSubmit={handleSave} className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Codigo do Cupom</Label>
              <Input
                placeholder="Ex: LANCAMENTO30"
                value={formData.code}
                onChange={(event) => setFormData((prev) => ({ ...prev, code: event.target.value.toUpperCase() }))}
                required
                disabled={!!editingId}
              />
              <p className="text-[10px] text-muted-foreground">O codigo nao pode ser alterado apos a criacao.</p>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Dias de Beneficio</Label>
                <Input
                  type="number"
                  min={1}
                  value={formData.free_days}
                  onChange={(event) =>
                    setFormData((prev) => ({ ...prev, free_days: Math.max(1, Number(event.target.value || 1)) }))
                  }
                  required
                />
              </div>
              <div className="space-y-2">
                <Label>Limite de Usos</Label>
                <Input
                  type="number"
                  min={1}
                  value={formData.max_uses}
                  onChange={(event) =>
                    setFormData((prev) => ({ ...prev, max_uses: Math.max(1, Number(event.target.value || 1)) }))
                  }
                  required
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label>Onde o cupom funciona</Label>
              <Select
                value={formData.apply_mode}
                onValueChange={(value) =>
                  setFormData((prev) => ({ ...prev, apply_mode: value as CouponApplyMode }))
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="signup_only">Somente no cadastro</SelectItem>
                  <SelectItem value="dashboard_only">Somente no painel</SelectItem>
                  <SelectItem value="signup_and_dashboard">Cadastro e painel</SelectItem>
                </SelectContent>
              </Select>
              <p className="text-[10px] text-muted-foreground">
                Cadastro aplica no registro da conta. Painel aplica para usuario logado.
              </p>
            </div>

            <div className="space-y-2">
              <Label>Plano de destino</Label>
              <Select
                value={formData.target_tier}
                onValueChange={(value) =>
                  setFormData((prev) => ({ ...prev, target_tier: value as CouponTargetTier }))
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="monthly">Plano Mensal</SelectItem>
                  <SelectItem value="yearly">Plano Anual</SelectItem>
                </SelectContent>
              </Select>
              <p className="text-[10px] text-muted-foreground">Ao aplicar, o usuario recebe os dias nesse plano.</p>
            </div>

            <div className="flex items-center justify-between rounded-lg border bg-secondary/10 p-3">
              <div className="space-y-0.5">
                <Label>Cupom Ativo</Label>
                <p className="text-[10px] text-muted-foreground">Define se o cupom pode ser validado.</p>
              </div>
              <Switch
                checked={formData.is_active}
                onCheckedChange={(value) => setFormData((prev) => ({ ...prev, is_active: value }))}
              />
            </div>

            <DialogFooter className="pt-4">
              <Button type="button" variant="ghost" onClick={() => setOpenDialog(false)}>
                Cancelar
              </Button>
              <Button type="submit" disabled={isSaving || !formData.code.trim()}>
                {isSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
                {editingId ? "Salvar Alteracoes" : "Criar Cupom"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={viewUsersOpen} onOpenChange={setViewUsersOpen}>
        <DialogContent className="flex max-h-[80vh] flex-col overflow-hidden p-0 sm:max-w-2xl">
          <DialogHeader className="border-b bg-card p-6">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
                <Users className="h-5 w-5 text-primary" />
              </div>
              <div>
                <DialogTitle>Usuarios do cupom: {selectedCouponForUsers?.code}</DialogTitle>
                <DialogDescription>Lista de usuarios que ja utilizaram este cupom.</DialogDescription>
              </div>
            </div>
          </DialogHeader>

          <div className="flex-1 overflow-y-auto p-6">
            {loadingUsages ? (
              <div className="flex flex-col items-center justify-center gap-3 py-12">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
                <p className="text-sm text-muted-foreground">Buscando utilizacoes...</p>
              </div>
            ) : couponUsages.length > 0 ? (
              <div className="rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Usuario</TableHead>
                      <TableHead>E-mail</TableHead>
                      <TableHead className="text-right">Data de Uso</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {couponUsages.map((usage) => (
                      <TableRow key={usage.id}>
                        <TableCell className="font-medium">
                          <div className="flex items-center gap-2">
                            <User className="h-3 w-3 text-muted-foreground" />
                            {usage.profile?.full_name || "Usuario desconhecido"}
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2 text-xs text-muted-foreground">
                            <Mail className="h-3 w-3" />
                            {usage.profile?.email || "N/A"}
                          </div>
                        </TableCell>
                        <TableCell className="text-right text-xs text-muted-foreground">
                          {format(new Date(usage.used_at), "dd/MM/yyyy HH:mm", { locale: ptBR })}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            ) : (
              <div className="rounded-xl border border-dashed bg-secondary/10 py-12 text-center">
                <Ticket className="mx-auto mb-4 h-12 w-12 opacity-20" />
                <p className="text-muted-foreground">Ninguem utilizou este cupom ainda.</p>
              </div>
            )}
          </div>

          <DialogFooter className="border-t bg-card p-4">
            <Button variant="outline" onClick={() => setViewUsersOpen(false)}>
              Fechar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default CouponsTab;
