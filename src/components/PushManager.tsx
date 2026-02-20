"use client";

import { useEffect, useState, useCallback, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/components/auth/AuthProvider";
import { toast } from "sonner";
import { BellRing, ShieldCheck, Loader2, Megaphone, ExternalLink, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useSiteConfig } from "@/hooks/use-site-config";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";

const DEFAULT_LAYOUT = {
  bgColor: "#ffffff",
  titleColor: "#0f172a",
  bodyColor: "#64748b",
  borderRadius: "32",
  iconBgColor: "#007BFF1a",
  iconColor: "#007BFF",
  ctaBgColor: "#007BFF",
  ctaTextColor: "#ffffff",
};

const PushManager = () => {
  const { user } = useAuth();
  const { data: config } = useSiteConfig();
  const [showPrompt, setShowPrompt] = useState(false);
  const [isSubscribing, setIsSubscribing] = useState(false);
  const [activeNotification, setActiveNotification] = useState<any>(null);
  const [userRole, setUserRole] = useState<string | null>(null);
  const [notificationsEnabled, setNotificationsEnabled] = useState(true);

  // Busca o papel e as preferências do usuário logado
  useEffect(() => {
    const fetchProfilePrefs = async () => {
      if (user) {
        const { data } = await supabase.from('profiles').select('role, notifications_enabled').eq('id', user.id).single();
        setUserRole(data?.role || null);
        setNotificationsEnabled(data?.notifications_enabled ?? true);
      } else {
        setUserRole(null);
        setNotificationsEnabled(true);
      }
    };
    fetchProfilePrefs();
  }, [user]);

  // Sincroniza a preferência de notificações em tempo real
  useEffect(() => {
    if (!user) return;

    const channel = supabase
      .channel(`profile-prefs-sync-${user.id}`)
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "profiles", filter: `id=eq.${user.id}` },
        (payload) => {
          if (payload.new.notifications_enabled !== undefined) {
            setNotificationsEnabled(payload.new.notifications_enabled);
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user]);

  const urlBase64ToUint8Array = (base64String: string) => {
    const padding = "=".repeat((4 - base64String.length % 4) % 4);
    const base64 = (base64String + padding).replace(/\-/g, "+").replace(/_/g, "/");
    const rawData = window.atob(base64);
    const outputArray = new Uint8Array(rawData.length);
    for (let i = 0; i < rawData.length; ++i) {
      outputArray[i] = rawData.charCodeAt(i);
    }
    return outputArray;
  };

  const checkAndShowPrompt = useCallback(() => {
    if (typeof window !== "undefined" && "Notification" in window && Notification.permission === "default") {
      const hasConsent = localStorage.getItem("cookie-consent") === "true";
      if (hasConsent) {
        setTimeout(() => setShowPrompt(true), 3000);
      }
    }
  }, []);

  // Efeito 1: Registro de Service Worker e Prompt de Permissão
  useEffect(() => {
    if (typeof window !== "undefined" && "serviceWorker" in navigator) {
      navigator.serviceWorker.register("/sw.js", { scope: "/" })
        .then(() => checkAndShowPrompt())
        .catch((err) => console.error("[Push] SW Error:", err));
    }

    const handleConsent = () => checkAndShowPrompt();
    window.addEventListener("cookie-consent-accepted", handleConsent);
    return () => window.removeEventListener("cookie-consent-accepted", handleConsent);
  }, [checkAndShowPrompt]);

  // Efeito 2: Realtime Listener Global
  useEffect(() => {
    const channel = supabase
      .channel('global-broadcast-monitor')
      .on(
        "postgres_changes", 
        { 
          event: "UPDATE", 
          schema: "public", 
          table: "push_notifications",
          filter: "status=eq.sent"
        }, 
        (payload) => {
          const data = payload.new as any;
          
          // Se as notificações estiverem desativadas nas preferências, ignora
          if (!notificationsEnabled) return;

          const isTargetAll = data.target_role === 'all';
          const isTargetMe = userRole && data.target_role === userRole;
          
          if (isTargetAll || isTargetMe) {
            console.log("[PushManager] Novo comunicado global recebido:", data.title);
            setActiveNotification({
              title: data.title,
              body: data.body,
              link: data.link,
              image_url: data.image_url
            });

            // Se tiver permissão de Push nativo, dispara a notificação do sistema
            if (Notification.permission === "granted") {
              try {
                navigator.serviceWorker.ready.then(registration => {
                  registration.showNotification(data.title, {
                    body: data.body,
                    icon: "/favicon.png",
                    data: { url: data.link || "/" }
                  });
                });
              } catch (e) {}
            }
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [userRole, notificationsEnabled]);

  const handleSubscribe = async () => {
    if (!config?.vapid_public_key) {
      toast.error("Configuração de notificações ainda não carregada.");
      return;
    }
    setIsSubscribing(true);
    try {
      const permission = await Notification.requestPermission();
      if (permission !== "granted") {
        toast.error("Notificações bloqueadas no navegador.");
        setIsSubscribing(false);
        return;
      }

      const registration = await navigator.serviceWorker.ready;
      const subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(config.vapid_public_key),
      });

      await supabase.functions.invoke('subscribe-push', {
        body: {
          user_id: user?.id || null,
          subscription: subscription.toJSON(),
          device_type: /Mobi|Android|iPhone/i.test(navigator.userAgent) ? "mobile" : "desktop",
          browser: navigator.userAgent.split(' ').pop() || "Browser"
        }
      });

      toast.success("Notificações ativadas!");
      setShowPrompt(false);
    } catch (err) {
      toast.error("Erro ao ativar notificações.");
    } finally {
      setIsSubscribing(false);
    }
  };

  const layout = useMemo(() => ({
    ...DEFAULT_LAYOUT,
    ...(config?.push_layout_json || {})
  }), [config?.push_layout_json]);

  return (
    <>
      <Dialog open={showPrompt} onOpenChange={setShowPrompt}>
        <DialogContent className="w-[calc(100%-2rem)] max-w-[400px] rounded-3xl p-6 border-none shadow-2xl">
          <DialogHeader>
            <div className="mx-auto h-14 w-14 rounded-full bg-primary/10 flex items-center justify-center mb-4">
              <BellRing className="h-7 w-7 text-primary animate-pulse" />
            </div>
            <DialogTitle className="text-center text-xl font-bold">Fique por dentro!</DialogTitle>
            <DialogDescription className="text-center text-base">
              Deseja receber alertas sobre novos profissionais e atualizações importantes diretamente no seu dispositivo?
              <br/><br/>
              <span className="text-[10px] text-muted-foreground italic">Nota: Você pode desativar a qualquer momento nas configurações do navegador.</span>
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="flex flex-col gap-2 pt-4">
            <Button onClick={handleSubscribe} disabled={isSubscribing} className="w-full gap-2 h-12 text-base shadow-lg">
              {isSubscribing ? <Loader2 className="h-5 w-5 animate-spin" /> : <ShieldCheck className="h-5 w-5" />}
              Ativar Notificações
            </Button>
            <Button variant="ghost" onClick={() => setShowPrompt(false)} className="w-full text-muted-foreground">Agora não</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!activeNotification} onOpenChange={(open) => !open && setActiveNotification(null)}>
        <DialogContent 
          className="w-[calc(100%-2rem)] max-w-[400px] p-0 overflow-hidden border-none shadow-2xl [&>button:last-child]:hidden"
          style={{ borderRadius: `${layout.borderRadius}px`, backgroundColor: layout.bgColor }}
        >
          {activeNotification && (
            <div className="relative">
              <button onClick={() => setActiveNotification(null)} className="absolute top-4 right-4 z-20 p-1.5 rounded-full bg-black/5 text-slate-400 hover:bg-black/10 transition-colors">
                <X className="h-4 w-4" />
              </button>

              {activeNotification.image_url && (
                <div className="w-full aspect-video bg-slate-50 overflow-hidden border-b border-slate-100">
                  <img src={activeNotification.image_url} className="w-full h-full object-contain" alt="Banner" />
                </div>
              )}

              <div className="p-6 space-y-6">
                <div className="flex gap-4">
                  <div className="h-12 w-12 rounded-full flex items-center justify-center shrink-0" style={{ backgroundColor: layout.iconBgColor }}>
                    <Megaphone className="h-6 w-6" style={{ color: layout.iconColor }} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5 mb-1">
                      <ShieldCheck className="h-3 w-3" style={{ color: layout.iconColor }} />
                      <span className="text-[10px] font-bold uppercase tracking-widest opacity-80" style={{ color: layout.iconColor }}>Administração</span>
                    </div>
                    <DialogTitle className="text-xl font-bold leading-tight" style={{ color: layout.titleColor }}>
                      {activeNotification.title}
                    </DialogTitle>
                  </div>
                </div>

                <DialogDescription className="text-base leading-relaxed" style={{ color: layout.bodyColor }}>
                  {activeNotification.body}
                </DialogDescription>

                {activeNotification.link && (
                  <Button
                    size="lg"
                    className="w-full gap-2 h-12 text-sm font-bold rounded-full shadow-lg border-none"
                    style={{ backgroundColor: layout.ctaBgColor, color: layout.ctaTextColor }}
                    onClick={() => {
                      const link = activeNotification.link;
                      setActiveNotification(null);
                      window.location.href = link;
                    }}
                  >
                    Ver Detalhes <ExternalLink className="h-4 w-4" />
                  </Button>
                )}
                <Button variant="ghost" className="w-full text-xs text-muted-foreground" onClick={() => setActiveNotification(null)}>Fechar</Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
};

export default PushManager;