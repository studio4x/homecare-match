"use client";

import React, { useEffect, useState } from "react";
import {
  Sheet,
  SheetClose,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
  SheetTrigger,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Lightbulb, Send, Loader2, MessageSquarePlus } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/components/auth/AuthProvider";
import { toast } from "sonner";

interface SuggestionDrawerProps {
  variant?: "fixed" | "footer";
  autoPromptEnabled?: boolean;
  showTrigger?: boolean;
}

const AUTO_PROMPT_DELAY_MS = 60 * 60 * 1000;

const getPromptStartedAtKey = (userId: string) => `suggestion_prompt_started_at:${userId}`;
const getPromptShownKey = (userId: string) => `suggestion_prompt_shown:${userId}`;

const SuggestionDrawer = ({
  variant = "fixed",
  autoPromptEnabled = false,
  showTrigger = true,
}: SuggestionDrawerProps) => {
  const { user } = useAuth();
  const [content, setContent] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    if (!autoPromptEnabled || !user?.id) return;

    const shownKey = getPromptShownKey(user.id);
    const startedAtKey = getPromptStartedAtKey(user.id);

    if (window.sessionStorage.getItem(shownKey) === "1") return;

    const rawStartedAt = window.sessionStorage.getItem(startedAtKey);
    let startedAt = Number(rawStartedAt || 0);
    if (!startedAt || Number.isNaN(startedAt)) {
      startedAt = Date.now();
      window.sessionStorage.setItem(startedAtKey, String(startedAt));
    }

    const openPrompt = () => {
      if (window.sessionStorage.getItem(shownKey) === "1") return;
      window.sessionStorage.setItem(shownKey, "1");
      setIsOpen(true);
    };

    const elapsed = Date.now() - startedAt;
    if (elapsed >= AUTO_PROMPT_DELAY_MS) {
      openPrompt();
      return;
    }

    const timeout = window.setTimeout(openPrompt, AUTO_PROMPT_DELAY_MS - elapsed);
    return () => window.clearTimeout(timeout);
  }, [autoPromptEnabled, user?.id]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!content.trim()) return;

    setIsSubmitting(true);
    try {
      const { error } = await supabase.from("suggestions").insert({
        user_id: user?.id || null,
        content: content.trim(),
      });

      if (error) throw error;

      await supabase.from("admin_notifications").insert({
        title: "Nova sugestao recebida",
        content: "Um usuario enviou uma nova ideia de recurso para a plataforma.",
        link: "/admin/sugestoes",
        type: "info",
      });

      toast.success("Obrigado pela sua sugestao!", {
        description: "Nossa equipe analisara sua ideia com carinho.",
      });
      setContent("");
      setIsOpen(false);
    } catch (err) {
      console.error("Erro ao enviar sugestao:", err);
      toast.error("Nao foi possivel enviar sua sugestao agora.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const trigger =
    !showTrigger
      ? null
      : variant === "fixed"
      ? (
          <button
            className="hidden md:flex fixed left-0 top-1/2 -translate-y-1/2 z-40 bg-primary text-primary-foreground py-3 px-1.5 rounded-r-xl shadow-lg hover:pl-3 transition-all group flex-col items-center gap-2 border border-l-0 border-primary-foreground/20"
            title="Enviar sugestao"
          >
            <Lightbulb className="h-5 w-5 animate-pulse" />
            <span className="[writing-mode:vertical-lr] rotate-180 text-[10px] font-bold uppercase tracking-widest">Sugestoes</span>
          </button>
        )
      : (
          <button className="flex items-center gap-2 text-sm text-primary font-medium hover:underline">
            <Lightbulb className="h-4 w-4" />
            Enviar sugestao
          </button>
        );

  return (
    <Sheet open={isOpen} onOpenChange={setIsOpen}>
      {trigger ? <SheetTrigger asChild>{trigger}</SheetTrigger> : null}
      <SheetContent side="left" className="w-full sm:max-w-md">
        <SheetHeader className="mb-6">
          <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center mb-2">
            <MessageSquarePlus className="h-6 w-6 text-primary" />
          </div>
          <SheetTitle className="text-2xl">Se voce pudesse mudar algo em nossa plataforma hoje, o que seria?</SheetTitle>
          <SheetDescription>
            Sua opiniao e fundamental para evoluirmos a plataforma.
          </SheetDescription>
        </SheetHeader>

        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="space-y-2">
            <Label htmlFor="suggestion-content">Sua ideia ou feedback</Label>
            <Textarea
              id="suggestion-content"
              placeholder="Ex: Eu mudaria..."
              className="min-h-[200px] resize-none text-base"
              value={content}
              onChange={(e) => setContent(e.target.value)}
              required
            />
          </div>

          <Button
            type="submit"
            className="w-full h-12 gap-2 text-lg"
            disabled={isSubmitting || !content.trim()}
          >
            {isSubmitting ? <Loader2 className="h-5 w-5 animate-spin" /> : <Send className="h-5 w-5" />}
            Enviar sugestao
          </Button>

          <SheetClose asChild>
            <Button type="button" variant="outline" className="w-full h-11">
              Fechar
            </Button>
          </SheetClose>

          <p className="text-xs text-center text-muted-foreground">
            Ao enviar, voce autoriza o uso da sua ideia para melhorias na plataforma.
          </p>
        </form>
      </SheetContent>
    </Sheet>
  );
};

export default SuggestionDrawer;
