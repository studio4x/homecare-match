import { Link, useNavigate, useLocation } from "react-router-dom";
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
  ArrowRight,
  HelpCircle,
  Loader2,
  BookOpen,
  GraduationCap,
  Zap,
  ShieldCheck,
  LayoutDashboard,
  CheckCircle2,
} from "lucide-react";
import { useAuth } from "@/components/auth/AuthProvider";
import { toast } from "sonner";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Carousel, CarouselContent, CarouselItem, CarouselNext, CarouselPrevious, type CarouselApi } from "@/components/ui/carousel";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { useState, useEffect, useMemo } from "react";
import { useSiteConfig } from "@/hooks/use-site-config";
import LandingVideoPlayer from "@/components/LandingVideoPlayer";
import { createCheckoutSession } from "@/lib/checkout";
import SubscriptionCouponModal from "@/components/SubscriptionCouponModal";
import { resolveLandingVideoAssets } from "@/lib/landing-video";
import { useIsMobile } from "@/hooks/use-mobile";
import { resolveVideoOrientation } from "@/lib/video-utils";
import WhatsAppContactButton from "@/components/WhatsAppContactButton";
import { getCheckoutAllowedHosts, navigateSafely } from "@/lib/safe-navigation";
import { usePublicHighlightedCoupon } from "@/hooks/use-public-highlighted-coupon";
import PublicCouponBanner from "@/components/PublicCouponBanner";

const Index = () => {
  const { session, user, loading: authLoading } = useAuth();
  const { data: config } = useSiteConfig();
  const navigate = useNavigate();
  const location = useLocation();
  const [loadingPlan, setLoadingPlan] = useState<string | null>(null);
  const [selectedPlanForCheckout, setSelectedPlanForCheckout] = useState<"monthly" | "yearly" | null>(null);
  const [plansCarouselApi, setPlansCarouselApi] = useState<CarouselApi | null>(null);
  const isMobile = useIsMobile();
  const { data: publicCoupon } = usePublicHighlightedCoupon();

  const { data: profile, isLoading: isLoadingProfile } = useQuery({
    queryKey: ["user-profile-tier", user?.id],
    queryFn: async () => {
      if (!user) return null;
      const { data } = await supabase
        .from("profiles")
        .select("subscription_tier, role, is_admin")
        .eq("id", user.id)
        .single();
      return data;
    },
    enabled: !!user,
  });

  useEffect(() => {
    const isSupabaseAuthRedirect = location.hash.includes("_supabase=true");

    if (!authLoading && session && !isLoadingProfile && profile && isSupabaseAuthRedirect) {
      console.log("[Index] Usuário logado detectado via redirect de auth, redirecionando para o painel...");
      if (profile.is_admin || profile.role === "admin") {
        navigate("/admin", { replace: true });
      } else {
        navigate("/dashboard", { replace: true });
      }
    } else if (!authLoading && session && !isLoadingProfile && profile && !isSupabaseAuthRedirect) {
      console.log("[Index] Usuário logado acessou a página diretamente, permitindo visualização.");
    }
  }, [session, authLoading, profile, isLoadingProfile, navigate, location.hash]);

  const userTier = profile?.subscription_tier || null;

  const handlePlanCheckout = async (planId: "monthly" | "yearly") => {
    setSelectedPlanForCheckout(null);
    if (!session) {
      toast.info("Por favor, crie uma conta ou faça login para continuar.");
      navigate("/login#auth-sign-up");
      return;
    }

    const toastId = toast.loading("Iniciando checkout...");
    setLoadingPlan(planId);

    try {
      const data = await createCheckoutSession({ planId });

      if (data?.url) {
        toast.dismiss(toastId);
        toast.success("Redirecionando para pagamento...");
        const redirected = navigateSafely(data.url, {
          allowExternal: true,
          allowedHosts: getCheckoutAllowedHosts(),
        });
        if (!redirected) {
          throw new Error("URL de checkout invalida.");
        }
      } else {
        throw new Error("URL de checkout não retornada pelo servidor.");
      }
    } catch (err: unknown) {
      toast.dismiss(toastId);
      const cleanMessage =
        err instanceof Error
          ? err.message?.replace("Edge Function returned a non-2xx status code", "").trim()
          : "";
      toast.error(`Erro: ${cleanMessage || "Falha ao iniciar pagamento."}`);
    } finally {
      setLoadingPlan(null);
    }
  };

  const handleSubscribe = async (planId: string) => {
    if (!session) {
      toast.info("Por favor, crie uma conta ou faça login para continuar.");
      navigate("/login#auth-sign-up");
      return;
    }

    if (planId === "free" || planId === "free_trial") {
      navigate("/dashboard");
      return;
    }

    if (planId === "monthly" || planId === "yearly") {
      setSelectedPlanForCheckout(planId);
      return;
    }

    toast.error("Plano inválido para checkout.");
  };

  const faqs = [
    {
      question: "Quem pode se cadastrar na plataforma?",
      answer:
        "Profissionais da área da saúde que realizam atendimentos domiciliares, como enfermeiros, técnicos de enfermagem, cuidadores, fisioterapeutas, fonoaudiólogos e outros profissionais.",
    },
    {
      question: "Como recebo oportunidades de atendimento?",
      answer:
        "Empresas de home care e famílias podem encontrar seu perfil na plataforma e entrar em contato diretamente com você.",
    },
    {
      question: "Posso cancelar quando quiser?",
      answer: "Sim. Você pode cancelar sua assinatura a qualquer momento.",
    },
    {
      question: "A plataforma funciona em todo o Brasil?",
      answer:
        "A Home Care Match conecta profissionais e oportunidades em diversas regiões do país.",
    },
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
    asaas_installment_max?: number;
  }

  const { data: remotePlans } = useQuery({
    queryKey: ["plans"],
    queryFn: async (): Promise<DbPlan[]> => {
      const { data, error } = await supabase.from("plans").select("*").order("price", { ascending: true });
      if (error) throw error;
      return (data || []).map((p: Record<string, unknown>) => ({
        id: String(p.id ?? ""),
        name: String(p.name ?? ""),
        price: String(p.price ?? ""),
        period: String(p.period ?? ""),
        description: typeof p.description === "string" ? p.description : "",
        features: Array.isArray(p.features)
          ? p.features.filter((feature): feature is string => typeof feature === "string")
          : [],
        popular: Boolean(p.popular),
        savings: typeof p.savings === "string" ? p.savings : undefined,
        asaas_installment_max:
          typeof p.asaas_installment_max === "number" ? p.asaas_installment_max : undefined,
      }));
    },
    staleTime: 1000 * 60 * 5,
  });

  const defaultFreePlan: DbPlan = {
    id: "free_trial",
    name: "Plano Gratuito",
    price: "R$ 0,00",
    period: "7 dias",
    description: "Aplicado automaticamente no cadastro. Válido por 7 dias.",
    features: [
      "Perfil básico",
      "Visibilidade limitada",
      "Suporte por email",
      "Ao término de 7 dias, selecione um plano pago.",
    ],
    popular: false,
  };

  const defaultPlans: DbPlan[] = [
    {
      id: "monthly",
      name: "Plano Mensal",
      price: "R$ 49,90",
      period: "mês",
      description: "Plano ideal para manter seu perfil ativo",
      features: [
        "Perfil profissional completo",
        "Visibilidade para empresas e famílias",
        "Mais oportunidades de atendimento",
        "Plataforma dedicada a profissionais de Home Care",
      ],
      popular: false,
    },
    {
      id: "yearly",
      name: "Plano Anual",
      price: "R$ 39,90",
      period: "mês",
      description: "Plano ideal para quem busca mais economia",
      features: [
        "Perfil profissional completo",
        "Visibilidade para empresas e famílias",
        "Mais oportunidades de atendimento",
        "Plataforma dedicada a profissionais de Home Care",
      ],
      popular: true,
      savings: "Economize R$ 120/ano",
      asaas_installment_max: 12,
    },
  ];

  const allPlans = (() => {
    let basePlans: DbPlan[] = [];
    if (!remotePlans || remotePlans.length === 0) {
      basePlans = [defaultFreePlan, ...defaultPlans];
    } else {
      const hasRemoteFree = remotePlans.some((p) => p.id === "free_trial");
      const base = hasRemoteFree ? [] : [defaultFreePlan];
      const sortedRemote = [...remotePlans].sort((a, b) => {
        if (a.id === "free_trial") return -1;
        if (b.id === "free_trial") return 1;
        return 0;
      });
      basePlans = [...base, ...sortedRemote];
    }

    const parsePrice = (priceStr: string) => {
      const numeric = priceStr.replace(/[^\d,]/g, "").replace(",", ".");
      return parseFloat(numeric) || 0;
    };

    const monthly = basePlans.find((p) => p.id === "monthly");
    const yearly = basePlans.find((p) => p.id === "yearly");

    if (monthly && yearly) {
      const mPrice = parsePrice(monthly.price);
      const yPrice = parsePrice(yearly.price);
      const diff = (mPrice - yPrice) * 12;

      if (diff > 0) {
        const savingsText = `Economize R$ ${Math.round(diff)}/ano`;
        yearly.savings = savingsText;

        if (yearly.features) {
          yearly.features = yearly.features.map((f) =>
            f.toLowerCase().includes("economia de") ? `Economia de R$ ${Math.round(diff)}/ano` : f,
          );
        }
      }
    }

    return basePlans;
  })();

  const plansForCarousel = useMemo(() => {
    if (allPlans.length <= 2) return allPlans;

    const annualIndex = allPlans.findIndex((plan) => plan.id === "yearly" || plan.id === "annual");
    if (annualIndex < 0) return allPlans;

    const reordered = [...allPlans];
    const [annualPlan] = reordered.splice(annualIndex, 1);
    const middleIndex = Math.floor(reordered.length / 2);
    reordered.splice(middleIndex, 0, annualPlan);
    return reordered;
  }, [allPlans]);

  const annualPlanIndex = useMemo(
    () => plansForCarousel.findIndex((plan) => plan.id === "yearly" || plan.id === "annual"),
    [plansForCarousel],
  );

  useEffect(() => {
    if (!plansCarouselApi || annualPlanIndex < 0) return;
    plansCarouselApi.scrollTo(annualPlanIndex, true);
  }, [plansCarouselApi, annualPlanIndex]);

  const getPlanButtonConfig = (planId: string) => {
    if (!session) return { text: "Escolher plano e começar", disabled: false };

    if (profile?.role === "company" || profile?.role === "family") {
      return { text: "Somente para profissionais", disabled: true };
    }

    if (!userTier) return { text: "Escolher plano e começar", disabled: false };

    if (userTier === planId) {
      return { text: "Seu plano atual", disabled: true };
    }

    if (userTier === "yearly") {
      return { text: "Plano inferior", disabled: true };
    }

    if (userTier === "monthly") {
      if (planId === "yearly") return { text: "Fazer upgrade", disabled: false };
      return { text: "Plano inferior", disabled: true };
    }

    if (userTier === "free_trial") {
      if (planId === "free_trial") return { text: "Seu plano atual", disabled: true };
      return { text: "Escolher plano e começar", disabled: false };
    }

    return { text: "Escolher plano e começar", disabled: false };
  };

  const getAcademyCardContent = () => {
    if (!session) {
      return {
        title: "Destaque seu perfil agora",
        description:
          "Crie seu cadastro e deixe seu perfil visível para empresas e famílias que buscam profissionais na sua região.",
        buttonText: "Criar meu perfil",
        link: "/login#auth-sign-up",
        icon: GraduationCap,
      };
    }

    if (profile?.role === "professional") {
      return {
        title: "Mantenha seu perfil ativo",
        description:
          "Atualize suas informações para continuar recebendo contatos e novas oportunidades de atendimento.",
        buttonText: "Ir para meu painel",
        link: "/dashboard",
        icon: GraduationCap,
      };
    }

    return {
      title: "Perfil para profissionais",
      description:
        "Esta página é dedicada a profissionais da saúde que realizam atendimento domiciliar.",
      buttonText: "Buscar profissionais",
      link: "/buscar",
      icon: Search,
    };
  };

  const cardContent = getAcademyCardContent();
  const CardIcon = cardContent.icon;

  const professionalsMobileVideoUrl = String(config?.video_url_professionals_mobile || "").trim();
  const useProfessionalsMobileUrl = isMobile && professionalsMobileVideoUrl.length > 0;
  const landingVideo = resolveLandingVideoAssets(
    useProfessionalsMobileUrl ? null : config?.video_storage_path_professionals,
    useProfessionalsMobileUrl ? professionalsMobileVideoUrl : config?.video_url_professionals,
  );
  const landingVideoUrl = landingVideo.videoUrl;
  const landingVideoIsVerticalOnMobile =
    isMobile && resolveVideoOrientation(landingVideoUrl, config?.video_orientation_professionals) === "vertical";

  if (authLoading) {
    return (
      <div className="flex h-screen items-center justify-center">
        <Loader2 className="h-10 w-10 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <Layout>
      <section className="gradient-hero relative overflow-hidden px-2 py-14 md:px-0 md:py-20 lg:py-28">
        <div className="absolute inset-0 overflow-hidden">
          <div className="absolute -right-40 -top-40 h-80 w-80 rounded-full bg-primary/5" />
          <div className="absolute -bottom-40 -left-40 h-80 w-80 rounded-full bg-success/5" />
        </div>

        <div className="container relative mx-auto px-4">
          <div className="mobile-fade-up mx-auto max-w-4xl rounded-[2rem] border border-border/70 bg-card/75 px-4 py-8 text-center shadow-xl backdrop-blur-sm md:border-0 md:bg-transparent md:px-0 md:py-0 md:shadow-none">
            <div className="animate-fade-in mb-6 inline-flex items-center gap-2 rounded-full border border-border bg-card px-4 py-2 shadow-sm">
              <Heart className="h-4 w-4 text-primary" />
              <span className="text-sm font-medium text-muted-foreground">
                Home Care Match para profissionais da área da saúde
              </span>
            </div>

            <h1 className="animate-slide-up text-4xl font-bold leading-tight text-foreground md:text-5xl lg:text-6xl">
              Crie seu perfil profissional e seja encontrado por quem precisa de você
            </h1>

            <p className="animate-slide-up mx-auto mt-6 max-w-2xl text-lg text-muted-foreground" style={{ animationDelay: "0.1s" }}>
              A Home Care Match conecta profissionais da área da saúde a empresas de home care e famílias que buscam atendimento domiciliar.
            </p>
            <p className="animate-slide-up mx-auto mt-2 max-w-2xl text-lg text-muted-foreground" style={{ animationDelay: "0.12s" }}>
              Aumente sua visibilidade profissional e receba oportunidades de atendimento na sua região.
            </p>
            <ul
              className="animate-slide-up mx-auto mt-6 grid max-w-3xl gap-x-8 gap-y-3 text-left text-base text-muted-foreground sm:grid-cols-2"
              style={{ animationDelay: "0.14s" }}
            >
              <li className="flex items-start gap-2">
                <Shield className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                <span>Perfil profissional completo</span>
              </li>
              <li className="flex items-start gap-2">
                <Search className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                <span>Visibilidade por região e especialidade</span>
              </li>
              <li className="flex items-start gap-2">
                <Users className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                <span>Contato direto com empresas e famílias</span>
              </li>
              <li className="flex items-start gap-2">
                <Star className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                <span>Você escolhe quando aceitar novos atendimentos</span>
              </li>
            </ul>

            <div className="animate-slide-up mt-10 flex flex-col items-center justify-center gap-4 sm:flex-row" style={{ animationDelay: "0.2s" }}>
              {session ? (
                <Button size="lg" asChild className="w-full gap-2 sm:w-auto">
                  <Link to={profile?.is_admin || profile?.role === "admin" ? "/admin" : "/dashboard"}>
                    <LayoutDashboard className="h-4 w-4" />
                    Ir para meu painel
                  </Link>
                </Button>
              ) : (
                <Button size="lg" asChild className="w-full gap-2 sm:w-auto">
                  <Link to="/login#auth-sign-up">
                    Criar meu perfil
                    <ArrowRight className="h-4 w-4" />
                  </Link>
                </Button>
              )}
              <Button size="lg" variant="outline" asChild className="w-full sm:w-auto">
                <a href="#como-funciona">Ver como funciona</a>
              </Button>
              <WhatsAppContactButton
                placementId="home_hero_profissional"
                variant="inline-primary"
                label="Falar com Comercial"
                className="w-full sm:w-auto"
              />
            </div>
            <p className="animate-slide-up mx-auto mt-3 max-w-2xl text-sm text-muted-foreground" style={{ animationDelay: "0.22s" }}>
              Leva menos de 3 minutos para começar.
            </p>
          </div>
        </div>
      </section>

      {landingVideoUrl && (
        <section className="py-12 bg-secondary/10">
          <div className="container mx-auto px-4">
            <div
              className={`mx-auto overflow-hidden rounded-2xl border border-border/60 shadow-sm ${
                landingVideoIsVerticalOnMobile ? "max-w-[360px] aspect-[9/16]" : "max-w-4xl aspect-video"
              }`}
            >
              <LandingVideoPlayer
                url={landingVideoUrl}
                title="Apresentação para profissionais"
                autoplay={false}
                deferLoad={true}
                posterUrl={landingVideo.posterUrl}
              />
            </div>
          </div>
        </section>
      )}

      <section id="como-funciona" className="scroll-mt-20 py-14 md:py-20">
        <div className="container mx-auto px-4">
          <div className="mb-12 text-center">
            <h2 className="text-3xl font-bold text-foreground">Como funciona a Home Care Match</h2>
            <p className="mx-auto mt-4 max-w-2xl text-muted-foreground">
              Criar seu perfil é simples. Em poucos passos você já pode começar a receber oportunidades de atendimento.
            </p>
          </div>

          <div className="mobile-stagger mx-auto grid max-w-5xl gap-4 md:gap-8 md:grid-cols-2 lg:grid-cols-4">
            {[
              {
                step: "1",
                title: "Crie seu perfil profissional",
                description: "Cadastre suas informações, especialidades e região de atendimento.",
              },
              {
                step: "2",
                title: "Seja encontrado por quem precisa",
                description: "Empresas de home care e famílias podem visualizar seu perfil na plataforma.",
              },
              {
                step: "3",
                title: "Receba contatos e oportunidades",
                description: "Profissionais cadastrados podem ser procurados diretamente para atendimentos.",
              },
              {
                step: "4",
                title: "Escolha quando aceitar",
                description: "Você decide quais oportunidades deseja aceitar.",
              },
            ].map((item, index) => (
              <div
                key={index}
                className="relative rounded-3xl border border-border/70 bg-card/80 p-5 text-center shadow-sm md:border-0 md:bg-transparent md:p-0 md:shadow-none"
              >
                <div className="mb-4 inline-flex h-14 w-14 items-center justify-center rounded-2xl bg-primary text-xl font-bold text-primary-foreground">
                  {item.step}
                </div>
                <h3 className="mb-2 text-lg font-semibold text-foreground">{item.title}</h3>
                <p className="text-sm text-muted-foreground">{item.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="py-20 bg-card border-y border-border overflow-hidden">
        <div className="container mx-auto px-4">
          <div className="grid gap-12 lg:grid-cols-2 lg:items-center">
            <div className="space-y-6">
              <div className="inline-flex items-center gap-2 rounded-full bg-primary/10 px-4 py-2 text-primary">
                <BookOpen className="h-5 w-5" />
                <span className="text-sm font-bold uppercase tracking-wider">Profissionais de Home Care</span>
              </div>

              <h2 className="text-3xl font-bold text-foreground md:text-4xl">
                Para quais profissionais a plataforma foi criada
              </h2>

              <p className="text-lg text-muted-foreground leading-relaxed">
                A Home Care Match foi criada para profissionais da área da saúde que realizam atendimentos domiciliares.
              </p>

              <div className="grid gap-6 sm:grid-cols-2">
                <div className="space-y-2">
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
                    <Award className="h-6 w-6" />
                  </div>
                  <h4 className="font-bold">Lista de profissionais</h4>
                  <ul className="space-y-1 text-sm text-muted-foreground">
                    <li>• Enfermeiro(a)</li>
                    <li>• Técnico(a) de Enfermagem</li>
                    <li>• Cuidador(a)</li>
                    <li>• Fisioterapeuta</li>
                    <li>• Fonoaudiólogo(a)</li>
                    <li>• Terapeuta Ocupacional</li>
                  </ul>
                </div>
                <div className="space-y-2">
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
                    <ShieldCheck className="h-6 w-6" />
                  </div>
                  <h4 className="font-bold">E muito mais…</h4>
                  <p className="text-sm text-muted-foreground">
                    Se você atua com atendimento domiciliar, pode criar seu perfil e aumentar sua visibilidade profissional.
                  </p>
                </div>
              </div>

              <div className="rounded-2xl bg-secondary/30 p-6 border border-border/50">
                <h4 className="font-bold flex items-center gap-2 mb-4">
                  <Zap className="h-5 w-5 text-amber-500 fill-amber-500" />
                  Como funciona a Home Care Match
                </h4>
                <div className="space-y-4">
                  <div className="flex items-start gap-3">
                    <div className="mt-1 h-2 w-2 rounded-full bg-primary shrink-0" />
                    <p className="text-sm">
                      Criar seu perfil é simples. Em poucos passos você já pode começar a receber oportunidades de atendimento.
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
                    <p className="text-muted-foreground">{cardContent.description}</p>
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

      <section className="py-14 md:py-20">
        <div className="container mx-auto px-4">
          <div className="mb-12 text-center">
            <h2 className="text-3xl font-bold text-foreground">Por que criar seu perfil na Home Care Match</h2>
            <p className="mx-auto mt-4 max-w-2xl text-muted-foreground">
              Ter um perfil profissional na plataforma ajuda você a ser encontrado por empresas e famílias que procuram profissionais para atendimento domiciliar.
            </p>
          </div>

          <div className="mobile-stagger mx-auto grid max-w-4xl gap-4 md:grid-cols-2">
            {[
              "Mais visibilidade profissional",
              "Oportunidades de atendimento na sua região",
              "Contato direto com empresas e famílias",
              "Perfil profissional organizado em um só lugar",
              "Mais praticidade para encontrar atendimentos",
              "Credibilidade para seu trabalho",
            ].map((benefit) => (
              <div
                key={benefit}
                className="relative rounded-3xl border border-border/70 bg-card/80 p-5 shadow-sm md:border-0 md:bg-transparent md:p-0 md:shadow-none"
              >
                <p className="text-base text-foreground">
                  <span className="font-semibold">✔</span> {benefit}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section id="planos" className="scroll-mt-20 bg-white py-20">
        <div className="container mx-auto px-4">
          <div className="mb-12 text-center">
            <h2 className="text-3xl font-bold text-foreground">
              Escolha o plano ideal para você
            </h2>
            <p className="mx-auto mt-4 max-w-2xl text-muted-foreground">
              Com sua assinatura você mantém seu perfil ativo na plataforma e aumenta suas chances de receber oportunidades de atendimento.
            </p>
          </div>

          <p className="md:hidden text-center text-xs text-muted-foreground mb-4">
            Dica: arraste para o lado para ver todos os planos.
          </p>

          {/* Banner de cupom público — campanha de pré-lançamento */}
          {publicCoupon && (
            <div className="mb-8 mx-auto max-w-2xl">
              <PublicCouponBanner
                coupon={publicCoupon}
                variant="coupon-field"
                onUseCoupon={() => {
                  // Na página pública apenas copia o código; o usuário aplica no cadastro
                }}
              />
            </div>
          )}

          <Carousel
            className="w-full"
            setApi={setPlansCarouselApi}
            opts={{ align: "center", startIndex: annualPlanIndex >= 0 ? annualPlanIndex : 0 }}
          >
            <CarouselContent className="mobile-stagger items-stretch">
              {plansForCarousel.map((plan) => {
                const btnConfig = getPlanButtonConfig(plan.id);
                return (
                  <CarouselItem key={plan.id} className="basis-full md:basis-1/2 lg:basis-1/3">
                    <div className="p-2 h-full flex flex-col">
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
                      {/* Destaque de cupom no card do plano mensal */}
                      {plan.id === "monthly" && publicCoupon?.highlight_on_monthly_plan && (
                        <div className="mt-2 px-2">
                          <PublicCouponBanner
                            coupon={publicCoupon}
                            variant="monthly-card"
                            onUseCoupon={() => {}}
                          />
                        </div>
                      )}
                    </div>
                  </CarouselItem>
                );
              })}
            </CarouselContent>
            <div className="mt-6 flex items-center justify-center gap-4 md:hidden">
              <CarouselPrevious className="relative" />
              <CarouselNext className="relative" />
            </div>
          </Carousel>
        </div>
      </section>

      {/* Seção de explicação com layout de 3 colunas e sem asteriscos */}
      <section className="bg-secondary/30 py-14 md:py-20">
        <div className="container mx-auto px-4">
          <div className="mb-16 text-center max-w-4xl mx-auto">
            <h2 className="text-3xl font-bold text-foreground md:text-4xl">
              Por que investimos nos profissionais e oferecemos gratuidade para empresas e famílias?
            </h2>
            <p className="mt-6 text-muted-foreground text-lg leading-relaxed">
              Na Home Care Match, nossa missão é criar um ecossistema de saúde domiciliar eficiente e de alta qualidade. Para isso, focamos em valorizar e capacitar os profissionais, que são o coração do atendimento.
            </p>
          </div>

          <div className="space-y-16">
            {/* Bloco Profissionais - 3 Colunas */}
            <div className="space-y-8">
              <div className="flex items-center gap-3 justify-center md:justify-start">
                <div className="h-8 w-1 bg-primary rounded-full" />
                <h3 className="text-2xl font-bold text-primary">Para os Profissionais (você)</h3>
              </div>
              
              <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
                {[
                  {
                    title: "Oportunidades Reais",
                    text: "Acreditamos que um pequeno investimento mensal na plataforma se traduz em grandes oportunidades e um futuro mais promissor para sua carreira."
                  },
                  {
                    title: "Qualidade e Segurança",
                    text: "Investimos em tecnologia para garantir que seu perfil seja visto por quem realmente precisa, com um ambiente seguro e confiável."
                  },
                  {
                    title: "Visibilidade e Conexão",
                    text: "Promovemos seu perfil ativamente para empresas e famílias, aumentando suas chances de encontrar novos atendimentos e expandir sua carreira."
                  },
                  {
                    title: "Desenvolvimento Contínuo",
                    text: "Tenha acesso a cursos gratuitos e a cursos avançados com um investimento extremamente baixo em nossa Academy, para aprimorar suas habilidades."
                  },
                  {
                    title: "Ferramentas para o Dia a Dia",
                    text: "Investimos em funcionalidades que beneficiam você, com recursos pensados para simplificar sua rotina e te dar mais tempo para o cuidado."
                  },
                  {
                    title: "Sustentabilidade",
                    text: "Sua contribuição é fundamental para a evolução da Home Care Match, garantindo que possamos continuar aprimorando a plataforma para você."
                  }
                ].map((item, i) => (
                  <div key={i} className="bg-card p-6 rounded-2xl border border-border/50 shadow-sm hover:shadow-md transition-shadow">
                    <CheckCircle2 className="h-6 w-6 text-success mb-4" />
                    <h4 className="font-bold text-foreground mb-2">{item.title}</h4>
                    <p className="text-sm text-muted-foreground leading-relaxed">{item.text}</p>
                  </div>
                ))}
              </div>
            </div>

            {/* Bloco Empresas/Famílias - 3 Colunas */}
            <div className="space-y-8">
              <div className="flex items-center gap-3 justify-center md:justify-start">
                <div className="h-8 w-1 bg-foreground rounded-full" />
                <h3 className="text-2xl font-bold text-foreground">Para Empresas e Famílias</h3>
              </div>

              <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
                {[
                  {
                    title: "Acesso Facilitado",
                    text: "Oferecemos o acesso gratuito porque entendemos a urgência e a sensibilidade de encontrar o profissional certo para o cuidado domiciliar."
                  },
                  {
                    title: "Conexão Vital",
                    text: "Queremos remover barreiras e facilitar essa conexão, garantindo acesso rápido e sem custos a uma rede qualificada de profissionais como você."
                  },
                  {
                    title: "Ciclo Virtuoso",
                    text: "Ao empoderar os profissionais, garantimos que empresas e famílias encontrem os melhores talentos, fortalecendo todo o setor de home care."
                  }
                ].map((item, i) => (
                  <div key={i} className="bg-card/50 p-6 rounded-2xl border border-border/50 shadow-sm">
                    <CheckCircle2 className="h-6 w-6 text-success mb-4" />
                    <h4 className="font-bold text-foreground mb-2">{item.title}</h4>
                    <p className="text-sm text-muted-foreground leading-relaxed">{item.text}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="bg-secondary/10 py-14 md:py-20">
        <div className="container mx-auto px-4 max-w-3xl">
          <div className="mb-12 text-center">
            <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
              <HelpCircle className="h-6 w-6 text-primary" />
            </div>
            <h2 className="text-3xl font-bold text-foreground">Dúvidas frequentes</h2>
            <p className="mt-4 text-muted-foreground">
              Respostas rápidas para você começar com mais confiança.
            </p>
          </div>

          <Accordion type="single" collapsible className="mobile-stagger w-full space-y-4">
            {faqs.map((faq, index) => (
              <AccordionItem
                key={index}
                value={`item-${index}`}
                className="rounded-xl border border-primary/5 bg-card px-4 shadow-sm md:px-6"
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
                Ver todas as dúvidas
                <ArrowRight className="h-4 w-4" />
              </Link>
            </Button>
          </div>
        </div>
      </section>

      <section className="bg-primary py-16 md:py-20">
        <div className="container mx-auto px-4 text-center">
          <h2 className="text-3xl font-bold text-primary-foreground">
            Pronto para aumentar suas oportunidades no Home Care?
          </h2>
          <p className="mx-auto mt-4 max-w-2xl text-primary-foreground/80">
            Crie seu perfil profissional e comece a ser encontrado por empresas e famílias que precisam de profissionais de saúde para atendimento domiciliar.
          </p>
          <Button size="lg" variant="secondary" className="mt-8 w-full gap-2 sm:w-auto" asChild>
            <Link to="/login#auth-sign-up">
              Criar meu perfil
              <ArrowRight className="h-4 w-4" />
            </Link>
          </Button>
        </div>
      </section>

      <SubscriptionCouponModal
        open={selectedPlanForCheckout !== null}
        onOpenChange={(open) => {
          if (!open) setSelectedPlanForCheckout(null);
        }}
        planId={selectedPlanForCheckout}
        onProceedToCheckout={handlePlanCheckout}
      />
    </Layout>
  );
};

export default Index;