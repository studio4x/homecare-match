"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Loader2, MessageCircle, RefreshCw, RotateCcw, Save } from "lucide-react";
import { toast } from "sonner";

type TargetKind = "user" | "admin";

type TemplateConfigRow = {
  event_type: string;
  target_kind: TargetKind;
  label: string;
  template_name: string;
  sample_message: string;
  var1_default: string;
  var2_default: string;
  var3_default: string;
  variations: Record<string, string>;
  is_active: boolean;
  updated_at?: string | null;
};

type VariationField = {
  key: string;
  label: string;
  placeholder: string;
};

const DEFAULT_TEMPLATE_CONFIGS: TemplateConfigRow[] = [
  {
    event_type: "new_contact_interest_user",
    target_kind: "user",
    label: "Novo interesse no perfil (usuario)",
    template_name: "hcm_user_contact_interest",
    sample_message:
      "Novo interesse no seu perfil.\n\n{{1}} {{2}}.\n\nAcompanhe em: https://www.homecarematch.com.br{{3}}",
    var1_default: "Empresa interessada",
    var2_default: "demonstrou interesse no seu perfil",
    var3_default: "/dashboard/contatos",
    variations: {
      action_text: "demonstrou interesse no seu perfil",
      cta_path: "/dashboard/contatos",
    },
    is_active: true,
  },
  {
    event_type: "support_new_message_user",
    target_kind: "user",
    label: "Suporte: nova resposta (usuario)",
    template_name: "hcm_user_support_update",
    sample_message:
      "Atualizacao do suporte HomeCare Match.\n\nSeu chamado \"{{1}}\" {{2}}.\n\nAcesse: https://www.homecarematch.com.br{{3}}",
    var1_default: "Chamado",
    var2_default: "recebeu nova resposta da equipe",
    var3_default: "/dashboard/suporte/{ticket_id}",
    variations: {
      action_text: "recebeu nova resposta da equipe",
      cta_path_pattern: "/dashboard/suporte/{ticket_id}",
    },
    is_active: true,
  },
  {
    event_type: "support_ticket_closed_user",
    target_kind: "user",
    label: "Suporte: chamado encerrado (usuario)",
    template_name: "hcm_user_support_update",
    sample_message:
      "Atualizacao do suporte HomeCare Match.\n\nSeu chamado \"{{1}}\" {{2}}.\n\nAcesse: https://www.homecarematch.com.br{{3}}",
    var1_default: "Chamado",
    var2_default: "foi encerrado pela equipe",
    var3_default: "/dashboard/suporte/{ticket_id}",
    variations: {
      action_text: "foi encerrado pela equipe",
      cta_path_pattern: "/dashboard/suporte/{ticket_id}",
    },
    is_active: true,
  },
  {
    event_type: "verification_request_user_confirmation",
    target_kind: "user",
    label: "Verificacao: solicitacao recebida (usuario)",
    template_name: "hcm_user_verification_update",
    sample_message: "Atualizacao de verificacao de perfil.\n\n{{1}}, {{2}}.\n\nDetalhes: {{3}}",
    var1_default: "Usuario",
    var2_default: "recebemos seus documentos para verificacao",
    var3_default: "/dashboard/perfil",
    variations: {
      status_text: "recebemos seus documentos para verificacao",
      details_path: "/dashboard/perfil",
    },
    is_active: true,
  },
  {
    event_type: "verification_approved_user",
    target_kind: "user",
    label: "Verificacao: aprovada (usuario)",
    template_name: "hcm_user_verification_update",
    sample_message: "Atualizacao de verificacao de perfil.\n\n{{1}}, {{2}}.\n\nDetalhes: {{3}}",
    var1_default: "Usuario",
    var2_default: "sua verificacao foi aprovada",
    var3_default: "/dashboard/perfil",
    variations: {
      status_text: "sua verificacao foi aprovada",
      details_path: "/dashboard/perfil",
    },
    is_active: true,
  },
  {
    event_type: "verification_rejected_user",
    target_kind: "user",
    label: "Verificacao: reprovada (usuario)",
    template_name: "hcm_user_verification_update",
    sample_message: "Atualizacao de verificacao de perfil.\n\n{{1}}, {{2}}.\n\nDetalhes: {{3}}",
    var1_default: "Usuario",
    var2_default: "sua verificacao foi reprovada",
    var3_default: "nao informado",
    variations: {
      status_text: "sua verificacao foi reprovada",
      rejection_reason_fallback: "nao informado",
    },
    is_active: true,
  },
  {
    event_type: "subscription_renewal_reminder_user",
    target_kind: "user",
    label: "Assinatura: lembrete de renovacao (usuario)",
    template_name: "hcm_user_subscription_reminder",
    sample_message:
      "Lembrete de assinatura HomeCare Match.\n\n{{1}}, {{2}}.\n\nAcompanhe em: https://www.homecarematch.com.br{{3}}",
    var1_default: "Usuario",
    var2_default: "Lembrete de assinatura",
    var3_default: "/dashboard/pagamentos?renewalReminder={reminder_key}",
    variations: {
      monthly_due_title: "Renovacao automatica hoje",
      monthly_upcoming_title: "Renovacao automatica proxima",
      yearly_due_title: "Plano anual vence hoje",
      yearly_upcoming_title: "Plano anual perto do vencimento",
      details_path_pattern: "/dashboard/pagamentos?renewalReminder={reminder_key}",
    },
    is_active: true,
  },
  {
    event_type: "verification_request_admin",
    target_kind: "admin",
    label: "Verificacao pendente (admin)",
    template_name: "hcm_admin_notification",
    sample_message:
      "Alerta administrativo HomeCare Match.\n\n{{1}} {{2}}.\n\nAcesse: https://www.homecarematch.com.br{{3}}",
    var1_default: "Profissional",
    var2_default: "enviou documentos para verificacao",
    var3_default: "/admin/verificacoes",
    variations: {
      status_text: "enviou documentos para verificacao",
      details_path: "/admin/verificacoes",
    },
    is_active: true,
  },
  {
    event_type: "support_new_ticket_admin",
    target_kind: "admin",
    label: "Suporte: novo ticket (admin)",
    template_name: "hcm_admin_notification",
    sample_message:
      "Alerta administrativo HomeCare Match.\n\n{{1}} abriu ticket \"{{2}}\".\n\nAcesse: https://www.homecarematch.com.br{{3}}",
    var1_default: "Usuario",
    var2_default: "Chamado",
    var3_default: "/admin/suporte/{ticket_id}",
    variations: {
      cta_path_pattern: "/admin/suporte/{ticket_id}",
    },
    is_active: true,
  },
  {
    event_type: "support_new_message_admin",
    target_kind: "admin",
    label: "Suporte: nova mensagem (admin)",
    template_name: "hcm_admin_notification",
    sample_message:
      "Alerta administrativo HomeCare Match.\n\n{{1}} respondeu no ticket \"{{2}}\".\n\nAcesse: https://www.homecarematch.com.br{{3}}",
    var1_default: "Usuario",
    var2_default: "Chamado",
    var3_default: "/admin/suporte/{ticket_id}",
    variations: {
      cta_path_pattern: "/admin/suporte/{ticket_id}",
    },
    is_active: true,
  },
  {
    event_type: "report_created_admin",
    target_kind: "admin",
    label: "Nova denuncia (admin)",
    template_name: "hcm_admin_notification",
    sample_message:
      "Alerta administrativo HomeCare Match.\n\nPerfil: {{1}}.\nMotivo: {{2}}.\n\nAcesse: https://www.homecarematch.com.br{{3}}",
    var1_default: "Perfil",
    var2_default: "Motivo nao informado",
    var3_default: "/admin/denuncias",
    variations: {
      details_path: "/admin/denuncias",
    },
    is_active: true,
  },
  {
    event_type: "concierge_request_admin",
    target_kind: "admin",
    label: "Novo pedido concierge (admin)",
    template_name: "hcm_admin_notification",
    sample_message:
      "Alerta administrativo HomeCare Match.\n\n{{1}} solicitou atendimento: {{2}}.\n\nAcesse: https://www.homecarematch.com.br{{3}}",
    var1_default: "Usuario",
    var2_default: "Especialidade nao informada",
    var3_default: "/admin/concierge",
    variations: {
      details_path: "/admin/concierge",
    },
    is_active: true,
  },
];

const VARIATION_FIELDS: Record<string, VariationField[]> = {
  new_contact_interest_user: [
    { key: "action_text", label: "Texto da acao", placeholder: "demonstrou interesse no seu perfil" },
    { key: "cta_path", label: "Caminho do CTA", placeholder: "/dashboard/contatos" },
  ],
  support_new_message_user: [
    { key: "action_text", label: "Texto da acao", placeholder: "recebeu nova resposta da equipe" },
    { key: "cta_path_pattern", label: "Padrao de caminho", placeholder: "/dashboard/suporte/{ticket_id}" },
  ],
  support_ticket_closed_user: [
    { key: "action_text", label: "Texto da acao", placeholder: "foi encerrado pela equipe" },
    { key: "cta_path_pattern", label: "Padrao de caminho", placeholder: "/dashboard/suporte/{ticket_id}" },
  ],
  verification_request_user_confirmation: [
    { key: "status_text", label: "Texto de status", placeholder: "recebemos seus documentos para verificacao" },
    { key: "details_path", label: "Detalhes/caminho", placeholder: "/dashboard/perfil" },
  ],
  verification_approved_user: [
    { key: "status_text", label: "Texto de status", placeholder: "sua verificacao foi aprovada" },
    { key: "details_path", label: "Detalhes/caminho", placeholder: "/dashboard/perfil" },
  ],
  verification_rejected_user: [
    { key: "status_text", label: "Texto de status", placeholder: "sua verificacao foi reprovada" },
    { key: "rejection_reason_fallback", label: "Fallback motivo", placeholder: "nao informado" },
  ],
  subscription_renewal_reminder_user: [
    { key: "monthly_due_title", label: "Titulo mensal (vence hoje)", placeholder: "Renovacao automatica hoje" },
    { key: "monthly_upcoming_title", label: "Titulo mensal (proximo)", placeholder: "Renovacao automatica proxima" },
    { key: "yearly_due_title", label: "Titulo anual (vence hoje)", placeholder: "Plano anual vence hoje" },
    { key: "yearly_upcoming_title", label: "Titulo anual (proximo)", placeholder: "Plano anual perto do vencimento" },
    {
      key: "details_path_pattern",
      label: "Padrao de caminho",
      placeholder: "/dashboard/pagamentos?renewalReminder={reminder_key}",
    },
  ],
  verification_request_admin: [
    { key: "status_text", label: "Texto de status", placeholder: "enviou documentos para verificacao" },
    { key: "details_path", label: "Detalhes/caminho", placeholder: "/admin/verificacoes" },
  ],
  support_new_ticket_admin: [
    { key: "cta_path_pattern", label: "Padrao de caminho", placeholder: "/admin/suporte/{ticket_id}" },
  ],
  support_new_message_admin: [
    { key: "cta_path_pattern", label: "Padrao de caminho", placeholder: "/admin/suporte/{ticket_id}" },
  ],
  report_created_admin: [
    { key: "details_path", label: "Detalhes/caminho", placeholder: "/admin/denuncias" },
  ],
  concierge_request_admin: [
    { key: "details_path", label: "Detalhes/caminho", placeholder: "/admin/concierge" },
  ],
};

const normalizeText = (value: unknown, fallback = "") => {
  const text = String(value ?? "").trim();
  return text.length > 0 ? text : fallback;
};

const normalizeVariations = (input: unknown) => {
  if (!input || typeof input !== "object" || Array.isArray(input)) return {} as Record<string, string>;
  const result: Record<string, string> = {};
  for (const [key, value] of Object.entries(input as Record<string, unknown>)) {
    const safeKey = normalizeText(key);
    if (!safeKey) continue;
    const safeValue = normalizeText(value);
    if (!safeValue) continue;
    result[safeKey] = safeValue;
  }
  return result;
};

const mergeWithDefaults = (rows: TemplateConfigRow[]) => {
  const byEvent = new Map(rows.map((row) => [row.event_type, row]));
  const merged = DEFAULT_TEMPLATE_CONFIGS.map((defaults) => {
    const current = byEvent.get(defaults.event_type);
    if (!current) return defaults;
    return {
      ...defaults,
      ...current,
      variations: {
        ...defaults.variations,
        ...current.variations,
      },
    };
  });

  for (const row of rows) {
    if (!merged.find((item) => item.event_type === row.event_type)) {
      merged.push(row);
    }
  }

  return merged;
};

const renderPreview = (row: TemplateConfigRow) => {
  const base = row.sample_message || "";
  return base
    .replaceAll("{{1}}", row.var1_default || "[var1]")
    .replaceAll("{{2}}", row.var2_default || "[var2]")
    .replaceAll("{{3}}", row.var3_default || "[var3]");
};

const mapDbRow = (row: any): TemplateConfigRow => ({
  event_type: normalizeText(row?.event_type),
  target_kind: row?.target_kind === "admin" ? "admin" : "user",
  label: normalizeText(row?.label, "Evento"),
  template_name: normalizeText(row?.template_name),
  sample_message: normalizeText(row?.sample_message),
  var1_default: normalizeText(row?.var1_default),
  var2_default: normalizeText(row?.var2_default),
  var3_default: normalizeText(row?.var3_default),
  variations: normalizeVariations(row?.variations),
  is_active: row?.is_active !== false,
  updated_at: row?.updated_at || null,
});

const toDbPayload = (row: TemplateConfigRow) => ({
  event_type: row.event_type,
  target_kind: row.target_kind,
  label: row.label,
  template_name: row.template_name,
  sample_message: row.sample_message,
  var1_default: row.var1_default || null,
  var2_default: row.var2_default || null,
  var3_default: row.var3_default || null,
  variations: row.variations || {},
  is_active: row.is_active,
  updated_at: new Date().toISOString(),
});

const WhatsappTemplateSettingsTab = () => {
  const [rows, setRows] = useState<TemplateConfigRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [syncingDefaults, setSyncingDefaults] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchConfigs = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const { data, error: fetchError } = await supabase
        .from("whatsapp_template_configs")
        .select("*")
        .order("target_kind", { ascending: false })
        .order("event_type", { ascending: true });

      if (fetchError) throw fetchError;
      const mapped = (data || []).map(mapDbRow);
      setRows(mergeWithDefaults(mapped));
    } catch (loadError: any) {
      setRows(mergeWithDefaults([]));
      setError(loadError?.message || "Falha ao carregar configuracoes.");
      toast.error("Nao foi possivel carregar as configuracoes de templates WhatsApp.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchConfigs();
  }, [fetchConfigs]);

  const groupedRows = useMemo(() => {
    const users = rows.filter((row) => row.target_kind === "user");
    const admins = rows.filter((row) => row.target_kind === "admin");
    return { users, admins };
  }, [rows]);

  const updateRow = (eventType: string, patch: Partial<TemplateConfigRow>) => {
    setRows((prev) =>
      prev.map((row) => (row.event_type === eventType ? { ...row, ...patch } : row)),
    );
  };

  const updateVariation = (eventType: string, key: string, value: string) => {
    setRows((prev) =>
      prev.map((row) =>
        row.event_type === eventType
          ? {
              ...row,
              variations: {
                ...row.variations,
                [key]: value,
              },
            }
          : row,
      ),
    );
  };

  const handleSave = async () => {
    setSaving(true);
    setError(null);
    try {
      const payload = rows.map(toDbPayload);
      const { error: saveError } = await supabase
        .from("whatsapp_template_configs")
        .upsert(payload, { onConflict: "event_type" });
      if (saveError) throw saveError;
      toast.success("Configuracoes de templates WhatsApp salvas.");
      await fetchConfigs();
    } catch (saveError: any) {
      setError(saveError?.message || "Falha ao salvar configuracoes.");
      toast.error("Erro ao salvar configuracoes de templates WhatsApp.");
    } finally {
      setSaving(false);
    }
  };

  const handleRestoreDefaults = async () => {
    setSyncingDefaults(true);
    setError(null);
    try {
      const payload = DEFAULT_TEMPLATE_CONFIGS.map((row) => ({
        ...toDbPayload(row),
        created_at: new Date().toISOString(),
      }));
      const { error: restoreError } = await supabase
        .from("whatsapp_template_configs")
        .upsert(payload, { onConflict: "event_type" });
      if (restoreError) throw restoreError;
      toast.success("Padroes restaurados com sucesso.");
      await fetchConfigs();
    } catch (restoreError: any) {
      setError(restoreError?.message || "Falha ao restaurar padroes.");
      toast.error("Erro ao restaurar padroes de templates WhatsApp.");
    } finally {
      setSyncingDefaults(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-10">
        <Loader2 className="h-5 w-5 animate-spin text-primary" />
      </div>
    );
  }

  const renderSection = (title: string, description: string, list: TemplateConfigRow[]) => (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">{title}</CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {list.map((row) => {
          const variationFields = VARIATION_FIELDS[row.event_type] || [];
          return (
            <div key={row.event_type} className="rounded-lg border p-4 space-y-4">
              <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
                <div>
                  <p className="text-sm font-semibold">{row.label}</p>
                  <p className="text-[11px] text-muted-foreground">{row.event_type}</p>
                </div>
                <div className="flex items-center gap-3">
                  <Badge variant="outline">{row.target_kind === "admin" ? "admin" : "usuario"}</Badge>
                  <div className="flex items-center gap-2">
                    <Label className="text-xs">Ativo</Label>
                    <Switch
                      checked={row.is_active}
                      onCheckedChange={(checked) => updateRow(row.event_type, { is_active: checked })}
                    />
                  </div>
                </div>
              </div>

              <div className="grid gap-3 md:grid-cols-2">
                <div className="space-y-1">
                  <Label className="text-xs">Nome do template (Meta)</Label>
                  <Input
                    value={row.template_name}
                    onChange={(event) => updateRow(row.event_type, { template_name: event.target.value })}
                    placeholder="hcm_user_notification"
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Titulo interno</Label>
                  <Input
                    value={row.label}
                    onChange={(event) => updateRow(row.event_type, { label: event.target.value })}
                    placeholder="Rotulo do evento"
                  />
                </div>
              </div>

                <div className="grid gap-3 md:grid-cols-3">
                  <div className="space-y-1">
                    <Label className="text-xs">{"Padrao {{1}}"}</Label>
                    <Input
                      value={row.var1_default}
                      onChange={(event) => updateRow(row.event_type, { var1_default: event.target.value })}
                      placeholder="Valor padrao da variavel 1"
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">{"Padrao {{2}}"}</Label>
                    <Input
                      value={row.var2_default}
                      onChange={(event) => updateRow(row.event_type, { var2_default: event.target.value })}
                      placeholder="Valor padrao da variavel 2"
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">{"Padrao {{3}}"}</Label>
                    <Input
                      value={row.var3_default}
                      onChange={(event) => updateRow(row.event_type, { var3_default: event.target.value })}
                      placeholder="Valor padrao da variavel 3"
                  />
                </div>
              </div>

              {variationFields.length > 0 ? (
                <div className="grid gap-3 md:grid-cols-2">
                  {variationFields.map((field) => (
                    <div key={`${row.event_type}-${field.key}`} className="space-y-1">
                      <Label className="text-xs">{field.label}</Label>
                      <Input
                        value={row.variations[field.key] || ""}
                        onChange={(event) => updateVariation(row.event_type, field.key, event.target.value)}
                        placeholder={field.placeholder}
                      />
                    </div>
                  ))}
                </div>
              ) : null}

              <div className="space-y-1">
                <Label className="text-xs">Modelo de mensagem / exemplo</Label>
                <Textarea
                  value={row.sample_message}
                  onChange={(event) => updateRow(row.event_type, { sample_message: event.target.value })}
                  className="min-h-[120px]"
                />
              </div>

              <div className="rounded-md border bg-muted/30 p-3">
                <p className="text-[11px] font-medium text-muted-foreground mb-2 flex items-center gap-1">
                  <MessageCircle className="h-3.5 w-3.5" />
                  Preview com valores padrao
                </p>
                <pre className="text-xs whitespace-pre-wrap font-sans">{renderPreview(row)}</pre>
              </div>
            </div>
          );
        })}
      </CardContent>
    </Card>
  );

  return (
    <div className="space-y-4">
      <Card>
        <CardContent className="p-4 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div>
            <p className="text-sm font-semibold">Templates WhatsApp por notificacao</p>
            <p className="text-xs text-muted-foreground">
              Defina nome do template, textos padrao, variacoes e preview por evento.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" onClick={fetchConfigs} disabled={saving || syncingDefaults}>
              <RefreshCw className="mr-2 h-4 w-4" />
              Recarregar
            </Button>
            <Button variant="outline" onClick={handleRestoreDefaults} disabled={saving || syncingDefaults}>
              {syncingDefaults ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <RotateCcw className="mr-2 h-4 w-4" />
              )}
              Restaurar padroes
            </Button>
            <Button onClick={handleSave} disabled={saving || syncingDefaults}>
              {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
              Salvar configuracoes
            </Button>
          </div>
        </CardContent>
      </Card>

      {error ? (
        <Card>
          <CardContent className="p-4">
            <p className="text-sm text-destructive">{error}</p>
          </CardContent>
        </Card>
      ) : null}

      {renderSection(
        "Eventos de usuario",
        "Configuracoes para mensagens enviadas a profissionais e usuarios finais.",
        groupedRows.users,
      )}
      {renderSection(
        "Eventos administrativos",
        "Configuracoes para alertas enviados ao numero administrativo.",
        groupedRows.admins,
      )}
    </div>
  );
};

export default WhatsappTemplateSettingsTab;
