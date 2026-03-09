"use client";

import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Loader2, Trash2, MessageSquare, Calendar, Bot, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { useNavigate } from "react-router-dom";

type SuggestionStatus = "new" | "reviewing" | "implemented" | "ignored";

type HumanSuggestion = {
  id: string;
  user_id: string | null;
  content: string;
  created_at: string;
};

type ChatbotQuestionSuggestion = {
  id: string;
  question: string;
  occurrences: number;
  status: SuggestionStatus;
  last_reason: string | null;
  last_page_path: string | null;
  last_user_id: string | null;
  last_asked_at: string;
  first_asked_at: string;
};

type ProfileSnippet = {
  id: string;
  full_name: string | null;
  email: string | null;
  role: string | null;
};

const formatDate = (value: string | null | undefined) => {
  if (!value) return "-";
  try {
    return new Date(value).toLocaleString("pt-BR");
  } catch {
    return value;
  }
};

const statusBadge = (status: SuggestionStatus) => {
  if (status === "implemented") return <Badge className="bg-emerald-600">Implementada</Badge>;
  if (status === "reviewing") return <Badge className="bg-amber-600">Em analise</Badge>;
  if (status === "ignored") return <Badge variant="secondary">Ignorada</Badge>;
  return <Badge className="bg-blue-600">Nova</Badge>;
};

const SuggestionsPage = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [suggestions, setSuggestions] = useState<HumanSuggestion[]>([]);
  const [chatbotSuggestions, setChatbotSuggestions] = useState<ChatbotQuestionSuggestion[]>([]);
  const [profilesMap, setProfilesMap] = useState<Record<string, ProfileSnippet>>({});

  const fetchData = async (silent = false) => {
    if (silent) setRefreshing(true);
    else setLoading(true);

    try {
      const [manualSuggestionsResult, chatbotSuggestionsResult] = await Promise.all([
        supabase
          .from("suggestions")
          .select("id,user_id,content,created_at")
          .order("created_at", { ascending: false })
          .limit(300),
        supabase
          .from("chatbot_unanswered_questions")
          .select("id,question,occurrences,status,last_reason,last_page_path,last_user_id,last_asked_at,first_asked_at")
          .order("last_asked_at", { ascending: false })
          .limit(300),
      ]);

      if (manualSuggestionsResult.error) throw manualSuggestionsResult.error;
      if (chatbotSuggestionsResult.error) throw chatbotSuggestionsResult.error;

      const manualRows = (manualSuggestionsResult.data || []) as HumanSuggestion[];
      const chatbotRows = (chatbotSuggestionsResult.data || []) as ChatbotQuestionSuggestion[];

      setSuggestions(manualRows);
      setChatbotSuggestions(chatbotRows);

      const userIds = Array.from(
        new Set(
          [...manualRows.map((item) => item.user_id), ...chatbotRows.map((item) => item.last_user_id)]
            .filter(Boolean)
            .map((id) => String(id)),
        ),
      );

      if (userIds.length === 0) {
        setProfilesMap({});
        return;
      }

      const { data: profilesData, error: profilesError } = await supabase
        .from("profiles")
        .select("id,full_name,email,role")
        .in("id", userIds);

      if (profilesError) throw profilesError;

      const nextMap: Record<string, ProfileSnippet> = {};
      for (const profile of profilesData || []) {
        nextMap[profile.id] = {
          id: profile.id,
          full_name: profile.full_name,
          email: profile.email,
          role: profile.role,
        };
      }
      setProfilesMap(nextMap);
    } catch (err: any) {
      console.error("[SuggestionsPage] Erro:", err);
      toast.error("Erro ao carregar sugestoes. Clique em Sincronizar Estrutura Base e tente novamente.");
    } finally {
      if (silent) setRefreshing(false);
      else setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleDeleteManualSuggestion = async (id: string) => {
    try {
      const { error } = await supabase.from("suggestions").delete().eq("id", id);
      if (error) throw error;
      setSuggestions((prev) => prev.filter((row) => row.id !== id));
      toast.success("Sugestao removida.");
    } catch (err) {
      console.error(err);
      toast.error("Erro ao excluir sugestao.");
    }
  };

  const handleDeleteChatbotSuggestion = async (id: string) => {
    try {
      const { error } = await supabase.from("chatbot_unanswered_questions").delete().eq("id", id);
      if (error) throw error;
      setChatbotSuggestions((prev) => prev.filter((row) => row.id !== id));
      toast.success("Pergunta removida.");
    } catch (err) {
      console.error(err);
      toast.error("Erro ao excluir pergunta.");
    }
  };

  const handleUpdateChatbotStatus = async (id: string, status: SuggestionStatus) => {
    try {
      const { error } = await supabase.from("chatbot_unanswered_questions").update({ status }).eq("id", id);
      if (error) throw error;
      setChatbotSuggestions((prev) => prev.map((row) => (row.id === id ? { ...row, status } : row)));
    } catch (err) {
      console.error(err);
      toast.error("Erro ao atualizar status da pergunta.");
    }
  };

  const handleCreateFaqFromQuestion = async (row: ChatbotQuestionSuggestion) => {
    try {
      if (row.status === "new") {
        await supabase.from("chatbot_unanswered_questions").update({ status: "reviewing" }).eq("id", row.id);
        setChatbotSuggestions((prev) => prev.map((item) => (item.id === row.id ? { ...item, status: "reviewing" } : item)));
      }
    } catch (error) {
      console.error(error);
    }

    const params = new URLSearchParams();
    params.set("createFromQuestion", row.question);
    params.set("sourceSuggestionId", row.id);
    navigate(`/admin/faq?${params.toString()}`);
  };

  const manualCount = suggestions.length;
  const unansweredCount = chatbotSuggestions.length;

  const sortedChatbotSuggestions = useMemo(
    () => [...chatbotSuggestions].sort((a, b) => Number(b.occurrences || 0) - Number(a.occurrences || 0)),
    [chatbotSuggestions],
  );

  if (loading) {
    return (
      <div className="flex justify-center p-8">
        <Loader2 className="animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Sugestoes e Lacunas do Chatbot</h1>
          <p className="text-muted-foreground">
            Monitore ideias dos usuarios e perguntas que o chatbot nao conseguiu responder.
          </p>
        </div>
        <Button variant="outline" className="gap-2" onClick={() => fetchData(true)} disabled={refreshing}>
          {refreshing ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
          Atualizar
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <MessageSquare className="h-5 w-5 text-primary" />
            Feed de Sugestoes ({manualCount})
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="rounded-md border overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[220px]">Usuario</TableHead>
                  <TableHead>Sugestao</TableHead>
                  <TableHead className="w-[170px]">Data</TableHead>
                  <TableHead className="w-[170px] text-right">Acoes</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {suggestions.length > 0 ? (
                  suggestions.map((row) => {
                    const profile = row.user_id ? profilesMap[row.user_id] : undefined;
                    return (
                      <TableRow key={row.id}>
                        <TableCell>
                          {profile ? (
                            <div className="space-y-0.5">
                              <p className="text-sm font-medium leading-none">{profile.full_name || "Sem nome"}</p>
                              <p className="text-xs text-muted-foreground">{profile.email || "Sem email"}</p>
                              <p className="text-[10px] uppercase font-bold text-primary/70">{profile.role || "-"}</p>
                            </div>
                          ) : (
                            <span className="text-muted-foreground italic text-sm">Anonimo</span>
                          )}
                        </TableCell>
                        <TableCell className="max-w-md">
                          <p className="text-sm whitespace-pre-wrap leading-relaxed">{row.content}</p>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                            <Calendar className="h-3 w-3" />
                            {formatDate(row.created_at)}
                          </div>
                        </TableCell>
                        <TableCell className="text-right">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="text-destructive hover:bg-destructive/10"
                            onClick={() => handleDeleteManualSuggestion(row.id)}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    );
                  })
                ) : (
                  <TableRow>
                    <TableCell colSpan={4} className="h-32 text-center text-muted-foreground">
                      Nenhuma sugestao recebida ainda.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Bot className="h-5 w-5 text-primary" />
            Perguntas sem resposta do chatbot ({unansweredCount})
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="rounded-md border overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[220px]">Ultimo usuario</TableHead>
                  <TableHead>Pergunta</TableHead>
                  <TableHead className="w-[90px] text-center">Ocorrencias</TableHead>
                  <TableHead className="w-[170px]">Ultima vez</TableHead>
                  <TableHead className="w-[160px]">Status</TableHead>
                  <TableHead className="w-[80px] text-right">Acoes</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {sortedChatbotSuggestions.length > 0 ? (
                  sortedChatbotSuggestions.map((row) => {
                    const profile = row.last_user_id ? profilesMap[row.last_user_id] : undefined;
                    return (
                      <TableRow key={row.id}>
                        <TableCell>
                          {profile ? (
                            <div className="space-y-0.5">
                              <p className="text-sm font-medium leading-none">{profile.full_name || "Sem nome"}</p>
                              <p className="text-xs text-muted-foreground">{profile.email || "Sem email"}</p>
                            </div>
                          ) : (
                            <span className="text-muted-foreground italic text-sm">Visitante anonimo</span>
                          )}
                        </TableCell>
                        <TableCell className="max-w-md">
                          <p className="text-sm whitespace-pre-wrap leading-relaxed">{row.question}</p>
                          <div className="mt-1 flex flex-wrap gap-2 text-[11px] text-muted-foreground">
                            <span>Origem: {row.last_reason === "ai_out_of_scope" ? "AI sem contexto" : "Baixa confianca"}</span>
                            {row.last_page_path ? <span>Pagina: {row.last_page_path}</span> : null}
                          </div>
                        </TableCell>
                        <TableCell className="text-center">
                          <span className="font-semibold">{row.occurrences}</span>
                        </TableCell>
                        <TableCell>
                          <div className="space-y-1 text-xs text-muted-foreground">
                            <div>{formatDate(row.last_asked_at)}</div>
                            <div>Primeira: {formatDate(row.first_asked_at)}</div>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="space-y-2">
                            {statusBadge(row.status)}
                            <Select
                              value={row.status}
                              onValueChange={(value) => handleUpdateChatbotStatus(row.id, value as SuggestionStatus)}
                            >
                              <SelectTrigger className="h-8 text-xs">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="new">Nova</SelectItem>
                                <SelectItem value="reviewing">Em analise</SelectItem>
                                <SelectItem value="implemented">Implementada</SelectItem>
                                <SelectItem value="ignored">Ignorada</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-1">
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-8 text-primary hover:bg-primary/10"
                              onClick={() => handleCreateFaqFromQuestion(row)}
                            >
                              Criar FAQ
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="text-destructive hover:bg-destructive/10"
                              onClick={() => handleDeleteChatbotSuggestion(row.id)}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })
                ) : (
                  <TableRow>
                    <TableCell colSpan={6} className="h-32 text-center text-muted-foreground">
                      Nenhuma lacuna de pergunta registrada pelo chatbot.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default SuggestionsPage;
