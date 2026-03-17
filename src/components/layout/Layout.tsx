import { ReactNode, lazy, Suspense, useEffect, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { Home, Search, LayoutGrid, UserRound, LayoutDashboard } from "lucide-react";
import Navbar from "./Navbar";
import ImpersonationBar from "../ImpersonationBar";
import Footer from "./Footer";
import AppVersion from "./AppVersion";
import FaviconUpdater from "./FaviconUpdater";
import ScrollToTop from "../ScrollToTop";
import ScrollToTopButton from "../ScrollToTopButton";
import { useAuth } from "@/components/auth/AuthProvider";
import { supabase } from "@/integrations/supabase/client";

const MarketingScripts = lazy(() => import("../MarketingScripts"));
const SuggestionDrawer = lazy(() => import("../SuggestionDrawer"));
const CookieConsent = lazy(() => import("../CookieConsent"));
const PushManager = lazy(() => import("../PushManager"));
const PwaInstallPrompt = lazy(() => import("../PwaInstallPrompt"));
const SupportChatWidget = lazy(() => import("../SupportChatWidget"));

interface LayoutProps {
  children: ReactNode;
}

const Layout = ({ children }: LayoutProps) => {
  const location = useLocation();
  const { session, user } = useAuth();
  const [profileRole, setProfileRole] = useState<string | null>(null);
  const [showDeferredWidgets, setShowDeferredWidgets] = useState(false);

  useEffect(() => {
    const fetchRole = async () => {
      if (!user) {
        setProfileRole(null);
        return;
      }

      const { data } = await supabase
        .from("profiles")
        .select("role")
        .eq("id", user.id)
        .maybeSingle();

      setProfileRole(data?.role ?? null);
    };

    fetchRole();
  }, [user]);

  useEffect(() => {
    let timer: number | null = null;

    const enableDeferredWidgets = () => {
      if ("requestIdleCallback" in window) {
        const win = window as Window & {
          requestIdleCallback?: (callback: IdleRequestCallback, options?: IdleRequestOptions) => number;
        };
        timer = win.requestIdleCallback?.(() => setShowDeferredWidgets(true), { timeout: 3000 }) ?? null;
        if (timer !== null) return;
      }

      timer = window.setTimeout(() => setShowDeferredWidgets(true), 1800);
    };

    if (document.readyState === "complete") {
      enableDeferredWidgets();
    } else {
      const onLoad = () => enableDeferredWidgets();
      window.addEventListener("load", onLoad, { once: true });
      return () => {
        window.removeEventListener("load", onLoad);
      };
    }

    return () => {
      if (timer === null) return;
      if ("cancelIdleCallback" in window) {
        const win = window as Window & { cancelIdleCallback?: (id: number) => void };
        win.cancelIdleCallback?.(timer);
      } else {
        window.clearTimeout(timer);
      }
    };
  }, []);

  const isTabActive = (path: string) => {
    if (path === "/") return location.pathname === "/";
    return location.pathname.startsWith(path);
  };

  const showSearchTab = !!session && (profileRole === "company" || profileRole === "family");

  const mobileTabs = [
    { to: "/", label: "Inicio", icon: Home },
    ...(showSearchTab ? [{ to: "/buscar", label: "Buscar", icon: Search }] : []),
    { to: "/funcionalidades", label: "Recursos", icon: LayoutGrid },
    {
      to: session ? "/dashboard" : "/login",
      label: session ? "Painel" : "Entrar",
      icon: session ? LayoutDashboard : UserRound,
    },
  ];

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <FaviconUpdater />
      <ScrollToTop />
      <Navbar />
      <ImpersonationBar />
      {showDeferredWidgets ? (
        <Suspense fallback={null}>
          <MarketingScripts />
          <SuggestionDrawer autoPromptEnabled />
          <CookieConsent />
          <PushManager />
          <PwaInstallPrompt />
        </Suspense>
      ) : null}

      <main className="flex-1 py-6 pb-24 md:py-12 md:pb-12">{children}</main>

      <Footer />
      {showDeferredWidgets ? (
        <Suspense fallback={null}>
          <SupportChatWidget context="public" />
        </Suspense>
      ) : null}
      <ScrollToTopButton />
      <AppVersion />

      <div
        className="pointer-events-none fixed inset-x-0 bottom-0 z-40 px-3 md:hidden"
        style={{ paddingBottom: "calc(0.75rem + env(safe-area-inset-bottom))" }}
      >
        <nav className="pointer-events-auto mx-auto flex max-w-md items-center justify-between rounded-2xl border border-border/80 bg-card/95 p-1.5 shadow-xl backdrop-blur-xl">
          {mobileTabs.map((tab) => {
            const active = isTabActive(tab.to);
            return (
              <Link
                key={tab.to}
                to={tab.to}
                className={`flex h-14 flex-1 flex-col items-center justify-center rounded-xl text-[11px] font-semibold transition-all ${
                  active
                    ? "bg-primary text-primary-foreground shadow"
                    : "text-muted-foreground hover:bg-secondary"
                }`}
              >
                <tab.icon className="mb-1 h-4 w-4" />
                <span>{tab.label}</span>
              </Link>
            );
          })}
        </nav>
      </div>
    </div>
  );
};

export default Layout;
