"use client";

import { Link, useLocation } from "react-router-dom";
import { Button } from "@/components/ui/button";
import {
  Menu,
  X,
  LogOut,
  User as UserIcon,
  LayoutDashboard,
  Settings,
  Home,
  Building2,
  Users,
  LayoutGrid,
  Search,
  ChevronRight,
  Newspaper,
  CircleHelp,
} from "lucide-react";
import { useState, useEffect } from "react";
import { createPortal } from "react-dom";
import { useAuth } from "@/components/auth/AuthProvider";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { supabase } from "@/integrations/supabase/client";
import { useSiteConfig } from "@/hooks/use-site-config";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

const DEFAULT_LOGO =
  "https://storage.googleapis.com/gpt-engineer-file-uploads/pox9V5vGnmTS4zaNDTA3kg7tKs02/uploads/1770222621940-LOGOTIPO%20HOMECARTE%20MATCH%20-%20AJUSTADO.png";

const Navbar = () => {
  const location = useLocation();
  const { session, user, signOut } = useAuth();
  const { data: config } = useSiteConfig();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [portalReady, setPortalReady] = useState(false);
  const [profile, setProfile] = useState<{
    avatar_url: string | null;
    full_name: string | null;
    role: string | null;
    is_admin: boolean | null;
  } | null>(null);

  const isProfessionalLanding = location.pathname === "/";
  const isAdmin = profile?.is_admin || profile?.role === "admin";
  const dashboardPath = isAdmin ? "/admin" : "/dashboard";

  const isActive = (path: string) => {
    if (path.includes("#")) {
      const [pathname, hashFragment] = path.split("#");
      return location.pathname === pathname && location.hash === `#${hashFragment}`;
    }
    return location.pathname === path;
  };

  useEffect(() => {
    if (!user) {
      setProfile(null);
      return;
    }

    const fetchProfile = async () => {
      const { data } = await supabase
        .from("profiles")
        .select("avatar_url, full_name, role, is_admin")
        .eq("id", user.id)
        .single();

      if (data) setProfile(data);
    };

    fetchProfile();
  }, [user]);

  useEffect(() => {
    setMobileMenuOpen(false);
  }, [location.pathname, location.hash]);

  useEffect(() => {
    setPortalReady(true);
  }, []);

  const canSeeSearch = !session || (session && profile && profile.role !== "professional" && !isAdmin);
  const initials = profile?.full_name
    ? profile.full_name
        .split(" ")
        .map((name) => name[0])
        .join("")
        .slice(0, 2)
        .toUpperCase()
    : "??";

  const logoUrl = config?.logo_url || DEFAULT_LOGO;
  const logoHeight = config?.logo_height_px || 48;

  const trackLandingHeaderCta = () => {
    if (!isProfessionalLanding) return;
    window.dataLayer = window.dataLayer || [];
    window.dataLayer.push({
      event: "hcm_lp_profissionais_cta_click",
      cta_location: "header",
      page_variant: "profissionais",
    });
  };

  const mobileMenuLinks = isProfessionalLanding
    ? [
        {
          to: "/#como-funciona",
          label: "Como funciona",
          description: "Veja o passo a passo",
          icon: LayoutGrid,
        },
        {
          to: "/#planos",
          label: "Planos",
          description: "Compare opcoes",
          icon: Building2,
        },
        {
          to: "/#duvidas",
          label: "Duvidas",
          description: "Perguntas frequentes",
          icon: CircleHelp,
        },
      ]
    : [
        {
          to: "/",
          label: "Profissionais",
          description: "Conheca a versao para profissionais",
          icon: Home,
        },
        {
          to: "/empresas",
          label: "Empresas",
          description: "Fluxo dedicado para recrutadores",
          icon: Building2,
        },
        {
          to: "/familias",
          label: "Familias",
          description: "Busca para cuidado domiciliar",
          icon: Users,
        },
        {
          to: "/funcionalidades",
          label: "Funcionalidades",
          description: "Veja os principais recursos",
          icon: LayoutGrid,
        },
        {
          to: "/blog",
          label: "Blog",
          description: "Conteudo sobre Home Care",
          icon: Newspaper,
        },
        ...(canSeeSearch
          ? [
              {
                to: "/buscar",
                label: "Buscar Profissionais",
                description: "Encontre profissionais verificados",
                icon: Search,
              },
            ]
          : []),
      ];

  return (
    <nav className="sticky top-0 z-[160] border-b border-border/70 bg-card/90 backdrop-blur-xl supports-[backdrop-filter]:bg-card/70">
      <div className="container mx-auto px-4">
        <div className="flex h-16 items-center justify-between">
          <Link to="/" className="flex items-center gap-2 transition-opacity hover:opacity-80">
            <img
              src={logoUrl}
              alt="HomeCare Match"
              style={{ height: `${logoHeight}px`, width: "auto" }}
              className="max-h-10 object-contain md:max-h-none"
            />
          </Link>

          <div className="hidden items-center gap-6 md:flex">
            {isProfessionalLanding ? (
              <>
                <Link to="/#como-funciona" className="text-sm font-medium text-muted-foreground transition-colors hover:text-primary">
                  Como funciona
                </Link>
                <Link to="/#planos" className="text-sm font-medium text-muted-foreground transition-colors hover:text-primary">
                  Planos
                </Link>
                <Link to="/#duvidas" className="text-sm font-medium text-muted-foreground transition-colors hover:text-primary">
                  Duvidas
                </Link>
              </>
            ) : (
              <>
                <Link
                  to="/"
                  className={`text-sm font-medium transition-colors hover:text-primary ${
                    isActive("/") ? "text-primary" : "text-muted-foreground"
                  }`}
                >
                  Para Profissionais
                </Link>
                <Link
                  to="/empresas"
                  className={`text-sm font-medium transition-colors hover:text-primary ${
                    isActive("/empresas") ? "text-primary" : "text-muted-foreground"
                  }`}
                >
                  Para Empresas
                </Link>
                <Link
                  to="/familias"
                  className={`text-sm font-medium transition-colors hover:text-primary ${
                    isActive("/familias") ? "text-primary" : "text-muted-foreground"
                  }`}
                >
                  Para Familias
                </Link>
                <Link
                  to="/funcionalidades"
                  className={`text-sm font-medium transition-colors hover:text-primary ${
                    isActive("/funcionalidades") ? "text-primary" : "text-muted-foreground"
                  }`}
                >
                  Funcionalidades
                </Link>
                <Link
                  to="/blog"
                  className={`text-sm font-medium transition-colors hover:text-primary ${
                    location.pathname === "/blog" || location.pathname.startsWith("/blog/")
                      ? "text-primary"
                      : "text-muted-foreground"
                  }`}
                >
                  Blog
                </Link>
                {canSeeSearch && (
                  <Link
                    to="/buscar"
                    className={`text-sm font-medium transition-colors hover:text-primary ${
                      isActive("/buscar") ? "text-primary" : "text-muted-foreground"
                    }`}
                  >
                    Buscar Profissionais
                  </Link>
                )}
              </>
            )}
          </div>

          <div className="hidden items-center gap-3 md:flex">
            {isProfessionalLanding ? (
              <Button asChild size="sm" onClick={trackLandingHeaderCta}>
                <Link to={session ? dashboardPath : "/login#auth-sign-up"}>
                  {session ? "Meu Painel" : "Criar perfil"}
                </Link>
              </Button>
            ) : session ? (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button className="group flex items-center gap-3 outline-none transition-opacity hover:opacity-80">
                    <div className="flex flex-col items-end">
                      <span className="text-xs font-medium leading-none text-foreground transition-colors group-hover:text-primary">
                        Minha Conta
                      </span>
                      <span className="text-[10px] text-muted-foreground">{isAdmin ? "Painel Admin" : "Dashboard"}</span>
                    </div>
                    <Avatar className="h-9 w-9 border border-border shadow-sm transition-colors group-hover:border-primary/50">
                      <AvatarImage src={profile?.avatar_url || ""} />
                      <AvatarFallback className="bg-primary/10 text-xs font-bold text-primary">{initials}</AvatarFallback>
                    </Avatar>
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-56">
                  <DropdownMenuLabel className="font-normal">
                    <div className="flex flex-col space-y-1">
                      <p className="text-sm font-medium leading-none">{profile?.full_name || "Usuario"}</p>
                      <p className="text-xs leading-none text-muted-foreground">{user?.email}</p>
                    </div>
                  </DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem asChild>
                    <Link to={dashboardPath} className="flex cursor-pointer items-center gap-2">
                      <LayoutDashboard className="h-4 w-4" />
                      <span>Meu Painel</span>
                    </Link>
                  </DropdownMenuItem>
                  <DropdownMenuItem asChild>
                    <Link
                      to={isAdmin ? "/admin/configuracoes" : "/dashboard/perfil"}
                      className="flex cursor-pointer items-center gap-2"
                    >
                      {isAdmin ? <Settings className="h-4 w-4" /> : <UserIcon className="h-4 w-4" />}
                      <span>{isAdmin ? "Configuracoes" : "Meu Perfil"}</span>
                    </Link>
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    className="flex cursor-pointer items-center gap-2 text-destructive focus:text-destructive"
                    onClick={() => signOut()}
                  >
                    <LogOut className="h-4 w-4" />
                    <span>Sair da Conta</span>
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            ) : (
              <>
                <Button variant="ghost" asChild size="sm">
                  <Link to="/login">Entrar</Link>
                </Button>
                <Button asChild size="sm">
                  <Link to="/login#auth-sign-up">Assinar Agora</Link>
                </Button>
              </>
            )}
          </div>

          <div className="flex items-center gap-2 md:hidden">
            {!session && !isProfessionalLanding && (
              <Button size="sm" variant="outline" asChild>
                <Link to="/login">Entrar</Link>
              </Button>
            )}

            <button
              className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-border bg-background shadow-sm"
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              aria-label="Abrir menu"
            >
              {mobileMenuOpen ? <X className="h-5 w-5 text-foreground" /> : <Menu className="h-5 w-5 text-foreground" />}
            </button>
          </div>
        </div>
      </div>

      {portalReady &&
        mobileMenuOpen &&
        createPortal(
          <div className="fixed inset-0 z-[1000] md:hidden">
            <button
              className="absolute inset-0 bg-black/40 backdrop-blur-[2px]"
              onClick={() => setMobileMenuOpen(false)}
              aria-label="Fechar menu"
            />

            <div className="absolute inset-x-2 bottom-2 top-20 overflow-hidden rounded-3xl border border-border bg-card shadow-2xl">
              <div className="flex h-full flex-col">
                <div className="border-b border-border/70 bg-gradient-to-r from-primary/10 via-background to-success/10 p-4">
                  {session ? (
                    <Link
                      to={dashboardPath}
                      onClick={() => setMobileMenuOpen(false)}
                      className="flex items-center gap-3 rounded-2xl border border-border bg-background/90 p-3"
                    >
                      <Avatar className="h-10 w-10 border border-border">
                        <AvatarImage src={profile?.avatar_url || ""} />
                        <AvatarFallback className="bg-primary/10 text-xs font-bold text-primary">{initials}</AvatarFallback>
                      </Avatar>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-semibold text-foreground">{profile?.full_name || "Minha Conta"}</p>
                        <p className="truncate text-xs text-muted-foreground">{isAdmin ? "Painel administrativo" : "Abrir meu painel"}</p>
                      </div>
                      <ChevronRight className="h-4 w-4 text-muted-foreground" />
                    </Link>
                  ) : isProfessionalLanding ? (
                    <Button asChild className="h-11 w-full">
                      <Link
                        to="/login#auth-sign-up"
                        onClick={() => {
                          trackLandingHeaderCta();
                          setMobileMenuOpen(false);
                        }}
                      >
                        Criar perfil
                      </Link>
                    </Button>
                  ) : (
                    <div className="grid grid-cols-2 gap-2">
                      <Button asChild variant="outline" className="h-11">
                        <Link to="/login" onClick={() => setMobileMenuOpen(false)}>
                          Entrar
                        </Link>
                      </Button>
                      <Button asChild className="h-11">
                        <Link to="/login#auth-sign-up" onClick={() => setMobileMenuOpen(false)}>
                          Assinar
                        </Link>
                      </Button>
                    </div>
                  )}
                </div>

                <div className="flex-1 space-y-2 overflow-y-auto p-4">
                  {mobileMenuLinks.map((item) => (
                    <Link
                      key={item.to}
                      to={item.to}
                      onClick={() => setMobileMenuOpen(false)}
                      className={`flex items-center gap-3 rounded-2xl border p-3 transition-colors ${
                        isActive(item.to) ? "border-primary/40 bg-primary/10" : "border-border bg-background hover:border-primary/20"
                      }`}
                    >
                      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-secondary text-primary">
                        <item.icon className="h-4 w-4" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-semibold text-foreground">{item.label}</p>
                        <p className="truncate text-xs text-muted-foreground">{item.description}</p>
                      </div>
                      <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
                    </Link>
                  ))}
                </div>

                {session && (
                  <div className="border-t border-border p-4">
                    <Button
                      variant="ghost"
                      className="h-11 w-full justify-start gap-3 text-destructive hover:bg-destructive/10 hover:text-destructive"
                      onClick={() => {
                        setMobileMenuOpen(false);
                        signOut();
                      }}
                    >
                      <LogOut className="h-4 w-4" />
                      Sair da conta
                    </Button>
                  </div>
                )}
              </div>
            </div>
          </div>,
          document.body,
        )}
    </nav>
  );
};

export default Navbar;
