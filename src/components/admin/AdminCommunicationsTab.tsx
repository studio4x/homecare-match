"use client";

import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { SUPABASE_PUBLISHABLE_KEY, SUPABASE_URL } from "@/integrations/supabase/client";
import { Loader2, Mail, MessageCircle, RefreshCw, Send, Sparkles, Users } from "lucide-react";
import { toast } from "sonner";

type CommunicationJob = {
  id: string;
  name: string;
  description?: string | null;
  mode: "individual" | "segment";
  filters?: Record<string, unknown> | null;
  channels?: string[] | null;
  email_subject?: string | null;
  email_html?: string | null;
  email_text?: string | null;
  whatsapp_message?: string | null;
  whatsapp_cta_path?: string | null;
  status: string;
  scheduled_for?: string | null;
  total_recipients?: number | null;
  sent_recipients?: number | null;
  failed_recipients?: number | null;
  skipped_recipients?: number | null;
  created_at: string;
};

type UserSuggestion = {
  id: string;
  full_name: string | null;
  email: string | null;
};

const EMPTY_FORM = {
  id: "",
  name: "",
  description: "",
  mode: "segment" as "individual" | "segment",
  role: "professional",
  subscription_tier: "all",
  email_confirmed: "all",
  whatsapp_opt_in: "all",
  is_verified: "all",
  is_hidden: "all",
  targetUserId: "",
  sendEmail: true,
  sendWhatsapp: false,
  emailSubject: "",
  emailHtml: "",
  emailText: "",
  whatsappMessage: "",
  whatsappCtaPath: "/dashboard",
  scheduledFor: "",
};

const getStatusBadge = (status: string) => {
  if (status === "completed") return <Badge className="bg-emerald-600">Concluida</Badge>;
  if (status === "failed") return <Badge variant="destructive">Com falha</Badge>;
  if (status === "processing") return <Badge className="bg-amber-500">Processando</Badge>;
  if (status === "scheduled") return <Badge variant="secondary">Agendada</Badge>;
  return <Badge variant="outline">Rascunho</Badge>;
};

const dateTimeLocalFromIso = (value?: string | null) => {
  if (!value) return "";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return "";
  const pad = (v: number) => String(v).padStart(2, "0");
  return `${parsed.getFullYear()}-${pad(parsed.getMonth() + 1)}-${pad(parsed.getDate())}T${pad(parsed.getHours())}:${pad(parsed.getMinutes())}`;
};

const AdminCommunicationsTab = () => {
  const [jobs, setJobs] = useState<CommunicationJob[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [sendingPreview, setSendingPreview] = useState(false);
  const [userSearch, setUserSearch] = useState("");
  const [userSuggestions, setUserSuggestions] = useState<UserSuggestion[]>([]);
  const [searchingUsers, setSearchingUsers] = useState(false);
  const [generatingAiCopy, setGeneratingAiCopy] = useState(false);
  const [generatingWhatsappAiCopy, setGeneratingWhatsappAiCopy] = useState(false);
  const [aiPrompt, setAiPrompt] = useState("");
  const [form, setForm] = useState(EMPTY_FORM);

  const fetchJobs = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("admin_communication_jobs")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(50);

      if (error) throw error;
      setJobs((data || []) as CommunicationJob[]);
    } catch (error) {
      console.error("[AdminCommunicationsTab] erro ao carregar jobs:", error);
      toast.error("Falha ao carregar comunicacoes.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchJobs();
  }, []);

  useEffect(() => {
    if (form.mode !== "individual") {
      setUserSuggestions([]);
      setSearchingUsers(false);
      return;
    }

    const term = userSearch.trim();
    if (term.length < 2) {
      setUserSuggestions([]);
      setSearchingUsers(false);
      return;
    }

    let cancelled = false;
    const timer = window.setTimeout(async () => {
      setSearchingUsers(true);
      try {
        const like = `%${term.replace(/[%_,]/g, " ").trim()}%`;
        const { data, error } = await supabase
          .from("profiles")
          .select("id,full_name,email")
          .or(`full_name.ilike.${like},email.ilike.${like}`)
          .order("full_name", { ascending: true })
          .limit(8);

        if (error) throw error;
        if (!cancelled) setUserSuggestions((data || []) as UserSuggestion[]);
      } catch (error) {
        console.error("[AdminCommunicationsTab] erro ao buscar usuarios:", error);
        if (!cancelled) setUserSuggestions([]);
      } finally {
        if (!cancelled) setSearchingUsers(false);
      }
    }, 250);

    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [form.mode, userSearch]);

  const selectedChannels = useMemo(() => {
    const channels: string[] = [];
    if (form.sendEmail) channels.push("email");
    if (form.sendWhatsapp) channels.push("whatsapp");
    return channels;
  }, [form.sendEmail, form.sendWhatsapp]);

  const hydrateForm = (job: CommunicationJob) => {
    const filters = (job.filters || {}) as Record<string, unknown>;
    const userIds = Array.isArray(filters.user_ids) ? filters.user_ids : [];

    setForm({
      id: job.id,
      name: job.name || "",
      description: String(job.description || ""),
      mode: job.mode || "segment",
      role: String(filters.role || "professional"),
      subscription_tier: String(filters.subscription_tier || "all"),
      email_confirmed: filters.email_confirmed === true ? "true" : filters.email_confirmed === false ? "false" : "all",
      whatsapp_opt_in: filters.whatsapp_opt_in === true ? "true" : filters.whatsapp_opt_in === false ? "false" : "all",
      is_verified: filters.is_verified === true ? "true" : filters.is_verified === false ? "false" : "all",
      is_hidden: filters.is_hidden === true ? "true" : filters.is_hidden === false ? "false" : "all",
      targetUserId: String(userIds[0] || filters.user_id || ""),
      sendEmail: Array.isArray(job.channels) ? job.channels.includes("email") : false,
      sendWhatsapp: Array.isArray(job.channels) ? job.channels.includes("whatsapp") : false,
      emailSubject: String(job.email_subject || ""),
      emailHtml: String(job.email_html || ""),
      emailText: String(job.email_text || ""),
      whatsappMessage: String(job.whatsapp_message || ""),
      whatsappCtaPath: String(job.whatsapp_cta_path || "/dashboard"),
      scheduledFor: dateTimeLocalFromIso(job.scheduled_for),
    });
    setUserSearch("");
    setAiPrompt("");
  };

  const resetForm = () => {
    setForm(EMPTY_FORM);
    setUserSearch("");
    setUserSuggestions([]);
    setAiPrompt("");
  };

  const buildFilters = () => {
    if (form.mode === "individual") {
      return { user_ids: form.targetUserId ? [form.targetUserId] : [] };
    }

    return {
      role: form.role,
      subscription_tier: form.subscription_tier === "all" ? undefined : form.subscription_tier,
      email_confirmed: form.email_confirmed === "all" ? undefined : form.email_confirmed === "true",
      whatsapp_opt_in: form.whatsapp_opt_in === "all" ? undefined : form.whatsapp_opt_in === "true",
      is_verified: form.is_verified === "all" ? undefined : form.is_verified === "true",
      is_hidden: form.is_hidden === "all" ? undefined : form.is_hidden === "true",
    };
  };

  const saveJob = async (status: "draft" | "scheduled", processNow = false) => {
    if (!form.name.trim()) {
      toast.error("Informe um nome para a comunicacao.");
      return;
    }
    if (selectedChannels.length === 0) {
      toast.error("Selecione ao menos um canal.");
      return;
    }
    if (form.mode === "individual" && !form.targetUserId) {
      toast.error("Selecione o usuario do envio individual.");
      return;
    }

    setSaving(true);
    try {
      const payload = {
        name: form.name.trim(),
        description: form.description.trim() || null,
        mode: form.mode,
        filters: buildFilters(),
        channels: selectedChannels,
        email_subject: form.sendEmail ? form.emailSubject.trim() || null : null,
        email_html: form.sendEmail ? form.emailHtml.trim() || null : null,
        email_text: form.sendEmail ? form.emailText.trim() || null : null,
        whatsapp_message: form.sendWhatsapp ? form.whatsappMessage.trim() || null : null,
        whatsapp_cta_path: form.sendWhatsapp ? form.whatsappCtaPath.trim() || "/dashboard" : null,
        status,
        scheduled_for:
          status === "scheduled"
            ? processNow
              ? new Date().toISOString()
              : form.scheduledFor
                ? new Date(form.scheduledFor).toISOString()
                : new Date().toISOString()
            : null,
        updated_at: new Date().toISOString(),
      };

      let jobId = form.id;

      if (jobId) {
        const { error } = await supabase.from("admin_communication_jobs").update(payload).eq("id", jobId);
        if (error) throw error;
      } else {
        const { data, error } = await supabase
          .from("admin_communication_jobs")
          .insert(payload)
          .select("id")
          .maybeSingle();
        if (error) throw error;
        jobId = data?.id || "";
      }

      if (processNow && jobId) {
        const { data: sessionData } = await supabase.auth.getSession();
        const accessToken = sessionData?.session?.access_token || "";
        const { error } = await supabase.functions.invoke("process-admin-communications", {
          body: { access_token: accessToken, job_id: jobId },
        });
        if (error) throw error;
      }

      toast.success(processNow ? "Comunicacao enviada para processamento." : status === "draft" ? "Rascunho salvo." : "Comunicacao agendada.");
      await fetchJobs();
      resetForm();
    } catch (error) {
      console.error("[AdminCommunicationsTab] erro ao salvar:", error);
      toast.error("Falha ao salvar comunicacao.");
    } finally {
      setSaving(false);
    }
  };

  const sendPreviewToAdmin = async () => {
    if (selectedChannels.length === 0) {
      toast.error("Selecione ao menos um canal.");
      return;
    }
    if (form.sendEmail && !form.emailSubject.trim()) {
      toast.error("Informe o assunto do e-mail para enviar a previa.");
      return;
    }
    if (form.sendEmail && !form.emailHtml.trim() && !form.emailText.trim()) {
      toast.error("Preencha o HTML ou o texto alternativo do e-mail.");
      return;
    }
    if (form.sendWhatsapp && !form.whatsappMessage.trim()) {
      toast.error("Informe a mensagem de WhatsApp para enviar a previa.");
      return;
    }

    setSendingPreview(true);
    try {
      const {
        data: { session: currentSession },
      } = await supabase.auth.getSession();
      const { data: refreshed } = await supabase.auth.refreshSession();
      const accessToken = refreshed.session?.access_token || currentSession?.access_token || "";

      if (!accessToken) {
        throw new Error("Sessao expirada. Faca login novamente.");
      }

      const response = await fetch(`${SUPABASE_URL}/functions/v1/process-admin-communications`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          apikey: SUPABASE_PUBLISHABLE_KEY,
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({
          access_token: accessToken,
          preview: true,
          channels: selectedChannels,
          email_subject: form.sendEmail ? form.emailSubject.trim() || null : null,
          email_html: form.sendEmail ? form.emailHtml.trim() || null : null,
          email_text: form.sendEmail ? form.emailText.trim() || null : null,
          whatsapp_message: form.sendWhatsapp ? form.whatsappMessage.trim() || null : null,
          whatsapp_cta_path: form.sendWhatsapp ? form.whatsappCtaPath.trim() || "/dashboard" : null,
        }),
      });

      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(typeof payload?.error === "string" ? payload.error : "Falha ao enviar previa.");
      }

      toast.success("Previa enviada para contato@homecarematch.com.br.");
    } catch (error) {
      console.error("[AdminCommunicationsTab] erro ao enviar previa:", error);
      toast.error("Falha ao enviar previa.");
    } finally {
      setSendingPreview(false);
    }
  };

  const handleGenerateEmailCopy = async () => {
    const prompt = aiPrompt.trim();
    if (!prompt) {
      toast.error("Descreva para a IA o que deve ser escrito.");
      return;
    }

    setGeneratingAiCopy(true);
    try {
      const {
        data: { session: currentSession },
      } = await supabase.auth.getSession();
      const { data: refreshed } = await supabase.auth.refreshSession();
      const accessToken = refreshed.session?.access_token || currentSession?.access_token || "";

      if (!accessToken) {
        throw new Error("Sessao expirada. Faca login novamente.");
      }

      const response = await fetch(`${SUPABASE_URL}/functions/v1/generate-admin-communication-copy`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          apikey: SUPABASE_PUBLISHABLE_KEY,
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({
          access_token: accessToken,
          prompt,
          context: {
            name: form.name,
            description: form.description,
            mode: form.mode,
            role: form.role,
            subscription_tier: form.subscription_tier,
            email_confirmed: form.email_confirmed,
            whatsapp_opt_in: form.whatsapp_opt_in,
            is_verified: form.is_verified,
            is_hidden: form.is_hidden,
          },
        }),
      });

      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(String(payload?.error || `HTTP ${response.status}`));
      }

      const emailSubject = String(payload?.subject || "").trim();
      const emailHtml = String(payload?.html || "").trim();
      const emailText = String(payload?.text || "").trim();

      if (!emailSubject || !emailHtml || !emailText) {
        throw new Error("A IA nao retornou os campos completos do e-mail.");
      }

      setForm((prev) => ({
        ...prev,
        sendEmail: true,
        emailSubject,
        emailHtml,
        emailText,
      }));
      toast.success("Campos do e-mail preenchidos com IA.");
    } catch (error) {
      console.error("[AdminCommunicationsTab] erro ao gerar copy com IA:", error);
      const message = error instanceof Error ? error.message : "Falha ao gerar conteudo com IA.";
      toast.error(message);
    } finally {
      setGeneratingAiCopy(false);
    }
  };

  const handleGenerateWhatsappCopy = async () => {
    const prompt = aiPrompt.trim();

    setGeneratingWhatsappAiCopy(true);
    try {
      const {
        data: { session: currentSession },
      } = await supabase.auth.getSession();
      const { data: refreshed } = await supabase.auth.refreshSession();
      const accessToken = refreshed.session?.access_token || currentSession?.access_token || "";

      if (!accessToken) {
        throw new Error("Sessao expirada. Faca login novamente.");
      }

      const response = await fetch(`${SUPABASE_URL}/functions/v1/generate-admin-communication-copy`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          apikey: SUPABASE_PUBLISHABLE_KEY,
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({
          access_token: accessToken,
          channel: "whatsapp",
          prompt,
          context: {
            name: form.name,
            description: form.description,
            mode: form.mode,
            role: form.role,
            subscription_tier: form.subscription_tier,
            email_confirmed: form.email_confirmed,
            whatsapp_opt_in: form.whatsapp_opt_in,
            is_verified: form.is_verified,
            is_hidden: form.is_hidden,
            email_subject: form.emailSubject,
            email_html: form.emailHtml,
            email_text: form.emailText,
            whatsapp_message: form.whatsappMessage,
            whatsapp_cta_path: form.whatsappCtaPath,
          },
        }),
      });

      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(String(payload?.error || `HTTP ${response.status}`));
      }

      const whatsappMessage = String(payload?.whatsapp_message || "").trim();
      if (!whatsappMessage) {
        throw new Error("A IA nao retornou a mensagem de WhatsApp.");
      }

      setForm((prev) => ({
        ...prev,
        sendWhatsapp: true,
        whatsappMessage,
      }));
      toast.success("Mensagem de WhatsApp preenchida com IA.");
    } catch (error) {
      console.error("[AdminCommunicationsTab] erro ao gerar mensagem WhatsApp com IA:", error);
      const message = error instanceof Error ? error.message : "Falha ao gerar conteudo com IA.";
      toast.error(message);
    } finally {
      setGeneratingWhatsappAiCopy(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="grid gap-6 xl:grid-cols-[1.15fr_0.85fr]">
        <Card>
          <CardHeader>
            <CardTitle>Notificação em Massa</CardTitle>
            <CardDescription>
              Envio individual ou segmentado por e-mail e WhatsApp. O WhatsApp usa o template generico aprovado.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label>Nome interno</Label>
                <Input value={form.name} onChange={(e) => setForm((prev) => ({ ...prev, name: e.target.value }))} />
              </div>
              <div className="space-y-2">
                <Label>Modo de envio</Label>
                <Select value={form.mode} onValueChange={(value: "individual" | "segment") => setForm((prev) => ({ ...prev, mode: value, targetUserId: value === "segment" ? "" : prev.targetUserId }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="segment">Segmentado</SelectItem>
                    <SelectItem value="individual">Individual</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-2">
              <Label>Descricao interna</Label>
              <Textarea value={form.description} onChange={(e) => setForm((prev) => ({ ...prev, description: e.target.value }))} rows={2} />
            </div>

            {form.mode === "individual" ? (
              <div className="space-y-2">
                <Label>Usuario alvo</Label>
                <div className="relative">
                  <Input value={userSearch} onChange={(e) => { setUserSearch(e.target.value); setForm((prev) => ({ ...prev, targetUserId: "" })); }} placeholder="Busque por nome ou e-mail" />
                  {searchingUsers ? <p className="mt-1 text-[11px] text-muted-foreground">Buscando usuarios...</p> : null}
                  {!searchingUsers && userSuggestions.length > 0 ? (
                    <div className="absolute z-20 mt-1 w-full rounded-md border bg-background p-1 shadow-md">
                      {userSuggestions.map((user) => (
                        <button
                          key={user.id}
                          type="button"
                          className="w-full rounded-sm px-2 py-1.5 text-left text-xs hover:bg-accent"
                          onClick={() => {
                            setForm((prev) => ({ ...prev, targetUserId: user.id }));
                            setUserSearch(`${user.full_name || "Usuario"} (${user.email || user.id})`);
                            setUserSuggestions([]);
                          }}
                        >
                          <p className="font-medium">{user.full_name || "Usuario sem nome"}</p>
                          <p className="text-muted-foreground">{user.email || user.id}</p>
                        </button>
                      ))}
                    </div>
                  ) : null}
                </div>
              </div>
            ) : (
              <div className="grid gap-4 md:grid-cols-3">
                <div className="space-y-2">
                  <Label>Perfil</Label>
                  <Select value={form.role} onValueChange={(value) => setForm((prev) => ({ ...prev, role: value }))}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Todos</SelectItem>
                      <SelectItem value="professional">Profissionais</SelectItem>
                      <SelectItem value="company">Empresas</SelectItem>
                      <SelectItem value="family">Familias</SelectItem>
                      <SelectItem value="admin">Admins</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Plano</Label>
                  <Select value={form.subscription_tier} onValueChange={(value) => setForm((prev) => ({ ...prev, subscription_tier: value }))}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Todos</SelectItem>
                      <SelectItem value="free_trial">Free trial</SelectItem>
                      <SelectItem value="monthly">Mensal</SelectItem>
                      <SelectItem value="yearly">Anual</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>E-mail confirmado</Label>
                  <Select value={form.email_confirmed} onValueChange={(value) => setForm((prev) => ({ ...prev, email_confirmed: value }))}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Todos</SelectItem>
                      <SelectItem value="true">Sim</SelectItem>
                      <SelectItem value="false">Nao</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Opt-in WhatsApp</Label>
                  <Select value={form.whatsapp_opt_in} onValueChange={(value) => setForm((prev) => ({ ...prev, whatsapp_opt_in: value }))}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Todos</SelectItem>
                      <SelectItem value="true">Sim</SelectItem>
                      <SelectItem value="false">Nao</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Verificado</Label>
                  <Select value={form.is_verified} onValueChange={(value) => setForm((prev) => ({ ...prev, is_verified: value }))}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Todos</SelectItem>
                      <SelectItem value="true">Sim</SelectItem>
                      <SelectItem value="false">Nao</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Oculto</Label>
                  <Select value={form.is_hidden} onValueChange={(value) => setForm((prev) => ({ ...prev, is_hidden: value }))}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Todos</SelectItem>
                      <SelectItem value="true">Sim</SelectItem>
                      <SelectItem value="false">Nao</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            )}

            <div className="grid gap-4 md:grid-cols-2">
              <div className="flex items-center justify-between rounded-lg border p-3">
                <div className="space-y-0.5">
                  <p className="text-sm font-medium flex items-center gap-2"><Mail className="h-4 w-4" /> Canal de e-mail</p>
                  <p className="text-xs text-muted-foreground">Assunto + HTML/texto.</p>
                </div>
                <Switch checked={form.sendEmail} onCheckedChange={(checked) => setForm((prev) => ({ ...prev, sendEmail: checked }))} />
              </div>
              <div className="flex items-center justify-between rounded-lg border p-3">
                <div className="space-y-0.5">
                  <p className="text-sm font-medium flex items-center gap-2"><MessageCircle className="h-4 w-4" /> Canal de WhatsApp</p>
                  <p className="text-xs text-muted-foreground">Template aprovado com CTA.</p>
                </div>
                <Switch checked={form.sendWhatsapp} onCheckedChange={(checked) => setForm((prev) => ({ ...prev, sendWhatsapp: checked }))} />
              </div>
            </div>

            {form.sendEmail ? (
              <div className="space-y-3 rounded-lg border p-4">
                <div className="space-y-3 rounded-lg border border-dashed bg-muted/30 p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="space-y-1">
                      <p className="text-sm font-medium flex items-center gap-2">
                        <Sparkles className="h-4 w-4" />
                        Preencher com IA
                      </p>
                      <p className="text-xs text-muted-foreground">
                        Descreva a mensagem e a IA vai montar o assunto, o HTML e o texto alternativo do e-mail.
                      </p>
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label>Instrucao para a IA</Label>
                    <Textarea
                      value={aiPrompt}
                      onChange={(e) => setAiPrompt(e.target.value)}
                      rows={4}
                      placeholder="Ex.: Criar uma notificacao em tom profissional avisando aos profissionais que ainda estamos na fase de captar empresas de home care para cadastro na plataforma. Incluir chamada para acompanhar novidades no dashboard."
                    />
                  </div>
                  <div className="flex justify-end">
                    <Button
                      type="button"
                      variant="secondary"
                      onClick={handleGenerateEmailCopy}
                      disabled={generatingAiCopy}
                    >
                      {generatingAiCopy ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <Sparkles className="h-4 w-4" />
                      )}
                      Gerar textos com IA
                    </Button>
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>Assunto do e-mail</Label>
                  <Input value={form.emailSubject} onChange={(e) => setForm((prev) => ({ ...prev, emailSubject: e.target.value }))} />
                </div>
                <div className="space-y-2">
                  <Label>HTML do e-mail</Label>
                  <Textarea value={form.emailHtml} onChange={(e) => setForm((prev) => ({ ...prev, emailHtml: e.target.value }))} rows={6} />
                </div>
                <div className="space-y-2">
                  <Label>Texto alternativo</Label>
                  <Textarea value={form.emailText} onChange={(e) => setForm((prev) => ({ ...prev, emailText: e.target.value }))} rows={4} />
                </div>
              </div>
            ) : null}

            {form.sendWhatsapp ? (
              <div className="space-y-3 rounded-lg border p-4">
                <div className="space-y-3 rounded-lg border border-dashed bg-muted/30 p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="space-y-1">
                      <p className="text-sm font-medium flex items-center gap-2">
                        <Sparkles className="h-4 w-4" />
                        Criar mensagem com IA
                      </p>
                      <p className="text-xs text-muted-foreground">
                        A IA usa o briefing e os demais campos preenchidos para montar a mensagem principal do WhatsApp.
                      </p>
                    </div>
                  </div>
                  <div className="flex justify-end">
                    <Button
                      type="button"
                      variant="secondary"
                      onClick={handleGenerateWhatsappCopy}
                      disabled={generatingWhatsappAiCopy}
                    >
                      {generatingWhatsappAiCopy ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <Sparkles className="h-4 w-4" />
                      )}
                      Criar com IA
                    </Button>
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>Mensagem WhatsApp</Label>
                  <Textarea value={form.whatsappMessage} onChange={(e) => setForm((prev) => ({ ...prev, whatsappMessage: e.target.value }))} rows={4} />
                </div>
                <div className="space-y-2">
                  <Label>CTA de destino</Label>
                  <Input value={form.whatsappCtaPath} onChange={(e) => setForm((prev) => ({ ...prev, whatsappCtaPath: e.target.value }))} />
                </div>
              </div>
            ) : null}

            <div className="grid gap-4 md:grid-cols-[1fr_auto_auto_auto_auto] md:items-end">
              <div className="space-y-2">
                <Label>Agendar para</Label>
                <Input type="datetime-local" value={form.scheduledFor} onChange={(e) => setForm((prev) => ({ ...prev, scheduledFor: e.target.value }))} />
              </div>
              <Button variant="secondary" onClick={sendPreviewToAdmin} disabled={saving || sendingPreview}>
                {sendingPreview ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Mail className="mr-2 h-4 w-4" />}
                Enviar prévia
              </Button>
              <Button variant="outline" onClick={() => saveJob("draft")} disabled={saving}>
                {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                Salvar rascunho
              </Button>
              <Button variant="outline" onClick={() => saveJob("scheduled")} disabled={saving}>
                {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                Agendar
              </Button>
              <Button onClick={() => saveJob("scheduled", true)} disabled={saving}>
                {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Send className="mr-2 h-4 w-4" />}
                Enviar agora
              </Button>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <div className="flex items-center justify-between gap-3">
              <div>
                <CardTitle>Jobs recentes</CardTitle>
                <CardDescription>Inclui o rascunho inicial do comunicado da fase da plataforma.</CardDescription>
              </div>
              <Button variant="outline" size="sm" onClick={fetchJobs} disabled={loading}>
                <RefreshCw className="mr-2 h-4 w-4" />
                Atualizar
              </Button>
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            {loading ? (
              <div className="flex justify-center py-8"><Loader2 className="h-5 w-5 animate-spin text-primary" /></div>
            ) : jobs.length === 0 ? (
              <div className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">
                Nenhum job encontrado.
              </div>
            ) : (
              jobs.map((job) => (
                <button
                  key={job.id}
                  type="button"
                  onClick={() => hydrateForm(job)}
                  className="w-full rounded-lg border p-3 text-left transition-colors hover:bg-secondary/40"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="space-y-1">
                      <p className="text-sm font-semibold">{job.name}</p>
                      <p className="text-xs text-muted-foreground">{job.description || "Sem descricao interna."}</p>
                    </div>
                    {getStatusBadge(job.status)}
                  </div>
                  <div className="mt-3 flex flex-wrap items-center gap-2 text-[11px] text-muted-foreground">
                    <span className="inline-flex items-center gap-1"><Users className="h-3 w-3" /> {job.total_recipients || 0} destinatarios</span>
                    <span>Enviados/fila: {job.sent_recipients || 0}</span>
                    <span>Falhas: {job.failed_recipients || 0}</span>
                    <span>Ignorados: {job.skipped_recipients || 0}</span>
                  </div>
                </button>
              ))
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default AdminCommunicationsTab;
