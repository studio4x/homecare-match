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
  const [adminExists, setAdminExists] = useState(true);
  
  const [pendingProfiles, setPendingProfiles] = useState<any[]>([]);
  const [allUsers, setAllUsers] = useState<any[]>([]);
  const [plans, setPlans] = useState<any[]>([]);
  
  const [rejectionModalOpen, setRejectionModalOpen] = useState(false);
  const [selectedProfile, setSelectedProfile] = useState<any>(null);
  const [rejectionReason, setRejectionReason] = useState("");
  const [isProcessingVerification, setIsProcessingVerification] = useState(false);

  useEffect(() => {
    checkGlobalAdminStatus();
  }, []);

  useEffect(() => {
    if (!authLoading) {
      if (user) {
        checkCurrentUserAdminStatus();
      } else {
        setLoading(false);
      }
    }
  }, [user, authLoading]);

  const checkGlobalAdminStatus = async () => {
    try {
      const { data, error } = await supabase.rpc('any_admin_exists');
      if (!error && data !== null) {
        setAdminExists(data);
      }
    } catch (e) {
      console.error("[Admin] Erro:", e);
    }
  };

  const checkCurrentUserAdminStatus = async () => {
    if (!user) {
      setLoading(false);
      return;
    }
    
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from("profiles")
        .select("is_admin, role")
        .eq("id", user.id)
        .maybeSingle();
      
      if (data && (data.is_admin || data.role === 'admin')) {
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
    try {
      const [pending, users, plansData] = await Promise.all([
        supabase.from("profiles").select("*").eq("verification_sent", true).eq("is_verified", false),
        supabase.from("profiles").select("*").order('updated_at', { ascending: false }),
        supabase.from("plans").select("*").order('price', { ascending: true })
      ]);
      
      setPendingProfiles(pending.data || []);
      setAllUsers(users.data || []);
      setPlans(plansData.data || []);
    } catch (error) {
      console.error("[Admin] Erro:", error);
    }
  };

  const handleApprove = async (profileId: string) => {
    setIsProcessingVerification(true);
    const { error } = await supabase.from("profiles").update({ is_verified: true }).eq("id", profileId);
    if (!error) {
      toast.success("Perfil aprovado!");
      await notifyVerificationResult(profileId, 'approved');
      fetchData();
    }
    setIsProcessingVerification(false);
  };

  const handleReject = async () => {
    if (!rejectionReason) return;
    setIsProcessingVerification(true);
    const { error } = await supabase.from("profiles").update({ verification_sent: false }).eq("id", selectedProfile.id);
    if (!error) {
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
    if (!profileToNotify?.email) {
      console.error("[Admin] E-mail do usuário não encontrado para notificação.");
      return;
    }

    try {
      await supabase.functions.invoke('verification-result', {
        body: {
          profileId,
          status,
          reason,
          userName: profileToNotify.full_name,
          userEmail: profileToNotify.email
        }
      });
    } catch (e) {
      console.error("[Admin] Erro ao enviar e-mail:", e);
    }
  };

  if (authLoading || loading) {
    return <Layout><div className="flex h-96 items-center justify-center"><Loader2 className="h-8 w-8 animate-spin" /></div></Layout>;
  }
  
  if (!session) return <Layout><div className="flex min-h-[calc(100vh-16rem)] items-center justify-center py-12 px-4 bg-secondary/20"><div className="w-full max-w-md p-8 bg-card border rounded-2xl shadow-card text-center"><Lock className="mx-auto h-12 w-12 text-primary" /><h2 className="mt-6 text-3xl font-bold">Painel de Gestão</h2><AuthForm mode={adminExists ? "login" : "register"} allowRegister={!adminExists} /></div></div></Layout>;

  return (
    <Layout>
      <div className="min-h-screen bg-secondary/20 py-8">
        <div className="container mx-auto px-4">
          <div className="mb-8 flex items-center justify-between">
            <h1 className="text-3xl font-bold flex items-center gap-3"><ShieldCheck className="h-8 w-8 text-primary" /> Painel Admin</h1>
            <Button variant="ghost" onClick={signOut} className="gap-2 hover:text-destructive"><LogOut className="h-4 w-4" /> Sair</Button>
          </div>

          <Tabs defaultValue="verifications" className="space-y-6">
            <TabsList className="bg-card border">
              <TabsTrigger value="verifications">Verificações ({pendingProfiles.length})</TabsTrigger>
              <TabsTrigger value="users">Usuários ({allUsers.length})</TabsTrigger>
            </TabsList>

            <TabsContent value="verifications">
              <div className="rounded-xl border bg-card overflow-hidden shadow-sm">
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
                          <div className="flex gap-2">
                            {p.id_document_url && <Button variant="outline" size="sm" asChild className="h-7 text-xs"><a href={p.id_document_url} target="_blank">RG/CNH</a></Button>}
                            {p.prof_registration_url && <Button variant="outline" size="sm" asChild className="h-7 text-xs"><a href={p.prof_registration_url} target="_blank">Registro</a></Button>}
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
              <div className="rounded-xl border bg-card overflow-hidden shadow-sm">
                <Table>
                  <TableHeader><TableRow><TableHead>Nome</TableHead><TableHead>E-mail</TableHead><TableHead>Função</TableHead></TableRow></TableHeader>
                  <TableBody>
                    {allUsers.map(u => (
                      <TableRow key={u.id}><TableCell>{u.full_name}</TableCell><TableCell>{u.email}</TableCell><TableCell>{u.role}</TableCell></TableRow>
                    ))}
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
    </Layout>
  );
};

export default Admin;