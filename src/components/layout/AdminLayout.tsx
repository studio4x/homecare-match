"use client";

import { useState, useEffect, useRef } from "react";
import { Link, NavLink, Outlet, useNavigate } from "react-router-dom";
import { useAuth } from "@/components/auth/AuthProvider";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { 
  ShieldCheck, 
  Loader2, 
  LogOut, 
  Users, 
  Award, 
  BookOpen, 
  Settings, 
  BarChart, 
  FileCheck,
  CreditCard,
  Menu,
  X,
  MessageSquare,
  LifeBuoy,
  HelpCircle,
  AlertTriangle
} from "lucide-react";
import { cn } from "@/lib/utils";
import AuthForm from "@/components/auth/AuthForm";
import AppVersion from "./AppVersion";

const AdminLayout = () => {
  const { user, session, loading: authLoading, signOut } = useAuth();
  const [isAdmin, setIsAdmin] = useState(false);
  const [loading, setLoading] = useState(true);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const hasVerifiedOnce = useRef(false);
  
  // Verifica se existe algum admin cadastrado (para liberar cadastro se não houver)
  const [adminExists, setAdminExists] = useState(true);

  useEffect(() => {
    const checkGlobalAdmin = async () => {
      try {
        const { data, error } = await supabase.rpc('any_admin_exists');
        if (!error) setAdminExists(data);
      } catch (e) {
        console.error("[Admin] Erro global:", e);
      }
    };
    checkGlobalAdmin();
  }, []);

  useEffect(() => {
    const verifyAdmin = async () => {
      if (authLoading) return;
      if (!user) {
        setLoading(false);
        return;
      }
      
      try {
        // Só mostra o loader de tela cheia na primeira vez
        if (!hasVerifiedOnce.current) {
          setLoading(true);
        }

        const { data: rpcData } = await supabase.rpc('check_is_admin');
        const { data: profileData } = await supabase
          .from('profiles')
          .select('role, is_admin')
          .eq('id', user.id)
          .single();

        if (rpcData === true || profileData?.is_admin === true || profileData?.role === 'admin') {
          setIsAdmin(true);
        } else {
          setIsAdmin(false);
        }
        hasVerifiedOnce.current = true;
      } catch (err) {
        console.error("Erro verificação admin:", err);
        setIsAdmin(false);
      } finally {
        setLoading(false);
      }
    };

    verifyAdmin();
  }, [user, authLoading]);

  if (authLoading || (loading && !hasVerifiedOnce.current)) {
    return <div className="flex h-screen items-center justify-center"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;
  }

  if (!session || !isAdmin) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-secondary/20 p-4">
        <div className="w-full max-w-md p-8 bg-card border rounded-2xl shadow-card text-center">
          <ShieldCheck className="mx-auto h-12 w-12 text-primary mb-4" />
          <h2 className="text-2xl font-bold mb-6">Painel de Gestão</h2>
          {!session ? (
            <AuthForm mode={adminExists ? "login" : "register"} allowRegister={!adminExists} />
          ) : (
            <div>
              <div className="mb-4 flex flex-col items-center">
                <ShieldCheck className="h-12 w-12 text-destructive mb-2" />
                <h3 className="text-xl font-bold">Acesso Negado</h3>
                <p className="text-muted-foreground">Sua conta não possui permissões administrativas.</p>
              </div>
              <Button onClick={signOut}>Sair da Conta</Button>
            </div>
          )}
        </div>
      </div>
    );
  }

  const navItems = [
    { href: "/admin/verificacoes", label: "Verificações", icon: FileCheck },
    { href: "/admin/usuarios", label: "Usuários", icon: Users },
    { href: "/admin/planos", label: "Planos", icon: CreditCard },
    { href: "/admin/indicacoes", label: "Indicações", icon: Award },
    { href: "/admin/cursos", label: "Cursos", icon: BookOpen },
    { href: "/admin/denuncias", label: "Denúncias", icon: AlertTriangle },
    { href: "/admin/suporte", label: "Tickets", icon: LifeBuoy },
    { href: "/admin/faq", label: "FAQ / Ajuda", icon: HelpCircle },
    { href: "/admin/sugestoes", label: "Sugestões", icon: MessageSquare },
    { href: "/admin/marketing", label: "Marketing", icon: BarChart },
    { href: "/admin/configuracoes", label: "Configurações", icon: Settings },
  ];

  return (
    <div className="flex min-h-screen bg-secondary/10">
      {sidebarOpen && (
        <div 
          className="fixed inset-0 z-40 bg-black/50 md:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      <aside className={cn(
        "fixed inset-y-0 left-0 z-50 w-64 bg-card border-r border-border transition-transform duration-200 ease-in-out md:translate-x-0 md:static md:block",
        sidebarOpen ? "translate-x-0" : "-translate-x-full"
      )}>
        <div className="flex h-16 items-center justify-between px-6 border-b">
          <Link to="/" className="flex items-center gap-2 font-bold text-lg">
            <ShieldCheck className="h-6 w-6 text-primary" />
            <span>Admin</span>
          </Link>
          <button onClick={() => setSidebarOpen(false)} className="md:hidden">
            <X className="h-5 w-5" />
          </button>
        </div>
        
        <div className="p-4 space-y-1">
          {navItems.map((item) => (
            <NavLink
              key={item.href}
              to={item.href}
              onClick={() => setSidebarOpen(false)}
              className={({ isActive }) => cn(
                "flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors",
                isActive 
                  ? "bg-primary text-primary-foreground" 
                  : "text-muted-foreground hover:bg-secondary hover:text-foreground"
              )}
            >
              <item.icon className="h-4 w-4" />
              {item.label}
            </NavLink>
          ))}
        </div>

        <div className="absolute bottom-4 left-0 right-0 px-4">
          <Button variant="outline" className="w-full justify-start gap-2" onClick={signOut}>
            <LogOut className="h-4 w-4" />
            Sair
          </Button>
        </div>
      </aside>

      <main className="flex-1 flex flex-col min-w-0 overflow-hidden">
        <header className="h-16 flex items-center gap-4 px-4 border-b bg-card md:hidden">
          <button onClick={() => setSidebarOpen(true)}>
            <Menu className="h-6 w-6" />
          </button>
          <span className="font-semibold">Menu</span>
        </header>
        
        <div className="flex-1 overflow-auto p-4 md:p-8">
          <Outlet />
        </div>
        <AppVersion />
      </main>
    </div>
  );
};

export default AdminLayout;