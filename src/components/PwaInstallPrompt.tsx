import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { useSiteConfig } from "@/hooks/use-site-config";
import { Download, X } from "lucide-react";
import { cn } from "@/lib/utils";

interface BeforeInstallPromptEvent extends Event {
  readonly platforms: string[];
  readonly userChoice: Promise<{ outcome: "accepted" | "dismissed"; platform: string }>;
  prompt: () => Promise<void>;
}

const DISMISS_KEY = "hcm-pwa-dismissed";

const PwaInstallPrompt = () => {
  const { data: config } = useSiteConfig();
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [visible, setVisible] = useState(false);
  const [installing, setInstalling] = useState(false);

  const appTitle = config?.pwa_install_title || "Instale o app HomeCare Match";
  const appDescription =
    config?.pwa_install_description || "Acesse mais rápido pelo seu celular, direto da tela inicial.";
  const appImage = config?.pwa_install_image_url || config?.pwa_icon_192_url || config?.favicon_url || "/favicon.png";

  const isStandalone = useMemo(() => {
    if (typeof window === "undefined") return false;

    const navigatorAsIOS = navigator as Navigator & { standalone?: boolean };
    return window.matchMedia("(display-mode: standalone)").matches || !!navigatorAsIOS.standalone;
  }, []);

  useEffect(() => {
    if (isStandalone) return;
    if (localStorage.getItem(DISMISS_KEY) === "true") return;

    const onBeforeInstallPrompt = (event: Event) => {
      const promptEvent = event as BeforeInstallPromptEvent;
      promptEvent.preventDefault();
      setDeferredPrompt(promptEvent);
      setVisible(true);
    };

    const onInstalled = () => {
      setVisible(false);
      setDeferredPrompt(null);
      localStorage.setItem(DISMISS_KEY, "true");
    };

    window.addEventListener("beforeinstallprompt", onBeforeInstallPrompt);
    window.addEventListener("appinstalled", onInstalled);

    return () => {
      window.removeEventListener("beforeinstallprompt", onBeforeInstallPrompt);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, [isStandalone]);

  if (!visible || !deferredPrompt || isStandalone) return null;

  const dismissPrompt = () => {
    setVisible(false);
    localStorage.setItem(DISMISS_KEY, "true");
  };

  const handleInstall = async () => {
    if (!deferredPrompt) return;

    setInstalling(true);
    try {
      await deferredPrompt.prompt();
      const result = await deferredPrompt.userChoice;
      if (result.outcome === "accepted") {
        setVisible(false);
      }
    } finally {
      setInstalling(false);
      setDeferredPrompt(null);
    }
  };

  return (
    <div className="fixed inset-x-0 bottom-3 z-[160] px-3 md:bottom-4">
      <Card className="mx-auto max-w-md border-primary/20 shadow-xl">
        <CardContent className="p-3">
          <div className="flex gap-3">
            <div className="h-12 w-12 shrink-0 rounded-lg overflow-hidden border bg-muted/20">
              <img src={appImage} alt="App" className="h-full w-full object-cover" />
            </div>

            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold leading-tight">{appTitle}</p>
              <p className="mt-1 text-xs text-muted-foreground line-clamp-2">{appDescription}</p>

              <div className="mt-2 flex items-center gap-2">
                <Button size="sm" className="h-8 gap-1.5" onClick={handleInstall} disabled={installing}>
                  <Download className={cn("h-3.5 w-3.5", installing && "animate-pulse")} />
                  {installing ? "Instalando..." : "Instalar"}
                </Button>
                <Button size="sm" variant="ghost" className="h-8 text-muted-foreground" onClick={dismissPrompt}>
                  Agora não
                </Button>
              </div>
            </div>

            <button
              type="button"
              onClick={dismissPrompt}
              className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-muted-foreground hover:bg-secondary"
              aria-label="Fechar"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default PwaInstallPrompt;
