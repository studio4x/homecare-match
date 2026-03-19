"use client";

import { useState, useEffect } from "react";
import { Link, NavLink, Navigate, Outlet, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "@/components/auth/AuthProvider";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import {
  LayoutDashboard,
  User,
  MessageSquare,
  BookOpen,
  Award,
  LogOut,
  Menu,
  X,
  Loader2,
  Search,
  LifeBuoy,
  CreditCard,
  Mail,
  Bell,
  Users,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import Navbar from "./Navbar";
import Footer from "./Footer";
import AppVersion from "./AppVersion";
import FaviconUpdater from "./FaviconUpdater";
import ScrollToTop from "../ScrollToTop";
import ImpersonationBar from "../ImpersonationBar";
import ScrollToTopButton from "../ScrollToTopButton";
import UserNotificationWidget from "../UserNotificationWidget";
import PushManager from "../PushManager";
import SuggestionDrawer from "../SuggestionDrawer";
import { useIsMobile } from "@/hooks/use-mobile";
import PwaInstallPrompt from "../PwaInstallPrompt";
import SupportChatWidget from "../SupportChatWidget";
import { trackShortLinkSignupConversion } from "@/lib/short-link-attribution";

const isTransientNetworkError = (error: unknown) => {
  const message = String((error as any)?.message || "").toLowerCase();
  return (
    message.includes("networkerror") ||
    message.includes("failed to fetch") ||
    message.includes("fetch resource") ||
    message.includes("network request failed")
  );
};

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
const normalizeRole = (value: unknown) => {
  const role = String(value || "").toLowerCase();
  if (role === "professional" || role === "company" || role === "family" || role === "affiliate" || role === "admin") {
    return role;
  }
  return "professional";
};

const UserLayout = () => {
  const { user, signOut, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const isMobile = useIsMobile();

  const [role, setRole] = useState<string | null>(null);
  const [profile, setProfile] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [isForbiddenAdmin, setIsForbiddenAdmin] = useState(false);

  useEffect(() => {
    const ensureProfileForUser = async () => {
      if (!user) return null;

      const role = normalizeRole(user.user_metadata?.role);
      const fallbackName =
        String(user.user_metadata?.full_name || "").trim() ||
        String(user.email || "").split("@")[0] ||
        "Usuario";

      const payload: Record<string, unknown> = {
        id: user.id,
        full_name: fallbackName,
        email: user.email || null,
        role,
        is_admin: role === "admin",
        email_confirmed: Boolean((user as any)?.email_confirmed_at),
        cancel_at_period_end: false,
      };

      if (role === "professional") {
        payload.subscription_tier = "free_trial";
        payload.trial_started_at = new Date().toISOString();
      }

      const { data, error } = await supabase
        .from("profiles")
        .upsert(payload, { onConflict: "id" })
        .select("*")
        .maybeSingle();

      if (error) {
        throw error;
      }

      return data || null;
    };

    const fetchProfile = async () => {
      if (!user) {
        setLoading(false);
        return;
      }
      try {
        let data: any = null;
        let error: any = null;

        for (let attempt = 0; attempt < 2; attempt += 1) {
          const response = await supabase
            .from("profiles")
            .select("*")
            .eq("id", user.id)
            .maybeSingle();

          data = response.data;
          error = response.error;

          if (!error) break;
          if (!isTransientNetworkError(error) || attempt === 1) break;
          await sleep(500);
        }

        if (error) throw error;

        if (!data) {
          try {
            const ensuredProfile = await ensureProfileForUser();
            if (ensuredProfile) {
              data = ensuredProfile;
            }
          } catch (ensureError) {
            console.error("[UserLayout] Falha ao criar perfil automaticamente:", ensureError);
          }
        }

        if (!data) {
          console.warn("[UserLayout] Perfil nao encontrado apos tentativa de bootstrap. Forcando logout...");
          await signOut();
          navigate("/login", { replace: true });
          return;
        }

        if (data.is_admin || data.role === "admin") {
          setIsForbiddenAdmin(true);
          navigate("/admin", { replace: true });
          return;
        }

        setRole(data.role);
        setProfile(data);
      } catch (err) {
        if (!isTransientNetworkError(err)) {
          console.error("Erro ao carregar perfil no layout:", err);
        }
      } finally {
        setLoading(false);
      }
    };

    fetchProfile();
  }, [user, navigate, signOut]);

  useEffect(() => {
    if (!user?.id) return;
    void trackShortLinkSignupConversion(user.id);
  }, [user?.id]);

  useEffect(() => {
    if (!role || role !== "affiliate") return;
    const path = location.pathname;
    const isAllowedAffiliatePath =
      path === "/dashboard" ||
      path === "/dashboard/afiliados" ||
      path === "/dashboard/perfil" ||
      path.startsWith("/dashboard/suporte");

    if (!isAllowedAffiliatePath) {
      navigate("/dashboard/afiliados", { replace: true });
    }
  }, [role, location.pathname, navigate]);

  if (!authLoading && !user) {
    return <Navigate to="/login" replace />;
  }

  if (authLoading || loading || isForbiddenAdmin) {
    return (
      <div className="flex h-screen items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          {isForbiddenAdmin && <p className="text-xs text-muted-foreground">Redirecionando para o Painel Admin...</p>}
        </div>
      </div>
    );
  }

  const isProfessional = role === "professional";
  const isCompany = role === "company";
  const isAffiliate = role === "affiliate";

  const navItems = [{ href: "/dashboard", label: "Inicio", icon: LayoutDashboard, end: true }];

  if (isProfessional) {
    navItems.push(
      { href: "/dashboard/perfil", label: "Meus Dados", icon: User },
      { href: "/dashboard/contatos", label: "Contatos", icon: MessageSquare },
      { href: "/dashboard/avisos", label: "Mural de Avisos", icon: Bell },
      { href: "/dashboard/cursos", label: "Cursos", icon: BookOpen },
      { href: "/dashboard/indicacoes", label: "Indicações", icon: Award },
      { href: "/dashboard/pagamentos", label: "Pagamentos", icon: CreditCard }
    );
  } else if (isCompany) {
    navItems.push(
      { href: "/dashboard/perfil", label: "Meus Dados", icon: User },
      { href: "/dashboard/contatos", label: "Contatos", icon: MessageSquare },
      { href: "/dashboard/avisos", label: "Mural de Avisos", icon: Bell },
      { href: "/dashboard/pacientes", label: "Meus Pacientes", icon: Users },
      { href: "/buscar", label: "Buscar Profissionais", icon: Search }
    );
  } else if (isAffiliate) {
    navItems.push(
      { href: "/dashboard/afiliados", label: "Afiliados", icon: Award },
      { href: "/dashboard/perfil", label: "Meus Dados", icon: User }
    );
  } else {
    navItems.push(
      { href: "/dashboard/perfil", label: "Meus Dados", icon: User },
      { href: "/dashboard/contatos", label: "Contatos", icon: MessageSquare },
      { href: "/dashboard/avisos", label: "Mural de Avisos", icon: Bell },
      { href: "/buscar", label: "Buscar Profissionais", icon: Search }
    );
  }

  navItems.push({ href: "/dashboard/suporte", label: "Suporte", icon: LifeBuoy });

  const initials =
    profile?.full_name
      ?.split(" ")
      .map((n: any) => n[0])
      .join("")
      .slice(0, 2)
      .toUpperCase() || "??";

  const isPathActive = (href: string, end?: boolean) => {
    if (end) return location.pathname === href;
    return location.pathname === href || location.pathname.startsWith(`${href}/`);
  };

  const currentPageTitle = navItems.find((item) => isPathActive(item.href, item.end))?.label || "Meu Painel";

  const mobileQuickItems = isProfessional
    ? [
        { href: "/dashboard", label: "Inicio", icon: LayoutDashboard, end: true },
        { href: "/dashboard/contatos", label: "Contatos", icon: MessageSquare },
        { href: "/dashboard/cursos", label: "Cursos", icon: BookOpen },
        { href: "/dashboard/perfil", label: "Perfil", icon: User },
      ]
    : isAffiliate
    ? [
        { href: "/dashboard", label: "Inicio", icon: LayoutDashboard, end: true },
        { href: "/dashboard/afiliados", label: "Afiliados", icon: Award },
        { href: "/dashboard/suporte", label: "Suporte", icon: LifeBuoy },
        { href: "/dashboard/perfil", label: "Perfil", icon: User },
      ]
    : isCompany
    ? [
        { href: "/dashboard", label: "Inicio", icon: LayoutDashboard, end: true },
        { href: "/dashboard/pacientes", label: "Pacientes", icon: Users },
        { href: "/buscar", label: "Buscar", icon: Search },
        { href: "/dashboard/perfil", label: "Perfil", icon: User },
      ]
    : [
        { href: "/dashboard", label: "Inicio", icon: LayoutDashboard, end: true },
        { href: "/buscar", label: "Buscar", icon: Search },
        { href: "/dashboard/contatos", label: "Contatos", icon: MessageSquare },
        { href: "/dashboard/perfil", label: "Perfil", icon: User },
      ];

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <FaviconUpdater />
      <ScrollToTop />
      <Navbar />
      <ImpersonationBar />
      <PushManager />
      <PwaInstallPrompt />
      <SuggestionDrawer autoPromptEnabled showTrigger={false} />

      <div className="flex flex-1 bg-secondary/10">
        {sidebarOpen && (
          <div className="fixed inset-0 z-[220] bg-black/50 lg:hidden" onClick={() => setSidebarOpen(false)} />
        )}

        <aside
          className={cn(
            "fixed inset-y-0 left-0 z-[230] w-72 border-r border-border bg-card transition-transform duration-200 ease-in-out lg:sticky lg:top-16 lg:h-[calc(100vh-4rem)] lg:w-64 lg:translate-x-0",
            sidebarOpen ? "translate-x-0" : "-translate-x-full"
          )}
        >
          <div className="flex h-full flex-col">
            <div className="flex items-center justify-between border-b p-4 lg:hidden">
              <div>
                <p className="text-sm font-semibold">Menu do Painel</p>
                <p className="text-[10px] text-muted-foreground">Acesse todas as secoes</p>
              </div>
              <button
                onClick={() => setSidebarOpen(false)}
                className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-border"
                aria-label="Fechar menu"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="hidden border-b p-6 lg:block">
              <div className="flex items-center gap-3">
                <Avatar className="h-10 w-10 shrink-0">
                  <AvatarImage src={profile?.avatar_url} />
                  <AvatarFallback className="bg-primary/10 font-bold text-primary">{initials}</AvatarFallback>
                </Avatar>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold">{profile?.full_name || "Usuario"}</p>
                  <p className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
                    {role === "professional" ? "Profissional" : role === "company" ? "Empresa" : role === "affiliate" ? "Afiliado" : "Familia"}
                  </p>
                  <p className="mt-0.5 flex items-center gap-1 truncate text-[10px] text-muted-foreground">
                    <Mail className="h-2.5 w-2.5 shrink-0" />
                    {user?.email}
                  </p>
                </div>
              </div>
            </div>

            <div className="flex-1 space-y-1 overflow-y-auto p-4">
              {navItems.map((item) => (
                <NavLink
                  key={item.href}
                  to={item.href}
                  end={item.end}
                  onClick={() => setSidebarOpen(false)}
                  className={({ isActive }) =>
                    cn(
                      "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors",
                      isActive
                        ? "bg-primary text-primary-foreground shadow-sm"
                        : "text-muted-foreground hover:bg-secondary hover:text-foreground"
                    )
                  }
                >
                  <item.icon className="h-4 w-4" />
                  {item.label}
                </NavLink>
              ))}
            </div>

            <div className="border-t p-4">
              <Button
                variant="ghost"
                className="w-full justify-start gap-3 text-muted-foreground hover:text-destructive"
                onClick={() => signOut()}
              >
                <LogOut className="h-4 w-4" />
                Sair da Conta
              </Button>
            </div>
          </div>
        </aside>

        <main className="flex min-w-0 flex-1 flex-col">
          <header className="sticky top-0 z-[210] border-b border-border/70 bg-card/95 backdrop-blur-xl lg:hidden">
            <div className="flex h-14 items-center gap-3 px-4">
              <button
                onClick={() => setSidebarOpen(true)}
                className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-border bg-background"
                aria-label="Abrir menu"
              >
                <Menu className="h-5 w-5 text-muted-foreground" />
              </button>
              <div className="min-w-0 flex-1">
                <span className="block truncate text-sm font-semibold">{currentPageTitle}</span>
                <span className="block truncate text-[10px] text-muted-foreground">{profile?.full_name || user?.email}</span>
              </div>
            </div>
          </header>

          <div
            className={cn(
              "mx-auto w-full max-w-6xl flex-1 p-3 pt-4 md:p-8",
              isMobile ? "pb-28" : "pb-8"
            )}
          >
            <Outlet />
          </div>
        </main>
      </div>

      {isMobile && (
        <div
          className="pointer-events-none fixed inset-x-0 bottom-0 z-40 px-3"
          style={{ paddingBottom: "calc(0.75rem + env(safe-area-inset-bottom))" }}
        >
          <nav className="pointer-events-auto mx-auto flex max-w-md items-center justify-between rounded-2xl border border-border/80 bg-card/95 p-1.5 shadow-xl backdrop-blur-xl">
            {mobileQuickItems.map((item) => {
              const active = isPathActive(item.href, item.end);
              return (
                <Link
                  key={item.href}
                  to={item.href}
                  className={`flex h-14 flex-1 flex-col items-center justify-center rounded-xl text-[11px] font-semibold transition-all ${
                    active
                      ? "bg-primary text-primary-foreground shadow"
                      : "text-muted-foreground hover:bg-secondary"
                  }`}
                >
                  <item.icon className="mb-1 h-4 w-4" />
                  <span>{item.label}</span>
                </Link>
              );
            })}
            <button
              onClick={() => setSidebarOpen(true)}
              className="flex h-14 flex-1 flex-col items-center justify-center rounded-xl text-[11px] font-semibold text-muted-foreground transition-colors hover:bg-secondary"
              aria-label="Mais opcoes"
            >
              <Menu className="mb-1 h-4 w-4" />
              <span>Mais</span>
            </button>
          </nav>
        </div>
      )}

      <UserNotificationWidget />
      <SupportChatWidget context="dashboard" />
      <Footer />
      <ScrollToTopButton hideOnMobile className="md:bottom-44 md:right-6" />
      <AppVersion />
    </div>
  );
};

export default UserLayout;

