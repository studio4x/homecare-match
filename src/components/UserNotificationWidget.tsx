"use client";

import React, { useState, useEffect } from "react";
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
  const [isOpen, setIsOpen] = useState(false);
  const [isEnabled, setIsEnabled] = useState(true);

  const fetchNotifications = async (silent = false) => {
    if (!user) return;
    if (!silent) setLoading(true);
    else setIsRefreshing(true);

    try {
      // Busca perfil para checar se notificações estão ativas
      const { data: profile, error: profError } = await supabase
        .from("profiles")
        .select("notifications_enabled")
        .eq("id", user.id)
        .maybeSingle();
      
      // Se a coluna não existir ou houver erro, assumimos habilitado por padrão
      const notificationsActive = profile?.notifications_enabled ?? true;
      setIsEnabled(notificationsActive);

      if (!notificationsActive) {
        setNotifications([]);
        setLoading(false);
        setIsRefreshing(false);
        return;
      }

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
  };

  useEffect(() => {
    if (!user) return;

    fetchNotifications();

    // Inscrição no Realtime
    const channel = supabase
      .channel(`user-notifications-${user.id}`)
      .on(
        "postgres_changes",
        { 
          event: "*", 
          schema: "public", 
          table: "notifications",
          filter: `user_id=eq.${user.id}`
        },
        (payload) => {
          // Só processa se estiver habilitado no estado local
          if (payload.eventType === 'INSERT') {
            setNotifications(prev => {
              // Evita duplicatas
              if (prev.some(n => n.id === payload.new.id)) return prev;
              return [payload.new, ...prev];
            });
            
            // Alerta visual apenas se o widget não estiver aberto
            if (!isOpen) {
              toast.info(payload.new.title, {
                description: payload.new.content,
                action: payload.new.link ? {
                  label: "Ver",
                  onClick: () => window.location.href = payload.new.link
                } : undefined
              });
            }
          } else {
            fetchNotifications(true);
          }
        }
      )
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "profiles",
          filter: `id=eq.${user.id}`
        },
        (payload) => {
          // Atualiza preferência em tempo real se mudar em outra aba
          if (payload.new.notifications_enabled !== undefined) {
            setIsEnabled(payload.new.notifications_enabled);
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user?.id]); // Removido isEnabled da dependência para evitar loops de inscrição

  const handleMarkAsRead = async (id: string) => {
    try {
      const { error } = await supabase
        .from("notifications")
        .update({ is_read: true })
        .eq("id", id);

      if (error) throw error;
      setNotifications(prev => prev.map(n => n.id === id ? { ...n, is_read: true } : n));
    } catch (err) {
      toast.error("Erro ao atualizar notificação.");
    }
  };

  const handleDelete = async (id: string) => {
    try {
      const { error } = await supabase
        .from("notifications")
        .delete()
        .eq("id", id);

      if (error) throw error;
      setNotifications(prev => prev.filter(n => n.id !== id));
      toast.success("Notificação removida.");
    } catch (err) {
      toast.error("Erro ao excluir.");
    }
  };

  const unreadCount = notifications.filter(n => !n.is_read).length;

  // Se o usuário desativou, não renderizamos nada
  if (!user || !isEnabled) return null;

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
            <button 
              onClick={() => fetchNotifications(true)} 
              disabled={isRefreshing}
              className="p-1 hover:bg-white/20 rounded transition-colors"
            >
              <RefreshCw className={cn("h-4 w-4", isRefreshing && "animate-spin")} />
            </button>
          </div>

          <ScrollArea className="h-[350px]">
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
                        {!n.is_read && (
                          <Button 
                            variant="outline" 
                            size="sm" 
                            className="h-7 w-7 p-0 text-success hover:bg-success/10 border-success/20"
                            onClick={() => handleMarkAsRead(n.id)}
                            title="Marcar como lida"
                          >
                            <Check className="h-3.5 w-3.5" />
                          </Button>
                        )}
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
                <p className="text-sm font-medium">Nenhuma notificação</p>
                <p className="text-xs mt-1">Você será avisado aqui sobre novos contatos e atualizações.</p>
              </div>
            )}
          </ScrollArea>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
};

export default UserNotificationWidget;