"use client";

import { useEffect, useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Eye, ImagePlus, Loader2, Plus, RefreshCw, Save, ShieldCheck, Trash2, Wallet } from "lucide-react";
import { toast } from "sonner";
import { useSiteConfig } from "@/hooks/use-site-config";
import { sanitizeStorageFileName, sanitizeStoragePath } from "@/lib/storage-path";

type MediaKitPrompt = {
  title: string;
  description: string;
  copy_label: string;
  content: string;
};

type MediaKitImage = {
  url: string;
  title: string;
  caption: string;
};

type MediaKitConfig = {
  title: string;
  description: string;
  prompts: MediaKitPrompt[];
  images: MediaKitImage[];
};

const currency = (value: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(Number(value || 0));

const batchStatusLabel: Record<string, string> = {
  draft: "Rascunho",
  approved: "Aprovado",
  paid: "Pago",
  canceled: "Cancelado",
};

const partnerStatusLabel: Record<string, string> = {
  active: "Ativo",
  inactive: "Inativo",
  blocked: "Bloqueado",
};

const applicationStatusLabel: Record<string, string> = {
  pending: "Pendente",
  approved: "Aprovado",
  rejected: "Rejeitado",
};

const parseNumber = (value: string, fallback: number) => {
  const raw = String(value || "").trim();
  const normalized =
    raw.includes(",") && raw.includes(".")
      ? raw.replace(/\./g, "").replace(",", ".")
      : raw.includes(",")
      ? raw.replace(",", ".")
      : raw;

  const parsed = Number(normalized);
  if (!Number.isFinite(parsed)) return fallback;
  return parsed;
};

const formatMonth = () => {
  const now = new Date();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  return `${now.getFullYear()}-${month}`;
};

const createDefaultMediaKitConfig = (): MediaKitConfig => ({
  title: "Kit de midia",
  description: "Materiais prontos para divulgar seu link de afiliado e apresentar a plataforma para empresas.",
  prompts: [
    {
      title: "Mensagem para WhatsApp",
      description: "Texto pronto para compartilhar com contatos e grupos qualificados.",
      copy_label: "Copiar mensagem",
      content:
        "Estou divulgando a HomeCare Match, uma plataforma que aproxima profissionais e oportunidades no setor de cuidados. Se fizer sentido para voce, esse e meu link oficial: {{affiliate_link}}",
    },
    {
      title: "Pitch para empresas",
      description: "Convite rapido para empresas conhecerem a pagina institucional.",
      copy_label: "Copiar pitch",
      content:
        "Quero te apresentar a HomeCare Match. A plataforma ajuda empresas a encontrar profissionais com mais agilidade. Conheca a pagina para empresas: {{company_page_link}}",
    },
    {
      title: "Legenda para redes sociais",
      description: "CTA curto para post, story ou bio com link.",
      copy_label: "Copiar legenda",
      content:
        "Profissionais e empresas de Home Care em um so lugar. Conheca a HomeCare Match pelo meu link oficial: {{affiliate_link}}",
    },
  ],
  images: [{ url: "", title: "", caption: "" }, { url: "", title: "", caption: "" }, { url: "", title: "", caption: "" }],
});

const normalizeMediaKitConfig = (raw: any): MediaKitConfig => {
  const fallback = createDefaultMediaKitConfig();
  const prompts = Array.isArray(raw?.prompts) ? raw.prompts : fallback.prompts;
  const images = Array.isArray(raw?.images) ? raw.images : fallback.images;

  return {
    title: String(raw?.title || fallback.title),
    description: String(raw?.description || fallback.description),
    prompts:
      prompts.length > 0
        ? prompts.map((prompt: any, index: number) => ({
            title: String(prompt?.title || fallback.prompts[index]?.title || `Prompt ${index + 1}`),
            description: String(prompt?.description || fallback.prompts[index]?.description || ""),
            copy_label: String(prompt?.copy_label || fallback.prompts[index]?.copy_label || "Copiar texto"),
            content: String(prompt?.content || fallback.prompts[index]?.content || ""),
          }))
        : fallback.prompts,
    images: Array.from({ length: 3 }).map((_, index) => ({
      url: String(images[index]?.url || ""),
      title: String(images[index]?.title || ""),
      caption: String(images[index]?.caption || images[index]?.alt || ""),
    })),
  };
};

const AffiliatesAdminPage = () => {
  const queryClient = useQueryClient();
  const { data: siteConfig } = useSiteConfig();
  const [isSavingConfig, setIsSavingConfig] = useState(false);
  const [isSavingMediaKit, setIsSavingMediaKit] = useState(false);
  const [isApprovingBatch, setIsApprovingBatch] = useState(false);
  const [isReconciling, setIsReconciling] = useState(false);
  const [isClearingRejected, setIsClearingRejected] = useState(false);
  const [payingBatchId, setPayingBatchId] = useState<string | null>(null);
  const [reviewingApplicationId, setReviewingApplicationId] = useState<string | null>(null);
  const [selectedApplication, setSelectedApplication] = useState<any | null>(null);
  const [uploadingImageIndex, setUploadingImageIndex] = useState<number | null>(null);

  const [enabled, setEnabled] = useState(false);
  const [shadowMode, setShadowMode] = useState(true);
  const [signupAmount, setSignupAmount] = useState("50");
  const [recurringPercent, setRecurringPercent] = useState("10");
  const [minimumAmount, setMinimumAmount] = useState("100");
  const [monthlyMax, setMonthlyMax] = useState("24");
  const [annualMax, setAnnualMax] = useState("2");
  const [mediaKitConfig, setMediaKitConfig] = useState<MediaKitConfig>(createDefaultMediaKitConfig());

  const { data, isLoading, refetch, isRefetching } = useQuery({
    queryKey: ["admin-affiliates"],
    queryFn: async () => {
      const { data, error } = await supabase.functions.invoke("affiliate-admin-list");
      if (error) throw error;
      return data as any;
    },
  });

  const config = data?.config || {};
  const partners = Array.isArray(data?.partners) ? data.partners : [];
  const batches = Array.isArray(data?.batches) ? data.batches : [];
  const applications = Array.isArray(data?.applications) ? data.applications : [];
  const groupedApplications = useMemo(
    () => ({
      pending: applications.filter((row: any) => row.status === "pending"),
      approved: applications.filter((row: any) => row.status === "approved"),
      rejected: applications.filter((row: any) => row.status === "rejected"),
    }),
    [applications],
  );
  const pendingApplications = groupedApplications.pending;

  useEffect(() => {
    setEnabled(config?.affiliate_program_enabled === true);
    setShadowMode(config?.affiliate_shadow_mode !== false);
    setSignupAmount(String(config?.signup_commission_amount ?? "50"));
    setRecurringPercent(String(config?.recurring_commission_percent ?? "10"));
    setMinimumAmount(String(config?.payout_minimum_amount ?? "100"));
    setMonthlyMax(String(config?.monthly_commission_max_payments ?? "24"));
    setAnnualMax(String(config?.annual_commission_max_payments ?? "2"));
  }, [
    config?.affiliate_program_enabled,
    config?.affiliate_shadow_mode,
    config?.signup_commission_amount,
    config?.recurring_commission_percent,
    config?.payout_minimum_amount,
    config?.monthly_commission_max_payments,
    config?.annual_commission_max_payments,
  ]);

  useEffect(() => {
    setMediaKitConfig(normalizeMediaKitConfig(siteConfig?.affiliate_media_kit_config));
  }, [siteConfig?.affiliate_media_kit_config]);

  const hasConfigChanges = useMemo(() => {
    const currentSignup = Number(config?.signup_commission_amount ?? 50);
    const currentRecurring = Number(config?.recurring_commission_percent ?? 10);
    const currentMinimum = Number(config?.payout_minimum_amount ?? 100);
    const currentMonthlyMax = Number(config?.monthly_commission_max_payments ?? 24);
    const currentAnnualMax = Number(config?.annual_commission_max_payments ?? 2);

    return (
      enabled !== (config?.affiliate_program_enabled === true) ||
      shadowMode !== (config?.affiliate_shadow_mode !== false) ||
      parseNumber(signupAmount, currentSignup) !== currentSignup ||
      parseNumber(recurringPercent, currentRecurring) !== currentRecurring ||
      parseNumber(minimumAmount, currentMinimum) !== currentMinimum ||
      parseNumber(monthlyMax, currentMonthlyMax) !== currentMonthlyMax ||
      parseNumber(annualMax, currentAnnualMax) !== currentAnnualMax
    );
  }, [
    enabled,
    shadowMode,
    signupAmount,
    recurringPercent,
    minimumAmount,
    monthlyMax,
    annualMax,
    config?.affiliate_program_enabled,
    config?.affiliate_shadow_mode,
    config?.signup_commission_amount,
    config?.recurring_commission_percent,
    config?.payout_minimum_amount,
    config?.monthly_commission_max_payments,
    config?.annual_commission_max_payments,
  ]);

  const hasMediaKitChanges = useMemo(() => {
    const current = normalizeMediaKitConfig(siteConfig?.affiliate_media_kit_config);
    return JSON.stringify(current) !== JSON.stringify(mediaKitConfig);
  }, [mediaKitConfig, siteConfig?.affiliate_media_kit_config]);

  const handleSaveConfig = async () => {
    setIsSavingConfig(true);

    try {
      const signup = parseNumber(signupAmount, 50);
      const recurring = parseNumber(recurringPercent, 10);
      const minimum = parseNumber(minimumAmount, 100);
      const mMax = parseNumber(monthlyMax, 24);
      const aMax = parseNumber(annualMax, 2);

      if (signup < 0 || recurring < 0 || minimum < 0 || mMax < 0 || aMax < 0) {
        toast.error("Valores de comissão e limites precisam ser positivos.");
        return;
      }

      const { error } = await supabase.from("affiliate_program_config").upsert(
        {
          id: 1,
          affiliate_program_enabled: enabled,
          affiliate_shadow_mode: shadowMode,
          signup_commission_amount: signup,
          recurring_commission_percent: recurring,
          payout_minimum_amount: minimum,
          monthly_commission_max_payments: mMax,
          annual_commission_max_payments: aMax,
          payout_cycle: "monthly",
          recurring_duration_mode: "while_active",
          updated_at: new Date().toISOString(),
        },
        { onConflict: "id" },
      );

      if (error) throw error;
      toast.success("Configuração do programa atualizada.");
      await refetch();
    } catch (error: any) {
      toast.error(error?.message || "Erro ao salvar configurações.");
    } finally {
      setIsSavingConfig(false);
    }
  };

  const handleSaveMediaKit = async () => {
    setIsSavingMediaKit(true);
    try {
      const { error } = await supabase
        .from("site_config")
        .update({
          affiliate_media_kit_config: mediaKitConfig,
          updated_at: new Date().toISOString(),
        })
        .eq("id", 1);
      if (error) throw error;

      await queryClient.invalidateQueries({ queryKey: ["site-config"] });
      toast.success("Kit de midia salvo com sucesso.");
    } catch (error: any) {
      toast.error(error?.message || "Erro ao salvar kit de midia.");
    } finally {
      setIsSavingMediaKit(false);
    }
  };

  const handleMediaPromptChange = (index: number, field: keyof MediaKitPrompt, value: string) => {
    setMediaKitConfig((prev) => ({
      ...prev,
      prompts: prev.prompts.map((item, itemIndex) => (itemIndex === index ? { ...item, [field]: value } : item)),
    }));
  };

  const handleAddMediaPrompt = () => {
    setMediaKitConfig((prev) => ({
      ...prev,
      prompts: [
        ...prev.prompts,
        {
          title: `Novo bloco ${prev.prompts.length + 1}`,
          description: "",
          copy_label: "Copiar texto",
          content: "",
        },
      ],
    }));
  };

  const handleRemoveMediaPrompt = (index: number) => {
    setMediaKitConfig((prev) => {
      if (prev.prompts.length <= 1) {
        toast.error("O kit precisa manter pelo menos um bloco de texto.");
        return prev;
      }

      return {
        ...prev,
        prompts: prev.prompts.filter((_, itemIndex) => itemIndex !== index),
      };
    });
  };

  const handleMediaImageFieldChange = (index: number, field: keyof MediaKitImage, value: string) => {
    setMediaKitConfig((prev) => ({
      ...prev,
      images: prev.images.map((item, itemIndex) => (itemIndex === index ? { ...item, [field]: value } : item)),
    }));
  };

  const handleMediaImageUpload = async (index: number, event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setUploadingImageIndex(index);
    const safeName = sanitizeStorageFileName(file.name, "affiliate-media");
    const fileName = `affiliate_media_${index + 1}_${Date.now()}_${safeName}`;
    const filePath = sanitizeStoragePath(`site-assets/${fileName}`);

    try {
      const { error: uploadError } = await supabase.storage.from("uploads").upload(filePath, file, {
        cacheControl: "31536000",
      });
      if (uploadError) throw uploadError;

      const {
        data: { publicUrl },
      } = supabase.storage.from("uploads").getPublicUrl(filePath);

      setMediaKitConfig((prev) => ({
        ...prev,
        images: prev.images.map((item, itemIndex) =>
          itemIndex === index
            ? {
                ...item,
                url: publicUrl,
                title: item.title || `Arte ${index + 1}`,
                caption: item.caption || "",
              }
            : item,
        ),
      }));

      toast.success("Imagem enviada com sucesso.");
    } catch (error: any) {
      toast.error(error?.message || "Erro ao enviar imagem.");
    } finally {
      setUploadingImageIndex(null);
      event.target.value = "";
    }
  };

  const handleRemoveMediaImage = (index: number) => {
    setMediaKitConfig((prev) => ({
      ...prev,
      images: prev.images.map((item, itemIndex) => (itemIndex === index ? { url: "", title: "", caption: "" } : item)),
    }));
  };

  const handleApproveBatch = async () => {
    setIsApprovingBatch(true);
    try {
      const { data, error } = await supabase.functions.invoke("affiliate-admin-approve-payout", {
        body: { period_label: formatMonth() },
      });
      if (error) throw error;

      if (data?.created) {
        toast.success(`Lote criado com ${data.total_affiliates || 0} afiliado(s).`);
      } else {
        toast.message(data?.message || "Nenhum lote elegível neste momento.");
      }
      await refetch();
    } catch (error: any) {
      toast.error(error?.message || "Erro ao aprovar lote.");
    } finally {
      setIsApprovingBatch(false);
    }
  };

  const handleMarkPaid = async (batchId: string) => {
    const paymentReference = window.prompt("Referencia/comprovante do pagamento (opcional):", "") || "";

    setPayingBatchId(batchId);
    try {
      const { error } = await supabase.functions.invoke("affiliate-admin-mark-paid", {
        body: { batch_id: batchId, payment_reference: paymentReference || null },
      });
      if (error) throw error;

      toast.success("Lote marcado como pago.");
      await refetch();
    } catch (error: any) {
      toast.error(error?.message || "Erro ao marcar lote como pago.");
    } finally {
      setPayingBatchId(null);
    }
  };

  const handleReconcile = async () => {
    setIsReconciling(true);
    try {
      const { data, error } = await supabase.functions.invoke("affiliate-reconcile-events", {
        body: { limit: 2000 },
      });
      if (error) throw error;

      toast.success(
        `Reconciliação concluída: cadastro ${data?.signup?.inserted || 0}, recorrente ${data?.recurring?.inserted || 0}, clawback ${data?.clawback?.inserted || 0}.`,
      );
      await refetch();
    } catch (error: any) {
      toast.error(error?.message || "Erro ao reconciliar eventos.");
    } finally {
      setIsReconciling(false);
    }
  };

  const handleReviewApplication = async (
    applicationId: string,
    decision: "approved" | "rejected",
    sendAccessEmail = true,
  ) => {
    setReviewingApplicationId(applicationId);
    try {
      const { data, error } = await supabase.functions.invoke("affiliate-admin-review-application", {
        body: { application_id: applicationId, decision, send_access_email: sendAccessEmail },
      });

      if (error) throw error;

      if (decision === "approved") {
        if (data?.already_approved) {
          if (data?.access_email_sent) {
            toast.success("Acesso reenviado por e-mail para o afiliado.");
          } else {
            toast.success("Cadastro já estava aprovado. Dados de acesso mantidos.");
          }
        } else {
          const linkMessage = data?.short_url ? ` Link: ${data.short_url}` : "";
          const emailMessage = data?.access_email_sent
            ? " Conta criada e e-mail de acesso enviado."
            : " Conta criada, mas o e-mail de acesso não foi enviado automaticamente.";
          toast.success(`Candidatura aprovada.${emailMessage}${linkMessage}`);
        }

        if (data?.access_email_sent === false && data?.access_email_error) {
          toast.message(`Falha ao enviar e-mail de acesso: ${data.access_email_error}`);
        }
      } else {
        toast.success("Candidatura rejeitada.");
      }

      await refetch();
    } catch (error: any) {
      toast.error(error?.message || "Erro ao revisar candidatura.");
    } finally {
      setReviewingApplicationId(null);
    }
  };

  const handleClearRejectedApplications = async () => {
    const rejectedCount = groupedApplications.rejected.length;
    if (rejectedCount === 0) return;

    const confirmed = window.confirm(
      `Deseja remover ${rejectedCount} candidatura(s) rejeitada(s)? Esta ação não pode ser desfeita.`,
    );
    if (!confirmed) return;

    setIsClearingRejected(true);
    try {
      const { error } = await supabase.from("affiliate_applications").delete().eq("status", "rejected");
      if (error) throw error;

      if (selectedApplication?.status === "rejected") {
        setSelectedApplication(null);
      }

      toast.success("Candidaturas rejeitadas removidas com sucesso.");
      await refetch();
    } catch (error: any) {
      toast.error(error?.message || "Erro ao limpar candidaturas rejeitadas.");
    } finally {
      setIsClearingRejected(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center gap-2 text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" />
        Carregando módulo de afiliados...
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <h1 className="text-3xl font-bold tracking-tight flex items-center gap-2">
          <ShieldCheck className="h-7 w-7 text-primary" />
          Afiliados (Admin)
        </h1>
        <p className="text-muted-foreground">Gestão de parceiros, comissões, lotes de pagamento e reconciliação.</p>
      </div>

      <div className="flex flex-wrap gap-2">
        <Badge variant={enabled ? "default" : "secondary"}>{enabled ? "Programa ativo" : "Programa desativado"}</Badge>
        <Badge variant={shadowMode ? "outline" : "default"}>{shadowMode ? "Modo sombra" : "Payout ativo"}</Badge>
        <Badge variant="outline">Parceiros: {partners.length}</Badge>
        <Badge variant="outline">Candidaturas pendentes: {pendingApplications.length}</Badge>
        <Badge variant="outline">Lotes: {batches.length}</Badge>
      </div>

      <Tabs defaultValue="program" className="space-y-6">
        <TabsList className="grid w-full max-w-md grid-cols-2">
          <TabsTrigger value="program">Programa</TabsTrigger>
          <TabsTrigger value="media-kit">Kit de midia</TabsTrigger>
        </TabsList>

        <TabsContent value="program" className="space-y-6">

      <Card>
        <CardHeader>
          <CardTitle>Configurações do programa</CardTitle>
          <CardDescription>Defina regras do v1: bônus por marcos, recorrência, mínimo e rollout.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-3 md:grid-cols-2">
            <div className="rounded-lg border p-3">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-sm font-medium">Programa habilitado</p>
                  <p className="text-xs text-muted-foreground">Habilita operação em produção. Em modo sombra, a coleta continua ativa.</p>
                </div>
                <Switch checked={enabled} onCheckedChange={setEnabled} />
              </div>
            </div>
            <div className="rounded-lg border p-3">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-sm font-medium">Modo sombra</p>
                  <p className="text-xs text-muted-foreground">Coleta atribuição/ledger sem liberar payout.</p>
                </div>
                <Switch checked={shadowMode} onCheckedChange={setShadowMode} />
              </div>
            </div>
          </div>

          <div className="grid gap-3 md:grid-cols-3">
            <div className="space-y-2">
              <Label htmlFor="signup_amount">Bônus por 10 assinaturas (R$)</Label>
              <Input id="signup_amount" value={signupAmount} onChange={(e) => setSignupAmount(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="recurring_percent">Comissão recorrente (%)</Label>
              <Input id="recurring_percent" value={recurringPercent} onChange={(e) => setRecurringPercent(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="minimum_amount">Mínimo payout (R$)</Label>
              <Input id="minimum_amount" value={minimumAmount} onChange={(e) => setMinimumAmount(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="monthly_max">Limite meses (Mensal)</Label>
              <Input id="monthly_max" type="number" value={monthlyMax} onChange={(e) => setMonthlyMax(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="annual_max">Limite renovações (Anual)</Label>
              <Input id="annual_max" type="number" value={annualMax} onChange={(e) => setAnnualMax(e.target.value)} />
            </div>
          </div>

          <div className="flex flex-wrap justify-end gap-2">
            <Button variant="outline" onClick={handleReconcile} disabled={isReconciling} className="gap-2">
              {isReconciling ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
              Reconciliar eventos
            </Button>
            <Button variant="outline" onClick={handleApproveBatch} disabled={isApprovingBatch || shadowMode} className="gap-2">
              {isApprovingBatch ? <Loader2 className="h-4 w-4 animate-spin" /> : <Wallet className="h-4 w-4" />}
              Aprovar lote mensal
            </Button>
            <Button onClick={handleSaveConfig} disabled={isSavingConfig || !hasConfigChanges} className="gap-2">
              {isSavingConfig ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
              Salvar configurações
            </Button>
          </div>
        </CardContent>
      </Card>

        </TabsContent>

        <TabsContent value="media-kit" className="space-y-6">

      <Card>
        <CardHeader>
          <CardTitle>Kit de midia do afiliado</CardTitle>
          <CardDescription>Configure textos, prompts e um grid com 3 imagens para o painel do afiliado.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label>Titulo da secao</Label>
              <Input
                value={mediaKitConfig.title}
                onChange={(e) => setMediaKitConfig((prev) => ({ ...prev, title: e.target.value }))}
              />
            </div>
            <div className="space-y-2">
              <Label>Descricao da secao</Label>
              <Textarea
                value={mediaKitConfig.description}
                onChange={(e) => setMediaKitConfig((prev) => ({ ...prev, description: e.target.value }))}
                rows={3}
              />
            </div>
          </div>

          <div className="space-y-4">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <h3 className="text-sm font-semibold">Prompts e textos prontos</h3>
                <p className="text-xs text-muted-foreground">
                  Use os placeholders <code>{"{{affiliate_link}}"}</code> e <code>{"{{company_page_link}}"}</code>.
                </p>
              </div>
              <Button type="button" variant="outline" onClick={handleAddMediaPrompt} className="gap-2">
                <Plus className="h-4 w-4" />
                Adicionar bloco
              </Button>
            </div>
            <div className="grid gap-4">
              {mediaKitConfig.prompts.map((prompt, index) => (
                <div key={`prompt-media-only-${index}`} className="rounded-xl border p-4">
                  <div className="mb-4 flex items-center justify-between gap-3">
                    <p className="text-sm font-medium">Bloco {index + 1}</p>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      onClick={() => handleRemoveMediaPrompt(index)}
                      aria-label={`Excluir bloco ${index + 1}`}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                  <div className="grid gap-4 md:grid-cols-2">
                    <div className="space-y-2">
                      <Label>Titulo</Label>
                      <Input
                        value={prompt.title}
                        onChange={(e) => handleMediaPromptChange(index, "title", e.target.value)}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Botao de copia</Label>
                      <Input
                        value={prompt.copy_label}
                        onChange={(e) => handleMediaPromptChange(index, "copy_label", e.target.value)}
                      />
                    </div>
                  </div>
                  <div className="mt-4 space-y-2">
                    <Label>Descricao</Label>
                    <Input
                      value={prompt.description}
                      onChange={(e) => handleMediaPromptChange(index, "description", e.target.value)}
                    />
                  </div>
                  <div className="mt-4 space-y-2">
                    <Label>Conteudo</Label>
                    <Textarea
                      value={prompt.content}
                      onChange={(e) => handleMediaPromptChange(index, "content", e.target.value)}
                      rows={5}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="space-y-4">
            <div>
              <h3 className="text-sm font-semibold">Grid de imagens</h3>
              <p className="text-xs text-muted-foreground">As 3 imagens abaixo serao exibidas em colunas no painel do afiliado.</p>
            </div>
            <div className="grid gap-4 md:grid-cols-3">
              {mediaKitConfig.images.map((image, index) => (
                <div key={`media-image-only-${index}`} className="rounded-xl border p-4">
                  {image.url ? (
                    <img
                      src={image.url}
                      alt={image.title || `Imagem ${index + 1}`}
                      className="mb-4 aspect-[3/4] w-full rounded-lg object-cover"
                    />
                  ) : (
                    <div className="mb-4 flex aspect-[3/4] items-center justify-center rounded-lg border border-dashed bg-muted/20 text-xs text-muted-foreground">
                      Nenhuma imagem enviada
                    </div>
                  )}
                  <div className="space-y-3">
                    <div className="space-y-2">
                      <Label>Titulo da imagem</Label>
                      <Input
                        value={image.title}
                        onChange={(e) => handleMediaImageFieldChange(index, "title", e.target.value)}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Legenda sugerida</Label>
                      <Input
                        value={image.caption}
                        onChange={(e) => handleMediaImageFieldChange(index, "caption", e.target.value)}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Upload</Label>
                      <Input
                        id={`affiliate-media-upload-tab-${index}`}
                        type="file"
                        accept="image/*"
                        onChange={(e) => handleMediaImageUpload(index, e)}
                        className="hidden"
                      />
                    </div>
                    <div className="flex gap-2">
                      <Button
                        type="button"
                        variant="outline"
                        className="flex-1 gap-2"
                        disabled={uploadingImageIndex === index}
                        onClick={() => document.getElementById(`affiliate-media-upload-tab-${index}`)?.click()}
                      >
                        {uploadingImageIndex === index ? <Loader2 className="h-4 w-4 animate-spin" /> : <ImagePlus className="h-4 w-4" />}
                        {uploadingImageIndex === index ? "Enviando..." : "Selecionar imagem"}
                      </Button>
                      {image.url ? (
                        <Button type="button" variant="ghost" size="icon" onClick={() => handleRemoveMediaImage(index)}>
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      ) : null}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="flex justify-end">
            <Button onClick={handleSaveMediaKit} disabled={isSavingMediaKit || !hasMediaKitChanges} className="gap-2">
              {isSavingMediaKit ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
              Salvar kit de midia
            </Button>
          </div>
        </CardContent>
      </Card>

        </TabsContent>

        <TabsContent value="program" className="space-y-6">

      <Card>
        <CardHeader>
          <CardTitle>Candidaturas de afiliado</CardTitle>
          <CardDescription>Canal público de cadastro para afiliados dedicados (sem role profissional).</CardDescription>
        </CardHeader>
        <CardContent>
          {applications.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nenhuma candidatura recebida.</p>
          ) : (
            <div className="space-y-5">
              {[
                { status: "pending", title: "Pendentes", rows: groupedApplications.pending },
                { status: "approved", title: "Aprovadas", rows: groupedApplications.approved },
                { status: "rejected", title: "Rejeitadas", rows: groupedApplications.rejected },
              ].map((section) => (
                <div key={section.status} className="space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <h3 className="text-sm font-semibold">{section.title}</h3>
                      <Badge variant="outline">{section.rows.length}</Badge>
                    </div>
                    {section.status === "rejected" && section.rows.length > 0 ? (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={handleClearRejectedApplications}
                        disabled={isClearingRejected}
                      >
                        {isClearingRejected ? <Loader2 className="h-4 w-4 animate-spin" /> : "Limpar candidaturas"}
                      </Button>
                    ) : null}
                  </div>

                  {section.rows.length === 0 ? (
                    <p className="rounded-md border border-dashed px-3 py-2 text-sm text-muted-foreground">
                      Nenhuma candidatura {section.title.toLowerCase().slice(0, -1)}.
                    </p>
                  ) : (
                    <div className="rounded-md border overflow-hidden">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Nome</TableHead>
                            <TableHead>E-mail</TableHead>
                            <TableHead>Status</TableHead>
                            <TableHead>Criado em</TableHead>
                            <TableHead className="text-right">Ações</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {section.rows.map((application: any) => {
                            const reviewing = reviewingApplicationId === application.id;
                            const isPending = application.status === "pending";

                            return (
                              <TableRow key={application.id}>
                                <TableCell>
                                  <p className="text-sm font-medium">{application.full_name || "-"}</p>
                                </TableCell>
                                <TableCell>
                                  <p className="text-sm">{application.email || "-"}</p>
                                </TableCell>
                                <TableCell>
                                  <Badge variant={application.status === "approved" ? "default" : "outline"}>
                                    {applicationStatusLabel[application.status] || application.status}
                                  </Badge>
                                </TableCell>
                                <TableCell>{new Date(application.created_at).toLocaleDateString("pt-BR")}</TableCell>
                                <TableCell className="text-right">
                                  <div className="flex justify-end gap-2">
                                    <Button
                                      size="sm"
                                      variant="outline"
                                      onClick={() => setSelectedApplication(application)}
                                      className="gap-1"
                                    >
                                      <Eye className="h-3.5 w-3.5" />
                                      Ver dados
                                    </Button>

                                    {isPending ? (
                                      <>
                                        <Button
                                          size="sm"
                                          variant="outline"
                                          disabled={reviewing}
                                          onClick={() => handleReviewApplication(application.id, "rejected")}
                                        >
                                          Rejeitar
                                        </Button>
                                        <Button
                                          size="sm"
                                          disabled={reviewing}
                                          onClick={() => handleReviewApplication(application.id, "approved")}
                                        >
                                          {reviewing ? <Loader2 className="h-4 w-4 animate-spin" /> : "Aprovar"}
                                        </Button>
                                      </>
                                    ) : application.status === "approved" ? (
                                      <Button
                                        size="sm"
                                        variant="outline"
                                        disabled={reviewing}
                                        onClick={() => handleReviewApplication(application.id, "approved", true)}
                                      >
                                        {reviewing ? <Loader2 className="h-4 w-4 animate-spin" /> : "Enviar acesso"}
                                      </Button>
                                    ) : null}
                                  </div>
                                </TableCell>
                              </TableRow>
                            );
                          })}
                        </TableBody>
                      </Table>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={!!selectedApplication} onOpenChange={(open) => !open && setSelectedApplication(null)}>
        <DialogContent className="sm:max-w-xl">
          <DialogHeader>
            <DialogTitle>Dados da candidatura</DialogTitle>
            <DialogDescription>
              Informações enviadas no formulário público de afiliado.
            </DialogDescription>
          </DialogHeader>

          {selectedApplication ? (
            <div className="grid gap-3 text-sm">
              <div className="grid grid-cols-3 gap-2">
                <span className="text-muted-foreground">Nome</span>
                <span className="col-span-2 font-medium">{selectedApplication.full_name || "-"}</span>
              </div>
              <div className="grid grid-cols-3 gap-2">
                <span className="text-muted-foreground">E-mail</span>
                <span className="col-span-2">{selectedApplication.email || "-"}</span>
              </div>
              <div className="grid grid-cols-3 gap-2">
                <span className="text-muted-foreground">Telefone</span>
                <span className="col-span-2">{selectedApplication.phone || "-"}</span>
              </div>
              <div className="grid grid-cols-3 gap-2">
                <span className="text-muted-foreground">Cidade / UF</span>
                <span className="col-span-2">
                  {selectedApplication.city || "-"} / {selectedApplication.state || "-"}
                </span>
              </div>
              <div className="grid grid-cols-3 gap-2">
                <span className="text-muted-foreground">PIX</span>
                <span className="col-span-2">
                  {selectedApplication.pix_key_type || "-"} / {selectedApplication.pix_key || "-"}
                </span>
              </div>
              <div className="grid grid-cols-3 gap-2">
                <span className="text-muted-foreground">Público</span>
                <span className="col-span-2">{selectedApplication.audience || "-"}</span>
              </div>
              <div className="grid grid-cols-3 gap-2">
                <span className="text-muted-foreground">Experiência</span>
                <span className="col-span-2">{selectedApplication.experience || "-"}</span>
              </div>
              <div className="grid grid-cols-3 gap-2">
                <span className="text-muted-foreground">Status</span>
                <span className="col-span-2">
                  {applicationStatusLabel[selectedApplication.status] || selectedApplication.status || "-"}
                </span>
              </div>
              <div className="grid grid-cols-3 gap-2">
                <span className="text-muted-foreground">Criado em</span>
                <span className="col-span-2">
                  {selectedApplication.created_at
                    ? new Date(selectedApplication.created_at).toLocaleString("pt-BR")
                    : "-"}
                </span>
              </div>
              <div className="space-y-1 rounded-md border p-3">
                <p className="text-xs text-muted-foreground">Mensagem complementar</p>
                <p className="whitespace-pre-wrap">{selectedApplication.message || "-"}</p>
              </div>
            </div>
          ) : null}
        </DialogContent>
      </Dialog>

      <Card>
        <CardHeader>
          <CardTitle>Parceiros afiliados</CardTitle>
          <CardDescription>Visão operacional de status, atribuições e saldo.</CardDescription>
        </CardHeader>
        <CardContent>
          {partners.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nenhum parceiro afiliado encontrado.</p>
          ) : (
            <div className="rounded-md border overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Parceiro</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Atribuições válidas</TableHead>
                    <TableHead>Saldo disponível</TableHead>
                    <TableHead>Saldo sombra</TableHead>
                    <TableHead>Acumulado</TableHead>
                    <TableHead>PIX</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {partners.map((partner: any) => (
                    <TableRow key={partner.id}>
                      <TableCell>
                        <p className="text-sm font-medium">{partner.display_name}</p>
                        <p className="text-xs text-muted-foreground">{partner.email || "Sem e-mail"}</p>
                      </TableCell>
                      <TableCell>
                        <Badge variant={partner.status === "active" ? "default" : "secondary"}>
                          {partnerStatusLabel[partner.status] || partner.status}
                        </Badge>
                      </TableCell>
                      <TableCell>{Number(partner.attribution_valid || 0)}</TableCell>
                      <TableCell>{currency(partner.available_balance || 0)}</TableCell>
                      <TableCell>{currency(partner.shadow_balance || 0)}</TableCell>
                      <TableCell>{currency(partner.lifetime_balance || 0)}</TableCell>
                      <TableCell>
                        {partner.pix_key ? (
                          <span className="text-xs">{partner.pix_key_type || "pix"}</span>
                        ) : (
                          <span className="text-xs text-muted-foreground">Não informado</span>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Lotes de pagamento</CardTitle>
          <CardDescription>Aprovação e baixa manual com trilha operacional.</CardDescription>
        </CardHeader>
        <CardContent>
          {batches.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nenhum lote registrado.</p>
          ) : (
            <div className="rounded-md border overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Período</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Afiliados</TableHead>
                    <TableHead>Entradas</TableHead>
                    <TableHead>Total</TableHead>
                    <TableHead>Aprovado em</TableHead>
                    <TableHead>Pago em</TableHead>
                    <TableHead className="text-right">Ação</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {batches.map((batch: any) => {
                    const isPaid = batch.status === "paid";
                    const isApproving = payingBatchId === batch.id;

                    return (
                      <TableRow key={batch.id}>
                        <TableCell>{batch.period_label || "Sem período"}</TableCell>
                        <TableCell>
                          <Badge variant={isPaid ? "default" : "outline"}>
                            {batchStatusLabel[batch.status] || batch.status}
                          </Badge>
                        </TableCell>
                        <TableCell>{Number(batch.total_affiliates || 0)}</TableCell>
                        <TableCell>{Number(batch.total_entries || 0)}</TableCell>
                        <TableCell>{currency(batch.total_amount || 0)}</TableCell>
                        <TableCell>
                          {batch.approved_at ? new Date(batch.approved_at).toLocaleDateString("pt-BR") : "-"}
                        </TableCell>
                        <TableCell>{batch.paid_at ? new Date(batch.paid_at).toLocaleDateString("pt-BR") : "-"}</TableCell>
                        <TableCell className="text-right">
                          <Button
                            size="sm"
                            variant="outline"
                            disabled={isPaid || isApproving}
                            onClick={() => handleMarkPaid(batch.id)}
                          >
                            {isApproving ? <Loader2 className="h-4 w-4 animate-spin" /> : "Marcar pago"}
                          </Button>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

        </TabsContent>
      </Tabs>

      <div className="flex justify-end">
        <Button variant="outline" onClick={() => refetch()} disabled={isRefetching} className="gap-2">
          {isRefetching ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
          Atualizar painel
        </Button>
      </div>
    </div>
  );
};

export default AffiliatesAdminPage;

