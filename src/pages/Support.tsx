"use client";

import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/components/auth/AuthProvider";
import LandingVideoPlayer from "@/components/LandingVideoPlayer";
import SupportTicketModal from "@/components/SupportTicketModal";
import Layout from "@/components/layout/Layout";
import { useSiteConfig } from "@/hooks/use-site-config";
import { useIsMobile } from "@/hooks/use-mobile";
import { supabase } from "@/integrations/supabase/client";
import { resolveLandingVideoAssets } from "@/lib/landing-video";
import {
  formatSupportBusinessHoursSummary,
  formatSupportHoursLabel,
  normalizeSupportBusinessHoursConfig,
  normalizeSupportSlaConfig,
} from "@/lib/support-sla";
import { cn } from "@/lib/utils";
import { resolveVideoOrientation } from "@/lib/video-utils";
import {
  ChevronRight,
  HelpCircle,
  LifeBuoy,
  Loader2,
  MessageSquare,
  Plus,
  Search,
  ShieldAlert,
} from "lucide-react";

const Support = () => {
  const { data: siteConfig } = useSiteConfig();
  const isMobile = useIsMobile();
  const { session } = useAuth();
  const [faqs, setFaqs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [activeCategory, setActiveCategory] = useState<string | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);

  const supportSlaConfig = useMemo(
    () => normalizeSupportSlaConfig(siteConfig?.support_sla_config),
    [siteConfig?.support_sla_config],
  );
  const supportBusinessHours = useMemo(
    () => normalizeSupportBusinessHoursConfig(siteConfig?.support_business_hours_config),
    [siteConfig?.support_business_hours_config],
  );
  const businessHoursLabel = useMemo(
    () => formatSupportBusinessHoursSummary(supportBusinessHours),
    [supportBusinessHours],
  );

  const registrationTutorials = useMemo(() => {
    const entries = [
      {
        key: "professional",
        title: "Tutorial de Cadastro: Profissionais",
        desktopUrl: String(siteConfig?.video_url_how_it_works_professionals || "").trim(),
        mobileUrl: String(siteConfig?.video_url_how_it_works_professionals_mobile || "").trim(),
        storagePath: siteConfig?.video_storage_path_how_it_works_professionals,
        orientation: siteConfig?.video_orientation_how_it_works_professionals,
      },
      {
        key: "company",
        title: "Tutorial de Cadastro: Empresas",
        desktopUrl: String(siteConfig?.video_url_how_it_works_companies || "").trim(),
        mobileUrl: String(siteConfig?.video_url_how_it_works_companies_mobile || "").trim(),
        storagePath: siteConfig?.video_storage_path_how_it_works_companies,
        orientation: siteConfig?.video_orientation_how_it_works_companies,
      },
      {
        key: "family",
        title: "Tutorial de Cadastro: Famílias",
        desktopUrl: String(siteConfig?.video_url_how_it_works_families || "").trim(),
        mobileUrl: String(siteConfig?.video_url_how_it_works_families_mobile || "").trim(),
        storagePath: siteConfig?.video_storage_path_how_it_works_families,
        orientation: siteConfig?.video_orientation_how_it_works_families,
      },
    ];

    return entries.map((entry) => {
      const useMobileUrl = isMobile && entry.mobileUrl.length > 0;
      const assets = resolveLandingVideoAssets(
        useMobileUrl ? null : entry.storagePath,
        useMobileUrl ? entry.mobileUrl : entry.desktopUrl,
      );
      const isVerticalOnMobile =
        isMobile && resolveVideoOrientation(assets.videoUrl, entry.orientation) === "vertical";

      return {
        ...entry,
        videoUrl: assets.videoUrl,
        posterUrl: assets.posterUrl,
        isVerticalOnMobile,
      };
    });
  }, [isMobile, siteConfig]);

  const registrationFaqQuestion = "Como realizar o cadastro na plataforma e validar meu e-mail?";

  const registrationFaq = useMemo(
    () => ({
      id: "faq-cadastro-validacao-email",
      question: registrationFaqQuestion,
      answer:
        "Confira o tutorial correspondente ao seu perfil para concluir cadastro e validação de e-mail.",
      category: "Cadastro e Acesso",
      customContent: (
        <div className="space-y-6">
          <p>
            Escolha o tutorial do seu perfil e siga o passo a passo de cadastro e validação de e-mail:
          </p>
          <div className="space-y-6">
            {registrationTutorials.map((video) => (
              <div key={video.key} className="rounded-xl border border-primary/10 bg-secondary/20 p-4">
                <h4 className="font-semibold text-foreground">{video.title}</h4>
                {video.videoUrl ? (
                  <div
                    className={`mt-3 overflow-hidden rounded-xl border border-border/50 bg-black ${
                      video.isVerticalOnMobile ? "max-w-[360px] aspect-[9/16]" : "aspect-video"
                    }`}
                  >
                    <LandingVideoPlayer
                      url={video.videoUrl}
                      title={video.title}
                      deferLoad={true}
                      posterUrl={video.posterUrl}
                    />
                  </div>
                ) : (
                  <p className="mt-2 text-sm text-muted-foreground">
                    Vídeo ainda não configurado para este perfil.
                  </p>
                )}
              </div>
            ))}
          </div>
        </div>
      ),
    }),
    [registrationTutorials],
  );

  const faqItems = useMemo(() => {
    const normalizedQuestion = registrationFaqQuestion.trim().toLowerCase();
    const source = faqs.map((faq) => {
      const isRegistrationFaq =
        String(faq?.question || "").trim().toLowerCase() === normalizedQuestion;
      if (!isRegistrationFaq) return faq;

      return {
        ...faq,
        category: faq?.category || "Cadastro e Acesso",
        customContent: registrationFaq.customContent,
      };
    });

    const hasRegistrationFaq = source.some(
      (faq) => String(faq?.question || "").trim().toLowerCase() === normalizedQuestion,
    );

    return hasRegistrationFaq ? source : [registrationFaq, ...source];
  }, [faqs, registrationFaq, registrationFaqQuestion]);

  useEffect(() => {
    void fetchFaqs();
  }, []);

  const fetchFaqs = async () => {
    try {
      const { data, error } = await supabase
        .from("support_faqs")
        .select("*")
        .eq("is_published", true)
        .order("position", { ascending: true });

      if (error) throw error;
      setFaqs(data || []);

      if (data && data.length > 0) {
        setActiveCategory(data[0].category || "Geral");
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const categories = useMemo(() => {
    const set = new Set(faqItems.map((faq) => faq.category || "Geral"));
    return Array.from(set).sort();
  }, [faqItems]);

  const filteredFaqs = useMemo(() => {
    const normalizedSearch = search.toLowerCase();

    if (search.trim()) {
      return faqItems.filter(
        (faq) =>
          String(faq.question || "").toLowerCase().includes(normalizedSearch) ||
          String(faq.answer || "").toLowerCase().includes(normalizedSearch),
      );
    }

    return faqItems.filter((faq) => (faq.category || "Geral") === activeCategory);
  }, [faqItems, search, activeCategory]);

  return (
    <Layout>
      <div className="container mx-auto max-w-6xl px-4 py-8">
        <div className="mb-12 text-center">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-primary/10">
            <LifeBuoy className="h-10 w-10 text-primary" />
          </div>
          <h1 className="text-4xl font-bold text-foreground">Como podemos ajudar?</h1>
          <p className="mt-4 text-lg text-muted-foreground">
            Encontre respostas rápidas ou fale com nossa equipe de suporte.
          </p>

          <div className="relative mx-auto mt-8 max-w-2xl">
            <Search className="absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Pesquise por dúvidas, termos ou problemas..."
              className="h-14 border-primary/20 pl-12 text-lg shadow-sm focus:border-primary"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
            />
          </div>
        </div>

        <section className="mb-8 grid gap-4 lg:grid-cols-[1.6fr_1fr]">
          <Card className="border-primary/10 bg-primary/5">
            <CardContent className="space-y-5 p-6">
              <div className="flex items-start gap-3">
                <div className="rounded-xl bg-primary/10 p-3">
                  <MessageSquare className="h-5 w-5 text-primary" />
                </div>
                <div className="space-y-1">
                  <h2 className="text-lg font-semibold">SLA de primeira resposta</h2>
                  <p className="text-sm text-muted-foreground">
                    Os prazos abaixo valem para a primeira resposta humana do suporte, não para a resolução completa do caso.
                  </p>
                </div>
              </div>

              <div className="grid gap-3 md:grid-cols-2">
                {supportSlaConfig.categories.map((category) => (
                  <div
                    key={category.key}
                    className="rounded-2xl border border-primary/10 bg-background/80 p-4"
                  >
                    <div className="flex items-center justify-between gap-3">
                      <p className="font-semibold text-foreground">{category.label}</p>
                      <Badge variant="secondary">
                        até {formatSupportHoursLabel(category.first_response_hours)}
                      </Badge>
                    </div>
                    <p className="mt-2 text-sm text-muted-foreground">{category.description}</p>
                  </div>
                ))}
              </div>

              <div className="rounded-2xl border border-dashed border-primary/20 bg-background/70 p-4 text-sm text-muted-foreground">
                <p className="font-medium text-foreground">Horário de atendimento</p>
                <p className="mt-1">{businessHoursLabel}</p>
                <p className="mt-3">{supportSlaConfig.public_note}</p>
              </div>
            </CardContent>
          </Card>

          <Card className="border-amber-200 bg-amber-50/80">
            <CardContent className="space-y-4 p-6">
              <div className="flex items-start gap-3">
                <div className="rounded-xl bg-amber-100 p-3">
                  <ShieldAlert className="h-5 w-5 text-amber-700" />
                </div>
                <div>
                  <h2 className="text-lg font-semibold text-amber-950">Casos graves</h2>
                  <p className="mt-1 text-sm text-amber-900/80">
                    Situações de segurança, suspeita de crime, fraude ou risco imediato devem ser registradas por denúncia e por chamado de suporte.
                  </p>
                </div>
              </div>
              <p className="text-sm text-amber-900/80">
                Isso agiliza a triagem interna, preserva os registros e permite acionar o protocolo de crise quando necessário.
              </p>
              <Button className="w-full gap-2" onClick={() => setIsModalOpen(true)}>
                <Plus className="h-4 w-4" />
                Abrir chamado
              </Button>
            </CardContent>
          </Card>
        </section>

        <div className="grid gap-8 lg:grid-cols-12">
          <div className="space-y-4 lg:col-span-3">
            <div className="hidden space-y-1 lg:block">
              <h3 className="mb-4 px-3 text-xs font-bold uppercase tracking-widest text-muted-foreground">
                Categorias
              </h3>
              {categories.map((category) => (
                <button
                  key={category}
                  onClick={() => {
                    setActiveCategory(category);
                    setSearch("");
                  }}
                  className={cn(
                    "flex w-full items-center justify-between rounded-xl px-4 py-3 text-sm font-medium transition-all",
                    activeCategory === category && !search
                      ? "translate-x-1 bg-primary text-primary-foreground shadow-md"
                      : "text-muted-foreground hover:bg-secondary hover:text-foreground",
                  )}
                >
                  <span className="truncate">{category}</span>
                  <ChevronRight
                    className={cn(
                      "h-4 w-4 opacity-50",
                      activeCategory === category && !search ? "opacity-100" : "",
                    )}
                  />
                </button>
              ))}
            </div>

            <div className="space-y-2 lg:hidden">
              <Label className="px-1 text-sm font-semibold text-muted-foreground">
                Selecione a categoria que deseja visualizar:
              </Label>
              <select
                value={activeCategory || ""}
                onChange={(event) => {
                  setActiveCategory(event.target.value);
                  setSearch("");
                }}
                className="h-12 w-full rounded-xl border border-input bg-background px-3 py-2 text-sm ring-offset-background focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
              >
                {categories.map((category) => (
                  <option key={category} value={category}>
                    {category}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="space-y-8 lg:col-span-9">
            <section className="animate-fade-in">
              <div className="mb-6 flex items-center justify-between">
                <h2 className="flex items-center gap-2 text-2xl font-bold">
                  {search ? (
                    <>
                      <Search className="h-6 w-6 text-primary" />
                      Resultados da busca
                    </>
                  ) : (
                    <>
                      <HelpCircle className="h-6 w-6 text-primary" />
                      {activeCategory}
                    </>
                  )}
                </h2>
                {search && <Badge variant="secondary">{filteredFaqs.length} encontrados</Badge>}
              </div>

              {loading ? (
                <div className="flex justify-center py-12">
                  <Loader2 className="animate-spin text-primary" />
                </div>
              ) : filteredFaqs.length > 0 ? (
                <Accordion type="single" collapsible className="w-full space-y-4">
                  {filteredFaqs.map((faq) => (
                    <AccordionItem
                      key={faq.id}
                      value={faq.id}
                      className="rounded-2xl border border-primary/5 bg-card px-6 shadow-sm transition-all hover:shadow-md"
                    >
                      <AccordionTrigger className="py-5 text-left font-bold leading-tight text-foreground/90 hover:no-underline">
                        {faq.question}
                      </AccordionTrigger>
                      <AccordionContent className="pb-6 text-base leading-relaxed text-muted-foreground">
                        {faq.customContent ? (
                          faq.customContent
                        ) : (
                          <div className="prose prose-slate max-w-none">{faq.answer}</div>
                        )}
                      </AccordionContent>
                    </AccordionItem>
                  ))}
                </Accordion>
              ) : (
                <div className="rounded-3xl border border-dashed py-20 text-center">
                  <Search className="mx-auto mb-4 h-12 w-12 opacity-20" />
                  <p className="text-muted-foreground">Nenhuma resposta encontrada para sua busca.</p>
                  <Button variant="link" onClick={() => setSearch("")}>
                    Limpar filtros
                  </Button>
                </div>
              )}
            </section>

            <div className="mt-12 border-t border-dashed pt-8">
              <Card className="relative overflow-hidden border-primary/10 bg-primary/5">
                <div className="absolute left-0 top-0 h-full w-1 bg-primary" />
                <CardContent className="px-6 pb-8 pt-8 sm:px-10">
                  <div className="flex flex-col items-center justify-between gap-8 text-center md:flex-row md:text-left">
                    <div className="flex flex-col items-center gap-6 md:flex-row">
                      <div className="flex h-16 w-16 shrink-0 rotate-3 items-center justify-center rounded-2xl bg-primary/10">
                        <MessageSquare className="h-8 w-8 text-primary" />
                      </div>
                      <div className="space-y-2">
                        <h3 className="text-xl font-bold">Não encontrou o que precisava?</h3>
                        <p className="max-w-md text-muted-foreground">
                          Abra um chamado com a categoria correta. Pagamentos recebem primeira resposta em até 2 horas úteis e os demais assuntos em até 24 horas úteis.
                        </p>
                      </div>
                    </div>
                    <div className="flex w-full flex-col gap-3 md:w-auto">
                      <Button
                        variant="default"
                        size="lg"
                        className="h-14 gap-2 px-8 text-lg shadow-lg"
                        onClick={() => setIsModalOpen(true)}
                      >
                        <Plus className="h-5 w-5" />
                        Abrir um chamado
                      </Button>
                      {session && (
                        <Link
                          to="/dashboard/suporte"
                          className="text-sm font-medium text-primary hover:underline"
                        >
                          Ver histórico de chamados
                        </Link>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        </div>
      </div>

      <SupportTicketModal open={isModalOpen} onOpenChange={setIsModalOpen} initialStep="form" />
    </Layout>
  );
};

export default Support;
