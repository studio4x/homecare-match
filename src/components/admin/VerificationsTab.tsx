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
  ExternalLink
} from "lucide-react";
import { toast } from "sonner";

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
      // Se for uma URL antiga (pública), abrimos direto. 
      // Se for apenas o caminho (novo padrão), geramos a URL assinada.
      let path = pathOrUrl;
      if (pathOrUrl.includes('storage/v1/object/public/')) {
        path = pathOrUrl.split('documents/')[1];
      }

      const { data, error } = await supabase.storage
        .from('documents')
        .createSignedUrl(path, 60); // Expira em 60 segundos

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
        await supabase.functions.invoke('verification-result', {
          body: {
            status: 'approved',
            userName: userToNotify.full_name,
            userEmail: userToNotify.email
          }
        });
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

      await supabase.functions.invoke('verification-result', {
        body: {
          status: 'rejected',
          reason: rejectionReason,
          userName: selectedProfile.full_name,
          userEmail: selectedProfile.email
        }
      });

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

  return (
    <>
      <div className="rounded-xl border bg-card overflow-x-auto shadow-sm">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Profissional</TableHead>
              <TableHead>Documentos</TableHead>
              <TableHead className="text-right">Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {pendingProfiles.length > 0 ? pendingProfiles.map(p => (
              <TableRow key={p.id}>
                <TableCell>
                  <div className="font-medium">{p.full_name}</div>
                  <div className="text-xs text-muted-foreground">{p.email}</div>
                </TableCell>
                <TableCell>
                  <div className="flex flex-wrap gap-2">
                    {p.id_document_url && (
                      <Button 
                        variant="outline" 
                        size="sm" 
                        className="h-7 text-xs gap-1.5"
                        onClick={() => handleViewDocument(p.id_document_url, `id-${p.id}`)}
                        disabled={isGeneratingUrl === `id-${p.id}`}
                      >
                        {isGeneratingUrl === `id-${p.id}` ? <Loader2 className="h-3 w-3 animate-spin" /> : <ExternalLink className="h-3 w-3" />}
                        RG/CNH
                      </Button>
                    )}
                    {p.prof_registration_url && (
                      <Button 
                        variant="outline" 
                        size="sm" 
                        className="h-7 text-xs gap-1.5"
                        onClick={() => handleViewDocument(p.prof_registration_url, `prof-${p.id}`)}
                        disabled={isGeneratingUrl === `prof-${p.id}`}
                      >
                        {isGeneratingUrl === `prof-${p.id}` ? <Loader2 className="h-3 w-3 animate-spin" /> : <ExternalLink className="h-3 w-3" />}
                        Registro
                      </Button>
                    )}
                  </div>
                </TableCell>
                <TableCell className="text-right">
                  <Button variant="ghost" size="sm" className="text-destructive" onClick={() => { setSelectedProfile(p); setRejectionModalOpen(true); }}><ThumbsDown className="h-4 w-4 mr-1" />Reprovar</Button>
                  <Button variant="ghost" size="sm" className="text-success" onClick={() => { setSelectedProfile(p); setApproveModalOpen(true); }}><ThumbsUp className="h-4 w-4 mr-1" />Aprovar</Button>
                </TableCell>
              </TableRow>
            )) : <TableRow><TableCell colSpan={3} className="h-32 text-center text-muted-foreground">Nenhuma solicitação pendente.</TableCell></TableRow>}
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