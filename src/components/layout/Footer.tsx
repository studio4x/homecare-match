import { Link } from "react-router-dom";
import { Mail, Phone, MapPin } from "lucide-react";
import { useSiteConfig } from "../../contexts/SiteConfigProvider";

const Footer = () => {
  const config = useSiteConfig();
  const logoUrl = config?.footer_logo_url || config?.logo_url || "/logo.png";
  const logoHeight = config?.footer_logo_height_px || 32;

  return (
    <footer className="border-t border-border bg-card">
      <div className="container mx-auto px-4 py-12">
        <div className="grid gap-8 md:grid-cols-4">
          {/* Brand */}
          <div className="space-y-4">
            <Link to="/" className="flex items-center gap-2">
              <img 
                src={logoUrl} 
                alt="HomeCareMatch" 
                style={{ height: `${logoHeight}px` }}
              />
            </Link>
            <p className="text-sm text-muted-foreground">
              Conectando profissionais de saúde às melhores oportunidades em Home Care.
            </p>
          </div>

          {/* Para Profissionais */}
          <div className="space-y-4">
            <h4 className="font-semibold text-foreground">Para Profissionais</h4>
            <ul className="space-y-2">
              <li>
                <Link to="/" className="text-sm text-muted-foreground transition-colors hover:text-primary">
                  Criar Perfil
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
          <div className="space-y-4">
            <h4 className="font-semibold text-foreground">Para Empresas</h4>
            <ul className="space-y-2">
              <li>
                <Link to="/empresas" className="text-sm text-muted-foreground transition-colors hover:text-primary">
                  Como Funciona
                </Link>
              </li>
              <li>
                <Link to="/buscar" className="text-sm text-muted-foreground transition-colors hover:text-primary">
                  Buscar Profissionais
                </Link>
              </li>
            </ul>
          </div>

          {/* Contato */}
          <div className="space-y-4">
            <h4 className="font-semibold text-foreground">Contato</h4>
            <ul className="space-y-3">
              <li className="flex items-center gap-2 text-sm text-muted-foreground">
                <Mail className="h-4 w-4" />
                contato@homecarematch.com.br
              </li>
              <li className="flex items-center gap-2 text-sm text-muted-foreground">
                <Phone className="h-4 w-4" />
                (11) 99999-9999
              </li>
              <li className="flex items-center gap-2 text-sm text-muted-foreground">
                <MapPin className="h-4 w-4" />
                São Paulo, SP
              </li>
            </ul>
          </div>
        </div>

        <div className="mt-12 border-t border-border pt-6">
          <p className="text-center text-sm text-muted-foreground">
            © {new Date().getFullYear()} HomeCareMatch. Todos os direitos reservados.
          </p>
        </div>
      </div>
    </footer>
  );
};

export default Footer;