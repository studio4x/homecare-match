"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/components/auth/AuthProvider";
import { toast } from "sonner";
import { BellRing, ShieldCheck, Loader2, Megaphone, ExternalLink } from "lucide-react";
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

  useEffect(() => {
    // 1. Escutar notificações em tempo real (Broadcast)
    const channel = supabase
      .channel('public-announcements')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'push_notifications' },
        (payload) => {
          const data = payload.new as any;
          
          // Só processa se o status for 'sent' (enviado)
          if (data && data.status === 'sent') {
            console.log("[PushManager] Nova notificação recebida:", data);

            // Usamos toast.custom com unstyled: true para remover o quadro de fundo padrão
            toast.custom((t) => (
              <div className="w-full max-w-[400px] bg-card border border-primary/20 shadow-2xl rounded-2xl overflow-hidden animate-slide-up pointer-events-auto">
                {/* Banner da Imagem */}
                {data.image_url && (
                  <div className="aspect-video w-full overflow-hidden bg-black border-b">
                    <img 
                      src={data.image_url} 
                      className="w-full h-full object-cover" 
                      alt="Banner da Notificação" 
                      onError={(e) => (e.currentTarget.style.display = 'none')}
                    />
                  </div>
                )}
                
                <div className="p-5 flex gap-4">
                  <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                    <Megaphone className="h-5 w-5 text-primary" />
                  </div>
                  <div className="flex-1 space-y-1 min-w-0">
                    <h4 className="font-bold text-foreground leading-tight truncate">{data.title}</h4>
                    <p className="text-sm text-muted-foreground leading-relaxed line-clamp-3">{data.body}</p>
                    
                    <div className="pt-3 flex items-center justify-between gap-2">
                      {data.link ? (
                        <Button 
                          size="sm" 
                          className="h-8 gap-1.5 text-xs"
                          onClick={() => {
                            toast.dismiss(t);
                            window.location.href = data.link;
                          }}
                        >
                          Ver Detalhes <ExternalLink className="h-3 w-3" />
                        </Button>
                      ) : (
                        <div />
                      )}
                      <button 
                        onClick={() => toast.dismiss(t)}
                        className="text-[10px] text-muted-foreground hover:text-foreground font-medium uppercase tracking-wider"
                      >
                        Fechar
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            ), {
              duration: 15000,
              position: 'top-center',
              unstyled: true // Remove o quadro branco/sombra padrão do container do toast
            });
          }
        }
      )
      .subscribe();

    // 2. Gerenciar Inscrição Push (Banner do Sistema)
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

      // Registro da inscrição no banco
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