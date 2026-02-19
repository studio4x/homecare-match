"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/components/auth/AuthProvider";
import { toast } from "sonner";
import { BellRing, ShieldCheck, Loader2, Megaphone } from "lucide-react";
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
    // Isso permite que usuários anônimos vejam a mensagem se estiverem com o site aberto
    const channel = supabase
      .channel('public-announcements')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'push_notifications' },
        (payload) => {
          if (payload.new.status === 'sent' || !payload.new.scheduled_for) {
            toast(payload.new.title, {
              description: payload.new.body,
              icon: <Megaphone className="h-4 w-4 text-primary" />,
              duration: 10000,
              action: payload.new.link ? {
                label: "Ver",
                onClick: () => window.location.href = payload.new.link
              } : undefined
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
          endpoint: `browser-\${Math.random().toString(36).substring(7)}`, 
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