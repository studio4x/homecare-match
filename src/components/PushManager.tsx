"use client";

import { useEffect, useState } from "react";
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

const PushManager = () => {
  const { user } = useAuth();
  const { data: config } = useSiteConfig();
  const [showPrompt, setShowPrompt] = useState(false);
  const [isSubscribing, setIsSubscribing] = useState(false);

  const urlBase64ToUint8Array = (base64String: string) => {
    const padding = '='.repeat((4 - base64String.length % 4) % 4);
    const base64 = (base64String + padding)
      .replace(/\-/g, '+')
      .replace(/_/g, '/');

    const rawData = window.atob(base64);
    const outputArray = new Uint8Array(rawData.length);

    for (let i = 0; i < rawData.length; ++i) {
      outputArray[i] = rawData.charCodeAt(i);
    }
    return outputArray;
  };

  const truncate = (text: string, limit: number) => {
    if (!text) return "";
    return text.length > limit ? text.substring(0, limit) + "..." : text;
  };

  useEffect(() => {
    const channel = supabase
      .channel('public-announcements')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'push_notifications' },
        async (payload) => {
          const data = payload.new as any;
          
          if (data && data.status === 'sent') {
            const isMobile = /Mobi|Android|iPhone/i.test(navigator.userAgent);
            
            // Se for mobile e tiver permissão, tenta disparar notificação nativa do sistema
            if (isMobile && Notification.permission === 'granted' && 'serviceWorker' in navigator) {
              try {
                const registration = await navigator.serviceWorker.ready;
                registration.showNotification(data.title, {
                  body: data.body,
                  icon: '/favicon.png',
                  badge: '/favicon.png',
                  image: data.image_url,
                  data: {
                    url: data.link || '/'
                  }
                } as any);
                return; // Sai para não mostrar o toast interno
              } catch (e) {
                console.error("[PushManager] Erro ao disparar notificação nativa:", e);
              }
            }

            // Fallback para Desktop ou se a permissão nativa falhar/não existir
            const safeTitle = truncate(data.title, 45);
            const safeBody = truncate(data.body, 120);

            const defaultLayout = {
              bgColor: "#ffffff",
              titleColor: "#0f172a",
              bodyColor: "#64748b",
              borderRadius: "20",
              iconBgColor: "#007BFF1a",
              iconColor: "#007BFF",
              shadowIntensity: "0.15",
              ctaBgColor: "#007BFF",
              ctaTextColor: "#ffffff",
              duration: 12
            };

            const layout = config?.push_layout_json ? {
              ...defaultLayout,
              ...config.push_layout_json
            } : defaultLayout;

            toast.custom((t) => (
              <div 
                className="w-[calc(100vw-32px)] max-w-[380px] overflow-hidden border border-slate-100 bg-white shadow-2xl pointer-events-auto mx-auto"
                style={{ 
                  backgroundColor: layout.bgColor,
                  borderRadius: `${layout.borderRadius}px`,
                  boxShadow: `0 15px 40px rgba(0,0,0,${layout.shadowIntensity})`
                }}
              >
                <button 
                  onClick={() => toast.dismiss(t)}
                  className="absolute top-3 right-3 z-20 p-1.5 rounded-full bg-black/5 text-slate-400"
                >
                  <X className="h-4 w-4" />
                </button>

                {data.image_url && (
                  <div className="hidden md:block w-full aspect-video bg-slate-50 overflow-hidden border-b border-slate-100">
                    <img 
                      src={data.image_url} 
                      className="w-full h-full object-contain" 
                      alt="Banner" 
                    />
                  </div>
                )}
                
                <div className="p-5 space-y-4">
                  <div className="flex gap-3">
                    <div 
                      className="h-9 w-9 rounded-full flex items-center justify-center shrink-0"
                      style={{ backgroundColor: layout.iconBgColor }}
                    >
                      <Megaphone className="h-4 w-4" style={{ color: layout.iconColor }} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5 mb-1">
                        <ShieldCheck className="h-3 w-3" style={{ color: layout.iconColor }} />
                        <span className="text-[8px] font-bold uppercase tracking-widest opacity-80" style={{ color: layout.iconColor }}>Administração</span>
                      </div>

                      <h4 className="font-bold leading-tight text-sm sm:text-base pr-6" style={{ color: layout.titleColor }}>{safeTitle}</h4>
                      <p className="text-xs sm:text-sm leading-relaxed" style={{ color: layout.bodyColor }}>{safeBody}</p>
                    </div>
                  </div>
                  
                  {data.link && (
                    <div className="pt-1">
                      <Button 
                        size="sm" 
                        className="h-10 w-full gap-1.5 text-xs font-bold rounded-full shadow-md"
                        style={{ backgroundColor: layout.ctaBgColor, color: layout.ctaTextColor }}
                        onClick={() => {
                          toast.dismiss(t);
                          window.location.href = data.link;
                        }}
                      >
                        Ver Detalhes <ExternalLink className="h-3 w-3" />
                      </Button>
                    </div>
                  )}
                </div>
              </div>
            ), {
              duration: (layout.duration || 12) * 1000,
              position: 'bottom-center',
            });
          }
        }
      )
      .subscribe();

    if (!('Notification' in window) || !('serviceWorker' in navigator)) return;

    if (Notification.permission === 'default') {
      const timer = setTimeout(() => setShowPrompt(true), 5000);
      return () => clearTimeout(timer);
    }
    
    if (Notification.permission === 'granted') {
      navigator.serviceWorker.register('/sw.js').catch(console.error);
    }

    return () => {
      supabase.removeChannel(channel);
    };
  }, [config]); 

  const handleSubscribe = async () => {
    if (!config?.vapid_public_key) {
      toast.error("Configuração do servidor incompleta (VAPID Key ausente).");
      return;
    }

    setIsSubscribing(true);
    try {
      const permission = await Notification.requestPermission();
      
      if (permission !== 'granted') {
        toast.error("Notificações bloqueadas no navegador.");
        setShowPrompt(false);
        return;
      }

      const registration = await navigator.serviceWorker.register('/sw.js');
      
      const subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(config.vapid_public_key)
      });

      const { error } = await supabase.from('push_subscriptions').insert({
        user_id: user?.id || null,
        subscription: subscription.toJSON(),
        device_type: /Mobi|Android/i.test(navigator.userAgent) ? 'mobile' : 'desktop'
      });

      if (error) throw error;

      toast.success("Notificações ativadas!", {
        icon: <BellRing className="h-4 w-4 text-primary" />
      });
      setShowPrompt(false);
    } catch (err) {
      console.error(err);
      toast.error("Erro ao ativar notificações.");
    } finally {
      setIsSubscribing(false);
    }
  };

  return (
    <Dialog open={showPrompt} onOpenChange={setShowPrompt}>
      <DialogContent className="w-[90vw] max-w-[400px] rounded-2xl sm:rounded-lg p-6">
        <DialogHeader>
          <div className="mx-auto h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center mb-4">
            <BellRing className="h-6 w-6 text-primary animate-pulse" />
          </div>
          <DialogTitle className="text-center text-lg sm:text-xl">Fique por dentro!</DialogTitle>
          <DialogDescription className="text-center text-sm sm:text-base">
            Deseja receber alertas sobre novos profissionais e atualizações importantes diretamente no seu dispositivo?
          </DialogDescription>
        </DialogHeader>
        <DialogFooter className="flex flex-col sm:flex-row gap-2 pt-4">
          <Button variant="ghost" onClick={() => setShowPrompt(false)} className="flex-1 order-2 sm:order-1">
            Agora não
          </Button>
          <Button onClick={handleSubscribe} disabled={isSubscribing} className="flex-1 gap-2 order-1 sm:order-2">
            {isSubscribing ? <Loader2 className="h-4 w-4 animate-spin" /> : <ShieldCheck className="h-4 w-4" />}
            Ativar Notificações
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default PushManager;