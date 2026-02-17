"use client";

import { useState, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Loader2, Video, Upload, Trash2, Play, CheckCircle2, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { useSiteConfig } from "@/hooks/use-site-config";
import { useQueryClient } from "@tanstack/react-query";

const VideosTab = () => {
  const { data: config, isLoading } = useSiteConfig();
  const queryClient = useQueryClient();
  const [isUploading, setIsUploading] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [activeField, setActiveField] = useState<string | null>(null);

  const videoFields = [
    { id: "video_url_professionals", label: "Landing Page: Profissionais", description: "Vídeo exibido na página inicial para profissionais." },
    { id: "video_url_companies", label: "Landing Page: Empresas", description: "Vídeo exibido na página de soluções para empresas." },
    { id: "video_url_families", label: "Landing Page: Famílias", description: "Vídeo exibido na página de soluções para famílias." },
  ];

  const handleUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file || !activeField) return;

    if (file.size > 50 * 1024 * 1024) {
      toast.error("O vídeo é muito grande. Limite máximo: 50MB.");
      return;
    }

    setIsUploading(activeField);
    const fileExt = file.name.split('.').pop();
    const fileName = `landing_${activeField}_${Date.now()}.${fileExt}`;
    const filePath = `site-videos/${fileName}`;

    try {
      const { error: uploadError } = await supabase.storage
        .from('uploads')
        .upload(filePath, file);

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage
        .from('uploads')
        .getPublicUrl(filePath);

      const { error: dbError } = await supabase
        .from('site_config')
        .update({ [activeField]: publicUrl })
        .eq('id', 1);

      if (dbError) throw dbError;

      await queryClient.invalidateQueries({ queryKey: ["site-config"] });
      toast.success("Vídeo atualizado com sucesso!");
    } catch (error: any) {
      console.error(error);
      toast.error("Erro ao enviar vídeo.");
    } finally {
      setIsUploading(null);
      setActiveField(null);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const handleDelete = async (field: string) => {
    if (!confirm("Deseja remover este vídeo?")) return;
    
    try {
      const { error } = await supabase
        .from('site_config')
        .update({ [field]: null })
        .eq('id', 1);

      if (error) throw error;
      
      await queryClient.invalidateQueries({ queryKey: ["site-config"] });
      toast.success("Vídeo removido.");
    } catch (error) {
      toast.error("Erro ao remover vídeo.");
    }
  };

  if (isLoading) return <div className="p-8 flex justify-center"><Loader2 className="animate-spin" /></div>;

  return (
    <div className="space-y-6">
      <div className="grid gap-6">
        {videoFields.map((field) => {
          const currentUrl = (config as any)?.[field.id];
          
          return (
            <Card key={field.id} className="overflow-hidden">
              <CardHeader className="pb-4">
                <div className="flex items-center justify-between">
                  <div className="space-y-1">
                    <CardTitle className="text-lg flex items-center gap-2">
                      <Video className="h-5 w-5 text-primary" />
                      {field.label}
                    </CardTitle>
                    <CardDescription>{field.description}</CardDescription>
                  </div>
                  {currentUrl && (
                    <Badge variant="secondary" className="bg-success/10 text-success border-success/20 gap-1">
                      <CheckCircle2 className="h-3 w-3" /> Ativo
                    </Badge>
                  )}
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                {currentUrl ? (
                  <div className="grid md:grid-cols-2 gap-6 items-start">
                    <div className="aspect-video rounded-xl overflow-hidden bg-black border shadow-inner relative group">
                      <video 
                        src={currentUrl} 
                        className="w-full h-full object-contain"
                        controls
                      />
                    </div>
                    <div className="space-y-4">
                      <div className="p-4 rounded-lg bg-secondary/20 border border-dashed">
                        <p className="text-xs text-muted-foreground break-all">
                          <span className="font-bold text-foreground">URL:</span> {currentUrl}
                        </p>
                      </div>
                      <div className="flex gap-2">
                        <Button 
                          variant="outline" 
                          size="sm" 
                          className="flex-1 gap-2"
                          onClick={() => {
                            setActiveField(field.id);
                            fileInputRef.current?.click();
                          }}
                          disabled={!!isUploading}
                        >
                          {isUploading === field.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
                          Substituir Vídeo
                        </Button>
                        <Button 
                          variant="ghost" 
                          size="sm" 
                          className="text-destructive hover:bg-destructive/10"
                          onClick={() => handleDelete(field.id)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div 
                    className="border-2 border-dashed rounded-xl p-12 flex flex-col items-center justify-center text-center space-y-4 hover:bg-secondary/10 transition-colors cursor-pointer"
                    onClick={() => {
                      setActiveField(field.id);
                      fileInputRef.current?.click();
                    }}
                  >
                    <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center">
                      <Upload className="h-6 w-6 text-primary" />
                    </div>
                    <div className="space-y-1">
                      <p className="font-medium">Nenhum vídeo configurado</p>
                      <p className="text-xs text-muted-foreground">Clique para fazer upload do vídeo MP4 (máx. 50MB)</p>
                    </div>
                    <Button variant="outline" size="sm" disabled={!!isUploading}>
                      {isUploading === field.id ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                      Selecionar Arquivo
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>

      <input 
        type="file" 
        ref={fileInputRef} 
        className="hidden" 
        accept="video/mp4,video/webm" 
        onChange={handleUpload} 
      />
    </div>
  );
};

export default VideosTab;