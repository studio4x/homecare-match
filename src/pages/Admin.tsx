"use client";

import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import Layout from "@/components/layout/Layout";
import AuthForm from "@/components/auth/AuthForm";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { 
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { 
  ShieldCheck, 
  Loader2,
  LogOut,
  Lock,
  ThumbsUp,
  ThumbsDown,
  Edit2,
  Plus,
  ShieldAlert,
  Trash2,
  Calendar,
  CheckCircle2,
  Settings
} from "lucide-react";
import { Award } from "lucide-react";
import { LogIn } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/components/auth/AuthProvider";
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { differenceInDays, addDays } from "date-fns";
import SiteConfigTab from "@/components/admin/SiteConfigTab";
import CoursesTab from "@/components/admin/CoursesTab";
import MarketingTab from "@/components/admin/MarketingTab";
import { translateAuthError } from "@/lib/error-utils";

const Admin = () => {
  const { user, session, loading: authLoading, signOut } = useAuth();
  const [loading, setLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);
  const [adminExists, setAdminExists] = useState(true);
  
  const [pendingProfiles, setPendingProfiles] = useState<any[]>([]);
  const [allUsers, setAllUsers] = useState<any[]>([]);
  const [plans, setPlans] = useState<any[]>([]);
  const [referralTiers, setReferralTiers] = useState<any[]>([]);
  const [isLoadingTiers, setIsLoadingTiers] = useState(false);
  const [referrals, setReferrals] = useState<any[]>([]);
  
  const [rejectionModalOpen, setRejectionModalOpen] = useState(false);
  const [approveModalOpen, setApproveModalOpen] = useState(false);
  const [planModalOpen, setPlanModalOpen] = useState(false);
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  
  const [selectedProfile, setSelectedProfile] = useState<any>(null);
  const [selectedPlan, setSelectedPlan] = useState<any>(null);
  const [userToDelete, setUserToDelete] = useState<any>(null);
  
  const [rejectionReason, setRejectionReason] = useState("");
  const [isProcessingVerification, setIsProcessingVerification] = useState(false);
  const [isSavingPlan, setIsSavingPlan] = useState(false);
  const [isDeletingUser, setIsDeletingUser] = useState(false);
  const [isUpdatingRole, setIsUpdatingRole] = useState<string | null>(null);
  const [isUpdatingPlan, setIsUpdatingPlan] = useState<string | null>(null);
  const [isUpdatingReferralTier, setIsUpdatingReferralTier] = useState<string | null>(null);
  const [isImpersonating, setIsImpersonating] = useState<string | null>(null);

  const MASTER_ADMIN_EMAIL = "homecarematch@studio4x.com.br";

  const getTierLabel = (tier: string) => {
    switch (tier.toLowerCase()) {
      case 'monthly':
        return 'Mensal';
      case 'yearly':
        return 'Anual';
      default:
        return tier;
    }
  };

  useEffect(() => {
    const checkGlobalAdmin = async () => {
      try {
        const { data, error } = await supabase.rpc('any_admin_exists');
        if (!error) setAdminExists(data);
      } catch (e) {
        console.error("[Admin] Erro global:", e);
      }
    };
    checkGlobalAdmin();
  }, []);

  useEffect(() => {
    const verifyAdmin = async () => {
      if (authLoading) return;
      if (!user) {
        setLoading(false);
        return;
      }
      
      try {
        setLoading(true);
        const { data, error } = await supabase.rpc('check_is_admin');
        
        if (!error && data === true) {
          setIsAdmin(true);
          await fetchData();
        } else {
          setIsAdmin(false);
        }
      } catch (err) {
        console.error("[Admin] Erro verificação:", err);
        setIsAdmin(false);
      } finally {
        setLoading(false);
      }
    };

    verifyAdmin();
  }, [user, authLoading]);

  const fetchData = async () => {
    try {
      const [pendingRes, usersRes, plansRes, referralsRes] = await Promise.all([
        supabase.from("profiles").select("*").eq("verification_sent", true).eq("is_verified", false),
        supabase.from("profiles").select("*").order('updated_at', { ascending: false }),
        supabase.from("plans").select("*").order('price', { ascending: true }),
        supabase.from("referrals").select(`
          *,
          referrer:referrer_id (full_name, email)
        `).order('created_at', { ascending: false })
      ]);
      
      setPendingProfiles(pendingRes.data || []);
      setAllUsers(usersRes.data || []);
      setPlans(plansRes.data || []);
      setReferrals(referralsRes.data || []);
      
      // fetch referral tiers via edge function
      setIsLoadingTiers(true);
      const { data: tiersData } = await supabase.functions.invoke('referral-config', {
        body: { action: 'get' }
      });
      setReferralTiers(tiersData?.tiers || []);
      setIsLoadingTiers(false);
    } catch (error) {
      console.error("[Admin] Erro fetch:", error);
      setIsLoadingTiers(false);
    }
  };

  const handleApprove = async () => {
    if (!selectedProfile) return;
    setIsProcessingVerification(true);
    try {
      const profileId = selectedProfile.id;
      // Encontrar dados do usuário para o e-mail
      const userToNotify = pendingProfiles.find(p => p.id === profileId);

      const { error } = await supabase.from("profiles").update({ 
        is_verified: true,
        rejection_reason: null // Limpa motivo anterior se houver
      }).eq("id", profileId);
      
      if (error) throw error;

      // Disparar e-mail de sucesso
      if (userToNotify) {
        await supabase.functions.invoke('verification-result', {
          body: {
            status: 'approved',
            userName: userToNotify.full_name,
            userEmail: userToNotify.email
          }
        });
      }

      toast.success("Perfil aprovado com sucesso!");
      setApproveModalOpen(false);
      fetchData();
    } catch (err: any) {
      toast.error("Erro ao aprovar.");
      console.error(err);
    } finally {
      setIsProcessingVerification(false);
    }
  };

  const handleReject = async () => {
    if (!rejectionReason || !selectedProfile) return;
    setIsProcessingVerification(true);
    try {
      // Salva o motivo da rejeição no banco e reseta o status de envio
      const { error } = await supabase.from("profiles").update({ 
        verification_sent: false,
        rejection_reason: rejectionReason 
      }).eq("id", selectedProfile.id);
      
      if (error) throw error;

      // Disparar e-mail de reprovação
      await supabase.functions.invoke('verification-result', {
        body: {
          status: 'rejected',
          reason: rejectionReason,
          userName: selectedProfile.full_name,
          userEmail: selectedProfile.email
        }
      });

      toast.success("Perfil reprovado.");
      setRejectionModalOpen(false);
      setRejectionReason("");
      fetchData();
    } catch (err: any) {
      toast.error("Erro ao reprovar.");
      console.error(err);
    } finally {
      setIsProcessingVerification(false);
    }
  };

  const handleUpdateRole = async (profileId: string, newRole: string) => {
    setIsUpdatingRole(profileId);
    try {
      const { error } = await supabase
        .from("profiles")
        .update({ 
          role: newRole,
          is_admin: newRole === 'admin' 
        })
        .eq("id", profileId);

      if (error) throw error;
      toast.success("Função atualizada com sucesso!");
      fetchData();
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
      const updateData: any = { subscription_tier: newPlan };
      
      // Se estiver alterando para o plano de teste, reseta a data de início
      if (newPlan === 'free_trial') {
        updateData.trial_started_at = new Date().toISOString();
      }

      const { error } = await supabase
        .from("profiles")
        .update(updateData)
        .eq("id", profileId);

      if (error) throw error;
      toast.success("Plano atualizado com sucesso!");
      fetchData();
    } catch (err: any) {
      toast.error("Erro ao atualizar plano.");
      console.error(err);
    } finally {
      setIsUpdatingPlan(null);
    }
  };

  const handleUpdateReferralTier = async (profileId: string, value: string) => {
    setIsUpdatingReferralTier(profileId);
    try {
      if (value === 'auto') {
        const { error } = await supabase.functions.invoke('referral-override', {
          body: { action: 'clear', userId: profileId }
        });
        if (error) throw error;
        toast.success("Nível de indicação definido como automático.");
      } else {
        const idx = parseInt(value, 10);
        const tier = referralTiers[idx];
        const { error } = await supabase.functions.invoke('referral-override', {
          body: { action: 'set', userId: profileId, tier }
        });
        if (error) throw error;
        toast.success("Nível de indicação atualizado!");
      }
    } catch (err: any) {
      console.error("[Admin] Erro referral tier:", err);
      toast.error("Erro ao atualizar nível de indicação.");
    } finally {
      setIsUpdatingReferralTier(null);
    }
  };

  const handleDeleteUser = async () => {
    if (!userToDelete) return;
    setIsDeletingUser(true);
    try {
      const { data, error } = await supabase.functions.invoke('admin-delete-user', {
        body: { targetUserId: userToDelete.id }
      });

      if (error) throw error;
      
      toast.success("Usuário excluído definitivamente!");
      setDeleteModalOpen(false);
      setUserToDelete(null);
      fetchData();
    } catch (error: any) {
      toast.error(translateAuthError(error.message));
    } finally {
      setIsDeletingUser(false);
    }
  };

  const handleSavePlan = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedPlan?.id || !selectedPlan?.name) return;
    setIsSavingPlan(true);
    try {
      const { error } = await supabase.from("plans").upsert({
        ...selectedPlan,
        features: Array.isArray(selectedPlan.features) ? selectedPlan.features : selectedPlan.features.split('\n').filter((f: string) => f.trim() !== '')
      });
      if (error) throw error;
      toast.success("Plano salvo!");
      setPlanModalOpen(false);
      fetchData();
    } catch (error: any) {
      toast.error("Erro ao salvar plano.");
    } finally {
      setIsSavingPlan(false);
    }
  };

  const handleImpersonate = async (targetId: string) => {
    setIsImpersonating(targetId);
    try {
      // Gera link para entrar como o usuário alvo
      const { data, error } = await supabase.functions.invoke("impersonate-login", {
        body: { targetUserId: targetId }
      });
      if (error || !data?.action_link) {
        toast.error("Não foi possível gerar o acesso.");
        setIsImpersonating(null);
        return;
      }

      // Gera e guarda o link de retorno para o próprio admin (login automático ao voltar)
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

      // Marca modo impersonação para exibir barra de retorno
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

  const getTrialStatus = (user: any) => {
    if (user.subscription_tier !== 'free_trial' || !user.trial_started_at) return null;
    
    const startDate = new Date(user.trial_started_at);
    const endDate = addDays(startDate, 30);
    const daysRemaining = differenceInDays(endDate, new Date());
    
    return daysRemaining;
  };

  if (authLoading || loading) {
    return <Layout><div className="flex h-[60vh] items-center justify-center"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div></Layout>;
  }
  
  if (!session) {
    return (
      <Layout>
        <div className="flex min-h-[calc(100vh-16rem)] items-center justify-center py-12 px-4 bg-secondary/20">
          <div className="w-full max-w-md p-8 bg-card border rounded-2xl shadow-card text-center">
            <Lock className="mx-auto h-12 w-12 text-primary mb-4" />
            <h2 className="text-2xl font-bold mb-6">Painel de Gestão</h2>
            <AuthForm mode={adminExists ? "login" : "register"} allowRegister={!adminExists} />
          </div>
        </div>
      </Layout>
    );
  }

  if (!isAdmin) {
    return (
      <Layout>
        <div className="flex h-[60vh] items-center justify-center">
          <div className="text-center p-8 bg-card border rounded-2xl shadow-sm max-w-md">
            <ShieldAlert className="h-12 w-12 text-destructive mx-auto mb-4" />
            <h2 className="text-xl font-bold">Acesso Negado</h2>
            <p className="text-muted-foreground mt-2">Sua conta não possui permissões administrativas.</p>
            <div className="mt-6">
              <Button onClick={signOut}>Sair da Conta</Button>
            </div>
          </div>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="min-h-screen bg-secondary/20 py-8">
        <div className="container mx-auto px-4">
          <div className="mb-8 flex items-center justify-between">
            <h1 className="text-3xl font-bold flex items-center gap-3"><ShieldCheck className="h-8 w-8 text-primary" /> Painel Admin</h1>
            <Button variant="ghost" onClick={signOut} className="gap-2 hover:text-destructive"><LogOut className="h-4 w-4" /> Sair</Button>
          </div>

          <Tabs defaultValue="verifications" className="space-y-6">
            <TabsList className="bg-card border w-full justify-start md:w-auto overflow-x-auto">
              <TabsTrigger value="verifications">Verificações ({pendingProfiles.length})</TabsTrigger>
              <TabsTrigger value="users">Usuários ({allUsers.length})</TabsTrigger>
              <TabsTrigger value="plans">Planos ({plans.length})</TabsTrigger>
              <TabsTrigger value="referrals" className="gap-2"><Award className="h-4 w-4" /> Indicações</TabsTrigger>
              <TabsTrigger value="courses">Cursos</TabsTrigger>
              <TabsTrigger value="marketing">Marketing</TabsTrigger>
              <TabsTrigger value="settings" className="gap-2"><Settings className="h-4 w-4" /> Configurações</TabsTrigger>
            </TabsList>

            <TabsContent value="verifications">
              <div className="rounded-xl border bg-card overflow-x-auto shadow-sm">
                <Table>
                  <TableHeader><TableRow><TableHead>Profissional</TableHead><TableHead>Documentos</TableHead><TableHead className="text-right">Ações</TableHead></TableRow></TableHeader>
                  <TableBody>
                    {pendingProfiles.length > 0 ? pendingProfiles.map(p => (
                      <TableRow key={p.id}>
                        <TableCell>
                          <div className="font-medium">{p.full_name}</div>
                          <div className="text-xs text-muted-foreground">{p.email}</div>
                        </TableCell>
                        <TableCell>
                          <div className="flex flex-wrap gap-2">
                            {p.id_document_url && <Button variant="outline" size="sm" asChild className="h-7 text-xs"><a href={p.id_document_url} target="_blank" rel="noreferrer">RG/CNH</a></Button>}
                            {p.prof_registration_url && <Button variant="outline" size="sm" asChild className="h-7 text-xs"><a href={p.prof_registration_url} target="_blank" rel="noreferrer">Registro</a></Button>}
                          </div>
                        </TableCell>
                        <TableCell className="text-right">
                          <Button variant="ghost" size="sm" className="text-destructive" onClick={() => { setSelectedProfile(p); setRejectionModalOpen(true); }}><ThumbsDown className="h-4 w-4 mr-1" />Reprovar</Button>
                          <Button variant="ghost" size="sm" className="text-success" onClick={() => { setSelectedProfile(p); setApproveModalOpen(true); }}><ThumbsUp className="h-4 w-4 mr-1" />Aprovar</Button>
                        </TableCell>
                      </TableRow>
                    )) : <TableRow><TableCell colSpan={3} className="h-32 text-center text-muted-foreground">Nenhuma solicitação pendente.</TableCell></TableRow>}
                  </TableBody>
                </Table>
              </div>
            </TabsContent>
            
            <TabsContent value="users">
              <div className="rounded-xl border bg-card overflow-x-auto shadow-sm">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Nome</TableHead>
                      <TableHead>E-mail</TableHead>
                      <TableHead>Função</TableHead>
                      <TableHead>Plano / Status</TableHead>
                      <TableHead>Nível de Indicação</TableHead>
                      <TableHead>Verificado</TableHead>
                      <TableHead className="text-right">Ações</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {allUsers.map(u => {
                      const daysLeft = getTrialStatus(u);
                      return (
                        <TableRow key={u.id}>
                          <TableCell className="font-medium">{u.full_name || "Sem nome"}</TableCell>
                          <TableCell>{u.email}</TableCell>
                          <TableCell>
                            {isUpdatingRole === u.id ? (
                              <Loader2 className="h-4 w-4 animate-spin" />
                            ) : (
                              <Select 
                                defaultValue={u.role} 
                                onValueChange={(value) => handleUpdateRole(u.id, value)}
                                disabled={u.email === MASTER_ADMIN_EMAIL}
                              >
                                <SelectTrigger className="w-[140px] h-8 text-xs">
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="professional">Profissional</SelectItem>
                                  <SelectItem value="company">Empresa</SelectItem>
                                  <SelectItem value="family">Família</SelectItem>
                                  <SelectItem 
                                    value="admin" 
                                    disabled={u.email !== MASTER_ADMIN_EMAIL}
                                  >
                                    Admin
                                  </SelectItem>
                                </SelectContent>
                              </Select>
                            )}
                          </TableCell>
                          <TableCell>
                            <div className="space-y-1">
                              {isUpdatingPlan === u.id ? (
                                <Loader2 className="h-4 w-4 animate-spin" />
                              ) : (
                                <Select 
                                  defaultValue={u.subscription_tier || 'monthly'} 
                                  onValueChange={(value) => handleUpdatePlan(u.id, value)}
                                  disabled={u.role !== 'professional'}
                                >
                                  <SelectTrigger className="w-[140px] h-8 text-xs">
                                    <SelectValue />
                                  </SelectTrigger>
                                  <SelectContent>
                                    <SelectItem value="free_trial">Teste Grátis</SelectItem>
                                    {plans.map(plan => (
                                      <SelectItem key={plan.id} value={plan.id}>{getTierLabel(plan.name)}</SelectItem>
                                    ))}
                                  </SelectContent>
                                </Select>
                              )}
                              {daysLeft !== null && (
                                <div className={`text-[10px] font-medium flex items-center gap-1 ${daysLeft <= 0 ? 'text-destructive' : 'text-primary'}`}>
                                  <Calendar className="h-3 w-3" />
                                  {daysLeft <= 0 ? 'Expirado' : `${daysLeft} dias restantes`}
                                </div>
                              )}
                            </div>
                          </TableCell>
                          <TableCell>
                            {isUpdatingReferralTier === u.id ? (
                              <Loader2 className="h-4 w-4 animate-spin" />
                            ) : (
                              <Select 
                                defaultValue="auto"
                                onValueChange={(value) => handleUpdateReferralTier(u.id, value)}
                              >
                                <SelectTrigger className="w-[180px] h-8 text-xs">
                                  <SelectValue placeholder="Auto (contagem)" />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="auto">Auto (contagem)</SelectItem>
                                  {referralTiers.map((t, idx) => (
                                    <SelectItem key={`${t.badge_label}-${idx}`} value={String(idx)}>
                                      {t.badge_label || t.name} (≥{t.threshold})
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            )}
                          </TableCell>
                          <TableCell>{u.is_verified ? <Badge className="bg-success">Sim</Badge> : <Badge variant="secondary">Não</Badge>}</TableCell>
                          <TableCell className="text-right">
                            {u.id !== user?.id && u.email !== MASTER_ADMIN_EMAIL && (
                              <Button 
                                variant="ghost" 
                                size="sm" 
                                className="text-destructive hover:bg-destructive/10"
                                onClick={() => {
                                  setUserToDelete(u);
                                  setDeleteModalOpen(true);
                                }}
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            )}
                            {u.id !== user?.id && (
                              <Button
                                variant="ghost"
                                size="sm"
                                className="text-primary hover:bg-primary/10 ml-2"
                                onClick={() => handleImpersonate(u.id)}
                                disabled={isImpersonating === u.id}
                              >
                                {isImpersonating === u.id ? (
                                  <Loader2 className="h-4 w-4 animate-spin mr-1" />
                                ) : (
                                  <LogIn className="h-4 w-4 mr-1" />
                                )}
                                Entrar como
                              </Button>
                            )}
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            </TabsContent>

            <TabsContent value="plans">
              <div className="mb-4 flex justify-end">
                <Button onClick={() => { setSelectedPlan({ id: '', name: '', price: '', period: 'mês', features: '' }); setPlanModalOpen(true); }} className="gap-2">
                  <Plus className="h-4 w-4" /> Novo Plano
                </Button>
              </div>
              <div className="rounded-xl border bg-card overflow-x-auto shadow-sm">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Nome</TableHead>
                      <TableHead>Preço</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="text-right">Ações</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    <TableRow>
                      <TableCell>
                        <div className="font-medium">Teste Grátis (Sistema)</div>
                        <div className="text-xs text-muted-foreground text-primary">Plano Padrão de Cadastro</div>
                      </TableCell>
                      <TableCell>R$ 0,00/30 dias</TableCell>
                      <TableCell><Badge variant="outline">Automático</Badge></TableCell>
                      <TableCell className="text-right">
                        <span className="text-xs text-muted-foreground px-2">Gerido pelo sistema</span>
                      </TableCell>
                    </TableRow>
                    {plans.length > 0 ? plans.map(p => (
                      <TableRow key={p.id}>
                        <TableCell>
                          <div className="font-medium">{getTierLabel(p.name)}</div>
                          <div className="text-xs text-muted-foreground">{p.id}</div>
                        </TableCell>
                        <TableCell>{p.price}/{p.period}</TableCell>
                        <TableCell>{p.popular && <Badge variant="secondary" className="bg-primary/10 text-primary">Popular</Badge>}</TableCell>
                        <TableCell className="text-right">
                          <Button variant="ghost" size="sm" onClick={() => { setSelectedPlan({ ...p, features: Array.isArray(p.features) ? p.features.join('\n') : '' }); setPlanModalOpen(true); }}>
                            <Edit2 className="h-4 w-4" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    )) : null}
                  </TableBody>
                </Table>
              </div>
            </TabsContent>

            <TabsContent value="referrals">
              <div className="rounded-xl border bg-card overflow-x-auto shadow-sm">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Indicado</TableHead>
                      <TableHead>WhatsApp</TableHead>
                      <TableHead>Indicador</TableHead>
                      <TableHead>Data</TableHead>
                      <TableHead>Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {referrals.length > 0 ? referrals.map(r => (
                      <TableRow key={r.id}>
                        <TableCell className="font-medium">{r.referred_name || 'Não informado'}</TableCell>
                        <TableCell>
                          <a href={`https://wa.me/${r.referred_phone}`} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">
                            {r.referred_phone}
                          </a>
                        </TableCell>
                        <TableCell>
                          <div className="font-medium">{r.referrer?.full_name || 'N/A'}</div>
                          <div className="text-xs text-muted-foreground">{r.referrer?.email}</div>
                        </TableCell>
                        <TableCell>{new Date(r.created_at).toLocaleDateString('pt-BR')}</TableCell>
                        <TableCell>
                          <Badge variant="secondary" className="capitalize">{r.status}</Badge>
                        </TableCell>
                      </TableRow>
                    )) : <TableRow><TableCell colSpan={5} className="h-32 text-center text-muted-foreground">Nenhuma indicação pendente.</TableCell></TableRow>}
                  </TableBody>
                </Table>
              </div>
              <div className="rounded-xl border bg-card shadow-sm p-6 space-y-4 mt-6">
                <div className="flex items-center justify-between">
                  <h2 className="text-xl font-semibold flex items-center gap-2">
                    <Award className="h-5 w-5 text-primary" />
                    Tiers de Embaixador
                  </h2>
                  <Button onClick={() => setReferralTiers(prev => [...prev, { name: '', threshold: 1, badge_label: '' }])} className="gap-2">
                    <Plus className="h-4 w-4" /> Novo Tier
                  </Button>
                </div>
                {isLoadingTiers ? (
                  <div className="flex items-center gap-2 text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" /> Carregando...</div>
                ) : referralTiers.length > 0 ? (
                  <div className="space-y-3">
                    {referralTiers.map((t, idx) => (
                      <div key={idx} className="grid md:grid-cols-3 gap-3 p-4 border rounded-lg">
                        <div className="grid gap-2">
                          <Label>Nome</Label>
                          <Input value={t.name} onChange={e => {
                            const v = e.target.value;
                            setReferralTiers(prev => prev.map((x, i) => i === idx ? { ...x, name: v } : x));
                          }} />
                        </div>
                        <div className="grid gap-2">
                          <Label>Quantidade (threshold)</Label>
                          <Input type="number" value={t.threshold} onChange={e => {
                            const v = parseInt(e.target.value || '0', 10);
                            setReferralTiers(prev => prev.map((x, i) => i === idx ? { ...x, threshold: v } : x));
                          }} />
                        </div>
                        <div className="grid gap-2">
                          <Label>Rótulo do Selo</Label>
                          <Input value={t.badge_label} onChange={e => {
                            const v = e.target.value;
                            setReferralTiers(prev => prev.map((x, i) => i === idx ? { ...x, badge_label: v } : x));
                          }} />
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-sm text-muted-foreground">Nenhum tier configurado ainda.</div>
                )}
                <div className="flex justify-end">
                  <Button onClick={async () => {
                    const { error } = await supabase.functions.invoke('referral-config', {
                      body: { action: 'set', tiers: referralTiers }
                    });
                    if (error) {
                      toast.error("Erro ao salvar tiers.");
                    } else {
                      toast.success("Tiers salvos!");
                    }
                  }}>
                    Salvar Tiers
                  </Button>
                </div>
              </div>
            </TabsContent>

            <TabsContent value="courses">
              <CoursesTab />
            </TabsContent>

            <TabsContent value="marketing">
              <MarketingTab />
            </TabsContent>

            <TabsContent value="settings">
              <SiteConfigTab />
            </TabsContent>
          </Tabs>
        </div>
      </div>

      {/* Modal de Reprovação */}
      <Dialog open={rejectionModalOpen} onOpenChange={setRejectionModalOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Reprovar Verificação</DialogTitle><DialogDescription>Informe o motivo para {selectedProfile?.full_name}.</DialogDescription></DialogHeader>
          <div className="py-4"><Label>Motivo</Label><Textarea value={rejectionReason} onChange={e => setRejectionReason(e.target.value)} placeholder="Ex: Documento ilegível." /></div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setRejectionModalOpen(false)}>Cancelar</Button>
            <Button variant="destructive" onClick={handleReject} disabled={isProcessingVerification || !rejectionReason}>Confirmar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Modal de Aprovação */}
      <Dialog open={approveModalOpen} onOpenChange={setApproveModalOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Confirmar Aprovação</DialogTitle>
            <DialogDescription>
              Tem certeza que deseja aprovar a documentação de <strong>{selectedProfile?.full_name}</strong>?
              <br/><br/>
              Isso concederá o selo de verificado ao perfil e enviará um e-mail de notificação.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setApproveModalOpen(false)}>Cancelar</Button>
            <Button className="bg-success hover:bg-success/90" onClick={handleApprove} disabled={isProcessingVerification}>
              {isProcessingVerification ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <CheckCircle2 className="h-4 w-4 mr-2" />}
              Confirmar Aprovação
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Modal de Plano */}
      <Dialog open={planModalOpen} onOpenChange={setPlanModalOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>{selectedPlan?.created_at ? "Editar Plano" : "Novo Plano"}</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSavePlan} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>ID do Plano</Label>
                <Input value={selectedPlan?.id || ''} onChange={e => setSelectedPlan({...selectedPlan, id: e.target.value})} disabled={!!selectedPlan?.created_at} />
              </div>
              <div className="space-y-2">
                <Label>Nome</Label>
                <Input value={selectedPlan?.name || ''} onChange={e => setSelectedPlan({...selectedPlan, name: e.target.value})} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Preço</Label>
                <Input value={selectedPlan?.price || ''} onChange={e => setSelectedPlan({...selectedPlan, price: e.target.value})} />
              </div>
              <div className="space-y-2">
                <Label>Período</Label>
                <Input value={selectedPlan?.period || ''} onChange={e => setSelectedPlan({...selectedPlan, period: e.target.value})} />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Recursos (um por linha)</Label>
              <Textarea value={selectedPlan?.features || ''} onChange={e => setSelectedPlan({...selectedPlan, features: e.target.value})} rows={5} />
            </div>
            <div className="flex items-center justify-between p-4 border rounded-lg">
              <Label>Plano Popular</Label>
              <Switch checked={!!selectedPlan?.popular} onCheckedChange={c => setSelectedPlan({...selectedPlan, popular: c})} />
            </div>
            <DialogFooter>
              <Button type="button" variant="ghost" onClick={() => setPlanModalOpen(false)}>Cancelar</Button>
              <Button type="submit" disabled={isSavingPlan}>{isSavingPlan ? <Loader2 className="animate-spin h-4 w-4 mr-2" /> : null} Salvar</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Modal de Exclusão de Usuário */}
      <Dialog open={deleteModalOpen} onOpenChange={setDeleteModalOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-destructive">
              <ShieldAlert className="h-5 w-5" />
              Excluir Usuário Definitivamente
            </DialogTitle>
            <DialogDescription className="pt-2">
              Esta ação é **irreversível**. Todos os dados de perfil, documentos e o acesso do usuário <strong>{userToDelete?.full_name || userToDelete?.email}</strong> serão excluídos permanentemente.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="mt-4">
            <Button 
              variant="ghost" 
              onClick={() => {
                setDeleteModalOpen(false);
                setUserToDelete(null);
              }}
              disabled={isDeletingUser}
            >
              Cancelar
            </Button>
            <Button 
              variant="destructive" 
              onClick={handleDeleteUser}
              disabled={isDeletingUser}
            >
              {isDeletingUser ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              Excluir Definitivamente
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Layout>
  );
};

export default Admin;