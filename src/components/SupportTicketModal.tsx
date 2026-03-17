"use client";

import React, { useState, useRef, useMemo } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { 
  Loader2, 
  Send, 
  Paperclip, 
  X, 
  HelpCircle, 
  MessageSquarePlus,
  ArrowRight,
  FileText,
  Lock
} from "lucide-react";
import { supabase, SUPABASE_PUBLISHABLE_KEY, SUPABASE_URL } from "@/integrations/supabase/client";
import { useAuth } from "@/components/auth/AuthProvider";
import { toast } from "sonner";
import { useNavigate, Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";

interface SupportTicketModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initialStep?: "choice" | "form";
}

const ALL_PRIORITIES = [
  { value: "low", label: "Baixa" },
  { value: "medium", label: "Média" },
  { value: "high", label: "Alta" },
  { value: "urgent", label: "Urgente" },
];

const SupportTicketModal = ({ open, onOpenChange, initialStep = "form" }: SupportTicketModalProps) => {
  const { user, session } = useAuth();
  const navigate = useNavigate();
  const [step, setStep] = useState<"choice" | "form">(initialStep);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [ticketData, setTicketData] = useState({ subject: "", description: "", priority: "low" });
  const [attachment, setAttachment] = useState<File | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const { data: profile, isLoading: isLoadingProfile } = useQuery({
    queryKey: ["user-profile-support", user?.id],
    queryFn: async () => {
      if (!user) return null;
      const { data } = await supabase
        .from("profiles")
        .select("role, subscription_tier, is_admin")
        .eq("id", user.id)
        .single();
      return data;
    },
    enabled: !!user && open,
  });

  const allowedPriorities = useMemo(() => {
    if (!profile) return [{ value: "low", label: "Baixa" }];
    if (profile.is_admin || profile.role === 'admin') return ALL_PRIORITIES;
    if (profile.role === 'company' || profile.role === 'family') {
      return ALL_PRIORITIES.filter(p => ["low", "medium", "high"].includes(p.value));
    }
    if (profile.subscription_tier === 'yearly') return ALL_PRIORITIES;
    if (profile.subscription_tier === 'monthly') {
      return ALL_PRIORITIES.filter(p => ["low", "medium"].includes(p.value));
    }
    return ALL_PRIORITIES.filter(p => p.value === "low");
  }, [profile]);

  React.useEffect(() => {
    if (open) {
      setStep(initialStep);
      setTicketData({ subject: "", description: "", priority: "low" });
      setAttachment(null);
    }
  }, [open, initialStep]);

  React.useEffect(() => {
    if (profile && !allowedPriorities.some(p => p.value === ticketData.priority)) {
      setTicketData(prev => ({ ...prev, priority: allowedPriorities[0].value }));
    }
  }, [allowedPriorities, profile]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!session) {
      toast.info("Faça login para abrir um chamado.");
      onOpenChange(false);
      navigate("/login");
      return;
    }

    setIsSubmitting(true);
    try {
      let attachmentUrl = null;
      let attachmentName = null;

      if (attachment) {
        const fileExt = attachment.name.split('.').pop();
        const fileName = `${Math.random()}.${fileExt}`;
        const filePath = `support/${user?.id}/${fileName}`;
        const { error: uploadError } = await supabase.storage.from('uploads').upload(filePath, attachment);
        if (uploadError) throw uploadError;
        const { data: { publicUrl } } = supabase.storage.from('uploads').getPublicUrl(filePath);
        attachmentUrl = publicUrl;
        attachmentName = attachment.name;
      }

      const { data, error } = await supabase
        .from("support_tickets")
        .insert({
          user_id: user?.id,
          subject: ticketData.subject,
          description: ticketData.description,
          priority: ticketData.priority,
          status: 'open',
          attachment_url: attachmentUrl,
          attachment_name: attachmentName
        })
        .select()
        .single();

      if (error) throw error;

      (async () => {
        try {
          const {
            data: { session: currentSession },
          } = await supabase.auth.getSession();
          const { data: refreshed } = await supabase.auth.refreshSession();
          const accessToken =
            refreshed.session?.access_token || currentSession?.access_token || session?.access_token || "";

          if (!accessToken) {
            console.warn("[SupportTicketModal] Sem token para notificar admin.");
            return;
          }

          const response = await fetch(`${SUPABASE_URL}/functions/v1/notify-support`, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              apikey: SUPABASE_PUBLISHABLE_KEY,
              Authorization: `Bearer ${accessToken}`,
            },
            body: JSON.stringify({
              type: "new_ticket",
              ticketId: data.id,
              senderId: user?.id,
              access_token: accessToken,
            }),
          });

          if (!response.ok) {
            const detail = await response.text();
            console.warn("[SupportTicketModal] Falha ao notificar admin:", response.status, detail);
          }
        } catch (notifyErr) {
          console.warn("[SupportTicketModal] Falha inesperada ao notificar admin:", notifyErr);
        }
      })();

      toast.success("Chamado aberto com sucesso!");
      onOpenChange(false);
      navigate(`/dashboard/suporte/${data.id}`);
    } catch (err) {
      toast.error("Erro ao abrir chamado.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px] max-h-[90vh] p-0 overflow-hidden border-none shadow-2xl">
        {step === "choice" ? (
          <div className="max-h-[90vh] overflow-y-auto p-8 space-y-6">
            <div className="text-center space-y-2">
              <div className="mx-auto h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center mb-4">
                <HelpCircle className="h-6 w-6 text-primary" />
              </div>
              <DialogTitle className="text-2xl font-bold">Como podemos ajudar?</DialogTitle>
              <DialogDescription className="text-base">
                Muitas dúvidas podem ser resolvidas instantaneamente em nossa Central de Ajuda.
              </DialogDescription>
            </div>

            <div className="grid gap-4">
              <Button 
                variant="outline" 
                className="h-20 justify-between px-6 text-left hover:border-primary hover:bg-primary/5 hover:text-foreground group"
                asChild
                onClick={() => onOpenChange(false)}
              >
                <Link to="/suporte">
                  <div className="flex items-center gap-4">
                    <div className="h-10 w-10 rounded-lg bg-secondary flex items-center justify-center group-hover:bg-primary/10 transition-colors">
                      <FileText className="h-5 w-5 text-muted-foreground group-hover:text-primary" />
                    </div>
                    <div>
                      <p className="font-bold">Ver Perguntas Frequentes</p>
                      <p className="text-xs text-muted-foreground">Respostas rápidas para dúvidas comuns.</p>
                    </div>
                  </div>
                  <ArrowRight className="h-5 w-5 text-muted-foreground group-hover:text-primary group-hover:translate-x-1 transition-all" />
                </Link>
              </Button>

              <Button 
                variant="outline" 
                className="h-20 justify-between px-6 text-left hover:border-primary hover:bg-primary/5 hover:text-foreground group"
                onClick={() => setStep("form")}
              >
                <div className="flex items-center gap-4">
                  <div className="h-10 w-10 rounded-lg bg-secondary flex items-center justify-center group-hover:bg-primary/10 transition-colors">
                    <MessageSquarePlus className="h-5 w-5 text-muted-foreground group-hover:text-primary" />
                  </div>
                  <div>
                    <p className="font-bold">Abrir um Chamado</p>
                    <p className="text-xs text-muted-foreground">Fale diretamente com nossa equipe.</p>
                  </div>
                </div>
                <ArrowRight className="h-5 w-5 text-muted-foreground group-hover:text-primary group-hover:translate-x-1 transition-all" />
              </Button>
            </div>
            
            <div className="text-center">
              <Button variant="ghost" size="sm" onClick={() => onOpenChange(false)} className="text-muted-foreground hover:text-foreground">
                Cancelar
              </Button>
            </div>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="flex max-h-[90vh] flex-col">
            <DialogHeader className="shrink-0 p-6 bg-secondary/10 border-b">
              <div className="flex items-center gap-3">
                <div className="h-8 w-8 rounded-lg bg-primary flex items-center justify-center">
                  <MessageSquarePlus className="h-5 w-5 text-white" />
                </div>
                <div>
                  <DialogTitle>Novo Chamado</DialogTitle>
                  <DialogDescription>Descreva seu problema ou dúvida para nossa equipe.</DialogDescription>
                </div>
              </div>
            </DialogHeader>

            <div className="flex-1 overflow-y-auto p-6 space-y-4">
              <div className="space-y-1.5">
                <Label className="text-xs uppercase font-bold text-muted-foreground">Assunto</Label>
                <Input 
                  required 
                  placeholder="Ex: Problema com acesso" 
                  value={ticketData.subject}
                  onChange={(e) => setTicketData({...ticketData, subject: e.target.value})}
                />
              </div>

              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <Label className="text-xs uppercase font-bold text-muted-foreground">Prioridade</Label>
                  {isLoadingProfile && <Loader2 className="h-3 w-3 animate-spin text-muted-foreground" />}
                </div>
                <Select 
                  value={ticketData.priority} 
                  onValueChange={(v) => setTicketData({...ticketData, priority: v})}
                  disabled={isLoadingProfile}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione" />
                  </SelectTrigger>
                  <SelectContent>
                    {allowedPriorities.map(p => (
                      <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {profile && profile.role === 'professional' && allowedPriorities.length < ALL_PRIORITIES.length && (
                  <p className="text-[10px] text-amber-600 flex items-center gap-1 mt-1">
                    <Lock className="h-2.5 w-2.5" />
                    Algumas prioridades são exclusivas para planos superiores.
                  </p>
                )}
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs uppercase font-bold text-muted-foreground">Descrição</Label>
                <Textarea 
                  required 
                  placeholder="Como podemos ajudar?" 
                  rows={4}
                  className="resize-none"
                  value={ticketData.description}
                  onChange={(e) => setTicketData({...ticketData, description: e.target.value})}
                />
              </div>

              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <Label className="text-xs uppercase font-bold text-muted-foreground">Anexo (Opcional)</Label>
                  {attachment && (
                    <button type="button" onClick={() => setAttachment(null)} className="text-[10px] text-destructive hover:underline flex items-center gap-1">
                      <X className="h-2 w-2" /> Remover
                    </button>
                  )}
                </div>
                <Button 
                  type="button" 
                  variant="outline" 
                  size="sm" 
                  className="w-full gap-2 border-dashed h-10 hover:text-foreground"
                  onClick={() => fileInputRef.current?.click()}
                >
                  <Paperclip className="h-4 w-4" />
                  {attachment ? attachment.name : "Anexar arquivo"}
                </Button>
                <input 
                  type="file" 
                  ref={fileInputRef} 
                  className="hidden" 
                  onChange={(e) => setAttachment(e.target.files?.[0] || null)}
                />
              </div>
            </div>

            <DialogFooter className="shrink-0 p-6 bg-secondary/5 border-t gap-2 sm:gap-0">
              <Button type="button" variant="ghost" onClick={() => initialStep === "choice" ? setStep("choice") : onOpenChange(false)} className="hover:text-foreground">
                Voltar
              </Button>
              <Button type="submit" className="gap-2 shadow-lg" disabled={isSubmitting || isLoadingProfile}>
                {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                Enviar Chamado
              </Button>
            </DialogFooter>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
};

export default SupportTicketModal;
