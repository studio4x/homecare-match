"use client";

import { Link, useLocation } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Menu, X } from "lucide-react";
import { useState, useEffect } from "react";
import { useAuth } from "@/components/auth/AuthProvider";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { supabase } from "@/integrations/supabase/client";
import { useSiteConfig } from "@/hooks/use-site-config";

// Fallback logo
const DEFAULT_LOGO = "https://storage.googleapis.com/gpt-engineer-file-uploads/pox9V5vGnmTS4zaNDTA3kg7tKs02/uploads/1770222621940-LOGOTIPO%20HOMECARTE%20MATCH%20-%20AJUSTADO.png";

const Navbar = () => {
  const location = useLocation();
  const { session, user } = useAuth();
  const { data: config } = useSiteConfig();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [profile, setProfile] = useState<{ avatar_url: string | null; full_name: string | null; role: string | null } | null>(null);

  const isActive = (path: string) => location.pathname === path;

  useEffect(() => {
    if (user) {
      const fetchProfile = async () => {
        const { data } = await supabase
          .from("profiles")
          .select("avatar_url, full_name, role")
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

  const canSeeSearch = !session || (session && profile && profile.role !== 'professional');

  const logoUrl = config?.logo_url || DEFAULT_LOGO;
  const logoHeight = config?.logo_height_px || 48;

  return (
    <nav className="sticky top-0 z-50 border-b border-border bg-card/95 backdrop-blur supports-[backdrop-filter]:bg-card/80">
      <div className="container mx-auto px-4">
        <div className="flex h-16 items-center justify-between">
          {/* Logo */}
          <Link to="/" className="flex items-center gap-2 transition-opacity hover:opacity-80">
            <img 
              src={logoUrl} 
              alt="HomeCareMatch" 
              style={{ height: `${logoHeight}px`, maxHeight: '60px' }} 
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

          {/* Desktop CTA */}
          <div className="hidden items-center gap-3 md:flex">
            {session ? (
              <Link to="/dashboard" className="flex items-center gap-3 transition-opacity hover:opacity-80">
                <div className="flex flex-col items-end">
                  <span className="text-xs font-medium text-foreground leading-none">Minha Conta</span>
                  <span className="text-[10px] text-muted-foreground">Dashboard</span>
                </div>
                <Avatar className="h-9 w-9 border border-border shadow-sm">
                  <AvatarImage src={profile?.avatar_url || ""} />
                  <AvatarFallback className="bg-primary/10 text-xs font-bold text-primary">
                    {initials}
                  </AvatarFallback>
                </Avatar>
              </Link>
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
                  <Button variant="outline" asChild className="justify-start gap-3 h-12">
                    <Link to="/dashboard" onClick={() => setMobileMenuOpen(false)}>
                      <Avatar className="h-7 w-7">
                        <AvatarImage src={profile?.avatar_url || ""} />
                        <AvatarFallback className="text-[10px]">{initials}</AvatarFallback>
                      </Avatar>
                      Meu Perfil
                    </Link>
                  </Button>
                ) : (
                  <>
                    <Button variant="ghost" asChild className="justify-start">
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