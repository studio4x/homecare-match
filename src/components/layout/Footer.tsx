import { Link } from "react-router-dom";
import { Mail, MapPin, LifeBuoy, LayoutGrid } from "lucide-react";
import { useSiteConfig } from "@/hooks/use-site-config";
import SuggestionDrawer from "../SuggestionDrawer";

// Fallback logo
const DEFAULT_LOGO = "https://storage.googleapis.com/gpt-engineer-file-uploads/pox9V5vGnmTS4zaNDTA3kg7tKs02/uploads/1770222621940-LOGOTIPO%20HOMECARTE%20MATCH%20-%20AJUSTADO.png";

const Footer = () => {
  const { data: config } = useSiteConfig();
  
  const logoUrl = config?.footer_logo_url || config?.logo_url || DEFAULT_LOGO;
  const logoHeight = config?.footer_logo_height_px || 48;

  return (
    <footer className="border-t border-border bg-card">
      <div className="container mx-auto px-4 py-12">
        <div className="grid grid-cols-2 gap-8 md:grid-cols-3 lg:grid-cols-5">
          {/* Brand */}
          <div className="space-y-4 col-span-2 lg:col-span-1 flex flex-col items-center text-center md:items-start md:text-left">
            <Link to="/" className="flex w-full items-center justify-center gap-2 md:justify-start">
              <img 
                src={logoUrl} 
                alt="HomeCare Match" 
                style={{ height: `${logoHeight}px`, width: 'auto' }}
                className="object-contain" 
              />
            </Link>
            <p className="text-sm text-muted-foreground text-center md:text-left">
              Conectando profissionais de saúde às melhores oportunidades em Home Care.
            </p>
          </div>

          {/* Para Profissionais */}
          <div className="space-y-4 col-span-1">
            <h4 className="font-semibold text-foreground">Para Profissionais</h4>
            <ul className="space-y-2">
              <li>
                <Link to="/login#auth-sign-up" className="text-sm text-muted-foreground transition-colors hover:text-primary">
                  Criar Perfil
                </Link>
              </li>
              <li>
                <Link to="/" className="text-sm text-muted-foreground transition-colors hover:text-primary">
                  Como Funciona
                </Link>
              </li>
              <li>
                <Link to="/#planos" className="text-sm text-muted-foreground transition-colors hover:text-primary">
                  Planos e Preços
                </Link>
              </li>
              <li>
                <Link to="/dashboard" className="text-sm text-muted-foreground transition-colors hover:text-primary">
                  Meu Dashboard
                </Link>
              </li>
            </ul>
          </div>

          {/* Para Empresas */}
          <div className="space-y-4 col-span-1">
            <h4 className="font-semibold text-foreground">Para Empresas</h4>
            <ul className="space-y-2">
              <li>
                <Link to="/cadastro-empresa" className="text-sm text-muted-foreground transition-colors hover:text-primary">
                  Criar Perfil
                </Link>
              </li>
              <li>
                <Link to="/empresas" className="text-sm text-muted-foreground transition-colors hover:text-primary">
                  Soluções
                </Link>
              </li>
              <li>
                <Link to="/buscar" className="text-sm text-muted-foreground transition-colors hover:text-primary">
                  Buscar Profissionais
                </Link>
              </li>
              <li>
                <Link to="/dashboard" className="text-sm text-muted-foreground transition-colors hover:text-primary">
                  Meu Dashboard
                </Link>
              </li>
            </ul>
          </div>

           {/* Para Famílias */}
           <div className="space-y-4 col-span-1">
            <h4 className="font-semibold text-foreground">Para Famílias</h4>
            <ul className="space-y-2">
              <li>
                <Link to="/cadastro-empresa" className="text-sm text-muted-foreground transition-colors hover:text-primary">
                  Criar Perfil
                </Link>
              </li>
              <li>
                <Link to="/familias" className="text-sm text-muted-foreground transition-colors hover:text-primary">
                  Soluções
                </Link>
              </li>
              <li>
                <Link to="/buscar" className="text-sm text-muted-foreground transition-colors hover:text-primary">
                  Buscar Profissionais
                </Link>
              </li>
              <li>
                <Link to="/dashboard" className="text-sm text-muted-foreground transition-colors hover:text-primary">
                  Meu Dashboard
                </Link>
              </li>
            </ul>
          </div>

          {/* Contato */}
          <div className="space-y-4 col-span-1">
            <h4 className="font-semibold text-foreground">Suporte e Contato</h4>
            <ul className="space-y-3">
              <li>
                <Link to="/funcionalidades" className="flex items-center gap-2 text-sm text-primary font-medium hover:underline">
                  <LayoutGrid className="h-4 w-4" />
                  Funcionalidades
                </Link>
              </li>
              <li>
                <Link to="/suporte" className="flex items-center gap-2 text-sm text-primary font-medium hover:underline">
                  <LifeBuoy className="h-4 w-4" />
                  Central de Ajuda (FAQs)
                </Link>
              </li>
              <li className="md:hidden">
                <SuggestionDrawer variant="footer" />
              </li>
              <li className="flex items-center gap-2 text-sm text-muted-foreground break-all">
                <Mail className="h-4 w-4 shrink-0" />
                contato@homecarematch.com.br
              </li>
              <li className="flex items-center gap-2 text-sm text-muted-foreground">
                <MapPin className="h-4 w-4 shrink-0" />
                São Paulo, SP
              </li>
            </ul>
          </div>
        </div>

        <div className="mt-12 border-t border-border pt-6 flex flex-col md:flex-row items-center justify-between gap-4">
          <p className="text-sm text-muted-foreground">
            © {new Date().getFullYear()} HomeCare Match. Todos os direitos reservados.
          </p>
          <div className="flex items-center gap-6">
            <Link to="/politica-de-privacidade" className="text-[10px] uppercase tracking-widest text-muted-foreground/60 hover:text-primary transition-colors">
              Privacidade
            </Link>
            <Link to="/politica-de-cookies" className="text-[10px] uppercase tracking-widest text-muted-foreground/60 hover:text-primary transition-colors">
              Cookies
            </Link>
          </div>
        </div>
      </div>
    </footer>
  );
};

export default Footer;