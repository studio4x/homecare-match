"use client";

import { useEffect, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useSiteConfig } from "@/hooks/use-site-config";
import { supabase } from "@/integrations/supabase/client";
import {
  DEFAULT_CRISIS_PROTOCOL_CONFIG,
  DEFAULT_SUPPORT_BUSINESS_HOURS_CONFIG,
  DEFAULT_SUPPORT_SLA_CONFIG,
  joinTextareaLines,
  normalizeCrisisProtocolConfig,
  normalizeSupportBusinessHoursConfig,
  normalizeSupportSlaConfig,
  splitTextareaLines,
  type CrisisProtocolConfig,
  type SupportBusinessHoursConfig,
  type SupportSlaConfig,
} from "@/lib/support-sla";
import { toast } from "sonner";
import { Loader2, ShieldAlert } from "lucide-react";

const CrisisProtocolPage = () => {
  const queryClient = useQueryClient();
  const { data: siteConfig, isLoading } = useSiteConfig();
  const [slaConfig, setSlaConfig] = useState<SupportSlaConfig>(DEFAULT_SUPPORT_SLA_CONFIG);
  const [businessHours, setBusinessHours] = useState<SupportBusinessHoursConfig>(DEFAULT_SUPPORT_BUSINESS_HOURS_CONFIG);
  const [crisisConfig, setCrisisConfig] = useState<CrisisProtocolConfig>(DEFAULT_CRISIS_PROTOCOL_CONFIG);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (!siteConfig) return;
    setSlaConfig(normalizeSupportSlaConfig(siteConfig.support_sla_config));
    setBusinessHours(normalizeSupportBusinessHoursConfig(siteConfig.support_business_hours_config));
    setCrisisConfig(normalizeCrisisProtocolConfig(siteConfig.crisis_protocol_config));
  }, [siteConfig]);

  const handleSave = async () => {
    setIsSaving(true);
    try {
      const { error } = await supabase.from("site_config").update({
        support_sla_config: slaConfig,
        support_business_hours_config: businessHours,
        crisis_protocol_config: crisisConfig,
      }).eq("id", 1);
      if (error) throw error;
      await queryClient.invalidateQueries({ queryKey: ["site-config"] });
      toast.success("Configurações salvas.");
    } catch (error) {
      console.error("[CrisisProtocolPage] Erro ao salvar configurações:", error);
      toast.error("Erro ao salvar configurações.");
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoading) {
    return <div className="flex justify-center p-8"><Loader2 className="animate-spin text-primary" /></div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Protocolo de crise</h1>
          <p className="text-muted-foreground">
            Configure o SLA público de primeira resposta e o manual interno de triagem, escalonamento e comunicação.
          </p>
        </div>
        <Button onClick={() => void handleSave()} disabled={isSaving}>
          {isSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
          Salvar configurações
        </Button>
      </div>

      <Card className="border-primary/10 bg-primary/5">
        <CardContent className="flex gap-3 p-5 text-sm text-muted-foreground">
          <ShieldAlert className="mt-0.5 h-5 w-5 shrink-0 text-primary" />
          <div>
            <p className="font-semibold text-foreground">Uso interno</p>
            <p className="mt-1">
              Esta tela não é publicada no site. Ela centraliza o SLA de primeira resposta e o protocolo operacional para denúncias graves.
            </p>
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-6 xl:grid-cols-2">
        <Card>
          <CardHeader><CardTitle>SLA público</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            {slaConfig.categories.map((category, index) => (
              <div key={category.key} className="rounded-xl border p-4">
                <div className="flex items-center justify-between gap-3">
                  <Label>{category.label}</Label>
                  <Badge variant="outline">{category.key}</Badge>
                </div>
                <div className="mt-3 grid gap-3 md:grid-cols-[140px_1fr]">
                  <div className="space-y-2">
                    <Label>Horas úteis</Label>
                    <Input
                      type="number"
                      min={1}
                      value={category.first_response_hours}
                      onChange={(event) =>
                        setSlaConfig((current) => ({
                          ...current,
                          categories: current.categories.map((item, itemIndex) =>
                            itemIndex === index
                              ? { ...item, first_response_hours: Math.max(1, Number(event.target.value || 1)) }
                              : item,
                          ),
                        }))
                      }
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Descrição pública</Label>
                    <Input
                      value={category.description}
                      onChange={(event) =>
                        setSlaConfig((current) => ({
                          ...current,
                          categories: current.categories.map((item, itemIndex) =>
                            itemIndex === index ? { ...item, description: event.target.value } : item,
                          ),
                        }))
                      }
                    />
                  </div>
                </div>
              </div>
            ))}

            <div className="grid gap-4 md:grid-cols-3">
              <div className="space-y-2">
                <Label>Timezone</Label>
                <Input
                  value={businessHours.timezone}
                  onChange={(event) => setBusinessHours((current) => ({ ...current, timezone: event.target.value }))}
                />
              </div>
              <div className="space-y-2">
                <Label>Inicio</Label>
                <Input
                  type="number"
                  min={0}
                  max={23}
                  value={businessHours.start_hour}
                  onChange={(event) => setBusinessHours((current) => ({ ...current, start_hour: Number(event.target.value || 0) }))}
                />
              </div>
              <div className="space-y-2">
                <Label>Fim</Label>
                <Input
                  type="number"
                  min={1}
                  max={23}
                  value={businessHours.end_hour}
                  onChange={(event) => setBusinessHours((current) => ({ ...current, end_hour: Number(event.target.value || 18) }))}
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label>Nota pública</Label>
              <Textarea
                rows={3}
                value={slaConfig.public_note}
                onChange={(event) => setSlaConfig((current) => ({ ...current, public_note: event.target.value }))}
              />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>Checklist e escalonamento</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>Checklist inicial</Label>
              <Textarea
                rows={5}
                value={joinTextareaLines(crisisConfig.triage_checklist)}
                onChange={(event) => setCrisisConfig((current) => ({ ...current, triage_checklist: splitTextareaLines(event.target.value) }))}
              />
            </div>
            <div className="space-y-2">
              <Label>Critérios de escalonamento</Label>
              <Textarea
                rows={5}
                value={joinTextareaLines(crisisConfig.escalation_criteria)}
                onChange={(event) => setCrisisConfig((current) => ({ ...current, escalation_criteria: splitTextareaLines(event.target.value) }))}
              />
            </div>
            <div className="space-y-2">
              <Label>Preservação de evidências</Label>
              <Textarea
                rows={4}
                value={joinTextareaLines(crisisConfig.evidence_preservation)}
                onChange={(event) => setCrisisConfig((current) => ({ ...current, evidence_preservation: splitTextareaLines(event.target.value) }))}
              />
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 xl:grid-cols-2">
        <Card>
          <CardHeader><CardTitle>Conta e comunicação</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>Fluxo de suspensão cautelar</Label>
              <Textarea
                rows={4}
                value={joinTextareaLines(crisisConfig.safety_hold_flow)}
                onChange={(event) => setCrisisConfig((current) => ({ ...current, safety_hold_flow: splitTextareaLines(event.target.value) }))}
              />
            </div>
            <div className="space-y-2">
              <Label>Orientação ao denunciante</Label>
              <Textarea
                rows={4}
                value={joinTextareaLines(crisisConfig.complainant_communication)}
                onChange={(event) => setCrisisConfig((current) => ({ ...current, complainant_communication: splitTextareaLines(event.target.value) }))}
              />
            </div>
            <div className="space-y-2">
              <Label>Holding statement para mídia</Label>
              <Textarea
                rows={4}
                value={crisisConfig.media_holding_statement}
                onChange={(event) => setCrisisConfig((current) => ({ ...current, media_holding_statement: event.target.value }))}
              />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>Contatos responsáveis</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            {crisisConfig.contacts.map((contact, index) => (
              <div key={`${contact.role}-${index}`} className="rounded-xl border p-4">
                <div className="mb-3 flex items-center justify-between">
                  <Label>{contact.role}</Label>
                  <Badge variant="outline">{contact.role}</Badge>
                </div>
                <div className="grid gap-3">
                  <Input
                    placeholder="Nome"
                    value={contact.name}
                    onChange={(event) =>
                      setCrisisConfig((current) => ({
                        ...current,
                        contacts: current.contacts.map((item, itemIndex) =>
                          itemIndex === index ? { ...item, name: event.target.value } : item,
                        ),
                      }))
                    }
                  />
                  <Input
                    placeholder="E-mail"
                    value={contact.email}
                    onChange={(event) =>
                      setCrisisConfig((current) => ({
                        ...current,
                        contacts: current.contacts.map((item, itemIndex) =>
                          itemIndex === index ? { ...item, email: event.target.value } : item,
                        ),
                      }))
                    }
                  />
                  <Input
                    placeholder="Telefone"
                    value={contact.phone}
                    onChange={(event) =>
                      setCrisisConfig((current) => ({
                        ...current,
                        contacts: current.contacts.map((item, itemIndex) =>
                          itemIndex === index ? { ...item, phone: event.target.value } : item,
                        ),
                      }))
                    }
                  />
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default CrisisProtocolPage;
