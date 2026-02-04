"use client";

import { useState, useEffect, useRef } from "react";
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
  Palette,
  Upload,
  Type
} from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/components/auth/AuthProvider";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

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
    footer_logo_url: '',
    footer_logo_height_px: 32,
    font_family: 'Inter',
  });
  
  const [isSavingConfig, setIsSavingConfig] = useState(false);
  const [isUploading, setIsUploading] = useState<null | 'logo' | 'favicon' | 'footer_logo'>(null);
  const logoInputRef = useRef<HTMLInputElement>(null);
  const faviconInputRef = useRef<HTMLInputElement>(null);
  const footerLogoInputRef = useRef<HTMLInputElement>(null);

  const googleFonts = [
    "Inter", "Roboto", "Lato", "Poppins", "Open Sans", "Montserrat", "Nunito"
  ];

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
    } catch (error) {
      console.error("[Admin] Erro fetch:", error);
    }
  };

  const handleImageUpload = async (event: React.ChangeEvent<HTMLInputElement>, type: 'logo' | 'favicon' | 'footer_logo') => {
    const file = event.target.files?.[0];
    if (!file) return;

    setIsUploading(type);
    const fileName = type;
    const fileExt = file.name.split('.').pop();
    const filePath = `public/${fileName}.${fileExt}`;

    try {
      const { error: uploadError } = await supabase.storage
        .from('site-assets')
        .upload(filePath, file, { upsert: true });

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage
        .from('site-assets')
        .getPublicUrl(filePath);
      
      const finalUrl = `${publicUrl}?t=${new Date().getTime()}`;

      setSiteConfig(prev => ({
        ...prev,
        [`${type}_url`]: finalUrl
      }));

      toast.success(`Imagem enviada! Clique em salvar para aplicar.`);
    } catch (error: any) {
      toast.error("Erro no upload da imagem.", {
        description: "Verifique se o bucket 'site-assets' existe e é público no Supabase Storage."
      });
      console.error(error);
    } finally {
      setIsUploading(null);
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
          footer_logo_url: siteConfig.footer_logo_url,
          footer_logo_height_px: siteConfig.footer_logo_height_px,
          font_family: siteConfig.font_family,
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
    return (
      <Layout>
        <div className="flex h-[60vh] items-center justify-center text-center">
          <div>
            <h2 className="text-2xl font-bold text-destructive">Acesso Negado</h2>
            <p className="text-muted-foreground mt-2">Você não tem permissão para acessar esta página.</p>
            <Button onClick={signOut} className="mt-4">Voltar para o Login</Button>
          </div>
        </div>
      </Layout>
    );
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

            <TabsContent value="verifications">
              {/* Conteúdo de Verificações aqui */}
            </TabsContent>
            <TabsContent value="users">
              {/* Conteúdo de Usuários aqui */}
            </TabsContent>
            <TabsContent value="plans">
              {/* Conteúdo de Planos aqui */}
            </TabsContent>

            <TabsContent value="settings">
              <div className="rounded-xl border bg-card p-6 shadow-sm max-w-2xl mx-auto">
                <form onSubmit={handleSaveConfig} className="space-y-8">
                  <div>
                    <h3 className="text-lg font-semibold mb-4 flex items-center gap-2"><Settings className="h-5 w-5" /> Identidade Visual</h3>
                    <div className="space-y-6">
                      <div className="space-y-2">
                        <Label>Logotipo (Cabeçalho)</Label>
                        <div className="flex items-center gap-4">
                          {siteConfig.logo_url && <img src={siteConfig.logo_url} alt="Logo Preview" className="h-12 w-auto bg-muted p-1 rounded-md border" />}
                          <Button type="button" variant="outline" onClick={() => logoInputRef.current?.click()} disabled={!!isUploading}>
                            {isUploading === 'logo' ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Upload className="h-4 w-4 mr-2" />}
                            Alterar Imagem
                          </Button>
                          <input type="file" ref={logoInputRef} className="hidden" accept="image/png, image/jpeg, image/svg+xml" onChange={(e) => handleImageUpload(e, 'logo')} />
                        </div>
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="logo_height">Altura do Logotipo (pixels)</Label>
                        <Input id="logo_height" type="number" value={siteConfig.logo_height_px} onChange={e => setSiteConfig({...siteConfig, logo_height_px: parseInt(e.target.value) || 48})} />
                      </div>
                      <div className="space-y-2">
                        <Label>Logotipo (Rodapé)</Label>
                        <div className="flex items-center gap-4">
                          {siteConfig.footer_logo_url && <img src={siteConfig.footer_logo_url} alt="Footer Logo Preview" className="h-12 w-auto bg-muted p-1 rounded-md border" />}
                          <Button type="button" variant="outline" onClick={() => footerLogoInputRef.current?.click()} disabled={!!isUploading}>
                            {isUploading === 'footer_logo' ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Upload className="h-4 w-4 mr-2" />}
                            Alterar Imagem
                          </Button>
                          <input type="file" ref={footerLogoInputRef} className="hidden" accept="image/png, image/jpeg, image/svg+xml" onChange={(e) => handleImageUpload(e, 'footer_logo')} />
                        </div>
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="footer_logo_height">Altura do Logotipo do Rodapé (pixels)</Label>
                        <Input id="footer_logo_height" type="number" value={siteConfig.footer_logo_height_px} onChange={e => setSiteConfig({...siteConfig, footer_logo_height_px: parseInt(e.target.value) || 32})} />
                      </div>
                      <div className="space-y-2">
                        <Label>Favicon</Label>
                         <div className="flex items-center gap-4">
                          {siteConfig.favicon_url && <img src={siteConfig.favicon_url} alt="Favicon Preview" className="h-8 w-8 bg-muted p-1 rounded-md border" />}
                          <Button type="button" variant="outline" onClick={() => faviconInputRef.current?.click()} disabled={!!isUploading}>
                            {isUploading === 'favicon' ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Upload className="h-4 w-4 mr-2" />}
                            Alterar Imagem
                          </Button>
                          <input type="file" ref={faviconInputRef} className="hidden" accept="image/png, image/x-icon, image/svg+xml" onChange={(e) => handleImageUpload(e, 'favicon')} />
                        </div>
                      </div>
                    </div>
                  </div>

                  <div>
                    <h3 className="text-lg font-semibold mb-4 flex items-center gap-2"><Type className="h-5 w-5" /> Tipografia</h3>
                    <div className="space-y-2">
                      <Label htmlFor="font_family">Fonte Principal (Google Fonts)</Label>
                      <Select value={siteConfig.font_family} onValueChange={value => setSiteConfig({...siteConfig, font_family: value})}>
                        <SelectTrigger id="font_family">
                          <SelectValue placeholder="Selecione uma fonte" />
                        </SelectTrigger>
                        <SelectContent>
                          {googleFonts.map(font => (
                            <SelectItem key={font} value={font} style={{ fontFamily: font }}>
                              {font}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
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
                    <Button type="submit" disabled={isSavingConfig || !!isUploading}>
                      {(isSavingConfig || isUploading) && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
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