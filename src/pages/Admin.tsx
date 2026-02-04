"use client";

import { useState, useEffect, useRef } from "react";
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
  Settings,
  Palette,
  Upload,
  Type
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

  const [siteConfig, setSiteConfig] = useState({ 
    logo_url: '', 
    favicon_url: '', 
    logo_height_px: 48,
    primary_hex: '#007BFF',
    success_hex: '#28A745',
    background_hex: '#F8F9FA',
    foreground_hex: '#182742',
    footer_logo_url: '',
    footer_logo_height_px: 32,
    font_family: 'Inter',
  });
  
  const [isSavingConfig, setIsSavingConfig] = useState(false);
  const [isUploading, setIsUploading] = useState<null | 'logo' | 'favicon' | 'footer_logo'>(null);
  const logoInputRef = useRef<HTMLInputElement>(null);
  const faviconInputRef = useRef<HTMLInputElement>(null);
  const footerLogoInputRef = useRef<HTMLInputElement>(null);

  const googleFonts = [
    "Inter", "Roboto", "Lato", "Poppins", "Open Sans", "Montserrat", "Nunito", "Pacifico"
  ];
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
      const { error } = await supabase.functions.invoke('admin-delete-user', {
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

  const handleImageUpload = async (event: React.ChangeEvent<HTMLInputElement>, type: 'logo' | 'favicon' | 'footer_logo') => {
    const file = event.target.files?.[0];
    if (!file) return;

    setIsUploading(type);
    const fileName = type;
    const fileExt = file.name.split('.').pop();
    const filePath = `public/${fileName}.${fileExt}`;

    try {
      const { error: uploadError } = await supabase.storage
        .from('site-assets')
        .upload(filePath, file, { upsert: true });

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage
        .from('site-assets')
        .getPublicUrl(filePath);
      
      const finalUrl = `${publicUrl}?t=${new Date().getTime()}`;

      setSiteConfig(prev => ({
        ...prev,
        [`${type}_url`]: finalUrl
      }));

      toast.success(`Imagem enviada! Clique em salvar para aplicar.`);
    } catch (error: any) {
      toast.error("Erro no upload da imagem.", {
        description: "Verifique se o bucket 'site-assets' existe e é público no Supabase Storage."
      });
      console.error(error);
    } finally {
      setIsUploading(null);
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
          primary_hex: siteConfig.primary_hex,
          success_hex: siteConfig.success_hex,
          background_hex: siteConfig.background_hex,
          foreground_hex: siteConfig.foreground_hex,
          footer_logo_url: siteConfig.footer_logo_url,
          footer_logo_height_px: siteConfig.footer_logo_height_px,
          font_family: siteConfig.font_family,
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
                                      <SelectItem key={plan.id} value={plan.id}>{plan.name}</SelectItem>
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
                          <div className="font-medium">{p.name}</div>
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

            <TabsContent value="settings">
              <div className="rounded-xl border bg-card p-6 shadow-sm max-w-2xl mx-auto">
                <form onSubmit={handleSaveConfig} className="space-y-8">
                  <div>
                    <h3 className="text-lg font-semibold mb-4 flex items-center gap-2"><Settings className="h-5 w-5" /> Identidade Visual</h3>
                    <div className="space-y-6">
                      <div className="space-y-2">
                        <Label>Logotipo (Cabeçalho)</Label>
                        <div className="flex items-center gap-4">
                          {siteConfig.logo_url && <img src={siteConfig.logo_url} alt="Logo Preview" className="h-12 w-auto bg-muted p-1 rounded-md border" />}
                          <Button type="button" variant="outline" onClick={() => logoInputRef.current?.click()} disabled={!!isUploading}>
                            {isUploading === 'logo' ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Upload className="h-4 w-4 mr-2" />}
                            Alterar Imagem
                          </Button>
                          <input type="file" ref={logoInputRef} className="hidden" accept="image/png, image/jpeg, image/svg+xml" onChange={(e) => handleImageUpload(e, 'logo')} />
                        </div>
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="logo_height">Altura do Logotipo (pixels)</Label>
                        <Input id="logo_height" type="number" value={siteConfig.logo_height_px} onChange={e => setSiteConfig({...siteConfig, logo_height_px: parseInt(e.target.value) || 48})} />
                      </div>
                      <div className="space-y-2">
                        <Label>Logotipo (Rodapé)</Label>
                        <div className="flex items-center gap-4">
                          {siteConfig.footer_logo_url && <img src={siteConfig.footer_logo_url} alt="Footer Logo Preview" className="h-12 w-auto bg-muted p-1 rounded-md border" />}
                          <Button type="button" variant="outline" onClick={() => footerLogoInputRef.current?.click()} disabled={!!isUploading}>
                            {isUploading === 'footer_logo' ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Upload className="h-4 w-4 mr-2" />}
                            Alterar Imagem
                          </Button>
                          <input type="file" ref={footerLogoInputRef} className="hidden" accept="image/png, image/jpeg, image/svg+xml" onChange={(e) => handleImageUpload(e, 'footer_logo')} />
                        </div>
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="footer_logo_height">Altura do Logotipo do Rodapé (pixels)</Label>
                        <Input id="footer_logo_height" type="number" value={siteConfig.footer_logo_height_px} onChange={e => setSiteConfig({...siteConfig, footer_logo_height_px: parseInt(e.target.value) || 32})} />
                      </div>
                      <div className="space-y-2">
                        <Label>Favicon</Label>
                         <div className="flex items-center gap-4">
                          {siteConfig.favicon_url && <img src={siteConfig.favicon_url} alt="Favicon Preview" className="h-8 w-8 bg-muted p-1 rounded-md border" />}
                          <Button type="button" variant="outline" onClick={() => faviconInputRef.current?.click()} disabled={!!isUploading}>
                            {isUploading === 'favicon' ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Upload className="h-4 w-4 mr-2" />}
                            Alterar Imagem
                          </Button>
                          <input type="file" ref={faviconInputRef} className="hidden" accept="image/png, image/x-icon, image/svg+xml" onChange={(e) => handleImageUpload(e, 'favicon')} />
                        </div>
                      </div>
                    </div>
                  </div>

                  <div>
                    <h3 className="text-lg font-semibold mb-4 flex items-center gap-2"><Type className="h-5 w-5" /> Tipografia</h3>
                    <div className="space-y-2">
                      <Label htmlFor="font_family">Fonte Principal (Google Fonts)</Label>
                      <Select value={siteConfig.font_family} onValueChange={value => setSiteConfig({...siteConfig, font_family: value})}>
                        <SelectTrigger id="font_family">
                          <SelectValue placeholder="Selecione uma fonte" />
                        </SelectTrigger>
                        <SelectContent>
                          {googleFonts.map(font => (
                            <SelectItem key={font} value={font} style={{ fontFamily: font }}>
                              {font}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  <div>
                    <h3 className="text-lg font-semibold mb-4 flex items-center gap-2"><Palette className="h-5 w-5" /> Paleta de Cores</h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      {[
                        { id: 'primary_hex', label: 'Cor Primária' },
                        { id: 'success_hex', label: 'Cor de Sucesso/Destaque' },
                        { id: 'background_hex', label: 'Cor de Fundo' },
                        { id: 'foreground_hex', label: 'Cor do Texto Principal' },
                      ].map(({ id, label }) => (
                        <div key={id} className="space-y-2">
                          <Label htmlFor={id}>{label}</Label>
                          <div className="flex items-center gap-2">
                            <Input
                              type="color"
                              className="p-1 h-10 w-12"
                              value={siteConfig[id as keyof typeof siteConfig] as string}
                              onChange={e => setSiteConfig({...siteConfig, [id]: e.target.value})}
                            />
                            <Input
                              id={id}
                              value={siteConfig[id as keyof typeof siteConfig] as string}
                              onChange={e => setSiteConfig({...siteConfig, [id]: e.target.value})}
                            />
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="flex justify-end pt-4 border-t">
                    <Button type="submit" disabled={isSavingConfig || !!isUploading}>
                      {(isSavingConfig || isUploading) && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
                      Salvar Todas as Configurações
                    </Button>
                  </div>
                </form>
              </div>
            </TabsContent>
          </Tabs>
        </div>
      </div>

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