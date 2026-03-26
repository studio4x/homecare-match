"use client";

import React, { useState } from "react";
import { useAuth } from "@/components/auth/AuthProvider";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { AlertTriangle, Loader2, Send, ShieldAlert } from "lucide-react";

interface ReportModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  reportedId: string;
  reportedName: string;
}

const REPORT_REASONS = [
  { value: "fake_profile", label: "Perfil falso / spam" },
  { value: "inappropriate_behavior", label: "Comportamento inadequado" },
  { value: "incorrect_info", label: "Informações incorretas / falsas" },
  { value: "scam_fraud", label: "Golpe / fraude" },
  { value: "harassment", label: "Assedio ou ofensa" },
  { value: "other", label: "Outros" },
];

const ReportModal = ({ open, onOpenChange, reportedId, reportedName }: ReportModalProps) => {
  const { user } = useAuth();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [reason, setReason] = useState("");
  const [description, setDescription] = useState("");

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();

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
          reason: REPORT_REASONS.find((item) => item.value === reason)?.label || reason,
          description: description.trim(),
        })
        .select()
        .single();

      if (error) throw error;

      const { data: authSession } = await supabase.auth.getSession();
      const accessToken = authSession?.session?.access_token || "";
      const { error: notifyError } = await supabase.functions.invoke("notify-report", {
        body: { reportId: data.id, access_token: accessToken },
      });

      if (notifyError) {
        console.warn("Falha ao notificar admin sobre denúncia:", notifyError);
        toast.warning("Denúncia registrada, mas houve falha no envio da notificação para o admin.");
      }

      toast.success("Denúncia enviada com sucesso.", {
        description:
          "Sua denúncia entrou em triagem prioritária. Se houver risco imediato, abra também um chamado no suporte.",
      });

      onOpenChange(false);
      setReason("");
      setDescription("");
    } catch (error) {
      console.error("[ReportModal] Erro ao enviar denúncia:", error);
      toast.error("Erro ao enviar denúncia.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[450px]">
        <DialogHeader>
          <div className="mx-auto mb-2 flex h-12 w-12 items-center justify-center rounded-full bg-destructive/10">
            <AlertTriangle className="h-6 w-6 text-destructive" />
          </div>
          <DialogTitle className="text-center">Denunciar perfil</DialogTitle>
          <DialogDescription className="text-center">
            Você está denunciando o perfil de <strong>{reportedName}</strong>. Sua identidade será mantida em sigilo.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 py-4">
          <div className="space-y-2">
            <Label>Motivo da denúncia</Label>
            <Select value={reason} onValueChange={setReason}>
              <SelectTrigger>
                <SelectValue placeholder="Selecione o motivo principal" />
              </SelectTrigger>
              <SelectContent>
                {REPORT_REASONS.map((item) => (
                  <SelectItem key={item.value} value={item.value}>
                    {item.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Detalhes adicionais (opcional)</Label>
            <Textarea
              placeholder="Descreva o que aconteceu para nos ajudar na análise..."
              className="resize-none"
              rows={4}
              value={description}
              onChange={(event) => setDescription(event.target.value)}
            />
          </div>

          <div className="flex items-start gap-3 rounded-lg border border-border/50 bg-secondary/30 p-3">
            <ShieldAlert className="mt-0.5 h-5 w-5 shrink-0 text-primary" />
            <p className="text-[10px] leading-relaxed text-muted-foreground">
              Denúncias falsas ou abusivas podem resultar na suspensão da sua própria conta. Use este recurso com responsabilidade.
            </p>
          </div>

          <DialogFooter className="pt-4">
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button type="submit" variant="destructive" className="gap-2" disabled={isSubmitting || !reason}>
              {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
              Enviar denúncia
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};

export default ReportModal;
