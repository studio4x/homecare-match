"use client";

import React, { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { 
  Bell, 
  X, 
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
        .limit(50);

      if (error) throw error;
      setNotifications(data || []);
    } catch (err) {
      console.error("[Notifications] Erro ao carregar:", err);
    } finally {
      setLoading(false);
      setIsRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchNotifications();

    const channel = supabase
      .channel("admin-notifications-realtime")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "admin_notifications" },
        (payload) => {
          fetchNotifications(true);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [fetchNotifications]);

  const handleMarkAsCompleted = async (id: string) => {
    try {
      const { error } = await supabase
        .from("admin_notifications")
        .update({ is_completed: true, is_read: true })
        .eq("id", id);

      if (error) throw error;
      toast.success("Notificação concluída.");
    } catch (err) {
      toast.error("Erro ao atualizar status.");
    }
  };

  const handleDelete = async (id: string) => {
    try {
      const { error } = await supabase
        .from("admin_notifications")
        .delete()
        .eq("id", id);

      if (error) throw error;
      toast.success("Notificação excluída.");
    } catch (err) {
      toast.error("Erro ao excluir.");
    }
  };

  const handleDeleteAll = async () => {
    if (notifications.length === 0) return;
    if (!confirm("Deseja excluir todas as notificações administrativas pendentes?")) return;

    setIsDeletingAll(true);
    try {
      const { error } = await supabase
        .from("admin_notifications")
        .delete()
        .eq("is_completed", false);

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

  return (
    <div className="fixed bottom-20 right-6 z-[60]">
      <DropdownMenu open={isOpen} onOpenChange={setIsOpen}>
        <DropdownMenuTrigger asChild>
          <Button 
            size="icon" 
            className="h-14 w-14 rounded-full shadow-2xl animate-bounce-slow relative bg-primary hover:bg-primary/90"
          >
            <Bell className="h-6 w-6" />
            {unreadCount > 0 && (
              <Badge 
                className="absolute -top-1 -right-1 h-6 w-6 flex items-center justify-center p-0 bg-destructive text-white border-2 border-white rounded-full"
              >
                {unreadCount > 9 ? "9+" : unreadCount}
              </Badge>
            )}
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-[380px] p-0 overflow-hidden border-none shadow-2xl">
          <div className="bg-primary p-4 text-primary-foreground flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Bell className="h-5 w-5" />
              <h3 className="font-bold">Notificações Admin</h3>
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

          <ScrollArea className="h-[400px]">
            {loading ? (
              <div className="flex items-center justify-center h-full p-8">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
              </div>
            ) : notifications.length > 0 ? (
              <div className="divide-y">
                {notifications.map((n) => (
                  <div 
                    key={n.id} 
                    className={cn(
                      "p-4 hover:bg-secondary/30 transition-colors group relative",
                      !n.is_read && "bg-primary/5"
                    )}
                  >
                    <div className="flex items-start gap-3">
                      {!n.is_read && <Circle className="h-2 w-2 fill-primary text-primary mt-1.5 shrink-0" />}
                      <div className="flex-1 space-y-1 min-w-0">
                        <p className="text-sm font-bold leading-none">{n.title}</p>
                        <p className="text-xs text-muted-foreground leading-relaxed">
                          {n.content}
                        </p>
                        <p className="text-[10px] text-muted-foreground pt-1">
                          {formatDistanceToNow(new Date(n.created_at), { addSuffix: true, locale: ptBR })}
                        </p>
                      </div>
                    </div>

                    <div className="mt-3 flex items-center justify-between gap-2">
                      {n.link && (
                        <Button variant="ghost" size="sm" className="h-7 text-[10px] gap-1 px-2" asChild onClick={() => setIsOpen(false)}>
                          <Link to={n.link}>
                            <ExternalLink className="h-3 w-3" /> Ver Detalhes
                          </Link>
                        </Button>
                      )}
                      <div className="flex items-center gap-1 ml-auto">
                        <Button 
                          variant="outline" 
                          size="sm" 
                          className="h-7 w-7 p-0 text-success hover:bg-success/10 border-success/20"
                          onClick={() => handleMarkAsCompleted(n.id)}
                          title="Marcar como Concluído"
                        >
                          <Check className="h-3.5 w-3.5" />
                        </Button>
                        <Button 
                          variant="outline" 
                          size="sm" 
                          className="h-7 w-7 p-0 text-destructive hover:bg-destructive/10 border-destructive/20"
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
              <div className="flex flex-col items-center justify-center h-[300px] text-muted-foreground p-8 text-center">
                <Inbox className="h-12 w-12 mb-4 opacity-20" />
                <p className="text-sm font-medium">Tudo limpo por aqui!</p>
                <p className="text-xs">Nenhuma notificação pendente no momento.</p>
              </div>
            )}
          </ScrollArea>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
};

export default AdminNotificationWidget;