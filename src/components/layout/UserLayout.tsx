"use client";

import { useState, useEffect } from "react";
import { Link, NavLink, Outlet, useNavigate } from "react-router-dom";
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
  Bell
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import Navbar from "./Navbar";
import Footer from "./Footer";
import AppVersion from "./AppVersion";
import FaviconUpdater from "./FaviconUpdater";
import ScrollToTop from "../ScrollToTop";
import MarketingScripts from "../MarketingScripts";
import ImpersonationBar from "../ImpersonationBar";
import ScrollToTopButton from "../ScrollToTopButton";
import UserNotificationWidget from "../UserNotificationWidget";
import PushManager from "../PushManager";

const UserLayout = () => {
  const { user, signOut, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const [role, setRole] = useState<string | null>(null);
  const [profile, setProfile] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [isForbiddenAdmin, setIsForbiddenAdmin] = useState(false);

  useEffect(() => {
    const fetchProfile = async () => {
      if (!user) return;
      try {
        const { data, error } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', user.id)
          .maybeSingle();
        
        if (error) throw error;

        // Se o usuário está logado mas o perfil não existe, ele foi excluído
        if (!data) {
          console.warn("[UserLayout] Perfil não encontrado. Forçando logout...");
          await signOut();
          navigate('/login', { replace: true });
          return;
        }

        if (data.is_admin || data.role === 'admin') {
          setIsForbiddenAdmin(true);
          navigate('/admin', { replace: true });
          return;
        }
        
        setRole(data.role);
        setProfile(data);
      } catch (err) {
        console.error("Erro ao carregar perfil no layout:", err);
      } finally {
        setLoading(false);
      }
    };
    fetchProfile();
  }, [user, navigate]);

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

  const isProfessional = role === 'professional';

  const navItems = [
    { href: "/dashboard", label: "Início", icon: LayoutDashboard, end: true },
    { href: "/dashboard/perfil", label: "Meus Dados", icon: User },
    { href: "/dashboard/contatos", label: "Contatos", icon: MessageSquare },
    { href: "/dashboard/avisos", label: "Mural de Avisos", icon: Bell },
  ];

  if (isProfessional) {
    navItems.push(
      { href: "/dashboard/cursos", label: "Cursos", icon: BookOpen },
      { href: "/dashboard/indicacoes", label: "Indicações", icon: Award },
      { href: "/dashboard/pagamentos", label: "Pagamentos", icon: CreditCard }
    );
  } else {
    navItems.push({ href: "/buscar", label: "Buscar Profissionais", icon: Search });
  }

  navItems.push({ href: "/dashboard/suporte", label: "Suporte", icon: LifeBuoy });

  const initials = profile?.full_name?.split(" ").map((n: any) => n[0]).join("").slice(0, 2).toUpperCase() || "??";

  return (
    <div className="flex min-h-screen flex-col">
      <FaviconUpdater />
      <ScrollToTop />
      <Navbar />
      <ImpersonationBar />
      <MarketingScripts />
      <PushManager />
      
      <div className="flex flex-1 bg-secondary/10">
        {sidebarOpen && (
          <div 
            className="fixed inset-0 z-40 bg-black/50 lg:hidden"
            onClick={() => setSidebarOpen(false)}
          />
        )}

        <aside className={cn(
          "fixed inset-y-0 left-0 z-50 w-64 bg-card border-r border-border transition-transform duration-200 ease-in-out lg:translate-x-0 lg:sticky lg:top-16 lg:h-[calc(100vh-4rem)] lg:block",
          sidebarOpen ? "translate-x-0" : "-translate-x-full"
        )}>
          <div className="flex flex-col h-full">
            <div className="p-6 border-b hidden lg:block">
              <div className="flex items-center gap-3">
                <Avatar className="h-10 w-10 shrink-0">
                  <AvatarImage src={profile?.avatar_url} />
                  <AvatarFallback className="bg-primary/10 text-primary font-bold">{initials}</AvatarFallback>
                </Avatar>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold truncate">{profile?.full_name || "Usuário"}</p>
                  <p className="text-[10px] text-muted-foreground uppercase tracking-wider font-medium">
                    {role === 'professional' ? "Profissional" : role === 'company' ? "Empresa" : "Família"}
                  </p>
                  <p className="text-[10px] text-muted-foreground truncate mt-0.5 flex items-center gap-1">
                    <Mail className="h-2.5 w-2.5 shrink-0" />
                    {user?.email}
                  </p>
                </div>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto p-4 space-y-1">
              {navItems.map((item) => (
                <NavLink
                  key={item.href}
                  to={item.href}
                  end={item.end}
                  onClick={() => setSidebarOpen(false)}
                  className={({ isActive }) => cn(
                    "flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors",
                    isActive 
                      ? "bg-primary text-primary-foreground shadow-sm" 
                      : "text-muted-foreground hover:bg-secondary hover:text-foreground"
                  )}
                >
                  <item.icon className="h-4 w-4" />
                  {item.label}
                </NavLink>
              ))}
            </div>

            <div className="p-4 border-t">
              <Button variant="ghost" className="w-full justify-start gap-3 text-muted-foreground hover:text-destructive" onClick={() => signOut()}>
                <LogOut className="h-4 w-4" />
                Sair da Conta
              </Button>
            </div>
          </div>
        </aside>

        <main className="flex-1 flex flex-col min-w-0">
          <header className="h-14 flex items-center gap-4 px-4 border-b bg-card lg:hidden sticky top-0 z-30">
            <button onClick={() => setSidebarOpen(true)}>
              <Menu className="h-6 w-6 text-muted-foreground" />
            </button>
            <div className="flex-1 min-w-0">
              <span className="font-semibold text-sm block truncate">Meu Painel</span>
              <span className="text-[10px] text-muted-foreground block truncate">{user?.email}</span>
            </div>
          </header>
          
          <div className="flex-1 p-4 md:p-8 max-w-6xl mx-auto w-full">
            <Outlet />
          </div>
        </main>
      </div>

      <UserNotificationWidget />
      <Footer />
      <ScrollToTopButton />
      <AppVersion />
    </div>
  );
};

export default UserLayout;