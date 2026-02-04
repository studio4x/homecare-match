import { useState, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Loader2, Upload, Save, Image as ImageIcon, Phone } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useSiteConfig } from "@/hooks/use-site-config";
import { useQueryClient } from "@tanstack/react-query";

const SiteConfigTab = () => {
  const { data: config, isLoading } = useSiteConfig();
  const queryClient = useQueryClient();
  
  const [formData, setFormData] = useState({
    logo_height_px: 48,
    footer_logo_height_px: 48,
    whatsapp_number: "",
  });
  
  const [isSaving, setIsSaving] = useState(false);
  const [isUploading, setIsUploading] = useState<string | null>(null);

  const logoRef = useRef<HTMLInputElement>(null);
  const footerLogoRef = useRef<HTMLInputElement>(null);
  const faviconRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (config) {
      setFormData({
        logo_height_px: config.logo_height_px || 48,
        footer_logo_height_px: config.footer_logo_height_px || 48,
        whatsapp_number: config.whatsapp_number || "",
      });
    }
  }, [config]);

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>, field: 'logo_url' | 'footer_logo_url' | 'favicon_url') => {
    const file = event.target.files?.[0];
    if (!file) return;

    setIsUploading(field);
    const fileExt = file.name.split('.').pop();
    const fileName = `${field}_${Date.now()}.${fileExt}`;
    const filePath = `site-assets/${fileName}`;

    try {
      const { error: uploadError } = await supabase.storage.from('uploads').upload(filePath, file);
      
      if (uploadError) {
        if (uploadError.message.includes("Bucket not found")) {
           toast.error("Bucket 'uploads' não encontrado. Crie um bucket público chamado 'uploads' no Supabase.");
           throw uploadError;
        }
        throw uploadError;
      }

      const { data: { publicUrl } } = supabase.storage.from('uploads').getPublicUrl(filePath);

      const { error: dbError } = await supabase
        .from('site_config')
        .update({ [field]: publicUrl })
        .eq('id', 1);

      if (dbError) throw dbError;

      await queryClient.invalidateQueries({ queryKey: ["site-config"] });
      toast.success("Imagem enviada com sucesso!");
    } catch (error: any) {
      console.error("Erro upload:", error);
      toast.error("Erro ao enviar imagem. Verifique se o bucket 'uploads' existe e é público.");
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
          updated_at: new Date().toISOString()
        })
        .eq('id', 1);

      if (error) throw error;
      await queryClient.invalidateQueries({ queryKey: ["site-config"] });
      toast.success("Configurações salvas!");
    } catch (error) {
      console.error(error);
      toast.error("Erro ao salvar configurações.");
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoading) return <div className="p-8 flex justify-center"><Loader2 className="animate-spin" /></div>;

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Identidade Visual & Contato</CardTitle>
          <CardDescription>Gerencie os logotipos, ícones e contatos principais do site.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          
          {/* WhatsApp Config */}
          <div className="grid gap-4 items-start p-4 border rounded-lg bg-success/5 border-success/20">
            <div className="space-y-2">
              <Label className="flex items-center gap-2">
                <Phone className="h-4 w-4 text-success" />
                WhatsApp do Concierge
              </Label>
              <Input 
                placeholder="Ex: 5511999999999"
                value={formData.whatsapp_number} 
                onChange={(e) => setFormData({...formData, whatsapp_number: e.target.value})} 
              />
              <p className="text-xs text-muted-foreground">
                Este número receberá as mensagens quando um cliente usar a busca e não encontrar profissionais (Concierge).
                <br/>
                <strong>Importante:</strong> Digite apenas números, incluindo o código do país (55) e DDD.
              </p>
            </div>
          </div>

          {/* Header Logo */}
          <div className="grid gap-4 md:grid-cols-2 items-start p-4 border rounded-lg">
            <div className="space-y-2">
              <Label>Logotipo do Cabeçalho</Label>
              <div className="flex flex-col gap-2">
                {config?.logo_url ? (
                  <div className="bg-secondary/50 p-4 rounded-md flex items-center justify-center border border-dashed">
                    <img 
                      src={config.logo_url} 
                      alt="Logo Header" 
                      style={{ height: `${formData.logo_height_px}px` }} 
                      className="object-contain"
                    />
                  </div>
                ) : (
                  <div className="h-20 bg-secondary/30 rounded-md flex items-center justify-center border border-dashed text-muted-foreground text-sm">
                    <ImageIcon className="mr-2 h-4 w-4" /> Sem logo
                  </div>
                )}
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" onClick={() => logoRef.current?.click()} disabled={!!isUploading}>
                    {isUploading === 'logo_url' ? <Loader2 className="animate-spin h-4 w-4 mr-2" /> : <Upload className="h-4 w-4 mr-2" />}
                    Alterar Imagem
                  </Button>
                  <input type="file" ref={logoRef} onChange={(e) => handleFileUpload(e, 'logo_url')} className="hidden" accept="image/*" />
                </div>
              </div>
            </div>
            <div className="space-y-2">
              <Label>Altura (pixels)</Label>
              <Input 
                type="number" 
                value={formData.logo_height_px} 
                onChange={(e) => setFormData({...formData, logo_height_px: parseInt(e.target.value) || 0})} 
              />
              <p className="text-xs text-muted-foreground">Define a altura do logo na barra de navegação.</p>
            </div>
          </div>

          {/* Footer Logo */}
          <div className="grid gap-4 md:grid-cols-2 items-start p-4 border rounded-lg">
            <div className="space-y-2">
              <Label>Logotipo do Rodapé</Label>
              <div className="flex flex-col gap-2">
                {config?.footer_logo_url ? (
                  <div className="bg-secondary/50 p-4 rounded-md flex items-center justify-center border border-dashed">
                    <img 
                      src={config.footer_logo_url} 
                      alt="Logo Footer" 
                      style={{ height: `${formData.footer_logo_height_px}px` }} 
                      className="object-contain"
                    />
                  </div>
                ) : (
                  <div className="h-20 bg-secondary/30 rounded-md flex items-center justify-center border border-dashed text-muted-foreground text-sm">
                    <ImageIcon className="mr-2 h-4 w-4" /> Sem logo
                  </div>
                )}
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" onClick={() => footerLogoRef.current?.click()} disabled={!!isUploading}>
                    {isUploading === 'footer_logo_url' ? <Loader2 className="animate-spin h-4 w-4 mr-2" /> : <Upload className="h-4 w-4 mr-2" />}
                    Alterar Imagem
                  </Button>
                  <input type="file" ref={footerLogoRef} onChange={(e) => handleFileUpload(e, 'footer_logo_url')} className="hidden" accept="image/*" />
                </div>
              </div>
            </div>
            <div className="space-y-2">
              <Label>Altura (pixels)</Label>
              <Input 
                type="number" 
                value={formData.footer_logo_height_px} 
                onChange={(e) => setFormData({...formData, footer_logo_height_px: parseInt(e.target.value) || 0})} 
              />
              <p className="text-xs text-muted-foreground">Define a altura do logo no rodapé.</p>
            </div>
          </div>

          {/* Favicon */}
          <div className="grid gap-4 md:grid-cols-2 items-start p-4 border rounded-lg">
            <div className="space-y-2">
              <Label>Favicon (Ícone da Aba)</Label>
              <div className="flex flex-col gap-2">
                <div className="flex items-center gap-4">
                  {config?.favicon_url ? (
                    <div className="h-12 w-12 bg-secondary/50 rounded-md flex items-center justify-center border border-dashed p-2">
                      <img src={config.favicon_url} alt="Favicon" className="w-8 h-8 object-contain" />
                    </div>
                  ) : (
                    <div className="h-12 w-12 bg-secondary/30 rounded-md flex items-center justify-center border border-dashed text-muted-foreground">
                      <ImageIcon className="h-4 w-4" />
                    </div>
                  )}
                  <div className="flex-1">
                    <Button variant="outline" size="sm" onClick={() => faviconRef.current?.click()} disabled={!!isUploading}>
                      {isUploading === 'favicon_url' ? <Loader2 className="animate-spin h-4 w-4 mr-2" /> : <Upload className="h-4 w-4 mr-2" />}
                      Alterar Favicon
                    </Button>
                    <input type="file" ref={faviconRef} onChange={(e) => handleFileUpload(e, 'favicon_url')} className="hidden" accept="image/png,image/x-icon,image/svg+xml" />
                  </div>
                </div>
                <p className="text-xs text-muted-foreground mt-1">Recomendado: PNG ou ICO, 32x32px ou 64x64px.</p>
              </div>
            </div>
          </div>

          <div className="flex justify-end pt-4">
            <Button onClick={handleSave} disabled={isSaving} className="w-full md:w-auto">
              {isSaving ? <Loader2 className="animate-spin h-4 w-4 mr-2" /> : <Save className="h-4 w-4 mr-2" />}
              Salvar Configurações
            </Button>
          </div>

        </CardContent>
      </Card>
    </div>
  );
};

export default SiteConfigTab;