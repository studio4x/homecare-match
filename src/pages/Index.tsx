import { Link, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import Layout from "@/components/layout/Layout";
import PricingCard from "@/components/PricingCard";
import FeatureCard from "@/components/FeatureCard";
import {
  Heart,
  Search,
  Shield,
  Star,
  Users,
  Award,
  Clock,
  CheckCircle,
  ArrowRight,
  HelpCircle,
  Loader2,
  BookOpen,
  GraduationCap,
  Zap,
  ShieldCheck,
  LayoutDashboard
} from "lucide-react";
import { useAuth } from "@/components/auth/AuthProvider";
import { toast } from "sonner";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Carousel, CarouselContent, CarouselItem, CarouselNext, CarouselPrevious } from "@/components/ui/carousel";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { useState, useEffect } from "react";
import { useSiteConfig } from "@/hooks/use-site-config";
import LandingVideoPlayer from "@/components/LandingVideoPlayer";

const Index = () => {
  const { session, user, loading: authLoading } = useAuth();
  const { data: config } = useSiteConfig();
  const navigate = useNavigate();
  const [loadingPlan, setLoadingPlan] = useState<string | null>(null);

  // Busca o perfil do usuário para saber o plano atual e o papel
  const { data: profile, isLoading: isLoadingProfile } = useQuery({
    queryKey: ["user-profile-tier", user?.id],
    queryFn: async () => {
      if (!user) return null;
      const { data } = await supabase.from('profiles').select('subscription_tier, role, is_admin').eq('id', user.id).single();
      return data;
    },
    enabled: !!user
  });

  // Redirecionamento automático para usuários já logados
  useEffect(() => {
    // Só redireciona se não estiver carregando auth nem perfil, e se houver uma sessão ativa
    if (!authLoading && session && !isLoadingProfile && profile) {
      console.log("[Index] Usuário logado detectado, redirecionando para o painel...");
      if (profile.is_admin || profile.role === 'admin') {
        navigate('/admin', { replace: true });
      } else {
        navigate('/dashboard', { replace: true });
      }
    }
  }, [session, authLoading, profile, isLoadingProfile, navigate]);

  const userTier = profile?.subscription_tier || null;

  const handleSubscribe = async (planId: string) => {
    if (!session) {
      toast.info("Por favor, crie uma conta ou faça login para continuar.");
      navigate("/login#auth-sign-up");
      return;
    }

    if (planId === 'free' || planId === 'free_trial') {
      navigate("/dashboard");
      return;
    }

    const toastId = toast.loading("Iniciando checkout...");
    setLoadingPlan(planId);

    try {
      const { data, error } = await supabase.functions.invoke('create-checkout-session', {
        body: { planId }
      });

      if (error) {
        let errorMessage = "Erro ao iniciar checkout.";
        if (error.context?.json) {
          const body = await error.context.json();
          errorMessage = body.error || errorMessage;
        } else if (error.message) {
          errorMessage = error.message;
        }
        throw new Error(errorMessage);
      }

      if (data?.url) {
        toast.dismiss(toastId);
        toast.success("Redirecionando para pagamento...");
        window.location.href = data.url;
      } else {
        throw new Error("URL de checkout não retornada pelo servidor.");
      }
    } catch (err: any) {
      toast.dismiss(toastId);
      const cleanMessage = err.message?.replace("Edge Function returned a non-2xx status code", "").trim();
      toast.error(`Erro: ${cleanMessage || "Falha ao iniciar pagamento."}`);
    } finally {
      setLoadingPlan(null);
    }
  };

  const features = [
    {
      icon: Search,
      title: "Visibilidade Total",
      description:
        "Seu perfil disponível para as maiores empresas de Home Care do país.",
    },
    {
      icon: Shield,
      title: "Perfil Verificado",
      description:
        "Validação profissional para garantir confiança entre você e o recrutador.",
    },
    {
      icon: Star,
      title: "Destaque na Busca",
      description:
        "Assinantes Anuais aparecem no topo dos resultados, aumentando as chances de contratação.",
    },
    {
      icon: Users,
      title: "Contato Direto",
      description:
        "Receba propostas diretamente no seu WhatsApp sem intermediários.",
    },
  ];

  const faqs = [
    {
      question: "Como funciona o período de teste gratuito?",
      answer: "Ao se cadastrar como profissional, você recebe automaticamente 30 dias de acesso gratuito ao plano básico para experimentar a plataforma e começar a ser encontrado."
    },
    {
      question: "Como as empresas entram em contato comigo?",
      answer: "As empresas visualizam seu perfil e, caso tenham interesse, clicam no botão de contato. Você receberá uma notificação e elas poderão iniciar uma conversa diretamente pelo seu WhatsApp cadastrado."
    },
    {
      question: "O que é o selo de perfil verificado?",
      answer: "É uma garantia de que seus documentos (como RG e registro profissional) foram analisados por nossa equipe. Perfis verificados transmitem mais segurança e têm prioridade na escolha dos recrutadores."
    },
    {
      question: "Posso cancelar minha assinatura a qualquer momento?",
      answer: "Sim, você tem total liberdade para gerenciar sua assinatura pelo painel. Não há fidelidade ou multas por cancelamento."
    },
    {
      question: "Como apareço no topo das buscas?",
      answer: "Assinantes do Plano Anual recebem o selo de Destaque Premium e são posicionados no topo dos resultados de busca, aumentando significativamente a visibilidade."
    }
  ];

  interface DbPlan {
    id: string;
    name: string;
    price: string;
    period: string;
    description?: string;
    features?: string[];
    popular?: boolean;
    savings?: string;
  }

  const { data: remotePlans } = useQuery({
    queryKey: ["plans"],
    queryFn: async (): Promise<DbPlan[]> => {
      const { data, error } = await supabase
        .from("plans")
        .select("*")
        .order("price", { ascending: true });
      if (error) throw error;
      return (data || []).map((p: any) => ({
        id: p.id,
        name: p.name,
        price: p.price,
        period: p.period,
        description: p.description ?? "",
        features: Array.isArray(p.features) ? p.features : [],
        popular: !!p.popular,
        savings: p.savings ?? undefined,
      }));
    },
    staleTime: 1000 * 60 * 5,
  });

  // Fallback para o plano gratuito se não estiver no banco
  const defaultFreePlan: DbPlan = {
    id: "free_trial",
    name: "Plano Gratuito",
    price: "R$ 0,00",
    period: "mês",
    description: "Aplicado automaticamente no cadastro. Válido por 30 dias.",
    features: [
      "Perfil básico",
      "Visibilidade limitada",
      "Suporte por email",
      "Ao término de 30 dias, selecione um plano pago."
    ],
    popular: false,
  };

  const defaultPlans: DbPlan[] = [
    {
      id: "monthly",
      name: "Plano Mensal",
      price: "R$ 49,90",
      period: "mês",
      description: "Acesso total à plataforma",
      features: [
        "Perfil profissional completo",
        "Visibilidade para todas as empresas",
        "Link direto para seu WhatsApp",
        "Suporte por email",
      ],
      popular: false,
    },
    {
      id: "yearly",
      name: "Plano Anual",
      price: "R$ 39,90",
      period: "mês",
      description: "O melhor custo-benefício",
      features: [
        "Tudo do plano Mensal",
        "Destaque no topo das buscas",
        "Selo dourado de verificação",
        "Acesso gratuito aos cursos da Academy",
        "Suporte prioritário",
        "Economia de R$ 120/ano",
      ],
      popular: true,
      savings: "Economize R$ 120/ano",
    },
  ];

  // Lógica para montar a lista final de planos e automatizar a economia
  const allPlans = (() => {
    let basePlans: DbPlan[] = [];
    if (!remotePlans || remotePlans.length === 0) {
      basePlans = [defaultFreePlan, ...defaultPlans];
    } else {
      const hasRemoteFree = remotePlans.some(p => p.id === 'free_trial');
      const base = hasRemoteFree ? [] : [defaultFreePlan];
      const sortedRemote = [...remotePlans].sort((a, b) => {
        if (a.id === 'free_trial') return -1;
        if (b.id === 'free_trial') return 1;
        return 0;
      });
      basePlans = [...base, ...sortedRemote];
    }

    // Automação do cálculo de economia
    const parsePrice = (priceStr: string) => {
      const numeric = priceStr.replace(/[^\d,]/g, '').replace(',', '.');
      return parseFloat(numeric) || 0;
    };

    const monthly = basePlans.find(p => p.id === 'monthly');
    const yearly = basePlans.find(p => p.id === 'yearly');

    if (monthly && yearly) {
      const mPrice = parsePrice(monthly.price);
      const yPrice = parsePrice(yearly.price);
      const diff = (mPrice - yPrice) * 12;
      
      if (diff > 0) {
        const savingsText = `Economize R$ ${Math.round(diff)}/ano`;
        yearly.savings = savingsText;
        
        if (yearly.features) {
          yearly.features = yearly.features.map(f => 
            f.toLowerCase().includes("economia de") 
              ? `Economia de R$ ${Math.round(diff)}/ano` 
              : f
          );
        }
      }
    }

    return basePlans;
  })();

  // Lógica de status do botão baseada no plano atual e papel do usuário
  const getPlanButtonConfig = (planId: string) => {
    // 1. Usuários não logados: podem clicar (levará ao registro)
    if (!session) return { text: "Assinar Agora", disabled: false };

    // 2. Empresas e Famílias: desativado
    if (profile?.role === 'company' || profile?.role === 'family') {
      return { text: "Somente para profissionais", disabled: true };
    }

    // 3. Profissionais: lógica de hierarquia
    if (!userTier) return { text: "Assinar Agora", disabled: false };

    if (userTier === planId) {
      return { text: "Seu Plano Atual", disabled: true };
    }

    if (userTier === 'yearly') {
      return { text: "Plano Inferior", disabled: true };
    }

    if (userTier === 'monthly') {
      if (planId === 'yearly') return { text: "Fazer Upgrade", disabled: false };
      return { text: "Plano Inferior", disabled: true };
    }

    if (userTier === 'free_trial') {
      if (planId === 'free_trial') return { text: "Seu Plano Atual", disabled: true };
      return { text: "Assinar Agora", disabled: false };
    }

    return { text: "Assinar Agora", disabled: false };
  };

  // Lógica dinâmica para o card de CTA da Academy
  const getAcademyCardContent = () => {
    if (!session) {
      return {
        title: "Pronto para começar?",
        description: "Crie seu perfil profissional agora e seja encontrado pelas maiores empresas de Home Care.",
        buttonText: "Crie agora sua conta",
        link: "/login#auth-sign-up",
        icon: GraduationCap
      };
    }

    if (profile?.role === 'professional') {
      return {
        title: "Pronto para começar?",
        description: "Acesse nossa área de cursos e comece a transformar sua carreira hoje mesmo.",
        buttonText: "Explorar Catálogo",
        link: "/cursos",
        icon: GraduationCap
      };
    }

    // Empresa ou Família
    return {
      title: "Precisa de profissionais?",
      description: "Acesse nossa base de especialistas verificados e feche sua escala com segurança.",
      buttonText: "Buscar Profissionais",
      link: "/buscar",
      icon: Search
    };
  };

  const cardContent = getAcademyCardContent();
  const CardIcon = cardContent.icon;

  // Se estiver carregando a autenticação, mostra um loader centralizado para evitar flashes de conteúdo
  if (authLoading) {
    return (
      <div className="flex h-screen items-center justify-center">
        <Loader2 className="h-10 w-10 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <Layout>
      <section className="gradient-hero relative overflow-hidden py-20 lg:py-28">
        <div className="absolute inset-0 overflow-hidden">
          <div className="absolute -right-40 -top-40 h-80 w-80 rounded-full bg-primary/5" />
          <div className="absolute -bottom-40 -left-40 h-80 w-80 rounded-full bg-success/5" />
        </div>

        <div className="container relative mx-auto px-4">
          <div className="mx-auto max-w-4xl text-center">
            <div className="animate-fade-in mb-6 inline-flex items-center gap-2 rounded-full border border-border bg-card px-4 py-2 shadow-sm">
              <Heart className="h-4 w-4 text-primary" />
              <span className="text-sm font-medium text-muted-foreground">
                Plataforma exclusiva para profissionais de Home Care
              </span>
            </div>

            <h1 className="animate-slide-up text-4xl font-bold leading-tight text-foreground md:text-5xl lg:text-6xl">
              Sua carreira no{" "}
              <span className="bg-gradient-to-r from-primary to-primary/70 bg-clip-text text-transparent">
                Home Care
              </span>{" "}
              começa aqui
            </h1>

            <p className="animate-slide-up mx-auto mt-6 max-w-2xl text-lg text-muted-foreground" style={{ animationDelay: "0.1s" }}>
              Crie seu perfil profissional, seja encontrado pelas maiores empresas de saúde e receba propostas diretamente no seu celular.
            </p>

            <div className="animate-slide-up mt-10 flex flex-col items-center justify-center gap-4 sm:flex-row" style={{ animationDelay: "0.2s" }}>
              {session ? (
                <Button size="lg" asChild className="gap-2">
                  <Link to={profile?.is_admin || profile?.role === 'admin' ? "/admin" : "/dashboard"}>
                    <LayoutDashboard className="h-4 w-4" />
                    Ir para Meu Painel
                  </Link>
                </Button>
              ) : (
                <Button size="lg" asChild className="gap-2">
                  <Link to="/login#auth-sign-up">
                    Escolher Plano e Começar
                    <ArrowRight className="h-4 w-4" />
                  </Link>
                </Button>
              )}
              <Button size="lg" variant="outline" asChild>
                <Link to="/empresas">Sou uma Empresa</Link>
              </Button>
            </div>
          </div>
        </div>
      </section>

      {/* Seção de Vídeo de Apresentação */}
      {config?.video_url_professionals && (
        <section className="py-12 bg-secondary/10">
          <div className="container mx-auto px-4">
            <div className="max-w-4xl mx-auto">
              <LandingVideoPlayer 
                url={config.video_url_professionals} 
                title="Apresentação para Profissionais"
              />
            </div>
          </div>
        </section>
      )}

      <section className="py-20">
        <div className="container mx-auto px-4">
          <div className="mb-12 text-center">
            <h2 className="text-3xl font-bold text-foreground">
              Vantagens da Assinatura
            </h2>
            <p className="mx-auto mt-4 max-w-2xl text-muted-foreground">
              Acesso exclusivo às melhores oportunidades do mercado de saúde domiciliar.
            </p>
          </div>

          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
            {features.map((feature, index) => (
              <FeatureCard
                key={index}
                icon={feature.icon}
                title={feature.title}
                description={feature.description}
              />
            ))}
          </div>
        </div>
      </section>

      {/* Academy Section */}
      <section className="py-20 bg-card border-y border-border overflow-hidden">
        <div className="container mx-auto px-4">
          <div className="grid gap-12 lg:grid-cols-2 lg:items-center">
            <div className="space-y-6">
              <div className="inline-flex items-center gap-2 rounded-full bg-primary/10 px-4 py-2 text-primary">
                <BookOpen className="h-5 w-5" />
                <span className="text-sm font-bold uppercase tracking-wider">HomeCare Match Academy</span>
              </div>
              
              <h2 className="text-3xl font-bold text-foreground md:text-4xl">
                Sua evolução profissional não pode parar
              </h2>
              
              <p className="text-lg text-muted-foreground leading-relaxed">
                A <strong>Academy</strong> é o nosso braço educativo, focado em preparar você para os desafios reais do Home Care. Oferecemos conteúdos práticos e atualizados para que você se torne um profissional ainda mais requisitado.
              </p>

              <div className="grid gap-6 sm:grid-cols-2">
                <div className="space-y-2">
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
                    <Award className="h-6 w-6" />
                  </div>
                  <h4 className="font-bold">Selos de Conquista</h4>
                  <p className="text-sm text-muted-foreground">Ao concluir um curso, você ganha um selo exclusivo que aparece no seu perfil público.</p>
                </div>
                <div className="space-y-2">
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
                    <ShieldCheck className="h-6 w-6" />
                  </div>
                  <h4 className="font-bold">Destaque no Perfil</h4>
                  <p className="text-sm text-muted-foreground">Recrutadores dão preferência a profissionais que investem em capacitação contínua.</p>
                </div>
              </div>

              <div className="rounded-2xl bg-secondary/30 p-6 border border-border/50">
                <h4 className="font-bold flex items-center gap-2 mb-4">
                  <Zap className="h-5 w-5 text-amber-500 fill-amber-500" />
                  Acesso por Plano
                </h4>
                <div className="space-y-4">
                  <div className="flex items-start gap-3">
                    <div className="mt-1 h-2 w-2 rounded-full bg-primary shrink-0" />
                    <p className="text-sm">
                      <strong>Plano Mensal:</strong> Você tem acesso ao catálogo completo e pode adquirir cursos pagos individualmente conforme sua necessidade.
                    </p>
                  </div>
                  <div className="flex items-start gap-3">
                    <div className="mt-1 h-2 w-2 rounded-full bg-success shrink-0" />
                    <p className="text-sm">
                      <strong>Plano Anual:</strong> Além de poder adquirir cursos pagos, você ganha acesso <strong>exclusivo e gratuito</strong> a todos os cursos marcados como "Gratuitos" na plataforma.
                    </p>
                  </div>
                </div>
              </div>
            </div>

            <div className="relative">
              <div className="absolute -inset-4 rounded-[2rem] bg-gradient-to-tr from-primary/20 to-transparent blur-2xl" />
              <div className="relative rounded-3xl border border-border bg-card p-8 shadow-2xl">
                <div className="flex flex-col items-center text-center space-y-6">
                  <div className="h-20 w-20 rounded-full bg-primary/10 flex items-center justify-center">
                    <CardIcon className="h-10 w-10 text-primary" />
                  </div>
                  <div className="space-y-2">
                    <h3 className="text-2xl font-bold">{cardContent.title}</h3>
                    <p className="text-muted-foreground">
                      {cardContent.description}
                    </p>
                  </div>
                  <Button asChild size="lg" className="w-full gap-2 h-14 text-lg shadow-lg">
                    <Link to={cardContent.link}>
                      {cardContent.buttonText}
                      <ArrowRight className="h-5 w-5" />
                    </Link>
                  </Button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* How it Works */}
      <section className="py-20">
        <div className="container mx-auto px-4">
          <div className="mb-12 text-center">
            <h2 className="text-3xl font-bold text-foreground">Como Funciona</h2>
            <p className="mx-auto mt-4 max-w-2xl text-muted-foreground">
              Processo simples e rápido para impulsionar sua carreira.
            </p>
          </div>

          <div className="mx-auto grid max-w-4xl gap-8 md:grid-cols-3">
            {[
              {
                step: "01",
                title: "Cadastre-se",
                description:
                  "Crie seu perfil profissional detalhado em poucos minutos.",
              },
              {
                step: "02",
                title: "Destaque-se",
                description:
                  "Envie seus documentos para verificação e ganhe o selo de confiança.",
              },
              {
                step: "03",
                title: "Seja Contratado",
                description:
                  "Receba propostas diretamente no seu WhatsApp e feche novos plantões.",
              },
            ].map((item, index) => (
              <div key={index} className="relative text-center">
                <div className="mb-4 inline-flex h-16 w-16 items-center justify-center rounded-2xl bg-primary text-2xl font-bold text-primary-foreground">
                  {item.step}
                </div>
                <h3 className="mb-2 text-lg font-semibold text-foreground">
                  {item.title}
                </h3>
                <p className="text-sm text-muted-foreground">{item.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="bg-primary py-20">
        <div className="container mx-auto px-4 text-center">
          <h2 className="text-3xl font-bold text-primary-foreground">
            Pronto para conquistar as melhores oportunidades?
          </h2>
          <p className="mx-auto mt-4 max-w-2xl text-primary-foreground/80">
            Junte-se a milhares de profissionais e tenha visibilidade para as maiores empresas de Home Care do Brasil.
          </p>
          <Button
            size="lg"
            variant="secondary"
            className="mt-8 gap-2"
            asChild
          >
            <Link to="/login#auth-sign-up">
              Criar Perfil Agora
              <ArrowRight className="h-4 w-4" />
            </Link>
          </Button>
        </div>
      </section>

      {/* FAQ Section */}
      <section className="py-20 bg-secondary/10">
        <div className="container mx-auto px-4 max-w-3xl">
          <div className="mb-12 text-center">
            <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
              <HelpCircle className="h-6 w-6 text-primary" />
            </div>
            <h2 className="text-3xl font-bold text-foreground">Dúvidas Frequentes</h2>
            <p className="mt-4 text-muted-foreground">
              Tudo o que você precisa saber para começar sua jornada conosco.
            </p>
          </div>

          <Accordion type="single" collapsible className="w-full space-y-4">
            {faqs.map((faq, index) => (
              <AccordionItem 
                key={index} 
                value={`item-${index}`} 
                className="border rounded-xl px-6 bg-card shadow-sm border-primary/5"
              >
                <AccordionTrigger className="text-left font-semibold hover:no-underline py-4">
                  {faq.question}
                </AccordionTrigger>
                <AccordionContent className="text-muted-foreground pb-4">
                  {faq.answer}
                </AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>

          <div className="mt-10 text-center">
            <Button variant="outline" asChild className="gap-2">
              <Link to="/suporte">
                Ver Todas as Dúvidas
                <ArrowRight className="h-4 w-4" />
              </Link>
            </Button>
          </div>
        </div>
      </section>

      <section id="planos" className="scroll-mt-20 py-20 bg-secondary/30">
        <div className="container mx-auto px-4">
          <div className="mb-12 text-center">
            <h2 className="text-3xl font-bold text-foreground">
              Escolha seu Plano
            </h2>
            <p className="mx-auto mt-4 max-w-2xl text-muted-foreground">
              Assine agora e torne seu perfil visível para centenas de empresas de recrutamento.
            </p>
          </div>

          <p className="md:hidden text-center text-xs text-muted-foreground mb-4">
            Dica: arraste para o lado para ver todos os planos.
          </p>

          <Carousel className="w-full">
            <CarouselContent className="items-stretch">
              {allPlans.map((plan) => {
                const btnConfig = getPlanButtonConfig(plan.id);
                return (
                  <CarouselItem key={plan.id} className="basis-full md:basis-1/2 lg:basis-1/3">
                    <div className="p-2 h-full">
                      <PricingCard
                        id={plan.id}
                        name={plan.name}
                        price={plan.price}
                        period={plan.period}
                        description={plan.description ?? ""}
                        features={plan.features ?? []}
                        popular={plan.popular}
                        savings={plan.savings}
                        onSubscribe={handleSubscribe}
                        isLoading={loadingPlan === plan.id}
                        buttonText={btnConfig.text}
                        isDisabled={btnConfig.disabled}
                      />
                    </div>
                  </CarouselItem>
                );
              })}
            </CarouselContent>
            <div className="mt-6 flex items-center justify-center gap-4">
              <CarouselPrevious className="relative" />
              <CarouselNext className="relative" />
            </div>
          </Carousel>
        </div>
      </section>
    </Layout>
  );
};

export default Index;