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
import { Loader2, RefreshCw, Bot, UserRound, Globe, MessageSquareText } from "lucide-react";
import { toast } from "sonner";

type ChatMode = "faq" | "ai" | "fallback" | "system" | null;

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
  return <Badge variant="outline">-</Badge>;
};

const ChatbotConversationsPage = () => {
  const [loading, setLoading] = useState(true);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [sessions, setSessions] = useState<any[]>([]);
  const [messages, setMessages] = useState<any[]>([]);
  const [profilesMap, setProfilesMap] = useState<Record<string, { full_name?: string | null; email?: string | null }>>(
    {},
  );
  const [selectedSessionId, setSelectedSessionId] = useState<string>("");
  const [search, setSearch] = useState("");
  const [modeFilter, setModeFilter] = useState<string>("all");

  const fetchSessions = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("chatbot_sessions")
        .select("id,user_id,visitor_hash,page_path,role_context,last_mode,created_at,updated_at")
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
        .select("id,session_id,role,content,mode,sources,created_at")
        .eq("session_id", sessionId)
        .order("created_at", { ascending: true })
        .limit(400);
      if (error) throw error;
      setMessages(data || []);
    } catch (error) {
      console.error(error);
      toast.error("Erro ao carregar mensagens da conversa.");
    } finally {
      setLoadingMessages(false);
    }
  };

  useEffect(() => {
    fetchSessions();
  }, []);

  useEffect(() => {
    fetchMessages(selectedSessionId);
  }, [selectedSessionId]);

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
                  <SelectItem value="system">System</SelectItem>
                </SelectContent>
              </Select>
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
              <CardDescription>
                Sessão: <span className="font-mono text-xs">{selectedSession.id}</span> | Última atualização:{" "}
                {formatDateTime(selectedSession.updated_at)}
              </CardDescription>
            ) : (
              <CardDescription>Selecione uma sessão para visualizar o histórico.</CardDescription>
            )}
          </CardHeader>
          <CardContent>
            {loadingMessages ? (
              <div className="flex min-h-[420px] items-center justify-center">
                <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
              </div>
            ) : selectedSession ? (
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
                        <span className="font-semibold uppercase">{msg.role}</span>
                        <span>{formatDateTime(msg.created_at)}</span>
                      </div>
                      <p className="whitespace-pre-wrap text-sm leading-relaxed">{msg.content}</p>
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
                  <div className="py-12 text-center text-muted-foreground">Sessão sem mensagens registradas.</div>
                )}
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
