"use client";

import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/components/auth/AuthProvider";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { 
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle
} from "@/components/ui/dialog";
import { 
  Loader2,
  Trash2,
  Calendar,
  LogIn,
  ShieldAlert,
  ExternalLink,
  Eye,
  EyeOff,
  User,
  Ticket,
  Clock
} from "lucide-react";
import { toast } from "sonner";
import { differenceInDays, addDays, isAfter, subDays, parseISO, isValid } from "date-fns";
import { translateAuthError } from "@/lib/error-utils";
import { Link } from "react-router-dom";

interface UsersTabProps {
  allUsers: any[];
  plans: any[];
  refetchData: () => void;
}

const UsersTab = ({ allUsers, plans, refetchData }: UsersTabProps) => {
  const { user } = useAuth();
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [userToDelete, setUserToDelete] = useState<any>(null);
  const [isDeletingUser, setIsDeletingUser] = useState(false);
  const [isUpdatingRole, setIsUpdatingRole] = useState<string | null>(null);
  const [isUpdatingPlan, setIsUpdatingPlan] = useState<string | null>(null);
  const [isUpdatingVerified, setIsUpdatingVerified] = useState<string | null>(null);
  const [isUpdatingEmailConfirmed, setIsUpdatingEmailConfirmed] = useState<string | null>(null);
  const [isImpersonating, setIsImpersonating] = useState<string | null>(null);

  const MASTER_ADMIN_EMAIL = "contato@homecarematch.com.br";

  const getPlanDurationDays = (planId: string) => {
    if (planId === "free_trial") return 30;
    if (planId === "monthly") return 30;
    if (planId === "yearly") return 365;

    const selectedPlan = plans.find((p) => p.id === planId);
    const period = String(selectedPlan?.period || "").toLowerCase();
    if (!period) return 30;

    const numberMatch = period.match(/\d+/);
    const amount = numberMatch ? Number(numberMatch[0]) : 1;

    if (period.includes("dia")) return Math.max(1, amount);
    if (period.includes("ano")) return Math.max(1, amount) * 365;
    if (period.includes("mes") || period.includes("mês")) return Math.max(1, amount) * 30;
    return 30;
  };

  const getTierLabel = (tier?: string | null) => {
    if (!tier) return "Nenhum plano definido";

    switch (tier.toLowerCase()) {
      case 'monthly': return 'Plano Mensal';
      case 'yearly': return 'Plano Anual';
      case 'free_trial': return 'Teste Grátis (Sistema)';
      default: return tier;
    }
  };

  const getProfileLink = (u: any) => {
    if (u.role === 'professional' && u.email_confirmed) return `/profissional/${u.id}`;
    if (u.role === 'company' || u.role === 'family') return `/recruiter/${u.id}`;
    return null;
  };

  const handleUpdateRole = async (profileId: string, newRole: string) => {
    setIsUpdatingRole(profileId);
    try {
      const { error } = await supabase
        .from("profiles")
        .update({ role: newRole, is_admin: newRole === 'admin' })
        .eq("id", profileId);
      if (error) throw error;
      toast.success("Função atualizada com sucesso!");
      refetchData();
    } catch (err: any) {
      toast.error("Erro ao atualizar função.");
      console.error(err);
    } finally {
      setIsUpdatingRole(null);
    }
  };

  const handleUpdatePlan = async (profileId: string, newPlan: string) => {
    if (newPlan === "no_plan") return;

    if (newPlan === "free_trial") {
      toast.error("O plano de 30 dias gratuitos só pode ser ativado no cadastro inicial.");
      return;
    }

    setIsUpdatingPlan(profileId);
    try {
      const now = new Date();
      const updateData: any = { subscription_tier: newPlan };

      const durationDays = getPlanDurationDays(newPlan);
      updateData.subscription_end_at = addDays(now, durationDays).toISOString();
      updateData.coupon_days = null;
      updateData.cancel_at_period_end = false;

      const { error } = await supabase
        .from("profiles")
        .update(updateData)
        .eq("id", profileId);
      if (error) throw error;
      toast.success("Plano atualizado com sucesso!");
      refetchData();
    } catch (err: any) {
      toast.error("Erro ao atualizar plano.");
      console.error(err);
    } finally {
      setIsUpdatingPlan(null);
    }
  };

  const handleToggleVerified = async (profileId: string, currentStatus: boolean) => {
    setIsUpdatingVerified(profileId);
    try {
      const { error } = await supabase
        .from("profiles")
        .update({ is_verified: !currentStatus })
        .eq("id", profileId);
      
      if (error) throw error;
      toast.success(currentStatus ? "Docs verificados removidos." : "Docs marcados como verificados.");
      refetchData();
    } catch (err) {
      toast.error("Erro ao atualizar status de verificação.");
    } finally {
      setIsUpdatingVerified(null);
    }
  };

  const handleToggleEmailConfirmed = async (profileId: string, currentStatus: boolean) => {
    setIsUpdatingEmailConfirmed(profileId);
    try {
      const { error } = await supabase
        .from("profiles")
        .update({ email_confirmed: !currentStatus })
        .eq("id", profileId);

      if (error) throw error;
      toast.success(!currentStatus ? "E-mail marcado como confirmado." : "Confirmação de e-mail removida.");
      refetchData();
    } catch (err) {
      toast.error("Erro ao atualizar confirmação de e-mail.");
    } finally {
      setIsUpdatingEmailConfirmed(null);
    }
  };

  const handleDeleteUser = async () => {
    if (!userToDelete) return;
    setIsDeletingUser(true);
    try {
      const { error } = await supabase.functions.invoke('admin-delete-user', {
        body: { targetUserId: userToDelete.id }
      });
      if (error) throw error;
      toast.success("Usuário excluído definitivamente!");
      setDeleteModalOpen(false);
      setUserToDelete(null);
      refetchData();
    } catch (error: any) {
      toast.error(translateAuthError(error.message));
    } finally {
      setIsDeletingUser(false);
    }
  };

  const handleImpersonate = async (targetId: string) => {
    setIsImpersonating(targetId);
    try {
      const { data, error } = await supabase.functions.invoke("impersonate-login", {
        body: { targetUserId: targetId }
      });
      if (error || !data?.action_link) {
        toast.error("Não foi possível gerar o acesso.");
        setIsImpersonating(null);
        return;
      }
      try {
        const { data: adminLink } = await supabase.functions.invoke("impersonate-login", {
          body: { targetUserId: user?.id }
        });
        if (adminLink?.action_link) {
          localStorage.setItem("adminReturnLink", adminLink.action_link);
        }
      } catch (e) {
        console.warn("[Admin] Falha ao gerar link de retorno do admin:", e);
      }
      toast.info("Entrando como o usuário...");
      try {
        localStorage.setItem("impersonatingAdmin", "true");
        if (user?.email) localStorage.setItem("impersonatorEmail", user.email);
      } catch {}
      window.location.href = data.action_link;
    } catch (e) {
      console.error("[Admin] Impersonate error:", e);
      toast.error("Falha ao entrar como usuário.");
    } finally {
      setIsImpersonating(null);
    }
  };

  const getDaysRemaining = (u: any) => {
    // Caso 1: Teste grátis do sistema (usa trial_started_at)
    if (u.subscription_tier === 'free_trial' && u.trial_started_at) {
      const startDate = parseISO(u.trial_started_at);
      if (isValid(startDate)) {
        const endDate = addDays(startDate, 30);
        return differenceInDays(endDate, new Date());
      }
    }

    // Caso 2: Plano pago ou Cupom (tem subscription_end_at)
    if (u.subscription_end_at) {
      const endDate = parseISO(u.subscription_end_at);
      if (isValid(endDate)) {
        return differenceInDays(endDate, new Date());
      }
    }

    return null;
  };

  const checkVisibility = (u: any) => {
    if (u.role !== 'professional') return false;
    if (!u.full_name) return false;
    if (!u.email_confirmed) return false;
    
    const isPaid = ['monthly', 'yearly'].includes(u.subscription_tier);
    const trialLimitDate = subDays(new Date(), 30);
    const isTrialActive = u.subscription_tier === 'free_trial' && u.trial_started_at && isAfter(new Date(u.trial_started_at), trialLimitDate);
    
    return isPaid || isTrialActive;
  };

  const getInitials = (name: string) =>
    name?.split(" ").map((n) => n[0]).join("").slice(0, 2).toUpperCase() || "??";

  return (
    <>
      <div className="rounded-xl border bg-card overflow-x-auto shadow-sm">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-[80px]">Foto</TableHead>
              <TableHead>Nome</TableHead>
              <TableHead>E-mail (Conta)</TableHead>
              <TableHead>Função</TableHead>
              <TableHead>Plano / Status</TableHead>
              <TableHead>Docs Verificados</TableHead>
              <TableHead>E-mail Verificado</TableHead>
              <TableHead>Busca</TableHead>
              <TableHead>Registro ANS</TableHead> {/* New TableHead */}
              <TableHead className="text-right">Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {allUsers.map(u => {
              const daysLeft = getDaysRemaining(u);
              const profileLink = getProfileLink(u);
              const isVisible = checkVisibility(u);
              
              return (
                <TableRow key={u.id}>
                  <TableCell>
                    <Avatar className="h-10 w-10 border">
                      <AvatarImage src={u.avatar_url} />
                      <AvatarFallback className="bg-primary/10 text-[10px] font-bold text-primary">
                        {getInitials(u.full_name)}
                      </AvatarFallback>
                    </Avatar>
                  </TableCell>
                  <TableCell className="font-medium">
                    <div className="flex items-center gap-2">
                      {profileLink ? (
                        <Link 
                          to={profileLink} 
                          target="_blank" 
                          className="text-primary hover:text-primary/80 transition-colors"
                          title="Ver Perfil Público"
                        >
                          <ExternalLink className="h-4 w-4" />
                        </Link>
                      ) : (
                        <div className="w-4 h-4" />
                      )}
                      <span className="truncate max-w-[120px]">{u.full_name || "Sem nome"}</span>
                    </div>
                  </TableCell>
                  <TableCell className="text-xs">{u.email}</TableCell>
                  <TableCell>
                    {isUpdatingRole === u.id ? <Loader2 className="h-4 w-4 animate-spin" /> : (
                      <Select 
                        defaultValue={u.role} 
                        onValueChange={(value) => handleUpdateRole(u.id, value)}
                        disabled={u.email === MASTER_ADMIN_EMAIL}
                      >
                        <SelectTrigger className="w-[130px] h-8 text-[10px]"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="professional">Profissional</SelectItem>
                          <SelectItem value="company">Empresa</SelectItem>
                          <SelectItem value="family">Família</SelectItem>
                          <SelectItem value="admin" disabled={u.email !== MASTER_ADMIN_EMAIL}>Admin</SelectItem>
                        </SelectContent>
                      </Select>
                    )}
                  </TableCell>
                  <TableCell>
                    <div className="space-y-1">
                      {isUpdatingPlan === u.id ? <Loader2 className="h-4 w-4 animate-spin" /> : (
                        <Select 
                          value={u.subscription_tier || "no_plan"}
                          onValueChange={(value) => handleUpdatePlan(u.id, value)}
                          disabled={u.role !== 'professional'}
                        >
                          <SelectTrigger className="w-[130px] h-8 text-[10px]">
                            <SelectValue>
                              {u.coupon_days && u.subscription_tier === 'monthly' 
                                ? "Plano Mensal (Via Cupom)" 
                                : getTierLabel(u.subscription_tier)}
                            </SelectValue>
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="no_plan" disabled>Nenhum plano definido</SelectItem>
                            {plans.filter(p => p.id !== 'free_trial').map(plan => (
                              <SelectItem key={plan.id} value={plan.id}>
                                {u.coupon_days && plan.id === 'monthly' ? "Plano Mensal (Via Cupom)" : getTierLabel(plan.id)}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      )}
                      {daysLeft !== null && (
                        <div className={`text-[9px] font-medium flex items-center gap-1 ${daysLeft <= 0 ? 'text-destructive' : 'text-primary'}`}>
                          <Clock className="h-3 w-3" />
                          {daysLeft <= 0 ? 'Expirado' : `${daysLeft}d restantes`}
                        </div>
                      )}
                      {u.coupon_days && (
                        <div className="text-[9px] font-bold text-success flex items-center gap-1">
                          <Ticket className="h-3 w-3" />
                          Cupom Ativo
                        </div>
                      )}
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center justify-center">
                      {isUpdatingVerified === u.id ? (
                        <Loader2 className="h-4 w-4 animate-spin text-primary" />
                      ) : (
                        <Switch 
                          checked={!!u.is_verified} 
                          onCheckedChange={() => handleToggleVerified(u.id, !!u.is_verified)}
                          className="data-[state=checked]:bg-success"
                        />
                      )}
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center justify-center">
                      {isUpdatingEmailConfirmed === u.id ? (
                        <Loader2 className="h-4 w-4 animate-spin text-primary" />
                      ) : (
                        <Switch
                          checked={!!u.email_confirmed}
                          onCheckedChange={() => handleToggleEmailConfirmed(u.id, !!u.email_confirmed)}
                          className="data-[state=checked]:bg-success"
                        />
                      )}
                    </div>
                  </TableCell>
                  <TableCell>
                    {u.role === 'professional' ? (
                      isVisible ? (
                        <Badge className="bg-success/10 text-success border-success/20 gap-1 text-[9px] h-5">
                          <Eye className="h-3 w-3" /> Visível
                        </Badge>
                      ) : !u.email_confirmed ? (
                        <Badge variant="destructive" className="gap-1 text-[9px] h-5">
                          <EyeOff className="h-3 w-3" /> E-mail não confirmado
                        </Badge>
                      ) : (
                        <Badge variant="secondary" className="gap-1 text-[9px] h-5 opacity-60">
                          <EyeOff className="h-3 w-3" /> Oculto
                        </Badge>
                      )
                    ) : (
                      <span className="text-[9px] text-muted-foreground italic">N/A</span>
                    )}
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground">
                    {u.role === 'company' ? (u.ans_registration || 'N/A') : 'N/A'}
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-1">
                      {u.id !== user?.id && u.email !== MASTER_ADMIN_EMAIL && (
                        <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:bg-destructive/10" onClick={() => { setUserToDelete(u); setDeleteModalOpen(true); }}>
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      )}
                      {u.id !== user?.id && (
                        <Button variant="ghost" size="icon" className="h-8 w-8 text-primary hover:bg-primary/10" onClick={() => handleImpersonate(u.id)} disabled={isImpersonating === u.id}>
                          {isImpersonating === u.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <LogIn className="h-4 w-4" />}
                        </Button>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>

      <Dialog open={deleteModalOpen} onOpenChange={setDeleteModalOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-destructive"><ShieldAlert className="h-5 w-5" />Excluir Usuário Definitivamente</DialogTitle>
            <DialogDescription className="pt-2">
              Esta ação é **irreversível**. Todos os dados de perfil, documentos e o acesso do usuário <strong>{userToDelete?.full_name || userToDelete?.email}</strong> serão excluídos permanentemente.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="mt-4">
            <Button variant="ghost" onClick={() => { setDeleteModalOpen(false); setUserToDelete(null); }} disabled={isDeletingUser}>Cancelar</Button>
            <Button variant="destructive" onClick={handleDeleteUser} disabled={isDeletingUser}>
              {isDeletingUser ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              Excluir Definitivamente
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
};

export default UsersTab;
