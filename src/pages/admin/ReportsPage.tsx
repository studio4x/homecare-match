"use client";

import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "@/components/auth/AuthProvider";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { AlertTriangle, Eye, Loader2, PencilLine, Search, ShieldAlert, ShieldCheck, Trash2 } from "lucide-react";

type Severity = "low" | "medium" | "high" | "critical";
type Triage = "pending" | "under_review" | "escalated" | "resolved" | "dismissed";
type AccountStatus = "active" | "under_review" | "suspended";

type ReportRow = {
  id: string;
  reporter_id: string | null;
  reported_id: string;
  reason: string;
  description: string | null;
  status: string | null;
  severity?: Severity | null;
  triage_status?: Triage | null;
  internal_notes?: string | null;
  linked_ticket_id?: string | null;
  safety_hold_applied?: boolean | null;
  safety_hold_reason?: string | null;
  created_at: string;
  reporter?: { full_name?: string | null; email?: string | null; role?: string | null } | null;
  reported?: {
    full_name?: string | null;
    email?: string | null;
    role?: string | null;
    account_status?: AccountStatus | null;
    account_status_reason?: string | null;
  } | null;
};

type EditorState = {
  severity: Severity;
  triageStatus: Triage;
  internalNotes: string;
  linkedTicketId: string;
  safetyHoldReason: string;
};

const severityMeta: Record<Severity, { label: string; className: string }> = {
  low: { label: "Baixa", className: "bg-slate-100 text-slate-800 border-slate-200" },
  medium: { label: "Média", className: "bg-amber-100 text-amber-800 border-amber-200" },
  high: { label: "Alta", className: "bg-orange-100 text-orange-800 border-orange-200" },
  critical: { label: "Crítica", className: "bg-rose-100 text-rose-800 border-rose-200" },
};

const triageMeta: Record<Triage, { label: string; className: string }> = {
  pending: { label: "Pendente", className: "bg-slate-100 text-slate-800 border-slate-200" },
  under_review: { label: "Em revisão", className: "bg-amber-100 text-amber-800 border-amber-200" },
  escalated: { label: "Escalado", className: "bg-rose-100 text-rose-800 border-rose-200" },
  resolved: { label: "Resolvido", className: "bg-emerald-100 text-emerald-800 border-emerald-200" },
  dismissed: { label: "Arquivado", className: "bg-slate-100 text-slate-600 border-slate-200" },
};

const accountMeta: Record<AccountStatus, { label: string; className: string }> = {
  active: { label: "Ativa", className: "bg-emerald-100 text-emerald-800 border-emerald-200" },
  under_review: { label: "Em revisão", className: "bg-amber-100 text-amber-800 border-amber-200" },
  suspended: { label: "Suspensa", className: "bg-rose-100 text-rose-800 border-rose-200" },
};

const normalizeSeverity = (row: ReportRow): Severity => row.severity || "medium";
const normalizeTriage = (row: ReportRow): Triage => {
  if (row.triage_status) return row.triage_status;
  if (row.status === "investigating") return "under_review";
  if (row.status === "resolved") return "resolved";
  if (row.status === "dismissed") return "dismissed";
  return "pending";
};
const toLegacyStatus = (triage: Triage) =>
  triage === "resolved" ? "resolved" : triage === "dismissed" ? "dismissed" : triage === "pending" ? "pending" : "investigating";
const publicHref = (row: ReportRow) => row.reported?.role === "professional" ? `/profissional/${row.reported_id}` : `/recruiter/${row.reported_id}`;

const ReportsPage = () => {
  const { user } = useAuth();
  const [reports, setReports] = useState<ReportRow[]>([]);
  const [tickets, setTickets] = useState<Array<{ id: string; subject: string }>>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [severityFilter, setSeverityFilter] = useState("all");
  const [triageFilter, setTriageFilter] = useState("all");
  const [selected, setSelected] = useState<ReportRow | null>(null);
  const [editor, setEditor] = useState<EditorState | null>(null);
  const [saving, setSaving] = useState(false);
  const [accountLoading, setAccountLoading] = useState(false);

  useEffect(() => {
    void Promise.all([fetchReports(), fetchTickets()]);
  }, []);

  const fetchReports = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("reports")
        .select(`
          *,
          reporter:profiles!reports_reporter_id_fkey(full_name, email, role),
          reported:profiles!reports_reported_id_fkey(full_name, email, role, account_status, account_status_reason)
        `)
        .order("created_at", { ascending: false });
      if (error) throw error;
      setReports((data || []) as ReportRow[]);
    } catch (error) {
      console.error("[ReportsPage] Erro ao carregar denúncias:", error);
      toast.error("Erro ao carregar denúncias.");
    } finally {
      setLoading(false);
    }
  };

  const fetchTickets = async () => {
    try {
      const { data, error } = await supabase.from("support_tickets").select("id, subject").order("created_at", { ascending: false }).limit(200);
      if (error) throw error;
      setTickets((data || []) as Array<{ id: string; subject: string }>);
    } catch (error) {
      console.error("[ReportsPage] Erro ao carregar tickets:", error);
    }
  };

  const openEditor = (row: ReportRow) => {
    setSelected(row);
    setEditor({
      severity: normalizeSeverity(row),
      triageStatus: normalizeTriage(row),
      internalNotes: row.internal_notes || "",
      linkedTicketId: row.linked_ticket_id || "",
      safetyHoldReason: row.safety_hold_reason || row.reported?.account_status_reason || "",
    });
  };

  const closeEditor = () => {
    setSelected(null);
    setEditor(null);
  };

  const saveTriage = async () => {
    if (!selected || !editor) return;
    setSaving(true);
    try {
      const now = new Date().toISOString();
      const { error } = await supabase.from("reports").update({
        severity: editor.severity,
        triage_status: editor.triageStatus,
        internal_notes: editor.internalNotes.trim() || null,
        linked_ticket_id: editor.linkedTicketId || null,
        status: toLegacyStatus(editor.triageStatus),
        triaged_by: user?.id || null,
        triaged_at: now,
      }).eq("id", selected.id);
      if (error) throw error;
      toast.success("Triagem atualizada.");
      await fetchReports();
      closeEditor();
    } catch (error) {
      console.error("[ReportsPage] Erro ao salvar triagem:", error);
      toast.error("Erro ao salvar triagem.");
    } finally {
      setSaving(false);
    }
  };

  const applyAccountAction = async (nextStatus: AccountStatus) => {
    if (!selected || !editor) return;
    if (nextStatus !== "active" && !editor.safetyHoldReason.trim()) {
      toast.error("Informe o motivo da medida cautelar.");
      return;
    }
    setAccountLoading(true);
    try {
      const now = new Date().toISOString();
      const profilePayload = nextStatus === "active"
        ? { account_status: "active", account_status_reason: null, account_status_updated_at: now, account_status_updated_by: user?.id || null }
        : { account_status: nextStatus, account_status_reason: editor.safetyHoldReason.trim(), account_status_updated_at: now, account_status_updated_by: user?.id || null };
      const reportPayload = nextStatus === "suspended"
        ? { triage_status: "escalated", status: toLegacyStatus("escalated"), safety_hold_applied: true, safety_hold_reason: editor.safetyHoldReason.trim(), safety_hold_by: user?.id || null, safety_hold_at: now, triaged_by: user?.id || null, triaged_at: now }
        : nextStatus === "under_review"
        ? { triage_status: "under_review", status: toLegacyStatus("under_review"), safety_hold_applied: false, safety_hold_reason: null, safety_hold_by: null, safety_hold_at: null, triaged_by: user?.id || null, triaged_at: now }
        : { safety_hold_applied: false, safety_hold_reason: null, safety_hold_by: null, safety_hold_at: null, triaged_by: user?.id || null, triaged_at: now };
      const { error: profileError } = await supabase.from("profiles").update(profilePayload).eq("id", selected.reported_id);
      if (profileError) throw profileError;
      const { error: reportError } = await supabase.from("reports").update(reportPayload).eq("id", selected.id);
      if (reportError) throw reportError;
      toast.success(nextStatus === "active" ? "Conta restaurada." : nextStatus === "under_review" ? "Conta marcada em revisão." : "Suspensão cautelar aplicada.");
      await fetchReports();
      closeEditor();
    } catch (error) {
      console.error("[ReportsPage] Erro ao atualizar conta:", error);
      toast.error("Erro ao aplicar medida na conta.");
    } finally {
      setAccountLoading(false);
    }
  };

  const deleteReport = async (id: string) => {
    if (!window.confirm("Deseja excluir este registro de denúncia?")) return;
    try {
      const { error } = await supabase.from("reports").delete().eq("id", id);
      if (error) throw error;
      setReports((current) => current.filter((row) => row.id !== id));
      toast.success("Registro removido.");
    } catch (error) {
      console.error("[ReportsPage] Erro ao excluir denúncia:", error);
      toast.error("Erro ao excluir.");
    }
  };

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return reports.filter((row) => {
      const severity = normalizeSeverity(row);
      const triage = normalizeTriage(row);
      const matchesSeverity = severityFilter === "all" || severity === severityFilter;
      const matchesTriage = triageFilter === "all" || triage === triageFilter;
      const matchesSearch =
        q.length === 0 ||
        (row.reported?.full_name || "").toLowerCase().includes(q) ||
        (row.reporter?.full_name || "").toLowerCase().includes(q) ||
        row.reason.toLowerCase().includes(q) ||
        (row.description || "").toLowerCase().includes(q);
      return matchesSeverity && matchesTriage && matchesSearch;
    });
  }, [reports, search, severityFilter, triageFilter]);

  const pendingCount = filtered.filter((row) => normalizeTriage(row) === "pending").length;
  const criticalCount = filtered.filter((row) => normalizeSeverity(row) === "critical").length;

  if (loading) return <div className="flex justify-center p-8"><Loader2 className="animate-spin text-primary" /></div>;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Denúncias de perfil</h1>
        <p className="text-muted-foreground">Classifique severidade, registre notas internas e aplique revisão ou suspensão manualmente.</p>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <Card><CardContent className="p-5"><p className="text-sm font-semibold">Pendentes</p><p className="mt-1 text-2xl font-bold">{pendingCount}</p></CardContent></Card>
        <Card className={criticalCount > 0 ? "border-rose-200 bg-rose-50/80" : ""}><CardContent className="p-5"><p className="text-sm font-semibold">Críticas</p><p className="mt-1 text-2xl font-bold">{criticalCount}</p></CardContent></Card>
        <Card className="border-primary/10 bg-primary/5"><CardContent className="p-5"><p className="text-sm font-semibold">Regra operacional</p><p className="mt-1 text-sm text-muted-foreground">Nenhuma denúncia gera bloqueio automático. Toda medida cautelar exige ação manual e motivo registrado.</p></CardContent></Card>
      </div>

      <div className="flex flex-col gap-4 xl:flex-row">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input className="pl-10" placeholder="Buscar por perfil, denunciante, motivo ou detalhes..." value={search} onChange={(event) => setSearch(event.target.value)} />
        </div>
        <div className="flex flex-wrap gap-2">
          <Select value={severityFilter} onValueChange={setSeverityFilter}>
            <SelectTrigger className="w-[180px]"><SelectValue placeholder="Severidade" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas as severidades</SelectItem>
              <SelectItem value="low">Baixa</SelectItem>
              <SelectItem value="medium">Média</SelectItem>
              <SelectItem value="high">Alta</SelectItem>
              <SelectItem value="critical">Crítica</SelectItem>
            </SelectContent>
          </Select>
          <Select value={triageFilter} onValueChange={setTriageFilter}>
            <SelectTrigger className="w-[180px]"><SelectValue placeholder="Triagem" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos os status</SelectItem>
              <SelectItem value="pending">Pendente</SelectItem>
              <SelectItem value="under_review">Em revisão</SelectItem>
              <SelectItem value="escalated">Escalado</SelectItem>
              <SelectItem value="resolved">Resolvido</SelectItem>
              <SelectItem value="dismissed">Arquivado</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <Card>
        <CardHeader><CardTitle className="flex items-center gap-2 text-lg"><AlertTriangle className="h-5 w-5 text-destructive" /> Registros de denúncia</CardTitle></CardHeader>
        <CardContent>
          <div className="overflow-hidden rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Denunciado</TableHead>
                  <TableHead>Motivo</TableHead>
                  <TableHead>Severidade</TableHead>
                  <TableHead>Triagem</TableHead>
                  <TableHead>Conta</TableHead>
                  <TableHead>Data</TableHead>
                  <TableHead className="text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.length > 0 ? filtered.map((row) => {
                  const severity = normalizeSeverity(row);
                  const triage = normalizeTriage(row);
                  const accountStatus = row.reported?.account_status || "active";
                  return (
                    <TableRow key={row.id}>
                      <TableCell>
                        <div className="space-y-0.5">
                          <p className="text-sm font-bold">{row.reported?.full_name || "Perfil removido"}</p>
                          <p className="text-[10px] text-muted-foreground">{row.reported?.email}</p>
                          <Badge variant="outline" className="h-4 text-[8px] uppercase">{row.reported?.role || "perfil"}</Badge>
                        </div>
                      </TableCell>
                      <TableCell className="max-w-xs">
                        <p className="text-sm font-semibold text-destructive">{row.reason}</p>
                        <p className="line-clamp-2 text-xs text-muted-foreground">{row.description || "Sem detalhes adicionais."}</p>
                      </TableCell>
                      <TableCell><Badge variant="outline" className={severityMeta[severity].className}>{severityMeta[severity].label}</Badge></TableCell>
                      <TableCell><Badge variant="outline" className={triageMeta[triage].className}>{triageMeta[triage].label}</Badge></TableCell>
                      <TableCell><Badge variant="outline" className={accountMeta[accountStatus].className}>{accountMeta[accountStatus].label}</Badge></TableCell>
                      <TableCell className="text-xs text-muted-foreground">{new Date(row.created_at).toLocaleString("pt-BR")}</TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-1">
                          <Button variant="ghost" size="icon" className="h-8 w-8" asChild><Link to={publicHref(row)} target="_blank"><Eye className="h-4 w-4" /></Link></Button>
                          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openEditor(row)}><PencilLine className="h-4 w-4" /></Button>
                          <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:bg-destructive/10" onClick={() => void deleteReport(row.id)}><Trash2 className="h-4 w-4" /></Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                }) : (
                  <TableRow><TableCell colSpan={7} className="h-32 text-center text-muted-foreground">Nenhuma denúncia encontrada.</TableCell></TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      <Dialog open={Boolean(selected && editor)} onOpenChange={(open) => !open && closeEditor()}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-3xl">
          {selected && editor && (
            <>
              <DialogHeader>
                <DialogTitle>Triagem da denúncia</DialogTitle>
                <DialogDescription>Registre classificação interna, vincule um ticket e aplique medidas cautelares manualmente.</DialogDescription>
              </DialogHeader>

              <div className="grid gap-6 md:grid-cols-2">
                <Card>
                  <CardHeader><CardTitle className="text-base">Resumo do caso</CardTitle></CardHeader>
                  <CardContent className="space-y-4 text-sm">
                    <div><p className="text-xs font-bold uppercase text-muted-foreground">Denunciado</p><p className="font-semibold">{selected.reported?.full_name || "Perfil removido"}</p><p className="text-muted-foreground">{selected.reported?.email || "Sem e-mail"}</p></div>
                    <div><p className="text-xs font-bold uppercase text-muted-foreground">Denunciante</p><p>{selected.reporter?.full_name || "Não identificado"}</p></div>
                    <div><p className="text-xs font-bold uppercase text-muted-foreground">Motivo</p><p className="font-medium text-destructive">{selected.reason}</p><p className="mt-1 whitespace-pre-wrap text-muted-foreground">{selected.description || "Sem detalhes adicionais."}</p></div>
                    <div><p className="text-xs font-bold uppercase text-muted-foreground">Conta atual</p><Badge variant="outline" className={accountMeta[selected.reported?.account_status || "active"].className}>{accountMeta[selected.reported?.account_status || "active"].label}</Badge>{selected.reported?.account_status_reason && <p className="mt-2 text-xs text-muted-foreground">Motivo atual: {selected.reported.account_status_reason}</p>}</div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader><CardTitle className="text-base">Classificação interna</CardTitle></CardHeader>
                  <CardContent className="space-y-4">
                    <div className="grid gap-4 md:grid-cols-2">
                      <div className="space-y-2">
                        <Label>Severidade</Label>
                        <Select value={editor.severity} onValueChange={(value) => setEditor((current) => current ? { ...current, severity: value as Severity } : current)}>
                          <SelectTrigger><SelectValue /></SelectTrigger>
                          <SelectContent><SelectItem value="low">Baixa</SelectItem><SelectItem value="medium">Média</SelectItem><SelectItem value="high">Alta</SelectItem><SelectItem value="critical">Crítica</SelectItem></SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-2">
                        <Label>Status da triagem</Label>
                        <Select value={editor.triageStatus} onValueChange={(value) => setEditor((current) => current ? { ...current, triageStatus: value as Triage } : current)}>
                          <SelectTrigger><SelectValue /></SelectTrigger>
                          <SelectContent><SelectItem value="pending">Pendente</SelectItem><SelectItem value="under_review">Em revisão</SelectItem><SelectItem value="escalated">Escalado</SelectItem><SelectItem value="resolved">Resolvido</SelectItem><SelectItem value="dismissed">Arquivado</SelectItem></SelectContent>
                        </Select>
                      </div>
                    </div>

                    <div className="space-y-2">
                      <Label>Ticket de suporte relacionado</Label>
                      <Select value={editor.linkedTicketId || "none"} onValueChange={(value) => setEditor((current) => current ? { ...current, linkedTicketId: value === "none" ? "" : value } : current)}>
                        <SelectTrigger><SelectValue placeholder="Selecionar ticket opcional" /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="none">Nenhum ticket vinculado</SelectItem>
                          {tickets.map((ticket) => <SelectItem key={ticket.id} value={ticket.id}>{ticket.subject}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="space-y-2">
                      <Label>Notas internas</Label>
                      <Textarea rows={5} placeholder="Resumo da triagem, evidências, decisão e próximos passos." value={editor.internalNotes} onChange={(event) => setEditor((current) => current ? { ...current, internalNotes: event.target.value } : current)} />
                    </div>

                    <div className="space-y-2">
                      <Label>Motivo da medida cautelar</Label>
                      <Textarea rows={3} placeholder="Obrigatório para revisão cautelar ou suspensão." value={editor.safetyHoldReason} onChange={(event) => setEditor((current) => current ? { ...current, safetyHoldReason: event.target.value } : current)} />
                    </div>
                  </CardContent>
                </Card>
              </div>

              <Card className="border-amber-200 bg-amber-50/80">
                <CardContent className="flex flex-col gap-3 p-5 md:flex-row md:items-center md:justify-between">
                  <div className="space-y-1 text-sm text-amber-900">
                    <p className="font-semibold">Ações cautelares manuais</p>
                    <p>Use revisão ou suspensão apenas com motivo registrado. A plataforma não bloqueia perfis automaticamente por denúncia.</p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Button type="button" variant="outline" className="gap-2" onClick={() => void applyAccountAction("under_review")} disabled={accountLoading}><ShieldAlert className="h-4 w-4" /> Marcar em revisão</Button>
                    <Button type="button" variant="destructive" className="gap-2" onClick={() => void applyAccountAction("suspended")} disabled={accountLoading}><ShieldAlert className="h-4 w-4" /> Suspender cautelarmente</Button>
                    <Button type="button" variant="secondary" className="gap-2" onClick={() => void applyAccountAction("active")} disabled={accountLoading}><ShieldCheck className="h-4 w-4" /> Restaurar conta</Button>
                  </div>
                </CardContent>
              </Card>

              <DialogFooter>
                <Button type="button" variant="ghost" onClick={closeEditor}>Cancelar</Button>
                <Button type="button" onClick={() => void saveTriage()} disabled={saving}>{saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}Salvar triagem</Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default ReportsPage;
