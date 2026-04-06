"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import VerificationsTab from "@/components/admin/VerificationsTab";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Loader2, ExternalLink } from "lucide-react";
import { toast } from "sonner";
import { sanitizeStoragePath } from "@/lib/storage-path";

const formatDateTime = (value?: string | null) => {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return date.toLocaleString("pt-BR");
};

const getRoleLabel = (role?: string) => {
  if (role === "company") return "Empresa";
  if (role === "family") return "Familia";
  return "Profissional";
};

const getDocumentsForProfile = (profile: any) => {
  if (profile.role === "company") {
    return [
      { label: "Cartao CNPJ", path: profile.id_document_url, key: `id-${profile.id}` },
      { label: "ID Responsavel", path: profile.prof_registration_url, key: `prof-${profile.id}` },
    ].filter((doc) => !!doc.path);
  }

  if (profile.role === "family") {
    return [
      { label: "ID Responsavel", path: profile.id_document_url, key: `id-${profile.id}` },
      { label: "RG/CNH Paciente", path: profile.patient_document_url, key: `patient-id-${profile.id}` },
      { label: "Comp. Endereco", path: profile.patient_address_proof_url, key: `patient-address-${profile.id}` },
    ].filter((doc) => !!doc.path);
  }

  return [
    { label: "RG/CNH", path: profile.id_document_url, key: `id-${profile.id}` },
    { label: "Registro", path: profile.prof_registration_url, key: `prof-${profile.id}` },
  ].filter((doc) => !!doc.path);
};

type VerificationHistoryTableProps = {
  profiles: any[];
  mode: "approved" | "rejected";
};

const VerificationHistoryTable = ({ profiles, mode }: VerificationHistoryTableProps) => {
  const [isGeneratingUrl, setIsGeneratingUrl] = useState<string | null>(null);

  const handleViewDocument = async (pathOrUrl: string, type: string) => {
    if (!pathOrUrl) return;

    setIsGeneratingUrl(type);
    try {
      if (pathOrUrl.startsWith("http")) {
        window.open(pathOrUrl, "_blank");
        return;
      }

      const path = sanitizeStoragePath(pathOrUrl, { bucket: "documents" });
      const { data, error } = await supabase.storage
        .from("documents")
        .createSignedUrl(path, 60);

      if (error) throw error;
      window.open(data.signedUrl, "_blank");
    } catch (error) {
      console.error(error);
      toast.error("Erro ao gerar link seguro.");
    } finally {
      setIsGeneratingUrl(null);
    }
  };

  if (profiles.length === 0) {
    return (
      <div className="rounded-xl border bg-card p-8 text-center text-muted-foreground">
        {mode === "approved"
          ? "Nenhuma verificacao aprovada encontrada."
          : "Nenhuma verificacao reprovada encontrada."}
      </div>
    );
  }

  return (
    <div className="rounded-xl border bg-card overflow-x-auto shadow-sm">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Usuario</TableHead>
            <TableHead>Tipo</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>Documentos</TableHead>
            {mode === "rejected" ? <TableHead>Motivo</TableHead> : null}
            <TableHead className="text-right">Atualizado em</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {profiles.map((profile) => {
            const documents = getDocumentsForProfile(profile);
            return (
              <TableRow key={profile.id}>
                <TableCell>
                  <div className="font-medium">{profile.full_name}</div>
                  <div className="text-xs text-muted-foreground">{profile.email}</div>
                </TableCell>
                <TableCell>{getRoleLabel(profile.role)}</TableCell>
                <TableCell>
                  <Badge variant={mode === "approved" ? "success" : "destructive"}>
                    {mode === "approved" ? "Aprovada" : "Reprovada"}
                  </Badge>
                </TableCell>
                <TableCell>
                  <div className="flex flex-wrap gap-2">
                    {documents.map((doc) => (
                      <Button
                        key={doc.key}
                        variant="outline"
                        size="sm"
                        className="h-7 text-xs gap-1.5"
                        onClick={() => handleViewDocument(doc.path, doc.key)}
                        disabled={isGeneratingUrl === doc.key}
                      >
                        {isGeneratingUrl === doc.key ? (
                          <Loader2 className="h-3 w-3 animate-spin" />
                        ) : (
                          <ExternalLink className="h-3 w-3" />
                        )}
                        {doc.label}
                      </Button>
                    ))}
                    {documents.length === 0 ? (
                      <span className="text-xs text-muted-foreground">Nenhum documento</span>
                    ) : null}
                  </div>
                </TableCell>
                {mode === "rejected" ? (
                  <TableCell className="max-w-xl">
                    <p className="text-sm text-muted-foreground line-clamp-3">
                      {profile.rejection_reason || "-"}
                    </p>
                  </TableCell>
                ) : null}
                <TableCell className="text-right text-sm text-muted-foreground">
                  {formatDateTime(profile.updated_at)}
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
};

const VerificationsPage = () => {
  const [pendingProfiles, setPendingProfiles] = useState<any[]>([]);
  const [approvedProfiles, setApprovedProfiles] = useState<any[]>([]);
  const [rejectedProfiles, setRejectedProfiles] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [pendingResponse, approvedResponse, rejectedResponse] = await Promise.all([
        supabase
          .from("profiles")
          .select("*")
          .eq("verification_sent", true)
          .eq("is_verified", false)
          .order("updated_at", { ascending: false }),
        supabase
          .from("profiles")
          .select("*")
          .eq("is_verified", true)
          .order("updated_at", { ascending: false }),
        supabase
          .from("profiles")
          .select("*")
          .eq("is_verified", false)
          .not("rejection_reason", "is", null)
          .order("updated_at", { ascending: false }),
      ]);

      if (!pendingResponse.error) {
        setPendingProfiles(pendingResponse.data || []);
      }

      if (!approvedResponse.error) {
        setApprovedProfiles(approvedResponse.data || []);
      }

      if (!rejectedResponse.error) {
        setRejectedProfiles(
          (rejectedResponse.data || []).filter((profile) => String(profile.rejection_reason || "").trim() !== ""),
        );
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();

    const channel = supabase
      .channel("verifications-admin-history-updates")
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "profiles",
        },
        () => {
          fetchData();
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  if (loading) {
    return (
      <div className="flex justify-center p-8">
        <Loader2 className="animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Central de Verificacoes</h1>
        <p className="text-muted-foreground">
          Acompanhe solicitacoes pendentes e o historico de aprovacoes e reprovacoes.
        </p>
      </div>

      <Tabs defaultValue="pending" className="space-y-6">
        <TabsList className="flex h-auto w-full flex-wrap justify-start gap-2 bg-transparent p-0">
          <TabsTrigger value="pending">
            Pendentes
            <Badge variant="secondary" className="ml-2">{pendingProfiles.length}</Badge>
          </TabsTrigger>
          <TabsTrigger value="approved">
            Aprovadas
            <Badge variant="secondary" className="ml-2">{approvedProfiles.length}</Badge>
          </TabsTrigger>
          <TabsTrigger value="rejected">
            Reprovadas
            <Badge variant="secondary" className="ml-2">{rejectedProfiles.length}</Badge>
          </TabsTrigger>
        </TabsList>

        <TabsContent value="pending" className="space-y-6">
          <VerificationsTab pendingProfiles={pendingProfiles} refetchData={fetchData} />
        </TabsContent>

        <TabsContent value="approved" className="space-y-6">
          <VerificationHistoryTable profiles={approvedProfiles} mode="approved" />
        </TabsContent>

        <TabsContent value="rejected" className="space-y-6">
          <VerificationHistoryTable profiles={rejectedProfiles} mode="rejected" />
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default VerificationsPage;
