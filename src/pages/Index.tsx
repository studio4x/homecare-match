import { Link, useLocation, useNavigate } from "react-router-dom";
import { useEffect, useMemo, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Button } from "@/components/ui/button";
import Layout from "@/components/layout/Layout";
import PricingCard from "@/components/PricingCard";
import SeoMeta from "@/components/SeoMeta";
import SubscriptionCouponModal from "@/components/SubscriptionCouponModal";
import { useAuth } from "@/components/auth/AuthProvider";
import { useProfessionalStats } from "@/hooks/use-professional-stats";
import { createCheckoutSession } from "@/lib/checkout";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import {
  ArrowRight,
  BadgeCheck,
  CalendarCheck,
  CheckCircle2,
  HandHeart,
  Headset,
  Loader2,
  MessageSquare,
  Search,
  ShieldCheck,
  Stethoscope,
  UserPlus,
} from "lucide-react";

type PlanId = "monthly" | "yearly";
type CtaLocation = "hero" | "header" | "sticky" | "footer" | "plans";

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

interface RawPlanRow {
  id: string;
  name: string;
  price: string;
  period: string;
  description: string | null;
  features: unknown;
  popular: boolean | null;
  savings: string | null;
  asaas_installment_max: number | null;
}

const PAGE_VARIANT = "profissionais";

const heroHeadlineVariants = [
  "Receba oportunidades de Home Care na sua regiao.",
  "Conecte-se a empresas e familias e consiga atendimentos de Home Care.",
  "Seu perfil profissional visivel para quem precisa de voce no Home Care.",
];

const heroBullets = [
  "Perfil profissional com informacoes completas",
  "Visibilidade para empresas de Home Care e familias",
  "Oportunidades por regiao e especialidade",
  "Voce escolhe quando aceitar",
  "Tudo organizado em um so lugar",
];

const howItWorksSteps = [
  {
    icon: UserPlus,
    title: "Crie seu perfil",
    description: "Preencha seus dados profissionais em poucos minutos.",
  },
  {
    icon: Search,
    title: "Seja encontrado por empresas e familias",
    description: "Seu perfil fica disponivel para quem busca atendimento domiciliar.",
  },
  {
    icon: MessageSquare,
    title: "Receba convites e contatos",
    description: "Chegam oportunidades alinhadas ao seu perfil e especialidade.",
  },
  {
    icon: CalendarCheck,
    title: "Feche atendimentos conforme sua disponibilidade",
    description: "Aceite as oportunidades que fazem sentido para sua agenda.",
  },
];

const targetProfessions = [
  "Enfermeiro(a)",
  "Tecnico(a) de Enfermagem",
  "Cuidador(a)",
  "Fisioterapeuta",
  "Fonoaudiologo(a)",
  "Terapeuta Ocupacional",
];

const benefitCards = [
  {
    title: "Mais visibilidade",
    description: "Seu perfil aparece para quem realmente esta contratando.",
  },
  {
    title: "Oportunidades segmentadas por regiao",
    description: "Mais chance de fechar atendimentos perto de voce.",
  },
  {
    title: "Contato direto e rapido",
    description: "Conexao sem intermediarios desnecessarios.",
  },
  {
    title: "Perfil profissional completo",
    description: "Mostre experiencia, especialidades e diferenciais.",
  },
  {
    title: "Organizacao e praticidade",
    description: "Tudo centralizado para voce acompanhar oportunidades.",
  },
  {
    title: "Credibilidade para o seu trabalho",
    description: "Conta verificada gera mais confianca no seu perfil.",
  },
];

const testimonialPlaceholders = [
  {
    quote: "Espaco reservado para depoimento real de profissional.",
    author: "Depoimento 01",
    role: "Campo editavel via admin",
  },
  {
    quote: "Espaco reservado para depoimento real de profissional.",
    author: "Depoimento 02",
    role: "Campo editavel via admin",
  },
  {
    quote: "Espaco reservado para depoimento real de profissional.",
    author: "Depoimento 03",
    role: "Campo editavel via admin",
  },
];

const faqs = [
  {
    question: "Preciso pagar para me cadastrar?",
    answer:
      "O cadastro inicial e rapido. A assinatura ativa recursos premium de visibilidade e destaque.",
  },
  {
    question: "Como as oportunidades chegam ate mim?",
    answer:
      "Empresas e familias visualizam seu perfil e iniciam contato quando ha compatibilidade com sua especialidade.",
  },
  {
    question: "Quais regioes sao atendidas?",
    answer:
      "A plataforma conecta oportunidades por regiao. A cobertura cresce conforme a demanda de cada localidade.",
  },
  {
    question: "Quais profissoes podem se cadastrar?",
    answer:
      "Profissionais de saude e cuidado domiciliar, como enfermagem, cuidadores e terapeutas.",
  },
  {
    question: "Como funciona a assinatura?",
    answer:
      "Voce escolhe entre plano mensal e anual para manter recursos premium ativos no perfil.",
  },
  {
    question: "Posso cancelar quando quiser?",
    answer:
      "Sim. O cancelamento pode ser feito sem fidelidade, conforme as regras do seu plano.",
  },
  {
    question: "Como meus dados sao protegidos?",
    answer:
      "Aplicamos boas praticas de seguranca para proteger dados pessoais e acessos da conta.",
  },
  {
    question: "Como falo com o suporte?",
    answer:
      "Voce pode acionar o suporte pelos canais oficiais dentro da plataforma quando precisar.",
  },
  {
    question: "Cadastro verificado aumenta minhas chances?",
    answer:
      "Perfis com verificacao costumam transmitir mais confianca durante a avaliacao.",
  },
  {
    question: "Posso escolher quais atendimentos aceitar?",
    answer:
      "Sim. Voce decide quais oportunidades seguir, conforme sua disponibilidade.",
  },
];

const defaultFreePlan: DbPlan = {
  id: "free_trial",
  name: "Comece agora",
  price: "R$ 0,00",
  period: "mes",
  description: "Cadastro para iniciar seu perfil profissional.",
  features: [
    "Perfil profissional inicial",
    "Acesso para configurar sua conta",
    "Assinatura ativa recursos premium",
  ],
  popular: false,
};

const defaultPlans: DbPlan[] = [
  {
    id: "monthly",
    name: "Plano mensal",
    price: "R$ 49,90",
    period: "mes",
    description: "Plano principal para ganhar visibilidade e receber contatos.",
    features: [
      "Visibilidade para empresas e familias",
      "Recebimento de oportunidades",
      "Contato direto na plataforma",
      "Suporte padrao",
    ],
    popular: true,
  },
  {
    id: "yearly",
    name: "Plano anual",
    price: "R$ 39,90",
    period: "mes",
    description: "Melhor custo-beneficio com desconto anual.",
    features: [
      "Tudo do plano mensal",
      "Economia anual",
      "Maior previsibilidade de custo",
      "Suporte prioritario",
    ],
    popular: false,
    savings: "Economize no anual",
    asaas_installment_max: 12,
  },
];

const pushDataLayer = (payload: Record<string, unknown>) => {
  if (typeof window === "undefined") return;
  window.dataLayer = window.dataLayer || [];
  window.dataLayer.push(payload);
};

const Index = () => {
  const { session, user, loading: authLoading } = useAuth();
  const { data: professionalStats } = useProfessionalStats();
  const navigate = useNavigate();
  const location = useLocation();
  const [loadingPlan, setLoadingPlan] = useState<string | null>(null);
  const [selectedPlanForCheckout, setSelectedPlanForCheckout] = useState<PlanId | null>(null);
  const trackedScroll50 = useRef(false);
  const trackedScroll90 = useRef(false);
  const trackedPlansView = useRef(false);
  const plansSectionRef = useRef<HTMLElement | null>(null);

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
      if (profile.is_admin || profile.role === "admin") {
        navigate("/admin", { replace: true });
      } else {
        navigate("/dashboard", { replace: true });
      }
    }
  }, [authLoading, isLoadingProfile, location.hash, navigate, profile, session]);

  const trackCtaClick = (ctaLocation: CtaLocation) => {
    pushDataLayer({
      event: "hcm_lp_profissionais_cta_click",
      cta_location: ctaLocation,
      page_variant: PAGE_VARIANT,
    });
  };

  useEffect(() => {
    const onScroll = () => {
      const maxScroll = document.documentElement.scrollHeight - window.innerHeight;
      if (maxScroll <= 0) return;
      const percentage = (window.scrollY / maxScroll) * 100;

      if (percentage >= 50 && !trackedScroll50.current) {
        trackedScroll50.current = true;
        pushDataLayer({ event: "hcm_lp_profissionais_scroll_50", page_variant: PAGE_VARIANT });
      }

      if (percentage >= 90 && !trackedScroll90.current) {
        trackedScroll90.current = true;
        pushDataLayer({ event: "hcm_lp_profissionais_scroll_90", page_variant: PAGE_VARIANT });
      }
    };

    window.addEventListener("scroll", onScroll, { passive: true });
    onScroll();
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => {
    const target = plansSectionRef.current;
    if (!target || trackedPlansView.current) return;

    const observer = new IntersectionObserver(
      (entries) => {
        const hasIntersected = entries.some((entry) => entry.isIntersecting);
        if (!hasIntersected || trackedPlansView.current) return;

        trackedPlansView.current = true;
        pushDataLayer({ event: "hcm_lp_profissionais_view_plans", page_variant: PAGE_VARIANT });
        observer.disconnect();
      },
      { threshold: 0.35 },
    );

    observer.observe(target);
    return () => observer.disconnect();
  }, []);

  const handlePlanCheckout = async (planId: PlanId) => {
    setSelectedPlanForCheckout(null);
    if (!session) {
      toast.info("Por favor, crie uma conta ou faca login para continuar.");
      navigate("/login#auth-sign-up");
      return;
    }

    const toastId = toast.loading("Iniciando checkout...");
    setLoadingPlan(planId);

    try {
      const data = await createCheckoutSession({ planId });
      if (!data?.url) throw new Error("URL de checkout nao retornada pelo servidor.");
      toast.dismiss(toastId);
      toast.success("Redirecionando para pagamento...");
      window.location.href = data.url;
    } catch (error: unknown) {
      toast.dismiss(toastId);
      const cleanMessage =
        error instanceof Error
          ? error.message.replace("Edge Function returned a non-2xx status code", "").trim()
          : "";
      toast.error(`Erro: ${cleanMessage || "Falha ao iniciar pagamento."}`);
    } finally {
      setLoadingPlan(null);
    }
  };

  const handleSubscribe = async (planId: string) => {
    trackCtaClick("plans");

    if (!session) {
      toast.info("Por favor, crie uma conta ou faca login para continuar.");
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

    toast.error("Plano invalido para checkout.");
  };

  const userTier = profile?.subscription_tier || null;

  const getPlanButtonConfig = (planId: string) => {
    if (!session) return { text: "Criar perfil", disabled: false };
    if (profile?.role === "company" || profile?.role === "family") {
      return { text: "Somente para profissionais", disabled: true };
    }

    if (!userTier) return { text: "Assinar agora", disabled: false };
    if (userTier === planId) return { text: "Seu plano atual", disabled: true };
    if (userTier === "yearly") return { text: "Plano inferior", disabled: true };
    if (userTier === "monthly") {
      if (planId === "yearly") return { text: "Fazer upgrade", disabled: false };
      return { text: "Plano inferior", disabled: true };
    }
    if (userTier === "free_trial") {
      if (planId === "free_trial") return { text: "Seu plano atual", disabled: true };
      return { text: "Assinar agora", disabled: false };
    }
    return { text: "Assinar agora", disabled: false };
  };

  const { data: remotePlans } = useQuery({
    queryKey: ["plans"],
    queryFn: async (): Promise<DbPlan[]> => {
      const { data, error } = await supabase.from("plans").select("*").order("price", { ascending: true });
      if (error) throw error;
      const rows = (data || []) as RawPlanRow[];
      return rows.map((plan) => ({
        id: plan.id,
        name: plan.name,
        price: plan.price,
        period: plan.period,
        description: plan.description ?? "",
        features: Array.isArray(plan.features)
          ? plan.features.filter((feature): feature is string => typeof feature === "string")
          : [],
        popular: !!plan.popular,
        savings: plan.savings ?? undefined,
        asaas_installment_max: plan.asaas_installment_max ?? undefined,
      }));
    },
    staleTime: 1000 * 60 * 5,
  });

  const allPlans = useMemo(() => {
    const parsePrice = (price: string) => {
      const numeric = price.replace(/[^\d,]/g, "").replace(",", ".");
      return Number.parseFloat(numeric) || 0;
    };

    let plans: DbPlan[] = [];

    if (!remotePlans || remotePlans.length === 0) {
      plans = [defaultFreePlan, ...defaultPlans];
    } else {
      const hasRemoteFree = remotePlans.some((plan) => plan.id === "free_trial");
      const sortedRemote = [...remotePlans].sort((a, b) => {
        if (a.id === "free_trial") return -1;
        if (b.id === "free_trial") return 1;
        return 0;
      });
      plans = [...(hasRemoteFree ? [] : [defaultFreePlan]), ...sortedRemote];
    }

    const monthly = plans.find((plan) => plan.id === "monthly");
    const yearly = plans.find((plan) => plan.id === "yearly");
    if (monthly && yearly) {
      const monthlyValue = parsePrice(monthly.price);
      const yearlyValue = parsePrice(yearly.price);
      const yearlySavings = (monthlyValue - yearlyValue) * 12;
      if (yearlySavings > 0) {
        yearly.savings = `Economize R$ ${Math.round(yearlySavings)}/ano`;
      }
    }

    return plans;
  }, [remotePlans]);

  const professionalCount =
    typeof professionalStats?.total === "number" && professionalStats.total > 0
      ? `+${professionalStats.total.toLocaleString("pt-BR")}`
      : "+X";

  const numbersStrip = [
    { value: professionalCount, label: "profissionais cadastrados" },
    { value: "Campo", label: "numero editavel via admin" },
    { value: "Campo", label: "numero editavel via admin" },
  ];

  const faqSchema = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: faqs.map((faq) => ({
      "@type": "Question",
      name: faq.question,
      acceptedAnswer: {
        "@type": "Answer",
        text: faq.answer,
      },
    })),
  };

  const primaryCtaHref = session
    ? profile?.is_admin || profile?.role === "admin"
      ? "/admin"
      : "/dashboard"
    : "/login#auth-sign-up";

  const primaryCtaText = session ? "Ir para meu painel" : "Criar meu perfil agora";

  if (authLoading) {
    return (
      <div className="flex h-screen items-center justify-center">
        <Loader2 className="h-10 w-10 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <Layout>
      <SeoMeta
        appendSiteName={false}
        title="Home Care Match | Oportunidades de Home Care para Profissionais"
        description="Cadastre-se como profissional e aumente suas chances de conseguir atendimentos de Home Care na sua regiao. Perfil completo, visibilidade e praticidade."
        jsonLd={faqSchema}
      />

      <section className="gradient-hero relative overflow-hidden py-14 md:py-20">
        <div className="absolute inset-0 overflow-hidden">
          <div className="absolute -right-32 -top-32 h-72 w-72 rounded-full bg-primary/10 blur-2xl" />
          <div className="absolute -bottom-24 -left-24 h-64 w-64 rounded-full bg-success/10 blur-2xl" />
        </div>

        <div className="container relative mx-auto px-4">
          <div className="mx-auto max-w-4xl rounded-3xl border border-border/70 bg-card/90 p-6 text-center shadow-xl md:p-10">
            <span className="inline-flex items-center gap-2 rounded-full border border-border bg-background px-3 py-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              <Stethoscope className="h-4 w-4 text-primary" />
              Landing para profissionais
            </span>

            <h1 className="mt-5 text-3xl font-bold leading-tight text-foreground md:text-5xl">
              {heroHeadlineVariants[0]}
            </h1>

            <p className="mx-auto mt-4 max-w-2xl text-base text-muted-foreground md:text-lg">
              Crie seu perfil em minutos e aumente suas chances de fechar atendimentos.
            </p>

            <ul className="mx-auto mt-6 grid max-w-2xl gap-2 text-left">
              {heroBullets.map((bullet) => (
                <li key={bullet} className="flex items-start gap-2 text-sm text-foreground/90">
                  <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-success" />
                  <span>{bullet}</span>
                </li>
              ))}
            </ul>

            <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
              <Button asChild size="lg" className="w-full gap-2 sm:w-auto">
                <Link to={primaryCtaHref} onClick={() => trackCtaClick("hero")}>
                  {primaryCtaText}
                  <ArrowRight className="h-4 w-4" />
                </Link>
              </Button>
              <Button asChild size="lg" variant="outline" className="w-full sm:w-auto">
                <a href="#como-funciona">Ver como funciona</a>
              </Button>
            </div>

            <p className="mt-3 text-xs text-muted-foreground">
              Leva menos de 3 minutos. Sem compromisso para comecar.
            </p>

            <div className="mt-6 grid gap-2 text-left sm:grid-cols-3">
              <div className="rounded-xl border border-border bg-background p-3 text-sm">
                <div className="flex items-center gap-2 font-medium">
                  <ShieldCheck className="h-4 w-4 text-primary" />
                  Dados protegidos
                </div>
              </div>
              <div className="rounded-xl border border-border bg-background p-3 text-sm">
                <div className="flex items-center gap-2 font-medium">
                  <BadgeCheck className="h-4 w-4 text-primary" />
                  Cadastro verificado
                </div>
              </div>
              <div className="rounded-xl border border-border bg-background p-3 text-sm">
                <div className="flex items-center gap-2 font-medium">
                  <Headset className="h-4 w-4 text-primary" />
                  Suporte
                </div>
              </div>
            </div>

            <div className="sr-only" aria-hidden>
              {heroHeadlineVariants.slice(1).join(" | ")}
            </div>
          </div>
        </div>
      </section>

      <section id="como-funciona" className="scroll-mt-24 py-14 md:py-20">
        <div className="container mx-auto px-4">
          <div className="mx-auto mb-10 max-w-2xl text-center">
            <h2 className="text-3xl font-bold text-foreground">Como funciona</h2>
            <p className="mt-3 text-muted-foreground">Quatro passos simples para ganhar mais oportunidades.</p>
          </div>

          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            {howItWorksSteps.map((step) => (
              <article key={step.title} className="rounded-2xl border border-border/80 bg-card p-5 shadow-sm">
                <div className="mb-3 inline-flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
                  <step.icon className="h-5 w-5" />
                </div>
                <h3 className="text-base font-semibold">{step.title}</h3>
                <p className="mt-2 text-sm text-muted-foreground">{step.description}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="bg-secondary/20 py-14 md:py-20">
        <div className="container mx-auto px-4">
          <div className="mx-auto mb-10 max-w-2xl text-center">
            <h2 className="text-3xl font-bold text-foreground">Para quem e</h2>
            <p className="mt-3 text-muted-foreground">
              Atendimentos domiciliares por demanda na sua regiao.
            </p>
          </div>

          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {targetProfessions.map((profession) => (
              <article key={profession} className="rounded-2xl border border-border bg-card p-5 shadow-sm">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
                    <HandHeart className="h-5 w-5" />
                  </div>
                  <h3 className="text-base font-semibold">{profession}</h3>
                </div>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="py-14 md:py-20">
        <div className="container mx-auto px-4">
          <div className="mx-auto mb-10 max-w-2xl text-center">
            <h2 className="text-3xl font-bold text-foreground">Beneficios</h2>
            <p className="mt-3 text-muted-foreground">Motivos para manter seu perfil ativo e competitivo.</p>
          </div>

          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {benefitCards.map((benefit) => (
              <article key={benefit.title} className="rounded-2xl border border-border bg-card p-5 shadow-sm">
                <h3 className="text-base font-semibold">{benefit.title}</h3>
                <p className="mt-2 text-sm text-muted-foreground">{benefit.description}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="bg-secondary/20 py-14 md:py-20">
        <div className="container mx-auto px-4">
          <div className="mx-auto mb-10 max-w-2xl text-center">
            <h2 className="text-3xl font-bold text-foreground">Confianca e prova social</h2>
            <p className="mt-3 text-muted-foreground">
              Estrutura pronta para inserir depoimentos e numeros reais via admin.
            </p>
          </div>

          <div className="grid gap-3 rounded-2xl border border-border bg-card p-4 sm:grid-cols-3">
            {numbersStrip.map((item) => (
              <div key={item.label} className="rounded-xl border border-border/70 bg-background p-4 text-center">
                <p className="text-2xl font-bold text-foreground">{item.value}</p>
                <p className="mt-1 text-xs uppercase tracking-wide text-muted-foreground">{item.label}</p>
              </div>
            ))}
          </div>

          <div className="mt-6 grid gap-4 md:grid-cols-3">
            {testimonialPlaceholders.map((item) => (
              <article key={item.author} className="rounded-2xl border border-border bg-card p-5 shadow-sm">
                <p className="text-sm text-muted-foreground">"{item.quote}"</p>
                <div className="mt-4 border-t border-border pt-3">
                  <p className="font-semibold text-foreground">{item.author}</p>
                  <p className="text-xs text-muted-foreground">{item.role}</p>
                </div>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section id="planos" ref={plansSectionRef} className="scroll-mt-24 py-14 md:py-20">
        <div className="container mx-auto px-4">
          <div className="mx-auto mb-10 max-w-2xl text-center">
            <h2 className="text-3xl font-bold text-foreground">Planos</h2>
            <p className="mt-3 text-muted-foreground">
              Escolha seu plano e mantenha seu perfil profissional em destaque.
            </p>
            <p className="mt-2 text-sm text-muted-foreground">
              A assinatura ativa recursos premium de visibilidade e oportunidades.
            </p>
          </div>

          <div className="grid items-stretch gap-4 md:grid-cols-2 lg:grid-cols-3">
            {allPlans.map((plan) => {
              const buttonConfig = getPlanButtonConfig(plan.id);
              return (
                <PricingCard
                  key={plan.id}
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
                  buttonText={buttonConfig.text}
                  isDisabled={buttonConfig.disabled}
                />
              );
            })}
          </div>
        </div>
      </section>

      <section id="duvidas" className="scroll-mt-24 bg-secondary/20 py-14 md:py-20">
        <div className="container mx-auto max-w-3xl px-4">
          <div className="mb-10 text-center">
            <h2 className="text-3xl font-bold text-foreground">FAQ</h2>
            <p className="mt-3 text-muted-foreground">Respostas rapidas para reduzir duvidas antes do cadastro.</p>
          </div>

          <Accordion type="single" collapsible className="space-y-3">
            {faqs.map((faq) => (
              <AccordionItem key={faq.question} value={faq.question} className="rounded-xl border border-border bg-card px-4">
                <AccordionTrigger className="text-left font-semibold hover:no-underline">
                  {faq.question}
                </AccordionTrigger>
                <AccordionContent className="text-sm text-muted-foreground">{faq.answer}</AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        </div>
      </section>

      <section className="bg-primary py-14 md:py-20">
        <div className="container mx-auto px-4 text-center">
          <h2 className="text-3xl font-bold text-primary-foreground">
            Pronto para aumentar suas oportunidades no Home Care?
          </h2>
          <Button asChild size="lg" variant="secondary" className="mt-8 gap-2">
            <Link to={primaryCtaHref} onClick={() => trackCtaClick("footer")}>
              Criar meu perfil
              <ArrowRight className="h-4 w-4" />
            </Link>
          </Button>
        </div>
      </section>

      <div className="fixed inset-x-0 z-50 px-4 md:hidden" style={{ bottom: "calc(5.5rem + env(safe-area-inset-bottom))" }}>
        <Button asChild className="h-12 w-full shadow-lg">
          <Link to={primaryCtaHref} onClick={() => trackCtaClick("sticky")}>
            Criar perfil
          </Link>
        </Button>
      </div>

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
