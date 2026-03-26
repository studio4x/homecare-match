"use client";

import React, { useMemo, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useSiteConfig } from "@/hooks/use-site-config";
import {
  formatSupportBusinessHoursSummary,
  formatSupportSlaPromise,
  getSupportCategoryOptions,
  normalizeSupportBusinessHoursConfig,
  normalizeSupportSlaConfig,
  type SupportTicketCategory,
} from "@/lib/support-sla";
import {
  supabase,
  SUPABASE_PUBLISHABLE_KEY,
  SUPABASE_URL,
} from "@/integrations/supabase/client";
import { sanitizeStorageFileName, sanitizeStoragePath } from "@/lib/storage-path";
import { toast } from "sonner";
import {
  ArrowRight,
  FileText,
  HelpCircle,
  Loader2,
  Lock,
  MessageSquarePlus,
  Paperclip,
  Send,
  X,
} from "lucide-react";

interface SupportTicketModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initialStep?: "choice" | "form";
}

type TicketFormState = {
  subject: string;
  description: string;
  priority: string;
  category: SupportTicketCategory;
};

const ALL_PRIORITIES = [
  { value: "low", label: "Baixa" },
  { value: "medium", label: "Média" },
  { value: "high", label: "Alta" },
  { value: "urgent", label: "Urgente" },
];

const initialTicketData: TicketFormState = {
  subject: "",
  description: "",
  priority: "low",
  category: "general",
};

const SupportTicketModal = ({
  open,
  onOpenChange,
  initialStep = "form",
}: SupportTicketModalProps) => {
  const { user, session } = useAuth();
  const navigate = useNavigate();
  const { data: siteConfig } = useSiteConfig();
  const [step, setStep] = useState<"choice" | "form">(initialStep);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [ticketData, setTicketData] = useState<TicketFormState>(initialTicketData);
  const [attachment, setAttachment] = useState<File | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const supportSlaConfig = useMemo(
    () => normalizeSupportSlaConfig(siteConfig?.support_sla_config),
    [siteConfig?.support_sla_config],
  );
  const supportBusinessHours = useMemo(
    () => normalizeSupportBusinessHoursConfig(siteConfig?.support_business_hours_config),
    [siteConfig?.support_business_hours_config],
  );
  const categoryOptions = useMemo(
    () => getSupportCategoryOptions(supportSlaConfig),
    [supportSlaConfig],
  );
  const selectedSlaText = useMemo(
    () => formatSupportSlaPromise(ticketData.category, supportSlaConfig),
    [ticketData.category, supportSlaConfig],
  );
  const businessHoursLabel = useMemo(
    () => formatSupportBusinessHoursSummary(supportBusinessHours),
    [supportBusinessHours],
  );

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
    if (profile.is_admin || profile.role === "admin") return ALL_PRIORITIES;
    if (profile.role === "company" || profile.role === "family") {
      return ALL_PRIORITIES.filter((priority) => ["low", "medium", "high"].includes(priority.value));
    }
    if (profile.subscription_tier === "yearly") return ALL_PRIORITIES;
    if (profile.subscription_tier === "monthly") {
      return ALL_PRIORITIES.filter((priority) => ["low", "medium"].includes(priority.value));
    }
    return ALL_PRIORITIES.filter((priority) => priority.value === "low");
  }, [profile]);

  React.useEffect(() => {
    if (!open) return;
    setStep(initialStep);
    setTicketData(initialTicketData);
    setAttachment(null);
  }, [open, initialStep]);

  React.useEffect(() => {
    if (profile && !allowedPriorities.some((priority) => priority.value === ticketData.priority)) {
      setTicketData((current) => ({ ...current, priority: allowedPriorities[0].value }));
    }
  }, [allowedPriorities, profile, ticketData.priority]);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();

    if (!session) {
      toast.info("Faça login para abrir um chamado.");
      onOpenChange(false);
      navigate("/login");
      return;
    }

    setIsSubmitting(true);

    try {
      let attachmentUrl: string | null = null;
      let attachmentName: string | null = null;

      if (attachment) {
        const safeName = sanitizeStorageFileName(attachment.name, "anexo");
        const fileExt = safeName.split(".").pop() || "bin";
        const fileName = `${crypto.randomUUID()}.${fileExt}`;
        const filePath = sanitizeStoragePath(`support/${user?.id}/${fileName}`, {
          bucket: "uploads",
        });

        const { error: uploadError } = await supabase.storage
          .from("uploads")
          .upload(filePath, attachment);

        if (uploadError) throw uploadError;

        const {
          data: { publicUrl },
        } = supabase.storage.from("uploads").getPublicUrl(filePath);

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
          category: ticketData.category,
          status: "open",
          attachment_url: attachmentUrl,
          attachment_name: attachmentName,
        })
        .select()
        .single();

      if (error) throw error;

      void (async () => {
        try {
          const {
            data: { session: currentSession },
          } = await supabase.auth.getSession();
          const { data: refreshed } = await supabase.auth.refreshSession();
          const accessToken =
            refreshed.session?.access_token ||
            currentSession?.access_token ||
            session?.access_token ||
            "";

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
        } catch (notifyError) {
          console.warn("[SupportTicketModal] Falha inesperada ao notificar admin:", notifyError);
        }
      })();

      toast.success("Chamado aberto com sucesso.");
      onOpenChange(false);
      navigate(`/dashboard/suporte/${data.id}`);
    } catch (error) {
      console.error("[SupportTicketModal] Erro ao abrir chamado:", error);
      toast.error("Erro ao abrir chamado.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleBack = () => {
    if (initialStep === "choice") {
      setStep("choice");
      return;
    }

    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-hidden border-none p-0 shadow-2xl sm:max-w-[560px]">
        {step === "choice" ? (
          <div className="max-h-[90vh] space-y-6 overflow-y-auto p-8">
            <div className="space-y-2 text-center">
              <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
                <HelpCircle className="h-6 w-6 text-primary" />
              </div>
              <DialogTitle className="text-2xl font-bold">Como podemos ajudar?</DialogTitle>
              <DialogDescription className="text-base">
                Muitas dúvidas podem ser resolvidas rapidamente em nossa Central de Ajuda.
              </DialogDescription>
            </div>

            <div className="grid gap-4">
              <Button
                variant="outline"
                className="group h-20 justify-between px-6 text-left hover:border-primary hover:bg-primary/5 hover:text-foreground"
                asChild
                onClick={() => onOpenChange(false)}
              >
                <Link to="/suporte">
                  <div className="flex items-center gap-4">
                    <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-secondary transition-colors group-hover:bg-primary/10">
                      <FileText className="h-5 w-5 text-muted-foreground group-hover:text-primary" />
                    </div>
                    <div>
                      <p className="font-bold">Ver perguntas frequentes</p>
                      <p className="text-xs text-muted-foreground">
                        Respostas rápidas para dúvidas comuns.
                      </p>
                    </div>
                  </div>
                  <ArrowRight className="h-5 w-5 text-muted-foreground transition-all group-hover:translate-x-1 group-hover:text-primary" />
                </Link>
              </Button>

              <Button
                variant="outline"
                className="group h-20 justify-between px-6 text-left hover:border-primary hover:bg-primary/5 hover:text-foreground"
                onClick={() => setStep("form")}
              >
                <div className="flex items-center gap-4">
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-secondary transition-colors group-hover:bg-primary/10">
                    <MessageSquarePlus className="h-5 w-5 text-muted-foreground group-hover:text-primary" />
                  </div>
                  <div>
                    <p className="font-bold">Abrir um chamado</p>
                    <p className="text-xs text-muted-foreground">Fale diretamente com nossa equipe.</p>
                  </div>
                </div>
                <ArrowRight className="h-5 w-5 text-muted-foreground transition-all group-hover:translate-x-1 group-hover:text-primary" />
              </Button>
            </div>

            <div className="text-center">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => onOpenChange(false)}
                className="text-muted-foreground hover:text-foreground"
              >
                Cancelar
              </Button>
            </div>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="flex max-h-[90vh] flex-col">
            <DialogHeader className="shrink-0 border-b bg-secondary/10 p-6">
              <div className="flex items-center gap-3">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary">
                  <MessageSquarePlus className="h-5 w-5 text-white" />
                </div>
                <div>
                  <DialogTitle>Novo chamado</DialogTitle>
                  <DialogDescription>
                    Escolha a categoria correta e descreva seu problema para nossa equipe.
                  </DialogDescription>
                </div>
              </div>
            </DialogHeader>

            <div className="flex-1 space-y-4 overflow-y-auto p-6">
              <div className="rounded-2xl border border-primary/10 bg-primary/5 p-4">
                <p className="text-sm font-semibold text-foreground">{selectedSlaText}</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  Atendimento em {businessHoursLabel}. A prioridade abaixo serve para triagem interna e não altera a promessa pública de primeira resposta.
                </p>
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs font-bold uppercase text-muted-foreground">Categoria</Label>
                <Select
                  value={ticketData.category}
                  onValueChange={(value) =>
                    setTicketData((current) => ({
                      ...current,
                      category: value as SupportTicketCategory,
                    }))
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione a categoria" />
                  </SelectTrigger>
                  <SelectContent>
                    {categoryOptions.map((category) => (
                      <SelectItem key={category.key} value={category.key}>
                        {category.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs font-bold uppercase text-muted-foreground">Assunto</Label>
                <Input
                  required
                  placeholder="Ex: problema com pagamento ou acesso"
                  value={ticketData.subject}
                  onChange={(event) =>
                    setTicketData((current) => ({ ...current, subject: event.target.value }))
                  }
                />
              </div>

              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <Label className="text-xs font-bold uppercase text-muted-foreground">Prioridade interna</Label>
                  {isLoadingProfile && <Loader2 className="h-3 w-3 animate-spin text-muted-foreground" />}
                </div>
                <Select
                  value={ticketData.priority}
                  onValueChange={(value) =>
                    setTicketData((current) => ({ ...current, priority: value }))
                  }
                  disabled={isLoadingProfile}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione" />
                  </SelectTrigger>
                  <SelectContent>
                    {allowedPriorities.map((priority) => (
                      <SelectItem key={priority.value} value={priority.value}>
                        {priority.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {profile &&
                  profile.role === "professional" &&
                  allowedPriorities.length < ALL_PRIORITIES.length && (
                    <p className="mt-1 flex items-center gap-1 text-[10px] text-amber-600">
                      <Lock className="h-2.5 w-2.5" />
                      Algumas prioridades são exclusivas para planos superiores.
                    </p>
                  )}
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs font-bold uppercase text-muted-foreground">Descrição</Label>
                <Textarea
                  required
                  placeholder="Explique o contexto, os passos do problema e o que você precisa."
                  rows={5}
                  className="resize-none"
                  value={ticketData.description}
                  onChange={(event) =>
                    setTicketData((current) => ({
                      ...current,
                      description: event.target.value,
                    }))
                  }
                />
              </div>

              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <Label className="text-xs font-bold uppercase text-muted-foreground">
                    Anexo (opcional)
                  </Label>
                  {attachment && (
                    <button
                      type="button"
                      onClick={() => setAttachment(null)}
                      className="flex items-center gap-1 text-[10px] text-destructive hover:underline"
                    >
                      <X className="h-2 w-2" />
                      Remover
                    </button>
                  )}
                </div>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="h-10 w-full gap-2 border-dashed hover:text-foreground"
                  onClick={() => fileInputRef.current?.click()}
                >
                  <Paperclip className="h-4 w-4" />
                  {attachment ? attachment.name : "Anexar arquivo"}
                </Button>
                <input
                  type="file"
                  ref={fileInputRef}
                  className="hidden"
                  onChange={(event) => setAttachment(event.target.files?.[0] || null)}
                />
              </div>
            </div>

            <DialogFooter className="shrink-0 gap-2 border-t bg-secondary/5 p-6 sm:gap-0">
              <Button
                type="button"
                variant="ghost"
                onClick={handleBack}
                className="hover:text-foreground"
              >
                Voltar
              </Button>
              <Button type="submit" className="gap-2 shadow-lg" disabled={isSubmitting || isLoadingProfile}>
                {isSubmitting ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Send className="h-4 w-4" />
                )}
                Enviar chamado
              </Button>
            </DialogFooter>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
};

export default SupportTicketModal;
