"use client";

import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import Layout from "@/components/layout/Layout";
import AuthForm from "@/components/auth/AuthForm";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { 
  ShieldCheck, 
  Loader2,
  LogOut,
  Lock,
  AlertTriangle,
  RefreshCw,
  XCircle,
  ThumbsUp,
  ThumbsDown
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

const Admin = () => {
  const { user, session, loading: authLoading, signOut } = useAuth();
  const [loading, setLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);
  const [adminExists, setAdminExists] = useState(true); // Default to true for security (show login first)
  
  const [pendingProfiles, setPendingProfiles] = useState<any[]>([]);
  const [allUsers, setAllUsers] = useState<any[]>([]);
  const [plans, setPlans] = useState<any[]>([]);
  
  const [rejectionModalOpen, setRejectionModalOpen] = useState(false);
  const [selectedProfile, setSelectedProfile] = useState<any>(null);
  const [rejectionReason, setRejectionReason] = useState("");
  const [isProcessingVerification, setIsProcessingVerification] = useState(false);

  useEffect(() => {
    // Check global admin status immediately for the form logic
    checkGlobalAdminStatus();
  }, []);

  useEffect(() => {
    // Check current user status when auth changes
    if (!authLoading && user) {
      checkCurrentUserAdminStatus();
    } else if (!authLoading && !user) {
      setLoading(false);
    }
  }, [user, authLoading]);

  const checkGlobalAdminStatus = async () => {
    try {
      // Use the secure RPC function
      const { data, error } = await supabase.rpc('any_admin_exists');
      if (!error && data !== null) {
        setAdminExists(data);
      }
    } catch (e) {
      console.error("Error checking admin status", e);
    }
  };

  const checkCurrentUserAdminStatus = async () => {
    if (!user) return;
    try {
      setLoading(true);
      const { data, error } = await supabase.from("profiles").select("is_admin, role").eq("id", user.id).single();
      
      if (error) {
        console.error("Profile check error:", error);
        setIsAdmin(false);
      } else if (data && (data.is_admin || data.role === 'admin')) {
        setIsAdmin(true);
        await fetchData();
      } else {
        setIsAdmin(false);
      }
    } finally {
      setLoading(false);
    }
  };

  const fetchData = async () => {
    const [pending, users, plansData] = await Promise.all([
      supabase.from("profiles").select("*").eq("verification_sent", true).eq("is_verified", false),
      supabase.from("profiles").select("*").order('updated_at', { ascending: false }),
      supabase.from("plans").select("*").order('price', { ascending: true })
    ]);
    
    setPendingProfiles(pending.data || []);
    setAllUsers(users.data || []);
    setPlans(plansData.data || []);
  };

  const handleApprove = async (profileId: string) => {
    setIsProcessingVerification(true);
    const { error } = await supabase.from("profiles").update({ is_verified: true }).eq("id", profileId);
    if (error) {
      toast.error("Erro ao aprovar perfil.");
    } else {
      toast.success("Perfil aprovado com sucesso!");
      await notifyVerificationResult(profileId, 'approved');
      fetchData();
    }
    setIsProcessingVerification(false);
  };

  const handleReject = async () => {
    if (!rejectionReason) {
      toast.error("Por favor, informe o motivo da reprovação.");
      return;
    }
    setIsProcessingVerification(true);
    const { error } = await supabase.from("profiles").update({ verification_sent: false }).eq("id", selectedProfile.id);
    if (error) {
      toast.error("Erro ao reprovar perfil.");
    } else {
      toast.success("Perfil reprovado.");
      await notifyVerificationResult(selectedProfile.id, 'rejected', rejectionReason);
      setRejectionModalOpen(false);
      setRejectionReason("");
      fetchData();
    }
    setIsProcessingVerification(false);
  };

  const notifyVerificationResult = async (profileId: string, status: 'approved' | 'rejected', reason?: string) => {
    const profileToNotify = allUsers.find(u => u.id === profileId);
    if (!profileToNotify) return;

    try {
      await supabase.functions.invoke('verification-result', {
        body: {
          profileId,
          status,
          reason,
          userName: profileToNotify.full_name,
        }
      });
    } catch (e) {
      console.error("Erro ao notificar usuário:", e);
    }
  };

  if (authLoading || loading) return <Layout><div className="flex h-96 items-center justify-center"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div></Layout>;
  
  if (!session) {
    return (
      <Layout>
        <div className="flex min-h-[calc(100vh-16rem)] items-center justify-center py-12 px-4 bg-secondary/20">
          <div className="w-full max-w-md space-y-8 rounded-2xl border border-border bg-card p-8 shadow-card">
            <div className="text-center">
              <Lock className="mx-auto h-12 w-12 text-primary" />
              <h2 className="mt-6 text-3xl font-bold">Painel de Gestão</h2>
              <p className="mt-2 text-sm text-muted-foreground">Acesse com sua conta de administrador.</p>
            </div>
            {/* Se admin existe, força login. Se não existe, permite registro do primeiro admin */}
            <AuthForm mode={adminExists ? "login" : "register"} allowRegister={!adminExists} />
          </div>
        </div>
      </Layout>
    );
  }

  if (!isAdmin) {
    return (
      <Layout>
        <div className="flex min-h-[calc(100vh-16rem)] items-center justify-center py-12 px-4 bg-secondary/20">
          <div className="w-full max-w-md text-center space-y-6 rounded-2xl border border-destructive/20 bg-card p-8 shadow-card">
            <AlertTriangle className="mx-auto h-16 w-16 text-destructive" />
            <h2 className="text-2xl font-bold">Acesso Restrito</h2>
            <p className="text-muted-foreground">O usuário <strong>{user?.email}</strong> não possui acesso administrativo.</p>
            <div className="flex flex-col gap-3">
              <Button onClick={checkCurrentUserAdminStatus} variant="outline" className="gap-2">
                <RefreshCw className="h-4 w-4" /> Tentar Novamente
              </Button>
              <Button variant="ghost" onClick={signOut} className="text-destructive">
                Sair e usar outra conta
              </Button>
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
            <div className="flex gap-2">
              <Button variant="outline" onClick={fetchData} className="gap-2"><RefreshCw className="h-4 w-4" /> Atualizar</Button>
              <Button variant="ghost" onClick={signOut} className="gap-2 hover:text-destructive"><LogOut className="h-4 w-4" /> Sair</Button>
            </div>
          </div>

          <Tabs defaultValue="verifications" className="space-y-6">
            <TabsList className="bg-card border">
              <TabsTrigger value="verifications">Verificações ({pendingProfiles.length})</TabsTrigger>
              <TabsTrigger value="users">Usuários ({allUsers.length})</TabsTrigger>
              <TabsTrigger value="plans">Planos ({plans.length})</TabsTrigger>
            </TabsList>

            <TabsContent value="verifications">
              <div className="rounded-xl border bg-card overflow-hidden shadow-sm">
                <Table>
                  <TableHeader><TableRow><TableHead>Profissional</TableHead><TableHead>Documentos</TableHead><TableHead className="text-right">Ações</TableHead></TableRow></TableHeader>
                  <TableBody>
                    {pendingProfiles.length > 0 ? pendingProfiles.map(p => (
                      <TableRow key={p.id}>
                        <TableCell><div className="font-medium">{p.full_name}</div><div className="text-xs text-muted-foreground">{p.specialty}</div></TableCell>
                        <TableCell>
                          <div className="flex gap-2">
                            {p.id_document_url && (
                              <Button variant="outline" size="sm" asChild className="h-7 text-xs">
                                <a href={p.id_document_url} target="_blank" rel="noopener noreferrer">Ver RG/CNH</a>
                              </Button>
                            )}
                            {p.prof_registration_url && (
                              <Button variant="outline" size="sm" asChild className="h-7 text-xs">
                                <a href={p.prof_registration_url} target="_blank" rel="noopener noreferrer">Ver Registro</a>
                              </Button>
                            )}
                          </div>
                        </TableCell>
                        <TableCell className="text-right">
                          <Button variant="ghost" size="sm" className="text-destructive hover:text-destructive" onClick={() => { setSelectedProfile(p); setRejectionModalOpen(true); }}><ThumbsDown className="h-4 w-4 mr-2" />Reprovar</Button>
                          <Button variant="ghost" size="sm" className="text-success hover:text-success" onClick={() => handleApprove(p.id)}><ThumbsUp className="h-4 w-4 mr-2" />Aprovar</Button>
                        </TableCell>
                      </TableRow>
                    )) : <TableRow><TableCell colSpan={3} className="h-32 text-center text-muted-foreground">Nenhuma solicitação pendente.</TableCell></TableRow>}
                  </TableBody>
                </Table>
              </div>
            </TabsContent>
            
            <TabsContent value="users">
              <div className="rounded-xl border bg-card overflow-hidden shadow-sm">
                <Table>
                  <TableHeader><TableRow><TableHead>Nome</TableHead><TableHead>Função</TableHead><TableHead>Plano</TableHead><TableHead>Status</TableHead></TableRow></TableHeader>
                  <TableBody>
                    {allUsers.map(u => (
                      <TableRow key={u.id}>
                        <TableCell>{u.full_name || 'Sem nome'}</TableCell>
                        <TableCell>{u.role}</TableCell>
                        <TableCell>{u.subscription_tier}</TableCell>
                        <TableCell>{u.is_verified ? <span className="text-success">Verificado</span> : 'Pendente'}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </TabsContent>

            <TabsContent value="plans">
                <div className="p-4 text-center text-muted-foreground">Gerenciamento de planos em breve.</div>
            </TabsContent>
          </Tabs>
        </div>
      </div>

      <Dialog open={rejectionModalOpen} onOpenChange={setRejectionModalOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Reprovar Verificação</DialogTitle>
            <DialogDescription>Descreva o motivo da reprovação.</DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <Label htmlFor="reason">Motivo da Reprovação</Label>
            <Textarea id="reason" value={rejectionReason} onChange={e => setRejectionReason(e.target.value)} placeholder="Ex: Documento de identidade ilegível." />
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setRejectionModalOpen(false)}>Cancelar</Button>
            <Button variant="destructive" onClick={handleReject} disabled={isProcessingVerification || !rejectionReason}>
              {isProcessingVerification ? <Loader2 className="h-4 w-4 animate-spin" /> : <XCircle className="h-4 w-4 mr-2" />}
              Confirmar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Layout>
  );
};

export default Admin;