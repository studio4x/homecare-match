"use client";

import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import Layout from "@/components/layout/Layout";
import AuthForm from "@/components/auth/AuthForm";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { 
  CheckCircle, 
  ShieldCheck, 
  Loader2,
  LogOut,
  Users as UsersIcon,
  CreditCard,
  Search,
  Plus,
  Edit,
  Lock,
  AlertTriangle,
  ExternalLink,
  Mail,
  UserPlus
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Link } from "react-router-dom";

const Admin = () => {
  const { user, session, loading: authLoading, signOut } = useAuth();
  const [loading, setLoading] = useState(true);
  const [isCheckingAdmin, setIsCheckingAdmin] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const [adminExists, setAdminExists] = useState(false);
  const [processingId, setProcessingId] = useState<string | null>(null);
  
  // States para Verificações
  const [pendingProfiles, setPendingProfiles] = useState<any[]>([]);
  const [rejectionModalOpen, setRejectionModalOpen] = useState(false);
  const [selectedProfile, setSelectedProfile] = useState<any>(null);
  const [rejectionReason, setRejectionReason] = useState("");

  // States para Usuários
  const [allUsers, setAllUsers] = useState<any[]>([]);
  const [userSearch, setUserSearch] = useState("");
  const [userRoleFilter, setUserRoleFilter] = useState("all");
  const [createUserModalOpen, setCreateUserModalOpen] = useState(false);
  const [isCreatingUser, setIsCreatingUser] = useState(false);

  // States para Planos
  const [plans, setPlans] = useState<any[]>([]);
  const [planModalOpen, setPlanModalOpen] = useState(false);
  const [editingPlan, setEditingPlan] = useState<any>(null);

  useEffect(() => {
    checkInitialStatus();
  }, [user, authLoading]);

  const checkInitialStatus = async () => {
    if (authLoading) return;

    // 1. Verifica se existe qualquer admin no sistema
    const { count } = await supabase
      .from("profiles")
      .select("*", { count: 'exact', head: true })
      .eq("is_admin", true);
    
    setAdminExists((count || 0) > 0);

    // 2. Se estiver logado, verifica privilégios
    if (user) {
      setIsCheckingAdmin(true);
      const { data, error } = await supabase
        .from("profiles")
        .select("is_admin, role")
        .eq("id", user?.id)
        .maybeSingle();
      
      if (data && (data.is_admin || data.role === 'admin')) {
        setIsAdmin(true);
        await fetchData();
      } else {
        setIsAdmin(false);
        if (error) console.error("Erro ao verificar admin:", error);
      }
      setIsCheckingAdmin(false);
    }
    setLoading(false);
  };

  const fetchData = async () => {
    await Promise.all([
      fetchPendingVerifications(),
      fetchAllUsers(),
      fetchPlans()
    ]);
  };

  const fetchPendingVerifications = async () => {
    const { data } = await supabase
      .from("profiles")
      .select("*")
      .eq("verification_sent", true)
      .eq("is_verified", false);
    setPendingProfiles(data || []);
  };

  const fetchAllUsers = async () => {
    const { data } = await supabase
      .from("profiles")
      .select("*")
      .order('created_at', { ascending: false });
    setAllUsers(data || []);
  };

  const fetchPlans = async () => {
    const { data } = await supabase
      .from("plans")
      .select("*")
      .order('created_at', { ascending: true });
    setPlans(data || []);
  };

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsCreatingUser(true);
    const formData = new FormData(e.target as HTMLFormElement);
    
    try {
      const { error } = await supabase.functions.invoke('admin-create-user', {
        body: {
          email: formData.get('email'),
          password: formData.get('password'),
          fullName: formData.get('fullName'),
          role: formData.get('role')
        }
      });

      if (error) throw error;
      toast.success("Usuário criado com sucesso!");
      setCreateUserModalOpen(false);
      fetchAllUsers();
    } catch (err) {
      toast.error("Erro ao criar usuário.");
    } finally {
      setIsCreatingUser(false);
    }
  };

  const handleApprove = async (profile: any) => {
    setProcessingId(profile.id);
    try {
      const { error } = await supabase
        .from("profiles")
        .update({ is_verified: true, verification_sent: false })
        .eq("id", profile.id);

      if (error) throw error;
      await supabase.functions.invoke('verification-result', {
        body: { profileId: profile.id, status: 'approved', userName: profile.full_name }
      });
      toast.success("Profissional aprovado!");
      fetchData();
    } catch (error) {
      toast.error("Erro ao aprovar.");
    } finally {
      setProcessingId(null);
    }
  };

  const confirmRejection = async () => {
    setProcessingId(selectedProfile.id);
    try {
      const { error } = await supabase
        .from("profiles")
        .update({ verification_sent: false })
        .eq("id", selectedProfile.id);

      if (error) throw error;
      await supabase.functions.invoke('verification-result', {
        body: { 
          profileId: selectedProfile.id, 
          status: 'rejected',
          reason: rejectionReason,
          userName: selectedProfile.full_name
        }
      });
      toast.info("Solicitação reprovada.");
      setRejectionModalOpen(false);
      fetchData();
    } catch (error) {
      toast.error("Erro ao reprovar.");
    } finally {
      setProcessingId(null);
    }
  };

  const handleSavePlan = async (e: React.FormEvent) => {
    e.preventDefault();
    const formData = new FormData(e.target as HTMLFormElement);
    const planData = {
      id: editingPlan?.id || formData.get('id') as string,
      name: formData.get('name') as string,
      price: formData.get('price') as string,
      period: formData.get('period') as string,
      description: formData.get('description') as string,
      popular: formData.get('popular') === 'on',
      features: (formData.get('features') as string).split('\n').filter(f => f.trim() !== '')
    };

    try {
      const { error } = await supabase.from("plans").upsert(planData);
      if (error) throw error;
      toast.success("Plano salvo!");
      fetchPlans();
      setPlanModalOpen(false);
    } catch (e) {
      toast.error("Erro ao salvar plano.");
    }
  };

  const filteredUsers = allUsers.filter(u => {
    const matchesSearch = u.full_name?.toLowerCase().includes(userSearch.toLowerCase());
    const matchesRole = userRoleFilter === 'all' || u.role === userRoleFilter;
    return matchesSearch && matchesRole;
  });

  if (authLoading || loading || isCheckingAdmin) return (
    <Layout>
      <div className="flex h-96 items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <p className="text-sm text-muted-foreground animate-pulse">Verificando credenciais...</p>
        </div>
      </div>
    </Layout>
  );

  // SE NÃO ESTIVER LOGADO -> MOSTRAR LOGIN
  if (!session) {
    return (
      <Layout>
        <div className="flex min-h-[calc(100vh-16rem)] items-center justify-center py-12 px-4 bg-secondary/20">
          <div className="w-full max-w-md space-y-8 rounded-2xl border border-border bg-card p-8 shadow-card">
            <div className="text-center">
              <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-xl bg-primary">
                <Lock className="h-6 w-6 text-primary-foreground" />
              </div>
              <h2 className="mt-6 text-3xl font-bold tracking-tight text-foreground">Acesso Administrativo</h2>
              <p className="mt-2 text-sm text-muted-foreground">
                {adminExists 
                  ? "Portal restrito para gestores da plataforma." 
                  : "Nenhum administrador encontrado. Crie o primeiro acesso."}
              </p>
            </div>
            
            <div className="mt-8">
              <AuthForm 
                mode={adminExists ? "login" : "register"} 
                allowRegister={!adminExists} 
              />
            </div>
          </div>
        </div>
      </Layout>
    );
  }

  // SE ESTIVER LOGADO MAS NÃO FOR ADMIN -> ACESSO NEGADO
  if (session && !isAdmin) {
    return (
      <Layout>
        <div className="flex min-h-[calc(100vh-16rem)] items-center justify-center py-12 px-4 bg-secondary/20">
          <div className="w-full max-w-md text-center space-y-6 rounded-2xl border border-destructive/20 bg-card p-8 shadow-card">
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-destructive/10">
              <AlertTriangle className="h-8 w-8 text-destructive" />
            </div>
            <h2 className="text-2xl font-bold text-foreground">Acesso Negado</h2>
            <p className="text-muted-foreground">Esta conta não possui privilégios administrativos.</p>
            <div className="flex flex-col gap-3">
              <Button onClick={() => window.location.href = '/dashboard'}>Ir para meu Perfil</Button>
              <Button variant="ghost" onClick={signOut} className="text-destructive">Sair e usar outra conta</Button>
            </div>
          </div>
        </div>
      </Layout>
    );
  }

  // SE FOR ADMIN -> MOSTRAR PAINEL
  return (
    <Layout>
      <div className="min-h-screen bg-secondary/20 py-8">
        <div className="container mx-auto px-4">
          <div className="mb-8 flex items-center justify-between">
            <h1 className="text-3xl font-bold flex items-center gap-3">
              <ShieldCheck className="h-8 w-8 text-primary" /> Painel Administrativo
            </h1>
            <Button variant="ghost" onClick={signOut} className="gap-2 hover:bg-destructive/10 hover:text-destructive">
              <LogOut className="h-4 w-4" /> Sair
            </Button>
          </div>

          <Tabs defaultValue="verifications" className="space-y-6">
            <TabsList className="grid w-full max-w-md grid-cols-3">
              <TabsTrigger value="verifications" className="gap-2">
                Verificações
                {pendingProfiles.length > 0 && (
                  <Badge variant="destructive" className="ml-1 h-5 w-5 justify-center rounded-full p-0 text-[10px]">
                    {pendingProfiles.length}
                  </Badge>
                )}
              </TabsTrigger>
              <TabsTrigger value="users">Usuários</TabsTrigger>
              <TabsTrigger value="plans">Planos</TabsTrigger>
            </TabsList>

            <TabsContent value="verifications">
              <div className="rounded-2xl border bg-card shadow-card overflow-hidden">
                <Table>
                  <TableHeader className="bg-muted/50">
                    <TableRow>
                      <TableHead>Profissional</TableHead>
                      <TableHead>Documentos</TableHead>
                      <TableHead className="text-right">Ações</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {pendingProfiles.length > 0 ? (
                      pendingProfiles.map((p) => (
                        <TableRow key={p.id}>
                          <TableCell>
                            <div className="font-semibold">{p.full_name}</div>
                            <div className="text-xs text-muted-foreground">{p.specialty}</div>
                          </TableCell>
                          <TableCell>
                            <div className="flex gap-2">
                              <Button variant="outline" size="sm" onClick={() => window.open(p.id_document_url, '_blank')}>RG/CNH</Button>
                              <Button variant="outline" size="sm" onClick={() => window.open(p.prof_registration_url, '_blank')}>Registro</Button>
                            </div>
                          </TableCell>
                          <TableCell className="text-right">
                            <div className="flex justify-end gap-2">
                              <Button variant="outline" size="sm" asChild className="gap-2">
                                <Link to={`/profissional/${p.id}`} target="_blank">
                                  <ExternalLink className="h-3 w-3" /> Ver Perfil
                                </Link>
                              </Button>
                              <Button variant="ghost" size="sm" className="text-destructive" onClick={() => { setSelectedProfile(p); setRejectionModalOpen(true); }}>Reprovar</Button>
                              <Button size="sm" className="bg-success hover:bg-success/90" onClick={() => handleApprove(p)} disabled={!!processingId}>Aprovar</Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))
                    ) : (
                      <TableRow><TableCell colSpan={3} className="text-center py-10 text-muted-foreground">Nenhuma verificação pendente.</TableCell></TableRow>
                    )}
                  </TableBody>
                </Table>
              </div>
            </TabsContent>

            <TabsContent value="users" className="space-y-4">
              <div className="flex flex-col md:flex-row gap-4 justify-between">
                <div className="flex gap-4 flex-1">
                  <div className="relative flex-1 max-sm:w-full max-w-sm">
                    <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                    <Input placeholder="Buscar por nome..." className="pl-10" value={userSearch} onChange={e => setUserSearch(e.target.value)} />
                  </div>
                  <Select value={userRoleFilter} onValueChange={setUserRoleFilter}>
                    <SelectTrigger className="w-[180px]"><SelectValue placeholder="Cargo" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Todos os Cargos</SelectItem>
                      <SelectItem value="professional">Profissionais</SelectItem>
                      <SelectItem value="company">Empresas</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <Button className="gap-2" onClick={() => setCreateUserModalOpen(true)}>
                  <UserPlus className="h-4 w-4" /> Novo Usuário
                </Button>
              </div>

              <div className="rounded-2xl border bg-card shadow-card overflow-hidden">
                <Table>
                  <TableHeader className="bg-muted/50">
                    <TableRow>
                      <TableHead>Nome</TableHead>
                      <TableHead>E-mail Validado</TableHead>
                      <TableHead>Plano</TableHead>
                      <TableHead>Cargo</TableHead>
                      <TableHead className="text-right">Ações</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredUsers.length > 0 ? (
                      filteredUsers.map((u) => (
                        <TableRow key={u.id}>
                          <TableCell className="font-medium">{u.full_name || 'Sem nome'}</TableCell>
                          <TableCell>
                            {u.email_confirmed ? (
                              <Badge className="bg-success/10 text-success border-success/20 gap-1"><CheckCircle className="h-3 w-3" /> Validado</Badge>
                            ) : (
                              <Badge variant="outline" className="text-muted-foreground gap-1"><Mail className="h-3 w-3" /> Pendente</Badge>
                            )}
                          </TableCell>
                          <TableCell>
                            <Badge variant="secondary" className="capitalize">
                              {u.subscription_tier === 'yearly' ? 'Anual' : 'Mensal'}
                            </Badge>
                          </TableCell>
                          <TableCell className="capitalize">{u.role}</TableCell>
                          <TableCell className="text-right">
                            <Button variant="ghost" size="sm" asChild>
                              <Link to={`/profissional/${u.id}`} target="_blank">Ver</Link>
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))
                    ) : (
                      <TableRow><TableCell colSpan={5} className="text-center py-10 text-muted-foreground">Nenhum usuário encontrado.</TableCell></TableRow>
                    )}
                  </TableBody>
                </Table>
              </div>
            </TabsContent>

            <TabsContent value="plans" className="space-y-4">
              <div className="flex justify-end">
                <Button className="gap-2" onClick={() => { setEditingPlan(null); setPlanModalOpen(true); }}>
                  <Plus className="h-4 w-4" /> Novo Plano
                </Button>
              </div>
              <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
                {plans.map((plan) => (
                  <div key={plan.id} className="rounded-2xl border bg-card p-6 shadow-card relative">
                    {plan.popular && <Badge className="absolute -top-2 right-4 bg-primary">Popular</Badge>}
                    <h3 className="text-xl font-bold">{plan.name}</h3>
                    <p className="text-2xl font-bold text-primary mt-2">{plan.price} <span className="text-sm font-normal text-muted-foreground">/{plan.period}</span></p>
                    <div className="mt-4"><Button variant="outline" size="sm" className="w-full" onClick={() => { setEditingPlan(plan); setPlanModalOpen(true); }}>Editar</Button></div>
                  </div>
                ))}
              </div>
            </TabsContent>
          </Tabs>
        </div>
      </div>

      {/* Modal Criar Usuário */}
      <Dialog open={createUserModalOpen} onOpenChange={setCreateUserModalOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Criar Novo Usuário</DialogTitle>
            <DialogDescription>O usuário receberá uma conta e deverá validar o e-mail no primeiro acesso.</DialogDescription>
          </DialogHeader>
          <form onSubmit={handleCreateUser} className="space-y-4">
            <div className="grid gap-2">
              <Label>Nome Completo</Label>
              <Input name="fullName" placeholder="Ex: João Silva" required />
            </div>
            <div className="grid gap-2">
              <Label>E-mail</Label>
              <Input name="email" type="email" placeholder="usuario@email.com" required />
            </div>
            <div className="grid gap-2">
              <Label>Senha Temporária</Label>
              <Input name="password" type="password" placeholder="Mínimo 6 caracteres" required />
            </div>
            <div className="grid gap-2">
              <Label>Cargo</Label>
              <Select name="role" defaultValue="professional">
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="professional">Profissional</SelectItem>
                  <SelectItem value="company">Empresa</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <DialogFooter>
              <Button type="button" variant="ghost" onClick={() => setCreateUserModalOpen(false)}>Cancelar</Button>
              <Button type="submit" disabled={isCreatingUser}>
                {isCreatingUser ? <Loader2 className="h-4 w-4 animate-spin" /> : "Criar Usuário"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={rejectionModalOpen} onOpenChange={setRejectionModalOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Reprovar Verificação</DialogTitle></DialogHeader>
          <Textarea placeholder="Motivo..." value={rejectionReason} onChange={e => setRejectionReason(e.target.value)} />
          <DialogFooter>
            <Button variant="destructive" onClick={confirmRejection}>Confirmar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Layout>
  );
};

export default Admin;