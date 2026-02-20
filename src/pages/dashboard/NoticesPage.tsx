"use client";

import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/components/auth/AuthProvider";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { 
  Bell, 
  Trash2, 
  Loader2, 
  ExternalLink, 
  Inbox,
  Calendar,
  Clock,
  CheckCircle2,
  AlertCircle,
  Megaphone,
  RefreshCw
} from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { toast } from "sonner";
import { Link } from "react-router-dom";
import { cn } from "@/lib/utils";

const NoticesPage = () => {
  const { user } = useAuth();
  const [notifications, setNotifications] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isDeletingAll, setIsDeletingAll] = useState(false);

  const fetchNotifications = async (silent = false) => {
    if (!user) return;
    if (!silent) setLoading(true);
    else setIsRefreshing(true);

    try {
      const { data, error } = await supabase
        .from("notifications")
        .select("*")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false });

      if (error) throw error;
      setNotifications(data || []);
    } catch (err) {
      console.error("[NoticesPage] Erro ao carregar:", err);
      toast.error("Erro ao carregar mural de avisos.");
    } finally {
      setLoading(false);
      setIsRefreshing(false);
    }
  };

  useEffect(() => {
    fetchNotifications();
  }, [user?.id]);

  const handleDeleteOne = async (id: string) => {
    try {
      const { error } = await supabase
        .from("notifications")
        .delete()
        .eq("id", id);

      if (error) throw error;
      setNotifications(prev => prev.filter(n => n.id !== id));
      toast.success("Aviso removido.");
    } catch (err) {
      toast.error("Erro ao excluir aviso.");
    }
  };

  const handleDeleteAll = async () => {
    if (!confirm("Tem certeza que deseja apagar TODOS os avisos do seu mural?")) return;
    
    setIsDeletingAll(true);
    try {
      const { error } = await supabase
        .from("notifications")
        .delete()
        .eq("user_id", user?.id);

      if (error) throw error;
      setNotifications([]);
      toast.success("Mural limpo com sucesso!");
    } catch (err) {
      toast.error("Erro ao limpar mural.");
    } finally {
      setIsDeletingAll(false);
    }
  };

  const handleMarkAsRead = async (id: string) => {
    try {
      await supabase
        .from("notifications")
        .update({ is_read: true })
        .eq("id", id);
      
      setNotifications(prev => prev.map(n => n.id === id ? { ...n, is_read: true } : n));
    } catch (err) {
      console.warn("Erro ao marcar como lido");
    }
  };

  const getTypeIcon = (type: string) => {
    switch (type) {
      case 'success': return <CheckCircle2 className="h-5 w-5 text-success" />;
      case 'warning': return <AlertCircle className="h-5 w-5 text-amber-500" />;
      case 'error': return <AlertCircle className="h-5 w-5 text-destructive" />;
      default: return <Megaphone className="h-5 w-5 text-primary" />;
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex flex-col gap-1">
          <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <Bell className="h-6 w-6 text-primary" /> Mural de Avisos
          </h1>
          <p className="text-muted-foreground">Acompanhe comunicados importantes e atualizações da sua conta.</p>
        </div>
        <div className="flex gap-2">
          <Button 
            variant="outline" 
            size="sm" 
            className="gap-2" 
            onClick={() => fetchNotifications(true)}
            disabled={isRefreshing || loading}
          >
            {isRefreshing ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
            Atualizar
          </Button>
          {notifications.length > 0 && (
            <Button 
              variant="outline" 
              size="sm" 
              className="gap-2 text-destructive hover:bg-destructive/5 border-destructive/20" 
              onClick={handleDeleteAll}
              disabled={isDeletingAll}
            >
              {isDeletingAll ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
              Limpar Mural
            </Button>
          )}
        </div>
      </div>

      <Card className="border-none shadow-sm bg-transparent">
        <CardContent className="p-0 space-y-4">
          {loading ? (
            <div className="flex flex-col items-center justify-center py-20 gap-3 text-muted-foreground bg-card rounded-2xl border">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
              <p className="text-sm">Buscando seus avisos...</p>
            </div>
          ) : notifications.length > 0 ? (
            <div className="grid gap-4">
              {notifications.map((n) => (
                <div 
                  key={n.id} 
                  className={cn(
                    "group relative flex flex-col sm:flex-row gap-4 p-5 rounded-2xl border transition-all duration-300 hover:shadow-md",
                    n.is_read ? "bg-card border-border/50" : "bg-primary/5 border-primary/20 ring-1 ring-primary/10"
                  )}
                  onMouseEnter={() => !n.is_read && handleMarkAsRead(n.id)}
                >
                  <div className="flex items-start gap-4 flex-1">
                    <div className={cn(
                      "h-12 w-12 rounded-xl flex items-center justify-center shrink-0 shadow-sm",
                      n.is_read ? "bg-secondary/50" : "bg-white"
                    )}>
                      {getTypeIcon(n.type)}
                    </div>
                    
                    <div className="space-y-1 flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <h3 className={cn("font-bold text-base leading-tight", !n.is_read && "text-primary")}>
                          {n.title}
                        </h3>
                        {!n.is_read && (
                          <Badge className="h-4 text-[8px] uppercase bg-primary text-white border-none">Novo</Badge>
                        )}
                      </div>
                      <p className="text-sm text-muted-foreground leading-relaxed">
                        {n.content}
                      </p>
                      
                      <div className="flex items-center gap-4 pt-2 text-[10px] font-medium text-muted-foreground uppercase tracking-wider">
                        <div className="flex items-center gap-1.5">
                          <Calendar className="h-3 w-3" />
                          {format(new Date(n.created_at), "dd 'de' MMMM", { locale: ptBR })}
                        </div>
                        <div className="flex items-center gap-1.5">
                          <Clock className="h-3 w-3" />
                          {format(new Date(n.created_at), "HH:mm")}
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 sm:flex-col sm:justify-center shrink-0">
                    {n.link && (
                      <Button variant="secondary" size="sm" className="h-9 gap-2 flex-1 sm:w-full" asChild>
                        <Link to={n.link}>
                          <ExternalLink className="h-3.5 w-3.5" />
                          Ver Detalhes
                        </Link>
                      </Button>
                    )}
                    <Button 
                      variant="ghost" 
                      size="icon" 
                      className="h-9 w-9 text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                      onClick={() => handleDeleteOne(n.id)}
                      title="Excluir aviso"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-20 bg-card rounded-2xl border border-dashed flex flex-col items-center justify-center">
              <div className="h-16 w-16 rounded-full bg-secondary/50 flex items-center justify-center mb-4">
                <Inbox className="h-8 w-8 text-muted-foreground opacity-20" />
              </div>
              <h3 className="text-lg font-semibold text-foreground">Seu mural está vazio</h3>
              <p className="text-sm text-muted-foreground max-w-xs mx-auto mt-1">
                Você não possui avisos ou notificações no momento.
              </p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default NoticesPage;