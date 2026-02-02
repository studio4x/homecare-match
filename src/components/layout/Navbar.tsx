import { Link, useLocation } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Heart, Menu, X } from "lucide-react";
import { useState } from "react";

const Navbar = () => {
  const location = useLocation();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const isActive = (path: string) => location.pathname === path;

  return (
    <nav className="sticky top-0 z-50 border-b border-border bg-card/95 backdrop-blur supports-[backdrop-filter]:bg-card/80">
      <div className="container mx-auto px-4">
        <div className="flex h-16 items-center justify-between">
          {/* Logo */}
          <Link to="/" className="flex items-center gap-2 transition-opacity hover:opacity-80">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary">
              <Heart className="h-5 w-5 text-primary-foreground" />
            </div>
            <span className="text-lg font-semibold text-foreground">
              HomeCare<span className="text-primary">Match</span>
            </span>
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
              to="/buscar"
              className={`text-sm font-medium transition-colors hover:text-primary ${
                isActive("/buscar") ? "text-primary" : "text-muted-foreground"
              }`}
            >
              Buscar Profissionais
            </Link>
          </div>

          {/* Desktop CTA */}
          <div className="hidden items-center gap-3 md:flex">
            <Button variant="ghost" asChild>
              <Link to="/dashboard">Meu Perfil</Link>
            </Button>
            <Button asChild>
              <Link to="/#planos">Assinar Agora</Link>
            </Button>
          </div>

          {/* Mobile Menu Button */}
          <button
            className="md:hidden"
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
                to="/buscar"
                onClick={() => setMobileMenuOpen(false)}
                className={`text-sm font-medium ${
                  isActive("/buscar") ? "text-primary" : "text-muted-foreground"
                }`}
              >
                Buscar Profissionais
              </Link>
              <div className="flex flex-col gap-2 pt-2">
                <Button variant="ghost" asChild className="justify-start">
                  <Link to="/dashboard" onClick={() => setMobileMenuOpen(false)}>
                    Meu Perfil
                  </Link>
                </Button>
                <Button asChild>
                  <Link to="/#planos" onClick={() => setMobileMenuOpen(false)}>
                    Assinar Agora
                  </Link>
                </Button>
              </div>
            </div>
          </div>
        )}
      </div>
    </nav>
  );
};

export default Navbar;
