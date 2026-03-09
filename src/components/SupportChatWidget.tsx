"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { MessageCircle, X, Send, Loader2, Bot, ExternalLink, Minus, Maximize2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useSiteConfig } from "@/hooks/use-site-config";
import { useAuth } from "@/components/auth/AuthProvider";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

interface SupportChatWidgetProps {
  context?: "public" | "dashboard";
}

type ChatMode = "faq" | "ai" | "fallback";

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
};

const VISITOR_ID_KEY = "hcm_chatbot_visitor_id";
const MAX_LOCAL_MESSAGES = 60;

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
    }))
    .filter((item) => item.content.trim().length > 0)
    .slice(-MAX_LOCAL_MESSAGES);
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
  const [isSending, setIsSending] = useState(false);
  const [sessionId, setSessionId] = useState<string>("");
  const [visitorId, setVisitorId] = useState<string>("");
  const [roleContext, setRoleContext] = useState<string | null>(null);
  const [storageReady, setStorageReady] = useState(false);
  const scrollRef = useRef<HTMLDivElement | null>(null);

  const chatbotEnabled = siteConfig?.chatbot_enabled ?? true;
  const welcomeMessage =
    siteConfig?.chatbot_welcome_message ||
    "Ola! Sou o assistente da plataforma. Posso ajudar com funcionalidades e como usar cada recurso.";
  const fallbackErrorMessage =
    siteConfig?.chatbot_error_message ||
    "Nao consegui responder agora. Tente novamente em instantes ou abra um chamado no suporte.";

  const floatingPositionClass =
    context === "dashboard" ? "bottom-36 md:bottom-6 right-5 md:right-6" : "bottom-24 md:bottom-6 right-5 md:right-6";

  const actorKey = useMemo(() => user?.id || "anon", [user?.id]);
  const storageSessionKey = useMemo(() => `hcm_chatbot_session:${actorKey}`, [actorKey]);
  const storageMessagesKey = useMemo(() => `hcm_chatbot_messages:${actorKey}`, [actorKey]);

  const appendMessage = (message: ChatMessage) => {
    setMessages((prev) => [...prev, message].slice(-MAX_LOCAL_MESSAGES));
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
      if (savedRaw) {
        const parsed = JSON.parse(savedRaw);
        setMessages(normalizeLoadedMessages(parsed));
      } else {
        setMessages([]);
      }
    } catch (_err) {
      setMessages([]);
    } finally {
      setStorageReady(true);
    }
  }, [storageSessionKey, storageMessagesKey]);

  useEffect(() => {
    if (!storageReady) return;
    if (!welcomeMessage) return;
    if (messages.length > 0) return;
    setMessages([
      {
        id: createMessageId(),
        role: "assistant",
        content: welcomeMessage,
        mode: "faq",
      },
    ]);
  }, [storageReady, welcomeMessage, messages.length]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!storageReady) return;
    try {
      window.localStorage.setItem(storageMessagesKey, JSON.stringify(messages.slice(-MAX_LOCAL_MESSAGES)));
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
    const fetchRole = async () => {
      if (!user?.id) {
        setRoleContext(null);
        return;
      }
      const { data } = await supabase.from("profiles").select("role").eq("id", user.id).maybeSingle();
      setRoleContext(data?.role || null);
    };
    fetchRole();
  }, [user?.id]);

  useEffect(() => {
    if (!scrollRef.current) return;
    scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [messages, open, isSending, isMinimized]);

  const handleActionClick = (action: ActionItem) => {
    if (!action?.url) return;
    navigate(action.url);
    setOpen(false);
    setIsMinimized(false);
  };

  const sendMessage = async () => {
    const text = input.trim();
    if (!text || isSending) return;

    appendMessage({
      id: createMessageId(),
      role: "user",
      content: text,
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

      appendMessage({
        id: createMessageId(),
        role: "assistant",
        content: String(data?.answer || fallbackErrorMessage),
        mode: (String(data?.mode || "fallback") as ChatMode) || "fallback",
        sources: Array.isArray(data?.sources) ? data.sources : [],
        actions: Array.isArray(data?.suggested_actions) ? data.suggested_actions : [],
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
              <div ref={scrollRef} className="flex-1 overflow-y-auto">
                <div className="space-y-3 p-3">
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
                        <p className="whitespace-pre-wrap leading-relaxed">{message.content}</p>

                        {message.sources && message.sources.length > 0 && (
                          <div className="mt-2 space-y-1 border-t border-border/60 pt-2">
                            <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                              Fontes
                            </p>
                            {message.sources.slice(0, 3).map((source) => (
                              <button
                                key={`${message.id}-${source.id}`}
                                type="button"
                                className="flex w-full items-center justify-between gap-2 rounded-md border bg-background px-2 py-1 text-left text-[11px] hover:bg-secondary"
                                onClick={() =>
                                  source.route &&
                                  handleActionClick({ type: "link", label: source.title, url: source.route })
                                }
                              >
                                <span className="truncate">{source.title}</span>
                                <ExternalLink className="h-3 w-3 shrink-0 text-muted-foreground" />
                              </button>
                            ))}
                          </div>
                        )}

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
                      <div className="rounded-2xl rounded-bl-sm border bg-secondary/40 px-3 py-2 text-xs text-muted-foreground">
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
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
                    placeholder="Pergunte sobre funcionalidades..."
                    disabled={isSending}
                  />
                  <Button size="icon" onClick={sendMessage} disabled={isSending || !input.trim()}>
                    {isSending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                  </Button>
                </div>
              </div>
            </>
          )}
        </div>
      ) : (
        <button
          onClick={() => {
            setOpen(true);
            setIsMinimized(false);
          }}
          className="relative flex h-14 w-14 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-2xl transition-transform active:scale-95"
          aria-label="Abrir assistente da plataforma"
        >
          <MessageCircle className="h-6 w-6" />
        </button>
      )}
    </div>
  );
};

export default SupportChatWidget;
