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
  Search,
  Plus,
  Lock,
  AlertTriangle,
  ExternalLink,
  Mail,
  UserPlus,
  RefreshCw,
  Package
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Link } from "react-router-dom";

const Admin = () => {
  const { user, session, loading: authLoading, signOut } = useAuth();
  const [loading, setLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);
  const [adminExists, setAdminExists] = useState(false);
  
  const [pendingProfiles, setPendingProfiles] = useState<any[]>([]);
  const [allUsers, setAllUsers] = useState<any[]>([]);
  const [plans, setPlans] = useState<any[]>([]);
  const [userSearch, setUserSearch] = useState("");
  const [userRoleFilter, setUserRoleFilter] = useState("all");
  const [createUserModalOpen, setCreateUserModalOpen] = useState(false);
  const [isCreatingUser, setIsCreatingUser] = useState(false);

  useEffect(() => {
    if (!authLoading) {
      checkAdminStatus();
    }
  }, [user, authLoading]);

  const checkAdminStatus = async () => {
    try {
      setLoading(true);

      const { count } = await supabase
        .from("profiles")
        .select("*", { count: 'exact', head: true })
        .eq("is_admin", true);
      setAdminExists((count || 0) > 0);

      if (user) {
        const { data, error } = await supabase
          .from("profiles")
          .select("is_admin, role")
          .eq("id", user.id)
          .single();

        if (error) {
          console.error("Erro ao buscar perfil admin:", error);
          setIsAdmin(false);
        } else if (data && (data.is_admin || data.role === 'admin')) {
          setIsAdmin(true);
          await fetchData();
        } else {
          setIsAdmin(false);
        }
      }
    } catch (err) {
      console.error("Erro crítico no Admin:", err);
    } finally {
      setLoading(false);
    }
  };

  const fetchData = async () => {
    console.log("[Admin] Buscando dados...");
    const [pending, users, plansData] = await Promise.all([
      supabase.from("profiles").select("*").eq("verification_sent", true).eq("is_verified", false),
      supabase.from("profiles").select("*").order('updated_at', { ascending: false }),
      supabase.from("plans").select("*").order('price', { ascending: true })
    ]);
    
    if (users.error) toast.error("Erro ao carregar usuários: " + users.error.message);
    if (plansData.error) toast.error("Erro ao carregar planos: " + plansData.error.message);

    setPendingProfiles(pending.data || []);
    setAllUsers(users.data || []);
    setPlans(plansData.data || []);
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
      fetchData();
    } catch (err: any) {
      toast.error("Erro ao criar usuário: " + (err.message || "Tente novamente"));
    } finally {
      setIsCreatingUser(false);
    }
  };

  const filteredUsers = allUsers.filter(u => {
    const name = (u.full_name || u.id || "").toLowerCase();
    const matchesSearch = name.includes(userSearch.toLowerCase());
    const matchesRole = userRoleFilter === 'all' || u.role === userRoleFilter;
    return matchesSearch && matchesRole;
  });

  if (authLoading || loading) return (
    <Layout>
      <div className="flex h-96 items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    </Layout>
  );

  if (!session) return (
    <Layout>
      <div className="flex min-h-[calc(100vh-16rem)] items-center justify-center py-12 px-4 bg-secondary/20">
        <div className="w-full max-w-md space-y-8 rounded-2xl border border-border bg-card p-8 shadow-card">
          <div className="text-center">
            <Lock className="mx-auto h-12 w-12 text-primary" />
            <h2 className="mt-6 text-3xl font-bold">Painel de Gestão</h2>
            <p className="mt-2 text-sm text-muted-foreground">Acesse com sua conta de administrador.</p>
          </div>
          <AuthForm mode={adminExists ? "login" : "register"} allowRegister={!adminExists} />
        </div>
      </div>
    </Layout>
  );

  if (!isAdmin) return (
    <Layout>
      <div className="flex min-h-[calc(100vh-16rem)] items-center justify-center py-12 px-4 bg-secondary/20">
        <div className="w-full max-w-md text-center space-y-6 rounded-2xl border border-destructive/20 bg-card p-8 shadow-card">
          <AlertTriangle className="mx-auto h-16 w-16 text-destructive" />
          <h2 className="text-2xl font-bold">Acesso Restrito</h2>
          <p className="text-muted-foreground">O usuário <strong>{user?.email}</strong> não possui acesso administrativo.</p>
          <div className="flex flex-col gap-3">
            <Button onClick={checkAdminStatus} variant="outline" className="gap-2">
              <RefreshCw className="h-4 w-4" /> Tentar Novamente
            </Button>
            <Button variant="ghost" onClick={signOut} className="text-destructive">Sair e usar outra conta</Button>
          </div>
        </div>
      </div>
    </Layout>
  );

  return (
    <Layout>
      <div className="min-h-screen bg-secondary/20 py-8">
        <div className="container mx-auto px-4">
          <div className="mb-8 flex items-center justify-between">
            <h1 className="text-3xl font-bold flex items-center gap-3">
              <ShieldCheck className="h-8 w-8 text-primary" /> Painel Admin
            </h1>
            <div className="flex gap-2">
              <Button variant="outline" onClick={fetchData} className="gap-2">
                <RefreshCw className="h-4 w-4" /> Atualizar
              </Button>
              <Button variant="ghost" onClick={signOut} className="gap-2 hover:text-destructive">
                <LogOut className="h-4 w-4" /> Sair
              </Button>
            </div>
          </div>

          <Tabs defaultValue="users" className="space-y-6">
            <TabsList className="bg-card border">
              <TabsTrigger value="users">Usuários ({allUsers.length})</TabsTrigger>
              <TabsTrigger value="verifications">Verificações ({pendingProfiles.length})</TabsTrigger>
              <TabsTrigger value="plans">Planos ({plans.length})</TabsTrigger>
            </TabsList>

            <TabsContent value="users" className="space-y-4">
              <div className="flex flex-col md:flex-row gap-4 items-end">
                <div className="flex-1 space-y-2">
                  <Label>Buscar Usuários</Label>
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                    <Input placeholder="Nome ou ID..." value={userSearch} onChange={e => setUserSearch(e.target.value)} className="pl-10" />
                  </div>
                </div>
                <div className="w-full md:w-48 space-y-2">
                  <Label>Filtrar Cargo</Label>
                  <Select value={userRoleFilter} onValueChange={setUserRoleFilter}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Todos</SelectItem>
                      <SelectItem value="professional">Profissional</SelectItem>
                      <SelectItem value="company">Empresa</SelectItem>
                      <SelectItem value="admin">Admin</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <Button className="gap-2" onClick={() => setCreateUserModalOpen(true)}><UserPlus className="h-4 w-4" /> Novo Usuário</Button>
              </div>

              <div className="rounded-xl border bg-card overflow-hidden shadow-sm">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Usuário</TableHead>
                      <TableHead>Cargo</TableHead>
                      <TableHead>Plano</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="text-right">Ações</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredUsers.length > 0 ? filteredUsers.map(u => (
                      <TableRow key={u.id}>
                        <TableCell>
                          <div className="font-medium">{u.full_name || 'Usuário s/ nome'}</div>
                          <div className="text-[10px] text-muted-foreground font-mono">{u.id}</div>
                        </TableCell>
                        <TableCell>
                          <Badge variant={u.role === 'admin' ? 'default' : 'secondary'} className="capitalize">
                            {u.role === 'professional' ? 'Profissional' : u.role === 'company' ? 'Empresa' : u.role}
                          </Badge>
                        </TableCell>
                        <TableCell className="capitalize">{u.subscription_tier}</TableCell>
                        <TableCell>
                          {u.is_verified ? (
                            <Badge className="bg-success text-white">Verificado</Badge>
                          ) : (
                            <Badge variant="outline">Pendente</Badge>
                          )}
                        </TableCell>
                        <TableCell className="text-right">
                          <Button variant="ghost" size="sm" asChild>
                            <Link to={`/profissional/${u.id}`} target="_blank" className="gap-2">
                              <ExternalLink className="h-3 w-3" /> Ver Perfil
                            </Link>
                          </Button>
                        </TableCell>
                      </TableRow>
                    )) : (
                      <TableRow>
                        <TableCell colSpan={5} className="h-32 text-center text-muted-foreground">
                          Nenhum usuário encontrado.
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </div>
            </TabsContent>

            <TabsContent value="verifications">
              <div className="rounded-xl border bg-card overflow-hidden shadow-sm">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Profissional</TableHead>
                      <TableHead>Documentos</TableHead>
                      <TableHead className="text-right">Ações</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {pendingProfiles.length > 0 ? pendingProfiles.map(p => (
                      <TableRow key={p.id}>
                        <TableCell>
                          <div className="font-medium">{p.full_name}</div>
                          <div className="text-xs text-muted-foreground">{p.specialty}</div>
                        </TableCell>
                        <TableCell>
                          <div className="flex gap-2">
                            <Button variant="outline" size="sm" onClick={() => window.open(p.id_document_url)} className="h-7 text-[10px]">Ver RG</Button>
                            <Button variant="outline" size="sm" onClick={() => window.open(p.prof_registration_url)} className="h-7 text-[10px]">Ver Prof.</Button>
                          </div>
                        </TableCell>
                        <TableCell className="text-right">
                          <Button variant="ghost" size="sm" asChild>
                            <Link to={`/profissional/${p.id}`} target="_blank">Revisar Perfil</Link>
                          </Button>
                        </TableCell>
                      </TableRow>
                    )) : (
                      <TableRow>
                        <TableCell colSpan={3} className="h-32 text-center text-muted-foreground">
                          Nenhuma solicitação de verificação pendente.
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </div>
            </TabsContent>

            <TabsContent value="plans">
              <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
                {plans.length > 0 ? plans.map(p => (
                  <div key={p.id} className="rounded-xl border bg-card p-6 shadow-sm">
                    <div className="flex justify-between items-start mb-4">
                      <div>
                        <h3 className="font-bold text-lg">{p.name}</h3>
                        <p className="text-sm text-muted-foreground">{p.description}</p>
                      </div>
                      <Package className="h-5 w-5 text-primary" />
                    </div>
                    <div className="text-2xl font-bold text-primary mb-4">{p.price}<span className="text-xs text-muted-foreground font-normal"> / {p.period}</span></div>
                    <div className="space-y-2">
                      {p.features?.map((f: string, i: number) => (
                        <div key={i} className="flex items-center gap-2 text-xs text-muted-foreground">
                          <CheckCircle className="h-3 w-3 text-success" /> {f}
                        </div>
                      ))}
                    </div>
                  </div>
                )) : (
                  <div className="col-span-full h-32 flex items-center justify-center border border-dashed rounded-xl text-muted-foreground">
                    Nenhum plano cadastrado no banco de dados.
                  </div>
                )}
              </div>
            </TabsContent>
          </Tabs>
        </div>
      </div>

      <Dialog open={createUserModalOpen} onOpenChange={setCreateUserModalOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Criar Novo Usuário</DialogTitle>
            <DialogDescription>O usuário receberá um e-mail para confirmar a conta.</DialogDescription>
          </DialogHeader>
          <form onSubmit={handleCreateUser} className="space-y-4 pt-4">
            <div className="grid gap-2">
              <Label htmlFor="fullName">Nome Completo</Label>
              <Input id="fullName" name="fullName" placeholder="Ex: João Silva" required />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="email">E-mail</Label>
              <Input id="email" name="email" type="email" placeholder="email@exemplo.com" required />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="password">Senha Temporária</Label>
              <Input id="password" name="password" type="password" required minLength={6} />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="role">Cargo / Tipo de Conta</Label>
              <Select name="role" defaultValue="professional">
                <SelectTrigger>
                  <SelectValue placeholder="Selecione o cargo" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="professional">Profissional de Saúde</SelectItem>
                  <SelectItem value="company">Empresa de Home Care</SelectItem>
                  <SelectItem value="admin">Administrador</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <DialogFooter className="pt-4">
              <Button type="button" variant="ghost" onClick={() => setCreateUserModalOpen(false)}>Cancelar</Button>
              <Button type="submit" disabled={isCreatingUser}>
                {isCreatingUser ? <Loader2 className="animate-spin h-4 w-4 mr-2" /> : <UserPlus className="h-4 w-4 mr-2" />}
                Criar Usuário
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </Layout>
  );
};

export default Admin;