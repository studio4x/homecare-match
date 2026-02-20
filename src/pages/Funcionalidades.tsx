"use client";

import { useState, useEffect } from "react";
import Layout from "@/components/layout/Layout";
import { 
  Search, 
  ShieldCheck, 
  BookOpen, 
  Award, 
  MessageSquare, 
  Users, 
  Zap, 
  Headset, 
  Star, 
  MapPin,
  UserCheck,
  LayoutGrid,
  CheckCircle2,
  GraduationCap,
  ArrowRight,
  Loader2,
  Bell,
  CreditCard,
  ShieldAlert,
  Lightbulb,
  Sparkles,
  PlayCircle,
  FileCheck
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Link } from "react-router-dom";
import { useAuth } from "@/components/auth/AuthProvider";
import { supabase } from "@/integrations/supabase/client";

const Funcionalidades = () => {
  const { session, user, loading: authLoading } = useAuth();
  const [profile, setProfile] = useState<any>(null);
  const [profileLoading, setProfileLoading] = useState(false);

  useEffect(() => {
    const fetchProfile = async () => {
      if (user) {
        setProfileLoading(true);
        const { data } = await supabase
          .from("profiles")
          .select("role")
          .eq("id", user.id)
          .single();
        
        if (data) setProfile(data);
        setProfileLoading(false);
      }
    };
    fetchProfile();
  }, [user]);

  const features = [
    {
      title: "Busca Inteligente de Profissionais",
      description: "Filtre especialistas por bairro, cidade, especialidade e disponibilidade imediata.",
      icon: Search,
      profiles: ["company", "family"],
      color: "text-blue-500",
      bg: "bg-blue-50"
    },
    {
      title: "Perfil Profissional Completo",
      description: "Exibição de currículo, formações, experiências e biografia humanizada.",
      icon: UserCheck,
      profiles: ["professional"],
      color: "text-primary",
      bg: "bg-primary/5"
    },
    {
      title: "Selo de Verificação Profissional",
      description: "Análise manual de documentos e registros (COREN/CREFITO) para garantir segurança.",
      icon: ShieldCheck,
      profiles: ["professional"],
      color: "text-success",
      bg: "bg-success/5"
    },
    {
      title: "Academy (Cursos de Capacitação)",
      description: "Acesso a conteúdos educativos exclusivos com emissão de selos de conquista.",
      icon: BookOpen,
      profiles: ["professional"],
      color: "text-purple-500",
      bg: "bg-purple-50"
    },
    {
      title: "Validação Pública de Conquistas",
      description: "Página dedicada para validar a autenticidade dos seus selos da Academy por terceiros.",
      icon: FileCheck,
      profiles: ["professional"],
      color: "text-indigo-600",
      bg: "bg-indigo-50"
    },
    {
      title: "Programa de Indicações (Embaixador)",
      description: "Indique colegas e suba no ranking de visibilidade da plataforma.",
      icon: Award,
      profiles: ["professional"],
      color: "text-amber-500",
      bg: "bg-amber-50"
    },
    {
      title: "Mural de Avisos e Comunicados",
      description: "Central de notícias e atualizações importantes diretamente no seu painel.",
      icon: Bell,
      profiles: ["professional", "company", "family"],
      color: "text-rose-500",
      bg: "bg-rose-50"
    },
    {
      title: "Notificações em Tempo Real",
      description: "Receba avisos instantâneos sobre novos contatos e mensagens no seu dispositivo.",
      icon: Zap,
      profiles: ["professional", "company", "family"],
      color: "text-yellow-600",
      bg: "bg-yellow-50"
    },
    {
      title: "IA para Biografia Profissional",
      description: "Crie uma biografia humanizada e profissional em segundos com ajuda da nossa IA.",
      icon: Sparkles,
      profiles: ["professional"],
      color: "text-cyan-600",
      bg: "bg-cyan-50"
    },
    {
      title: "Gestão de Pagamentos e Faturas",
      description: "Histórico completo de recibos e controle total sobre suas assinaturas.",
      icon: CreditCard,
      profiles: ["professional"],
      color: "text-emerald-600",
      bg: "bg-emerald-50"
    },
    {
      title: "Contato Direto via WhatsApp",
      description: "Inicie conversas sem intermediários e sem taxas de agenciamento.",
      icon: MessageSquare,
      profiles: ["company", "family"],
      color: "text-green-600",
      bg: "bg-green-50"
    },
    {
      title: "Gestão de Contatos",
      description: "Histórico centralizado de todos os profissionais ou recrutadores contatados.",
      icon: LayoutGrid,
      profiles: ["professional", "company", "family"],
      color: "text-slate-600",
      bg: "bg-slate-50"
    },
    {
      title: "Sistema de Avaliações",
      description: "Deixe feedbacks e leia depoimentos reais sobre atendimentos realizados.",
      icon: Star,
      profiles: ["professional", "company", "family"],
      color: "text-yellow-500",
      bg: "bg-yellow-50"
    },
    {
      title: "Busca por Geolocalização",
      description: "Visualize no mapa os profissionais que estão mais próximos da sua residência.",
      icon: MapPin,
      profiles: ["company", "family"],
      color: "text-rose-500",
      bg: "bg-rose-50"
    },
    {
      title: "Tutorial de Boas-vindas",
      description: "Guia interativo para ajudar você a extrair o máximo da plataforma desde o início.",
      icon: PlayCircle,
      profiles: ["professional", "company", "family"],
      color: "text-blue-600",
      bg: "bg-blue-50"
    },
    {
      title: "Segurança e Denúncias",
      description: "Ferramentas para reportar comportamentos inadequados e manter a comunidade segura.",
      icon: ShieldAlert,
      profiles: ["professional", "company", "family"],
      color: "text-destructive",
      bg: "bg-destructive/5"
    },
    {
      title: "Canal de Sugestões",
      description: "Envie suas ideias de melhorias diretamente para nossa equipe de desenvolvimento.",
      icon: Lightbulb,
      profiles: ["professional", "company", "family"],
      color: "text-amber-600",
      bg: "bg-amber-100"
    },
    {
      title: "Serviço de Concierge",
      description: "Busca manual e personalizada realizada por nossa equipe para casos urgentes.",
      icon: Headset,
      profiles: ["company", "family"],
      color: "text-cyan-600",
      bg: "bg-cyan-50"
    }
  ];

  const getProfileBadge = (role: string) => {
    switch (role) {
      case 'professional': return <Badge key={role} variant="secondary" className="bg-primary/10 text-primary border-primary/20">Profissional</Badge>;
      case 'company': return <Badge key={role} variant="secondary" className="bg-success/10 text-success border-success/20">Empresa</Badge>;
      case 'family': return <Badge key={role} variant="outline" className="bg-amber-50 text-amber-700 border-amber-200">Família</Badge>;
      default: return null;
    }
  };

  const getCtaContent = () => {
    if (authLoading || profileLoading) {
      return {
        title: "Carregando...",
        description: "Estamos preparando as melhores opções para você.",
        buttons: <Loader2 className="h-8 w-8 animate-spin text-primary" />,
        items: []
      };
    }

    if (!session) {
      return {
        title: "Pronto para começar?",
        description: "Seja você um profissional em busca de plantões ou um recrutador precisando fechar escalas, temos a solução ideal.",
        buttons: (
          <div className="flex flex-wrap gap-4">
            <Button size="lg" asChild className="shadow-lg">
              <Link to="/login#auth-sign-up">Criar Minha Conta</Link>
            </Button>
            <Button size="lg" variant="outline" asChild>
              <Link to="/buscar">Explorar Profissionais</Link>
            </Button>
          </div>
        ),
        items: ["Conexão direta e segura", "Sem intermediários", "Crescimento profissional"]
      };
    }

    if (profile?.role === 'professional') {
      return {
        title: "Sua evolução não para!",
        description: "Acesse a Academy para conquistar novos selos e certificados que darão ainda mais destaque ao seu perfil profissional.",
        buttons: (
          <Button size="lg" asChild className="gap-2 shadow-lg">
            <Link to="/cursos">
              <GraduationCap className="h-5 w-5" />
              Explorar Catálogo de Cursos
            </Link>
          </Button>
        ),
        items: ["Certificados com selo no perfil", "Conteúdo prático e atualizado", "Destaque para recrutadores"]
      };
    }

    // Empresa ou Família
    return {
      title: "Precisa de profissionais?",
      description: "Acesse nossa base de especialistas verificados e feche sua escala com segurança.",
      buttons: (
        <Button size="lg" asChild className="gap-2 shadow-lg">
          <Link to="/buscar">
            <Search className="h-5 w-5" />
            Explorar Profissionais
          </Link>
        </Button>
      ),
      items: ["Sem taxas de agenciamento", "Contato direto e imediato", "Segurança e Verificação"]
    };
  };

  const cta = getCtaContent();

  return (
    <Layout>
      <div className="container mx-auto px-4 py-12">
        <div className="text-center max-w-3xl mx-auto mb-16">
          <h1 className="text-4xl font-bold tracking-tight text-foreground md:text-5xl">
            Funcionalidades da Plataforma
          </h1>
          <p className="mt-4 text-lg text-muted-foreground">
            Conheça todas as ferramentas que criamos para conectar o ecossistema de Home Care com eficiência e segurança.
          </p>
        </div>

        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {features.map((f, i) => (
            <Card key={i} className="group hover:shadow-lg transition-all duration-300 border-primary/5 overflow-hidden">
              <CardHeader className={cn("pb-4", f.bg)}>
                <div className="flex items-center justify-between mb-2">
                  <div className={cn("p-2 rounded-lg bg-white shadow-sm", f.color)}>
                    <f.icon className="h-6 w-6" />
                  </div>
                  <div className="flex gap-1">
                    {f.profiles.map(getProfileBadge)}
                  </div>
                </div>
                <CardTitle className="text-xl leading-tight group-hover:text-primary transition-colors">
                  {f.title}
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-4">
                <p className="text-sm text-muted-foreground leading-relaxed">
                  {f.description}
                </p>
              </CardContent>
            </Card>
          ))}
        </div>

        <div className="mt-20 bg-primary/5 rounded-3xl p-8 md:p-12 border border-primary/10">
          <div className="grid md:grid-cols-2 gap-12 items-center">
            <div className="space-y-6">
              <h2 className="text-3xl font-bold">{cta.title}</h2>
              <p className="text-muted-foreground text-lg">
                {cta.description}
              </p>
              {cta.buttons}
            </div>
            <div className="grid gap-4">
              {cta.items.map((item, idx) => (
                <div key={idx} className="flex items-center gap-4 p-4 bg-white rounded-2xl shadow-sm border animate-fade-in">
                  <div className="h-10 w-10 rounded-full bg-success/10 flex items-center justify-center text-success">
                    <CheckCircle2 className="h-6 w-6" />
                  </div>
                  <p className="font-medium">{item}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </Layout>
  );
};

export default Funcionalidades;