"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/components/auth/AuthProvider";
import { toast } from "sonner";
import { BellRing, ShieldCheck, Loader2 } from "lucide-react";
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
    if (!user) return;

    // Verifica se o navegador suporta Push
    if (!('Notification' in window) || !('serviceWorker' in navigator)) {
      console.warn("Este navegador não suporta notificações Push.");
      return;
    }

    // Se a permissão for 'default', mostramos nosso prompt personalizado
    if (Notification.permission === 'default') {
      const timer = setTimeout(() => setShowPrompt(true), 3000);
      return () => clearTimeout(timer);
    }
    
    // Se já tiver permissão, garantimos que o service worker está registrado
    if (Notification.permission === 'granted') {
      registerServiceWorker();
    }
  }, [user]);

  const registerServiceWorker = async () => {
    try {
      const registration = await navigator.serviceWorker.register('/sw.js');
      return registration;
    } catch (err) {
      console.error("Erro ao registrar Service Worker:", err);
    }
  };

  const handleSubscribe = async () => {
    setIsSubscribing(true);
    try {
      const permission = await Notification.requestPermission();
      
      if (permission !== 'granted') {
        toast.error("Você bloqueou as notificações. Para receber alertas, ative-as nas configurações do navegador.");
        setShowPrompt(false);
        return;
      }

      const registration = await registerServiceWorker();
      if (!registration) throw new Error("Falha no registro do worker.");

      // Aqui geraríamos a inscrição real com a VAPID KEY
      // Como estamos em ambiente de desenvolvimento, simulamos o registro no banco
      // para que o Admin consiga listar o dispositivo.
      
      const { error } = await supabase.from('push_subscriptions').upsert({
        user_id: user?.id,
        subscription: { endpoint: 'simulated-endpoint', keys: {} },
        device_type: /Mobi|Android/i.test(navigator.userAgent) ? 'mobile' : 'desktop'
      }, { onConflict: 'user_id,subscription' });

      if (error) throw error;

      toast.success("Notificações ativadas com sucesso!", {
        icon: <BellRing className="h-4 w-4 text-primary" />
      });
      setShowPrompt(false);
    } catch (err) {
      console.error(err);
      toast.error("Erro ao configurar notificações.");
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
            Deseja receber notificações sobre novos contatos, mensagens de suporte e atualizações importantes diretamente no seu dispositivo?
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