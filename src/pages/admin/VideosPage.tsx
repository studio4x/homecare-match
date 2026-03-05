"use client";

import { useState, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Loader2, Video, Upload, Trash2, Play, CheckCircle2, RefreshCw, Database, X } from "lucide-react";
import { toast } from "sonner";
import { useSiteConfig } from "@/hooks/use-site-config";
import { useQueryClient } from "@tanstack/react-query";
import LandingVideoPlayer from "../../components/LandingVideoPlayer"; // Import LandingVideoPlayer
import { getYouTubeEmbedUrl } from "@/lib/video-utils"; // Import utility
import {
  buildLandingVideoPosterPath,
  getLandingVideoPublicUrl,
  resolveLandingVideoAssets,
} from "@/lib/landing-video";
import { generatePosterFromVideoFile } from "@/lib/video-poster";

const VIDEO_STORAGE_BUCKET = "uploads";
const VIDEO_STORAGE_FOLDER = "site-videos";

const isMissingColumnError = (error: unknown, columnName: string) => {
  const message = String((error as { message?: string })?.message || "");
  return (
    message.includes(`Could not find the '${columnName}' column`) ||
    (message.toLowerCase().includes("column") &&
      message.toLowerCase().includes(String(columnName || "").toLowerCase()) &&
      message.toLowerCase().includes("does not exist"))
  );
};

const VideosTab = () => {
  const { data: config, isLoading } = useSiteConfig();
  const queryClient = useQueryClient();
  const [isUploading, setIsUploading] = useState<string | null>(null);
  const [isSyncing, setIsSyncing] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [activeField, setActiveField] = useState<string | null>(null);

  const videoFields = [
    { id: "video_url_professionals", storageId: "video_storage_path_professionals", mimeId: "video_mime_professionals", label: "Landing Page: Profissionais", description: "Vídeo exibido na página inicial para profissionais." },
    { id: "video_url_companies", storageId: "video_storage_path_companies", mimeId: "video_mime_companies", label: "Landing Page: Empresas", description: "Vídeo exibido na página de soluções para empresas." },
    { id: "video_url_families", storageId: "video_storage_path_families", mimeId: "video_mime_families", label: "Landing Page: Famílias", description: "Vídeo exibido na página de soluções para famílias." },
    { id: "video_url_onboarding", storageId: "video_storage_path_onboarding", mimeId: "video_mime_onboarding", label: "Dashboard: Onboarding Profissional", description: "Vídeo de boas-vindas exibido no primeiro acesso do profissional." },
    { id: "video_url_onboarding_company", storageId: "video_storage_path_onboarding_company", mimeId: "video_mime_onboarding_company", label: "Dashboard: Onboarding Empresa", description: "Vídeo de boas-vindas exibido no primeiro acesso da empresa." },
    { id: "video_url_onboarding_family", storageId: "video_storage_path_onboarding_family", mimeId: "video_mime_onboarding_family", label: "Dashboard: Onboarding Família", description: "Vídeo de boas-vindas exibido no primeiro acesso da família." },
  ];

  const handleSyncDatabase = async () => {
    setIsSyncing(true);
    try {
      // This function needs to be updated to add the new storage path columns
      // For now, we'll just call the existing extend-site-config
      await supabase.functions.invoke('extend-site-config'); 
      toast.success("Banco de dados sincronizado! Agora você pode subir os vídeos.");
      await queryClient.invalidateQueries({ queryKey: ["site-config"] });
    } catch (e) {
      console.warn("[VideosTab] extend-site-config warning:", e);
      toast.error("Falha ao sincronizar banco.");
    } finally {
      setIsSyncing(false);
    }
  };

  const handleUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file || !activeField) return;

    if (file.size > 50 * 1024 * 1024) {
      toast.error("O vídeo é muito grande. Limite máximo: 50MB.");
      return;
    }

    setIsUploading(activeField);
    const fileExt = file.name.split('.').pop();
    const fileName = `${activeField}_${Date.now()}.${fileExt}`;
    const filePath = `${VIDEO_STORAGE_FOLDER}/${fileName}`;

    try {
      const { error: uploadError } = await supabase.storage
        .from(VIDEO_STORAGE_BUCKET)
        .upload(filePath, file, {
          cacheControl: "31536000"
        });

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage
        .from(VIDEO_STORAGE_BUCKET)
        .getPublicUrl(filePath);
      let coverGenerated = false;
      let coverGenerationError = "";
      const posterPath = buildLandingVideoPosterPath(filePath);

      if (posterPath) {
        try {
          const posterBlob = await generatePosterFromVideoFile(file);
          const posterFileName = posterPath.split("/").pop() || `${activeField}_poster.jpg`;
          const posterFile = new File([posterBlob], posterFileName, {
            type: posterBlob.type || "image/jpeg",
          });

          const { error: posterUploadError } = await supabase.storage
            .from(VIDEO_STORAGE_BUCKET)
            .upload(posterPath, posterFile, {
              cacheControl: "31536000",
              upsert: true,
              contentType: posterFile.type,
            });

          if (posterUploadError) {
            throw posterUploadError;
          }
          coverGenerated = true;
        } catch (posterError: any) {
          coverGenerationError = String(posterError?.message || "Falha ao gerar capa automática.");
        }
      }

      const fieldConfig = videoFields.find(f => f.id === activeField);
      if (!fieldConfig) throw new Error("Configuração de campo não encontrada.");

      const updatePayload: any = { 
        [activeField]: publicUrl, // Keep public URL for direct access if needed
        [fieldConfig.storageId]: filePath, // Store storage path
        [fieldConfig.mimeId]: file.type // Store mime type
      };

      let { error: dbError } = await supabase
        .from('site_config')
        .update(updatePayload)
        .eq('id', 1);

      let mimeColumnSkipped = false;
      if (dbError && isMissingColumnError(dbError, fieldConfig.mimeId)) {
        mimeColumnSkipped = true;
        const fallbackPayload: any = {
          [activeField]: publicUrl,
          [fieldConfig.storageId]: filePath,
        };
        const retry = await supabase.from('site_config').update(fallbackPayload).eq('id', 1);
        dbError = retry.error;
      }

      if (dbError) {
        if (dbError.message.includes("column") && dbError.message.includes("does not exist")) {
          throw new Error("Coluna não encontrada. Clique no botão 'Sincronizar Banco' no topo da página.");
        }
        throw dbError;
      }

      await queryClient.invalidateQueries({ queryKey: ["site-config"] });
      if (coverGenerated) {
        toast.success("Vídeo atualizado com sucesso! Capa gerada automaticamente.");
      } else {
        toast.success("Vídeo atualizado com sucesso!");
        if (coverGenerationError) {
          toast.warning(`Vídeo salvo, mas a capa não foi gerada: ${coverGenerationError}`);
        }
      }
      if (mimeColumnSkipped) {
        toast.warning("Upload concluído sem salvar o MIME do vídeo. Clique em 'Sincronizar Banco' para atualizar a estrutura.");
      }
    } catch (error: any) {
      console.error(error);
      toast.error(error.message || "Erro ao enviar vídeo.");
    } finally {
      setIsUploading(null);
      setActiveField(null);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const handleDelete = async (fieldId: string, storageId: string, mimeId: string) => {
    if (!confirm("Deseja remover este vídeo?")) return;
    
    try {
      const updatePayload: any = { 
        [fieldId]: null,
        [storageId]: null,
        [mimeId]: null
      };

      const currentStoragePath = String((config as any)?.[storageId] || "").trim();
      const posterPath = buildLandingVideoPosterPath(currentStoragePath);
      if (posterPath) {
        await supabase.storage.from(VIDEO_STORAGE_BUCKET).remove([posterPath]);
      }

      let { error } = await supabase
        .from('site_config')
        .update(updatePayload)
        .eq('id', 1);

      if (error && isMissingColumnError(error, mimeId)) {
        const fallbackPayload: any = {
          [fieldId]: null,
          [storageId]: null,
        };
        const retry = await supabase.from('site_config').update(fallbackPayload).eq('id', 1);
        error = retry.error;
      }

      if (error) throw error;
      
      await queryClient.invalidateQueries({ queryKey: ["site-config"] });
      toast.success("Vídeo removido.");
    } catch (error) {
      toast.error("Erro ao remover vídeo.");
    }
  };

  const getSignedUrlForStoragePath = async (path: string) => {
    if (!path) return null;
    const { data } = await supabase.storage.from(VIDEO_STORAGE_BUCKET).createSignedUrl(path, 3600);
    return data?.signedUrl || null;
  };

  if (isLoading) return <div className="p-8 flex justify-center"><Loader2 className="animate-spin" /></div>;

  return (
    <div className="space-y-6">
      <div className="flex justify-end">
        <Button 
          variant="outline" 
          size="sm" 
          className="gap-2 border-amber-200 bg-amber-50 text-amber-700 hover:bg-amber-100"
          onClick={handleSyncDatabase}
          disabled={isSyncing}
        >
          {isSyncing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Database className="h-4 w-4" />}
          Sincronizar Banco (Correção de Erros)
        </Button>
      </div>

      <div className="grid gap-6">
        {videoFields.map((field) => {
          const currentUrl = (config as any)?.[field.id];
          const currentStoragePath = (config as any)?.[field.storageId];
          const currentMimeType = (config as any)?.[field.mimeId];
          const videoAssets = resolveLandingVideoAssets(currentStoragePath, currentUrl);
          const videoSourceUrl = videoAssets.videoUrl;
          const videoPosterUrl = videoAssets.posterUrl;
          const posterPath = buildLandingVideoPosterPath(currentStoragePath);

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
                  {(currentUrl || currentStoragePath) && (
                    <Badge variant="secondary" className="bg-success/10 text-success border-success/20 gap-1">
                      <CheckCircle2 className="h-3 w-3" /> Ativo
                    </Badge>
                  )}
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                {(currentUrl || currentStoragePath) ? (
                  <div className="grid md:grid-cols-2 gap-6 items-start">
                    <div className="aspect-video rounded-xl overflow-hidden bg-black border shadow-inner relative group">
                      {/* Use LandingVideoPlayer for preview */}
                      <LandingVideoPlayer 
                        url={videoSourceUrl}
                        title={field.label}
                        autoplay={false} // Desativar autoplay
                        posterUrl={videoPosterUrl}
                      />
                    </div>
                    <div className="space-y-4">
                      <div className="p-4 rounded-lg bg-secondary/20 border border-dashed">
                        <p className="text-xs text-muted-foreground break-all">
                          <span className="font-bold text-foreground">URL:</span> {currentUrl || "N/A"}
                        </p>
                        {currentStoragePath && (
                          <p className="text-xs text-muted-foreground break-all mt-1">
                            <span className="font-bold text-foreground">Storage Path:</span> {currentStoragePath}
                          </p>
                        )}
                        {posterPath && (
                          <p className="text-xs text-muted-foreground break-all mt-1">
                            <span className="font-bold text-foreground">Capa (auto):</span>{" "}
                            {getLandingVideoPublicUrl(posterPath) || posterPath}
                          </p>
                        )}
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
                          onClick={() => handleDelete(field.id, field.storageId, field.mimeId)}
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
