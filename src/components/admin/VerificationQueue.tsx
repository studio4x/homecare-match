"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Loader2, Check, X, FileText, AlertTriangle, Inbox, User, Mail } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

interface VerificationRequest {
  id: string;
  full_name: string;
  email: string;
  id_document_url: string;
  prof_registration_url: string;
}

const VerificationQueue = () => {
  const queryClient = useQueryClient();
  const [rejectionModalOpen, setRejectionModalOpen] = useState(false);
  const [selectedUser, setSelectedUser] = useState<VerificationRequest | null>(null);
  const [rejectionReason, setRejectionReason] = useState("");

  const { data: requests, isLoading } = useQuery<VerificationRequest[]>({
    queryKey: ["verification-requests"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("id, full_name, email, id_document_url, prof_registration_url")
        .eq("verification_sent", true)
        .eq("is_verified", false);
      if (error) throw error;
      return data;
    },
  });

  const handleDecision = useMutation({
    mutationFn: async ({ userId, status, reason }: { userId: string; status: 'approved' | 'rejected'; reason?: string }) => {
      const { error: updateError } = await supabase
        .from("profiles")
        .update({
          is_verified: status === 'approved',
          verification_sent: false,
          rejection_reason: reason || null,
        })
        .eq("id", userId);
      if (updateError) throw updateError;

      const user = requests?.find(r => r.id === userId);
      if (user) {
        const { error: functionError } = await supabase.functions.invoke('verification-result', {
          body: {
            status,
            reason,
            userName: user.full_name,
            userEmail: user.email,
          }
        });
        if (functionError) {
          toast.warning("Status do usuário atualizado, mas falha ao enviar e-mail de notificação.");
        }
      }
    },
    onSuccess: () => {
      toast.success("Decisão processada com sucesso!");
      queryClient.invalidateQueries({ queryKey: ["verification-requests"] });
      setRejectionModalOpen(false);
      setSelectedUser(null);
      setRejectionReason("");
    },
    onError: (error: any) => {
      toast.error("Erro ao processar decisão.", { description: error.message });
    },
  });

  const openRejectionModal = (user: VerificationRequest) => {
    setSelectedUser(user);
    setRejectionModalOpen(true);
  };

  if (isLoading) {
    return <div className="flex justify-center items-center p-8"><Loader2 className="h-6 w-6 animate-spin" /></div>;
  }

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            Fila de Verificação
            <Badge variant="secondary">{requests?.length || 0} Pendente(s)</Badge>
          </CardTitle>
        </CardHeader>
        <CardContent>
          {requests && requests.length > 0 ? (
            <div className="space-y-4">
              {requests.map((req) => (
                <div key={req.id} className="flex flex-col md:flex-row md:items-center justify-between gap-4 p-4 border rounded-lg">
                  <div className="flex-1 space-y-1">
                    <p className="font-semibold flex items-center gap-2"><User className="h-4 w-4 text-muted-foreground" /> {req.full_name}</p>
                    <p className="text-sm text-muted-foreground flex items-center gap-2"><Mail className="h-4 w-4 text-muted-foreground" /> {req.email}</p>
                  </div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <Button variant="outline" size="sm" asChild>
                      <a href={req.id_document_url} target="_blank" rel="noopener noreferrer" className="gap-2">
                        <FileText className="h-4 w-4" /> Ver Identidade
                      </a>
                    </Button>
                    <Button variant="outline" size="sm" asChild>
                      <a href={req.prof_registration_url} target="_blank" rel="noopener noreferrer" className="gap-2">
                        <FileText className="h-4 w-4" /> Ver Registro
                      </a>
                    </Button>
                    <Button variant="destructive" size="sm" onClick={() => openRejectionModal(req)} className="gap-2">
                      <X className="h-4 w-4" /> Reprovar
                    </Button>
                    <Button 
                      variant="default" 
                      size="sm" 
                      className="bg-success hover:bg-success/90 gap-2"
                      onClick={() => handleDecision.mutate({ userId: req.id, status: 'approved' })}
                      disabled={handleDecision.isPending}
                    >
                      <Check className="h-4 w-4" /> Aprovar
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-12 text-muted-foreground">
              <Inbox className="h-12 w-12 mx-auto mb-4" />
              <p className="font-semibold">Nenhuma verificação pendente</p>
              <p className="text-sm">A fila de análise está vazia.</p>
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={rejectionModalOpen} onOpenChange={setRejectionModalOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2"><AlertTriangle /> Reprovar Verificação</DialogTitle>
            <DialogDescription>
              Você está reprovando a verificação de <strong>{selectedUser?.full_name}</strong>. Por favor, forneça um motivo claro para a reprovação. O usuário será notificado por e-mail.
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <Label htmlFor="rejection-reason">Motivo da Reprovação</Label>
            <Textarea
              id="rejection-reason"
              value={rejectionReason}
              onChange={(e) => setRejectionReason(e.target.value)}
              placeholder="Ex: Documento de identidade ilegível, registro profissional inválido..."
              className="min-h-[100px]"
            />
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setRejectionModalOpen(false)}>Cancelar</Button>
            <Button
              variant="destructive"
              onClick={() => selectedUser && handleDecision.mutate({ userId: selectedUser.id, status: 'rejected', reason: rejectionReason })}
              disabled={!rejectionReason || handleDecision.isPending}
            >
              {handleDecision.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : "Confirmar Reprovação"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
};

export default VerificationQueue;