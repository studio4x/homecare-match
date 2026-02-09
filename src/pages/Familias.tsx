import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import Layout from "@/components/layout/Layout";
import FeatureCard from "@/components/FeatureCard";
import {
  Heart,
  ShieldCheck,
  Search,
  MapPin,
  UserCheck,
  Clock,
  ArrowRight,
  MessageCircle,
} from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { useProfessionalStats } from "@/hooks/use-professional-stats";

const Familias = () => {
  const features = [
    {
      icon: ShieldCheck,
      title: "Segurança em Primeiro Lugar",
      description:
        "Todos os profissionais passam por verificação de documentos e antecedentes profissionais.",
    },
    {
      icon: Search,
      title: "Encontre Perto de Você",
      description:
        "Busque cuidadores e enfermeiros pelo seu bairro ou cidade para facilitar o deslocamento.",
    },
    {
      icon: UserCheck,
      title: "Perfis Detalhados",
      description:
        "Visualize experiência, formações e especialidades antes de entrar em contato.",
    },
    {
      icon: MessageCircle,
      title: "Contato Direto",
      description:
        "Converse diretamente com o profissional pelo WhatsApp, sem intermediários ou taxas abusivas.",
    },
  ];

  const featuredSpecialties = [
    { value: "cuidador-idosos", label: "Cuidador(a) de Idosos" },
    { value: "tecnico-enfermagem", label: "Técnico(a) de Enfermagem" },
    { value: "enfermeiro", label: "Enfermeiro(a)" },
    { value: "fisioterapeuta", label: "Fisioterapeuta" },
    { value: "fonoaudiologo", label: "Fonoaudiólogo(a)" },
    { value: "terapeuta-ocupacional", label: "Terapeuta Ocupacional" },
  ];

  const { data: stats, isLoading: isLoadingStats } = useProfessionalStats(
    featuredSpecialties.map((s) => s.value)
  );

  const canUseSpecialtySearch = (stats?.total ?? 0) >= 10;

  return (
    <Layout>
      {/* Hero Section */}
      <section className="gradient-hero relative overflow-hidden py-20 lg:py-28">
        <div className="absolute inset-0 overflow-hidden">
          <div className="absolute -right-40 -top-40 h-80 w-80 rounded-full bg-primary/5" />
          <div className="absolute -bottom-40 -left-40 h-80 w-80 rounded-full bg-accent/5" />
        </div>

        <div className="container relative mx-auto px-4">
          <div className="mx-auto max-w-3xl text-center">
            <div className="animate-fade-in mb-6 inline-flex items-center gap-2 rounded-full border border-border bg-card px-4 py-2 shadow-sm">
              <Heart className="h-4 w-4 text-rose-500" />
              <span className="text-sm font-medium text-muted-foreground">
                Cuidado e carinho para quem você ama
              </span>
            </div>

            <h1 className="animate-slide-up text-4xl font-bold leading-tight text-foreground md:text-5xl lg:text-6xl">
              Encontre o profissional de saúde ideal para a sua{" "}
              <span className="bg-gradient-to-r from-rose-500 to-rose-400 bg-clip-text text-transparent">
                Família
              </span>
            </h1>

            <p
              className="animate-slide-up mx-auto mt-6 max-w-2xl text-lg text-muted-foreground"
              style={{ animationDelay: "0.1s" }}
            >
              Conectamos você a cuidadores e profissionais de saúde verificados.
              Simples, seguro e sem taxas de agenciamento.
            </p>

            <div
              className="animate-slide-up mt-10 flex flex-col items-center justify-center gap-4 sm:flex-row"
              style={{ animationDelay: "0.2s" }}
            >
              <Button
                size="lg"
                asChild
                className="gap-2 bg-rose-500 hover:bg-rose-600 border-none"
              >
                <Link to="/cadastro-empresa">
                  Cadastrar Minha Família
                  <ArrowRight className="h-4 w-4" />
                </Link>
              </Button>
              <Button size="lg" variant="outline" asChild>
                <Link to="/buscar">Ver Profissionais</Link>
              </Button>
            </div>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="py-20">
        <div className="container mx-auto px-4">
          <div className="mb-12 text-center">
            <h2 className="text-3xl font-bold text-foreground">
              Por que usar o HomeCare Match?
            </h2>
            <p className="mx-auto mt-4 max-w-2xl text-muted-foreground">
              Entendemos que contratar alguém para cuidar de um ente querido é uma
              decisão importante. Criamos ferramentas para te dar tranquilidade.
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
          <div className="mx-auto grid max-w-5xl gap-12 lg:grid-cols-2 lg:items-center">
            <div>
              <h2 className="text-3xl font-bold text-foreground">
                Como encontrar o profissional certo
              </h2>
              <p className="mt-4 text-muted-foreground">
                Nossa plataforma foi desenhada para ser intuitiva e direta,
                permitindo que você foque no que importa: entrevistar e escolher
                a melhor pessoa.
              </p>

              <div className="mt-8 space-y-6">
                {[
                  {
                    step: "1",
                    title: "Crie sua conta gratuita",
                    desc: "Cadastre-se como família para ter acesso aos contatos.",
                  },
                  {
                    step: "2",
                    title: "Busque e Filtre",
                    desc: "Use nossos filtros para encontrar profissionais por especialidade e região.",
                  },
                  {
                    step: "3",
                    title: "Verifique o Perfil",
                    desc: "Analise a experiência, formação e se o profissional possui o selo de verificado.",
                  },
                  {
                    step: "4",
                    title: "Combine Diretamente",
                    desc: "Chame no WhatsApp e combine valores e horários diretamente com o profissional.",
                  },
                ].map((item, index) => (
                  <div key={index} className="flex gap-4">
                    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-rose-100 text-rose-600 font-bold">
                      {item.step}
                    </div>
                    <div>
                      <h4 className="font-semibold text-foreground">
                        {item.title}
                      </h4>
                      <p className="text-sm text-muted-foreground">{item.desc}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="relative">
              <div className="rounded-2xl border border-border bg-card p-8 shadow-lg">
                <div className="mb-6 flex items-center gap-4">
                  <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-rose-100">
                    <UserCheck className="h-6 w-6 text-rose-600" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-foreground">
                      Profissionais Disponíveis
                    </h3>
                    {isLoadingStats ? (
                      <Skeleton className="mt-1 h-4 w-44" />
                    ) : (
                      <p className="text-sm text-muted-foreground">
                        {stats?.total ?? 0} profissionais cadastrados
                      </p>
                    )}
                  </div>
                </div>

                {!canUseSpecialtySearch && !isLoadingStats && (
                  <div className="mb-4 rounded-lg border border-border bg-secondary/30 p-3">
                    <p className="text-xs text-muted-foreground">
                      Para uma experiência completa, recomendamos usar a busca geral
                      e explorar os filtros na próxima tela.
                    </p>
                  </div>
                )}

                <div className="grid gap-3">
                  {isLoadingStats
                    ? Array.from({ length: 6 }).map((_, i) => (
                        <Skeleton key={i} className="h-10 w-full" />
                      ))
                    : featuredSpecialties.map((s) => (
                        <Button
                          key={s.value}
                          variant="outline"
                          className="w-full justify-between"
                          disabled={!canUseSpecialtySearch}
                          asChild={canUseSpecialtySearch}
                        >
                          {canUseSpecialtySearch ? (
                            <Link to={`/buscar?specialty=${encodeURIComponent(s.value)}`}>
                              <span className="text-left">{s.label}</span>
                              <ArrowRight className="h-4 w-4 text-muted-foreground" />
                            </Link>
                          ) : (
                            <div className="flex w-full items-center justify-between">
                              <span className="text-left">{s.label}</span>
                              <ArrowRight className="h-4 w-4 text-muted-foreground" />
                            </div>
                          )}
                        </Button>
                      ))}
                </div>

                <Button
                  className="mt-6 w-full gap-2 bg-rose-500 hover:bg-rose-600 border-none"
                  asChild
                >
                  <Link to="/buscar">Buscar Agora</Link>
                </Button>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="bg-rose-50 py-20 dark:bg-rose-950/20">
        <div className="container mx-auto px-4 text-center">
          <h2 className="text-3xl font-bold text-foreground">
            Pronto para encontrar quem vai cuidar de quem você ama?
          </h2>
          <p className="mx-auto mt-4 max-w-2xl text-muted-foreground">
            O cadastro é rápido, gratuito e seguro.
          </p>
          <div className="mt-8 flex flex-col items-center justify-center gap-4 sm:flex-row">
            <Button
              size="lg"
              className="gap-2 bg-rose-500 hover:bg-rose-600 border-none min-w-[200px]"
              asChild
            >
              <Link to="/cadastro-empresa">Criar Conta Grátis</Link>
            </Button>
            <Button
              size="lg"
              variant="outline"
              className="min-w-[200px]"
              asChild
            >
              <Link to="/login">Já tenho conta</Link>
            </Button>
          </div>
        </div>
      </section>
    </Layout>
  );
};

export default Familias;