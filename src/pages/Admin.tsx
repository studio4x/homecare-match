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
  CreditCard,
  Calendar,
  CheckCircle2,
  Settings
} from "lucide-react";
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

const Admin = () => {
  const { user, session, loading: authLoading, signOut } = useAuth();
  const [loading, setLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);
  const [adminExists, setAdminExists] = useState(true);
  
  const [pendingProfiles, setPendingProfiles] = useState<any[]>([]);
  const [allUsers, setAllUsers] = useState<any[]>([]);
  const [plans, setPlans] = useState<any[]>([]);
  const [siteConfig, setSiteConfig] = useState({ logo_url: '', favicon_url: '', logo_height_px: 48 });
  
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
  const [isSavingConfig, setIsSavingConfig] = useState(false);

  const MASTER_ADMIN_EMAIL = "homecarematch@studio4x.com.br";

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
      const [pendingRes, usersRes, plansRes, configRes] = await Promise.all([
        supabase.from("profiles").select("*").eq("verification_sent", true).eq("is_verified", false),
        supabase.from("profiles").select("*").order('updated_at', { ascending: false }),
        supabase.from("plans").select("*").order('price', { ascending: true }),
        supabase.from("site_config").select("*").eq('id', 1).single()
      ]);
      
      setPendingProfiles(pendingRes.data || []);
      setAllUsers(usersRes.data || []);
      setPlans(plansRes.data || []);
      if (configRes.data) setSiteConfig(configRes.data);
    } catch (error) {
      console.error("[Admin] Erro fetch:", error);
    }
  };

  const handleSaveConfig = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSavingConfig(true);
    try {
      const { error } = await supabase
        .from('site_config')
        .update({
          logo_url: siteConfig.logo_url,
          favicon_url: siteConfig.favicon_url,
          logo_height_px: siteConfig.logo_height_px,
          updated_at: new Date().toISOString(),
        })
        .eq('id', 1);
      
      if (error) throw error;
      toast.success("Configurações salvas! A página será recarregada para aplicar as mudanças.");
      setTimeout(() => window.location.reload(), 2000);
    } catch (error) {
      toast.error("Erro ao salvar configurações.");
    } finally {
      setIsSavingConfig(false);
    }
  };

  const handleApprove = async () => {
    if (!selectedProfile) return;
    setIsProcessingVerification(true);
    try {
      const profileId = selectedProfile.id;
      const userToNotify = pendingProfiles.find(p => p.id === profileId);

      const { error } = await supabase.from("profiles").update({ 
        is_verified: true,
        rejection_reason: null
      }).eq("id", profileId);
      
      if (error) throw error;

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
      const { error } = await supabase.from("profiles").update({ 
        verification_sent: false,
        rejection_reason: rejectionReason 
      }).eq("id", selectedProfile.id);
      
      if (error) throw error;

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
      toast.error(error.message || "Erro ao excluir usuário.");
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
            <TabsList className="bg-card border w-full justify-start md:w-auto">
              <TabsTrigger value="verifications">Verificações ({pendingProfiles.length})</TabsTrigger>
              <TabsTrigger value="users">Usuários ({allUsers.length})</TabsTrigger>
              <TabsTrigger value="plans">Planos ({plans.length})</TabsTrigger>
              <TabsTrigger value="settings">Configurações</TabsTrigger>
            </TabsList>

            <TabsContent value="verifications">
              {/* Content for Verifications */}
            </TabsContent>
            
            <TabsContent value="users">
              {/* Content for Users */}
            </TabsContent>

            <TabsContent value="plans">
              {/* Content for Plans */}
            </TabsContent>

            <TabsContent value="settings">
              <div className="rounded-xl border bg-card p-6 shadow-sm max-w-2xl mx-auto">
                <h3 className="text-lg font-semibold mb-6 flex items-center gap-2"><Settings className="h-5 w-5" /> Configurações do Site</h3>
                <form onSubmit={handleSaveConfig} className="space-y-6">
                  <div className="space-y-2">
                    <Label htmlFor="logo_url">URL do Logotipo</Label>
                    <Input id="logo_url" value={siteConfig.logo_url} onChange={e => setSiteConfig({...siteConfig, logo_url: e.target.value})} />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="favicon_url">URL do Favicon</Label>
                    <Input id="favicon_url" value={siteConfig.favicon_url} onChange={e => setSiteConfig({...siteConfig, favicon_url: e.target.value})} />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="logo_height">Altura do Logotipo (pixels)</Label>
                    <Input id="logo_height" type="number" value={siteConfig.logo_height_px} onChange={e => setSiteConfig({...siteConfig, logo_height_px: parseInt(e.target.value) || 48})} />
                    <p className="text-xs text-muted-foreground">Altura padrão na barra de navegação e rodapé.</p>
                  </div>
                  <div className="flex justify-end">
                    <Button type="submit" disabled={isSavingConfig}>
                      {isSavingConfig && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
                      Salvar Configurações
                    </Button>
                  </div>
                </form>
              </div>
            </TabsContent>
          </Tabs>
        </div>
      </div>

      {/* All Modals */}
    </Layout>
  );
};

export default Admin;