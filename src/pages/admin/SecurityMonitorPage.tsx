"use client";

import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Loader2, RefreshCw, ShieldAlert, ShieldCheck, Timer } from "lucide-react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

type SecurityMonitorConfig = {
  id: number;
  enabled: boolean;
  cadence_minutes: number;
  failed_notifications_threshold: number;
  high_risk_admin_actions_threshold: number;
  max_admin_accounts: number;
  last_run_at: string | null;
  next_run_at: string | null;
  updated_at: string | null;
};

type SecurityMonitorRun = {
  id: string;
  trigger_source: "manual" | "cron" | "system";
  overall_status: "ok" | "warning" | "critical" | "error";
  started_at: string;
  finished_at: string | null;
  created_at: string;
  created_by: string | null;
  summary: {
    total_checks?: number;
    warning_checks?: number;
    critical_checks?: number;
    error?: string;
  } | null;
};

type SecurityMonitorFinding = {
  id: string;
  run_id: string;
  check_key: string;
  severity: "info" | "warning" | "critical";
  status: "pass" | "warn" | "fail";
  message: string;
  details: Record<string, unknown> | null;
  created_at: string;
};

const DEFAULT_CONFIG: SecurityMonitorConfig = {
  id: 1,
  enabled: true,
  cadence_minutes: 1440,
  failed_notifications_threshold: 20,
  high_risk_admin_actions_threshold: 15,
  max_admin_accounts: 5,
  last_run_at: null,
  next_run_at: null,
  updated_at: null,
};

const statusBadgeMap: Record<string, { label: string; className?: string; variant?: "default" | "destructive" | "secondary" | "outline" }> = {
  ok: { label: "OK", variant: "default" },
  warning: { label: "Alerta", className: "bg-amber-100 text-amber-800 border-amber-200", variant: "outline" },
  critical: { label: "Critico", variant: "destructive" },
  error: { label: "Erro", variant: "destructive" },
};

const severityBadgeMap: Record<string, { label: string; className?: string; variant?: "default" | "destructive" | "secondary" | "outline" }> = {
  info: { label: "Info", variant: "secondary" },
  warning: { label: "Alerta", className: "bg-amber-100 text-amber-800 border-amber-200", variant: "outline" },
  critical: { label: "Critico", variant: "destructive" },
};

const statusLabelMap: Record<string, string> = {
  pass: "Passou",
  warn: "Atencao",
  fail: "Falhou",
};

const triggerLabelMap: Record<string, string> = {
  manual: "Manual",
  cron: "Automatico",
  system: "Sistema",
};

const formatDateTime = (value: string | null | undefined) => {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return date.toLocaleString("pt-BR");
};

const toInteger = (value: string, fallback: number) => {
  const parsed = Number.parseInt(value, 10);
  if (Number.isNaN(parsed)) return fallback;
  return parsed;
};

const SecurityMonitorPage = () => {
  const [loading, setLoading] = useState(true);
  const [running, setRunning] = useState(false);
  const [savingConfig, setSavingConfig] = useState(false);
  const [config, setConfig] = useState<SecurityMonitorConfig>(DEFAULT_CONFIG);
  const [runs, setRuns] = useState<SecurityMonitorRun[]>([]);
  const [selectedRunId, setSelectedRunId] = useState<string | null>(null);
  const [findings, setFindings] = useState<SecurityMonitorFinding[]>([]);
  const [loadingFindings, setLoadingFindings] = useState(false);

  const latestRun = runs[0] || null;

  const runsInLast24h = useMemo(() => {
    const cutoff = Date.now() - 24 * 60 * 60 * 1000;
    return runs.filter((run) => {
      const created = new Date(run.created_at).getTime();
      return !Number.isNaN(created) && created >= cutoff;
    }).length;
  }, [runs]);

  const loadRunsAndConfig = async () => {
    setLoading(true);
    try {
      const [configResponse, runsResponse] = await Promise.all([
        supabase.from("security_monitor_config").select("*").eq("id", 1).maybeSingle(),
        supabase
          .from("security_monitor_runs")
          .select("id,trigger_source,overall_status,started_at,finished_at,created_at,created_by,summary")
          .order("created_at", { ascending: false })
          .limit(40),
      ]);

      if (configResponse.error) throw configResponse.error;
      if (runsResponse.error) throw runsResponse.error;

      const loadedConfig = (configResponse.data as SecurityMonitorConfig | null) || DEFAULT_CONFIG;
      const loadedRuns = (runsResponse.data as SecurityMonitorRun[] | null) || [];

      setConfig({ ...DEFAULT_CONFIG, ...loadedConfig });
      setRuns(loadedRuns);

      setSelectedRunId((current) => {
        if (current && loadedRuns.some((run) => run.id === current)) return current;
        return loadedRuns[0]?.id || null;
      });
    } catch (error: any) {
      toast.error(error?.message || "Erro ao carregar monitoramento de seguranca.");
    } finally {
      setLoading(false);
    }
  };

  const loadFindings = async (runId: string) => {
    setLoadingFindings(true);
    try {
      const { data, error } = await supabase
        .from("security_monitor_findings")
        .select("id,run_id,check_key,severity,status,message,details,created_at")
        .eq("run_id", runId)
        .order("created_at", { ascending: true });

      if (error) throw error;
      setFindings((data as SecurityMonitorFinding[] | null) || []);
    } catch (error: any) {
      toast.error(error?.message || "Erro ao carregar achados de seguranca.");
      setFindings([]);
    } finally {
      setLoadingFindings(false);
    }
  };

  useEffect(() => {
    loadRunsAndConfig();
  }, []);

  useEffect(() => {
    if (!selectedRunId) {
      setFindings([]);
      return;
    }
    loadFindings(selectedRunId);
  }, [selectedRunId]);

  const handleRunNow = async () => {
    setRunning(true);
    try {
      const { data, error } = await supabase.rpc("run_security_monitor", { p_trigger: "manual" });
      if (error) throw error;
      await loadRunsAndConfig();
      if (typeof data === "string" && data) {
        setSelectedRunId(data);
      }
      toast.success("Varredura de seguranca executada com sucesso.");
    } catch (error: any) {
      toast.error(error?.message || "Erro ao executar varredura de seguranca.");
    } finally {
      setRunning(false);
    }
  };

  const handleSaveConfig = async () => {
    setSavingConfig(true);
    try {
      const payload = {
        enabled: Boolean(config.enabled),
        cadence_minutes: Math.min(10080, Math.max(15, Number(config.cadence_minutes || 1440))),
        failed_notifications_threshold: Math.max(0, Number(config.failed_notifications_threshold || 0)),
        high_risk_admin_actions_threshold: Math.max(0, Number(config.high_risk_admin_actions_threshold || 0)),
        max_admin_accounts: Math.max(1, Number(config.max_admin_accounts || 1)),
        updated_at: new Date().toISOString(),
      };

      const { error } = await supabase
        .from("security_monitor_config")
        .update(payload)
        .eq("id", 1);

      if (error) throw error;
      toast.success("Configuracao de monitoramento salva.");
      await loadRunsAndConfig();
    } catch (error: any) {
      toast.error(error?.message || "Erro ao salvar configuracao.");
    } finally {
      setSavingConfig(false);
    }
  };

  const latestStatusMeta = statusBadgeMap[latestRun?.overall_status || "ok"] || statusBadgeMap.ok;
  const overdue =
    config.enabled &&
    config.next_run_at &&
    !Number.isNaN(new Date(config.next_run_at).getTime()) &&
    new Date(config.next_run_at).getTime() < Date.now();

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Monitoramento de Seguranca</h1>
          <p className="text-sm text-muted-foreground">
            Verificacao periodica de controles criticos com historico de achados no painel administrativo.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button variant="outline" onClick={loadRunsAndConfig} disabled={loading || running || savingConfig}>
            <RefreshCw className="mr-2 h-4 w-4" />
            Atualizar
          </Button>
          <Button onClick={handleRunNow} disabled={loading || running}>
            {running ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <ShieldCheck className="mr-2 h-4 w-4" />}
            Executar agora
          </Button>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Status mais recente</CardDescription>
            <CardTitle className="text-base">
              <Badge variant={latestStatusMeta.variant || "outline"} className={latestStatusMeta.className}>
                {latestStatusMeta.label}
              </Badge>
            </CardTitle>
          </CardHeader>
          <CardContent className="text-xs text-muted-foreground">
            Ultima execucao: {formatDateTime(latestRun?.finished_at || latestRun?.started_at || null)}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Proxima execucao</CardDescription>
            <CardTitle className="text-base">
              {config.enabled ? (
                <Badge variant={overdue ? "destructive" : "outline"}>{overdue ? "Atrasado" : "No prazo"}</Badge>
              ) : (
                <Badge variant="secondary">Pausado</Badge>
              )}
            </CardTitle>
          </CardHeader>
          <CardContent className="text-xs text-muted-foreground">
            {config.enabled ? formatDateTime(config.next_run_at) : "Monitoramento automatico desativado"}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Execucoes (24h)</CardDescription>
            <CardTitle className="text-2xl">{runsInLast24h}</CardTitle>
          </CardHeader>
          <CardContent className="text-xs text-muted-foreground">
            Janela movel das ultimas 24 horas.
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Checks no ultimo ciclo</CardDescription>
            <CardTitle className="text-2xl">
              {Number(latestRun?.summary?.total_checks || 0)}
            </CardTitle>
          </CardHeader>
          <CardContent className="text-xs text-muted-foreground">
            Alertas: {Number(latestRun?.summary?.warning_checks || 0)} | Criticos: {Number(latestRun?.summary?.critical_checks || 0)}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Timer className="h-4 w-4" />
            Configuracao de periodicidade
          </CardTitle>
          <CardDescription>
            Ajuste frequencia da varredura automatica e limites de alerta.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between rounded-md border p-3">
            <div>
              <p className="text-sm font-medium">Monitoramento automatico</p>
              <p className="text-xs text-muted-foreground">Quando ativo, o sistema executa a varredura por cron.</p>
            </div>
            <Switch
              checked={Boolean(config.enabled)}
              onCheckedChange={(checked) => setConfig((prev) => ({ ...prev, enabled: checked }))}
            />
          </div>

          <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-4">
            <div className="space-y-2">
              <Label htmlFor="cadence_minutes">Periodicidade (min)</Label>
              <Input
                id="cadence_minutes"
                type="number"
                min={15}
                max={10080}
                value={config.cadence_minutes}
                onChange={(event) =>
                  setConfig((prev) => ({
                    ...prev,
                    cadence_minutes: toInteger(event.target.value, prev.cadence_minutes),
                  }))
                }
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="failed_threshold">Limite falhas notificacao (24h)</Label>
              <Input
                id="failed_threshold"
                type="number"
                min={0}
                value={config.failed_notifications_threshold}
                onChange={(event) =>
                  setConfig((prev) => ({
                    ...prev,
                    failed_notifications_threshold: toInteger(event.target.value, prev.failed_notifications_threshold),
                  }))
                }
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="risk_threshold">Limite acoes de risco (24h)</Label>
              <Input
                id="risk_threshold"
                type="number"
                min={0}
                value={config.high_risk_admin_actions_threshold}
                onChange={(event) =>
                  setConfig((prev) => ({
                    ...prev,
                    high_risk_admin_actions_threshold: toInteger(event.target.value, prev.high_risk_admin_actions_threshold),
                  }))
                }
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="max_admin_accounts">Maximo admins sem alerta</Label>
              <Input
                id="max_admin_accounts"
                type="number"
                min={1}
                value={config.max_admin_accounts}
                onChange={(event) =>
                  setConfig((prev) => ({
                    ...prev,
                    max_admin_accounts: toInteger(event.target.value, prev.max_admin_accounts),
                  }))
                }
              />
            </div>
          </div>

          <div className="flex justify-end">
            <Button onClick={handleSaveConfig} disabled={savingConfig || loading}>
              {savingConfig ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              Salvar configuracao
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ShieldAlert className="h-4 w-4" />
            Historico de varreduras
          </CardTitle>
          <CardDescription>
            Execucoes manuais e automaticas, com status geral e resultado de checks.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-5 w-5 animate-spin text-primary" />
            </div>
          ) : runs.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nenhuma varredura registrada ainda.</p>
          ) : (
            <div className="rounded-md border overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Inicio</TableHead>
                    <TableHead>Origem</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Resumo</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {runs.map((run) => {
                    const statusMeta = statusBadgeMap[run.overall_status] || statusBadgeMap.ok;
                    const isSelected = run.id === selectedRunId;
                    const total = Number(run.summary?.total_checks || 0);
                    const warnings = Number(run.summary?.warning_checks || 0);
                    const criticals = Number(run.summary?.critical_checks || 0);

                    return (
                      <TableRow
                        key={run.id}
                        className={isSelected ? "bg-muted/50 cursor-pointer" : "cursor-pointer"}
                        onClick={() => setSelectedRunId(run.id)}
                      >
                        <TableCell className="text-xs">{formatDateTime(run.started_at)}</TableCell>
                        <TableCell className="text-sm">{triggerLabelMap[run.trigger_source] || run.trigger_source}</TableCell>
                        <TableCell>
                          <Badge variant={statusMeta.variant || "outline"} className={statusMeta.className}>
                            {statusMeta.label}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground">
                          Total: {total} | Alertas: {warnings} | Criticos: {criticals}
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

      <Card>
        <CardHeader>
          <CardTitle>Achados da execucao selecionada</CardTitle>
          <CardDescription>
            Resultado detalhado dos checks de seguranca.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {!selectedRunId ? (
            <p className="text-sm text-muted-foreground">Selecione uma varredura para visualizar os achados.</p>
          ) : loadingFindings ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-5 w-5 animate-spin text-primary" />
            </div>
          ) : findings.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nenhum achado para esta execucao.</p>
          ) : (
            <div className="space-y-3">
              {findings.map((finding) => {
                const severityMeta = severityBadgeMap[finding.severity] || severityBadgeMap.info;
                return (
                  <div key={finding.id} className="rounded-md border p-3">
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge variant={severityMeta.variant || "outline"} className={severityMeta.className}>
                        {severityMeta.label}
                      </Badge>
                      <Badge variant="outline">{statusLabelMap[finding.status] || finding.status}</Badge>
                      <span className="text-xs text-muted-foreground">{finding.check_key}</span>
                    </div>
                    <p className="mt-2 text-sm">{finding.message}</p>
                    {finding.details && Object.keys(finding.details).length > 0 ? (
                      <pre className="mt-2 overflow-auto rounded bg-muted p-2 text-[11px] text-muted-foreground">
                        {JSON.stringify(finding.details, null, 2)}
                      </pre>
                    ) : null}
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default SecurityMonitorPage;

