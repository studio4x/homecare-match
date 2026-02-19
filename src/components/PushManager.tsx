"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/components/auth/AuthProvider";
import { toast } from "sonner";
import { BellRing, ShieldCheck, Loader2, Megaphone, ExternalLink, X, Info } from "lucide-react";
import { Button } from "@/components/ui/button";
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
  const [showPrompt, setShowPrompt] = useState(false);
  const [isSubscribing, setIsSubscribing] = useState(false);

  // Função auxiliar para limitar caracteres
  const truncate = (text: string, limit: number) => {
    if (!text) return "";
    return text.length > limit ? text.substring(0, limit) + "..." : text;
  };

  useEffect(() => {
    // 1. Escutar notificações em tempo real (Broadcast)
    const channel = supabase
      .channel('public-announcements')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'push_notifications' },
        (payload) => {
          const data = payload.new as any;
          
          if (data && data.status === 'sent') {
            console.log("[PushManager] Nova notificação recebida:", data);

            // Limites de caracteres rigorosos
            const safeTitle = truncate(data.title, 45);
            const safeBody = truncate(data.body, 120);

            toast.custom((t) => (
              <div className="w-full max-w-[380px] bg-white shadow-[0_25px_60px_rgba(0,0,0,0.25)] rounded-[32px] overflow-hidden animate-slide-up border border-slate-100 relative pointer-events-auto">
                
                {/* Botão Fechar Flutuante */}
                <button 
                  onClick={() => toast.dismiss(t)}
                  className="absolute top-4 right-4 z-20 p-1.5 rounded-full bg-black/5 hover:bg-black/10 text-slate-400 hover:text-slate-600 transition-colors"
                >
                  <X className="h-3.5 w-3.5" />
                </button>

                {/* Banner da Imagem */}
                {data.image_url && (
                  <div className="w-full aspect-video bg-slate-50 flex items-center justify-center overflow-hidden border-b border-slate-100">
                    <img 
                      src={data.image_url} 
                      className="w-full h-full object-contain p-4" 
                      alt="Banner" 
                      onError={(e) => (e.currentTarget.style.display = 'none')}
                    />
                  </div>
                )}
                
                <div className="p-6 space-y-4">
                  <div className="flex gap-4">
                    <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                      <Megaphone className="h-5 w-5 text-primary" />
                    </div>
                    <div className="flex-1 space-y-1 min-w-0">
                      {/* Identificador de Administração */}
                      <div className="flex items-center gap-1.5 mb-1.5">
                        <ShieldCheck className="h-3 w-3 text-primary" />
                        <span className="text-[9px] font-bold uppercase tracking-widest text-primary/80">Administração</span>
                      </div>

                      <h4 className="font-bold text-slate-900 leading-tight text-base pr-6">{safeTitle}</h4>
                      <p className="text-sm text-slate-500 leading-relaxed">{safeBody}</p>
                    </div>
                  </div>

                  {/* Aviso de Mensagem Oficial */}
                  <div className="flex items-center gap-2 px-3 py-2 bg-secondary/30 rounded-xl border border-border/50">
                    <Info className="h-3 w-3 text-muted-foreground shrink-0" />
                    <p className="text-[9px] text-muted-foreground leading-tight">
                      Esta é uma mensagem enviada pela administração da <strong>HomeCare Match</strong>.
                    </p>
                  </div>
                  
                  {data.link && (
                    <div className="pt-2">
                      <Button 
                        size="sm" 
                        className="h-10 w-full gap-1.5 text-xs font-bold rounded-full shadow-md hover:shadow-lg transition-all"
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
              duration: 15000,
              position: 'top-center',
              unstyled: true // Remove o container padrão do Sonner
            });
          }
        }
      )
      .subscribe();

    // 2. Gerenciar Inscrição Push
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
  }, []);

  const handleSubscribe = async () => {
    setIsSubscribing(true);
    try {
      const permission = await Notification.requestPermission();
      
      if (permission !== 'granted') {
        toast.error("Notificações bloqueadas no navegador.");
        setShowPrompt(false);
        return;
      }

      await navigator.serviceWorker.register('/sw.js');

      const { error } = await supabase.from('push_subscriptions').insert({
        user_id: user?.id || null,
        subscription: { 
          endpoint: `browser-${Math.random().toString(36).substring(7)}`, 
          keys: {} 
        },
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
      <DialogContent className="sm:max-w-[400px]">
        <DialogHeader>
          <div className="mx-auto h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center mb-4">
            <BellRing className="h-6 w-6 text-primary animate-pulse" />
          </div>
          <DialogTitle className="text-center">Fique por dentro!</DialogTitle>
          <DialogDescription className="text-center">
            Deseja receber alertas sobre novos profissionais e atualizações importantes diretamente no seu dispositivo?
          </DialogDescription>
        </DialogHeader>
        <DialogFooter className="flex flex-col sm:flex-row gap-2 pt-4">
          <Button variant="ghost" onClick={() => setShowPrompt(false)} className="flex-1">
            Agora não
          </Button>
          <Button onClick={handleSubscribe} disabled={isSubscribing} className="flex-1 gap-2">
            {isSubscribing ? <Loader2 className="h-4 w-4 animate-spin" /> : <ShieldCheck className="h-4 w-4" />}
            Ativar Notificações
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default PushManager;