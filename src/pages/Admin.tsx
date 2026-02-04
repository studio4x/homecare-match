"use client";

import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import Layout from "@/components/layout/Layout";
import AuthForm from "@/components/auth/AuthForm";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { 
  ShieldCheck, 
  Loader2,
  LogOut,
  Lock,
  Settings,
  Palette
} from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/components/auth/AuthProvider";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
// Removendo importações não utilizadas para simplificar
// ... (outras importações de Admin.tsx)

const Admin = () => {
  const { user, session, loading: authLoading, signOut } = useAuth();
  const [loading, setLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);
  const [adminExists, setAdminExists] = useState(true);
  
  const [siteConfig, setSiteConfig] = useState({ 
    logo_url: '', 
    favicon_url: '', 
    logo_height_px: 48,
    primary_hex: '#007BFF',
    success_hex: '#28A745',
    background_hex: '#F8F9FA',
    foreground_hex: '#182742',
  });
  
  const [isSavingConfig, setIsSavingConfig] = useState(false);
  // ... (outros estados de Admin.tsx)

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
        setLoading(true);
        const { data, error } = await supabase.rpc('check_is_admin');
        
        if (!error && data === true) {
          setIsAdmin(true);
          await fetchData();
        } else {
          setIsAdmin(false);
        }
      } catch (err) {
        console.error("[Admin] Erro verificação:", err);
        setIsAdmin(false);
      } finally {
        setLoading(false);
      }
    };

    verifyAdmin();
  }, [user, authLoading]);

  const fetchData = async () => {
    try {
      const { data, error } = await supabase.from("site_config").select("*").eq('id', 1).single();
      if (error) throw error;
      if (data) setSiteConfig(data);
      // ... (outras chamadas de fetch de Admin.tsx)
    } catch (error) {
      console.error("[Admin] Erro fetch:", error);
    }
  };

  const handleSaveConfig = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSavingConfig(true);
    try {
      const { error } = await supabase
        .from('site_config')
        .update({
          logo_url: siteConfig.logo_url,
          favicon_url: siteConfig.favicon_url,
          logo_height_px: siteConfig.logo_height_px,
          primary_hex: siteConfig.primary_hex,
          success_hex: siteConfig.success_hex,
          background_hex: siteConfig.background_hex,
          foreground_hex: siteConfig.foreground_hex,
        })
        .eq('id', 1);
      
      if (error) throw error;
      toast.success("Configurações salvas! A página será recarregada para aplicar as mudanças.");
      setTimeout(() => window.location.reload(), 2000);
    } catch (error) {
      toast.error("Erro ao salvar configurações.");
    } finally {
      setIsSavingConfig(false);
    }
  };

  // ... (outras funções de handle de Admin.tsx)

  if (authLoading || loading) {
    return <Layout><div className="flex h-[60vh] items-center justify-center"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div></Layout>;
  }
  
  if (!session) {
    return (
      <Layout>
        <div className="flex min-h-[calc(100vh-16rem)] items-center justify-center py-12 px-4 bg-secondary/20">
          <div className="w-full max-w-md p-8 bg-card border rounded-2xl shadow-card text-center">
            <Lock className="mx-auto h-12 w-12 text-primary mb-4" />
            <h2 className="text-2xl font-bold mb-6">Painel de Gestão</h2>
            <AuthForm mode={adminExists ? "login" : "register"} allowRegister={!adminExists} />
          </div>
        </div>
      </Layout>
    );
  }

  if (!isAdmin) {
    // ... (código de acesso negado)
  }

  return (
    <Layout>
      <div className="min-h-screen bg-secondary/20 py-8">
        <div className="container mx-auto px-4">
          <div className="mb-8 flex items-center justify-between">
            <h1 className="text-3xl font-bold flex items-center gap-3"><ShieldCheck className="h-8 w-8 text-primary" /> Painel Admin</h1>
            <Button variant="ghost" onClick={signOut} className="gap-2 hover:text-destructive"><LogOut className="h-4 w-4" /> Sair</Button>
          </div>

          <Tabs defaultValue="settings" className="space-y-6">
            <TabsList className="bg-card border w-full justify-start md:w-auto">
              <TabsTrigger value="verifications">Verificações</TabsTrigger>
              <TabsTrigger value="users">Usuários</TabsTrigger>
              <TabsTrigger value="plans">Planos</TabsTrigger>
              <TabsTrigger value="settings">Configurações</TabsTrigger>
            </TabsList>

            {/* ... (outras TabsContent) */}

            <TabsContent value="settings">
              <div className="rounded-xl border bg-card p-6 shadow-sm max-w-2xl mx-auto">
                <form onSubmit={handleSaveConfig} className="space-y-8">
                  <div>
                    <h3 className="text-lg font-semibold mb-4 flex items-center gap-2"><Settings className="h-5 w-5" /> Identidade Visual</h3>
                    <div className="space-y-4">
                      <div className="space-y-2">
                        <Label htmlFor="logo_url">URL do Logotipo</Label>
                        <Input id="logo_url" value={siteConfig.logo_url} onChange={e => setSiteConfig({...siteConfig, logo_url: e.target.value})} />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="favicon_url">URL do Favicon</Label>
                        <Input id="favicon_url" value={siteConfig.favicon_url} onChange={e => setSiteConfig({...siteConfig, favicon_url: e.target.value})} />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="logo_height">Altura do Logotipo (pixels)</Label>
                        <Input id="logo_height" type="number" value={siteConfig.logo_height_px} onChange={e => setSiteConfig({...siteConfig, logo_height_px: parseInt(e.target.value) || 48})} />
                      </div>
                    </div>
                  </div>

                  <div>
                    <h3 className="text-lg font-semibold mb-4 flex items-center gap-2"><Palette className="h-5 w-5" /> Paleta de Cores</h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      {[
                        { id: 'primary_hex', label: 'Cor Primária' },
                        { id: 'success_hex', label: 'Cor de Sucesso/Destaque' },
                        { id: 'background_hex', label: 'Cor de Fundo' },
                        { id: 'foreground_hex', label: 'Cor do Texto Principal' },
                      ].map(({ id, label }) => (
                        <div key={id} className="space-y-2">
                          <Label htmlFor={id}>{label}</Label>
                          <div className="flex items-center gap-2">
                            <Input
                              type="color"
                              className="p-1 h-10 w-12"
                              value={siteConfig[id as keyof typeof siteConfig]}
                              onChange={e => setSiteConfig({...siteConfig, [id]: e.target.value})}
                            />
                            <Input
                              id={id}
                              value={siteConfig[id as keyof typeof siteConfig]}
                              onChange={e => setSiteConfig({...siteConfig, [id]: e.target.value})}
                            />
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="flex justify-end pt-4 border-t">
                    <Button type="submit" disabled={isSavingConfig}>
                      {isSavingConfig && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
                      Salvar Todas as Configurações
                    </Button>
                  </div>
                </form>
              </div>
            </TabsContent>
          </Tabs>
        </div>
      </div>
    </Layout>
  );
};

export default Admin;