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
import { sanitizeStoragePath } from "@/lib/storage-path";

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
  const [profileModalOpen, setProfileModalOpen] = useState(false);
  const [selectedProfileForView, setSelectedProfileForView] = useState<any>(null);

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
      path = sanitizeStoragePath(path, { bucket: "documents" });
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
        if (verificationNotifyError) {
          console.warn("[VerificationsTab] Falha ao notificar aprovação:", verificationNotifyError);
          toast.warning("Perfil aprovado, mas houve falha no envio das notificações.");
        }
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
      if (verificationNotifyError) {
        console.warn("[VerificationsTab] Falha ao notificar reprovação:", verificationNotifyError);
        toast.warning("Perfil reprovado, mas houve falha no envio das notificações.");
      }

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
              <TableHead className="text-right">Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {pendingProfiles.length > 0 ? pendingProfiles.map(p => {
              const documents = getDocumentsForProfile(p);
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
                  <TableCell className="text-right whitespace-nowrap">
                    <Button variant="ghost" size="sm" onClick={() => { setSelectedProfileForView(p); setProfileModalOpen(true); }}><User className="h-4 w-4 mr-1" />Ver Perfil</Button>
                    <Button variant="ghost" size="sm" className="text-destructive" onClick={() => { setSelectedProfile(p); setRejectionModalOpen(true); }}><ThumbsDown className="h-4 w-4 mr-1" />Reprovar</Button>
                    <Button variant="ghost" size="sm" className="text-success" onClick={() => { setSelectedProfile(p); setApproveModalOpen(true); }}><ThumbsUp className="h-4 w-4 mr-1" />Aprovar</Button>
                  </TableCell>
                </TableRow>
              );
            }) : (
              <TableRow>
                <TableCell colSpan={4} className="h-32 text-center text-muted-foreground">
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
      <Dialog open={profileModalOpen} onOpenChange={setProfileModalOpen}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-xl">Dados Completos do Perfil</DialogTitle>
            <DialogDescription>
              Visualize abaixo todas as informações fornecidas pelo profissional para análise.
            </DialogDescription>
          </DialogHeader>
          
          {selectedProfileForView && (
            <div className="mt-6 space-y-8 pb-4">
              <section className="space-y-4">
                <h3 className="text-sm font-bold uppercase tracking-wider text-muted-foreground border-b pb-2">Informações Pessoais</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  <div className="space-y-1">
                    <span className="text-[10px] font-bold text-primary uppercase">Nome Completo</span>
                    <p className="text-sm border-l-2 border-primary/20 pl-3 py-1 bg-muted/20 rounded-r-md min-h-[2.5rem] flex items-center">
                      {selectedProfileForView.full_name || "-"}
                    </p>
                  </div>
                  <div className="space-y-1">
                    <span className="text-[10px] font-bold text-primary uppercase">E-mail</span>
                    <p className="text-sm border-l-2 border-primary/20 pl-3 py-1 bg-muted/20 rounded-r-md min-h-[2.5rem] flex items-center">
                      {selectedProfileForView.email || "-"}
                    </p>
                  </div>
                  <div className="space-y-1">
                    <span className="text-[10px] font-bold text-primary uppercase">WhatsApp</span>
                    <p className="text-sm border-l-2 border-primary/20 pl-3 py-1 bg-muted/20 rounded-r-md min-h-[2.5rem] flex items-center">
                      {selectedProfileForView.phone || "-"}
                    </p>
                  </div>
                  <div className="space-y-1">
                    <span className="text-[10px] font-bold text-primary uppercase">CPF / CNPJ</span>
                    <p className="text-sm border-l-2 border-primary/20 pl-3 py-1 bg-muted/20 rounded-r-md min-h-[2.5rem] flex items-center">
                      {selectedProfileForView.cpf || selectedProfileForView.cnpj || "-"}
                    </p>
                  </div>
                  <div className="space-y-1">
                    <span className="text-[10px] font-bold text-primary uppercase">Data de Nascimento</span>
                    <p className="text-sm border-l-2 border-primary/20 pl-3 py-1 bg-muted/20 rounded-r-md min-h-[2.5rem] flex items-center">
                      {selectedProfileForView.birth_date ? new Date(selectedProfileForView.birth_date).toLocaleDateString("pt-BR", { timeZone: "UTC" }) : "-"}
                    </p>
                  </div>
                  <div className="space-y-1">
                    <span className="text-[10px] font-bold text-primary uppercase">Especialidade</span>
                    <p className="text-sm border-l-2 border-primary/20 pl-3 py-1 bg-muted/20 rounded-r-md min-h-[2.5rem] flex items-center capitalize">
                      {selectedProfileForView.specialty?.replace("-", " ") || "-"}
                    </p>
                  </div>
                </div>
              </section>

              <section className="space-y-4">
                <h3 className="text-sm font-bold uppercase tracking-wider text-muted-foreground border-b pb-2">Localização</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-1">
                    <span className="text-[10px] font-bold text-primary uppercase">CEP</span>
                    <p className="text-sm border-l-2 border-primary/20 pl-3 py-1 bg-muted/20 rounded-r-md min-h-[2.5rem] flex items-center">
                      {selectedProfileForView.address_zip || "-"}
                    </p>
                  </div>
                  <div className="space-y-1">
                    <span className="text-[10px] font-bold text-primary uppercase">Cidade / UF</span>
                    <p className="text-sm border-l-2 border-primary/20 pl-3 py-1 bg-muted/20 rounded-r-md min-h-[2.5rem] flex items-center">
                      {selectedProfileForView.city} - {selectedProfileForView.state}
                    </p>
                  </div>
                  <div className="md:col-span-2 space-y-1">
                    <span className="text-[10px] font-bold text-primary uppercase">Logradouro</span>
                    <p className="text-sm border-l-2 border-primary/20 pl-3 py-1 bg-muted/20 rounded-r-md min-h-[2.5rem] flex items-center">
                      {selectedProfileForView.address_street}, {selectedProfileForView.address_number} 
                      {selectedProfileForView.address_complement ? ` (${selectedProfileForView.address_complement})` : ""} - {selectedProfileForView.neighborhood}
                    </p>
                  </div>
                </div>
              </section>

              <section className="space-y-4">
                <h3 className="text-sm font-bold uppercase tracking-wider text-muted-foreground border-b pb-2">Currículo e Dados Profissionais</h3>
                <div className="space-y-6">
                  <div className="space-y-1">
                    <span className="text-[10px] font-bold text-primary uppercase">Formações</span>
                    <div className="text-sm bg-muted/20 p-4 rounded-md whitespace-pre-wrap border border-dashed border-primary/10">
                      {selectedProfileForView.experience || "Nenhuma formação informada."}
                    </div>
                  </div>
                  <div className="space-y-1">
                    <span className="text-[10px] font-bold text-primary uppercase">Experiências Anteriores</span>
                    <div className="text-sm bg-muted/20 p-4 rounded-md whitespace-pre-wrap border border-dashed border-primary/10">
                      {selectedProfileForView.professional_experiences || "Nenhuma experiência profissional informada."}
                    </div>
                  </div>
                  <div className="space-y-1">
                    <span className="text-[10px] font-bold text-primary uppercase">Biografia / Sobre</span>
                    <div className="text-sm bg-muted/20 p-4 rounded-md whitespace-pre-wrap border border-dashed border-primary/10 italic">
                      {selectedProfileForView.bio || "Nenhuma biografia disponível."}
                    </div>
                  </div>
                </div>
              </section>

              <section className="space-y-4">
                <h3 className="text-sm font-bold uppercase tracking-wider text-muted-foreground border-b pb-2">Preferências de Atendimento</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-1">
                    <span className="text-[10px] font-bold text-primary uppercase">Valor/Hora</span>
                    <p className="text-sm border-l-2 border-primary/20 pl-3 py-1 bg-muted/20 rounded-r-md min-h-[2.5rem] flex items-center font-semibold">
                      {selectedProfileForView.hourly_rate ? `R$ ${selectedProfileForView.hourly_rate}` : "Não informado"}
                    </p>
                  </div>
                  <div className="space-y-1">
                    <span className="text-[10px] font-bold text-primary uppercase">Disponibilidade</span>
                    <div className="flex flex-wrap gap-2 pt-1">
                      {selectedProfileForView.availability?.map((item: string) => (
                        <Badge key={item} variant="outline" className="text-[10px] border-primary/30 text-primary">{item}</Badge>
                      )) || <span className="text-xs text-muted-foreground italic">Não informado</span>}
                    </div>
                  </div>
                  <div className="md:col-span-2 space-y-1">
                    <span className="text-[10px] font-bold text-primary uppercase">Públicos Atendidos</span>
                    <div className="flex flex-wrap gap-2 pt-1">
                      {selectedProfileForView.patient_profiles?.map((item: string) => (
                        <Badge key={item} variant="outline" className="text-[10px] border-secondary/30 text-secondary-foreground bg-secondary/10">{item}</Badge>
                      )) || <span className="text-xs text-muted-foreground italic">Não informado</span>}
                    </div>
                  </div>
                </div>
              </section>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
};

export default VerificationsTab;
