"use client";

import React, { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { AlertTriangle, Loader2, Send, ShieldAlert } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/components/auth/AuthProvider";
import { toast } from "sonner";

interface ReportModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  reportedId: string;
  reportedName: string;
}

const REPORT_REASONS = [
  { value: "fake_profile", label: "Perfil Falso / Spam" },
  { value: "inappropriate_behavior", label: "Comportamento Inadequado" },
  { value: "incorrect_info", label: "Informações Incorretas / Falsas" },
  { value: "scam_fraud", label: "Golpe / Fraude" },
  { value: "harassment", label: "Assédio ou Ofensa" },
  { value: "other", label: "Outros" },
];

const ReportModal = ({ open, onOpenChange, reportedId, reportedName }: ReportModalProps) => {
  const { user } = useAuth();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [reason, setReason] = useState("");
  const [description, setDescription] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) {
      toast.error("Você precisa estar logado para denunciar.");
      return;
    }

    if (!reason) {
      toast.error("Selecione um motivo.");
      return;
    }

    setIsSubmitting(true);
    try {
      const { data, error } = await supabase
        .from("reports")
        .insert({
          reporter_id: user.id,
          reported_id: reportedId,
          reason: REPORT_REASONS.find(r => r.value === reason)?.label || reason,
          description: description.trim(),
        })
        .select()
        .single();

      if (error) throw error;

      // Notificar Admin
      const { error: notifyError } = await supabase.functions.invoke('notify-report', {
        body: { reportId: data.id }
      });
      if (notifyError) {
        console.warn("Falha ao notificar admin sobre denúncia:", notifyError);
        toast.warning("Denúncia registrada, mas houve falha no envio da notificação para o admin.");
      }

      toast.success("Denúncia enviada com sucesso.", {
        description: "Nossa equipe analisará o perfil em até 24 horas."
      });
      
      onOpenChange(false);
      setReason("");
      setDescription("");
    } catch (err) {
      toast.error("Erro ao enviar denúncia.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[450px]">
        <DialogHeader>
          <div className="mx-auto h-12 w-12 rounded-full bg-destructive/10 flex items-center justify-center mb-2">
            <AlertTriangle className="h-6 w-6 text-destructive" />
          </div>
          <DialogTitle className="text-center">Denunciar Perfil</DialogTitle>
          <DialogDescription className="text-center">
            Você está denunciando o perfil de <strong>{reportedName}</strong>. 
            Sua identidade será mantida em sigilo.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 py-4">
          <div className="space-y-2">
            <Label>Motivo da Denúncia</Label>
            <Select value={reason} onValueChange={setReason}>
              <SelectTrigger>
                <SelectValue placeholder="Selecione o motivo principal" />
              </SelectTrigger>
              <SelectContent>
                {REPORT_REASONS.map((r) => (
                  <SelectItem key={r.value} value={r.value}>{r.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Detalhes Adicionais (Opcional)</Label>
            <Textarea 
              placeholder="Descreva o que aconteceu para nos ajudar na análise..." 
              className="resize-none"
              rows={4}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </div>

          <div className="bg-secondary/30 p-3 rounded-lg flex gap-3 items-start border border-border/50">
            <ShieldAlert className="h-5 w-5 text-primary shrink-0 mt-0.5" />
            <p className="text-[10px] text-muted-foreground leading-relaxed">
              Denúncias falsas ou abusivas podem resultar na suspensão da sua própria conta. 
              Use este recurso com responsabilidade.
            </p>
          </div>

          <DialogFooter className="pt-4">
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>Cancelar</Button>
            <Button type="submit" variant="destructive" className="gap-2" disabled={isSubmitting || !reason}>
              {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
              Enviar Denúncia
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};

export default ReportModal;
