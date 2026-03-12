"use client";

import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
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
  Loader2,
  ThumbsUp,
  ThumbsDown,
  CheckCircle2,
  ExternalLink,
  Building2,
  Home,
  User
} from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";

interface VerificationsTabProps {
  pendingProfiles: any[];
  refetchData: () => void;
}

const VerificationsTab = ({ pendingProfiles, refetchData }: VerificationsTabProps) => {
  const [rejectionModalOpen, setRejectionModalOpen] = useState(false);
  const [approveModalOpen, setApproveModalOpen] = useState(false);
  const [selectedProfile, setSelectedProfile] = useState<any>(null);
  const [rejectionReason, setRejectionReason] = useState("");
  const [isProcessingVerification, setIsProcessingVerification] = useState(false);
  const [isGeneratingUrl, setIsGeneratingUrl] = useState<string | null>(null);

  const handleViewDocument = async (pathOrUrl: string, type: string) => {
    if (!pathOrUrl) return;
    
    setIsGeneratingUrl(type);
    try {
      let path = pathOrUrl;
      // Verifica se já é uma URL pública ou se precisa de signed URL
      if (pathOrUrl.startsWith('http')) {
        window.open(pathOrUrl, '_blank');
        return;
      }
      // Se for um path de storage, cria signed URL
      const { data, error } = await supabase.storage
        .from('documents')
        .createSignedUrl(path, 60); // URL válida por 60 segundos

      if (error) throw error;
      window.open(data.signedUrl, '_blank');
    } catch (err) {
      console.error(err);
      toast.error("Erro ao gerar link seguro.");
    } finally {
      setIsGeneratingUrl(null);
    }
  };

  const handleApprove = async () => {
    if (!selectedProfile) return;
    setIsProcessingVerification(true);
    try {
      const profileId = selectedProfile.id;
      const userToNotify = pendingProfiles.find(p => p.id === profileId);

      const { error } = await supabase.from("profiles").update({ 
        is_verified: true,
        rejection_reason: null
      }).eq("id", profileId);
      
      if (error) throw error;

      if (userToNotify) {
        const { data: authSession } = await supabase.auth.getSession();
        const accessToken = authSession?.session?.access_token || "";
        const { error: verificationNotifyError } = await supabase.functions.invoke('verification-result', {
          body: {
            status: 'approved',
            userName: userToNotify.full_name,
            userEmail: userToNotify.email,
            userId: userToNotify.id, // Pass userId for notification
            access_token: accessToken,
          }
        });
        if (verificationNotifyError) throw verificationNotifyError;
      }

      toast.success("Perfil aprovado com sucesso!");
      setApproveModalOpen(false);
      refetchData();
    } catch (err: any) {
      toast.error("Erro ao aprovar.");
      console.error(err);
    } finally {
      setIsProcessingVerification(false);
    }
  };

  const handleReject = async () => {
    if (!rejectionReason || !selectedProfile) return;
    setIsProcessingVerification(true);
    try {
      const { error } = await supabase.from("profiles").update({ 
        verification_sent: false,
        rejection_reason: rejectionReason 
      }).eq("id", selectedProfile.id);
      
      if (error) throw error;

      const { data: authSession } = await supabase.auth.getSession();
      const accessToken = authSession?.session?.access_token || "";
      const { error: verificationNotifyError } = await supabase.functions.invoke('verification-result', {
        body: {
          status: 'rejected',
          reason: rejectionReason,
          userName: selectedProfile.full_name,
          userEmail: selectedProfile.email,
          userId: selectedProfile.id, // Pass userId for notification
          access_token: accessToken,
        }
      });
      if (verificationNotifyError) throw verificationNotifyError;

      toast.success("Perfil reprovado.");
      setRejectionModalOpen(false);
      setRejectionReason("");
      refetchData();
    } catch (err: any) {
      toast.error("Erro ao reprovar.");
      console.error(err);
    } finally {
      setIsProcessingVerification(false);
    }
  };

  const getRoleBadge = (role: string) => {
    switch (role) {
      case 'company': return <Badge variant="secondary" className="gap-1"><Building2 className="h-3 w-3" /> Empresa</Badge>;
      case 'family': return <Badge variant="outline" className="gap-1"><Home className="h-3 w-3" /> Família</Badge>;
      default: return <Badge variant="secondary" className="gap-1"><User className="h-3 w-3" /> Profissional</Badge>;
    }
  };

  const getDocumentsForProfile = (profile: any) => {
    if (profile.role === "company") {
      return [
        { label: "Cartão CNPJ", path: profile.id_document_url, key: `id-${profile.id}` },
        { label: "ID Responsável", path: profile.prof_registration_url, key: `prof-${profile.id}` },
      ].filter((doc) => !!doc.path);
    }

    if (profile.role === "family") {
      return [
        { label: "ID Responsável", path: profile.id_document_url, key: `id-${profile.id}` },
        { label: "RG/CNH Paciente", path: profile.patient_document_url, key: `patient-id-${profile.id}` },
        { label: "Comprovante Endereço", path: profile.patient_address_proof_url, key: `patient-address-${profile.id}` },
      ].filter((doc) => !!doc.path);
    }

    return [
      { label: "RG/CNH", path: profile.id_document_url, key: `id-${profile.id}` },
      { label: "Registro Prof.", path: profile.prof_registration_url, key: `prof-${profile.id}` },
    ].filter((doc) => !!doc.path);
  };

  return (
    <>
      <div className="rounded-xl border bg-card overflow-x-auto shadow-sm">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Usuário</TableHead>
              <TableHead>Tipo</TableHead>
              <TableHead>Documentos</TableHead>
              {/* New column for CNPJ/ANS if it's a company */}
              <TableHead>Info Adicional</TableHead> 
              <TableHead className="text-right">Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {pendingProfiles.length > 0 ? pendingProfiles.map(p => {
              const documents = getDocumentsForProfile(p);
              const isCompany = p.role === 'company';
              return (
                <TableRow key={p.id}>
                  <TableCell>
                    <div className="font-medium">{p.full_name}</div>
                    <div className="text-xs text-muted-foreground">{p.email}</div>
                  </TableCell>
                  <TableCell>{getRoleBadge(p.role)}</TableCell>
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
                          {isGeneratingUrl === doc.key ? <Loader2 className="h-3 w-3 animate-spin" /> : <ExternalLink className="h-3 w-3" />}
                          {doc.label}
                        </Button>
                      ))}
                      {documents.length === 0 && <span className="text-xs text-muted-foreground">Nenhum documento</span>}
                    </div>
                  </TableCell>
                  {/* New TableCell for additional info */}
                  <TableCell>
                    {isCompany && (
                      <div className="space-y-0.5">
                        <p className="text-xs text-muted-foreground">CNPJ: <span className="font-medium text-foreground">{p.cnpj || 'N/A'}</span></p>
                        <p className="text-xs text-muted-foreground">ANS: <span className="font-medium text-foreground">{p.ans_registration || 'N/A'}</span></p>
                      </div>
                    )}
                    {!isCompany && <span className="text-xs text-muted-foreground">-</span>}
                  </TableCell>
                  <TableCell className="text-right">
                    <Button variant="ghost" size="sm" className="text-destructive" onClick={() => { setSelectedProfile(p); setRejectionModalOpen(true); }}><ThumbsDown className="h-4 w-4 mr-1" />Reprovar</Button>
                    <Button variant="ghost" size="sm" className="text-success" onClick={() => { setSelectedProfile(p); setApproveModalOpen(true); }}><ThumbsUp className="h-4 w-4 mr-1" />Aprovar</Button>
                  </TableCell>
                </TableRow>
              );
            }) : (
              <TableRow>
                <TableCell colSpan={5} className="h-32 text-center text-muted-foreground">
                  Nenhuma solicitação pendente.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
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

      <Dialog open={approveModalOpen} onOpenChange={setApproveModalOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Confirmar Aprovação</DialogTitle>
            <DialogDescription>
              Tem certeza que deseja aprovar a documentação de <strong>{selectedProfile?.full_name}</strong>?
              <br/><br/>
              Isso concederá o selo de verificado ao perfil e enviará um e-mail de notificação.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setApproveModalOpen(false)}>Cancelar</Button>
            <Button className="bg-success hover:bg-success/90" onClick={handleApprove} disabled={isProcessingVerification}>
              {isProcessingVerification ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <CheckCircle2 className="h-4 w-4 mr-2" />}
              Confirmar Aprovação
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
};

export default VerificationsTab;
