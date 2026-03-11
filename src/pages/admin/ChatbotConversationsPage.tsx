"use client";

import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2, RefreshCw, Bot, UserRound, Globe, MessageSquareText, PauseCircle, PlayCircle, Send } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/components/auth/AuthProvider";

type ChatMode = "faq" | "ai" | "fallback" | "system" | "human" | null;
type DecisionPath = "faq" | "ai" | "fallback" | "clarify" | null;

type DecisionMeta = {
  intent_detected?: string | null;
  effective_intent?: string | null;
  top_score?: number | null;
  top_public_score?: number | null;
  decision_path?: DecisionPath;
  loop_guard_triggered?: boolean;
};

const CHATBOT_INACTIVITY_CLOSE_MS = 10 * 60 * 1000;

const formatDateTime = (value: string | null | undefined) => {
  if (!value) return "-";
  try {
    return new Date(value).toLocaleString("pt-BR");
  } catch {
    return value;
  }
};

const modeBadge = (mode: ChatMode) => {
  if (mode === "ai") return <Badge className="bg-cyan-600">AI</Badge>;
  if (mode === "faq") return <Badge className="bg-emerald-600">FAQ</Badge>;
  if (mode === "fallback") return <Badge variant="secondary">Fallback</Badge>;
  if (mode === "system") return <Badge variant="outline">System</Badge>;
  if (mode === "human") return <Badge className="bg-indigo-600">Humano</Badge>;
  return <Badge variant="outline">-</Badge>;
};

const decisionPathBadge = (path: DecisionPath) => {
  if (path === "ai") return <Badge className="bg-cyan-600">Path AI</Badge>;
  if (path === "faq") return <Badge className="bg-emerald-600">Path FAQ</Badge>;
  if (path === "clarify") return <Badge className="bg-amber-600">Path Clarify</Badge>;
  if (path === "fallback") return <Badge variant="secondary">Path Fallback</Badge>;
  return null;
};

const parseSafeDate = (value: string | null | undefined) => {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return date;
};

const formatElapsedLabel = (startedAt: string | null | undefined, nowTs: number) => {
  const date = parseSafeDate(startedAt);
  if (!date) return null;

  const diffMs = Math.max(0, nowTs - date.getTime());
  const totalMinutes = Math.floor(diffMs / 60000);
  if (totalMinutes < 1) return "agora";
  if (totalMinutes < 60) return `${totalMinutes} min`;

  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  if (hours < 24) return minutes > 0 ? `${hours}h ${minutes}min` : `${hours}h`;

  const days = Math.floor(hours / 24);
  const remHours = hours % 24;
  return remHours > 0 ? `${days}d ${remHours}h` : `${days}d`;
};

const resolveSlaStyle = (startedAt: string | null | undefined, nowTs: number) => {
  const date = parseSafeDate(startedAt);
  if (!date) {
    return {
      className: "bg-slate-600",
      level: "sem_dado",
      minutes: null as number | null,
    };
  }

  const diffMs = Math.max(0, nowTs - date.getTime());
  const totalMinutes = Math.floor(diffMs / 60000);

  if (totalMinutes <= 10) {
    return { className: "bg-emerald-600", level: "ok", minutes: totalMinutes };
  }
  if (totalMinutes <= 30) {
    return { className: "bg-amber-600", level: "atencao", minutes: totalMinutes };
  }
  return { className: "bg-rose-600", level: "critico", minutes: totalMinutes };
};

const ChatbotConversationsPage = () => {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [savingSessionState, setSavingSessionState] = useState(false);
  const [sendingAdminReply, setSendingAdminReply] = useState(false);
  const [sessions, setSessions] = useState<any[]>([]);
  const [messages, setMessages] = useState<any[]>([]);
  const [profilesMap, setProfilesMap] = useState<Record<string, { full_name?: string | null; email?: string | null }>>(
    {},
  );
  const [selectedSessionId, setSelectedSessionId] = useState<string>("");
  const [adminReply, setAdminReply] = useState("");
  const [search, setSearch] = useState("");
  const [modeFilter, setModeFilter] = useState<string>("all");
  const [nowTick, setNowTick] = useState(() => Date.now());

  const fetchSessions = async () => {
    setLoading(true);
    try {
      const nowIso = new Date().toISOString();
      const inactivityThresholdIso = new Date(Date.now() - CHATBOT_INACTIVITY_CLOSE_MS).toISOString();

      await supabase
        .from("chatbot_sessions")
        .update({
          auto_closed_session: true,
          auto_closed_at: nowIso,
          human_handoff_active: false,
          human_handoff_ended_at: nowIso,
          last_mode: "system",
          updated_at: nowIso,
        } as any)
        .eq("auto_closed_session", false)
        .eq("user_closed_session", false)
        .not("last_user_interaction_at", "is", null)
        .lte("last_user_interaction_at", inactivityThresholdIso);

      await supabase
        .from("chatbot_sessions")
        .update({
          auto_closed_session: true,
          auto_closed_at: nowIso,
          human_handoff_active: false,
          human_handoff_ended_at: nowIso,
          last_mode: "system",
          updated_at: nowIso,
        } as any)
        .eq("auto_closed_session", false)
        .eq("user_closed_session", false)
        .is("last_user_interaction_at", null)
        .lte("updated_at", inactivityThresholdIso);

      const { data, error } = await supabase
        .from("chatbot_sessions")
        .select("id,user_id,visitor_hash,page_path,role_context,last_mode,created_at,updated_at,human_handoff_active,human_handoff_admin_id,human_handoff_admin_name,human_handoff_started_at,human_handoff_ended_at,user_closed_session,user_closed_at,auto_closed_session,auto_closed_at,last_user_interaction_at")
        .order("updated_at", { ascending: false })
        .limit(200);

      if (error) throw error;
      const rows = data || [];
      setSessions(rows);

      const userIds = Array.from(new Set(rows.map((item: any) => item.user_id).filter(Boolean)));
      if (userIds.length > 0) {
        const { data: profilesData, error: profileError } = await supabase
          .from("profiles")
          .select("id,full_name,email")
          .in("id", userIds);
        if (!profileError && profilesData) {
          const nextMap: Record<string, { full_name?: string | null; email?: string | null }> = {};
          for (const profile of profilesData) {
            nextMap[profile.id] = { full_name: profile.full_name, email: profile.email };
          }
          setProfilesMap(nextMap);
        }
      } else {
        setProfilesMap({});
      }

      if (!selectedSessionId && rows.length > 0) {
        setSelectedSessionId(rows[0].id);
      }
      if (selectedSessionId && !rows.some((row: any) => row.id === selectedSessionId)) {
        setSelectedSessionId(rows[0]?.id || "");
      }
    } catch (error) {
      console.error(error);
      toast.error("Erro ao carregar sessões do chatbot.");
    } finally {
      setLoading(false);
    }
  };

  const fetchMessages = async (sessionId: string) => {
    if (!sessionId) {
      setMessages([]);
      return;
    }
    setLoadingMessages(true);
    try {
      const { data, error } = await supabase
        .from("chatbot_messages")
        .select("id,session_id,role,content,mode,sources,decision_meta,created_at")
        .eq("session_id", sessionId)
        .order("created_at", { ascending: true })
        .limit(400);
      if (error) {
        const fallbackNeeded = String((error as any)?.message || "").toLowerCase().includes("decision_meta");
        if (!fallbackNeeded) throw error;

        const { data: fallbackData, error: fallbackError } = await supabase
          .from("chatbot_messages")
          .select("id,session_id,role,content,mode,sources,created_at")
          .eq("session_id", sessionId)
          .order("created_at", { ascending: true })
          .limit(400);
        if (fallbackError) throw fallbackError;
        setMessages((fallbackData || []).map((row) => ({ ...row, decision_meta: null })));
        return;
      }

      setMessages(data || []);
    } catch (error) {
      console.error(error);
      toast.error("Erro ao carregar mensagens da conversa.");
    } finally {
      setLoadingMessages(false);
    }
  };

  const resolveAdminName = async () => {
    if (!user?.id) return "Admin";

    const { data } = await supabase
      .from("profiles")
      .select("full_name,email")
      .eq("id", user.id)
      .maybeSingle();

    return (
      String(data?.full_name || "").trim() ||
      String(data?.email || "").trim() ||
      String(user.user_metadata?.full_name || "").trim() ||
      String(user.email || "").trim() ||
      "Admin"
    );
  };

  const handleAssumeConversation = async () => {
    if (!selectedSessionId || !user?.id) return;
    setSavingSessionState(true);
    try {
      const adminName = await resolveAdminName();
      const now = new Date().toISOString();

      const { error: updateError } = await supabase
        .from("chatbot_sessions")
        .update({
          human_handoff_active: true,
          human_handoff_admin_id: user.id,
          human_handoff_admin_name: adminName,
          human_handoff_started_at: now,
          human_handoff_ended_at: null,
          last_mode: "human",
          updated_at: now,
        } as any)
        .eq("id", selectedSessionId);
      if (updateError) throw updateError;

      await supabase.from("chatbot_messages").insert({
        session_id: selectedSessionId,
        role: "assistant",
        content: `Atendimento humano iniciado por ${adminName}.`,
        mode: "human",
        sources: [],
      } as any);

      toast.success("Conversa assumida pelo admin. Chatbot pausado.");
      await Promise.all([fetchSessions(), fetchMessages(selectedSessionId)]);
    } catch (error) {
      console.error(error);
      toast.error("Erro ao assumir conversa.");
    } finally {
      setSavingSessionState(false);
    }
  };

  const handleResumeBot = async () => {
    if (!selectedSessionId) return;
    setSavingSessionState(true);
    try {
      const now = new Date().toISOString();
      const { error: updateError } = await supabase
        .from("chatbot_sessions")
        .update({
          human_handoff_active: false,
          human_handoff_ended_at: now,
          last_mode: "system",
          updated_at: now,
        } as any)
        .eq("id", selectedSessionId);
      if (updateError) throw updateError;

      await supabase.from("chatbot_messages").insert({
        session_id: selectedSessionId,
        role: "assistant",
        content: "Atendimento humano encerrado. Chatbot automatico reativado.",
        mode: "system",
        sources: [],
      } as any);

      toast.success("Chatbot automatico reativado.");
      await Promise.all([fetchSessions(), fetchMessages(selectedSessionId)]);
    } catch (error) {
      console.error(error);
      toast.error("Erro ao reativar chatbot.");
    } finally {
      setSavingSessionState(false);
    }
  };

  const handleSendAdminReply = async () => {
    if (!selectedSessionId) return;
    const text = String(adminReply || "").trim();
    if (!text) return;

    setSendingAdminReply(true);
    try {
      const now = new Date().toISOString();
      const { error: messageError } = await supabase.from("chatbot_messages").insert({
        session_id: selectedSessionId,
        role: "assistant",
        content: text,
        mode: "human",
        sources: [],
      } as any);
      if (messageError) throw messageError;

      await supabase
        .from("chatbot_sessions")
        .update({
          updated_at: now,
          last_mode: "human",
        } as any)
        .eq("id", selectedSessionId);

      setAdminReply("");
      await Promise.all([fetchSessions(), fetchMessages(selectedSessionId)]);
    } catch (error) {
      console.error(error);
      toast.error("Erro ao enviar resposta manual.");
    } finally {
      setSendingAdminReply(false);
    }
  };

  useEffect(() => {
    fetchSessions();
  }, []);

  useEffect(() => {
    fetchMessages(selectedSessionId);
    setAdminReply("");
  }, [selectedSessionId]);

  useEffect(() => {
    const intervalId = window.setInterval(() => setNowTick(Date.now()), 30000);
    return () => window.clearInterval(intervalId);
  }, []);

  const filteredSessions = useMemo(() => {
    const normalizedSearch = String(search || "").toLowerCase().trim();
    return sessions.filter((session) => {
      if (modeFilter !== "all" && String(session.last_mode || "") !== modeFilter) return false;

      if (!normalizedSearch) return true;
      const profile = session.user_id ? profilesMap[session.user_id] : undefined;
      const haystack = [
        session.id,
        session.user_id,
        session.visitor_hash,
        session.page_path,
        session.role_context,
        session.last_mode,
        profile?.full_name,
        profile?.email,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      return haystack.includes(normalizedSearch);
    });
  }, [sessions, modeFilter, search, profilesMap]);

  const selectedSession = useMemo(
    () => sessions.find((session) => session.id === selectedSessionId) || null,
    [sessions, selectedSessionId],
  );

  const selectedHandoffSlaLabel = formatElapsedLabel(selectedSession?.human_handoff_started_at, nowTick);
  const selectedHandoffSlaStyle = resolveSlaStyle(selectedSession?.human_handoff_started_at, nowTick);

  return (
    <div className="space-y-6">
      <div className="flex flex-col justify-between gap-3 md:flex-row md:items-center">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Conversas do Chatbot</h1>
          <p className="text-muted-foreground">Monitore sessões, modos de resposta e histórico recente.</p>
        </div>
        <Button variant="outline" onClick={fetchSessions} disabled={loading} className="gap-2">
          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
          Atualizar
        </Button>
      </div>

      <div className="grid gap-6 xl:grid-cols-5">
        <Card className="xl:col-span-2">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <Bot className="h-5 w-5 text-primary" />
              Sessões Recentes
            </CardTitle>
            <CardDescription>Selecione uma sessão para abrir a conversa.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
              <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Buscar sessão/usuário..." />
              <Select value={modeFilter} onValueChange={setModeFilter}>
                <SelectTrigger>
                  <SelectValue placeholder="Modo" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos os modos</SelectItem>
                  <SelectItem value="faq">FAQ</SelectItem>
                  <SelectItem value="ai">AI</SelectItem>
                  <SelectItem value="fallback">Fallback</SelectItem>
                  <SelectItem value="human">Humano</SelectItem>
                  <SelectItem value="system">System</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="flex flex-wrap items-center gap-2 text-[11px] text-muted-foreground">
              <span>SLA atendimento humano:</span>
              <Badge className="h-5 bg-emerald-600 px-2 text-[10px]">OK ate 10 min</Badge>
              <Badge className="h-5 bg-amber-600 px-2 text-[10px]">Atencao 11-30 min</Badge>
              <Badge className="h-5 bg-rose-600 px-2 text-[10px]">Critico acima de 30 min</Badge>
            </div>

            <div className="max-h-[620px] overflow-y-auto rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Usuário/Visitante</TableHead>
                    <TableHead>Modo</TableHead>
                    <TableHead>Atualização</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {loading ? (
                    <TableRow>
                      <TableCell colSpan={3} className="py-8 text-center">
                        <Loader2 className="mx-auto h-5 w-5 animate-spin text-muted-foreground" />
                      </TableCell>
                    </TableRow>
                  ) : filteredSessions.length > 0 ? (
                    filteredSessions.map((session) => {
                      const profile = session.user_id ? profilesMap[session.user_id] : undefined;
                      const label = profile?.full_name || profile?.email || (session.user_id ? session.user_id : "Visitante");
                      const slaLabel = formatElapsedLabel(session.human_handoff_started_at, nowTick);
                      const slaStyle = resolveSlaStyle(session.human_handoff_started_at, nowTick);
                      return (
                        <TableRow
                          key={session.id}
                          className={selectedSessionId === session.id ? "bg-primary/5" : ""}
                          onClick={() => setSelectedSessionId(session.id)}
                        >
                          <TableCell className="space-y-1">
                            <div className="flex items-center gap-2">
                              {session.user_id ? (
                                <UserRound className="h-3.5 w-3.5 text-primary" />
                              ) : (
                                <Globe className="h-3.5 w-3.5 text-muted-foreground" />
                              )}
                              <span className="line-clamp-1 text-xs font-medium">{label}</span>
                            </div>
                            {session.human_handoff_active && (
                              <div className="flex flex-wrap items-center gap-1.5">
                                <Badge className="h-5 bg-indigo-600 px-2 text-[10px]">Em atendimento humano</Badge>
                                <Badge className={`h-5 px-2 text-[10px] ${slaStyle.className}`}>SLA: {slaLabel || "-"}</Badge>
                              </div>
                            )}
                            {session.user_closed_session && (
                              <div className="flex flex-wrap items-center gap-1.5">
                                <Badge variant="outline" className="h-5 border-rose-300 px-2 text-[10px] text-rose-700">
                                  Encerrada pelo usuario
                                </Badge>
                              </div>
                            )}
                            {session.auto_closed_session && (
                              <div className="flex flex-wrap items-center gap-1.5">
                                <Badge variant="outline" className="h-5 border-amber-300 px-2 text-[10px] text-amber-700">
                                  Encerrada por inatividade
                                </Badge>
                              </div>
                            )}
                            <p className="line-clamp-1 text-[10px] text-muted-foreground">{session.page_path || "-"}</p>
                          </TableCell>
                          <TableCell>{modeBadge(session.last_mode)}</TableCell>
                          <TableCell className="text-[11px] text-muted-foreground">
                            {formatDateTime(session.updated_at)}
                          </TableCell>
                        </TableRow>
                      );
                    })
                  ) : (
                    <TableRow>
                      <TableCell colSpan={3} className="py-8 text-center text-sm text-muted-foreground">
                        Nenhuma sessão encontrada.
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>

        <Card className="xl:col-span-3">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <MessageSquareText className="h-5 w-5 text-primary" />
              Conversa
            </CardTitle>
            {selectedSession ? (
              <div className="space-y-2">
                <CardDescription>
                  Sessao: <span className="font-mono text-xs">{selectedSession.id}</span> | Ultima atualizacao:{" "}
                  {formatDateTime(selectedSession.updated_at)}
                </CardDescription>
                <div className="flex flex-wrap items-center gap-2">
                  {selectedSession.human_handoff_active ? (
                    <>
                      <Badge className="bg-indigo-600">
                        Atendimento humano
                        {selectedSession.human_handoff_admin_name ? `: ${selectedSession.human_handoff_admin_name}` : ""}
                      </Badge>
                      <Badge className={selectedHandoffSlaStyle.className}>
                        SLA: {selectedHandoffSlaLabel || "-"}
                      </Badge>
                      <Badge variant="outline">
                        Assumida em {formatDateTime(selectedSession.human_handoff_started_at)}
                      </Badge>
                    </>
                  ) : (
                    <Badge variant="outline">Chatbot automatico ativo</Badge>
                  )}
                  {selectedSession.user_closed_session && (
                    <Badge variant="outline" className="border-rose-300 text-rose-700">
                      Encerrada pelo usuario em {formatDateTime(selectedSession.user_closed_at)}
                    </Badge>
                  )}
                  {selectedSession.auto_closed_session && (
                    <Badge variant="outline" className="border-amber-300 text-amber-700">
                      Encerrada por inatividade em {formatDateTime(selectedSession.auto_closed_at)}
                    </Badge>
                  )}
                  {selectedSession.human_handoff_active ? (
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      className="gap-1"
                      onClick={handleResumeBot}
                      disabled={savingSessionState}
                    >
                      {savingSessionState ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <PlayCircle className="h-3.5 w-3.5" />}
                      Reativar chatbot
                    </Button>
                  ) : (
                    <Button
                      type="button"
                      size="sm"
                      className="gap-1 bg-indigo-600 hover:bg-indigo-700"
                      onClick={handleAssumeConversation}
                      disabled={savingSessionState}
                    >
                      {savingSessionState ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <PauseCircle className="h-3.5 w-3.5" />}
                      Assumir conversa
                    </Button>
                  )}
                </div>
              </div>
            ) : (
              <CardDescription>Selecione uma sessao para visualizar o historico.</CardDescription>
            )}
          </CardHeader>
          <CardContent>
            {loadingMessages ? (
              <div className="flex min-h-[420px] items-center justify-center">
                <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
              </div>
            ) : selectedSession ? (
              <div className="space-y-4">
                <div className="max-h-[620px] space-y-3 overflow-y-auto pr-1">
                  {messages.length > 0 ? (
                    messages.map((msg) => (
                      <div
                        key={msg.id}
                        className={`rounded-2xl border px-3 py-2 ${
                          msg.role === "user" ? "ml-10 bg-primary text-primary-foreground" : "mr-10 bg-secondary/40"
                        }`}
                      >
                        <div className="mb-1 flex items-center justify-between gap-2 text-[11px]">
                          <div className="flex items-center gap-2">
                            <span className="font-semibold uppercase">{msg.role}</span>
                            {modeBadge((msg.mode as ChatMode) || null)}
                          </div>
                          <span>{formatDateTime(msg.created_at)}</span>
                        </div>
                        <p className="whitespace-pre-wrap text-sm leading-relaxed">{msg.content}</p>
                        {msg.role === "assistant" &&
                          msg.mode !== "human" &&
                          msg.mode !== "system" &&
                          msg.decision_meta &&
                          typeof msg.decision_meta === "object" && (
                          <div className="mt-2 rounded-lg border bg-background/70 p-2 text-xs text-foreground">
                            <div className="mb-1 flex items-center gap-2">
                              <span className="font-semibold">Decision</span>
                              {decisionPathBadge((msg.decision_meta as DecisionMeta)?.decision_path || null)}
                            </div>
                            <div className="space-y-0.5 text-[11px] text-muted-foreground">
                              <p>intent_detected: {(msg.decision_meta as DecisionMeta)?.intent_detected || "-"}</p>
                              <p>effective_intent: {(msg.decision_meta as DecisionMeta)?.effective_intent || "-"}</p>
                              <p>
                                top_score: {(msg.decision_meta as DecisionMeta)?.top_score ?? "-"} | top_public_score:{" "}
                                {(msg.decision_meta as DecisionMeta)?.top_public_score ?? "-"}
                              </p>
                              <p>
                                loop_guard_triggered:{" "}
                                {(msg.decision_meta as DecisionMeta)?.loop_guard_triggered ? "true" : "false"}
                              </p>
                            </div>
                          </div>
                        )}
                        {Array.isArray(msg.sources) && msg.sources.length > 0 && (
                          <div className="mt-2 rounded-lg border bg-background/70 p-2 text-xs text-foreground">
                            <p className="mb-1 font-semibold">Fontes:</p>
                            <ul className="list-disc space-y-1 pl-4">
                              {msg.sources.slice(0, 4).map((source: any, index: number) => (
                                <li key={`${msg.id}-source-${index}`}>{source?.title || source?.id || "Fonte"}</li>
                              ))}
                            </ul>
                          </div>
                        )}
                      </div>
                    ))
                  ) : (
                    <div className="py-12 text-center text-muted-foreground">Sessao sem mensagens registradas.</div>
                  )}
                </div>

                <div className="space-y-2 border-t pt-3">
                  <p className="text-xs text-muted-foreground">
                    Resposta manual do admin. Assuma a conversa para pausar o chatbot automatico.
                  </p>
                  <div className="flex items-center gap-2">
                    <Input
                      value={adminReply}
                      onChange={(e) => setAdminReply(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" && !e.shiftKey) {
                          e.preventDefault();
                          void handleSendAdminReply();
                        }
                      }}
                      placeholder={
                        selectedSession.human_handoff_active
                          ? "Digite a resposta manual para o usuario..."
                          : "Assuma a conversa para responder manualmente"
                      }
                      disabled={sendingAdminReply || !selectedSession.human_handoff_active}
                    />
                    <Button
                      type="button"
                      onClick={() => void handleSendAdminReply()}
                      disabled={sendingAdminReply || !selectedSession.human_handoff_active || !adminReply.trim()}
                      className="gap-1"
                    >
                      {sendingAdminReply ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                      Enviar
                    </Button>
                  </div>
                </div>
              </div>
            ) : (
              <div className="py-12 text-center text-muted-foreground">Nenhuma sessão selecionada.</div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default ChatbotConversationsPage;
