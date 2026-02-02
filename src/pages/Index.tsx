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
} from "lucide-react";
import { useAuth } from "@/components/auth/AuthProvider";
import { toast } from "sonner";

const Index = () => {
  const { session } = useAuth();
  const navigate = useNavigate();

  const handleSubscribe = (planId: string) => {
    if (!session) {
      toast.info("Por favor, crie uma conta para escolher seu plano.");
      navigate("/login");
      return;
    }
    navigate("/dashboard", { state: { selectedPlan: planId } });
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

  const plans = [
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
        "Suporte prioritário",
        "Economia de R$ 120/ano",
      ],
      popular: true,
      savings: "Economize R$ 120/ano",
    },
  ];

  const stats = [
    { value: "2.500+", label: "Profissionais Ativos" },
    { value: "180+", label: "Empresas Parceiras" },
    { value: "100%", label: "Foco em Home Care" },
  ];

  return (
    <Layout>
      <section className="gradient-hero relative overflow-hidden py-20 lg:py-28">
        <div className="absolute inset-0 overflow-hidden">
          <div className="absolute -right-40 -top-40 h-80 w-80 rounded-full bg-primary/5" />
          <div className="absolute -bottom-40 -left-40 h-80 w-80 rounded-full bg-success/5" />
        </div>

        <div className="container relative mx-auto px-4">
          <div className="mx-auto max-w-3xl text-center">
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
              <Button size="lg" asChild className="gap-2">
                <Link to="/login">
                  Escolher Plano e Começar
                  <ArrowRight className="h-4 w-4" />
                </Link>
              </Button>
              <Button size="lg" variant="outline" asChild>
                <Link to="/empresas">Sou uma Empresa</Link>
              </Button>
            </div>

            <div className="animate-slide-up mt-16 grid grid-cols-3 gap-8" style={{ animationDelay: "0.3s" }}>
              {stats.map((stat, index) => (
                <div key={index} className="text-center">
                  <div className="text-2xl font-bold text-foreground md:text-3xl">
                    {stat.value}
                  </div>
                  <div className="mt-1 text-sm text-muted-foreground">
                    {stat.label}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

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

          <div className="mx-auto grid max-w-3xl gap-8 md:grid-cols-2">
            {plans.map((plan, index) => (
              <PricingCard 
                key={index} 
                {...plan} 
                onSubscribe={handleSubscribe}
              />
            ))}
          </div>
        </div>
      </section>
    </Layout>
  );
};

export default Index;