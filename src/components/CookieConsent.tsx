"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Cookie, X } from "lucide-react";
import { Link } from "react-router-dom";

const CONSENT_KEY = "cookie-consent";
const PWA_DISMISS_KEY = "hcm-pwa-dismissed";
const PWA_PROMPT_HANDLED_KEY = "hcm-pwa-prompt-handled";
const PWA_PROMPT_ACTIVE_KEY = "hcm-pwa-prompt-active";
const PWA_PROMPT_VISIBLE_EVENT = "hcm-pwa-prompt-visible";
const PWA_PROMPT_HANDLED_EVENT = "hcm-pwa-prompt-handled";

const CookieConsent = () => {
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    if (localStorage.getItem(CONSENT_KEY) === "true") return;

    let showTimer: ReturnType<typeof setTimeout> | null = null;
    let staleGuardTimer: ReturnType<typeof setTimeout> | null = null;

    const clearShowTimer = () => {
      if (showTimer) {
        clearTimeout(showTimer);
        showTimer = null;
      }
    };

    const scheduleShow = (delayMs: number) => {
      clearShowTimer();
      showTimer = setTimeout(() => setIsVisible(true), delayMs);
    };

    const hasResolvedPwaPrompt =
      localStorage.getItem(PWA_PROMPT_HANDLED_KEY) === "true" ||
      localStorage.getItem(PWA_DISMISS_KEY) === "true";
    const isPwaPromptActive = localStorage.getItem(PWA_PROMPT_ACTIVE_KEY) === "true";

    if (hasResolvedPwaPrompt) {
      scheduleShow(2000);
    } else if (!isPwaPromptActive) {
      // Aguarda o prompt PWA aparecer; se nao aparecer, libera o cookie sem sobrepor.
      scheduleShow(3500);
    } else {
      // Protege contra estado preso no localStorage.
      staleGuardTimer = setTimeout(() => setIsVisible(true), 15000);
    }

    const handlePwaPromptVisible = () => {
      clearShowTimer();
    };

    const handlePwaPromptHandled = () => {
      if (staleGuardTimer) {
        clearTimeout(staleGuardTimer);
        staleGuardTimer = null;
      }
      scheduleShow(300);
    };

    window.addEventListener(PWA_PROMPT_VISIBLE_EVENT, handlePwaPromptVisible);
    window.addEventListener(PWA_PROMPT_HANDLED_EVENT, handlePwaPromptHandled);

    return () => {
      clearShowTimer();
      if (staleGuardTimer) clearTimeout(staleGuardTimer);
      window.removeEventListener(PWA_PROMPT_VISIBLE_EVENT, handlePwaPromptVisible);
      window.removeEventListener(PWA_PROMPT_HANDLED_EVENT, handlePwaPromptHandled);
    };
  }, []);

  const handleAccept = () => {
    localStorage.setItem(CONSENT_KEY, "true");
    setIsVisible(false);
    
    // Dispara um evento customizado para que outros componentes (como o PushManager)
    // saibam que a política foi aceita nesta sessão.
    window.dispatchEvent(new Event("cookie-consent-accepted"));
  };

  if (!isVisible) return null;

  return (
    <div className="fixed bottom-4 left-4 right-4 z-[100] md:left-auto md:right-8 md:max-w-md animate-slide-up">
      <div className="bg-card border border-border shadow-2xl rounded-2xl p-6 relative overflow-hidden">
        <div className="absolute top-0 left-0 w-1 h-full bg-primary" />
        
        <div className="flex items-start gap-4">
          <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
            <Cookie className="h-5 w-5 text-primary" />
          </div>
          
          <div className="space-y-3">
            <h4 className="font-bold text-foreground">Privacidade e Cookies</h4>
            <p className="text-sm text-muted-foreground leading-relaxed">
              Utilizamos cookies para melhorar sua experiência e analisar o tráfego. Ao continuar navegando, você concorda com nossa{" "}
              <Link to="/politica-de-privacidade" className="text-primary hover:underline font-medium">Política de Privacidade</Link>.
            </p>
            
            <div className="flex items-center gap-3 pt-2">
              <Button size="sm" onClick={handleAccept} className="px-8">
                Aceitar
              </Button>
              <Button variant="ghost" size="sm" asChild>
                <Link to="/politica-de-cookies">Saiba mais</Link>
              </Button>
            </div>
          </div>

          <button 
            onClick={() => setIsVisible(false)}
            className="absolute top-4 right-4 text-muted-foreground hover:text-foreground transition-colors"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>
  );
};

export default CookieConsent;
