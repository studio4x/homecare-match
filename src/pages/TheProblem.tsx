"use client";

import React from "react";
import { Link } from "react-router-dom";
import Layout from "@/components/layout/Layout";
import SeoMeta from "@/components/SeoMeta";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { 
  AlertCircle, 
  ArrowRight, 
  Clock, 
  Search, 
  ShieldAlert, 
  Users, 
  Zap, 
  MessageSquare, 
  TrendingDown, 
  TrendingUp,
  Layers, 
  Smartphone,
  CheckCircle2,
  Building2,
  Home,
  UserCheck,
  XCircle,
  UserX
} from "lucide-react";
import { cn } from "@/lib/utils";

const LINKS = {
  professional: "/login#auth-sign-up",
  company: "/cadastro-empresa?role=company",
  family: "/cadastro-empresa?role=family"
};

const TheProblem = () => {
  const dailyPains = [
    {
      icon: Search,
      title: "Busca Ineficiente",
      description: "Dificuldade crônica para encontrar profissionais qualificados e disponíveis no momento exato da demanda."
    },
    {
      icon: EyeOff,
      title: "Invisibilidade",
      description: "Profissionais excelentes que não conseguem ser vistos por empresas e famílias que precisam do seu talento."
    },
    {
      icon: MessageSquare,
      title: "Informalidade",
      description: "Dependência excessiva de grupos de mensagens e indicações informais que geram ruído e insegurança."
    },
    {
      icon: Clock,
      title: "Lentidão Crítica",
      description: "Processos de contratação que levam dias, quando a necessidade do paciente exige agilidade imediata."
    },
    {
      icon: Layers,
      title: "Dados Dispersos",
      description: "Informações de currículo, documentos e disponibilidade espalhadas em planilhas e conversas soltas."
    },
    {
      icon: ShieldAlert,
      title: "Insegurança",
      description: "O cansaço das famílias em um processo de busca exaustivo e muitas vezes sem critérios de validação."
    }
  ];

  const chainEffects = [
    { step: "01", label: "Dificuldade em achar o profissional certo", icon: UserX },
    { step: "02", label: "Processo de busca lento e exaustivo", icon: Clock },
    { step: "03", label: "Insegurança para quem precisa contratar", icon: ShieldAlert },
    { step: "04", label: "Sobrecarga operacional para as empresas", icon: TrendingUp },
    { step: "05", label: "Perda de oportunidades para profissionais", icon: TrendingDown },
    { step: "06", label: "Cuidado domiciliar menos organizado", icon: AlertCircle }
  ];

  return (
    <Layout>
      <SeoMeta 
        title="O problema do setor de Home Care"
        description="Entenda os principais desafios do setor de home care e veja como a HomeCare Match conecta profissionais, empresas e famílias com mais organização, visibilidade e tecnologia."
        canonicalUrl={window.location.origin + "/o-problema"}
      />

      {/* 1. HERO PRINCIPAL */}
      <section className="relative overflow-hidden bg-gradient-to-b from-primary/5 via-background to-background py-20 lg:py-32">
        <div className="container mx-auto px-4 text-center">
          <Badge variant="outline" className="mb-6 border-primary/30 bg-primary/5 px-4 py-1 text-primary">
            Desafio Estrutural do Home Care
          </Badge>
          <h1 className="mx-auto max-w-4xl text-4xl font-extrabold tracking-tight text-foreground md:text-6xl">
            O problema que estamos ajudando a <span className="text-primary">transformar</span>
          </h1>
          <p className="mx-auto mt-8 max-w-2xl text-xl font-medium text-muted-foreground">
            A conexão entre profissionais, empresas e famílias no home care ainda é mais difícil do que deveria.
          </p>
          <p className="mx-auto mt-6 max-w-3xl text-lg leading-relaxed text-muted-foreground/80">
            O atendimento domiciliar cresce, mas o processo para encontrar profissionais, organizar demandas e gerar conexões confiáveis ainda é marcado por informalidade, desencontro de informações e falta de centralização. Quando isso acontece, todos sentem o impacto.
          </p>
          <div className="mt-12 flex flex-col items-center justify-center gap-4 sm:flex-row">
            <Button size="lg" asChild className="h-14 px-8 text-lg shadow-lg">
              <a href="#dia-a-dia">Entender o problema</a>
            </Button>
            <Button size="lg" variant="outline" asChild className="h-14 px-8 text-lg">
              <Link to="/funcionalidades">Conhecer a plataforma</Link>
            </Button>
          </div>
        </div>
      </section>

      {/* 2. SEÇÃO O PROBLEMA NO DIA A DIA */}
      <section id="dia-a-dia" className="scroll-mt-20 py-20">
        <div className="container mx-auto px-4">
          <div className="mb-16 text-center">
            <h2 className="text-3xl font-bold md:text-4xl">O home care muda o tempo todo — e o mercado nem sempre acompanha</h2>
            <p className="mx-auto mt-4 max-w-2xl text-muted-foreground">
              No dia a dia, empresas, profissionais e famílias lidam com situações que tornam o processo de conexão mais lento, inseguro e desorganizado.
            </p>
          </div>

          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {dailyPains.map((pain, idx) => (
              <Card key={idx} className="border-none bg-secondary/30 shadow-sm transition-all hover:shadow-md">
                <CardContent className="p-8">
                  <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-white shadow-sm">
                    <pain.icon className="h-6 w-6 text-primary" />
                  </div>
                  <h3 className="mb-3 text-xl font-bold">{pain.title}</h3>
                  <p className="text-sm leading-relaxed text-muted-foreground">{pain.description}</p>
                </CardContent>
              </Card>
            ))}
          </div>

          <div className="mt-12 rounded-3xl border border-primary/10 bg-primary/5 p-8 text-center">
            <p className="text-xl font-semibold text-primary">
              "Quando a conexão não acontece com agilidade e clareza, o cuidado demora mais para se organizar."
            </p>
          </div>
        </div>
      </section>

      {/* 3. SEÇÃO EFEITO EM CADEIA */}
      <section className="bg-slate-900 py-24 text-white">
        <div className="container mx-auto px-4">
          <div className="mb-16 text-center">
            <h2 className="text-3xl font-bold md:text-4xl">O efeito em cadeia da desorganização</h2>
            <p className="mx-auto mt-4 max-w-2xl text-slate-400">
              O problema não é apenas operacional. Ele afeta a experiência de todos os envolvidos e pode atrasar conexões importantes justamente quando mais se precisa de agilidade.
            </p>
          </div>

          <div className="relative grid gap-8 md:grid-cols-3 lg:grid-cols-6">
            {chainEffects.map((effect, idx) => (
              <div key={idx} className="relative flex flex-col items-center text-center group">
                <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full border border-white/10 bg-white/5 text-xl font-bold transition-colors group-hover:bg-primary group-hover:border-primary">
                  <effect.icon className="h-7 w-7" />
                </div>
                <span className="mb-2 text-[10px] font-bold uppercase tracking-widest text-primary">Passo {effect.step}</span>
                <p className="text-sm font-medium leading-snug text-slate-300">{effect.label}</p>
                {idx < chainEffects.length - 1 && (
                  <div className="absolute right-[-1rem] top-8 hidden h-px w-8 bg-white/10 lg:block" />
                )}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* 4. SEÇÃO COMO O MERCADO FUNCIONA HOJE */}
      <section className="py-24">
        <div className="container mx-auto px-4">
          <div className="grid gap-16 lg:grid-cols-2 lg:items-center">
            <div className="space-y-6">
              <h2 className="text-3xl font-bold md:text-4xl">Muitas conexões ainda dependem de improviso</h2>
              <p className="text-lg text-muted-foreground leading-relaxed">
                Em muitos casos, a busca por profissionais e oportunidades ainda acontece de forma reativa, dispersa e pouco padronizada. O setor precisa evoluir para um modelo mais profissional e tecnológico.
              </p>
              <div className="grid gap-4 sm:grid-cols-2">
                {[
                  "Grupos de WhatsApp lotados",
                  "Telefonemas individuais exaustivos",
                  "Indicações informais sem validação",
                  "Planilhas e controles manuais",
                  "Informações descentralizadas",
                  "Dificuldade para comparar perfis"
                ].map((item, i) => (
                  <div key={i} className="flex items-center gap-3 text-sm font-medium text-foreground/80">
                    <XCircle className="h-4 w-4 text-destructive" />
                    {item}
                  </div>
                ))}
              </div>
            </div>
            <div className="relative rounded-3xl border bg-secondary/20 p-8 lg:p-12">
              <div className="absolute -right-4 -top-4 h-24 w-24 rounded-full bg-primary/10 blur-2xl" />
              <div className="space-y-6">
                <div className="flex items-center gap-4">
                  <div className="h-10 w-10 rounded-lg bg-primary flex items-center justify-center text-white">
                    <AlertCircle className="h-6 w-6" />
                  </div>
                  <h4 className="font-bold text-xl">O risco do modelo atual</h4>
                </div>
                <p className="text-muted-foreground leading-relaxed">
                  A fragmentação gera um custo invisível: o tempo perdido. Para uma empresa, significa escalas vazias. Para o profissional, dias sem trabalho. Para a família, a angústia da espera.
                </p>
                <Separator className="bg-border/50" />
                <p className="text-sm font-semibold italic text-primary">
                  "O mercado de home care amadureceu, mas as ferramentas de conexão pararam no tempo."
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* 5. SEÇÃO DE TRANSIÇÃO */}
      <section className="bg-primary py-20 text-primary-foreground">
        <div className="container mx-auto px-4 text-center">
          <h2 className="text-3xl font-bold md:text-4xl">
            O problema não é falta de profissionais, empresas ou famílias precisando de apoio.
          </h2>
          <p className="mx-auto mt-6 max-w-3xl text-xl opacity-90">
            O problema é a falta de uma <strong>conexão mais organizada, especializada e eficiente</strong> para o setor de home care.
          </p>
          <p className="mx-auto mt-8 max-w-2xl text-base opacity-80">
            Assim como outros mercados evoluíram com plataformas digitais, o home care também precisa de mais tecnologia, mais visibilidade e mais organização.
          </p>
        </div>
      </section>

      {/* 6. SEÇÃO A SOLUÇÃO É A HOMECARE MATCH */}
      <section className="py-24 bg-white">
        <div className="container mx-auto px-4">
          <div className="mx-auto max-w-4xl text-center space-y-8">
            <h2 className="text-3xl font-bold md:text-4xl">A HomeCare Match organiza a conexão no setor de home care</h2>
            <p className="text-xl text-muted-foreground leading-relaxed">
              Somos uma <strong>plataforma de tecnologia</strong> criada para aproximar profissionais da saúde, empresas de home care e famílias em um ambiente mais organizado, especializado e acessível.
            </p>
            
            <div className="grid gap-4 md:grid-cols-2 text-left mt-12">
              {[
                { title: "Especialização", desc: "Focamos exclusivamente no nicho de home care." },
                { title: "Profissionalismo", desc: "Ambiente seguro para gerar conexões de valor." },
                { title: "Visibilidade", desc: "Damos voz e vitrine para quem oferece o melhor cuidado." },
                { title: "Praticidade", desc: "Tecnologia que simplifica processos complexos." }
              ].map((item, i) => (
                <div key={i} className="flex gap-4 p-4 rounded-2xl border border-border/50 hover:bg-primary/5 transition-colors">
                  <CheckCircle2 className="h-6 w-6 text-success shrink-0" />
                  <div>
                    <h5 className="font-bold">{item.title}</h5>
                    <p className="text-sm text-muted-foreground">{item.desc}</p>
                  </div>
                </div>
              ))}
            </div>

            <div className="mt-12 p-6 rounded-2xl bg-slate-50 border border-dashed border-slate-300">
              <p className="text-sm font-medium text-slate-600">
                Importante: A HomeCare Match não presta serviços de assistência à saúde. Somos o elo tecnológico que facilita o encontro entre quem precisa e quem oferece o cuidado.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* 7. SEÇÃO SOLUÇÃO POR PÚBLICO */}
      <section className="py-24 bg-secondary/20">
        <div className="container mx-auto px-4">
          <div className="mb-16 text-center">
            <h2 className="text-3xl font-bold">Soluções desenhadas para cada necessidade</h2>
          </div>

          <div className="grid gap-8 lg:grid-cols-3">
            {/* Profissionais */}
            <Card className="border-none shadow-lg overflow-hidden group">
              <div className="h-2 bg-primary" />
              <CardHeader className="pb-4">
                <div className="h-12 w-12 rounded-xl bg-primary/10 flex items-center justify-center mb-4">
                  <UserCheck className="h-6 w-6 text-primary" />
                </div>
                <CardTitle className="text-2xl">Para Profissionais</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <ul className="space-y-3">
                  {[
                    "Mais visibilidade no mercado",
                    "Oportunidades reais de trabalho",
                    "Perfil profissional estruturado",
                    "Acesso a cursos de capacitação",
                    "Ambiente focado em sua área"
                  ].map((item, i) => (
                    <li key={i} className="flex items-center gap-3 text-sm text-muted-foreground">
                      <CheckCircle2 className="h-4 w-4 text-success" /> {item}
                    </li>
                  ))}
                </ul>
                <Button asChild className="w-full mt-6" variant="outline">
                  <Link to={LINKS.professional}>Criar meu perfil</Link>
                </Button>
              </CardContent>
            </Card>

            {/* Empresas */}
            <Card className="border-none shadow-lg overflow-hidden group">
              <div className="h-2 bg-success" />
              <CardHeader className="pb-4">
                <div className="h-12 w-12 rounded-xl bg-success/10 flex items-center justify-center mb-4">
                  <Building2 className="h-6 w-6 text-success" />
                </div>
                <CardTitle className="text-2xl">Para Empresas</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <ul className="space-y-3">
                  {[
                    "Agilidade para fechar escalas",
                    "Processo de busca organizado",
                    "Visualização clara de perfis",
                    "Mais eficiência operacional",
                    "Conexão em nicho especializado"
                  ].map((item, i) => (
                    <li key={i} className="flex items-center gap-3 text-sm text-muted-foreground">
                      <CheckCircle2 className="h-4 w-4 text-success" /> {item}
                    </li>
                  ))}
                </ul>
                <Button asChild className="w-full mt-6" variant="outline">
                  <Link to={LINKS.company}>Cadastrar empresa</Link>
                </Button>
              </CardContent>
            </Card>

            {/* Famílias */}
            <Card className="border-none shadow-lg overflow-hidden group">
              <div className="h-2 bg-amber-500" />
              <CardHeader className="pb-4">
                <div className="h-12 w-12 rounded-xl bg-amber-500/10 flex items-center justify-center mb-4">
                  <Home className="h-6 w-6 text-amber-600" />
                </div>
                <CardTitle className="text-2xl">Para Famílias</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <ul className="space-y-3">
                  {[
                    "Clareza total no processo",
                    "Facilidade para encontrar perfis",
                    "Experiência de busca simplificada",
                    "Mais segurança na escolha",
                    "Acesso a suporte especializado"
                  ].map((item, i) => (
                    <li key={i} className="flex items-center gap-3 text-sm text-muted-foreground">
                      <CheckCircle2 className="h-4 w-4 text-success" /> {item}
                    </li>
                  ))}
                </ul>
                <Button asChild className="w-full mt-6" variant="outline">
                  <Link to={LINKS.family}>Buscar para familiar</Link>
                </Button>
              </CardContent>
            </Card>
          </div>
        </div>
      </section>

      {/* 8. SEÇÃO MISSÃO / POSICIONAMENTO */}
      <section className="py-24">
        <div className="container mx-auto px-4 text-center">
          <div className="mx-auto max-w-3xl space-y-8">
            <div className="h-1 w-20 bg-primary mx-auto rounded-full" />
            <h2 className="text-3xl font-bold md:text-4xl">O cuidado domiciliar funciona melhor quando a conexão certa acontece no momento certo</h2>
            <p className="text-lg text-muted-foreground leading-relaxed">
              A HomeCare Match nasceu para fortalecer o ecossistema do home care, criando uma ponte mais inteligente entre quem precisa de cuidado, quem oferece atendimento e quem busca oportunidades na área.
            </p>
            <p className="text-xl font-bold text-foreground">
              O setor merece mais organização, mais visibilidade e mais tecnologia.
            </p>
          </div>
        </div>
      </section>

      {/* 9. CTA FINAL */}
      <section className="bg-slate-900 py-20 text-white">
        <div className="container mx-auto px-4 text-center">
          <h2 className="text-3xl font-bold mb-8">Faça parte dessa transformação</h2>
          <p className="mx-auto mb-12 max-w-2xl text-slate-400 text-lg">
            Entre para a HomeCare Match e faça parte de uma plataforma criada para transformar a forma como o setor de home care se conecta.
          </p>
          <div className="flex flex-col items-center justify-center gap-4 sm:flex-row">
            <Button asChild size="lg" className="w-full sm:w-auto h-14 px-8 bg-primary hover:bg-primary/90">
              <Link to={LINKS.professional}>Sou profissional</Link>
            </Button>
            <Button asChild size="lg" className="w-full sm:w-auto h-14 px-8 bg-success hover:bg-success/90">
              <Link to={LINKS.company}>Sou empresa</Link>
            </Button>
            <Button asChild size="lg" className="w-full sm:w-auto h-14 px-8 bg-amber-600 hover:bg-amber-700">
              <Link to={LINKS.family}>Sou família</Link>
            </Button>
          </div>
        </div>
      </section>
    </Layout>
  );
};

// Helper components for the page
const EyeOff = ({ className }: { className?: string }) => (
  <XCircle className={cn("h-5 w-5", className)} />
);

const Separator = ({ className }: { className?: string }) => (
  <div className={cn("h-px w-full", className)} />
);

export default TheProblem;