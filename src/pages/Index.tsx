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
import SeoMeta from "@/components/SeoMeta";
import SubscriptionCouponModal from "@/components/SubscriptionCouponModal";
import { useAuth } from "@/components/auth/AuthProvider";
import { useSiteConfig } from "@/hooks/use-site-config";
import { createCheckoutSession } from "@/lib/checkout";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import {
  ArrowRight,
  BadgeCheck,
  CalendarCheck,
  CheckCircle2,
  Headset,
  Loader2,
  MessageSquare,
  Plus,
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

interface SocialMetric {
  value: string;
  label: string;
}

interface SocialTestimonial {
  quote: string;
  author: string;
  role?: string;
}

const PAGE_VARIANT = "profissionais";

const heroBullets = [
  "Perfil profissional completo",
  "Visibilidade por região e especialidade",
  "Contato direto e rápido",
  "Você escolhe quando aceitar",
];

const howItWorksSteps = [
  { icon: UserPlus, title: "Crie seu perfil" },
  { icon: Search, title: "Seja encontrado" },
  { icon: MessageSquare, title: "Receba contatos" },
  { icon: CalendarCheck, title: "Feche atendimentos" },
];

const professionChips = [
  "Enfermeiro(a)",
  "Técnico(a) de Enfermagem",
  "Cuidador(a)",
  "Fisioterapeuta",
  "Fonoaudiólogo(a)",
  "Terapeuta Ocupacional",
];

const benefits = [
  "Mais visibilidade profissional",
  "Oportunidades por região",
  "Contato direto",
  "Perfil confiável",
  "Praticidade no dia a dia",
  "Credibilidade",
];

const faqs = [
  {
    question: "Preciso pagar para me cadastrar?",
    answer:
      "Você pode criar seu perfil e conhecer o fluxo de cadastro. A assinatura ativa os recursos premium de visibilidade.",
  },
  {
    question: "Como as oportunidades chegam até mim?",
    answer:
      "Empresas e famílias encontram seu perfil pela região e especialidade e iniciam contato diretamente.",
  },
  {
    question: "Quais regiões são atendidas?",
    answer:
      "A cobertura varia conforme a demanda local. A Home Care Match amplia continuamente as regiões atendidas.",
  },
  {
    question: "Quais profissões podem se cadastrar?",
    answer:
      "Profissionais de enfermagem, cuidadores e terapeutas de diferentes áreas do cuidado domiciliar.",
  },
  {
    question: "Como funciona a assinatura?",
    answer:
      "Você escolhe entre plano mensal e anual para manter seu perfil ativo com recursos premium.",
  },
  {
    question: "Posso cancelar quando quiser?",
    answer:
      "Sim. Você pode cancelar conforme as regras do plano contratado, sem burocracia desnecessária.",
  },
  {
    question: "Como meus dados são protegidos?",
    answer:
      "Aplicamos boas práticas de segurança e privacidade para proteger seus dados de acesso e perfil.",
  },
  {
    question: "Como falo com o suporte?",
    answer: "Você pode acionar o suporte pelos canais oficiais da Home Care Match sempre que precisar.",
  },
  {
    question: "Posso escolher quais atendimentos aceitar?",
    answer: "Sim. Você avalia cada oportunidade e decide se quer seguir com o atendimento.",
  },
  {
    question: "Quanto tempo leva para criar meu perfil?",
    answer: "Normalmente, menos de 3 minutos para iniciar e deixar seu perfil pronto para visibilidade.",
  },
];

const defaultPlans: DbPlan[] = [
  {
    id: "monthly",
    name: "Plano Mensal",
    price: "R$ 49,90",
    period: "mês",
    description: "Ideal para começar",
    features: [
      "Visibilidade para empresas e famílias",
      "Recebimento de oportunidades",
      "Contato direto na plataforma",
    ],
    popular: false,
  },
  {
    id: "yearly",
    name: "Plano Anual",
    price: "R$ 39,90",
    period: "mês",
    description: "Melhor custo-benefício",
    features: [
      "Tudo do Plano Mensal",
      "Economia no valor anual",
      "Suporte prioritário",
    ],
    popular: true,
  },
];

const normalizeText = (value: unknown) => (typeof value === "string" ? value.trim() : "");

const parseSocialMetrics = (value: unknown): SocialMetric[] => {
  if (!Array.isArray(value)) return [];
  return value
    .map((item) => {
      const data = item as Record<string, unknown>;
      const metric = {
        value: normalizeText(data.value),
        label: normalizeText(data.label),
      };
      return metric;
    })
    .filter((item) => item.value && item.label);
};

const parseSocialTestimonials = (value: unknown): SocialTestimonial[] => {
  if (!Array.isArray(value)) return [];
  return value
    .map((item) => {
      const data = item as Record<string, unknown>;
      const testimonial = {
        quote: normalizeText(data.quote),
        author: normalizeText(data.author),
        role: normalizeText(data.role) || undefined,
      };
      return testimonial;
    })
    .filter((item) => item.quote && item.author);
};

const pushDataLayer = (payload: Record<string, unknown>) => {
  if (typeof window === "undefined") return;
  window.dataLayer = window.dataLayer || [];
  window.dataLayer.push(payload);
};

const Index = () => {
  const { session, user, loading: authLoading } = useAuth();
  const { data: siteConfig } = useSiteConfig();
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

  const trackCtaClick = (ctaLocation: CtaLocation) => {
    pushDataLayer({
      event: "hcm_lp_profissionais_cta_click",
      cta_location: ctaLocation,
      page_variant: PAGE_VARIANT,
    });
  };

  const handlePlanCheckout = async (planId: PlanId) => {
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
      if (!data?.url) throw new Error("URL de checkout não retornada pelo servidor.");
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

  const userTier = profile?.subscription_tier || null;

  const getPlanButtonConfig = (planId: string) => {
    if (!session) return { text: "Começar agora", disabled: false };
    if (profile?.role === "company" || profile?.role === "family") {
      return { text: "Somente para profissionais", disabled: true };
    }
    if (!userTier) return { text: "Começar agora", disabled: false };
    if (userTier === planId) return { text: "Seu plano atual", disabled: true };
    if (userTier === "yearly") return { text: "Plano inferior", disabled: true };
    if (userTier === "monthly") {
      if (planId === "yearly") return { text: "Fazer upgrade", disabled: false };
      return { text: "Plano inferior", disabled: true };
    }
    if (userTier === "free_trial") return { text: "Começar agora", disabled: false };
    return { text: "Começar agora", disabled: false };
  };

  const handleSubscribe = async (planId: string) => {
    trackCtaClick("plans");
    if (!session) {
      toast.info("Por favor, crie uma conta ou faça login para continuar.");
      navigate("/login#auth-sign-up");
      return;
    }

    if (planId === "monthly" || planId === "yearly") {
      setSelectedPlanForCheckout(planId);
      return;
    }

    toast.error("Plano inválido para checkout.");
  };

  const planCards = useMemo(() => {
    const source = remotePlans && remotePlans.length > 0 ? remotePlans : defaultPlans;
    const filtered = source.filter((plan) => plan.id === "monthly" || plan.id === "yearly");
    const fallback = filtered.length > 0 ? filtered : defaultPlans;

    return fallback.map((plan) => ({
      ...plan,
      period: plan.period === "mes" ? "mês" : plan.period,
      features: (plan.features || []).slice(0, 3),
    }));
  }, [remotePlans]);

  const socialProof = useMemo(() => {
    const config = (siteConfig as unknown as Record<string, unknown>) || {};
    const metrics = parseSocialMetrics(
      config.lp_professionals_social_metrics_json ??
        config.lp_professionals_social_metrics ??
        config.landing_professionals_social_metrics,
    );
    const testimonials = parseSocialTestimonials(
      config.lp_professionals_testimonials_json ??
        config.lp_professionals_testimonials ??
        config.landing_professionals_testimonials,
    );

    return {
      metrics: metrics.slice(0, 3),
      testimonials: testimonials.slice(0, 3),
    };
  }, [siteConfig]);

  const hasSocialProof = socialProof.metrics.length > 0 || socialProof.testimonials.length > 0;

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
        description="Cadastre-se como profissional e aumente suas chances de conseguir atendimentos de Home Care na sua região. Perfil completo, visibilidade e praticidade."
        jsonLd={faqSchema}
      />

      <section className="gradient-hero relative overflow-hidden border-b border-border/50 py-14 md:py-20">
        <div className="absolute inset-0 overflow-hidden">
          <div className="absolute -right-24 -top-24 h-56 w-56 rounded-full bg-primary/10 blur-2xl" />
          <div className="absolute -bottom-20 -left-16 h-52 w-52 rounded-full bg-success/10 blur-2xl" />
        </div>

        <div className="container relative mx-auto px-4">
          <div className="grid items-center gap-10 lg:grid-cols-[1.1fr_0.9fr]">
            <div>
              <span className="inline-flex items-center gap-2 rounded-full border border-border/60 bg-background/80 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                <Stethoscope className="h-4 w-4 text-primary" />
                Home Care Match para profissionais
              </span>

              <h1 className="mt-5 text-4xl font-bold leading-tight text-foreground md:text-5xl">
                Receba oportunidades de Home Care na sua região.
              </h1>

              <p className="mt-4 max-w-xl text-base text-muted-foreground md:text-lg">
                Crie seu perfil em minutos e aumente sua visibilidade para empresas e famílias.
              </p>

              <ul className="mt-6 grid gap-2">
                {heroBullets.map((bullet) => (
                  <li key={bullet} className="flex items-start gap-2 text-sm text-foreground/90 md:text-base">
                    <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-success" />
                    <span>{bullet}</span>
                  </li>
                ))}
              </ul>

              <div className="mt-8 flex flex-col items-start gap-3 sm:flex-row sm:items-center">
                <Button asChild size="lg" className="w-full gap-2 sm:w-auto" onClick={() => trackCtaClick("hero")}>
                  <Link to={primaryCtaHref}>
                    {primaryCtaText}
                    <ArrowRight className="h-4 w-4" />
                  </Link>
                </Button>
                <Button asChild size="lg" variant="outline" className="w-full sm:w-auto">
                  <a href="#como-funciona">Ver como funciona</a>
                </Button>
              </div>

              <p className="mt-3 text-xs text-muted-foreground">Leva menos de 3 minutos.</p>

              <div className="mt-5 flex flex-wrap items-center gap-x-4 gap-y-2 text-xs text-muted-foreground md:text-sm">
                <span className="inline-flex items-center gap-1.5">
                  <ShieldCheck className="h-4 w-4 text-primary" />
                  Dados protegidos
                </span>
                <span className="h-1 w-1 rounded-full bg-border" />
                <span className="inline-flex items-center gap-1.5">
                  <Headset className="h-4 w-4 text-primary" />
                  Suporte
                </span>
                <span className="h-1 w-1 rounded-full bg-border" />
                <span className="inline-flex items-center gap-1.5">
                  <BadgeCheck className="h-4 w-4 text-primary" />
                  Feito para profissionais
                </span>
              </div>
            </div>

            <div className="rounded-2xl border border-border/60 bg-background/80 p-6">
              <p className="text-sm font-semibold uppercase tracking-wide text-primary">Seu perfil em destaque</p>
              <ul className="mt-4 space-y-4">
                <li className="border-b border-border/50 pb-4 text-sm text-foreground/90">
                  Preencha sua especialidade, região e disponibilidade.
                </li>
                <li className="border-b border-border/50 pb-4 text-sm text-foreground/90">
                  Receba contatos com mais agilidade.
                </li>
                <li className="text-sm text-foreground/90">
                  Organize oportunidades em um fluxo simples.
                </li>
              </ul>
            </div>
          </div>
        </div>
      </section>

      <section id="como-funciona" className="scroll-mt-24 py-14 md:py-20">
        <div className="container mx-auto px-4">
          <div className="mx-auto mb-10 max-w-2xl text-center">
            <h2 className="text-3xl font-bold text-foreground">Como funciona</h2>
            <p className="mt-3 text-muted-foreground">Quatro passos diretos para começar.</p>
          </div>

          <ol className="grid gap-5 md:grid-cols-2 lg:grid-cols-4">
            {howItWorksSteps.map((step, index) => (
              <li key={step.title} className="flex items-center gap-3 lg:justify-center">
                <span className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-primary/10 text-primary">
                  <step.icon className="h-5 w-5" />
                </span>
                <div>
                  <p className="text-xs uppercase tracking-wide text-muted-foreground">Passo {index + 1}</p>
                  <p className="text-sm font-semibold text-foreground">{step.title}</p>
                </div>
              </li>
            ))}
          </ol>
        </div>
      </section>

      <section className="border-y border-border/40 bg-secondary/20 py-14 md:py-20">
        <div className="container mx-auto px-4">
          <div className="mx-auto mb-8 max-w-2xl text-center">
            <h2 className="text-3xl font-bold text-foreground">Profissionais</h2>
            <p className="mt-3 text-muted-foreground">Atendimentos domiciliares por demanda na sua região.</p>
          </div>

          <div className="mx-auto flex max-w-3xl flex-wrap justify-center gap-3">
            {professionChips.map((profession) => (
              <span
                key={profession}
                className="rounded-full border border-border/60 bg-background/80 px-4 py-2 text-sm font-medium text-foreground"
              >
                {profession}
              </span>
            ))}
          </div>

          <p className="mt-5 text-center text-sm font-medium text-muted-foreground">
            <span className="inline-flex items-center gap-1">
              <Plus className="h-4 w-4" />
              E muito mais…
            </span>
          </p>
        </div>
      </section>

      <section className="py-14 md:py-20">
        <div className="container mx-auto px-4">
          <div className="mx-auto mb-8 max-w-2xl text-center">
            <h2 className="text-3xl font-bold text-foreground">Benefícios</h2>
            <p className="mt-3 text-muted-foreground">Clareza no processo para você focar no atendimento.</p>
          </div>

          <div className="mx-auto grid max-w-4xl gap-x-10 gap-y-3 md:grid-cols-2">
            {benefits.map((benefit) => (
              <div key={benefit} className="flex items-center gap-2 text-sm text-foreground md:text-base">
                <CheckCircle2 className="h-4 w-4 shrink-0 text-primary" />
                <span>{benefit}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {hasSocialProof && (
        <section className="border-y border-border/40 bg-secondary/20 py-14 md:py-20">
          <div className="container mx-auto px-4">
            <div className="mx-auto mb-8 max-w-2xl text-center">
              <h2 className="text-3xl font-bold text-foreground">Prova social</h2>
              <p className="mt-3 text-muted-foreground">Resultados e relatos de quem já usa o perfil profissional.</p>
            </div>

            {socialProof.metrics.length > 0 && (
              <div className="mx-auto mb-8 grid max-w-4xl gap-4 sm:grid-cols-3">
                {socialProof.metrics.map((metric) => (
                  <div key={`${metric.label}-${metric.value}`} className="text-center">
                    <p className="text-2xl font-bold text-foreground">{metric.value}</p>
                    <p className="text-xs uppercase tracking-wide text-muted-foreground">{metric.label}</p>
                  </div>
                ))}
              </div>
            )}

            {socialProof.testimonials.length > 0 && (
              <div className="mx-auto grid max-w-4xl gap-4 md:grid-cols-3">
                {socialProof.testimonials.map((item) => (
                  <blockquote key={`${item.author}-${item.quote}`} className="rounded-2xl bg-background/80 p-4">
                    <p className="text-sm text-foreground/90">“{item.quote}”</p>
                    <footer className="mt-3 text-xs text-muted-foreground">
                      {item.author}
                      {item.role ? ` · ${item.role}` : ""}
                    </footer>
                  </blockquote>
                ))}
              </div>
            )}
          </div>
        </section>
      )}

      <section id="planos" ref={plansSectionRef} className="scroll-mt-24 py-14 md:py-20">
        <div className="container mx-auto px-4">
          <div className="mx-auto mb-8 max-w-2xl text-center">
            <h2 className="text-3xl font-bold text-foreground">Planos</h2>
            <p className="mt-3 text-muted-foreground">Você cria o perfil e escolhe o plano na sequência.</p>
          </div>

          <div className="mx-auto grid max-w-4xl gap-4 md:grid-cols-2">
            {planCards.map((plan) => {
              const buttonConfig = getPlanButtonConfig(plan.id);
              return (
                <article
                  key={plan.id}
                  className={`rounded-2xl border p-6 ${
                    plan.popular ? "border-primary/60 bg-primary/5" : "border-border/60 bg-background/80"
                  }`}
                >
                  <p className="text-sm font-semibold text-primary">{plan.name}</p>
                  <p className="mt-2 text-3xl font-bold text-foreground">
                    {plan.price}
                    <span className="ml-1 text-sm font-normal text-muted-foreground">/{plan.period}</span>
                  </p>

                  <ul className="mt-4 space-y-2">
                    {(plan.features || []).map((feature) => (
                      <li key={feature} className="flex items-center gap-2 text-sm text-foreground/90">
                        <CheckCircle2 className="h-4 w-4 shrink-0 text-success" />
                        {feature}
                      </li>
                    ))}
                  </ul>

                  <Button
                    className="mt-6 w-full"
                    onClick={() => handleSubscribe(plan.id)}
                    disabled={buttonConfig.disabled || loadingPlan === plan.id}
                  >
                    {loadingPlan === plan.id ? "Processando..." : buttonConfig.text}
                  </Button>
                </article>
              );
            })}
          </div>
        </div>
      </section>

      <section id="duvidas" className="scroll-mt-24 border-y border-border/40 bg-secondary/20 py-14 md:py-20">
        <div className="container mx-auto max-w-3xl px-4">
          <div className="mb-8 text-center">
            <h2 className="text-3xl font-bold text-foreground">Dúvidas</h2>
            <p className="mt-3 text-muted-foreground">Respostas rápidas para reduzir objeções antes do cadastro.</p>
          </div>

          <Accordion type="single" collapsible className="space-y-2">
            {faqs.map((faq) => (
              <AccordionItem key={faq.question} value={faq.question} className="rounded-xl border border-border/60 bg-background/80 px-4">
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
          <Button asChild size="lg" variant="secondary" className="mt-7 gap-2" onClick={() => trackCtaClick("footer")}>
            <Link to={primaryCtaHref}>
              Criar meu perfil
              <ArrowRight className="h-4 w-4" />
            </Link>
          </Button>
        </div>
      </section>

      <div className="fixed inset-x-0 z-50 px-4 md:hidden" style={{ bottom: "calc(5.5rem + env(safe-area-inset-bottom))" }}>
        <Button asChild className="h-12 w-full shadow-lg" onClick={() => trackCtaClick("sticky")}>
          <Link to={primaryCtaHref}>Criar perfil</Link>
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
