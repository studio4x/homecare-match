"use client";

import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import Layout from "@/components/layout/Layout";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { 
  CheckCircle, 
  XCircle, 
  ExternalLink, 
  ShieldCheck, 
  Loader2,
  MessageSquare,
  AlertTriangle
} from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/components/auth/AuthProvider";
import { Navigate } from "react-router-dom";
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
  DialogTitle,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";

const Admin = () => {
  const { user, loading: authLoading } = useAuth();
  const [profiles, setProfiles] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);
  const [processingId, setProcessingId] = useState<string | null>(null);
  
  // Estado para Reprovação
  const [rejectionModalOpen, setRejectionModalOpen] = useState(false);
  const [selectedProfile, setSelectedProfile] = useState<any>(null);
  const [rejectionReason, setRejectionReason] = useState("");

  useEffect(() => {
    if (!authLoading) {
      if (user) {
        checkAdminStatus();
      } else {
        setLoading(false);
      }
    }
  }, [user, authLoading]);

  const checkAdminStatus = async () => {
    try {
      const { data } = await supabase
        .from("profiles")
        .select("is_admin")
        .eq("id", user?.id)
        .maybeSingle();
      
      if (data?.is_admin) {
        setIsAdmin(true);
        await fetchPendingVerifications();
      }
    } catch (err) {
      console.error("Erro admin:", err);
    } finally {
      setLoading(false);
    }
  };

  const fetchPendingVerifications = async () => {
    try {
      const { data } = await supabase
        .from("profiles")
        .select("*")
        .eq("verification_sent", true)
        .eq("is_verified", false);

      setProfiles(data || []);
    } catch (e) {
      console.error(e);
    }
  };

  const handleApprove = async (profile: any) => {
    setProcessingId(profile.id);
    try {
      // 1. Atualiza no banco
      const { error } = await supabase
        .from("profiles")
        .update({ is_verified: true, verification_sent: false })
        .eq("id", profile.id);

      if (error) throw error;

      // 2. Chama a Edge Function para notificar (simulação de e-mail)
      await supabase.functions.invoke('verification-result', {
        body: { 
          profileId: profile.id, 
          status: 'approved',
          userName: profile.full_name
        }
      });

      toast.success("Profissional aprovado e notificado!");
      setProfiles(profiles.filter(p => p.id !== profile.id));
    } catch (error) {
      toast.error("Erro ao aprovar profissional.");
    } finally {
      setProcessingId(null);
    }
  };

  const openRejectionModal = (profile: any) => {
    setSelectedProfile(profile);
    setRejectionReason("");
    setRejectionModalOpen(true);
  };

  const confirmRejection = async () => {
    if (!rejectionReason.trim()) {
      toast.error("Por favor, insira o motivo da reprovação.");
      return;
    }

    setProcessingId(selectedProfile.id);
    try {
      // 1. Atualiza no banco (reseta o envio de verificação)
      const { error } = await supabase
        .from("profiles")
        .update({ verification_sent: false })
        .eq("id", selectedProfile.id);

      if (error) throw error;

      // 2. Chama a Edge Function para notificar com o motivo
      await supabase.functions.invoke('verification-result', {
        body: { 
          profileId: selectedProfile.id, 
          status: 'rejected',
          reason: rejectionReason,
          userName: selectedProfile.full_name
        }
      });

      toast.info("Solicitação reprovada e e-mail enviado.");
      setProfiles(profiles.filter(p => p.id !== selectedProfile.id));
      setRejectionModalOpen(false);
    } catch (error) {
      toast.error("Erro ao processar reprovação.");
    } finally {
      setProcessingId(null);
    }
  };

  if (authLoading || loading) return (
    <Layout>
      <div className="flex h-96 items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    </Layout>
  );

  if (!user || !isAdmin) return <Navigate to="/dashboard" replace />;

  return (
    <Layout>
      <div className="min-h-screen bg-secondary/20 py-8">
        <div className="container mx-auto px-4">
          <div className="mb-8 flex items-center justify-between">
            <h1 className="text-3xl font-bold flex items-center gap-3">
              <ShieldCheck className="h-8 w-8 text-primary" /> Painel Admin
            </h1>
            <Badge variant="outline" className="px-4 py-1">
              {profiles.length} Pendentes
            </Badge>
          </div>

          <div className="rounded-2xl border bg-card shadow-card overflow-hidden">
            <Table>
              <TableHeader className="bg-muted/50">
                <TableRow>
                  <TableHead className="w-[300px]">Profissional</TableHead>
                  <TableHead>Documentos Enviados</TableHead>
                  <TableHead className="text-right">Ações de Validação</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {profiles.length > 0 ? (
                  profiles.map((p) => (
                    <TableRow key={p.id} className="hover:bg-muted/20">
                      <TableCell>
                        <div className="font-semibold text-foreground">{p.full_name}</div>
                        <div className="text-xs text-muted-foreground uppercase tracking-wider font-medium">
                          {p.specialty}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex gap-2">
                          <Button 
                            variant="outline" 
                            size="sm" 
                            className="gap-2 h-8"
                            onClick={() => window.open(p.id_document_url, '_blank')}
                          >
                            <ExternalLink className="h-3 w-3" /> RG/CNH
                          </Button>
                          <Button 
                            variant="outline" 
                            size="sm" 
                            className="gap-2 h-8"
                            onClick={() => window.open(p.prof_registration_url, '_blank')}
                          >
                            <ExternalLink className="h-3 w-3" /> Registro
                          </Button>
                        </div>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-2">
                          <Button 
                            variant="ghost" 
                            size="sm" 
                            className="text-destructive hover:bg-destructive/10 gap-2"
                            onClick={() => openRejectionModal(p)}
                            disabled={!!processingId}
                          >
                            <XCircle className="h-4 w-4" /> Reprovar
                          </Button>
                          <Button 
                            size="sm" 
                            className="bg-success hover:bg-success/90 gap-2"
                            onClick={() => handleApprove(p)}
                            disabled={!!processingId}
                          >
                            {processingId === p.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle className="h-4 w-4" />}
                            Aprovar
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                ) : (
                  <TableRow>
                    <TableCell colSpan={3} className="text-center py-20">
                      <div className="flex flex-col items-center gap-2 text-muted-foreground">
                        <CheckCircle className="h-10 w-10 text-success/20" />
                        <p>Nenhuma solicitação de verificação pendente no momento.</p>
                      </div>
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </div>
      </div>

      {/* Modal de Reprovação */}
      <Dialog open={rejectionModalOpen} onOpenChange={setRejectionModalOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-destructive">
              <AlertTriangle className="h-5 w-5" /> Reprovar Verificação
            </DialogTitle>
            <DialogDescription>
              Explique ao profissional <strong>{selectedProfile?.full_name}</strong> por que os documentos foram rejeitados. Este texto será enviado por e-mail.
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <Textarea
              placeholder="Ex: A foto do RG está ilegível ou o registro profissional está vencido..."
              className="min-h-[120px] resize-none"
              value={rejectionReason}
              onChange={(e) => setRejectionReason(e.target.value)}
            />
          </div>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="ghost" onClick={() => setRejectionModalOpen(false)}>
              Cancelar
            </Button>
            <Button 
              variant="destructive" 
              onClick={confirmRejection}
              disabled={!!processingId || !rejectionReason.trim()}
              className="gap-2"
            >
              {processingId === selectedProfile?.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <XCircle className="h-4 w-4" />}
              Confirmar e Enviar E-mail
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Layout>
  );
};

export default Admin;