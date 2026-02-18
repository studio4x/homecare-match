import { useState, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Loader2, Save, Phone, Eye, EyeOff, Database, RefreshCw, LifeBuoy, ShieldCheck, CreditCard, FlaskConical, Zap, BarChart3, Map as MapIcon, ShieldAlert, Lock, Activity, Coins, Bell } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useSiteConfig } from "@/hooks/use-site-config";
import { useQueryClient } from "@tanstack/react-query";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";

const SiteConfigTab = () => {
  const { data: config, isLoading } = useSiteConfig();
  const queryClient = useQueryClient();
  
  const [formData, setFormData] = useState({
    logo_height_px: 48,
    footer_logo_height_px: 48,
    whatsapp_number: "",
    enable_professional_list: true,
    stripe_mode: "test",
    stripe_publishable_key_test: "",
    stripe_publishable_key_live: "",
    google_maps_api_key: ""
  });
  
  const [isSaving, setIsSaving] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [isSyncingSupport, setIsSyncingSupport] = useState(false);
  const [isSyncingKYC, setIsSyncingKYC] = useState(false);
  const [isSyncingAnalytics, setIsSyncingAnalytics] = useState(false);
  const [isSyncingSecurity, setIsSyncingSecurity] = useState(false);
  const [isSyncingRLS, setIsSyncingRLS] = useState(false);
  const [isSyncingAudit, setIsSyncingAudit] = useState(false);
  const [isSyncingAPI, setIsSyncingAPI] = useState(false);
  const [isSyncingNotifications, setIsSyncingNotifications] = useState(false);
  const [isUploading, setIsUploading] = useState<string | null>(null);

  const logoRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (config) {
      setFormData({
        logo_height_px: config.logo_height_px || 48,
        footer_logo_height_px: config.footer_logo_height_px || 48,
        whatsapp_number: config.whatsapp_number || "",
        enable_professional_list: config.enable_professional_list ?? true,
        stripe_mode: config.stripe_mode || "test",
        stripe_publishable_key_test: config.stripe_publishable_key_test || "",
        stripe_publishable_key_live: config.stripe_publishable_key_live || "",
        google_maps_api_key: config.google_maps_api_key || ""
      });
    }
  }, [config]);

  const handleSyncDatabase = async () => {
    setIsSyncing(true);
    try {
      await supabase.functions.invoke('extend-site-config');
      const { error } = await supabase.functions.invoke('setup-reviews-table');
      if (error) throw error;
      toast.success("Banco de dados sincronizado!");
      queryClient.invalidateQueries({ queryKey: ["site-config"] });
    } catch (error: any) {
      toast.error("Erro ao sincronizar banco.");
    } finally {
      setIsSyncing(false);
    }
  };

  const handleSyncSupport = async () => {
    setIsSyncingSupport(true);
    try {
      const { error } = await supabase.functions.invoke('setup-support-system');
      if (error) throw error;
      toast.success("Sistema de suporte sincronizado!");
    } catch (error: any) {
      toast.error("Erro ao sincronizar suporte.");
    } finally {
      setIsSyncingSupport(false);
    }
  };

  const handleSyncKYC = async () => {
    setIsSyncingKYC(true);
    try {
      const { error } = await supabase.functions.invoke('setup-kyc-storage');
      if (error) throw error;
      toast.success("Segurança de documentos configurada!");
    } catch (error: any) {
      toast.error("Erro ao configurar segurança.");
    } finally {
      setIsSyncingKYC(false);
    }
  };

  const handleSyncAnalytics = async () => {
    setIsSyncingAnalytics(true);
    try {
      const { error } = await supabase.functions.invoke('setup-analytics');
      if (error) throw error;
      toast.success("Estrutura de métricas configurada!");
    } catch (error: any) {
      toast.error("Erro ao configurar analytics.");
    } finally {
      setIsSyncingAnalytics(false);
    }
  };

  const handleSyncSecurity = async () => {
    setIsSyncingSecurity(true);
    try {
      const { error } = await supabase.functions.invoke('security-patch-privileges');
      if (error) throw error;
      toast.success("Proteção de privilégios aplicada!");
    } catch (error: any) {
      toast.error("Erro ao aplicar patch de segurança.");
    } finally {
      setIsSyncingSecurity(false);
    }
  };

  const handleSyncRLS = async () => {
    setIsSyncingRLS(true);
    try {
      const { error } = await supabase.functions.invoke('security-patch-privacy');
      if (error) throw error;
      toast.success("Proteção de dados sensíveis aplicada!");
    } catch (error: any) {
      toast.error("Erro ao aplicar proteção de dados.");
    } finally {
      setIsSyncingRLS(false);
    }
  };

  const handleSyncAudit = async () => {
    setIsSyncingAudit(true);
    try {
      const { error } = await supabase.functions.invoke('setup-audit-trail');
      if (error) throw error;
      toast.success("Sistema de auditoria configurado!");
    } catch (error: any) {
      toast.error("Erro ao configurar auditoria.");
    } finally {
      setIsSyncingAudit(false);
    }
  };

  const handleSyncAPI = async () => {
    setIsSyncingAPI(true);
    try {
      const { error } = await supabase.functions.invoke('setup-api-protection');
      if (error) throw error;
      toast.success("Proteção de API e Controle de Custos ativos!");
    } catch (error: any) {
      toast.error("Erro ao configurar proteção de API.");
    } finally {
      setIsSyncingAPI(false);
    }
  };

  const handleSyncNotifications = async () => {
    setIsSyncingNotifications(true);
    try {
      const { error } = await supabase.functions.invoke('setup-notifications');
      if (error) throw error;
      toast.success("Sistema de notificações configurado!");
    } catch (error: any) {
      toast.error("Erro ao configurar notificações.");
    } finally {
      setIsSyncingNotifications(false);
    }
  };

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>, field: 'logo_url' | 'footer_logo_url' | 'favicon_url') => {
    const file = event.target.files?.[0];
    if (!file) return;

    setIsUploading(field);
    const fileExt = file.name.split('.').pop();
    const fileName = `${field}_${Date.now()}.${fileExt}`;
    const filePath = `site-assets/${fileName}`;

    try {
      const { error: uploadError } = await supabase.storage.from('uploads').upload(filePath, file);
      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage.from('uploads').getPublicUrl(filePath);

      const { error: dbError } = await supabase
        .from('site_config')
        .update({ [field]: publicUrl })
        .eq('id', 1);

      if (dbError) throw dbError;

      await queryClient.invalidateQueries({ queryKey: ["site-config"] });
      toast.success("Imagem enviada!");
    } catch (error: any) {
      toast.error("Erro ao enviar imagem.");
    } finally {
      setIsUploading(null);
    }
  };

  const handleSave = async () => {
    setIsSaving(true);
    try {
      const { error } = await supabase
        .from('site_config')
        .update({
          logo_height_px: formData.logo_height_px,
          footer_logo_height_px: formData.footer_logo_height_px,
          whatsapp_number: formData.whatsapp_number,
          enable_professional_list: formData.enable_professional_list,
          stripe_mode: formData.stripe_mode,
          stripe_publishable_key_test: formData.stripe_publishable_key_test,
          stripe_publishable_key_live: formData.stripe_publishable_key_live,
          google_maps_api_key: formData.google_maps_api_key,
          updated_at: new Date().toISOString()
        })
        .eq('id', 1);

      if (error) throw error;
      await queryClient.invalidateQueries({ queryKey: ["site-config"] });
      toast.success("Configurações salvas!");
    } catch (error) {
      toast.error("Erro ao salvar configurações.");
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoading) return <div className="p-8 flex justify-center"><Loader2 className="animate-spin" /></div>;

  return (
    <div className="space-y-6">
      <Card className="border-primary/20">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <MapIcon className="h-5 w-5 text-primary" />
            Google Maps
          </CardTitle>
          <CardDescription>Configure a chave de API para o mapa interativo de busca.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label>Chave de API do Google Maps (Browser)</Label>
            <Input 
              placeholder="AIza..."
              value={formData.google_maps_api_key} 
              onChange={(e) => setFormData({...formData, google_maps_api_key: e.target.value})} 
            />
            <p className="text-[10px] text-muted-foreground italic">
              Esta chave deve ter permissão para "Maps JavaScript API".
            </p>
          </div>
        </CardContent>
      </Card>

      <Card className="border-primary/20">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <CreditCard className="h-5 w-5 text-primary" />
            Configuração de Pagamentos (Stripe)
          </CardTitle>
          <CardDescription>Alterne entre o ambiente de testes e o ambiente real.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="flex flex-col gap-4">
            <Label>Modo de Operação</Label>
            <Tabs 
              value={formData.stripe_mode} 
              onValueChange={(v) => setFormData({...formData, stripe_mode: v})}
              className="w-full"
            >
              <TabsList className="grid w-full grid-cols-2 h-12">
                <TabsTrigger value="test" className="gap-2 data-[state=active]:bg-amber-500 data-[state=active]:text-white">
                  <FlaskConical className="h-4 w-4" /> Modo de Teste
                </TabsTrigger>
                <TabsTrigger value="live" className="gap-2 data-[state=active]:bg-success data-[state=active]:text-white">
                  <Zap className="h-4 w-4" /> Modo de Produção (Real)
                </TabsTrigger>
              </TabsList>
            </Tabs>
          </div>

          <div className="grid gap-6 md:grid-cols-2">
            <div className="space-y-2 p-4 border rounded-lg bg-amber-50/30 border-amber-200">
              <Label className="flex items-center gap-2 text-amber-700"><FlaskConical className="h-3 w-3" /> Chave Publicável (Teste)</Label>
              <Input 
                placeholder="pk_test_..."
                value={formData.stripe_publishable_key_test} 
                onChange={(e) => setFormData({...formData, stripe_publishable_key_test: e.target.value})} 
              />
              <p className="text-[10px] text-muted-foreground italic">Usada para identificar sua conta no modo de testes.</p>
            </div>

            <div className="space-y-2 p-4 border rounded-lg bg-success/5 border-success/20">
              <Label className="flex items-center gap-2 text-success"><Zap className="h-3 w-3" /> Chave Publicável (Produção)</Label>
              <Input 
                placeholder="pk_live_..."
                value={formData.stripe_publishable_key_live} 
                onChange={(e) => setFormData({...formData, stripe_publishable_key_live: e.target.value})} 
              />
              <p className="text-[10px] text-muted-foreground italic">Usada para identificar sua conta no modo real.</p>
            </div>
          </div>

          <div className="bg-secondary/20 p-4 rounded-lg border border-dashed">
            <p className="text-xs text-muted-foreground leading-relaxed">
              <strong>Lembrete:</strong> As chaves <strong>Secretas</strong> e os <strong>Webhooks</strong> devem ser inseridos apenas no painel do Supabase (Secrets), pois são dados sensíveis que não devem ser expostos publicamente.
            </p>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Configurações Globais</CardTitle>
          <CardDescription>Gerencie identidade visual e contatos.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="flex items-center justify-between p-4 border rounded-lg bg-secondary/10">
            <div className="space-y-0.5">
              <div className="flex items-center gap-2">
                {formData.enable_professional_list ? <Eye className="h-4 w-4 text-primary" /> : <EyeOff className="h-4 w-4 text-muted-foreground" />}
                <Label className="text-base">Exibir Profissionais na Busca</Label>
              </div>
            </div>
            <Switch 
              checked={formData.enable_professional_list}
              onCheckedChange={(checked) => setFormData(prev => ({ ...prev, enable_professional_list: checked }))}
            />
          </div>

          <div className="grid gap-4 items-start p-4 border rounded-lg bg-success/5 border-success/20">
            <div className="space-y-2">
              <Label className="flex items-center gap-2"><Phone className="h-4 w-4 text-success" /> WhatsApp do Concierge</Label>
              <Input 
                placeholder="Ex: 5511999999999"
                value={formData.whatsapp_number} 
                onChange={(e) => setFormData({...formData, whatsapp_number: e.target.value})} 
              />
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-2 items-start p-4 border rounded-lg">
            <div className="space-y-2">
              <Label>Logotipo</Label>
              <div className="flex flex-col gap-2">
                {config?.logo_url && <img src={config.logo_url} alt="Logo" style={{ height: `${formData.logo_height_px}px` }} className="object-contain bg-secondary/20 p-2 rounded" />}
                <Button variant="outline" size="sm" onClick={() => logoRef.current?.click()} disabled={!!isUploading}>Alterar</Button>
                <input type="file" ref={logoRef} onChange={(e) => handleFileUpload(e, 'logo_url')} className="hidden" accept="image/*" />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Altura (px)</Label>
              <Input type="number" value={formData.logo_height_px} onChange={(e) => setFormData({...formData, logo_height_px: parseInt(e.target.value) || 0})} />
            </div>
          </div>

          <div className="flex justify-end pt-4">
            <Button onClick={handleSave} disabled={isSaving}>
              {isSaving ? <Loader2 className="animate-spin h-4 w-4 mr-2" /> : <Save className="h-4 w-4 mr-2" />}
              Salvar Configurações
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card className="border-amber-200 bg-amber-50/50">
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2 text-amber-800">
            <Database className="h-4 w-4" /> Manutenção do Sistema
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-col md:flex-row items-center justify-between gap-4 p-4 border border-amber-200 rounded-lg bg-white">
            <div className="space-y-1">
              <p className="text-sm font-semibold text-amber-900">Sincronizar Estrutura Base</p>
              <p className="text-xs text-amber-800/70">Atualiza tabelas de avaliações, academy e Stripe.</p>
            </div>
            <Button variant="outline" onClick={handleSyncDatabase} disabled={isSyncing}>
              {isSyncing ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
            </Button>
          </div>

          <div className="flex flex-col md:flex-row items-center justify-between gap-4 p-4 border border-amber-200 rounded-lg bg-white">
            <div className="space-y-1">
              <p className="text-sm font-semibold text-amber-900">Sincronizar Central de Suporte</p>
              <p className="text-xs text-amber-800/70">Cria tabelas de Tickets, Mensagens e FAQs.</p>
            </div>
            <Button variant="outline" onClick={handleSyncSupport} disabled={isSyncingSupport}>
              {isSyncingSupport ? <Loader2 className="h-4 w-4 animate-spin" /> : <LifeBuoy className="h-4 w-4" />}
            </Button>
          </div>

          <div className="flex flex-col md:flex-row items-center justify-between gap-4 p-4 border border-amber-200 rounded-lg bg-white">
            <div className="space-y-1">
              <p className="text-sm font-semibold text-amber-900">Segurança de Documentos (KYC)</p>
              <p className="text-xs text-amber-800/70">Torna o bucket de documentos privado e configura RLS.</p>
            </div>
            <Button variant="outline" onClick={handleSyncKYC} disabled={isSyncingKYC}>
              {isSyncingKYC ? <Loader2 className="h-4 w-4 animate-spin" /> : <ShieldCheck className="h-4 w-4" />}
            </Button>
          </div>

          <div className="flex flex-col md:flex-row items-center justify-between gap-4 p-4 border border-amber-200 rounded-lg bg-white">
            <div className="space-y-1">
              <p className="text-sm font-semibold text-amber-900">Sincronizar Analytics</p>
              <p className="text-xs text-amber-800/70">Cria tabelas para rastrear visualizações e cliques.</p>
            </div>
            <Button variant="outline" onClick={handleSyncAnalytics} disabled={isSyncingAnalytics}>
              {isSyncingAnalytics ? <Loader2 className="h-4 w-4 animate-spin" /> : <BarChart3 className="h-4 w-4" />}
            </Button>
          </div>

          <div className="flex flex-col md:flex-row items-center justify-between gap-4 p-4 border border-amber-200 rounded-lg bg-white">
            <div className="space-y-1">
              <p className="text-sm font-semibold text-amber-900">Configurar Auditoria (Logs)</p>
              <p className="text-xs text-amber-800/70">Cria tabela imutável para rastrear ações administrativas.</p>
            </div>
            <Button variant="outline" onClick={handleSyncAudit} disabled={isSyncingAudit}>
              {isSyncingAudit ? <Loader2 className="h-4 w-4 animate-spin" /> : <Activity className="h-4 w-4" />}
            </Button>
          </div>

          <div className="flex flex-col md:flex-row items-center justify-between gap-4 p-4 border border-amber-200 rounded-lg bg-white">
            <div className="space-y-1">
              <p className="text-sm font-semibold text-amber-900">Proteção de API e Custos</p>
              <p className="text-xs text-amber-800/70">Ativa limites diários para uso de IA e Mapas.</p>
            </div>
            <Button variant="outline" onClick={handleSyncAPI} disabled={isSyncingAPI}>
              {isSyncingAPI ? <Loader2 className="h-4 w-4 animate-spin" /> : <Coins className="h-4 w-4" />}
            </Button>
          </div>

          <div className="flex flex-col md:flex-row items-center justify-between gap-4 p-4 border border-amber-200 rounded-lg bg-white">
            <div className="space-y-1">
              <p className="text-sm font-semibold text-amber-900">Sistema de Notificações</p>
              <p className="text-xs text-amber-800/70">Cria tabela e habilita tempo real para alertas do admin.</p>
            </div>
            <Button variant="outline" onClick={handleSyncNotifications} disabled={isSyncingNotifications}>
              {isSyncingNotifications ? <Loader2 className="h-4 w-4 animate-spin" /> : <Bell className="h-4 w-4" />}
            </Button>
          </div>

          <div className="flex flex-col md:flex-row items-center justify-between gap-4 p-4 border border-destructive/20 rounded-lg bg-destructive/5">
            <div className="space-y-1">
              <p className="text-sm font-semibold text-destructive">Patch de Segurança: Privilégios</p>
              <p className="text-xs text-muted-foreground">Impede que usuários comuns alterem seu próprio papel (Admin/Role).</p>
            </div>
            <Button variant="destructive" onClick={handleSyncSecurity} disabled={isSyncingSecurity} className="gap-2">
              {isSyncingSecurity ? <Loader2 className="h-4 w-4 animate-spin" /> : <ShieldAlert className="h-4 w-4" />}
              Aplicar Patch
            </Button>
          </div>

          <div className="flex flex-col md:flex-row items-center justify-between gap-4 p-4 border border-blue-200 rounded-lg bg-blue-50/30">
            <div className="space-y-1">
              <p className="text-sm font-semibold text-blue-900">Proteção de Dados Sensíveis (RLS)</p>
              <p className="text-xs text-blue-800/70">Cria View Segura e oculta WhatsApp/Endereço de curiosos.</p>
            </div>
            <Button variant="outline" onClick={handleSyncRLS} disabled={isSyncingRLS} className="border-blue-300 text-blue-700 hover:bg-blue-100">
              {isSyncingRLS ? <Loader2 className="h-4 w-4 animate-spin" /> : <Lock className="h-4 w-4" />}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default SiteConfigTab;