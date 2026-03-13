"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/components/auth/AuthProvider";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";
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
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationNext,
  PaginationPrevious,
} from "@/components/ui/pagination";
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
  LogIn,
  ShieldAlert,
  ExternalLink,
  Eye,
  EyeOff,
  Ticket,
  Clock,
  Search
} from "lucide-react";
import { toast } from "sonner";
import { differenceInDays, addDays, isAfter, subDays, parseISO, isValid } from "date-fns";
import { Link } from "react-router-dom";
import { cn } from "@/lib/utils";

interface UsersTabProps {
  allUsers: any[];
  plans: any[];
  refetchData: () => void;
}

const UsersTab = ({ allUsers, plans, refetchData }: UsersTabProps) => {
  const USERS_PER_PAGE = 12;
  const { user } = useAuth();
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [userToDelete, setUserToDelete] = useState<any>(null);
  const [isDeletingUser, setIsDeletingUser] = useState(false);
  const [isUpdatingRole, setIsUpdatingRole] = useState<string | null>(null);
  const [isUpdatingPlan, setIsUpdatingPlan] = useState<string | null>(null);
  const [isUpdatingVerified, setIsUpdatingVerified] = useState<string | null>(null);
  const [isUpdatingEmailConfirmed, setIsUpdatingEmailConfirmed] = useState<string | null>(null);
  const [isImpersonating, setIsImpersonating] = useState<string | null>(null);
  const [roleFilter, setRoleFilter] = useState("all");
  const [planStatusFilter, setPlanStatusFilter] = useState("all");
  const [docsVerifiedFilter, setDocsVerifiedFilter] = useState("all");
  const [emailVerifiedFilter, setEmailVerifiedFilter] = useState("all");
  const [searchTerm, setSearchTerm] = useState("");
  const [currentPage, setCurrentPage] = useState(1);

  const MASTER_ADMIN_EMAIL = "contato@homecarematch.com.br";

  const getDaysFromPeriod = (periodValue: string | null | undefined, fallbackDays = 30) => {
    const period = String(periodValue || "").toLowerCase();
    if (!period) return fallbackDays;

    const numberMatch = period.match(/\d+/);
    const amount = numberMatch ? Number(numberMatch[0]) : 1;
    const safeAmount = Number.isFinite(amount) && amount > 0 ? amount : 1;

    if (period.includes("dia")) return safeAmount;
    if (period.includes("ano")) return safeAmount * 365;
    if (period.includes("mes") || period.includes("mês")) return safeAmount * 30;
    return fallbackDays;
  };

  const getPlanConfig = (planId: string) => plans.find((p) => String(p?.id || "").toLowerCase() === planId);

  const getPlanDurationDays = (planId: string) => {
    if (planId === "yearly") {
      const yearlyPlan = getPlanConfig("yearly") || getPlanConfig("annual");
      return getDaysFromPeriod(yearlyPlan?.period, 365);
    }

    const selectedPlan = getPlanConfig(planId);
    const fallback =
      planId === "free_trial" || planId === "monthly"
        ? 30
        : planId === "annual"
          ? 365
          : 30;
    return getDaysFromPeriod(selectedPlan?.period, fallback);
  };

  const getTierLabel = (tier?: string | null) => {
    if (!tier) return "Nenhum plano definido";

    switch (tier.toLowerCase()) {
      case 'monthly': return 'Plano Mensal';
      case 'yearly': return 'Plano Anual';
      case 'annual': return 'Plano Anual';
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

    setIsUpdatingPlan(profileId);
    try {
      const now = new Date();
      const updateData: any = { subscription_tier: newPlan };

      const durationDays = getPlanDurationDays(newPlan);
      updateData.subscription_end_at = addDays(now, durationDays).toISOString();
      updateData.coupon_days = null;
      updateData.cancel_at_period_end = false;
      if (newPlan === "free_trial") {
        updateData.trial_started_at = now.toISOString();
      }

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
      const { data: sessionData } = await supabase.auth.getSession();
      const accessToken = sessionData?.session?.access_token;
      if (!accessToken) {
        throw new Error("Sessão inválida para atualizar confirmação de e-mail.");
      }

      const { error } = await supabase.functions.invoke("admin-set-email-confirmed", {
        body: {
          targetUserId: profileId,
          emailConfirmed: !currentStatus,
        },
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      });

      if (error) throw error;
      toast.success(!currentStatus ? "E-mail marcado como confirmado." : "Confirmação de e-mail removida.");
      await refetchData();
    } catch (err: any) {
      console.error("[UsersTab] Erro ao atualizar confirmação de e-mail:", err);
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
      if (error) {
        let serverMessage = error.message || "Erro ao excluir usuário.";
        const response = (error as any)?.context;
        if (response?.json) {
          try {
            const payload = await response.clone().json();
            if (payload?.error) {
              const lowLevelMessage =
                payload?.retryDeleteError?.message ||
                payload?.firstDeleteError?.message ||
                payload?.profileDeleteError?.message ||
                "";
              serverMessage = lowLevelMessage
                ? `${String(payload.error)}: ${String(lowLevelMessage)}`
                : String(payload.error);
            }
            console.error("[UsersTab] admin-delete-user payload:", payload);
          } catch {
            // Mantém mensagem padrão se não conseguir parsear corpo da resposta.
          }
        }
        throw new Error(serverMessage);
      }
      toast.success("Usuário excluído definitivamente!");
      setDeleteModalOpen(false);
      setUserToDelete(null);
      refetchData();
    } catch (error: any) {
      toast.error(error?.message || "Erro ao excluir usuário.");
      console.error("[UsersTab] Falha ao excluir usuário:", error);
    } finally {
      setIsDeletingUser(false);
    }
  };

  const handleImpersonate = async (targetId: string) => {
    setIsImpersonating(targetId);
    try {
      if (!user?.id || !user?.email) {
        toast.error("Sessão de admin inválida para impersonação.");
        return;
      }

      try {
        localStorage.removeItem("adminReturnLink");
        localStorage.removeItem("adminReturnEmail");
        localStorage.removeItem("adminReturnUserId");
      } catch {}

      const { data: adminLink, error: adminLinkError } = await supabase.functions.invoke("impersonate-login", {
        body: {
          targetUserId: user.id,
          expectedEmail: user.email,
        }
      });

      if (adminLinkError || !adminLink?.action_link) {
        const serverError = (adminLink as any)?.error;
        const message = serverError || adminLinkError?.message || "Não foi possível gerar o link de retorno do admin.";
        toast.error(message);
        return;
      }

      const adminLinkEmail = String((adminLink as any)?.target_email || "").trim().toLowerCase();
      if (adminLinkEmail && adminLinkEmail !== String(user.email).trim().toLowerCase()) {
        toast.error("O link de retorno gerado não corresponde ao admin atual.");
        return;
      }

      localStorage.setItem("adminReturnLink", adminLink.action_link);
      localStorage.setItem("adminReturnEmail", user.email);
      localStorage.setItem("adminReturnUserId", user.id);

      const { data, error } = await supabase.functions.invoke("impersonate-login", {
        body: { targetUserId: targetId }
      });

      if (error || !data?.action_link) {
        const serverError = (data as any)?.error;
        const message = serverError || error?.message || "Não foi possível gerar o acesso.";
        toast.error(message);
        return;
      }

      toast.info("Entrando como o usuário...");
      try {
        localStorage.setItem("impersonatingAdmin", "true");
        localStorage.setItem("impersonatorEmail", user.email);
      } catch {}
      window.location.href = data.action_link;
    } catch (e) {
      console.error("[Admin] Impersonate error:", e);
      toast.error("Falha ao entrar como usuário.");
    }
    setIsImpersonating(null);
  };

  const getDaysRemaining = (u: any) => {
    // Caso 1: Teste grátis do sistema (usa trial_started_at)
    if (u.subscription_tier === 'free_trial' && u.trial_started_at) {
      const startDate = parseISO(u.trial_started_at);
      if (isValid(startDate)) {
        const trialDays = getPlanDurationDays("free_trial");
        const endDate = addDays(startDate, trialDays);
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
    
    const isPaid = ['monthly', 'yearly', 'annual'].includes(String(u.subscription_tier || '').toLowerCase());
    const now = new Date();
    let isTrialActive = false;
    if (u.subscription_tier === 'free_trial') {
      if (u.subscription_end_at) {
        const trialEndDate = parseISO(u.subscription_end_at);
        isTrialActive = isValid(trialEndDate) && isAfter(trialEndDate, now);
      } else if (u.trial_started_at) {
        const trialDays = getPlanDurationDays("free_trial");
        const trialLimitDate = subDays(now, trialDays);
        isTrialActive = isAfter(new Date(u.trial_started_at), trialLimitDate);
      }
    }
    
    return isPaid || isTrialActive;
  };

  const normalizeTier = (tier?: string | null) => {
    const value = String(tier || "").toLowerCase();
    if (!value) return "no_plan";
    if (value === "annual") return "yearly";
    return value;
  };

  const hasActivePlan = (u: any) => {
    const tier = normalizeTier(u.subscription_tier);
    if (!["monthly", "yearly", "free_trial"].includes(tier)) return false;
    const daysLeft = getDaysRemaining(u);
    if (daysLeft === null) return tier === "monthly" || tier === "yearly";
    return daysLeft > 0;
  };

  const hasExpiredPlan = (u: any) => {
    const daysLeft = getDaysRemaining(u);
    return daysLeft !== null && daysLeft <= 0;
  };

  const filteredUsers = allUsers.filter((u) => {
    const term = searchTerm.trim().toLowerCase();

    if (roleFilter !== "all" && String(u.role || "") !== roleFilter) return false;

    if (docsVerifiedFilter === "verified" && !u.is_verified) return false;
    if (docsVerifiedFilter === "not_verified" && !!u.is_verified) return false;

    if (emailVerifiedFilter === "verified" && !u.email_confirmed) return false;
    if (emailVerifiedFilter === "not_verified" && !!u.email_confirmed) return false;

    if (planStatusFilter !== "all") {
      const tier = normalizeTier(u.subscription_tier);
      if (planStatusFilter === "monthly" && tier !== "monthly") return false;
      if (planStatusFilter === "yearly" && tier !== "yearly") return false;
      if (planStatusFilter === "free_trial" && tier !== "free_trial") return false;
      if (planStatusFilter === "no_plan" && tier !== "no_plan") return false;
      if (planStatusFilter === "active" && !hasActivePlan(u)) return false;
      if (planStatusFilter === "expired" && !hasExpiredPlan(u)) return false;
    }

    if (term) {
      const haystack = `${u.full_name || ""} ${u.email || ""}`.toLowerCase();
      if (!haystack.includes(term)) return false;
    }

    return true;
  });

  const totalPages = Math.max(1, Math.ceil(filteredUsers.length / USERS_PER_PAGE));

  useEffect(() => {
    setCurrentPage(1);
  }, [roleFilter, planStatusFilter, docsVerifiedFilter, emailVerifiedFilter, searchTerm]);

  useEffect(() => {
    if (currentPage > totalPages) setCurrentPage(totalPages);
  }, [currentPage, totalPages]);

  const paginatedUsers = filteredUsers.slice((currentPage - 1) * USERS_PER_PAGE, currentPage * USERS_PER_PAGE);

  const startItem = filteredUsers.length === 0 ? 0 : (currentPage - 1) * USERS_PER_PAGE + 1;
  const endItem = Math.min(currentPage * USERS_PER_PAGE, filteredUsers.length);

  const clearFilters = () => {
    setRoleFilter("all");
    setPlanStatusFilter("all");
    setDocsVerifiedFilter("all");
    setEmailVerifiedFilter("all");
    setSearchTerm("");
    setCurrentPage(1);
  };

  const hasActiveFilters =
    roleFilter !== "all" ||
    planStatusFilter !== "all" ||
    docsVerifiedFilter !== "all" ||
    emailVerifiedFilter !== "all" ||
    searchTerm.trim().length > 0;

  const getInitials = (name: string) =>
    name?.split(" ").map((n) => n[0]).join("").slice(0, 2).toUpperCase() || "??";

  return (
    <>
      <div className="space-y-4">
        <div className="rounded-xl border bg-card p-4 shadow-sm">
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-5">
            <div className="relative md:col-span-2 xl:col-span-1">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Buscar por nome ou e-mail..."
                className="pl-8"
              />
            </div>

            <Select value={roleFilter} onValueChange={setRoleFilter}>
              <SelectTrigger>
                <SelectValue placeholder="Filtrar por Função" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Função: Todas</SelectItem>
                <SelectItem value="professional">Função: Profissional</SelectItem>
                <SelectItem value="company">Função: Empresa</SelectItem>
                <SelectItem value="family">Função: Família</SelectItem>
                <SelectItem value="admin">Função: Admin</SelectItem>
              </SelectContent>
            </Select>

            <Select value={planStatusFilter} onValueChange={setPlanStatusFilter}>
              <SelectTrigger>
                <SelectValue placeholder="Filtrar por Plano/Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Plano/Status: Todos</SelectItem>
                <SelectItem value="monthly">Plano: Mensal</SelectItem>
                <SelectItem value="yearly">Plano: Anual</SelectItem>
                <SelectItem value="free_trial">Plano: Teste Grátis</SelectItem>
                <SelectItem value="no_plan">Plano: Sem plano</SelectItem>
                <SelectItem value="active">Status: Ativo</SelectItem>
                <SelectItem value="expired">Status: Expirado</SelectItem>
              </SelectContent>
            </Select>

            <Select value={docsVerifiedFilter} onValueChange={setDocsVerifiedFilter}>
              <SelectTrigger>
                <SelectValue placeholder="Filtrar por Docs Verificados" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Docs: Todos</SelectItem>
                <SelectItem value="verified">Docs: Verificados</SelectItem>
                <SelectItem value="not_verified">Docs: Não verificados</SelectItem>
              </SelectContent>
            </Select>

            <Select value={emailVerifiedFilter} onValueChange={setEmailVerifiedFilter}>
              <SelectTrigger>
                <SelectValue placeholder="Filtrar por E-mail Verificado" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">E-mail: Todos</SelectItem>
                <SelectItem value="verified">E-mail: Verificado</SelectItem>
                <SelectItem value="not_verified">E-mail: Não verificado</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
            <p className="text-xs text-muted-foreground">
              Exibindo {startItem}-{endItem} de {filteredUsers.length} usuário(s)
            </p>
            <Button
              variant="ghost"
              size="sm"
              onClick={clearFilters}
              disabled={!hasActiveFilters}
            >
              Limpar filtros
            </Button>
          </div>
        </div>

        <div className="rounded-xl border bg-card overflow-x-auto shadow-sm">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[80px]">Foto</TableHead>
                <TableHead className="w-[180px]">Nome</TableHead>
                <TableHead className="w-[210px]">E-mail (Conta)</TableHead>
                <TableHead>Função</TableHead>
                <TableHead>Plano / Status</TableHead>
                <TableHead>Docs Verificados</TableHead>
                <TableHead>E-mail Verificado</TableHead>
                <TableHead>Busca</TableHead>
                <TableHead className="text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {paginatedUsers.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={9} className="h-24 text-center text-sm text-muted-foreground">
                    Nenhum usuário encontrado para os filtros aplicados.
                  </TableCell>
                </TableRow>
              ) : (
                paginatedUsers.map(u => {
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
                      <TableCell className="text-xs">
                        <span className="block max-w-[210px] truncate" title={u.email || ""}>
                          {u.email}
                        </span>
                      </TableCell>
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
                                {plans.map(plan => (
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
                            <Badge className="gap-1.5 min-h-6 px-2.5 py-0.5 text-[11px] font-semibold leading-none whitespace-nowrap bg-red-100 text-red-700 border border-red-300">
                              <EyeOff className="h-3.5 w-3.5" /> E-mail não confirmado
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
                })
              )}
            </TableBody>
          </Table>
        </div>

        {filteredUsers.length > USERS_PER_PAGE && (
          <div className="rounded-xl border bg-card px-4 py-3 shadow-sm">
            <Pagination>
              <PaginationContent>
                <PaginationItem>
                  <PaginationPrevious
                    href="#"
                    onClick={(e) => {
                      e.preventDefault();
                      if (currentPage > 1) setCurrentPage(currentPage - 1);
                    }}
                    className={cn("cursor-pointer", currentPage === 1 && "pointer-events-none opacity-50")}
                  />
                </PaginationItem>
                <PaginationItem>
                  <span className="text-sm font-medium text-muted-foreground">
                    Página {currentPage} de {totalPages}
                  </span>
                </PaginationItem>
                <PaginationItem>
                  <PaginationNext
                    href="#"
                    onClick={(e) => {
                      e.preventDefault();
                      if (currentPage < totalPages) setCurrentPage(currentPage + 1);
                    }}
                    className={cn("cursor-pointer", currentPage === totalPages && "pointer-events-none opacity-50")}
                  />
                </PaginationItem>
              </PaginationContent>
            </Pagination>
          </div>
        )}
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
