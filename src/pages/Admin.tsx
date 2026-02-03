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
  ShieldCheck, 
  Loader2,
  LogOut,
  Lock,
  ThumbsUp,
  ThumbsDown,
  Edit2,
  Plus,
  ShieldAlert
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
import { useNavigate } from "react-router-dom";

const Admin = () => {
  const { user, session, loading: authLoading, signOut } = useAuth();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);
  const [adminExists, setAdminExists] = useState(true);
  
  const [pendingProfiles, setPendingProfiles] = useState<any[]>([]);
  const [allUsers, setAllUsers] = useState<any[]>([]);
  const [plans, setPlans] = useState<any[]>([]);
  
  const [rejectionModalOpen, setRejectionModalOpen] = useState(false);
  const [planModalOpen, setPlanModalOpen] = useState(false);
  const [selectedProfile, setSelectedProfile] = useState<any>(null);
  const [selectedPlan, setSelectedPlan] = useState<any>(null);
  const [rejectionReason, setRejectionReason] = useState("");
  const [isProcessingVerification, setIsProcessingVerification] = useState(false);
  const [isSavingPlan, setIsSavingPlan] = useState(false);

  useEffect(() => {
    const checkGlobalAdmin = async () => {
      try {
        const { data, error } = await supabase.rpc('any_admin_exists');
        if (!error) setAdminExists(data);
      } catch (e) {
        console.error("[Admin] Erro check global:", e);
      }
    };
    checkGlobalAdmin();
  }, []);

  useEffect(() => {
    const checkUserAdmin = async () => {
      if (authLoading) return;
      
      if (!user) {
        setIsAdmin(false);
        setLoading(false);
        return;
      }
      
      try {
        setLoading(true);
        // Usamos uma função RPC ou uma consulta direta com RLS ativo
        const { data, error } = await supabase
          .from("profiles")
          .select("is_admin, role")
          .eq("id", user.id)
          .single();
        
        if (!error && data && (data.is_admin === true || data.role === 'admin')) {
          setIsAdmin(true);
          await fetchData();
        } else {
          setIsAdmin(false);
          // Se não for admin, podemos redirecionar para o dashboard
          if (location.pathname === '/admin') {
            toast.error("Acesso negado. Você não é um administrador.");
          }
        }
      } catch (err) {
        console.error("[Admin] Erro crítico de verificação:", err);
        setIsAdmin(false);
      } finally {
        setLoading(false);
      }
    };

    checkUserAdmin();
  }, [user, authLoading]);

  const fetchData = async () => {
    try {
      const [pendingRes, usersRes, plansRes] = await Promise.all([
        supabase.from("profiles").select("*").eq("verification_sent", true).eq("is_verified", false),
        supabase.from("profiles").select("*").order('updated_at', { ascending: false }),
        supabase.from("plans").select("*").order('price', { ascending: true })
      ]);
      
      setPendingProfiles(pendingRes.data || []);
      setAllUsers(usersRes.data || []);
      setPlans(plansRes.data || []);
    } catch (error) {
      console.error("[Admin] Erro fetch:", error);
    }
  };

  const handleApprove = async (profileId: string) => {
    setIsProcessingVerification(true);
    try {
      const { error } = await supabase.from("profiles").update({ is_verified: true }).eq("id", profileId);
      if (error) throw error;
      toast.success("Perfil aprovado!");
      fetchData();
    } catch (err: any) {
      toast.error("Erro ao aprovar.");
    } finally {
      setIsProcessingVerification(false);
    }
  };

  const handleReject = async () => {
    if (!rejectionReason || !selectedProfile) return;
    setIsProcessingVerification(true);
    try {
      const { error } = await supabase.from("profiles").update({ verification_sent: false }).eq("id", selectedProfile.id);
      if (error) throw error;
      toast.success("Perfil reprovado.");
      setRejectionModalOpen(false);
      setRejectionReason("");
      fetchData();
    } catch (err: any) {
      toast.error("Erro ao reprovar.");
    } finally {
      setIsProcessingVerification(false);
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

  // Se estiver carregando, mostra o spinner
  if (authLoading || loading) {
    return <Layout><div className="flex h-[60vh] items-center justify-center"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div></Layout>;
  }
  
  // Se não estiver logado, mostra o formulário de login (ou registro se for o primeiro admin)
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

  // Se estiver logado mas NÃO for admin, bloqueia TOTALMENTE a renderização do conteúdo
  if (!isAdmin) {
    return (
      <Layout>
        <div className="flex h-[60vh] items-center justify-center">
          <div className="text-center p-8 bg-card border rounded-2xl shadow-sm max-w-md">
            <ShieldAlert className="h-12 w-12 text-destructive mx-auto mb-4" />
            <h2 className="text-xl font-bold">Acesso Negado</h2>
            <p className="text-muted-foreground mt-2">Você não possui privilégios de administrador para visualizar esta página.</p>
            <div className="mt-6 flex flex-col gap-2">
              <Button asChild variant="default"><a href="/dashboard">Ir para Meu Painel</a></Button>
              <Button variant="ghost" onClick={signOut}>Sair</Button>
            </div>
          </div>
        </div>
      </Layout>
    );
  }

  // Apenas se isAdmin for TRUE, renderiza o dashboard
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
                          <Button variant="ghost" size="sm" className="text-success" onClick={() => handleApprove(p.id)}><ThumbsUp className="h-4 w-4 mr-1" />Aprovar</Button>
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
                  <TableHeader><TableRow><TableHead>Nome</TableHead><TableHead>E-mail</TableHead><TableHead>Função</TableHead><TableHead>Verificado</TableHead></TableRow></TableHeader>
                  <TableBody>
                    {allUsers.map(u => (
                      <TableRow key={u.id}>
                        <TableCell className="font-medium">{u.full_name}</TableCell>
                        <TableCell>{u.email}</TableCell>
                        <TableCell><Badge variant="outline" className="capitalize">{u.role}</Badge></TableCell>
                        <TableCell>{u.is_verified ? <Badge className="bg-success">Sim</Badge> : <Badge variant="secondary">Não</Badge>}</TableCell>
                      </TableRow>
                    ))}
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
                  <TableHeader><TableRow><TableHead>Nome</TableHead><TableHead>Preço</TableHead><TableHead>Status</TableHead><TableHead className="text-right">Ações</TableHead></TableRow></TableHeader>
                  <TableBody>
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
                    )) : <TableRow><TableCell colSpan={4} className="h-32 text-center text-muted-foreground">Nenhum plano cadastrado.</TableCell></TableRow>}
                  </TableBody>
                </Table>
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
    </Layout>
  );
};

export default Admin;