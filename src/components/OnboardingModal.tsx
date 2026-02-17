"use client";

import React, { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { 
  ChevronLeft, 
  ChevronRight, 
  PlayCircle, 
  UserCheck, 
  ShieldCheck, 
  Award, 
  LifeBuoy,
  CheckCircle2,
  Loader2,
  X,
  Search,
  Users,
  Building2,
  MessageSquare
} from "lucide-react";
import { useSiteConfig } from "@/hooks/use-site-config";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/components/auth/AuthProvider";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

interface OnboardingModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  forceShow?: boolean;
  role?: 'professional' | 'company' | 'family';
}

const OnboardingModal = ({ open, onOpenChange, forceShow = false, role = 'professional' }: OnboardingModalProps) => {
  const { user } = useAuth();
  const { data: config } = useSiteConfig();
  const [currentStep, setCurrentStep] = useState(0);
  const [dontShowAgain, setDontShowAgain] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  const professionalSteps = [
    {
      title: "Bem-vindo à HomeCare Match!",
      description: "Assista ao vídeo abaixo para entender como nossa plataforma vai impulsionar sua carreira.",
      type: "video",
    },
    {
      title: "Complete seu Perfil",
      description: "Perfis com foto profissional e biografia detalhada recebem até 3x mais propostas. Vá em 'Meus Dados' e capriche!",
      icon: UserCheck,
      color: "text-blue-500",
      bg: "bg-blue-50",
    },
    {
      title: "Ganhe o Selo de Verificado",
      description: "Envie seus documentos para análise. O selo de verificação transmite total confiança para empresas e famílias.",
      icon: ShieldCheck,
      color: "text-green-500",
      bg: "bg-green-50",
    },
    {
      title: "Suba no Ranking",
      description: "Use seu Link de Indicação! Quanto mais colegas você trouxer, maior será seu destaque e visibilidade nas buscas.",
      icon: Award,
      color: "text-amber-500",
      bg: "bg-amber-50",
    },
    {
      title: "Suporte e Academy",
      description: "Precisa de ajuda? Abra um Ticket em 'Suporte'. Quer se capacitar? Explore nossa 'Academy' com cursos exclusivos.",
      icon: LifeBuoy,
      color: "text-purple-500",
      bg: "bg-purple-50",
    }
  ];

  const companySteps = [
    {
      title: "Bem-vindo ao seu Painel de Recrutamento!",
      description: "Assista ao vídeo para aprender a encontrar os melhores profissionais para sua equipe em tempo recorde.",
      type: "video",
    },
    {
      title: "Identidade da Empresa",
      description: "Complete os dados da sua empresa em 'Meus Dados'. Perfis transparentes geram mais interesse dos profissionais qualificados.",
      icon: Building2,
      color: "text-blue-600",
      bg: "bg-blue-50",
    },
    {
      title: "Busca Inteligente",
      description: "Use os filtros avançados para encontrar profissionais por bairro, especialidade e disponibilidade imediata.",
      icon: Search,
      color: "text-green-600",
      bg: "bg-green-50",
    },
    {
      title: "Gestão de Contatos",
      description: "Todos os profissionais que você contatar ficam salvos em 'Contatos'. Você pode ver o WhatsApp e o histórico a qualquer momento.",
      icon: Users,
      color: "text-amber-600",
      bg: "bg-amber-50",
    },
    {
      title: "Central de Atendimento",
      description: "Dúvidas sobre a plataforma? Nossa equipe está pronta para ajudar através do sistema de Tickets em 'Suporte'.",
      icon: MessageSquare,
      color: "text-purple-600",
      bg: "bg-purple-50",
    }
  ];

  const steps = role === 'professional' ? professionalSteps : companySteps;
  const videoUrl = role === 'professional' ? config?.video_url_onboarding : config?.video_url_onboarding_company;

  const handleNext = () => {
    if (currentStep < steps.length - 1) {
      setCurrentStep(currentStep + 1);
    }
  };

  const handlePrev = () => {
    if (currentStep > 0) {
      setCurrentStep(currentStep - 1);
    }
  };

  const handleComplete = async () => {
    if (!user) return;
    
    setIsSaving(true);
    try {
      if (dontShowAgain || !forceShow) {
        const { error } = await supabase
          .from("profiles")
          .update({ has_seen_onboarding: true })
          .eq("id", user.id);
        
        if (error) throw error;
      }
      
      toast.success("Tutorial concluído! Boas contratações.");
      onOpenChange(false);
    } catch (err) {
      console.error(err);
      onOpenChange(false);
    } finally {
      setIsSaving(false);
    }
  };

  const step = steps[currentStep];
  const Icon = (step as any).icon;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[600px] p-0 overflow-hidden border-none shadow-2xl">
        <button 
          onClick={() => onOpenChange(false)}
          className="absolute right-4 top-4 z-50 p-2 rounded-full bg-black/10 hover:bg-black/20 transition-colors"
        >
          <X className="h-4 w-4" />
        </button>

        <div className="flex flex-col h-full">
          {/* Header Progress */}
          <div className="flex h-1.5 w-full bg-secondary">
            {steps.map((_, i) => (
              <div 
                key={i} 
                className={cn(
                  "flex-1 transition-all duration-500",
                  i <= currentStep ? "bg-primary" : "bg-transparent"
                )} 
              />
            ))}
          </div>

          <div className="p-8 space-y-6">
            <div className="text-center space-y-2">
              <DialogTitle className="text-2xl font-bold">{step.title}</DialogTitle>
              <DialogDescription className="text-base">
                {step.description}
              </DialogDescription>
            </div>

            <div className="min-h-[300px] flex items-center justify-center">
              {step.type === "video" ? (
                <div className="w-full aspect-video rounded-2xl overflow-hidden bg-black shadow-lg border border-border/50">
                  {videoUrl ? (
                    <video 
                      src={videoUrl} 
                      className="w-full h-full object-contain"
                      controls
                      autoPlay
                    />
                  ) : (
                    <div className="w-full h-full flex flex-col items-center justify-center text-muted-foreground gap-3">
                      <PlayCircle className="h-12 w-12 opacity-20" />
                      <p className="text-xs">Vídeo de introdução em breve</p>
                    </div>
                  )}
                </div>
              ) : (
                <div className={cn("w-full py-12 rounded-3xl flex flex-col items-center justify-center text-center space-y-6 animate-scale-in", (step as any).bg)}>
                  <div className={cn("h-24 w-24 rounded-full bg-white shadow-sm flex items-center justify-center", (step as any).color)}>
                    {Icon && <Icon className="h-12 w-12" />}
                  </div>
                  <div className="max-w-xs px-4">
                    <p className="text-sm font-medium text-foreground/80 leading-relaxed">
                      {step.description}
                    </p>
                  </div>
                </div>
              )}
            </div>

            <div className="flex items-center justify-between pt-4">
              <Button 
                variant="ghost" 
                onClick={handlePrev}
                disabled={currentStep === 0}
                className="gap-2"
              >
                <ChevronLeft className="h-4 w-4" /> Anterior
              </Button>

              <div className="flex gap-1">
                {steps.map((_, i) => (
                  <div 
                    key={i} 
                    className={cn(
                      "h-1.5 w-1.5 rounded-full transition-all",
                      i === currentStep ? "bg-primary w-4" : "bg-primary/20"
                    )} 
                  />
                ))}
              </div>

              {currentStep < steps.length - 1 ? (
                <Button onClick={handleNext} className="gap-2">
                  Próximo <ChevronRight className="h-4 w-4" />
                </Button>
              ) : (
                <Button onClick={handleComplete} disabled={isSaving} className="gap-2 bg-success hover:bg-success/90">
                  {isSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
                  Concluir Tutorial
                </Button>
              )}
            </div>
          </div>

          <div className="bg-secondary/30 p-4 border-t flex items-center justify-center gap-6">
            <div className="flex items-center space-x-2">
              <Checkbox 
                id="dont-show" 
                checked={dontShowAgain} 
                onCheckedChange={(v) => setDontShowAgain(!!v)} 
              />
              <Label htmlFor="dont-show" className="text-xs text-muted-foreground cursor-pointer">
                Não mostrar este tutorial novamente ao entrar
              </Label>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default OnboardingModal;