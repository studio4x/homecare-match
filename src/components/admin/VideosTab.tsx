"use client";

import { useState, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Loader2, Video, Upload, Trash2, CheckCircle2, RefreshCw, Database } from "lucide-react";
import { toast } from "sonner";
import { useSiteConfig } from "@/hooks/use-site-config";
import { useQueryClient } from "@tanstack/react-query";
import LandingVideoPlayer from "../LandingVideoPlayer"; // Import LandingVideoPlayer
import { getYouTubeEmbedUrl } from "@/lib/video-utils"; // Import utility
import {
  buildLandingVideoPosterPath,
  getLandingVideoPublicUrl,
  resolveLandingVideoAssets,
} from "@/lib/landing-video";
import { generatePosterFromVideoFile } from "@/lib/video-poster";

const VIDEO_STORAGE_BUCKET = "uploads";
const VIDEO_STORAGE_FOLDER = "site-videos";

type VideoFieldConfig = {
  id: string;
  mobileId: string;
  storageId: string;
  mimeId: string;
  label: string;
  description: string;
};

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
  const [savingUrlField, setSavingUrlField] = useState<string | null>(null);
  const [desktopUrlByField, setDesktopUrlByField] = useState<Record<string, string>>({});
  const [mobileUrlByField, setMobileUrlByField] = useState<Record<string, string>>({});
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [activeField, setActiveField] = useState<string | null>(null);

  const videoFields: VideoFieldConfig[] = [
    { id: "video_url_how_it_works_professionals", mobileId: "video_url_how_it_works_professionals_mobile", storageId: "video_storage_path_how_it_works_professionals", mimeId: "video_mime_how_it_works_professionals", label: "Tutorial Como Funciona: Profissionais", description: "Video tutorial exibido no botao da secao Como funciona da pagina de profissionais." },
    { id: "video_url_how_it_works_companies", mobileId: "video_url_how_it_works_companies_mobile", storageId: "video_storage_path_how_it_works_companies", mimeId: "video_mime_how_it_works_companies", label: "Tutorial Como Funciona: Empresas", description: "Video tutorial exibido no botao da secao Como funciona da pagina de empresas." },
    { id: "video_url_how_it_works_families", mobileId: "video_url_how_it_works_families_mobile", storageId: "video_storage_path_how_it_works_families", mimeId: "video_mime_how_it_works_families", label: "Tutorial Como Funciona: Familias", description: "Video tutorial exibido no botao da secao Como funciona da pagina de familias." },
    { id: "video_url_professionals", mobileId: "video_url_professionals_mobile", storageId: "video_storage_path_professionals", mimeId: "video_mime_professionals", label: "Landing Page: Profissionais", description: "Video exibido na pagina inicial para profissionais." },
    { id: "video_url_companies", mobileId: "video_url_companies_mobile", storageId: "video_storage_path_companies", mimeId: "video_mime_companies", label: "Landing Page: Empresas", description: "Video exibido na pagina de solucoes para empresas." },
    { id: "video_url_families", mobileId: "video_url_families_mobile", storageId: "video_storage_path_families", mimeId: "video_mime_families", label: "Landing Page: Familias", description: "Video exibido na pagina de solucoes para familias." },
    { id: "video_url_onboarding", mobileId: "video_url_onboarding_mobile", storageId: "video_storage_path_onboarding", mimeId: "video_mime_onboarding", label: "Dashboard: Onboarding Profissional", description: "Video de boas-vindas exibido no primeiro acesso do profissional." },
    { id: "video_url_onboarding_company", mobileId: "video_url_onboarding_company_mobile", storageId: "video_storage_path_onboarding_company", mimeId: "video_mime_onboarding_company", label: "Dashboard: Onboarding Empresa", description: "Video de boas-vindas exibido no primeiro acesso da empresa." },
    { id: "video_url_onboarding_family", mobileId: "video_url_onboarding_family_mobile", storageId: "video_storage_path_onboarding_family", mimeId: "video_mime_onboarding_family", label: "Dashboard: Onboarding Familia", description: "Video de boas-vindas exibido no primeiro acesso da familia." },
  ];

  const handleSyncDatabase = async () => {
    setIsSyncing(true);
    try {
      // This function needs to be updated to add the new storage path columns
      // For now, we'll just call the existing extend-site-config
      await supabase.functions.invoke('extend-site-config'); 
      toast.success("Banco de dados sincronizado! Agora voce pode subir os videos.");
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
      toast.error("O video e muito grande. Limite maximo: 50MB.");
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
          coverGenerationError = String(posterError?.message || "Falha ao gerar capa automatica.");
        }
      }

      const fieldConfig = videoFields.find(f => f.id === activeField);
      if (!fieldConfig) throw new Error("Configuracao de campo nao encontrada.");

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
          throw new Error("Coluna nao encontrada. Clique no botao 'Sincronizar Banco' no topo da pagina.");
        }
        throw dbError;
      }

      await queryClient.invalidateQueries({ queryKey: ["site-config"] });
      if (coverGenerated) {
        toast.success("Video atualizado com sucesso! Capa gerada automaticamente.");
      } else {
        toast.success("Video atualizado com sucesso!");
        if (coverGenerationError) {
          toast.warning(`Video salvo, mas a capa nao foi gerada: ${coverGenerationError}`);
        }
      }
      if (mimeColumnSkipped) {
        toast.warning("Upload concluido sem salvar o MIME do video. Clique em 'Sincronizar Banco' para atualizar a estrutura.");
      }
    } catch (error: any) {
      console.error(error);
      toast.error(error.message || "Erro ao enviar video.");
    } finally {
      setIsUploading(null);
      setActiveField(null);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const handleDelete = async (fieldId: string, storageId: string, mimeId: string) => {
    if (!confirm("Deseja remover este video?")) return;
    
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
      toast.success("Video removido.");
    } catch (error) {
      toast.error("Erro ao remover video.");
    }
  };

  const handleSaveYoutubeUrls = async (
    field: VideoFieldConfig,
    currentDesktopStoragePath: string,
    currentDesktopUrl: string,
    currentMobileUrl: string,
  ) => {
    const desktopRaw = String(
      desktopUrlByField[field.id] ??
      (currentDesktopStoragePath ? "" : currentDesktopUrl),
    ).trim();
    const mobileRaw = String(mobileUrlByField[field.id] ?? currentMobileUrl).trim();

    const desktopEmbed = desktopRaw ? getYouTubeEmbedUrl(desktopRaw) : null;
    const mobileEmbed = mobileRaw ? getYouTubeEmbedUrl(mobileRaw) : null;

    if (desktopRaw && !String(desktopEmbed || "").includes("youtube.com/embed/")) {
      toast.error("URL desktop invalida. Informe uma URL valida do YouTube.");
      return;
    }

    if (mobileRaw && !String(mobileEmbed || "").includes("youtube.com/embed/")) {
      toast.error("URL mobile invalida. Informe uma URL valida do YouTube.");
      return;
    }

    setSavingUrlField(field.id);
    try {
      const updatePayload: Record<string, string | null> = {
        [field.id]: desktopEmbed,
        [field.mobileId]: mobileEmbed,
      };

      if (desktopEmbed) {
        updatePayload[field.storageId] = null;
        updatePayload[field.mimeId] = null;
      }

      let { error: saveError } = await supabase
        .from("site_config")
        .update(updatePayload)
        .eq("id", 1);

      if (saveError && isMissingColumnError(saveError, field.mobileId)) {
        toast.error("Coluna mobile nao encontrada. Clique em Sincronizar Banco.");
        return;
      }

      if (saveError && isMissingColumnError(saveError, field.mimeId)) {
        const fallbackPayload: Record<string, string | null> = {
          [field.id]: desktopEmbed,
          [field.mobileId]: mobileEmbed,
        };
        if (desktopEmbed) {
          fallbackPayload[field.storageId] = null;
        }
        const retry = await supabase.from("site_config").update(fallbackPayload).eq("id", 1);
        saveError = retry.error;
      }

      if (saveError) throw saveError;

      if (desktopEmbed && currentDesktopStoragePath) {
        const posterPath = buildLandingVideoPosterPath(currentDesktopStoragePath);
        if (posterPath) {
          await supabase.storage.from(VIDEO_STORAGE_BUCKET).remove([posterPath]);
        }
      }

      setDesktopUrlByField((prev) => ({
        ...prev,
        [field.id]: desktopEmbed || "",
      }));
      setMobileUrlByField((prev) => ({
        ...prev,
        [field.id]: mobileEmbed || "",
      }));

      await queryClient.invalidateQueries({ queryKey: ["site-config"] });
      toast.success("URLs salvas.");
    } catch (error: unknown) {
      const message = String((error as { message?: string })?.message || "").trim();
      toast.error(message || "Erro ao salvar URLs.");
    } finally {
      setSavingUrlField(null);
    }
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
          Sincronizar Banco (Correcao de Erros)
        </Button>
      </div>

      <div className="grid gap-6">
        {videoFields.map((field) => {
          const currentUrl = (config as any)?.[field.id];
          const currentMobileUrl = (config as any)?.[field.mobileId];
          const currentStoragePath = (config as any)?.[field.storageId];
          const desktopDraftUrl =
            desktopUrlByField[field.id] ??
            (currentStoragePath ? "" : String(currentUrl || ""));
          const mobileDraftUrl =
            mobileUrlByField[field.id] ??
            String(currentMobileUrl || "");
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
                          Substituir Video
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
                      <p className="font-medium">Nenhum video configurado</p>
                      <p className="text-xs text-muted-foreground">Clique para fazer upload do video MP4 (max. 50MB)</p>
                    </div>
                    <Button variant="outline" size="sm" disabled={!!isUploading}>
                      {isUploading === field.id ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                      Selecionar Arquivo
                    </Button>
                  </div>
                )}

                <div className="rounded-lg border p-4 space-y-3">
                  <Label className="text-sm">URL do YouTube (Desktop)</Label>
                  <Input
                    value={desktopDraftUrl}
                    placeholder="https://www.youtube.com/watch?v=..."
                    onChange={(event) =>
                      setDesktopUrlByField((prev) => ({
                        ...prev,
                        [field.id]: event.target.value,
                      }))
                    }
                  />

                  <Label className="text-sm">URL do YouTube (Mobile)</Label>
                  <Input
                    value={mobileDraftUrl}
                    placeholder="https://www.youtube.com/watch?v=..."
                    onChange={(event) =>
                      setMobileUrlByField((prev) => ({
                        ...prev,
                        [field.id]: event.target.value,
                      }))
                    }
                  />

                  <div className="flex justify-end">
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() =>
                        handleSaveYoutubeUrls(
                          field,
                          String(currentStoragePath || ""),
                          String(currentUrl || ""),
                          String(currentMobileUrl || ""),
                        )
                      }
                      disabled={savingUrlField === field.id}
                    >
                      {savingUrlField === field.id ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        "Salvar URLs"
                      )}
                    </Button>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    O sistema usa URL mobile em telas pequenas e URL desktop no restante.
                  </p>
                </div>
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
