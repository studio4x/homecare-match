"use client";

import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useSearchParams } from "react-router-dom";
import { DndContext, PointerSensor, closestCenter, useSensor, useSensors, type DragEndEvent } from "@dnd-kit/core";
import { SortableContext, arrayMove, useSortable, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Loader2, Plus, Edit2, Trash2, Tag, FolderOpen, Pencil, BookOpenText, Wand2, GripVertical } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

const csvToArray = (value: string) =>
  String(value || "")
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);

const arrayToCsv = (value: unknown) => (Array.isArray(value) ? value.filter(Boolean).join(", ") : "");

type GuideCoverageArea = {
  id: string;
  label: string;
  moduleHints: string[];
  keywords: string[];
};

type AutoGuideTemplate = {
  title: string;
  module: string;
  audience: string[];
  question_variants: string[];
  content: string;
};

const GUIDE_COVERAGE_AREAS: GuideCoverageArea[] = [
  {
    id: "onboarding",
    label: "Onboarding e cadastro",
    moduleHints: ["onboarding", "conta"],
    keywords: ["cadastro", "criar conta", "primeiro acesso", "onboarding", "tipo de cadastro"],
  },
  {
    id: "login_password",
    label: "Login e recuperacao de senha",
    moduleHints: ["conta"],
    keywords: ["login", "entrar", "redefinir senha", "esqueci a senha", "recuperar acesso"],
  },
  {
    id: "perfil_profissional",
    label: "Perfil profissional e bio",
    moduleHints: ["perfil"],
    keywords: ["perfil profissional", "biografia", "bio", "visibilidade", "experiencias"],
  },
  {
    id: "busca_e_contato",
    label: "Busca de profissionais e contato",
    moduleHints: ["busca", "contatos"],
    keywords: ["buscar profissional", "filtros", "geolocalizacao", "whatsapp", "contato"],
  },
  {
    id: "empresa_pacientes",
    label: "Fluxo de empresa e pacientes",
    moduleHints: ["pacientes", "processos_empresa"],
    keywords: ["pacientes", "empresa", "vaga", "demanda", "recrutamento"],
  },
  {
    id: "familia_fluxo",
    label: "Fluxo de familia",
    moduleHints: ["processos_familia"],
    keywords: ["familia", "contratar profissional", "cuidador", "caso familiar"],
  },
  {
    id: "planos_pagamentos",
    label: "Planos e pagamentos",
    moduleHints: ["planos", "pagamentos", "assinatura"],
    keywords: ["plano mensal", "plano anual", "fatura", "cobranca", "cancelamento", "parcelamento"],
  },
  {
    id: "trial_cupom",
    label: "Teste gratis e cupom",
    moduleHints: ["trial", "planos", "pagamentos"],
    keywords: ["teste gratis", "7 dias", "cupom", "dias bonus", "acesso limitado"],
  },
  {
    id: "academy_cursos",
    label: "Academy e cursos",
    moduleHints: ["academy", "cursos", "certificados"],
    keywords: ["academy", "curso", "progresso", "certificado", "validar certificado"],
  },
  {
    id: "indicacoes_convite",
    label: "Indicacoes e convite",
    moduleHints: ["indicacoes"],
    keywords: ["indicacao", "convite", "link de convite", "embaixador"],
  },
  {
    id: "avisos_notificacoes",
    label: "Avisos e notificacoes",
    moduleHints: ["avisos", "notificacoes"],
    keywords: ["avisos", "comunicados", "notificacao", "push"],
  },
  {
    id: "suporte_faq",
    label: "Suporte, chatbot e FAQ",
    moduleHints: ["suporte", "faq"],
    keywords: ["ticket", "chamado", "chatbot", "faq", "duvidas frequentes"],
  },
  {
    id: "seguranca",
    label: "Seguranca, verificacao e denuncias",
    moduleHints: ["seguranca", "qualidade"],
    keywords: ["selo", "verificacao", "documentos", "denuncia", "seguranca"],
  },
  {
    id: "concierge",
    label: "Concierge e casos urgentes",
    moduleHints: ["concierge", "processos_criticos"],
    keywords: ["concierge", "urgencia", "busca assistida", "caso complexo"],
  },
  {
    id: "pwa_blog_funcionalidades",
    label: "PWA, blog e pagina de funcionalidades",
    moduleHints: ["app", "blog", "funcionalidades"],
    keywords: ["pwa", "instalar app", "blog", "funcionalidades", "recursos da plataforma"],
  },
];

const AUTO_GUIDE_TEMPLATES: Record<string, AutoGuideTemplate> = {
  onboarding: {
    title: "Guia essencial: onboarding e cadastro",
    module: "onboarding",
    audience: ["professional", "company", "family"],
    question_variants: ["como me cadastrar", "primeiro acesso", "onboarding da plataforma"],
    content:
      "1) Crie sua conta no fluxo correto (profissional, empresa ou familia). 2) Confirme acesso e entre no Dashboard. 3) Complete dados principais do perfil. 4) Siga para o primeiro fluxo objetivo da sua rotina.",
  },
  login_password: {
    title: "Guia essencial: login e recuperacao de senha",
    module: "conta",
    audience: ["professional", "company", "family"],
    question_variants: ["como fazer login", "esqueci minha senha", "redefinir senha"],
    content:
      "1) Acesse a tela de login e autentique sua conta. 2) Se nao lembrar a senha, use recuperar senha. 3) Abra o link enviado por e-mail. 4) Defina nova senha e retorne ao painel.",
  },
  perfil_profissional: {
    title: "Guia essencial: perfil profissional completo",
    module: "perfil",
    audience: ["professional"],
    question_variants: ["como melhorar meu perfil", "como aumentar visibilidade", "biografia profissional"],
    content:
      "1) Atualize bio, experiencias e formacoes. 2) Revise clareza e coerencia dos dados. 3) Mantenha contato e disponibilidade em dia. 4) Reavalie o perfil periodicamente para melhorar conversao.",
  },
  busca_e_contato: {
    title: "Guia essencial: busca e contato com profissionais",
    module: "busca",
    audience: ["company", "family"],
    question_variants: ["como buscar profissional", "filtros de busca", "contato por whatsapp"],
    content:
      "1) Aplique filtros de localizacao, especialidade e disponibilidade. 2) Compare perfis aderentes. 3) Inicie contato com os candidatos mais alinhados. 4) Registre andamento no painel de contatos.",
  },
  empresa_pacientes: {
    title: "Guia essencial: fluxo de empresa e pacientes",
    module: "pacientes",
    audience: ["company"],
    question_variants: ["como cadastrar paciente", "fluxo da empresa", "organizar demandas"],
    content:
      "1) Cadastre pacientes com informacoes essenciais do caso. 2) Estruture criterios de contratacao. 3) Busque candidatos aderentes. 4) Acompanhe cada etapa do processo com historico.",
  },
  familia_fluxo: {
    title: "Guia essencial: fluxo da familia",
    module: "processos_familia",
    audience: ["family"],
    question_variants: ["como familia encontra cuidador", "fluxo de contratacao familia", "como avaliar profissional"],
    content:
      "1) Defina criterios do cuidado. 2) Busque perfis aderentes. 3) Valide experiencia e sinais de confianca. 4) Inicie contato e acompanhe retorno ate fechar a melhor opcao.",
  },
  planos_pagamentos: {
    title: "Guia essencial: planos e pagamentos",
    module: "pagamentos",
    audience: ["professional"],
    question_variants: ["plano mensal ou anual", "como pagar assinatura", "cancelamento de assinatura"],
    content:
      "1) Compare plano mensal e anual conforme sua estrategia. 2) Acompanhe cobranca e historico no Dashboard > Pagamentos. 3) Resolva pendencias rapidamente. 4) Use o fluxo de cancelamento quando aplicavel.",
  },
  trial_cupom: {
    title: "Guia essencial: teste gratis e cupom",
    module: "trial",
    audience: ["professional"],
    question_variants: ["quanto dura teste gratis", "cupom no cadastro", "dias de beneficio"],
    content:
      "1) O cadastro padrao ativa 7 dias de teste gratis com acesso limitado. 2) Se houver cupom valido no cadastro, valem os dias do cupom. 3) Acompanhe dias restantes no painel e planeje renovacao.",
  },
  academy_cursos: {
    title: "Guia essencial: academy e cursos",
    module: "cursos",
    audience: ["professional"],
    question_variants: ["como iniciar curso", "progresso do curso", "emitir certificado"],
    content:
      "1) Inicie cursos na area de cursos do painel. 2) Avance por modulos para registrar progresso. 3) Conclua trilha para liberar certificado quando aplicavel. 4) Use validacao publica para comprovar autenticidade.",
  },
  indicacoes_convite: {
    title: "Guia essencial: indicacoes e convite",
    module: "indicacoes",
    audience: ["professional"],
    question_variants: ["como indicar colega", "link de convite", "acompanhar indicados"],
    content:
      "1) Gere seu link de indicacao. 2) Compartilhe com pessoas aderentes ao perfil da plataforma. 3) Monitore cadastros e evolucao dos indicados no painel. 4) Ajuste abordagem para melhorar conversao.",
  },
  avisos_notificacoes: {
    title: "Guia essencial: avisos e notificacoes",
    module: "notificacoes",
    audience: ["professional", "company", "family"],
    question_variants: ["onde ver avisos", "notificacoes em tempo real", "ativar push"],
    content:
      "1) Verifique avisos no painel diariamente. 2) Ative notificacoes para nao perder atualizacoes importantes. 3) Priorize alertas urgentes. 4) Mantenha rotina de acompanhamento recorrente.",
  },
  suporte_faq: {
    title: "Guia essencial: suporte, chatbot e FAQ",
    module: "suporte",
    audience: ["professional", "company", "family"],
    question_variants: ["quando usar chatbot", "quando abrir chamado", "onde ver faq"],
    content:
      "1) Use chatbot para duvidas de uso e fluxos. 2) Consulte FAQ para respostas rapidas. 3) Abra chamado para erros tecnicos, bloqueios ou casos especificos. 4) Mantenha tudo no mesmo ticket para historico.",
  },
  seguranca: {
    title: "Guia essencial: seguranca, verificacao e denuncias",
    module: "seguranca",
    audience: ["professional", "company", "family"],
    question_variants: ["selo de verificacao", "como denunciar", "seguranca da comunidade"],
    content:
      "1) Siga verificacao documental quando solicitada. 2) Use canais de denuncia com fatos objetivos e evidencias. 3) Para situacoes criticas, acione suporte. 4) Mantenha boas praticas em todas as interacoes.",
  },
  concierge: {
    title: "Guia essencial: concierge e urgencias",
    module: "concierge",
    audience: ["company", "family"],
    question_variants: ["como solicitar concierge", "caso urgente", "busca assistida"],
    content:
      "1) Acione concierge em urgencias ou casos complexos. 2) Informe criterios clinicos e operacionais do caso. 3) Acompanhe orientacoes da equipe. 4) Use shortlist sugerida para acelerar decisao.",
  },
  pwa_blog_funcionalidades: {
    title: "Guia essencial: pwa, blog e funcionalidades",
    module: "funcionalidades",
    audience: ["professional", "company", "family"],
    question_variants: ["instalar app", "onde ver funcionalidades", "como usar blog"],
    content:
      "1) Consulte a pagina de funcionalidades para mapa de recursos. 2) Instale o app (PWA) para acesso rapido no celular. 3) Use o blog para apoio de boas praticas. 4) Aplique os conteudos na rotina da plataforma.",
  },
};

const normalizeGuideText = (value: unknown) =>
  String(value || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, " ")
    .replace(/\s+/g, " ")
    .trim();

type SortableFaqRowProps = {
  faq: any;
  onEditFaq: (faq: any) => void;
  onDeleteFaq: (id: string) => void;
  disableActions?: boolean;
};

const SortableFaqRow = ({ faq, onEditFaq, onDeleteFaq, disableActions = false }: SortableFaqRowProps) => {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: faq.id,
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  return (
    <TableRow
      ref={setNodeRef}
      style={style}
      className={cn(isDragging && "bg-primary/5", disableActions && "opacity-70")}
    >
      <TableCell>
        <button
          type="button"
          className="inline-flex h-7 w-7 items-center justify-center rounded-md border text-muted-foreground hover:bg-secondary disabled:cursor-not-allowed disabled:opacity-50"
          title="Arrastar para reordenar"
          disabled={disableActions}
          {...attributes}
          {...listeners}
        >
          <GripVertical className="h-4 w-4" />
        </button>
      </TableCell>
      <TableCell className="font-mono text-xs text-muted-foreground">{faq.position}</TableCell>
      <TableCell className="max-w-md truncate font-medium">{faq.question}</TableCell>
      <TableCell>
        <Badge
          variant={faq.is_published ? "default" : "outline"}
          className={faq.is_published ? "bg-success hover:bg-success" : ""}
        >
          {faq.is_published ? "Publicado" : "Rascunho"}
        </Badge>
      </TableCell>
      <TableCell className="flex justify-end gap-1 text-right">
        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => onEditFaq(faq)} disabled={disableActions}>
          <Edit2 className="h-4 w-4" />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8 text-destructive hover:bg-destructive/10"
          onClick={() => onDeleteFaq(faq.id)}
          disabled={disableActions}
        >
          <Trash2 className="h-4 w-4" />
        </Button>
      </TableCell>
    </TableRow>
  );
};

const FaqAdminPage = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const [activeTab, setActiveTab] = useState("faqs");
  const [faqs, setFaqs] = useState<any[]>([]);
  const [guides, setGuides] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const [openFaqDialog, setOpenFaqDialog] = useState(false);
  const [selectedFaq, setSelectedFaq] = useState<any>(null);
  const [isSavingFaq, setIsSavingFaq] = useState(false);
  const [pendingSuggestionId, setPendingSuggestionId] = useState<string | null>(null);

  const [newCategoryMode, setNewCategoryMode] = useState(false);
  const [customCategory, setCustomCategory] = useState("");
  const [renameDialogOpen, setRenameDialogOpen] = useState(false);
  const [categoryToRename, setCategoryToRename] = useState("");
  const [newCategoryName, setNewCategoryName] = useState("");
  const [isRenaming, setIsRenaming] = useState(false);

  const [openGuideDialog, setOpenGuideDialog] = useState(false);
  const [selectedGuide, setSelectedGuide] = useState<any>(null);
  const [guideAudienceInput, setGuideAudienceInput] = useState("");
  const [guideVariantsInput, setGuideVariantsInput] = useState("");
  const [isSavingGuide, setIsSavingGuide] = useState(false);
  const [isGeneratingMissingGuides, setIsGeneratingMissingGuides] = useState(false);
  const [guideModuleFilter, setGuideModuleFilter] = useState("all");
  const [orderingCategory, setOrderingCategory] = useState<string | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    }),
  );

  const defaultFaqCategory = useMemo(() => {
    const categorySet = new Set<string>();
    for (const faq of faqs) {
      const category = String(faq?.category || "").trim();
      if (category) categorySet.add(category);
    }
    const sortedCategories = Array.from(categorySet).sort();
    return sortedCategories[0] || "geral";
  }, [faqs]);

  useEffect(() => {
    fetchKnowledgeBase();
  }, []);

  useEffect(() => {
    const questionFromQuery = String(searchParams.get("createFromQuestion") || "").trim();
    if (!questionFromQuery) return;

    const suggestionIdFromQuery = String(searchParams.get("sourceSuggestionId") || "").trim();
    setActiveTab("faqs");
    setSelectedFaq({
      question: questionFromQuery,
      answer: "",
      category: defaultFaqCategory,
      position: faqs.length,
      is_published: true,
    });
    setPendingSuggestionId(suggestionIdFromQuery || null);
    setNewCategoryMode(false);
    setCustomCategory("");
    setOpenFaqDialog(true);

    const nextParams = new URLSearchParams(searchParams);
    nextParams.delete("createFromQuestion");
    nextParams.delete("sourceSuggestionId");
    setSearchParams(nextParams, { replace: true });
  }, [searchParams, setSearchParams, defaultFaqCategory, faqs.length]);

  const fetchKnowledgeBase = async (silent = false) => {
    if (!silent) setLoading(true);
    else setIsRefreshing(true);

    try {
      const [faqRes, guidesRes] = await Promise.all([
        supabase.from("support_faqs").select("*").order("position", { ascending: true }),
        supabase.from("support_guides").select("*").order("position", { ascending: true }),
      ]);

      if (faqRes.error) throw faqRes.error;
      setFaqs(faqRes.data || []);

      if (guidesRes.error) {
        if (String(guidesRes.error.code || "") === "42P01") {
          setGuides([]);
          toast.error("Tabela support_guides nao encontrada. Execute a sincronizacao da Central de Suporte.");
        } else {
          throw guidesRes.error;
        }
      } else {
        setGuides(guidesRes.data || []);
      }
    } catch (error) {
      console.error(error);
      toast.error("Erro ao carregar base de conhecimento.");
    } finally {
      setLoading(false);
      setIsRefreshing(false);
    }
  };

  const groupedFaqs = useMemo(() => {
    const groups: Record<string, any[]> = {};
    for (const faq of faqs) {
      const category = faq.category || "Geral";
      if (!groups[category]) groups[category] = [];
      groups[category].push(faq);
    }
    for (const key of Object.keys(groups)) {
      groups[key].sort((a, b) => Number(a?.position || 0) - Number(b?.position || 0));
    }
    return groups;
  }, [faqs]);

  const categories = useMemo(() => Object.keys(groupedFaqs).sort(), [groupedFaqs]);

  const guideModuleOptions = useMemo(() => {
    const modules = new Set<string>();
    for (const guide of guides) {
      const moduleName = String(guide?.module || "").trim();
      if (moduleName) modules.add(moduleName);
    }
    return Array.from(modules).sort();
  }, [guides]);

  const filteredGuides = useMemo(() => {
    if (guideModuleFilter === "all") return guides;
    return guides.filter((guide) => String(guide?.module || "").trim() === guideModuleFilter);
  }, [guides, guideModuleFilter]);

  const guideCoverageSummary = useMemo(() => {
    const publishedGuides = guides.filter((guide) => guide?.is_published);
    const guideBlobs = publishedGuides.map((guide) => {
      const variants = Array.isArray(guide?.question_variants) ? guide.question_variants.join(" ") : "";
      const audience = Array.isArray(guide?.audience) ? guide.audience.join(" ") : "";
      const blob = [guide?.title, guide?.module, guide?.content, variants, audience].join(" ");
      return normalizeGuideText(blob);
    });

    const coverage = GUIDE_COVERAGE_AREAS.map((area) => {
      const covered = guideBlobs.some((blob) => {
        const hasModuleHint = area.moduleHints.some((hint) => blob.includes(normalizeGuideText(hint)));
        const hasKeyword = area.keywords.some((keyword) => blob.includes(normalizeGuideText(keyword)));
        return hasModuleHint || hasKeyword;
      });

      return { ...area, covered };
    });

    const coveredCount = coverage.filter((item) => item.covered).length;
    const totalCount = coverage.length;
    const percent = totalCount > 0 ? Math.round((coveredCount / totalCount) * 100) : 0;

    return {
      coverage,
      coveredCount,
      totalCount,
      percent,
      missing: coverage.filter((item) => !item.covered),
    };
  }, [guides]);

  const handleCreateMissingGuides = async () => {
    if (guideCoverageSummary.missing.length === 0) {
      toast.success("A cobertura ja esta completa. Nenhum guia faltando.");
      return;
    }

    if (!confirm("Deseja criar automaticamente os guias faltantes da cobertura?")) return;

    setIsGeneratingMissingGuides(true);
    try {
      const existingKeys = new Set(
        guides.map((guide) => {
          const title = normalizeGuideText(guide?.title || "");
          const module = normalizeGuideText(guide?.module || "geral");
          return `${title}::${module}`;
        }),
      );

      let nextPosition =
        guides.reduce((maxPos, guide) => Math.max(maxPos, Number(guide?.position) || 0), 0) + 10;

      const payload = guideCoverageSummary.missing
        .map((area) => AUTO_GUIDE_TEMPLATES[area.id])
        .filter((template): template is AutoGuideTemplate => !!template)
        .filter((template) => {
          const key = `${normalizeGuideText(template.title)}::${normalizeGuideText(template.module)}`;
          if (existingKeys.has(key)) return false;
          existingKeys.add(key);
          return true;
        })
        .map((template) => {
          const row = {
            title: template.title,
            module: template.module,
            audience: template.audience,
            question_variants: template.question_variants,
            content: template.content,
            position: nextPosition,
            is_published: true,
          };
          nextPosition += 10;
          return row;
        });

      if (payload.length === 0) {
        toast.success("Guias faltantes ja existem no banco. Nada novo para criar.");
        return;
      }

      const { error } = await supabase.from("support_guides").insert(payload);
      if (error) throw error;

      toast.success(`${payload.length} guia(s) criado(s) automaticamente.`);
      await fetchKnowledgeBase(true);
    } catch (error) {
      console.error(error);
      const message =
        String((error as any)?.code || "") === "42P01"
          ? "Tabela support_guides nao encontrada. Execute a sincronizacao da Central de Suporte."
          : "Erro ao criar guias faltantes.";
      toast.error(message);
    } finally {
      setIsGeneratingMissingGuides(false);
    }
  };

  const handleNewFaq = (category?: string) => {
    setSelectedFaq({
      question: "",
      answer: "",
      category: category || categories[0] || "geral",
      position: faqs.length,
      is_published: true,
    });
    setPendingSuggestionId(null);
    setNewCategoryMode(false);
    setCustomCategory("");
    setOpenFaqDialog(true);
  };

  const handleEditFaq = (faq: any) => {
    setSelectedFaq({ ...faq });
    setPendingSuggestionId(null);
    setNewCategoryMode(false);
    setCustomCategory("");
    setOpenFaqDialog(true);
  };

  const closeFaqDialog = () => {
    setOpenFaqDialog(false);
    setSelectedFaq(null);
    setPendingSuggestionId(null);
    setNewCategoryMode(false);
    setCustomCategory("");
  };

  const handleSaveFaq = async () => {
    if (!selectedFaq?.question || !selectedFaq?.answer) {
      toast.error("Pergunta e resposta sao obrigatorias.");
      return;
    }

    const finalCategory = newCategoryMode ? customCategory.trim() : selectedFaq.category;
    if (!finalCategory) {
      toast.error("Categoria obrigatoria.");
      return;
    }

    setIsSavingFaq(true);
    try {
      const payload = { ...selectedFaq, category: finalCategory };
      const { error } = await supabase.from("support_faqs").upsert(payload);
      if (error) throw error;

      if (pendingSuggestionId) {
        const { error: suggestionError } = await supabase
          .from("chatbot_unanswered_questions")
          .update({ status: "implemented" })
          .eq("id", pendingSuggestionId);

        if (suggestionError) {
          console.error(suggestionError);
          toast.success("FAQ salva!");
        } else {
          toast.success("FAQ salva e sugestao marcada como implementada.");
        }
      } else {
        toast.success("FAQ salva!");
      }

      closeFaqDialog();
      fetchKnowledgeBase(true);
    } catch (error) {
      console.error(error);
      toast.error("Erro ao salvar FAQ.");
    } finally {
      setIsSavingFaq(false);
    }
  };

  const handleDeleteFaq = async (id: string) => {
    if (!confirm("Deseja excluir esta FAQ?")) return;
    try {
      const { error } = await supabase.from("support_faqs").delete().eq("id", id);
      if (error) throw error;
      toast.success("FAQ removida.");
      fetchKnowledgeBase(true);
    } catch (error) {
      console.error(error);
      toast.error("Erro ao excluir FAQ.");
    }
  };

  const handleFaqDragEnd = async (category: string, event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const categoryFaqs = groupedFaqs[category] || [];
    const oldIndex = categoryFaqs.findIndex((faq) => faq.id === active.id);
    const newIndex = categoryFaqs.findIndex((faq) => faq.id === over.id);

    if (oldIndex < 0 || newIndex < 0) return;

    const reordered = arrayMove(categoryFaqs, oldIndex, newIndex);
    const sortedPositions = [...categoryFaqs]
      .map((faq) => Number(faq?.position || 0))
      .sort((a, b) => a - b);

    const positionMap = new Map<string, number>();
    reordered.forEach((faq, index) => {
      const fallback = sortedPositions.length > 0 ? sortedPositions[0] + index : index;
      positionMap.set(faq.id, sortedPositions[index] ?? fallback);
    });

    const updates = reordered
      .map((faq) => ({
        id: faq.id,
        position: positionMap.get(faq.id) ?? Number(faq?.position || 0),
      }))
      .filter((row) => {
        const current = categoryFaqs.find((faq) => faq.id === row.id);
        return Number(current?.position || 0) !== row.position;
      });

    if (updates.length === 0) return;

    setOrderingCategory(category);
    setFaqs((prev) =>
      prev.map((faq) =>
        positionMap.has(faq.id) ? { ...faq, position: positionMap.get(faq.id) } : faq,
      ),
    );

    try {
      const results = await Promise.all(
        updates.map((row) =>
          supabase.from("support_faqs").update({ position: row.position }).eq("id", row.id),
        ),
      );
      const failed = results.find((result) => result.error);
      if (failed?.error) throw failed.error;

      toast.success("Ordem da categoria atualizada.");
      await fetchKnowledgeBase(true);
    } catch (error) {
      console.error(error);
      toast.error("Erro ao salvar ordenacao da categoria.");
      await fetchKnowledgeBase(true);
    } finally {
      setOrderingCategory(null);
    }
  };

  const handleRenameCategory = async () => {
    if (!newCategoryName.trim() || newCategoryName === categoryToRename) {
      setRenameDialogOpen(false);
      return;
    }

    setIsRenaming(true);
    try {
      const { error } = await supabase
        .from("support_faqs")
        .update({ category: newCategoryName.trim() })
        .eq("category", categoryToRename);
      if (error) throw error;

      toast.success("Categoria renomeada.");
      setRenameDialogOpen(false);
      fetchKnowledgeBase(true);
    } catch (error) {
      console.error(error);
      toast.error("Erro ao renomear categoria.");
    } finally {
      setIsRenaming(false);
    }
  };

  const handleNewGuide = () => {
    setSelectedGuide({
      title: "",
      module: "geral",
      audience: [],
      question_variants: [],
      content: "",
      position: guides.length,
      is_published: true,
    });
    setGuideAudienceInput("");
    setGuideVariantsInput("");
    setOpenGuideDialog(true);
  };

  const handleEditGuide = (guide: any) => {
    setSelectedGuide({ ...guide });
    setGuideAudienceInput(arrayToCsv(guide.audience));
    setGuideVariantsInput(arrayToCsv(guide.question_variants));
    setOpenGuideDialog(true);
  };

  const handleSaveGuide = async () => {
    if (!selectedGuide?.title || !selectedGuide?.content) {
      toast.error("Titulo e conteudo do guia sao obrigatorios.");
      return;
    }

    setIsSavingGuide(true);
    try {
      const payload = {
        ...selectedGuide,
        audience: csvToArray(guideAudienceInput),
        question_variants: csvToArray(guideVariantsInput),
        module: String(selectedGuide.module || "geral").trim() || "geral",
      };
      const { error } = await supabase.from("support_guides").upsert(payload);
      if (error) throw error;

      toast.success("Guia salvo!");
      setOpenGuideDialog(false);
      fetchKnowledgeBase(true);
    } catch (error) {
      console.error(error);
      const message =
        String((error as any)?.code || "") === "42P01"
          ? "Tabela support_guides nao encontrada. Execute a sincronizacao da Central de Suporte."
          : "Erro ao salvar guia.";
      toast.error(message);
    } finally {
      setIsSavingGuide(false);
    }
  };

  const handleDeleteGuide = async (id: string) => {
    if (!confirm("Deseja excluir este guia de uso?")) return;
    try {
      const { error } = await supabase.from("support_guides").delete().eq("id", id);
      if (error) throw error;
      toast.success("Guia removido.");
      fetchKnowledgeBase(true);
    } catch (error) {
      console.error(error);
      const message =
        String((error as any)?.code || "") === "42P01"
          ? "Tabela support_guides nao encontrada. Execute a sincronizacao da Central de Suporte."
          : "Erro ao excluir guia.";
      toast.error(message);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Base de Conhecimento</h1>
          <p className="text-muted-foreground">Gerencie FAQs e guias de uso consumidos pelo chatbot.</p>
        </div>
        <div className="flex items-center gap-3">
          {isRefreshing && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />}
          {activeTab === "faqs" ? (
            <Button onClick={() => handleNewFaq()} className="gap-2">
              <Plus className="h-4 w-4" /> Nova FAQ
            </Button>
          ) : (
            <Button onClick={handleNewGuide} className="gap-2">
              <Plus className="h-4 w-4" /> Novo Guia
            </Button>
          )}
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full max-w-md grid-cols-2">
          <TabsTrigger value="faqs">FAQs</TabsTrigger>
          <TabsTrigger value="guides">Guias de Uso</TabsTrigger>
        </TabsList>

        <TabsContent value="faqs" className="space-y-8">
          {loading ? (
            <div className="flex justify-center py-12">
              <Loader2 className="h-6 w-6 animate-spin text-primary" />
            </div>
          ) : categories.length > 0 ? (
            categories.map((category) => (
              <Card
                key={category}
                id={`category-${category.toLowerCase().replace(/\s+/g, "-")}`}
                className="border-none bg-card/50 shadow-sm"
              >
                <CardHeader className="flex flex-col justify-between gap-4 pb-3 sm:flex-row sm:items-center">
                  <div className="flex items-center gap-2">
                    <CardTitle className="flex items-center gap-2 text-lg uppercase tracking-wider text-primary">
                      <FolderOpen className="h-5 w-5" />
                      {category}
                      <Badge variant="secondary" className="ml-2 font-mono">
                        {groupedFaqs[category].length}
                      </Badge>
                    </CardTitle>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 text-muted-foreground hover:text-primary"
                      onClick={() => {
                        setCategoryToRename(category);
                        setNewCategoryName(category);
                        setRenameDialogOpen(true);
                      }}
                      title="Renomear Categoria"
                    >
                      <Pencil className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-8 gap-2 border-primary/20 text-primary hover:bg-primary/5"
                    onClick={() => handleNewFaq(category)}
                  >
                    <Plus className="h-3 w-3" /> Adicionar nesta categoria
                  </Button>
                </CardHeader>
                <CardContent>
                  <div className="rounded-md border bg-card">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead className="w-[56px]">Ordem</TableHead>
                          <TableHead className="w-[40px]">Pos.</TableHead>
                          <TableHead>Pergunta</TableHead>
                          <TableHead className="w-[120px]">Status</TableHead>
                          <TableHead className="w-[100px] text-right">Acoes</TableHead>
                        </TableRow>
                      </TableHeader>
                      <DndContext
                        sensors={sensors}
                        collisionDetection={closestCenter}
                        onDragEnd={(event) => handleFaqDragEnd(category, event)}
                      >
                        <SortableContext
                          items={groupedFaqs[category].map((faq) => faq.id)}
                          strategy={verticalListSortingStrategy}
                        >
                          <TableBody>
                            {groupedFaqs[category].map((faq) => (
                              <SortableFaqRow
                                key={faq.id}
                                faq={faq}
                                onEditFaq={handleEditFaq}
                                onDeleteFaq={handleDeleteFaq}
                                disableActions={orderingCategory === category}
                              />
                            ))}
                          </TableBody>
                        </SortableContext>
                      </DndContext>
                    </Table>
                  </div>
                </CardContent>
              </Card>
            ))
          ) : (
            <Card className="p-12 text-center text-muted-foreground">
              <Tag className="mx-auto mb-4 h-12 w-12 opacity-20" />
              <p>Nenhuma FAQ cadastrada ainda.</p>
              <Button variant="outline" className="mt-4" onClick={() => handleNewFaq()}>
                Criar Primeira Pergunta
              </Button>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="guides">
          {loading ? (
            <div className="flex justify-center py-12">
              <Loader2 className="h-6 w-6 animate-spin text-primary" />
            </div>
          ) : (
            <div className="space-y-4">
              <Card className="border-none bg-card/50 shadow-sm">
                <CardHeader>
                  <CardTitle className="text-base">Cobertura de Guias da Plataforma</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge variant="secondary">
                      Cobertura: {guideCoverageSummary.coveredCount}/{guideCoverageSummary.totalCount}
                    </Badge>
                    <Badge
                      className={
                        guideCoverageSummary.percent >= 90
                          ? "bg-success hover:bg-success"
                          : guideCoverageSummary.percent >= 70
                          ? "bg-amber-500 hover:bg-amber-500 text-white"
                          : "bg-destructive hover:bg-destructive"
                      }
                    >
                      {guideCoverageSummary.percent}%
                    </Badge>
                    <Badge variant="outline">Guias publicados: {guides.filter((guide) => guide?.is_published).length}</Badge>
                  </div>

                  <div className="h-2 overflow-hidden rounded-full bg-muted">
                    <div
                      className="h-full bg-primary transition-all"
                      style={{ width: `${guideCoverageSummary.percent}%` }}
                    />
                  </div>

                  <div className="flex flex-wrap gap-2">
                    {guideCoverageSummary.coverage.map((item) => (
                      <Badge key={item.id} variant={item.covered ? "default" : "outline"} className={item.covered ? "bg-success hover:bg-success" : "border-destructive/40 text-destructive"}>
                        {item.label}
                      </Badge>
                    ))}
                  </div>

                  {guideCoverageSummary.missing.length > 0 ? (
                    <p className="text-xs text-muted-foreground">
                      Pendentes para cobrir 100%: {guideCoverageSummary.missing.map((item) => item.label).join(", ")}.
                    </p>
                  ) : (
                    <p className="text-xs text-muted-foreground">
                      Cobertura completa das areas essenciais mapeadas para o chatbot.
                    </p>
                  )}

                  <div className="flex justify-end">
                    <Button
                      type="button"
                      variant="outline"
                      className="gap-2"
                      onClick={handleCreateMissingGuides}
                      disabled={isGeneratingMissingGuides || guideCoverageSummary.missing.length === 0}
                    >
                      {isGeneratingMissingGuides ? <Loader2 className="h-4 w-4 animate-spin" /> : <Wand2 className="h-4 w-4" />}
                      Criar guias faltantes automaticamente
                    </Button>
                  </div>
                </CardContent>
              </Card>

              <Card className="border-none bg-card/50 shadow-sm">
              <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <CardTitle className="flex items-center gap-2 text-lg text-primary">
                  <BookOpenText className="h-5 w-5" />
                  Guias de Uso
                </CardTitle>
                <div className="w-full sm:w-64">
                  <Select value={guideModuleFilter} onValueChange={setGuideModuleFilter}>
                    <SelectTrigger>
                      <SelectValue placeholder="Filtrar por modulo" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Todos os modulos</SelectItem>
                      {guideModuleOptions.map((moduleName) => (
                        <SelectItem key={moduleName} value={moduleName}>
                          {moduleName}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </CardHeader>
              <CardContent>
                <div className="rounded-md border bg-card">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-[40px]">Pos.</TableHead>
                        <TableHead>Titulo</TableHead>
                        <TableHead>Modulo</TableHead>
                        <TableHead>Audiencia</TableHead>
                        <TableHead className="w-[120px]">Status</TableHead>
                        <TableHead className="w-[100px] text-right">Acoes</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredGuides.length > 0 ? (
                        filteredGuides.map((guide) => (
                          <TableRow key={guide.id}>
                            <TableCell className="font-mono text-xs text-muted-foreground">{guide.position}</TableCell>
                            <TableCell className="max-w-xs truncate font-medium">{guide.title}</TableCell>
                            <TableCell className="text-xs uppercase text-muted-foreground">{guide.module || "geral"}</TableCell>
                            <TableCell className="max-w-xs truncate text-xs">{arrayToCsv(guide.audience) || "-"}</TableCell>
                            <TableCell>
                              <Badge
                                variant={guide.is_published ? "default" : "outline"}
                                className={guide.is_published ? "bg-success hover:bg-success" : ""}
                              >
                                {guide.is_published ? "Publicado" : "Rascunho"}
                              </Badge>
                            </TableCell>
                            <TableCell className="flex justify-end gap-1 text-right">
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8"
                                onClick={() => handleEditGuide(guide)}
                              >
                                <Edit2 className="h-4 w-4" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8 text-destructive hover:bg-destructive/10"
                                onClick={() => handleDeleteGuide(guide.id)}
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </TableCell>
                          </TableRow>
                        ))
                      ) : (
                        <TableRow>
                          <TableCell colSpan={6} className="py-8 text-center text-sm text-muted-foreground">
                            Nenhum guia de uso encontrado para este filtro.
                          </TableCell>
                        </TableRow>
                      )}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>
            </div>
          )}
        </TabsContent>
      </Tabs>

      <Dialog
        open={openFaqDialog}
        onOpenChange={(open) => {
          if (!open) closeFaqDialog();
          else setOpenFaqDialog(true);
        }}
      >
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>{selectedFaq?.id ? "Editar FAQ" : "Nova FAQ"}</DialogTitle>
            <DialogDescription>Organize perguntas frequentes para busca rapida dos usuarios.</DialogDescription>
          </DialogHeader>

          {selectedFaq && (
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>Pergunta</Label>
                <Input
                  value={selectedFaq.question}
                  onChange={(e) => setSelectedFaq({ ...selectedFaq, question: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label>Resposta</Label>
                <Textarea
                  rows={6}
                  value={selectedFaq.answer}
                  onChange={(e) => setSelectedFaq({ ...selectedFaq, answer: e.target.value })}
                />
              </div>

              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label className="flex items-center gap-2">
                    <Tag className="h-3 w-3" /> Categoria
                  </Label>
                  {newCategoryMode ? (
                    <div className="flex gap-2">
                      <Input
                        placeholder="Nome da nova categoria"
                        value={customCategory}
                        onChange={(e) => setCustomCategory(e.target.value)}
                        autoFocus
                      />
                      <Button variant="ghost" size="sm" onClick={() => setNewCategoryMode(false)}>
                        Cancelar
                      </Button>
                    </div>
                  ) : (
                    <div className="flex gap-2">
                      <Select
                        value={selectedFaq.category}
                        onValueChange={(value) => setSelectedFaq({ ...selectedFaq, category: value })}
                      >
                        <SelectTrigger className="flex-1">
                          <SelectValue placeholder="Selecione uma categoria" />
                        </SelectTrigger>
                        <SelectContent>
                          {categories.map((cat) => (
                            <SelectItem key={cat} value={cat}>
                              {cat}
                            </SelectItem>
                          ))}
                          {categories.length === 0 && <SelectItem value="geral">Geral</SelectItem>}
                        </SelectContent>
                      </Select>
                      <Button variant="outline" size="sm" onClick={() => setNewCategoryMode(true)}>
                        Nova
                      </Button>
                    </div>
                  )}
                </div>
                <div className="space-y-2">
                  <Label>Posicao na Lista</Label>
                  <Input
                    type="number"
                    value={selectedFaq.position}
                    onChange={(e) => setSelectedFaq({ ...selectedFaq, position: parseInt(e.target.value || "0", 10) || 0 })}
                  />
                </div>
              </div>

              <div className="flex items-center justify-between rounded-lg border bg-secondary/10 p-4">
                <div className="space-y-0.5">
                  <Label>Visibilidade</Label>
                  <p className="text-[10px] text-muted-foreground">Define se a pergunta aparece na area publica.</p>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xs font-medium">{selectedFaq.is_published ? "Publicado" : "Rascunho"}</span>
                  <Switch
                    checked={selectedFaq.is_published}
                    onCheckedChange={(checked) => setSelectedFaq({ ...selectedFaq, is_published: checked })}
                  />
                </div>
              </div>

              <DialogFooter>
                <Button variant="ghost" onClick={closeFaqDialog}>
                  Cancelar
                </Button>
                <Button onClick={handleSaveFaq} disabled={isSavingFaq}>
                  {isSavingFaq ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                  Salvar FAQ
                </Button>
              </DialogFooter>
            </div>
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={renameDialogOpen} onOpenChange={setRenameDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Renomear Categoria</DialogTitle>
            <DialogDescription>
              Isso atualiza o nome da categoria em todas as perguntas vinculadas.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Nome Atual</Label>
              <Input value={categoryToRename} disabled className="bg-muted" />
            </div>
            <div className="space-y-2">
              <Label>Novo Nome</Label>
              <Input
                value={newCategoryName}
                onChange={(e) => setNewCategoryName(e.target.value)}
                placeholder="Digite o novo nome..."
                autoFocus
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setRenameDialogOpen(false)}>
              Cancelar
            </Button>
            <Button
              onClick={handleRenameCategory}
              disabled={isRenaming || !newCategoryName.trim() || newCategoryName === categoryToRename}
            >
              {isRenaming ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              Confirmar Alteracao
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={openGuideDialog} onOpenChange={setOpenGuideDialog}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>{selectedGuide?.id ? "Editar Guia de Uso" : "Novo Guia de Uso"}</DialogTitle>
            <DialogDescription>Guias alimentam as respostas do chatbot sobre como usar funcionalidades.</DialogDescription>
          </DialogHeader>

          {selectedGuide && (
            <div className="space-y-4">
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <div className="space-y-2 md:col-span-2">
                  <Label>Titulo</Label>
                  <Input
                    value={selectedGuide.title}
                    onChange={(e) => setSelectedGuide({ ...selectedGuide, title: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Modulo</Label>
                  <Input
                    placeholder="ex: suporte, dashboard, busca"
                    value={selectedGuide.module || ""}
                    onChange={(e) => setSelectedGuide({ ...selectedGuide, module: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Posicao</Label>
                  <Input
                    type="number"
                    value={selectedGuide.position}
                    onChange={(e) =>
                      setSelectedGuide({ ...selectedGuide, position: parseInt(e.target.value || "0", 10) || 0 })
                    }
                  />
                </div>
                <div className="space-y-2 md:col-span-2">
                  <Label>Audiencia (separado por virgula)</Label>
                  <Input
                    placeholder="professional, company, family"
                    value={guideAudienceInput}
                    onChange={(e) => setGuideAudienceInput(e.target.value)}
                  />
                </div>
                <div className="space-y-2 md:col-span-2">
                  <Label>Variacoes de Pergunta (separado por virgula)</Label>
                  <Input
                    placeholder="como abrir chamado, como criar ticket"
                    value={guideVariantsInput}
                    onChange={(e) => setGuideVariantsInput(e.target.value)}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label>Conteudo do Guia</Label>
                <Textarea
                  rows={8}
                  value={selectedGuide.content}
                  onChange={(e) => setSelectedGuide({ ...selectedGuide, content: e.target.value })}
                />
              </div>

              <div className="flex items-center justify-between rounded-lg border bg-secondary/10 p-4">
                <div className="space-y-0.5">
                  <Label>Visibilidade</Label>
                  <p className="text-[10px] text-muted-foreground">Quando desativado, o chatbot nao usa este guia.</p>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xs font-medium">{selectedGuide.is_published ? "Publicado" : "Rascunho"}</span>
                  <Switch
                    checked={selectedGuide.is_published}
                    onCheckedChange={(checked) => setSelectedGuide({ ...selectedGuide, is_published: checked })}
                  />
                </div>
              </div>

              <DialogFooter>
                <Button variant="ghost" onClick={() => setOpenGuideDialog(false)}>
                  Cancelar
                </Button>
                <Button onClick={handleSaveGuide} disabled={isSavingGuide}>
                  {isSavingGuide ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                  Salvar Guia
                </Button>
              </DialogFooter>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default FaqAdminPage;
