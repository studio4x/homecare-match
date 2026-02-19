"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Cookie, X } from "lucide-react";
import { Link } from "react-router-dom";
import { cn } from "@/lib/utils";

const CookieConsent = () => {
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    const consent = localStorage.getItem("cookie-consent");
    if (!consent) {
      const timer = setTimeout(() => setIsVisible(true), 2000);
      return () => clearTimeout(timer);
    }
  }, []);

  const handleAccept = () => {
    localStorage.setItem("cookie-consent", "true");
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