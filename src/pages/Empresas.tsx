import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import Layout from "@/components/layout/Layout";
import FeatureCard from "@/components/FeatureCard";
import {
  Building2,
  Search,
  Filter,
  Users,
  Clock,
  Shield,
  MapPin,
  ArrowRight,
  CheckCircle,
  Zap,
  HelpCircle,
  Loader2,
} from "lucide-react";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useSiteConfig } from "@/hooks/use-site-config";
import LandingVideoPlayer from "@/components/LandingVideoPlayer";
import { getYouTubeEmbedUrl } from "@/lib/video-utils"; // Import the new utility

const Empresas = () => {
  const { data: config } = useSiteConfig();
  
  const { data: locationData, isLoading: isLoadingLocations } = useQuery({
    queryKey: ["professional-locations-summary"],
    queryFn: async () => {
      const { data, count, error } = await supabase
        .from("profiles")
        .select("neighborhood, city, state", { count: "exact" })
        .eq("role", "professional")
        .not("full_name", "is", null)
        .eq("email_confirmed", true)
        .order('updated_at', { ascending: false });

      if (error) throw error;

      const uniqueLocations = Array.from(
        new Set(
          (data || [])
            .filter(p => p.city && p.state)
            .map(p => {
              const loc = [];
              if (p.neighborhood) loc.push(p.neighborhood);
              loc.push(`${p.city}/${p.state}`);
              return loc.join(" - ");
            })
        )
      ).slice(0, 4);

      return {
        total: count || 0,
        locations: uniqueLocations
      };
    }
  });

  const features = [
    {
      icon: Filter,
      title: "Filtros Avançados",
      description:
        "Busque por especialidade, bairro, cidade e disponibilidade do profissional.",
    },
    {
      icon: Shield,
      title: "Profissionais Verificados",
      description:
        "Todos os profissionais têm seus registros validados (COREN, CREFITO, etc).",
    },
    {
      icon: Clock,
      title: "Agilidade na Contratação",
      description:
        "Encontre o profissional ideal em minutos e entre em contato diretamente.",
    },
    {
      icon: Zap,
      title: "Sem Custos Ocultos",
      description:
        "Acesso gratuito para empresas. Busque e contrate sem taxas adicionais.",
    },
  ];

  const benefits = [
    "Acesso ilimitado à base de profissionais",
    "Filtros por região, especialidade e disponibilidade",
    "Contato direto com os profissionais",
    "Perfis completos e verificados",
    "Histórico de experiência e qualificações",
    "Suporte dedicado para recrutadores",
  ];

  const faqs = [
    {
      question: "Como encontro profissionais na minha região?",
      answer: "Utilize nossos filtros avançados de busca para selecionar o estado, cidade e até o bairro desejado. Você verá uma lista de profissionais disponíveis naquela localidade."
    },
    {
      question: "Os profissionais são realmente verificados?",
      answer: "Sim. Nossa equipe analisa os documentos de identificação e os registros profissionais (como COREN ou CREFITO) de cada profissional que solicita o selo de verificação."
    },
    {
      question: "Existe algum custo para a empresa utilizar a plataforma?",
      answer: "Atualmente, o acesso à base de profissionais e o contato direto são gratuitos para empresas de Home Care parceiras."
    },
    {
      question: "Como entro em contato com o profissional?",
      answer: "Ao encontrar um perfil de interesse, basta clicar no botão de contato. O sistema liberará o link direto para o WhatsApp do profissional."
    },
    {
      question: "Posso salvar perfis para consultar depois?",
      answer: "Sim. Todos os profissionais que você entrar em contato ficam salvos automaticamente no seu histórico de contatos no painel administrativo."
    }
  ];

  const showLocationCard = !isLoadingLocations && (locationData?.total || 0) >= 10;

  return (
    <Layout>
      {/* Hero Section */}
      <section className="gradient-hero relative overflow-hidden py-20 lg:py-28">
        <div className="absolute inset-0 overflow-hidden">
          <div className="absolute -left-40 -top-40 h-80 w-80 rounded-full bg-success/5" />
          <div className="absolute -bottom-40 -right-40 h-80 w-80 rounded-full bg-primary/5" />
        </div>

        <div className="container relative mx-auto px-4">
          <div className="mx-auto max-w-3xl text-center">
            <div className="animate-fade-in mb-6 inline-flex items-center gap-2 rounded-full border border-border bg-card px-4 py-2 shadow-sm">
              <Building2 className="h-4 w-4 text-success" />
              <span className="text-sm font-medium text-muted-foreground">
                Para Empresas de Home Care
              </span>
            </div>

            <h1 className="animate-slide-up text-4xl font-bold leading-tight text-foreground md:text-5xl lg:text-6xl">
              O talento certo para sua escala de{" "}
              <span className="bg-gradient-to-r from-success to-success/70 bg-clip-text text-transparent">
                Home Care
              </span>
            </h1>

            <p className="animate-slide-up mx-auto mt-6 max-w-2xl text-lg text-muted-foreground" style={{ animationDelay: "0.1s" }}>
              Filtre profissionais qualificados por bairro, especialidade e
              disponibilidade. Agilize sua contratação sem custos ocultos.
            </p>

            <div className="animate-slide-up mt-10 flex flex-col items-center justify-center gap-4 sm:flex-row" style={{ animationDelay: "0.2s" }}>
              <Button size="lg" asChild className="gap-2 bg-success hover:bg-success/90">
                <Link to="/cadastro-empresa">
                  Cadastre-se Gratuitamente
                  <ArrowRight className="h-4 w-4" />
                </Link>
              </Button>
              <Button size="lg" variant="outline" asChild>
                <Link to="/">Sou Profissional</Link>
              </Button>
            </div>
          </div>
        </div>
      </section>

      {/* Seção de Vídeo de Apresentação */}
      {config?.video_url_companies && (
        <section className="py-12 bg-secondary/10">
          <div className="container mx-auto px-4">
            <div className="max-w-4xl mx-auto">
              <LandingVideoPlayer 
                url={getYouTubeEmbedUrl(config.video_url_companies)} 
                title="Apresentação para Empresas"
              />
            </div>
          </div>
        </section>
      )}

      {/* Features Section */}
      <section className="py-20">
        <div className="container mx-auto px-4">
          <div className="mb-12 text-center">
            <h2 className="text-3xl font-bold text-foreground">
              Recrutamento Simplificado
            </h2>
            <p className="mx-auto mt-4 max-w-2xl text-muted-foreground">
              Ferramentas poderosas para encontrar os melhores profissionais para
              sua equipe de Home Care.
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

      {/* Benefits Section */}
      <section className="bg-secondary/30 py-20">
        <div className="container mx-auto px-4">
          <div className="mx-auto grid max-w-5xl gap-12 lg:grid-cols-2 lg:items-center">
            <div>
              <h2 className="text-3xl font-bold text-foreground">
                Tudo que você precisa para montar sua equipe
              </h2>
              <p className="mt-4 text-muted-foreground">
                Nossa plataforma oferece acesso completo a profissionais de
                saúde qualificados, com todas as informações necessárias para
                uma contratação assertiva.
              </p>

              <ul className="mt-8 space-y-4">
                {benefits.map((benefit, index) => (
                  <li key={index} className="flex items-center gap-3">
                    <div className="flex h-6 w-6 items-center justify-center rounded-full bg-success/10">
                      <CheckCircle className="h-4 w-4 text-success" />
                    </div>
                    <span className="text-muted-foreground">{benefit}</span>
                  </li>
                ))}
              </ul>
            </div>

            <div className="relative">
              {showLocationCard ? (
                <div className="rounded-2xl border border-border bg-card p-8 shadow-lg animate-scale-in">
                  <div className="mb-6 flex items-center gap-4">
                    <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-success/10">
                      <MapPin className="h-6 w-6 text-success" />
                    </div>
                    <div>
                      <h3 className="font-semibold text-foreground">
                        Busca por Região
                      </h3>
                      <p className="text-sm text-muted-foreground">
                        Encontre profissionais próximos
                      </p>
                    </div>
                  </div>

                  <div className="space-y-3">
                    {locationData?.locations.map((location, i) => (
                      <div
                        key={i}
                        className="flex items-center justify-between rounded-lg bg-secondary/50 p-3"
                      >
                        <span className="text-sm text-foreground truncate pr-2">{location}</span>
                        <ArrowRight className="h-3 w-3 text-muted-foreground shrink-0" />
                      </div>
                    ))}
                  </div>

                  <Button className="mt-6 w-full gap-2 bg-success hover:bg-success/90" asChild>
                    <Link to="/buscar">
                      Ver Todos os Profissionais
                      <ArrowRight className="h-4 w-4" />
                    </Link>
                  </Button>
                </div>
              ) : (
                <div className="rounded-2xl border border-dashed border-border bg-card/50 p-8 flex flex-col items-center text-center justify-center min-h-[300px]">
                  <Users className="h-12 w-12 text-muted-foreground/30 mb-4" />
                  <h3 className="font-semibold text-muted-foreground">Base em Expansão</h3>
                  <p className="text-sm text-muted-foreground/70 mt-2">
                    Estamos cadastrando novos profissionais diariamente em diversas regiões.
                  </p>
                  <Button variant="outline" className="mt-6" asChild>
                    <Link to="/cadastro-empresa">Seja um Parceiro</Link>
                  </Button>
                </div>
              )}
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
              Processo simples e rápido para encontrar o profissional ideal.
            </p>
          </div>

          <div className="mx-auto grid max-w-4xl gap-8 md:grid-cols-3">
            {[
              {
                step: "01",
                title: "Busque",
                description:
                  "Use nossos filtros para encontrar profissionais na sua região.",
              },
              {
                step: "02",
                title: "Avalie",
                description:
                  "Analise os perfis, qualificações e experiências dos candidatos.",
              },
              {
                step: "03",
                title: "Contrate",
                description:
                  "Entre em contato diretamente e feche a contratação.",
              },
            ].map((item, index) => (
              <div key={index} className="relative text-center">
                <div className="mb-4 inline-flex h-16 w-16 items-center justify-center rounded-2xl bg-success text-2xl font-bold text-success-foreground">
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
      <section className="bg-success py-20">
        <div className="container mx-auto px-4 text-center">
          <h2 className="text-3xl font-bold text-success-foreground">
            Encontre o profissional ideal para sua equipe
          </h2>
          <p className="mx-auto mt-4 max-w-2xl text-success-foreground/80">
            Acesse nossa base de profissionais verificados e agilize sua
            contratação sem custos ocultos.
          </p>
          <Button
            size="lg"
            variant="secondary"
            className="mt-8 gap-2"
            asChild
          >
            <Link to="/cadastro-empresa">
              Comece a Buscar Agora
              <ArrowRight className="h-4 w-4" />
            </Link>
          </Button>
        </div>
      </section>

      {/* FAQ Section */}
      <section className="py-20 bg-secondary/10">
        <div className="container mx-auto px-4 max-w-3xl">
          <div className="mb-12 text-center">
            <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-success/10">
              <HelpCircle className="h-6 w-6 text-success" />
            </div>
            <h2 className="text-3xl font-bold text-foreground">Dúvidas Frequentes</h2>
            <p className="mt-4 text-muted-foreground">
              Respostas para as principais dúvidas de recrutadores e empresas.
            </p>
          </div>

          <Accordion type="single" collapsible className="w-full space-y-4">
            {faqs.map((faq, index) => (
              <AccordionItem 
                key={index} 
                value={`item-${index}`} 
                className="border rounded-xl px-6 bg-card shadow-sm border-success/5"
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
    </Layout>
  );
};

export default Empresas;