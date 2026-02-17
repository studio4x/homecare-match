"use client";

import { Link, useLocation } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { 
  Menu, 
  X, 
  LogOut, 
  User as UserIcon, 
  LayoutDashboard, 
  Settings 
} from "lucide-react";
import { useState, useEffect } from "react";
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

// Fallback logo
const DEFAULT_LOGO = "https://storage.googleapis.com/gpt-engineer-file-uploads/pox9V5vGnmTS4zaNDTA3kg7tKs02/uploads/1770222621940-LOGOTIPO%20HOMECARTE%20MATCH%20-%20AJUSTADO.png";

const Navbar = () => {
  const location = useLocation();
  const { session, user, signOut } = useAuth();
  const { data: config } = useSiteConfig();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [profile, setProfile] = useState<{ avatar_url: string | null; full_name: string | null; role: string | null; is_admin: boolean | null } | null>(null);

  const isActive = (path: string) => location.pathname === path;

  useEffect(() => {
    if (user) {
      const fetchProfile = async () => {
        const { data } = await supabase
          .from("profiles")
          .select("avatar_url, full_name, role, is_admin")
          .eq("id", user.id)
          .single();
        
        if (data) setProfile(data);
      };
      fetchProfile();
    } else {
      setProfile(null);
    }
  }, [user]);

  const initials = profile?.full_name 
    ? profile.full_name.split(" ").map(n => n[0]).join("").slice(0, 2).toUpperCase() 
    : "??";

  const isAdmin = profile?.is_admin || profile?.role === 'admin';
  const canSeeSearch = !session || (session && profile && profile.role !== 'professional' && !isAdmin);

  const logoUrl = config?.logo_url || DEFAULT_LOGO;
  const logoHeight = config?.logo_height_px || 48;

  const dashboardPath = isAdmin ? "/admin" : "/dashboard";

  return (
    <nav className="sticky top-0 z-50 border-b border-border bg-card/95 backdrop-blur supports-[backdrop-filter]:bg-card/80">
      <div className="container mx-auto px-4">
        <div className="flex h-16 items-center justify-between">
          {/* Logo */}
          <Link to="/" className="flex items-center gap-2 transition-opacity hover:opacity-80">
            <img 
              src={logoUrl} 
              alt="HomeCare Match" 
              style={{ height: `${logoHeight}px`, width: 'auto' }} 
              className="object-contain"
            />
          </Link>

          {/* Desktop Navigation */}
          <div className="hidden items-center gap-6 md:flex">
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
              Para Famílias
            </Link>
            <Link
              to="/funcionalidades"
              className={`text-sm font-medium transition-colors hover:text-primary ${
                isActive("/funcionalidades") ? "text-primary" : "text-muted-foreground"
              }`}
            >
              Funcionalidades
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
          </div>

          {/* Desktop CTA / User Menu */}
          <div className="hidden items-center gap-3 md:flex">
            {session ? (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button className="flex items-center gap-3 transition-opacity hover:opacity-80 outline-none group">
                    <div className="flex flex-col items-end">
                      <span className="text-xs font-medium text-foreground leading-none group-hover:text-primary transition-colors">Minha Conta</span>
                      <span className="text-[10px] text-muted-foreground">{isAdmin ? "Painel Admin" : "Dashboard"}</span>
                    </div>
                    <Avatar className="h-9 w-9 border border-border shadow-sm group-hover:border-primary/50 transition-colors">
                      <AvatarImage src={profile?.avatar_url || ""} />
                      <AvatarFallback className="bg-primary/10 text-xs font-bold text-primary">
                        {initials}
                      </AvatarFallback>
                    </Avatar>
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-56">
                  <DropdownMenuLabel className="font-normal">
                    <div className="flex flex-col space-y-1">
                      <p className="text-sm font-medium leading-none">{profile?.full_name || "Usuário"}</p>
                      <p className="text-xs leading-none text-muted-foreground">{user?.email}</p>
                    </div>
                  </DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem asChild>
                    <Link to={dashboardPath} className="cursor-pointer flex items-center gap-2">
                      <LayoutDashboard className="h-4 w-4" />
                      <span>Meu Painel</span>
                    </Link>
                  </DropdownMenuItem>
                  <DropdownMenuItem asChild>
                    <Link to={isAdmin ? "/admin/configuracoes" : "/dashboard/perfil"} className="cursor-pointer flex items-center gap-2">
                      {isAdmin ? <Settings className="h-4 w-4" /> : <UserIcon className="h-4 w-4" />}
                      <span>{isAdmin ? "Configurações" : "Meu Perfil"}</span>
                    </Link>
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem 
                    className="text-destructive focus:text-destructive cursor-pointer flex items-center gap-2"
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

          {/* Mobile Menu Button */}
          <button
            className="md:hidden p-2"
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            aria-label="Toggle menu"
          >
            {mobileMenuOpen ? (
              <X className="h-6 w-6 text-foreground" />
            ) : (
              <Menu className="h-6 w-6 text-foreground" />
            )}
          </button>
        </div>

        {/* Mobile Menu */}
        {mobileMenuOpen && (
          <div className="animate-fade-in border-t border-border py-4 md:hidden">
            <div className="flex flex-col gap-4">
              <Link
                to="/"
                onClick={() => setMobileMenuOpen(false)}
                className={`text-sm font-medium ${
                  isActive("/") ? "text-primary" : "text-muted-foreground"
                }`}
              >
                Para Profissionais
              </Link>
              <Link
                to="/empresas"
                onClick={() => setMobileMenuOpen(false)}
                className={`text-sm font-medium ${
                  isActive("/empresas") ? "text-primary" : "text-muted-foreground"
                }`}
              >
                Para Empresas
              </Link>
              <Link
                to="/familias"
                onClick={() => setMobileMenuOpen(false)}
                className={`text-sm font-medium ${
                  isActive("/familias") ? "text-primary" : "text-muted-foreground"
                }`}
              >
                Para Famílias
              </Link>
              <Link
                to="/funcionalidades"
                onClick={() => setMobileMenuOpen(false)}
                className={`text-sm font-medium ${
                  isActive("/funcionalidades") ? "text-primary" : "text-muted-foreground"
                }`}
              >
                Funcionalidades
              </Link>
              {canSeeSearch && (
                <Link
                  to="/buscar"
                  onClick={() => setMobileMenuOpen(false)}
                  className={`text-sm font-medium ${
                    isActive("/buscar") ? "text-primary" : "text-muted-foreground"
                  }`}
                >
                  Buscar Profissionais
                </Link>
              )}
              <div className="flex flex-col gap-2 pt-2 border-t border-border mt-2">
                {session ? (
                  <>
                    <Button variant="outline" asChild className="justify-start gap-3 h-12">
                      <Link to={dashboardPath} onClick={() => setMobileMenuOpen(false)}>
                        <Avatar className="h-7 w-7">
                          <AvatarImage src={profile?.avatar_url || ""} />
                          <AvatarFallback className="text-[10px]">{initials}</AvatarFallback>
                        </Avatar>
                        {isAdmin ? "Painel Admin" : "Meu Perfil"}
                      </Link>
                    </Button>
                    <Button 
                      variant="ghost" 
                      className="justify-start gap-3 h-12 text-destructive hover:text-destructive hover:bg-destructive/10"
                      onClick={() => {
                        setMobileMenuOpen(false);
                        signOut();
                      }}
                    >
                      <LogOut className="h-4 w-4" />
                      Sair da Conta
                    </Button>
                  </>
                ) : (
                  <>
                    <Button asChild className="bg-success hover:bg-success/90 text-white">
                      <Link to="/login" onClick={() => setMobileMenuOpen(false)}>
                        Entrar
                      </Link>
                    </Button>
                    <Button asChild>
                      <Link to="/login#auth-sign-up" onClick={() => setMobileMenuOpen(false)}>
                        Assinar Agora
                      </Link>
                    </Button>
                  </>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </nav>
  );
};

export default Navbar;