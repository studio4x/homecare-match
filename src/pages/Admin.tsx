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
      const { data, error } = await supabase
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
      const { data, error } = await supabase
        .from("profiles")
        .select("*")
        .eq("verification_sent", true)
        .eq("is_verified", false);

      if (!error) setProfiles(data || []);
    } catch (e) {
      console.error(e);
    }
  };

  const handleApprove = async (profileId: string) => {
    setProcessingId(profileId);
    const { error } = await supabase
      .from("profiles")
      .update({ is_verified: true, verification_sent: false })
      .eq("id", profileId);

    if (!error) {
      toast.success("Profissional aprovado!");
      setProfiles(profiles.filter(p => p.id !== profileId));
    }
    setProcessingId(null);
  };

  const handleReject = async (profileId: string) => {
    setProcessingId(profileId);
    const { error } = await supabase
      .from("profiles")
      .update({ verification_sent: false })
      .eq("id", profileId);

    if (!error) {
      toast.info("Solicitação rejeitada.");
      setProfiles(profiles.filter(p => p.id !== profileId));
    }
    setProcessingId(null);
  };

  if (authLoading || loading) return (
    <Layout>
      <div className="flex h-96 items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    </Layout>
  );

  if (!user) return <Navigate to="/login" replace />;
  if (!isAdmin) return <Navigate to="/dashboard" replace />;

  return (
    <Layout>
      <div className="min-h-screen bg-secondary/20 py-8">
        <div className="container mx-auto px-4">
          <h1 className="text-3xl font-bold flex items-center gap-3 mb-8">
            <ShieldCheck className="h-8 w-8 text-primary" /> Painel Admin
          </h1>

          <div className="rounded-2xl border bg-card shadow-card overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Profissional</TableHead>
                  <TableHead>Documentos</TableHead>
                  <TableHead className="text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {profiles.length > 0 ? (
                  profiles.map((p) => (
                    <TableRow key={p.id}>
                      <TableCell>
                        <div className="font-medium">{p.full_name}</div>
                        <div className="text-xs text-muted-foreground">{p.specialty}</div>
                      </TableCell>
                      <TableCell>
                        <div className="flex gap-2">
                          <Button variant="ghost" size="sm" onClick={() => window.open(p.id_document_url, '_blank')}>Doc</Button>
                          <Button variant="ghost" size="sm" onClick={() => window.open(p.prof_registration_url, '_blank')}>Coren</Button>
                        </div>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-2">
                          <Button variant="outline" size="sm" onClick={() => handleReject(p.id)} disabled={!!processingId}>X</Button>
                          <Button size="sm" className="bg-success" onClick={() => handleApprove(p.id)} disabled={!!processingId}>OK</Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                ) : (
                  <TableRow><TableCell colSpan={3} className="text-center py-8">Nenhuma solicitação pendente.</TableCell></TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </div>
      </div>
    </Layout>
  );
};

export default Admin;