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
  RefreshCw
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
  const [isAdmin, setIsAdmin] = useState(false);
  const [adminExists, setAdminExists] = useState(false);
  const [processingId, setProcessingId] = useState<string | null>(null);
  
  const [pendingProfiles, setPendingProfiles] = useState<any[]>([]);
  const [allUsers, setAllUsers] = useState<any[]>([]);
  const [userSearch, setUserSearch] = useState("");
  const [userRoleFilter, setUserRoleFilter] = useState("all");
  const [createUserModalOpen, setCreateUserModalOpen] = useState(false);
  const [isCreatingUser, setIsCreatingUser] = useState(false);
  const [plans, setPlans] = useState<any[]>([]);

  useEffect(() => {
    if (!authLoading) {
      checkAdminStatus();
    }
  }, [user, authLoading]);

  const checkAdminStatus = async () => {
    try {
      setLoading(true);

      // 1. Verifica se existe algum admin no sistema
      const { count } = await supabase
        .from("profiles")
        .select("*", { count: 'exact', head: true })
        .eq("is_admin", true);
      setAdminExists((count || 0) > 0);

      if (user) {
        // 2. Busca o perfil do usuário logado diretamente
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
    const [pending, users, plansData] = await Promise.all([
      supabase.from("profiles").select("*").eq("verification_sent", true).eq("is_verified", false),
      supabase.from("profiles").select("*").order('created_at', { ascending: false }),
      supabase.from("plans").select("*").order('created_at', { ascending: true })
    ]);
    
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
      toast.success("Usuário criado!");
      setCreateUserModalOpen(false);
      fetchData();
    } catch (err) {
      toast.error("Erro ao criar usuário.");
    } finally {
      setIsCreatingUser(false);
    }
  };

  const filteredUsers = allUsers.filter(u => {
    const matchesSearch = u.full_name?.toLowerCase().includes(userSearch.toLowerCase());
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
              <ShieldCheck className="h-8 w-8 text-primary" /> Admin
            </h1>
            <Button variant="ghost" onClick={signOut} className="gap-2 hover:text-destructive">
              <LogOut className="h-4 w-4" /> Sair
            </Button>
          </div>

          <Tabs defaultValue="verifications" className="space-y-6">
            <TabsList>
              <TabsTrigger value="verifications">Verificações ({pendingProfiles.length})</TabsTrigger>
              <TabsTrigger value="users">Usuários</TabsTrigger>
              <TabsTrigger value="plans">Planos</TabsTrigger>
            </TabsList>

            <TabsContent value="verifications">
              <div className="rounded-xl border bg-card overflow-hidden">
                <Table>
                  <TableHeader><TableRow><TableHead>Profissional</TableHead><TableHead>Documentos</TableHead><TableHead className="text-right">Ações</TableHead></TableRow></TableHeader>
                  <TableBody>
                    {pendingProfiles.map(p => (
                      <TableRow key={p.id}>
                        <TableCell><div className="font-medium">{p.full_name}</div><div className="text-xs text-muted-foreground">{p.specialty}</div></TableCell>
                        <TableCell><div className="flex gap-2"><Button variant="outline" size="sm" onClick={() => window.open(p.id_document_url)}>RG</Button><Button variant="outline" size="sm" onClick={() => window.open(p.prof_registration_url)}>Prof.</Button></div></TableCell>
                        <TableCell className="text-right"><Button variant="ghost" size="sm" asChild><Link to={`/profissional/${p.id}`} target="_blank">Ver</Link></Button></TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </TabsContent>

            <TabsContent value="users" className="space-y-4">
              <div className="flex gap-4">
                <Input placeholder="Buscar..." value={userSearch} onChange={e => setUserSearch(e.target.value)} className="max-w-sm" />
                <Button className="gap-2" onClick={() => setCreateUserModalOpen(true)}><UserPlus className="h-4 w-4" /> Novo</Button>
              </div>
              <div className="rounded-xl border bg-card overflow-hidden">
                <Table>
                  <TableHeader><TableRow><TableHead>Nome</TableHead><TableHead>Cargo</TableHead><TableHead>Plano</TableHead><TableHead className="text-right">Perfil</TableHead></TableRow></TableHeader>
                  <TableBody>
                    {filteredUsers.map(u => (
                      <TableRow key={u.id}>
                        <TableCell>{u.full_name || '---'}</TableCell>
                        <TableCell className="capitalize">{u.role}</TableCell>
                        <TableCell className="capitalize">{u.subscription_tier}</TableCell>
                        <TableCell className="text-right"><Button variant="ghost" size="sm" asChild><Link to={`/profissional/${u.id}`} target="_blank">Perfil</Link></Button></TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </TabsContent>
          </Tabs>
        </div>
      </div>

      <Dialog open={createUserModalOpen} onOpenChange={setCreateUserModalOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Criar Usuário</DialogTitle></DialogHeader>
          <form onSubmit={handleCreateUser} className="space-y-4">
            <div className="grid gap-2"><Label>Nome</Label><Input name="fullName" required /></div>
            <div className="grid gap-2"><Label>E-mail</Label><Input name="email" type="email" required /></div>
            <div className="grid gap-2"><Label>Senha</Label><Input name="password" type="password" required /></div>
            <div className="grid gap-2">
              <Label>Cargo</Label>
              <Select name="role" defaultValue="professional"><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="professional">Profissional</SelectItem><SelectItem value="company">Empresa</SelectItem></SelectContent></Select>
            </div>
            <Button type="submit" className="w-full" disabled={isCreatingUser}>{isCreatingUser ? <Loader2 className="animate-spin h-4 w-4" /> : "Criar"}</Button>
          </form>
        </DialogContent>
      </Dialog>
    </Layout>
  );
};

export default Admin;