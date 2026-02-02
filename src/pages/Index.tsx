import { Link } from "react-router-dom";
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

const Index = () => {
  const features = [
    {
      icon: Search,
      title: "Seja Encontrado",
      description:
        "Seu perfil visível para centenas de empresas de Home Care em busca de talentos.",
    },
    {
      icon: Shield,
      title: "Perfil Verificado",
      description:
        "Validação do seu registro profissional (COREN, CREFITO) para maior credibilidade.",
    },
    {
      icon: Star,
      title: "Destaque Premium",
      description:
        "Apareça no topo das buscas e receba mais oportunidades de trabalho.",
    },
    {
      icon: Users,
      title: "Networking",
      description:
        "Conecte-se com empresas de referência no mercado de Home Care.",
    },
  ];

  const plans = [
    {
      name: "Mensal",
      price: "R$ 49,90",
      period: "mês",
      description: "Ideal para começar",
      features: [
        "Perfil profissional completo",
        "Visibilidade para empresas",
        "Notificações de oportunidades",
        "Suporte por email",
      ],
    },
    {
      name: "Anual",
      price: "R$ 39,90",
      period: "mês",
      description: "Melhor custo-benefício",
      features: [
        "Tudo do plano Mensal",
        "Destaque nas buscas",
        "Badge de profissional verificado",
        "Suporte prioritário",
        "Acesso antecipado a vagas",
      ],
      popular: true,
      savings: "Economize R$ 120/ano",
    },
  ];

  const stats = [
    { value: "2.500+", label: "Profissionais Cadastrados" },
    { value: "180+", label: "Empresas Parceiras" },
    { value: "95%", label: "Taxa de Satisfação" },
  ];

  return (
    <Layout>
      {/* Hero Section */}
      <section className="gradient-hero relative overflow-hidden py-20 lg:py-28">
        {/* Background decoration */}
        <div className="absolute inset-0 overflow-hidden">
          <div className="absolute -right-40 -top-40 h-80 w-80 rounded-full bg-primary/5" />
          <div className="absolute -bottom-40 -left-40 h-80 w-80 rounded-full bg-success/5" />
        </div>

        <div className="container relative mx-auto px-4">
          <div className="mx-auto max-w-3xl text-center">
            <div className="animate-fade-in mb-6 inline-flex items-center gap-2 rounded-full border border-border bg-card px-4 py-2 shadow-sm">
              <Heart className="h-4 w-4 text-primary" />
              <span className="text-sm font-medium text-muted-foreground">
                Plataforma #1 para profissionais de Home Care
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
              Acesse as melhores oportunidades, gerencie seu perfil profissional
              e seja encontrado pelas maiores empresas de saúde do país.
            </p>

            <div className="animate-slide-up mt-10 flex flex-col items-center justify-center gap-4 sm:flex-row" style={{ animationDelay: "0.2s" }}>
              <Button size="lg" asChild className="gap-2">
                <Link to="/dashboard">
                  Assinar e Criar Perfil
                  <ArrowRight className="h-4 w-4" />
                </Link>
              </Button>
              <Button size="lg" variant="outline" asChild>
                <Link to="/empresas">Sou uma Empresa</Link>
              </Button>
            </div>

            {/* Stats */}
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

      {/* Features Section */}
      <section className="py-20">
        <div className="container mx-auto px-4">
          <div className="mb-12 text-center">
            <h2 className="text-3xl font-bold text-foreground">
              Por que escolher o HomeCareMatch?
            </h2>
            <p className="mx-auto mt-4 max-w-2xl text-muted-foreground">
              Oferecemos as melhores ferramentas para impulsionar sua carreira no
              mercado de Home Care.
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

      {/* How it Works */}
      <section className="bg-secondary/30 py-20">
        <div className="container mx-auto px-4">
          <div className="mb-12 text-center">
            <h2 className="text-3xl font-bold text-foreground">Como Funciona</h2>
            <p className="mx-auto mt-4 max-w-2xl text-muted-foreground">
              Em apenas 3 passos simples você estará conectado às melhores
              oportunidades.
            </p>
          </div>

          <div className="mx-auto grid max-w-4xl gap-8 md:grid-cols-3">
            {[
              {
                step: "01",
                icon: CheckCircle,
                title: "Crie sua Conta",
                description: "Cadastre-se e escolha o plano ideal para você.",
              },
              {
                step: "02",
                icon: Award,
                title: "Monte seu Perfil",
                description:
                  "Complete seu perfil com suas qualificações e experiência.",
              },
              {
                step: "03",
                icon: Clock,
                title: "Seja Encontrado",
                description:
                  "Empresas visualizam seu perfil e entram em contato.",
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

      {/* Pricing Section */}
      <section id="planos" className="scroll-mt-20 py-20">
        <div className="container mx-auto px-4">
          <div className="mb-12 text-center">
            <h2 className="text-3xl font-bold text-foreground">
              Planos e Preços
            </h2>
            <p className="mx-auto mt-4 max-w-2xl text-muted-foreground">
              Escolha o plano que melhor se adapta às suas necessidades e comece
              a receber oportunidades hoje mesmo.
            </p>
          </div>

          <div className="mx-auto grid max-w-3xl gap-8 md:grid-cols-2">
            {plans.map((plan, index) => (
              <PricingCard key={index} {...plan} />
            ))}
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="gradient-primary py-20">
        <div className="container mx-auto px-4 text-center">
          <h2 className="text-3xl font-bold text-primary-foreground">
            Pronto para dar o próximo passo na sua carreira?
          </h2>
          <p className="mx-auto mt-4 max-w-2xl text-primary-foreground/80">
            Junte-se a milhares de profissionais que já encontraram as melhores
            oportunidades através do HomeCareMatch.
          </p>
          <Button
            size="lg"
            variant="secondary"
            className="mt-8 gap-2"
            asChild
          >
            <Link to="/dashboard">
              Começar Agora
              <ArrowRight className="h-4 w-4" />
            </Link>
          </Button>
        </div>
      </section>
    </Layout>
  );
};

export default Index;
