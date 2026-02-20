"use client";

import React, { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/components/auth/AuthProvider";
import { 
  Bell, 
  Check, 
  Trash2, 
  Loader2, 
  ExternalLink, 
  Inbox,
  Circle,
  RefreshCw
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { 
  DropdownMenu, 
  DropdownMenuContent, 
  DropdownMenuTrigger 
} from "@/components/ui/dropdown-menu";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Link } from "react-router-dom";

const UserNotificationWidget = () => {
  const { user } = useAuth();
  const [notifications, setNotifications] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isDeletingAll, setIsDeletingAll] = useState(false);
  const [isOpen, setIsOpen] = useState(false);

  const fetchNotifications = useCallback(async (silent = false) => {
    if (!user) return;
    if (!silent) setLoading(true);
    else setIsRefreshing(true);

    try {
      const { data, error } = await supabase
        .from("notifications")
        .select("*")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false })
        .limit(30);

      if (error) throw error;
      setNotifications(data || []);
    } catch (err) {
      console.error("[UserNotifications] Erro ao carregar:", err);
    } finally {
      setLoading(false);
      setIsRefreshing(false);
    }
  }, [user?.id]);

  useEffect(() => {
    if (!user) return;

    fetchNotifications();

    const channel = supabase
      .channel(`user-notifications-realtime-${user.id}`)
      .on(
        "postgres_changes",
        { 
          event: "*", 
          schema: "public", 
          table: "notifications",
          filter: `user_id=eq.${user.id}`
        },
        (payload) => {
          if (payload.eventType === 'INSERT') {
            setNotifications(prev => {
              if (prev.some(n => n.id === payload.new.id)) return prev;
              return [payload.new, ...prev];
            });
          } else if (payload.eventType === 'UPDATE') {
            setNotifications(prev => prev.map(n => n.id === payload.new.id ? payload.new : n));
          } else if (payload.eventType === 'DELETE') {
            setNotifications(prev => prev.filter(n => n.id !== payload.old.id));
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user?.id, fetchNotifications]);

  const handleMarkAsRead = async (id: string) => {
    try {
      await supabase.from("notifications").update({ is_read: true }).eq("id", id);
    } catch (err) {
      console.warn("Erro ao marcar como lido");
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await supabase.from("notifications").delete().eq("id", id);
      toast.success("Removida.");
    } catch (err) {
      toast.error("Erro ao excluir.");
    }
  };

  const handleDeleteAll = async () => {
    if (!user || notifications.length === 0) return;
    if (!confirm("Deseja excluir todas as suas notificações?")) return;

    setIsDeletingAll(true);
    try {
      const { error } = await supabase
        .from("notifications")
        .delete()
        .eq("user_id", user.id);

      if (error) throw error;
      setNotifications([]);
      toast.success("Todas as notificações foram excluídas.");
    } catch (err) {
      toast.error("Erro ao excluir notificações.");
    } finally {
      setIsDeletingAll(false);
    }
  };

  const unreadCount = notifications.filter(n => !n.is_read).length;

  if (!user) return null;

  return (
    <div className="fixed bottom-20 right-6 z-[60]">
      <DropdownMenu open={isOpen} onOpenChange={setIsOpen}>
        <DropdownMenuTrigger asChild>
          <button 
            className="h-14 w-14 rounded-full shadow-2xl relative bg-primary hover:bg-primary/90 text-white flex items-center justify-center transition-transform active:scale-95"
          >
            <Bell className="h-6 w-6" />
            {unreadCount > 0 && (
              <Badge 
                className="absolute -top-1 -right-1 h-6 w-6 flex items-center justify-center p-0 bg-destructive text-white border-2 border-white rounded-full"
              >
                {unreadCount > 9 ? "9+" : unreadCount}
              </Badge>
            )}
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-[350px] p-0 overflow-hidden border-none shadow-2xl">
          <div className="bg-primary p-4 text-primary-foreground flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Bell className="h-5 w-5" />
              <h3 className="font-bold">Minhas Notificações</h3>
            </div>
            <div className="flex items-center gap-2">
              {notifications.length > 0 && (
                <button 
                  onClick={handleDeleteAll} 
                  disabled={isDeletingAll}
                  className="p-1 hover:bg-white/20 rounded text-white/80 hover:text-white transition-colors"
                  title="Excluir todas"
                >
                  {isDeletingAll ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
                </button>
              )}
              <button onClick={() => fetchNotifications(true)} disabled={isRefreshing} className="p-1 hover:bg-white/20 rounded">
                <RefreshCw className={cn("h-4 w-4", isRefreshing && "animate-spin")} />
              </button>
            </div>
          </div>

          <ScrollArea className="h-[350px]">
            {loading ? (
              <div className="flex items-center justify-center h-full p-8"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>
            ) : notifications.length > 0 ? (
              <div className="divide-y">
                {notifications.map((n) => (
                  <div key={n.id} className={cn("p-4 hover:bg-secondary/30 transition-colors group relative", !n.is_read && "bg-primary/5")}>
                    <div className="flex items-start gap-3">
                      {!n.is_read && <Circle className="h-2 w-2 fill-primary text-primary mt-1.5 shrink-0" />}
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-bold leading-none">{n.title}</p>
                        <p className="text-xs text-muted-foreground leading-relaxed">{n.content}</p>
                        <p className="text-[10px] text-muted-foreground pt-1">{formatDistanceToNow(new Date(n.created_at), { addSuffix: true, locale: ptBR })}</p>
                      </div>
                    </div>
                    <div className="mt-3 flex items-center justify-between gap-2">
                      {n.link && <Button variant="ghost" size="sm" className="h-7 text-[10px] gap-1 px-2" asChild onClick={() => setIsOpen(false)}><Link to={n.link}><ExternalLink className="h-3 w-3" /> Ver Detalhes</Link></Button>}
                      <div className="flex items-center gap-1 ml-auto">
                        {!n.is_read && <Button variant="outline" size="sm" className="h-7 w-7 p-0 text-success hover:bg-success/10 border-success/20" onClick={() => handleMarkAsRead(n.id)} title="Lida"><Check className="h-3.5 w-3.5" /></Button>}
                        <Button variant="outline" size="sm" className="h-7 w-7 p-0 text-destructive hover:bg-destructive/10 border-destructive/20" onClick={() => handleDelete(n.id)} title="Excluir"><Trash2 className="h-3.5 w-3.5" /></Button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center h-[300px] text-muted-foreground p-8 text-center">
                <Inbox className="h-12 w-12 mb-4 opacity-20" />
                <p className="text-sm font-medium">Nenhuma notificação</p>
              </div>
            )}
          </ScrollArea>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
};

export default UserNotificationWidget;