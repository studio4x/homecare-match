"use client";

import React, { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import {
  Bell,
  Check,
  Trash2,
  Loader2,
  ExternalLink,
  Inbox,
  Circle,
  RefreshCw,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Link } from "react-router-dom";

const MAX_NOTIFICATIONS = 50;

const AdminNotificationWidget = () => {
  const [notifications, setNotifications] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isDeletingAll, setIsDeletingAll] = useState(false);
  const [isOpen, setIsOpen] = useState(false);

  const fetchNotifications = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    else setIsRefreshing(true);

    try {
      const { data, error } = await supabase
        .from("admin_notifications")
        .select("*")
        .eq("is_completed", false)
        .order("created_at", { ascending: false })
        .limit(MAX_NOTIFICATIONS);

      if (error) throw error;
      setNotifications(data || []);
    } catch (err) {
      console.error("[AdminNotifications] Erro ao carregar:", err);
    } finally {
      setLoading(false);
      setIsRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchNotifications();

    const upsertNotification = (incoming: any) => {
      if (!incoming?.id) return;

      if (incoming.is_completed) {
        setNotifications((prev) => prev.filter((item) => item.id !== incoming.id));
        return;
      }

      setNotifications((prev) => {
        const existingIndex = prev.findIndex((item) => item.id === incoming.id);

        if (existingIndex >= 0) {
          const next = [...prev];
          next[existingIndex] = { ...next[existingIndex], ...incoming };
          return next
            .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
            .slice(0, MAX_NOTIFICATIONS);
        }

        return [incoming, ...prev]
          .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
          .slice(0, MAX_NOTIFICATIONS);
      });
    };

    const removeNotification = (oldRow: any) => {
      if (!oldRow?.id) return;
      setNotifications((prev) => prev.filter((item) => item.id !== oldRow.id));
    };

    const channel = supabase
      .channel("admin-notifications-realtime")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "admin_notifications" },
        (payload) => {
          upsertNotification(payload.new);
        },
      )
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "admin_notifications" },
        (payload) => {
          upsertNotification(payload.new);
        },
      )
      .on(
        "postgres_changes",
        { event: "DELETE", schema: "public", table: "admin_notifications" },
        (payload) => {
          removeNotification(payload.old);
        },
      )
      .subscribe((status) => {
        if (status === "CHANNEL_ERROR" || status === "TIMED_OUT" || status === "CLOSED") {
          fetchNotifications(true);
        }
      });

    const fallbackInterval = window.setInterval(() => {
      if (document.visibilityState === "visible") {
        fetchNotifications(true);
      }
    }, 30000);

    return () => {
      clearInterval(fallbackInterval);
      supabase.removeChannel(channel);
    };
  }, [fetchNotifications]);

  const handleMarkAsCompleted = async (id: string) => {
    setNotifications((prev) => prev.filter((item) => item.id !== id));

    try {
      const { data, error } = await supabase
        .from("admin_notifications")
        .update({ is_completed: true, is_read: true })
        .eq("id", id);

      if (error) throw error;

      const affected = Array.isArray(data) ? data.length : 0;
      if (affected === 0) {
        throw new Error("Nenhuma notificacao foi atualizada.");
      }

      toast.success("Notificacao concluida.");
    } catch (err) {
      fetchNotifications(true);
      toast.error("Erro ao atualizar status.");
    }
  };

  const handleDelete = async (id: string) => {
    setNotifications((prev) => prev.filter((item) => item.id !== id));

    try {
      const { data: deletedRows, error: deleteError } = await supabase
        .from("admin_notifications")
        .delete()
        .eq("id", id)
        .select("id");

      if (deleteError) throw deleteError;

      const deletedCount = Array.isArray(deletedRows) ? deletedRows.length : 0;

      if (deletedCount === 0) {
        const { data: fallbackRows, error: fallbackError } = await supabase
          .from("admin_notifications")
          .update({ is_completed: true, is_read: true })
          .eq("id", id)
          .select("id");

        if (fallbackError) throw fallbackError;

        const fallbackCount = Array.isArray(fallbackRows) ? fallbackRows.length : 0;
        if (fallbackCount === 0) {
          throw new Error("Nenhuma notificacao foi removida.");
        }
      }

      toast.success("Notificacao removida.");
    } catch (err) {
      fetchNotifications(true);
      toast.error("Erro ao excluir.");
    }
  };

  const handleDeleteAll = async () => {
    if (notifications.length === 0) return;
    if (!confirm("Deseja excluir todas as notificacoes administrativas pendentes?")) return;

    setIsDeletingAll(true);
    try {
      const { error } = await supabase.from("admin_notifications").delete().eq("is_completed", false);
      if (error) throw error;
      setNotifications([]);
      toast.success("Todas as notificacoes foram excluidas.");
    } catch (err) {
      toast.error("Erro ao excluir notificacoes.");
    } finally {
      setIsDeletingAll(false);
    }
  };

  const unreadCount = notifications.filter((n) => !n.is_read).length;

  return (
    <div className="fixed bottom-20 right-6 z-[60]">
      <DropdownMenu open={isOpen} onOpenChange={setIsOpen}>
        <DropdownMenuTrigger asChild>
          <Button
            size="icon"
            className="relative h-14 w-14 rounded-full bg-primary shadow-2xl animate-bounce-slow hover:bg-primary/90"
          >
            <Bell className="h-6 w-6" />
            {unreadCount > 0 && (
              <Badge className="absolute -right-1 -top-1 flex h-6 w-6 items-center justify-center rounded-full border-2 border-white bg-destructive p-0 text-white">
                {unreadCount > 9 ? "9+" : unreadCount}
              </Badge>
            )}
          </Button>
        </DropdownMenuTrigger>

        <DropdownMenuContent align="end" className="w-[380px] overflow-hidden border-none p-0 shadow-2xl">
          <div className="flex items-center justify-between bg-primary p-4 text-primary-foreground">
            <div className="flex items-center gap-2">
              <Bell className="h-5 w-5" />
              <h3 className="font-bold">Notificacoes Admin</h3>
            </div>
            <div className="flex items-center gap-2">
              {notifications.length > 0 && (
                <button
                  onClick={handleDeleteAll}
                  disabled={isDeletingAll}
                  className="rounded p-1 text-white/80 transition-colors hover:bg-white/20 hover:text-white"
                  title="Excluir todas"
                >
                  {isDeletingAll ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
                </button>
              )}
              <button
                onClick={() => fetchNotifications(true)}
                disabled={isRefreshing}
                className="rounded p-1 hover:bg-white/20"
                title="Atualizar"
              >
                <RefreshCw className={cn("h-4 w-4", isRefreshing && "animate-spin")} />
              </button>
            </div>
          </div>

          <ScrollArea className="h-[400px]">
            {loading ? (
              <div className="flex h-full items-center justify-center p-8">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
              </div>
            ) : notifications.length > 0 ? (
              <div className="divide-y">
                {notifications.map((n) => (
                  <div
                    key={n.id}
                    className={cn(
                      "group relative p-4 transition-colors hover:bg-secondary/30",
                      !n.is_read && "bg-primary/5",
                    )}
                  >
                    <div className="flex items-start gap-3">
                      {!n.is_read && <Circle className="mt-1.5 h-2 w-2 shrink-0 fill-primary text-primary" />}
                      <div className="min-w-0 flex-1 space-y-1">
                        <p className="text-sm font-bold leading-none">{n.title}</p>
                        <p className="text-xs leading-relaxed text-muted-foreground">{n.content}</p>
                        <p className="pt-1 text-[10px] text-muted-foreground">
                          {formatDistanceToNow(new Date(n.created_at), { addSuffix: true, locale: ptBR })}
                        </p>
                      </div>
                    </div>

                    <div className="mt-3 flex items-center justify-between gap-2">
                      {n.link && (
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-7 gap-1 px-2 text-[10px]"
                          asChild
                          onClick={() => setIsOpen(false)}
                        >
                          <Link to={n.link}>
                            <ExternalLink className="h-3 w-3" /> Ver Detalhes
                          </Link>
                        </Button>
                      )}

                      <div className="ml-auto flex items-center gap-1">
                        <Button
                          variant="outline"
                          size="sm"
                          className="h-7 w-7 border-success/20 p-0 text-success hover:bg-success/10"
                          onClick={() => handleMarkAsCompleted(n.id)}
                          title="Marcar como concluido"
                        >
                          <Check className="h-3.5 w-3.5" />
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          className="h-7 w-7 border-destructive/20 p-0 text-destructive hover:bg-destructive/10"
                          onClick={() => handleDelete(n.id)}
                          title="Excluir"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="flex h-[300px] flex-col items-center justify-center p-8 text-center text-muted-foreground">
                <Inbox className="mb-4 h-12 w-12 opacity-20" />
                <p className="text-sm font-medium">Tudo limpo por aqui!</p>
                <p className="text-xs">Nenhuma notificacao pendente no momento.</p>
              </div>
            )}
          </ScrollArea>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
};

export default AdminNotificationWidget;
