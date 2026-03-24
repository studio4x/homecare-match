"use client";

import React, { useEffect, useState } from "react";
import { SUPABASE_PUBLISHABLE_KEY, SUPABASE_URL, supabase } from "@/integrations/supabase/client";
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
  Search,
  MessageSquare,
  Send,
  User
} from "lucide-react";
import { toast } from "sonner";
import { differenceInDays, addDays, isAfter, subDays, parseISO, isValid } from "date-fns";
import { Link } from "react-router-dom";
import { cn } from "@/lib/utils";
import { getSupabaseAllowedHosts, navigateSafely } from "@/lib/safe-navigation";
import { sanitizeStoragePath } from "@/lib/storage-path";
import ImageCropper from "@/components/profile/ImageCropper";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { Camera } from "lucide-react";

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
  const [messageModalOpen, setMessageModalOpen] = useState(false);
  const [selectedUserForMessage, setSelectedUserForMessage] = useState<any>(null);
  const [isSendingMessage, setIsSendingMessage] = useState(false);
  const [messageSubject, setMessageSubject] = useState("Mensagem Administrativa");
  const [messageContent, setMessageContent] = useState("");
  const [profileModalOpen, setProfileModalOpen] = useState(false);
  const [selectedProfileForView, setSelectedProfileForView] = useState<any>(null);
  const [isGeneratingUrl, setIsGeneratingUrl] = useState<string | null>(null);
  const [imageToCrop, setImageToCrop] = useState<string | null>(null);
  const [isUploadingAvatar, setIsUploadingAvatar] = useState(false);
  const avatarInputRef = React.useRef<HTMLInputElement>(null);

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
        ? (planId === "free_trial" ? 7 : 30)
        : planId === "annual"
          ? 365
          : 30;
    return getDaysFromPeriod(selectedPlan?.period, fallback);
  };

  const getTierLabel = (tier?: string | null) => {
    if (!tier) return "Sem plano";

    switch (tier.toLowerCase()) {
      case 'monthly': return 'Plano Mensal';
      case 'yearly': return 'Plano Anual';
      case 'annual': return 'Plano Anual';
      case 'free_trial': return 'Teste Grátis (Sistema)';
      case 'no_plan': return 'Sem plano';
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
    setIsUpdatingPlan(profileId);
    try {
      const updateData: any = {
        coupon_days: null,
        cancel_at_period_end: false,
      };

      if (newPlan === "no_plan") {
        updateData.subscription_tier = null;
        updateData.subscription_end_at = null;
        updateData.trial_started_at = null;
      } else {
        const now = new Date();
        updateData.subscription_tier = newPlan;
        const durationDays = getPlanDurationDays(newPlan);
        updateData.subscription_end_at = addDays(now, durationDays).toISOString();
        updateData.trial_started_at = newPlan === "free_trial" ? now.toISOString() : null;
      }

      const { error } = await supabase
        .from("profiles")
        .update(updateData)
        .eq("id", profileId);
      if (error) throw error;
      toast.success(newPlan === "no_plan" ? "Plano removido com sucesso!" : "Plano atualizado com sucesso!");
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
      const { data: sessionData } = await supabase.auth.getSession();
      let accessToken = sessionData?.session?.access_token || "";
      if (sessionData?.session) {
        const { data: refreshedData } = await supabase.auth.refreshSession();
        accessToken = refreshedData?.session?.access_token || accessToken;
      }
      if (!accessToken) {
        throw new Error("Sessão inválida. Faça login novamente para excluir usuários.");
      }

      const response = await fetch(`${SUPABASE_URL}/functions/v1/admin-delete-user`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          apikey: SUPABASE_PUBLISHABLE_KEY,
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({
          targetUserId: userToDelete.id,
          access_token: accessToken,
        }),
      });

      let payload: any = null;
      try {
        payload = await response.json();
      } catch {
        payload = null;
      }

      if (!response.ok) {
        let serverMessage = payload?.error || payload?.message || `Falha ao excluir usuário (HTTP ${response.status}).`;
        const lowLevelMessage =
          payload?.retryDeleteError?.message ||
          payload?.firstDeleteError?.message ||
          payload?.profileDeleteError?.message ||
          "";
        if (lowLevelMessage) {
          serverMessage = `${String(serverMessage)}: ${String(lowLevelMessage)}`;
        }
        console.error("[UsersTab] admin-delete-user payload:", payload);
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
      const redirected = navigateSafely(data.action_link, {
        allowExternal: true,
        allowedHosts: getSupabaseAllowedHosts(),
      });
      if (!redirected) {
        toast.error("Link de acesso invalido.");
        return;
      }
    } catch (e) {
      console.error("[Admin] Impersonate error:", e);
      toast.error("Falha ao entrar como usuário.");
    }
    setIsImpersonating(null);
  };

  const handleSendMessage = async () => {
    if (!selectedUserForMessage || !messageContent.trim()) return;
    setIsSendingMessage(true);
    try {
      // 1. Criar o Ticket
      const { data: ticket, error: ticketError } = await supabase
        .from('support_tickets')
        .insert({
          user_id: selectedUserForMessage.id,
          subject: messageSubject,
          description: messageContent,
          status: 'in_progress',
          priority: 'high'
        })
        .select()
        .single();
      
      if (ticketError) throw ticketError;

      // 2. Criar a primeira mensagem (do admin)
      const { error: msgError } = await supabase
        .from('support_messages')
        .insert({
          ticket_id: ticket.id,
          sender_id: user?.id,
          message: messageContent
        });
      
      if (msgError) throw msgError;

      // 3. Notificar o usuário (Edge Function para WhatsApp, Email e Widget de Notificações)
      try {
        const { data: sessionData } = await supabase.auth.getSession();
        const accessToken = sessionData?.session?.access_token;

        await supabase.functions.invoke("notify-support", {
          body: {
            type: "new_message",
            ticketId: ticket.id,
            senderId: user?.id,
            message: messageContent
          },
          headers: {
            Authorization: `Bearer ${accessToken}`,
          },
        });
      } catch (notifyErr) {
        console.warn("[AdminMessage] Falha ao disparar notificações externas:", notifyErr);
        // Não lançamos erro aqui para não travar o envio da mensagem se apenas a notificação falhar
      }

      toast.success("Mensagem enviada com sucesso!");
      setMessageModalOpen(false);
      setMessageContent("");
      setMessageSubject("Mensagem Administrativa");
    } catch (err: any) {
      console.error("[AdminMessage] Erro:", err);
      toast.error("Falha ao enviar mensagem.");
    } finally {
      setIsSendingMessage(false);
    }
  };

  const handleViewDocument = async (pathOrUrl: string, type: string) => {
    if (!pathOrUrl) return;
    
    setIsGeneratingUrl(type);
    try {
      let path = pathOrUrl;
      // Verifica se já é uma URL pública ou se precisa de signed URL
      if (pathOrUrl.startsWith('http')) {
        window.open(pathOrUrl, '_blank');
        return;
      }
      // Se for um path de storage, cria signed URL
      path = sanitizeStoragePath(path, { bucket: "documents" });
      const { data, error } = await supabase.storage
        .from('documents')
        .createSignedUrl(path, 60); // URL válida por 60 segundos

      if (error) throw error;
      window.open(data.signedUrl, '_blank');
    } catch (err) {
      console.error(err);
      toast.error("Erro ao gerar link seguro.");
    } finally {
      setIsGeneratingUrl(null);
    }
  };

  const getDocumentsForProfile = (profile: any) => {
    if (profile.role === "company") {
      return [
        { label: "Cartão CNPJ", path: profile.id_document_url, key: `id-${profile.id}` },
        { label: "ID Responsável", path: profile.prof_registration_url, key: `prof-${profile.id}` },
      ].filter((doc) => !!doc.path);
    }

    if (profile.role === "family") {
      return [
        { label: "ID Responsável", path: profile.id_document_url, key: `id-${profile.id}` },
        { label: "RG/CNH Paciente", path: profile.patient_document_url, key: `patient-id-${profile.id}` },
        { label: "Comprovante Endereço", path: profile.patient_address_proof_url, key: `patient-address-${profile.id}` },
      ].filter((doc) => !!doc.path);
    }

    return [
      { label: "RG/CNH", path: profile.id_document_url, key: `id-${profile.id}` },
      { label: "Registro Prof.", path: profile.prof_registration_url, key: `prof-${profile.id}` },
    ].filter((doc) => !!doc.path);
  };

  const handleAdminAvatarUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file || !selectedProfileForView) return;

    const reader = new FileReader();
    reader.onload = () => {
      setImageToCrop(reader.result as string);
    };
    reader.readAsDataURL(file);
  };

  const handleAdminCropComplete = async (croppedBlob: Blob) => {
    if (!selectedProfileForView) return;
    setIsUploadingAvatar(true);
    setImageToCrop(null);

    const filePath = sanitizeStoragePath(`${selectedProfileForView.id}/${crypto.randomUUID()}.jpg`, { bucket: 'avatars' });
    
    try {
      const { error: uploadError } = await supabase.storage.from('avatars').upload(filePath, croppedBlob);
      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage.from('avatars').getPublicUrl(filePath);
      const { error: updateError } = await supabase.from("profiles").update({ avatar_url: publicUrl }).eq("id", selectedProfileForView.id);
      
      if (updateError) throw updateError;
      
      setSelectedProfileForView((prev: any) => ({ ...prev, avatar_url: publicUrl }));
      toast.success("Foto de perfil do usuário atualizada!");
      refetchData();
    } catch (err) {
      console.error(err);
      toast.error("Erro ao salvar foto recortada.");
    } finally {
      setIsUploadingAvatar(false);
    }
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
                <SelectItem value="affiliate">Função: Afiliado</SelectItem>
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
                              <SelectItem value="affiliate">Afiliado</SelectItem>
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
                                <SelectItem value="no_plan">Sem plano</SelectItem>
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
                          <Button 
                            variant="ghost" 
                            size="icon" 
                            className="h-8 w-8 text-primary hover:bg-primary/10" 
                            title="Ver Perfil Completo e Documentos"
                            onClick={() => { setSelectedProfileForView(u); setProfileModalOpen(true); }}
                          >
                            <User className="h-4 w-4" />
                          </Button>
                          <Button variant="ghost" size="icon" className="h-8 w-8 text-primary hover:bg-primary/10" onClick={() => { setSelectedUserForMessage(u); setMessageModalOpen(true); }}>
                            <MessageSquare className="h-4 w-4" />
                          </Button>
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

      <Dialog open={messageModalOpen} onOpenChange={setMessageModalOpen}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-primary">
              <MessageSquare className="h-5 w-5" />
              Enviar Mensagem Individual
            </DialogTitle>
            <DialogDescription>
              A mensagem será enviada para <strong>{selectedUserForMessage?.full_name || selectedUserForMessage?.email}</strong> via suporte e notificada por WhatsApp/E-mail.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Assunto</label>
              <Input 
                value={messageSubject} 
                onChange={(e) => setMessageSubject(e.target.value)}
                placeholder="Ex: Atualização cadastral necessária"
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Mensagem</label>
              <textarea 
                className="flex min-h-[120px] w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
                value={messageContent}
                onChange={(e) => setMessageContent(e.target.value)}
                placeholder="Digite o conteúdo da mensagem..."
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setMessageModalOpen(false)} disabled={isSendingMessage}>Cancelar</Button>
            <Button onClick={handleSendMessage} disabled={isSendingMessage || !messageContent.trim()}>
              {isSendingMessage ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Send className="h-4 w-4 mr-2" />}
              Enviar Mensagem
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={profileModalOpen} onOpenChange={setProfileModalOpen}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-xl">Dados Completos do Perfil</DialogTitle>
            <DialogDescription>
              Visualize abaixo todas as informações fornecidas pelo usuário e documentos de verificação.
            </DialogDescription>
          </DialogHeader>
          
          {selectedProfileForView && (
            <div className="mt-6 space-y-8 pb-4">
              {/* Header com Foto de Perfil */}
              <div className="flex flex-col items-center gap-4 pb-6 border-b">
                <div className="relative group">
                  <Avatar className="h-32 w-32 ring-4 ring-primary/10 transition-transform hover:scale-105 duration-300">
                    <AvatarImage src={selectedProfileForView.avatar_url} />
                    <AvatarFallback className="text-3xl font-bold bg-primary/5 text-primary">
                      {selectedProfileForView.full_name?.split(" ").map((n: string) => n[0]).join("").slice(0, 2).toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                  <Button 
                    size="icon" 
                    variant="secondary" 
                    className="absolute -bottom-1 -right-1 rounded-full shadow-lg border-2 border-background opacity-0 group-hover:opacity-100 transition-opacity"
                    onClick={() => avatarInputRef.current?.click()}
                    disabled={isUploadingAvatar}
                  >
                    {isUploadingAvatar ? <Loader2 className="h-4 w-4 animate-spin" /> : <Camera className="h-4 w-4" />}
                  </Button>
                  <input 
                    type="file" 
                    ref={avatarInputRef} 
                    className="hidden" 
                    accept="image/*" 
                    onChange={handleAdminAvatarUpload} 
                  />
                  <div className="absolute -top-2 -right-2">
                     <Badge variant={selectedProfileForView.is_verified ? "success" : "secondary"} className="h-6">
                      {selectedProfileForView.is_verified ? "Verificado" : "Pendente"}
                    </Badge>
                  </div>
                </div>
                <div className="text-center">
                  <h2 className="text-2xl font-bold text-gray-900">{selectedProfileForView.full_name}</h2>
                  <p className="text-sm text-muted-foreground">{selectedProfileForView.email}</p>
                </div>
              </div>

              {/* Documentos de Verificação */}
              <section className="space-y-4">
                <h3 className="text-sm font-bold uppercase tracking-wider text-muted-foreground border-b pb-2">Documentos de Verificação</h3>
                <div className="flex flex-wrap gap-3 pt-1">
                  {getDocumentsForProfile(selectedProfileForView).map((doc) => (
                    <Button 
                      key={doc.key}
                      variant="outline" 
                      size="sm" 
                      className="h-9 gap-1.5"
                      onClick={() => handleViewDocument(doc.path, doc.key)}
                      disabled={isGeneratingUrl === doc.key}
                    >
                      {isGeneratingUrl === doc.key ? <Loader2 className="h-4 w-4 animate-spin" /> : <ExternalLink className="h-4 w-4" />}
                      Ver {doc.label}
                    </Button>
                  ))}
                  {getDocumentsForProfile(selectedProfileForView).length === 0 && (
                    <p className="text-sm text-muted-foreground italic">Nenhum documento disponível para este usuário.</p>
                  )}
                </div>
              </section>

              {/* Informações Pessoais */}
              <section className="space-y-4">
                <h3 className="text-sm font-bold uppercase tracking-wider text-muted-foreground border-b pb-2">Informações Pessoais</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  <div className="space-y-1">
                    <span className="text-[10px] font-bold text-primary uppercase">Nome Completo</span>
                    <p className="text-sm border-l-2 border-primary/20 pl-3 py-1 bg-muted/20 rounded-r-md min-h-[2.5rem] flex items-center">
                      {selectedProfileForView.full_name || "-"}
                    </p>
                  </div>
                  <div className="space-y-1">
                    <span className="text-[10px] font-bold text-primary uppercase">E-mail</span>
                    <p className="text-sm border-l-2 border-primary/20 pl-3 py-1 bg-muted/20 rounded-r-md min-h-[2.5rem] flex items-center">
                      {selectedProfileForView.email || "-"}
                    </p>
                  </div>
                  <div className="space-y-1">
                    <span className="text-[10px] font-bold text-primary uppercase">WhatsApp</span>
                    <p className="text-sm border-l-2 border-primary/20 pl-3 py-1 bg-muted/20 rounded-r-md min-h-[2.5rem] flex items-center">
                      {selectedProfileForView.phone || "-"}
                    </p>
                  </div>
                  <div className="space-y-1">
                    <span className="text-[10px] font-bold text-primary uppercase">CPF / CNPJ</span>
                    <p className="text-sm border-l-2 border-primary/20 pl-3 py-1 bg-muted/20 rounded-r-md min-h-[2.5rem] flex items-center">
                      {selectedProfileForView.cpf || selectedProfileForView.cnpj || "-"}
                    </p>
                  </div>
                  <div className="space-y-1">
                    <span className="text-[10px] font-bold text-primary uppercase">Data de Nascimento</span>
                    <p className="text-sm border-l-2 border-primary/20 pl-3 py-1 bg-muted/20 rounded-r-md min-h-[2.5rem] flex items-center">
                      {selectedProfileForView.birth_date ? new Date(selectedProfileForView.birth_date).toLocaleDateString("pt-BR", { timeZone: "UTC" }) : "-"}
                    </p>
                  </div>
                  <div className="space-y-1">
                    <span className="text-[10px] font-bold text-primary uppercase">Função / Especialidade</span>
                    <p className="text-sm border-l-2 border-primary/20 pl-3 py-1 bg-muted/20 rounded-r-md min-h-[2.5rem] flex items-center capitalize">
                      {selectedProfileForView.role || "-"} {selectedProfileForView.specialty ? ` - ${selectedProfileForView.specialty.replace("-", " ")}` : ""}
                    </p>
                  </div>
                </div>
              </section>

              {/* Endereço */}
              <section className="space-y-4">
                <h3 className="text-sm font-bold uppercase tracking-wider text-muted-foreground border-b pb-2">Localização</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-1">
                    <span className="text-[10px] font-bold text-primary uppercase">CEP</span>
                    <p className="text-sm border-l-2 border-primary/20 pl-3 py-1 bg-muted/20 rounded-r-md min-h-[2.5rem] flex items-center">
                      {selectedProfileForView.address_zip || "-"}
                    </p>
                  </div>
                  <div className="space-y-1">
                    <span className="text-[10px] font-bold text-primary uppercase">Cidade / UF</span>
                    <p className="text-sm border-l-2 border-primary/20 pl-3 py-1 bg-muted/20 rounded-r-md min-h-[2.5rem] flex items-center">
                      {selectedProfileForView.city} - {selectedProfileForView.state}
                    </p>
                  </div>
                  <div className="md:col-span-2 space-y-1">
                    <span className="text-[10px] font-bold text-primary uppercase">Logradouro</span>
                    <p className="text-sm border-l-2 border-primary/20 pl-3 py-1 bg-muted/20 rounded-r-md min-h-[2.5rem] flex items-center">
                      {selectedProfileForView.address_street}, {selectedProfileForView.address_number} 
                      {selectedProfileForView.address_complement ? ` (${selectedProfileForView.address_complement})` : ""} - {selectedProfileForView.neighborhood}
                    </p>
                  </div>
                </div>
              </section>

              {/* Currículo e Dados Profissionais */}
              {selectedProfileForView.role === 'professional' && (
                <section className="space-y-4">
                  <h3 className="text-sm font-bold uppercase tracking-wider text-muted-foreground border-b pb-2">Currículo e Dados Profissionais</h3>
                  <div className="space-y-6">
                    <div className="space-y-1">
                      <span className="text-[10px] font-bold text-primary uppercase">Formações</span>
                      <div className="text-sm bg-muted/20 p-4 rounded-md whitespace-pre-wrap border border-dashed border-primary/10">
                        {selectedProfileForView.experience || "Nenhuma formação informada."}
                      </div>
                    </div>
                    <div className="space-y-1">
                      <span className="text-[10px] font-bold text-primary uppercase">Experiências Anteriores</span>
                      <div className="text-sm bg-muted/20 p-4 rounded-md whitespace-pre-wrap border border-dashed border-primary/10">
                        {selectedProfileForView.professional_experiences || "Nenhuma experiência profissional informada."}
                      </div>
                    </div>
                    <div className="space-y-1">
                      <span className="text-[10px] font-bold text-primary uppercase">Biografia / Sobre</span>
                      <div className="text-sm bg-muted/20 p-4 rounded-md whitespace-pre-wrap border border-dashed border-primary/10 italic">
                        {selectedProfileForView.bio || "Nenhuma biografia disponível."}
                      </div>
                    </div>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-4">
                    <div className="space-y-1">
                      <span className="text-[10px] font-bold text-primary uppercase">Valor/Hora</span>
                      <p className="text-sm border-l-2 border-primary/20 pl-3 py-1 bg-muted/20 rounded-r-md min-h-[2.5rem] flex items-center font-semibold">
                        {selectedProfileForView.hourly_rate ? `R$ ${selectedProfileForView.hourly_rate}` : "Não informado"}
                      </p>
                    </div>
                    <div className="space-y-1">
                      <span className="text-[10px] font-bold text-primary uppercase">Disponibilidade</span>
                      <div className="flex flex-wrap gap-2 pt-1">
                        {selectedProfileForView.availability?.map((item: string) => (
                          <Badge key={item} variant="outline" className="text-[10px] border-primary/30 text-primary">{item}</Badge>
                        )) || <span className="text-xs text-muted-foreground italic">Não informado</span>}
                      </div>
                    </div>
                  </div>
                </section>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>

      {imageToCrop && (
        <ImageCropper 
          image={imageToCrop} 
          onCropComplete={handleAdminCropComplete} 
          onCancel={() => setImageToCrop(null)} 
        />
      )}
    </>
  );
};

export default UsersTab;
