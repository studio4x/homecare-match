"use client";

import React, { useState } from "react";
import { 
  Sheet, 
  SheetContent, 
  SheetHeader, 
  SheetTitle, 
  SheetDescription,
  SheetTrigger 
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
}

const SuggestionDrawer = ({ variant = "fixed" }: SuggestionDrawerProps) => {
  const { user } = useAuth();
  const [content, setContent] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isOpen, setIsOpen] = useState(false);

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

      toast.success("Obrigado pela sua sugestão!", {
        description: "Nossa equipe analisará sua ideia com carinho."
      });
      setContent("");
      setIsOpen(false);
    } catch (err) {
      console.error("Erro ao enviar sugestão:", err);
      toast.error("Não foi possível enviar sua sugestão agora.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const trigger = variant === "fixed" ? (
    <button 
      className="hidden md:flex fixed left-0 top-1/2 -translate-y-1/2 z-40 bg-primary text-primary-foreground py-3 px-1.5 rounded-r-xl shadow-lg hover:pl-3 transition-all group flex-col items-center gap-2 border border-l-0 border-primary-foreground/20"
      title="Enviar Sugestão"
    >
      <Lightbulb className="h-5 w-5 animate-pulse" />
      <span className="[writing-mode:vertical-lr] rotate-180 text-[10px] font-bold uppercase tracking-widest">Sugestões</span>
    </button>
  ) : (
    <button className="flex items-center gap-2 text-sm text-primary font-medium hover:underline">
      <Lightbulb className="h-4 w-4" />
      Enviar Sugestão
    </button>
  );

  return (
    <Sheet open={isOpen} onOpenChange={setIsOpen}>
      <SheetTrigger asChild>
        {trigger}
      </SheetTrigger>
      <SheetContent side="left" className="w-full sm:max-w-md">
        <SheetHeader className="mb-6">
          <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center mb-2">
            <MessageSquarePlus className="h-6 w-6 text-primary" />
          </div>
          <SheetTitle className="text-2xl">Como podemos melhorar?</SheetTitle>
          <SheetDescription>
            Sua opinião é fundamental para evoluirmos a plataforma. Conte-nos qual recurso você gostaria de ver por aqui.
          </SheetDescription>
        </SheetHeader>

        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="space-y-2">
            <Label htmlFor="suggestion-content">Sua ideia ou feedback</Label>
            <Textarea
              id="suggestion-content"
              placeholder="Ex: Gostaria de poder filtrar profissionais por idiomas falados..."
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
            {isSubmitting ? (
              <Loader2 className="h-5 w-5 animate-spin" />
            ) : (
              <Send className="h-5 w-5" />
            )}
            Enviar Sugestão
          </Button>

          <p className="text-xs text-center text-muted-foreground">
            Ao enviar, você autoriza o uso da sua ideia para melhorias na plataforma.
          </p>
        </form>
      </SheetContent>
    </Sheet>
  );
};

export default SuggestionDrawer;