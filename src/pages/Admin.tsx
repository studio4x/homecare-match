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
  Users, 
  ShieldCheck, 
  FileText,
  Loader2,
  AlertCircle
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

const Admin = () => {
  const { user, loading: authLoading } = useAuth();
  const [profiles, setProfiles] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);
  const [processingId, setProcessingId] = useState<string | null>(null);

  useEffect(() => {
    if (user) {
      checkAdminStatus();
    } else if (!authLoading) {
      setLoading(false);
    }
  }, [user, authLoading]);

  const checkAdminStatus = async () => {
    try {
      const { data, error } = await supabase
        .from("profiles")
        .select("is_admin")
        .eq("id", user?.id)
        .maybeSingle(); // Usando maybeSingle para não quebrar se não existir
      
      if (data?.is_admin) {
        setIsAdmin(true);
        await fetchPendingVerifications();
      } else {
        setLoading(false);
      }
    } catch (err) {
      console.error("Erro ao verificar admin:", err);
      setLoading(false);
    }
  };

  const fetchPendingVerifications = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from("profiles")
        .select("*")
        .eq("verification_sent", true)
        .eq("is_verified", false);

      if (error) {
        console.error(error);
        toast.error("Erro ao carregar solicitações.");
      } else {
        setProfiles(data || []);
      }
    } finally {
      setLoading(false);
    }
  };

  const handleApprove = async (profileId: string) => {
    setProcessingId(profileId);
    const { error } = await supabase
      .from("profiles")
      .update({ 
        is_verified: true, 
        verification_sent: false 
      })
      .eq("id", profileId);

    if (error) {
      toast.error("Erro ao aprovar profissional.");
    } else {
      toast.success("Profissional verificado com sucesso!");
      setProfiles(profiles.filter(p => p.id !== profileId));
    }
    setProcessingId(null);
  };

  const handleReject = async (profileId: string) => {
    setProcessingId(profileId);
    const { error } = await supabase
      .from("profiles")
      .update({ 
        verification_sent: false 
      })
      .eq("id", profileId);

    if (error) {
      toast.error("Erro ao rejeitar documentos.");
    } else {
      toast.info("Solicitação rejeitada. O profissional poderá enviar novamente.");
      setProfiles(profiles.filter(p => p.id !== profileId));
    }
    setProcessingId(null);
  };

  if (authLoading || loading) return (
    <Layout>
      <div className="flex h-96 items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <p className="text-sm text-muted-foreground">Verificando credenciais...</p>
        </div>
      </div>
    </Layout>
  );

  if (!isAdmin) return <Navigate to="/dashboard" replace />;

  return (
    <Layout>
      <div className="min-h-screen bg-secondary/20 py-8">
        <div className="container mx-auto px-4">
          <div className="mb-8 flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold flex items-center gap-3">
                <ShieldCheck className="h-8 w-8 text-primary" />
                Painel Administrativo
              </h1>
              <p className="mt-2 text-muted-foreground">
                Gestão de verificações e aprovação de profissionais.
              </p>
            </div>
            <Badge variant="outline" className="text-primary border-primary">
              Admin Ativo
            </Badge>
          </div>

          <div className="rounded-2xl border border-border bg-card shadow-card overflow-hidden">
            <div className="p-6 border-b border-border bg-muted/30">
              <h3 className="font-semibold flex items-center gap-2">
                <Users className="h-5 w-5 text-primary" />
                Solicitações Pendentes ({profiles.length})
              </h3>
            </div>

            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Profissional</TableHead>
                  <TableHead>Especialidade</TableHead>
                  <TableHead>Documentos</TableHead>
                  <TableHead className="text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {profiles.length > 0 ? (
                  profiles.map((profile) => (
                    <TableRow key={profile.id}>
                      <TableCell>
                        <div className="font-medium">{profile.full_name}</div>
                        <div className="text-xs text-muted-foreground">{profile.registration}</div>
                      </TableCell>
                      <TableCell>
                        <Badge variant="secondary" className="capitalize">
                          {profile.specialty}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <div className="flex gap-2">
                          <Button 
                            variant="ghost" 
                            size="sm" 
                            className="h-8 gap-1 text-xs" 
                            onClick={() => window.open(profile.id_document_url, '_blank')}
                          >
                            <FileText className="h-3 w-3" /> Identidade
                          </Button>
                          <Button 
                            variant="ghost" 
                            size="sm" 
                            className="h-8 gap-1 text-xs"
                            onClick={() => window.open(profile.prof_registration_url, '_blank')}
                          >
                            <ExternalLink className="h-3 w-3" /> Registro
                          </Button>
                        </div>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-2">
                          <Button 
                            variant="outline" 
                            size="sm" 
                            className="text-destructive hover:bg-destructive/10"
                            onClick={() => handleReject(profile.id)}
                            disabled={processingId === profile.id}
                          >
                            <XCircle className="h-4 w-4 mr-1" /> Rejeitar
                          </Button>
                          <Button 
                            size="sm" 
                            className="bg-success hover:bg-success/90"
                            onClick={() => handleApprove(profile.id)}
                            disabled={processingId === profile.id}
                          >
                            <CheckCircle className="h-4 w-4 mr-1" /> Aprovar
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                ) : (
                  <TableRow>
                    <TableCell colSpan={4} className="h-32 text-center text-muted-foreground">
                      <div className="flex flex-col items-center justify-center gap-2">
                        <CheckCircle className="h-8 w-8 text-muted/30" />
                        Nenhuma solicitação pendente no momento.
                      </div>
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
          
          <div className="mt-8 grid gap-6 md:grid-cols-3">
             <div className="rounded-xl border border-border bg-card p-6 flex items-start gap-4">
                <div className="bg-primary/10 p-3 rounded-lg">
                  <AlertCircle className="h-6 w-6 text-primary" />
                </div>
                <div>
                  <h4 className="font-semibold">Importante</h4>
                  <p className="text-sm text-muted-foreground mt-1">
                    Ao aprovar, o profissional recebe o selo de verificado e fica disponível na busca com maior destaque.
                  </p>
                </div>
             </div>
          </div>
        </div>
      </div>
    </Layout>
  );
};

export default Admin;