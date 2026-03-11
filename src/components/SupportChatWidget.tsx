"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { MessageCircle, X, Send, Loader2, Bot, Minus, Maximize2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useSiteConfig } from "@/hooks/use-site-config";
import { useAuth } from "@/components/auth/AuthProvider";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";

interface SupportChatWidgetProps {
  context?: "public" | "dashboard";
}

type ChatMode = "faq" | "ai" | "fallback" | "human" | "system";

type SourceItem = {
  id: string;
  type: string;
  title: string;
  route?: string;
  snippet?: string;
  score?: number;
};

type ActionItem = {
  type: string;
  label: string;
  url: string;
};

type ChatMessage = {
  id: string;
  role: "user" | "assistant";
  content: string;
  mode?: ChatMode;
  sources?: SourceItem[];
  actions?: ActionItem[];
  createdAt?: string;
};

const VISITOR_ID_KEY = "hcm_chatbot_visitor_id";
const MAX_LOCAL_MESSAGES = 60;
const LINK_PATTERN = /(https?:\/\/[^\s]+)/g;
const TRAILING_PUNCTUATION_PATTERN = /[.,;:!?)]$/;

const createMessageId = () => `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;

const getOrCreateVisitorId = () => {
  const current = window.localStorage.getItem(VISITOR_ID_KEY);
  if (current) return current;
  const created = window.crypto?.randomUUID?.() || `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  window.localStorage.setItem(VISITOR_ID_KEY, created);
  return created;
};

const normalizeLoadedMessages = (raw: unknown): ChatMessage[] => {
  if (!Array.isArray(raw)) return [];
  return raw
    .filter((item) => item && typeof item === "object")
    .map((item: any) => ({
      id: String(item.id || createMessageId()),
      role: item.role === "user" ? "user" : "assistant",
      content: String(item.content || ""),
      mode: item.mode,
      sources: Array.isArray(item.sources) ? item.sources : [],
      actions: Array.isArray(item.actions) ? item.actions : [],
      createdAt: typeof item.createdAt === "string" ? item.createdAt : typeof item.created_at === "string" ? item.created_at : undefined,
    }))
    .filter((item) => item.content.trim().length > 0)
    .slice(-MAX_LOCAL_MESSAGES);
};

const splitTrailingPunctuation = (value: string) => {
  let clean = String(value || "");
  let suffix = "";

  while (clean.length > 1 && TRAILING_PUNCTUATION_PATTERN.test(clean)) {
    suffix = clean.slice(-1) + suffix;
    clean = clean.slice(0, -1);
  }

  return { clean, suffix };
};

const extractFirstName = (value: string | null | undefined) => {
  const normalized = String(value || "")
    .normalize("NFKC")
    .replace(/[\u0000-\u001f\u007f]/g, " ")
    .replace(/[._-]+/g, " ")
    .replace(/[^\p{L}\p{M}\s'`-]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
  if (!normalized) return "";

  const [rawFirst = ""] = normalized.split(" ");
  const first = rawFirst
    .replace(/['`-]+$/g, "")
    .replace(/^['`-]+/g, "")
    .slice(0, 40);
  if (!first) return "";

  return first.charAt(0).toLocaleUpperCase("pt-BR") + first.slice(1).toLocaleLowerCase("pt-BR");
};

const buildWelcomeMessage = (baseMessage: string, firstName: string) => {
  const base = String(baseMessage || "").trim();
  if (!firstName) return base;
  if (!base) return `Ola, ${firstName}!`;
  if (/^ola[!,\s]/i.test(base)) return base.replace(/^ola[!,\s]*/i, `Ola, ${firstName}! `);
  return `Ola, ${firstName}! ${base}`;
};

const getModeBadge = (mode?: ChatMode) => {
  if (mode === "ai") return { label: "Resposta por IA", className: "bg-blue-600 hover:bg-blue-600 text-white" };
  if (mode === "faq") return { label: "Resposta por FAQ", className: "bg-emerald-600 hover:bg-emerald-600 text-white" };
  if (mode === "fallback") return { label: "Resposta fallback", className: "bg-amber-600 hover:bg-amber-600 text-white" };
  if (mode === "human") return { label: "Atendimento Humano", className: "bg-indigo-600 hover:bg-indigo-600 text-white" };
  if (mode === "system") return { label: "Mensagem do Sistema", className: "bg-slate-600 hover:bg-slate-600 text-white" };
  return null;
};

const SupportChatWidget = ({ context = "public" }: SupportChatWidgetProps) => {
  const { data: siteConfig } = useSiteConfig();
  const { user } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const [open, setOpen] = useState(false);
  const [isMinimized, setIsMinimized] = useState(false);
  const [input, setInput] = useState("");
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [conversationStarted, setConversationStarted] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [isSlowThinking, setIsSlowThinking] = useState(false);
  const [sessionId, setSessionId] = useState<string>("");
  const [handoffActive, setHandoffActive] = useState(false);
  const [handoffAdminName, setHandoffAdminName] = useState("");
  const [visitorId, setVisitorId] = useState<string>("");
  const [roleContext, setRoleContext] = useState<string | null>(null);
  const [userFirstName, setUserFirstName] = useState("");
  const [storageReady, setStorageReady] = useState(false);
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const lastSyncedAtRef = useRef<string>("");

  const chatbotEnabled = siteConfig?.chatbot_enabled ?? true;
  const showModeBadge = siteConfig?.chatbot_show_mode_badge ?? false;
  const welcomeMessage =
    siteConfig?.chatbot_welcome_message ||
    "Ola! Sou o assistente da plataforma. Posso ajudar com funcionalidades e como usar cada recurso.";
  const fallbackErrorMessage =
    siteConfig?.chatbot_error_message ||
    "Nao consegui responder agora. Tente novamente em instantes ou abra um chamado no suporte.";
  const thinkingMessage = isSlowThinking
    ? "Ainda estou analisando nossos documentos. Quase pronto..."
    : "Estou lendo nossos documentos para te responder...";
  const personalizedWelcomeMessage = useMemo(
    () => buildWelcomeMessage(welcomeMessage, userFirstName),
    [welcomeMessage, userFirstName],
  );

  const floatingPositionClass =
    context === "dashboard" ? "bottom-36 md:bottom-6 right-5 md:right-6" : "bottom-24 md:bottom-6 right-5 md:right-6";

  const actorKey = useMemo(() => user?.id || "anon", [user?.id]);
  const storageSessionKey = useMemo(() => `hcm_chatbot_session:${actorKey}`, [actorKey]);
  const storageMessagesKey = useMemo(() => `hcm_chatbot_messages:${actorKey}`, [actorKey]);
  const storageStartedKey = useMemo(() => `hcm_chatbot_started:${actorKey}`, [actorKey]);

  const appendMessage = (message: ChatMessage) => {
    setMessages((prev) => [...prev, message].slice(-MAX_LOCAL_MESSAGES));
  };

  const resetConversationLocally = useCallback(() => {
    setConversationStarted(false);
    setMessages([]);
    setSessionId("");
    setHandoffActive(false);
    setHandoffAdminName("");
    lastSyncedAtRef.current = "";
    setInput("");
    setIsSending(false);
  }, []);

  const mergeIncomingAssistantMessages = (incoming: ChatMessage[]) => {
    if (!Array.isArray(incoming) || incoming.length === 0) return;

    setMessages((prev) => {
      const existingIds = new Set(prev.map((msg) => msg.id));
      const next = [...prev];
      for (const msg of incoming) {
        if (!msg?.id || existingIds.has(msg.id)) continue;
        existingIds.add(msg.id);
        next.push(msg);
      }
      return next.slice(-MAX_LOCAL_MESSAGES);
    });
  };

  useEffect(() => {
    if (typeof window === "undefined") return;
    const id = getOrCreateVisitorId();
    setVisitorId(id);
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;

    try {
      const savedSessionId = window.localStorage.getItem(storageSessionKey) || "";
      setSessionId(savedSessionId);

      const savedRaw = window.localStorage.getItem(storageMessagesKey);
      const savedStarted = window.localStorage.getItem(storageStartedKey) === "1";

      if (savedRaw) {
        const parsed = JSON.parse(savedRaw);
        const loadedMessages = normalizeLoadedMessages(parsed);
        setMessages(loadedMessages);
        const latestCreatedAt =
          loadedMessages
            .map((msg) => msg.createdAt)
            .filter((value): value is string => typeof value === "string" && value.length > 0)
            .sort()
            .slice(-1)[0] || "";
        lastSyncedAtRef.current = latestCreatedAt;
        setConversationStarted(savedStarted || loadedMessages.length > 0 || !!savedSessionId);
      } else {
        setMessages([]);
        lastSyncedAtRef.current = "";
        setConversationStarted(savedStarted || !!savedSessionId);
      }
    } catch (_err) {
      setMessages([]);
      lastSyncedAtRef.current = "";
      setConversationStarted(false);
    } finally {
      setStorageReady(true);
    }
  }, [storageSessionKey, storageMessagesKey, storageStartedKey]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!storageReady) return;
    try {
      if (messages.length > 0) {
        window.localStorage.setItem(storageMessagesKey, JSON.stringify(messages.slice(-MAX_LOCAL_MESSAGES)));
      } else {
        window.localStorage.removeItem(storageMessagesKey);
      }
    } catch (_err) {
      // ignore storage quota errors
    }
  }, [messages, storageMessagesKey, storageReady]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!storageReady) return;
    try {
      if (sessionId) window.localStorage.setItem(storageSessionKey, sessionId);
      else window.localStorage.removeItem(storageSessionKey);
    } catch (_err) {
      // ignore
    }
  }, [sessionId, storageSessionKey, storageReady]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!storageReady) return;
    try {
      if (conversationStarted) window.localStorage.setItem(storageStartedKey, "1");
      else window.localStorage.removeItem(storageStartedKey);
    } catch (_err) {
      // ignore
    }
  }, [conversationStarted, storageStartedKey, storageReady]);

  useEffect(() => {
    const fetchRole = async () => {
      if (!user?.id) {
        setRoleContext(null);
        setUserFirstName("");
        return;
      }
      const { data } = await supabase.from("profiles").select("role,full_name").eq("id", user.id).maybeSingle();
      setRoleContext(data?.role || null);

      const metadataName =
        String(user.user_metadata?.full_name || user.user_metadata?.name || "").trim() ||
        String(user.email || "")
          .split("@")[0]
          .replace(/[._-]+/g, " ")
          .trim();
      const resolvedName = extractFirstName(data?.full_name || metadataName);
      setUserFirstName(resolvedName);
    };
    fetchRole();
  }, [user?.id, user?.email, user?.user_metadata]);

  useEffect(() => {
    if (!scrollRef.current) return;
    scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [messages, open, isSending, isMinimized, conversationStarted]);

  useEffect(() => {
    const latestCreatedAt =
      messages
        .map((msg) => msg.createdAt)
        .filter((value): value is string => typeof value === "string" && value.length > 0)
        .sort()
        .slice(-1)[0] || "";
    if (latestCreatedAt) lastSyncedAtRef.current = latestCreatedAt;
  }, [messages]);

  useEffect(() => {
    if (!isSending) {
      setIsSlowThinking(false);
      return;
    }

    setIsSlowThinking(false);
    const timeoutId = window.setTimeout(() => {
      setIsSlowThinking(true);
    }, 10_000);

    return () => window.clearTimeout(timeoutId);
  }, [isSending]);

  useEffect(() => {
    if (!open || !conversationStarted || !sessionId) return;

    let cancelled = false;

    const syncMessages = async () => {
      try {
        const { data, error } = await supabase.functions.invoke("support-chatbot-sync", {
          body: {
            session_id: sessionId,
            after: lastSyncedAtRef.current || undefined,
          },
          headers: {
            "x-chatbot-visitor-id": visitorId,
          },
        });

        if (cancelled || error) return;

        if (typeof data?.handoff_active === "boolean") {
          setHandoffActive(!!data.handoff_active);
          setHandoffAdminName(String(data?.handoff_admin_name || "").trim());
        }

        if (data?.session_closed) {
          resetConversationLocally();
          return;
        }

        const incomingRows = Array.isArray(data?.messages) ? data.messages : [];
        if (incomingRows.length > 0) {
          const incomingMessages = incomingRows
            .filter((row: any) => row?.id && row?.role === "assistant" && String(row?.content || "").trim().length > 0)
            .map((row: any) => ({
              id: String(row.id),
              role: "assistant" as const,
              content: String(row.content || ""),
              mode: (String(row.mode || "fallback") as ChatMode) || "fallback",
              sources: Array.isArray(row.sources) ? row.sources : [],
              actions: [],
              createdAt: typeof row.created_at === "string" ? row.created_at : new Date().toISOString(),
            }));

          mergeIncomingAssistantMessages(incomingMessages);
        }
      } catch (_err) {
        // silent sync errors; send flow remains primary path
      }
    };

    void syncMessages();
    const intervalId = window.setInterval(() => {
      void syncMessages();
    }, 4000);

    return () => {
      cancelled = true;
      window.clearInterval(intervalId);
    };
  }, [open, conversationStarted, sessionId, visitorId, resetConversationLocally]);

  const handleActionClick = (action: ActionItem) => {
    if (!action?.url) return;
    navigate(action.url);
    setOpen(false);
    setIsMinimized(false);
  };

  const renderMessageWithLinks = (content: string): ReactNode[] => {
    const lines = String(content || "").split("\n");
    const nodes: ReactNode[] = [];
    let nodeIndex = 0;

    for (let lineIndex = 0; lineIndex < lines.length; lineIndex += 1) {
      const line = lines[lineIndex];
      let lastIndex = 0;

      for (const match of line.matchAll(LINK_PATTERN)) {
        const rawToken = match[0];
        const startIndex = match.index ?? 0;
        if (startIndex > lastIndex) {
          nodes.push(line.slice(lastIndex, startIndex));
        }

        const { clean, suffix } = splitTrailingPunctuation(rawToken);
        if (/^https?:\/\//i.test(clean)) {
          nodes.push(
            <a
              key={`msg-link-${nodeIndex++}`}
              href={clean}
              target="_blank"
              rel="noreferrer noopener"
              className="underline underline-offset-2 hover:opacity-80"
            >
              {clean}
            </a>,
          );
        } else {
          nodes.push(rawToken);
        }

        if (suffix) nodes.push(suffix);
        lastIndex = startIndex + rawToken.length;
      }

      if (lastIndex < line.length) {
        nodes.push(line.slice(lastIndex));
      }

      if (lineIndex < lines.length - 1) {
        nodes.push(<br key={`msg-br-${nodeIndex++}`} />);
      }
    }

    return nodes;
  };

  const handleStartConversation = () => {
    setConversationStarted(true);
    if (messages.length === 0) {
      appendMessage({
        id: createMessageId(),
        role: "assistant",
        content: personalizedWelcomeMessage,
        createdAt: new Date().toISOString(),
      });
    }
  };

  const handleEndConversation = async () => {
    const sessionToClose = sessionId;
    const visitorHeader = visitorId;

    if (sessionToClose) {
      try {
        await supabase.functions.invoke("support-chatbot-close-session", {
          body: { session_id: sessionToClose },
          headers: {
            "x-chatbot-visitor-id": visitorHeader,
          },
        });
      } catch (error) {
        console.error("[SupportChatWidget] erro ao encerrar sessao:", error);
      }
    }

    resetConversationLocally();
  };

  const sendMessage = async () => {
    const text = input.trim();
    if (!conversationStarted || !text || isSending) return;

    appendMessage({
      id: createMessageId(),
      role: "user",
      content: text,
      createdAt: new Date().toISOString(),
    });
    setInput("");
    setIsSending(true);

    try {
      const { data, error } = await supabase.functions.invoke("support-chatbot-ask", {
        body: {
          session_id: sessionId || undefined,
          message: text,
          page_path: location.pathname,
          role_context: roleContext || undefined,
        },
        headers: {
          "x-chatbot-visitor-id": visitorId,
        },
      });

      if (error) {
        throw new Error(error.message || "Falha ao consultar chatbot.");
      }

      const nextSessionId = String(data?.session_id || "");
      if (nextSessionId) setSessionId(nextSessionId);
      if (typeof data?.handoff_active === "boolean") {
        setHandoffActive(!!data.handoff_active);
        setHandoffAdminName(String(data?.handoff_admin_name || "").trim());
      }

      appendMessage({
        id: createMessageId(),
        role: "assistant",
        content: String(data?.answer || fallbackErrorMessage),
        mode: (String(data?.mode || "fallback") as ChatMode) || "fallback",
        sources: Array.isArray(data?.sources) ? data.sources : [],
        actions: Array.isArray(data?.suggested_actions) ? data.suggested_actions : [],
        createdAt: new Date().toISOString(),
      });
    } catch (error) {
      console.error("[SupportChatWidget] erro:", error);
      appendMessage({
        id: createMessageId(),
        role: "assistant",
        content: fallbackErrorMessage,
        mode: "fallback",
        actions: user
          ? [
              { type: "link", label: "Ver FAQ", url: "/suporte" },
              { type: "link", label: "Abrir chamado", url: "/dashboard/suporte?openTicketModal=1&ticketStep=form" },
            ]
          : [
              { type: "link", label: "Ver FAQ", url: "/suporte" },
              { type: "link", label: "Entrar para abrir chamado", url: "/login" },
            ],
        createdAt: new Date().toISOString(),
      });
    } finally {
      setIsSending(false);
    }
  };

  if (!chatbotEnabled) return null;

  return (
    <div className={cn("fixed z-[70]", floatingPositionClass)}>
      {open ? (
        <div
          className={cn(
            "flex w-[92vw] max-w-[390px] flex-col overflow-hidden rounded-2xl border bg-card shadow-2xl",
            isMinimized ? "h-auto" : "h-[560px]",
          )}
        >
          <div className="flex items-center justify-between border-b bg-primary px-4 py-3 text-primary-foreground">
            <div className="flex items-center gap-2">
              <Bot className="h-4 w-4" />
              <span className="text-sm font-semibold">Assistente da Plataforma</span>
            </div>
            <div className="flex items-center gap-1">
              {conversationStarted && (
                <button
                  onClick={handleEndConversation}
                  className="rounded-md px-2 py-1 text-[11px] font-medium hover:bg-white/20"
                  aria-label="Encerrar conversa"
                  title="Encerrar conversa"
                >
                  Encerrar
                </button>
              )}
              <button
                onClick={() => setIsMinimized((prev) => !prev)}
                className="inline-flex h-7 w-7 items-center justify-center rounded-full hover:bg-white/20"
                aria-label={isMinimized ? "Expandir chat" : "Minimizar chat"}
                title={isMinimized ? "Expandir" : "Minimizar"}
              >
                {isMinimized ? <Maximize2 className="h-4 w-4" /> : <Minus className="h-4 w-4" />}
              </button>
              <button
                onClick={() => {
                  setOpen(false);
                  setIsMinimized(false);
                }}
                className="inline-flex h-7 w-7 items-center justify-center rounded-full hover:bg-white/20"
                aria-label="Fechar chat"
                title="Fechar"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          </div>

          {!isMinimized && (
            <>
              {conversationStarted ? (
                <>
                  <div ref={scrollRef} className="flex-1 overflow-y-auto">
                    <div className="space-y-3 p-3">
                      {handoffActive && (
                        <div className="rounded-xl border border-indigo-200 bg-indigo-50 px-3 py-2 text-xs text-indigo-700">
                          Atendimento humano ativo
                          {handoffAdminName ? ` com ${handoffAdminName}` : ""}. O chatbot automatico esta pausado.
                        </div>
                      )}

                      {messages.map((message) => (
                        <div
                          key={message.id}
                          className={cn("flex", message.role === "user" ? "justify-end" : "justify-start")}
                        >
                          <div
                            className={cn(
                              "max-w-[90%] rounded-2xl px-3 py-2 text-sm shadow-sm",
                              message.role === "user"
                                ? "rounded-br-sm bg-primary text-primary-foreground"
                                : "rounded-bl-sm border bg-secondary/40 text-foreground",
                            )}
                          >
                            {message.role === "assistant" && showModeBadge && message.mode && (
                              <div className="mb-2">
                                {(() => {
                                  const modeBadge = getModeBadge(message.mode);
                                  if (!modeBadge) return null;
                                  return <Badge className={cn("h-5 px-2 text-[10px] font-semibold", modeBadge.className)}>{modeBadge.label}</Badge>;
                                })()}
                              </div>
                            )}
                            <p className="leading-relaxed">{renderMessageWithLinks(message.content)}</p>

                            {message.actions && message.actions.length > 0 && (
                              <div className="mt-2 flex flex-wrap gap-1.5 border-t border-border/60 pt-2">
                                {message.actions.map((action, index) => (
                                  <Button
                                    key={`${message.id}-action-${index}`}
                                    type="button"
                                    size="sm"
                                    variant="outline"
                                    className="h-7 text-[11px]"
                                    onClick={() => handleActionClick(action)}
                                  >
                                    {action.label}
                                  </Button>
                                ))}
                              </div>
                            )}
                          </div>
                        </div>
                      ))}

                      {isSending && (
                        <div className="flex justify-start">
                          <div className="max-w-[90%] rounded-2xl rounded-bl-sm border bg-secondary/40 px-3 py-2 text-xs text-muted-foreground">
                            <div className="flex items-start gap-2">
                              <Loader2 className="mt-0.5 h-3.5 w-3.5 animate-spin shrink-0" />
                              <span className="leading-relaxed">{thinkingMessage}</span>
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="border-t p-2.5">
                    <div className="flex items-center gap-2">
                      <Input
                        value={input}
                        onChange={(e) => setInput(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter" && !e.shiftKey) {
                            e.preventDefault();
                            sendMessage();
                          }
                        }}
                        placeholder={
                          handoffActive
                            ? "Envie sua mensagem para o atendimento humano..."
                            : "Pergunte sobre funcionalidades..."
                        }
                        disabled={isSending}
                      />
                      <Button size="icon" onClick={sendMessage} disabled={isSending || !input.trim()}>
                        {isSending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                      </Button>
                    </div>
                  </div>
                </>
              ) : (
                <div className="flex flex-1 flex-col items-center justify-center gap-4 px-5 text-center">
                  <Bot className="h-10 w-10 text-primary" />
                  <div className="space-y-2">
                    <p className="text-base font-semibold">Assistente da Plataforma</p>
                    <p className="text-sm text-muted-foreground">{personalizedWelcomeMessage}</p>
                  </div>
                  <Button onClick={handleStartConversation} className="w-full">
                    Iniciar conversa
                  </Button>
                  <p className="text-[11px] text-muted-foreground">
                    Depois de iniciar, voce podera enviar mensagens normalmente.
                  </p>
                </div>
              )}
            </>
          )}
        </div>
      ) : (
        <button
          onClick={() => {
            setOpen(true);
            setIsMinimized(false);
          }}
          className="relative flex h-14 w-14 items-center justify-center rounded-full border border-emerald-300 bg-emerald-500 text-white shadow-2xl transition-transform hover:bg-emerald-600 active:scale-95"
          aria-label="Abrir assistente da plataforma"
        >
          <MessageCircle className="h-6 w-6" />
        </button>
      )}
    </div>
  );
};

export default SupportChatWidget;
