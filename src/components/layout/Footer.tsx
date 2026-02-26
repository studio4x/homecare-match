import { Link } from "react-router-dom";
import { Mail, LifeBuoy, LayoutGrid, ShieldCheck, Search, Building2, Home, UserRound } from "lucide-react";
import { useSiteConfig } from "@/hooks/use-site-config";
import SuggestionDrawer from "../SuggestionDrawer";

const DEFAULT_LOGO =
  "https://storage.googleapis.com/gpt-engineer-file-uploads/pox9V5vGnmTS4zaNDTA3kg7tKs02/uploads/1770222621940-LOGOTIPO%20HOMECARTE%20MATCH%20-%20AJUSTADO.png";

const Footer = () => {
  const { data: config } = useSiteConfig();

  const logoUrl = config?.footer_logo_url || config?.logo_url || DEFAULT_LOGO;
  const logoHeight = config?.footer_logo_height_px || 48;

  const quickLinks = [
    { to: "/", label: "Profissionais", icon: UserRound },
    { to: "/empresas", label: "Empresas", icon: Building2 },
    { to: "/familias", label: "Familias", icon: Home },
    { to: "/buscar", label: "Buscar", icon: Search },
  ];

  return (
    <footer className="border-t border-border bg-card">
      <div className="container mx-auto px-4 py-10 md:py-12">
        <div className="space-y-8 md:hidden">
          <div className="rounded-3xl border border-border/70 bg-gradient-to-br from-card via-card to-secondary/40 p-5 shadow-sm">
            <p className="text-center text-sm leading-relaxed text-muted-foreground">
              Conectando profissionais de saude as melhores oportunidades em Home Care.
            </p>
          </div>

          <div>
            <p className="mb-3 text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">Acesso rapido</p>
            <div className="grid grid-cols-2 gap-2">
              {quickLinks.map((item) => (
                <Link
                  key={item.to}
                  to={item.to}
                  className="flex items-center gap-2 rounded-2xl border border-border/80 bg-background px-3 py-3 text-sm font-medium text-foreground transition-colors hover:border-primary/30 hover:bg-secondary/50"
                >
                  <item.icon className="h-4 w-4 text-primary" />
                  <span className="truncate">{item.label}</span>
                </Link>
              ))}
            </div>
          </div>

          <div className="space-y-3 rounded-3xl border border-border/70 bg-background p-4">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">Suporte e contato</p>
            <Link to="/funcionalidades" className="flex items-center gap-2 text-sm font-medium text-primary hover:underline">
              <LayoutGrid className="h-4 w-4" />
              Funcionalidades
            </Link>
            <Link to="/suporte" className="flex items-center gap-2 text-sm font-medium text-primary hover:underline">
              <LifeBuoy className="h-4 w-4" />
              Central de ajuda
            </Link>
            <Link to="/validar" className="flex items-center gap-2 text-sm font-medium text-primary hover:underline">
              <ShieldCheck className="h-4 w-4" />
              Validar selo Academy
            </Link>
            <SuggestionDrawer variant="footer" />
            <div className="flex items-start gap-2 break-all text-sm text-muted-foreground">
              <Mail className="mt-0.5 h-4 w-4 shrink-0" />
              contato@homecarematch.com.br
            </div>
          </div>
        </div>

        <div className="hidden grid-cols-2 gap-8 md:grid lg:grid-cols-5">
          <div className="col-span-2 flex flex-col items-center space-y-4 text-center lg:col-span-1 lg:items-start lg:text-left">
            <Link to="/" className="flex w-full items-center justify-center gap-2 lg:justify-start">
              <img
                src={logoUrl}
                alt="HomeCare Match"
                style={{ height: `${logoHeight}px`, width: "auto" }}
                className="object-contain"
              />
            </Link>
            <p className="text-sm text-muted-foreground">
              Conectando profissionais de saude as melhores oportunidades em Home Care.
            </p>
          </div>

          <div className="space-y-4">
            <h4 className="font-semibold text-foreground">Para Profissionais</h4>
            <ul className="space-y-2">
              <li><Link to="/login#auth-sign-up" className="text-sm text-muted-foreground transition-colors hover:text-primary">Criar Perfil</Link></li>
              <li><Link to="/" className="text-sm text-muted-foreground transition-colors hover:text-primary">Como Funciona</Link></li>
              <li><Link to="/#planos" className="text-sm text-muted-foreground transition-colors hover:text-primary">Planos e Precos</Link></li>
              <li><Link to="/dashboard" className="text-sm text-muted-foreground transition-colors hover:text-primary">Meu Dashboard</Link></li>
            </ul>
          </div>

          <div className="space-y-4">
            <h4 className="font-semibold text-foreground">Para Empresas</h4>
            <ul className="space-y-2">
              <li><Link to="/cadastro-empresa" className="text-sm text-muted-foreground transition-colors hover:text-primary">Criar Perfil</Link></li>
              <li><Link to="/empresas" className="text-sm text-muted-foreground transition-colors hover:text-primary">Solucoes</Link></li>
              <li><Link to="/buscar" className="text-sm text-muted-foreground transition-colors hover:text-primary">Buscar Profissionais</Link></li>
              <li><Link to="/dashboard" className="text-sm text-muted-foreground transition-colors hover:text-primary">Meu Dashboard</Link></li>
            </ul>
          </div>

          <div className="space-y-4">
            <h4 className="font-semibold text-foreground">Para Familias</h4>
            <ul className="space-y-2">
              <li><Link to="/cadastro-empresa" className="text-sm text-muted-foreground transition-colors hover:text-primary">Criar Perfil</Link></li>
              <li><Link to="/familias" className="text-sm text-muted-foreground transition-colors hover:text-primary">Solucoes</Link></li>
              <li><Link to="/buscar" className="text-sm text-muted-foreground transition-colors hover:text-primary">Buscar Profissionais</Link></li>
              <li><Link to="/dashboard" className="text-sm text-muted-foreground transition-colors hover:text-primary">Meu Dashboard</Link></li>
            </ul>
          </div>

          <div className="space-y-4">
            <h4 className="font-semibold text-foreground">Suporte e Contato</h4>
            <ul className="space-y-3">
              <li>
                <Link to="/funcionalidades" className="flex items-center gap-2 text-sm font-medium text-primary hover:underline">
                  <LayoutGrid className="h-4 w-4" />
                  Funcionalidades
                </Link>
              </li>
              <li>
                <Link to="/suporte" className="flex items-center gap-2 text-sm font-medium text-primary hover:underline">
                  <LifeBuoy className="h-4 w-4" />
                  Central de Ajuda (FAQs)
                </Link>
              </li>
              <li>
                <Link to="/validar" className="flex items-center gap-2 text-sm font-medium text-primary hover:underline">
                  <ShieldCheck className="h-4 w-4" />
                  Validar Selo Academy
                </Link>
              </li>
              <li className="flex items-center gap-2 break-all text-sm text-muted-foreground">
                <Mail className="h-4 w-4 shrink-0" />
                contato@homecarematch.com.br
              </li>
            </ul>
          </div>
        </div>

        <div className="mt-10 flex flex-col items-center justify-between gap-4 border-t border-border pt-6 md:flex-row">
          <p className="text-center text-xs text-muted-foreground md:text-sm">
            (c) {new Date().getFullYear()} HomeCare Match | CNPJ 10.682.236/0001-09. Todos os direitos reservados.
          </p>
          <div className="flex items-center gap-6">
            <Link to="/politica-de-privacidade" className="text-[10px] uppercase tracking-widest text-muted-foreground/60 transition-colors hover:text-primary">
              Privacidade
            </Link>
            <Link to="/politica-de-cookies" className="text-[10px] uppercase tracking-widest text-muted-foreground/60 transition-colors hover:text-primary">
              Cookies
            </Link>
          </div>
        </div>
      </div>
    </footer>
  );
};

export default Footer;

