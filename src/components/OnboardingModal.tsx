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
  Search,
  Users,
  Building2,
  MessageSquare,
  MapPin
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
      headerDescription: "Assista ao vídeo abaixo para entender como nossa plataforma vai impulsionar sua carreira.",
      type: "video",
    },
    {
      title: "Complete seu Perfil",
      headerDescription: "Um perfil completo atrai até 3x mais propostas de trabalho.",
      sliderContent: "Vá em 'Meus Dados' e adicione sua melhor foto, biografia e experiências detalhadas para se destacar.",
      icon: UserCheck,
      color: "text-blue-500",
      bg: "bg-blue-50",
    },
    {
      title: "Ganhe o Selo de Verificado",
      headerDescription: "Transmita total confiança para empresas e famílias recrutadoras.",
      sliderContent: "Envie fotos do seu RG/CNH e registro profissional para nossa equipe validar sua conta e ativar seu selo.",
      icon: ShieldCheck,
      color: "text-green-500",
      bg: "bg-green-50",
    },
    {
      title: "Suba no Ranking",
      headerDescription: "Aumente sua visibilidade e apareça no topo das buscas.",
      sliderContent: "Use seu Link de Indicação! Quanto mais colegas você trouxer, maior será seu destaque e pontuação na plataforma.",
      icon: Award,
      color: "text-amber-500",
      bg: "bg-amber-50",
    },
    {
      title: "Suporte e Academy",
      headerDescription: "Estamos aqui para ajudar na sua jornada e evolução profissional.",
      sliderContent: "Abra tickets de suporte para tirar dúvidas e explore a Academy para conquistar novos certificados e selos.",
      icon: LifeBuoy,
      color: "text-purple-500",
      bg: "bg-purple-50",
    }
  ];

  const companySteps = [
    {
      title: "Bem-vindo ao seu Painel!",
      headerDescription: "Aprenda a encontrar os melhores profissionais para sua equipe em tempo recorde.",
      type: "video",
    },
    {
      title: "Identidade da Empresa",
      headerDescription: "Perfis transparentes geram muito mais interesse dos candidatos.",
      sliderContent: "Complete os dados da sua empresa em 'Meus Dados' para passar credibilidade e atrair os melhores talentos.",
      icon: Building2,
      color: "text-blue-600",
      bg: "bg-blue-50",
    },
    {
      title: "Busca Inteligente",
      headerDescription: "Encontre exatamente o profissional que sua escala precisa.",
      sliderContent: "Use os filtros avançados para selecionar especialistas por bairro, especialidade e disponibilidade imediata.",
      icon: Search,
      color: "text-green-600",
      bg: "bg-green-50",
    },
    {
      title: "Gestão de Contatos",
      headerDescription: "Organize seu processo de recrutamento em um só lugar.",
      sliderContent: "Todos os profissionais que você contatar ficam salvos em 'Contatos' com histórico e link direto para o WhatsApp.",
      icon: Users,
      color: "text-amber-600",
      bg: "bg-amber-50",
    },
    {
      title: "Central de Atendimento",
      headerDescription: "Suporte dedicado para ajudar sua empresa a crescer.",
      sliderContent: "Dúvidas sobre a plataforma? Nossa equipe está pronta para ajudar através do sistema de Tickets em 'Suporte'.",
      icon: MessageSquare,
      color: "text-purple-600",
      bg: "bg-purple-50",
    }
  ];

  const familySteps = [
    {
      title: "Bem-vindo à HomeCare Match!",
      headerDescription: "Aprenda como encontrar o melhor cuidado para quem você ama.",
      type: "video",
    },
    {
      title: "Sua Localização",
      headerDescription: "Encontre profissionais que moram perto da sua residência.",
      sliderContent: "Mantenha seu endereço atualizado em 'Meus Dados' para visualizar especialistas que atendem na sua região.",
      icon: MapPin,
      color: "text-rose-600",
      bg: "bg-rose-50",
    },
    {
      title: "Busca por Especialidade",
      headerDescription: "Cuidadores, enfermeiros e terapeutas qualificados.",
      sliderContent: "Filtre por especialidade, veja o valor por hora e a experiência de cada profissional antes de iniciar o contato.",
      icon: Search,
      color: "text-blue-600",
      bg: "bg-blue-50",
    },
    {
      title: "Segurança e Confiança",
      headerDescription: "Dê preferência a profissionais que possuem o Selo de Verificado.",
      sliderContent: "Estes perfis tiveram seus documentos e registros analisados manualmente por nossa equipe de segurança.",
      icon: ShieldCheck,
      color: "text-green-600",
      bg: "bg-green-50",
    },
    {
      title: "Contato Direto",
      headerDescription: "Fale direto no WhatsApp do profissional escolhido.",
      sliderContent: "Inicie conversas sem intermediários e sem taxas de agenciamento. Combine valores e horários diretamente.",
      icon: MessageSquare,
      color: "text-amber-600",
      bg: "bg-amber-50",
    }
  ];

  const getSteps = () => {
    if (role === 'professional') return professionalSteps;
    if (role === 'company') return companySteps;
    return familySteps;
  };

  const getVideoUrl = () => {
    if (role === 'professional') return config?.video_url_onboarding;
    if (role === 'company') return config?.video_url_onboarding_company;
    return config?.video_url_onboarding_family;
  };

  const steps = getSteps();
  const videoUrl = getVideoUrl();

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
        <div className="flex flex-col h-full">
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
                {(step as any).headerDescription}
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
                      autoPlay={false} // Desativar autoplay
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
                      {(step as any).sliderContent}
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