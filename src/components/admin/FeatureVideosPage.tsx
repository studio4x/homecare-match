"use client";

import { useState, useEffect, useRef, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { 
  Loader2, 
  Save, 
  Video, 
  Upload, 
  Trash2, 
  RefreshCw, 
  Database, 
  ImageIcon, 
  X, 
  PlayCircle,
  ExternalLink
} from "lucide-react";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";
import { features as frontendFeatures } from "@/pages/Funcionalidades"; // Import features from frontend page
import { cn } from "@/lib/utils";
import { AspectRatio } from "@/components/ui/aspect-ratio";
import { getYouTubeEmbedUrl } from "@/lib/video-utils"; // Import the new utility
import LandingVideoPlayer from "@/components/LandingVideoPlayer"; // Import LandingVideoPlayer

const VIDEO_STORAGE_BUCKET = "uploads";
const VIDEO_STORAGE_FOLDER = "feature-videos";
const MAX_FILE_SIZE_MB = 50;

interface FeatureVideo {
  id?: string;
  feature_key: string;
  title: string;
  video_url?: string | null;
  video_storage_path?: string | null;
  video_mime?: string | null;
}

const FeatureVideosPage = () => {
  const queryClient = useQueryClient();
  const [loading, setLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [isUploading, setIsUploading] = useState<string | null>(null); // Stores feature_key of the video being uploaded
  const [featureVideos, setFeatureVideos] = useState<Record<string, FeatureVideo>>({});

  const fileInputRef = useRef<HTMLInputElement>(null);
  const [activeFeatureKeyForUpload, setActiveFeatureKeyForUpload] = useState<string | null>(null);
  const [editingUrlForFeatureKey, setEditingUrlForFeatureKey] = useState<string | null>(null);
  const [tempVideoUrl, setTempVideoUrl] = useState<string>(""); // Temporary state for the URL input

  const fetchFeatureVideos = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase.from('feature_videos').select('*');
      if (error) throw error;
      const videoMap: Record<string, FeatureVideo> = {};
      data.forEach(fv => {
        videoMap[fv.feature_key] = fv;
      });
      setFeatureVideos(videoMap);
    } catch (err) {
      console.error("[FeatureVideosPage] Error fetching feature videos:", err);
      toast.error("Erro ao carregar vídeos de funcionalidades.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchFeatureVideos();
  }, []);

  const handleSyncDatabase = async () => {
    setIsSyncing(true);
    try {
      const { error } = await supabase.functions.invoke('setup-feature-videos');
      if (error) throw error;
      toast.success("Banco de dados sincronizado!");
      queryClient.invalidateQueries({ queryKey: ["feature-videos"] });
      fetchFeatureVideos(); // Re-fetch to update state
    } catch (error: any) {
      toast.error("Erro ao sincronizar banco.");
    } finally {
      setIsSyncing(false);
    }
  };

  const handleUploadClick = (featureKey: string) => {
    setActiveFeatureKeyForUpload(featureKey);
    fileInputRef.current?.click();
  };

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file || !activeFeatureKeyForUpload) return;

    if (file.size > MAX_FILE_SIZE_MB * 1024 * 1024) {
      toast.error(`O vídeo é muito grande. Limite máximo: ${MAX_FILE_SIZE_MB}MB.`);
      return;
    }

    setIsUploading(activeFeatureKeyForUpload);
    const fileExt = file.name.split('.').pop();
    const fileName = `${activeFeatureKeyForUpload}_${Date.now()}.${fileExt}`;
    const filePath = `${VIDEO_STORAGE_FOLDER}/${fileName}`;

    try {
      const { error: uploadError } = await supabase.storage
        .from(VIDEO_STORAGE_BUCKET)
        .upload(filePath, file, {
          cacheControl: "31536000"
        });

      if (uploadError) throw uploadError;

      const featureTitle = frontendFeatures.find(f => f.feature_key === activeFeatureKeyForUpload)?.title || activeFeatureKeyForUpload;

      const { error: dbError } = await supabase
        .from('feature_videos')
        .upsert({
          feature_key: activeFeatureKeyForUpload,
          title: featureTitle,
          video_url: null, // Clear external URL if uploading to storage
          video_storage_path: filePath, // Store storage path
          video_mime: file.type
        }, { onConflict: 'feature_key' });

      if (dbError) throw dbError;

      toast.success("Vídeo carregado e salvo!");
      fetchFeatureVideos(); // Re-fetch to update state
    } catch (error: any) {
      console.error("[FeatureVideosPage] Upload/Save error:", error);
      if (error.message?.includes("404")) {
        toast.error("Erro: Tabela de vídeos não encontrada. Clique em 'Sincronizar Banco' para configurar.", { duration: 8000 });
      } else {
        toast.error(error.message || "Erro ao enviar vídeo.");
      }
    } finally {
      setIsUploading(null);
      setActiveFeatureKeyForUpload(null);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const handleUpdateVideoUrl = async (featureKey: string, newUrl: string) => {
    setIsSaving(true);
    try {
      const featureTitle = frontendFeatures.find(f => f.feature_key === featureKey)?.title || featureKey;
      const { error } = await supabase
        .from('feature_videos')
        .upsert({
          feature_key: featureKey,
          title: featureTitle,
          video_url: newUrl.trim() || null,
          video_storage_path: null, // Clear storage path if using external URL
          video_mime: null
        }, { onConflict: 'feature_key' });
      if (error) throw error;
      toast.success("URL do vídeo atualizada!");
      setEditingUrlForFeatureKey(null); // Close the input field
      fetchFeatureVideos();
    } catch (err: any) {
      console.error("[FeatureVideosPage] Error saving URL:", err);
      if (err.message?.includes("404")) {
        toast.error("Erro: Tabela de vídeos não encontrada. Clique em 'Sincronizar Banco' para configurar.", { duration: 8000 });
      } else {
        toast.error(err.message || "Erro ao salvar URL.");
      }
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeleteVideo = async (featureKey: string) => {
    if (!confirm("Tem certeza que deseja remover este vídeo?")) return;
    setIsSaving(true);
    try {
      const { error } = await supabase
        .from('feature_videos')
        .delete()
        .eq('feature_key', featureKey);
      if (error) throw error;
      toast.success("Vídeo removido!");
      fetchFeatureVideos();
    } catch (err: any) {
      console.error("[FeatureVideosPage] Error deleting video:", err);
      if (err.message?.includes("404")) {
        toast.error("Erro: Tabela de vídeos não encontrada. Clique em 'Sincronizar Banco' para configurar.", { duration: 8000 });
      } else {
        toast.error(err.message || "Erro ao remover vídeo.");
      }
    } finally {
      setIsSaving(false);
    }
  };

  const getVideoSourceUrl = (video: FeatureVideo | undefined) => {
    if (!video) return null;
    if (video.video_storage_path) {
      // For storage path, generate a public URL (assuming bucket is public or RLS allows)
      // If bucket is private, you'd need a signed URL here. For simplicity, using public URL for now.
      return `https://rkjvtnadqkbwomgzyswr.supabase.co/storage/v1/object/public/${VIDEO_STORAGE_BUCKET}/${video.video_storage_path}`;
    }
    return video.video_url;
  };

  if (loading) return <div className="flex justify-center p-8"><Loader2 className="animate-spin text-primary" /></div>;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Vídeos de Funcionalidades</h1>
          <p className="text-muted-foreground">Gerencie os vídeos de demonstração para cada funcionalidade da plataforma.</p>
        </div>
        <Button variant="outline" size="sm" className="gap-2" onClick={handleSyncDatabase} disabled={isSyncing}>
          {isSyncing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Database className="h-4 w-4" />}
          Sincronizar Banco
        </Button>
      </div>

      <div className="grid gap-6 grid-cols-1 md:grid-cols-2 lg:grid-cols-3">
        {frontendFeatures.map((feature) => {
          const video = featureVideos[feature.feature_key];
          const hasVideo = video && (video.video_url || video.video_storage_path);
          const currentVideoUrl = video?.video_url || "";
          const sourceUrl = getVideoSourceUrl(video);

          return (
            <Card key={feature.feature_key} className="overflow-hidden">
              <CardHeader className="pb-4">
                <div className="flex items-center justify-between">
                  <div className="space-y-1">
                    <CardTitle className="text-lg flex items-center gap-2">
                      <Video className="h-5 w-5 text-primary" />
                      {feature.title}
                    </CardTitle>
                    <CardDescription>{feature.description}</CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                {hasVideo ? (
                  <div className="space-y-4">
                    <div className="aspect-video rounded-xl overflow-hidden bg-black border shadow-inner relative group">
                      {sourceUrl && (
                        <LandingVideoPlayer 
                          url={sourceUrl}
                          title={feature.title}
                        />
                      )}
                    </div>
                    <div className="space-y-2">
                      <Label className="text-[10px] uppercase font-bold text-muted-foreground">Opções de Vídeo</Label>
                      <div className="flex flex-col gap-2">
                        <Button 
                          variant="outline" 
                          size="sm" 
                          className="gap-2"
                          onClick={() => handleUploadClick(feature.feature_key)}
                          disabled={isUploading === feature.feature_key}
                        >
                          {isUploading === feature.feature_key ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
                          Substituir por Upload
                        </Button>
                        <Button 
                          variant="outline" 
                          size="sm" 
                          className="gap-2"
                          onClick={() => {
                            setEditingUrlForFeatureKey(feature.feature_key);
                            setTempVideoUrl(currentVideoUrl); // Initialize with current URL
                          }}
                        >
                          <ExternalLink className="h-4 w-4" /> Substituir por URL
                        </Button>
                        <Button 
                          variant="ghost" 
                          size="sm" 
                          className="text-destructive hover:bg-destructive/10 gap-2"
                          onClick={() => handleDeleteVideo(feature.feature_key)}
                          disabled={isSaving}
                        >
                          <Trash2 className="h-4 w-4" /> Remover Vídeo
                        </Button>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div 
                    className="border-2 border-dashed rounded-xl p-12 flex flex-col items-center justify-center text-center space-y-4 hover:bg-secondary/10 transition-colors"
                  >
                    <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center">
                      <Video className="h-6 w-6 text-primary" />
                    </div>
                    <div className="space-y-1">
                      <p className="font-medium">Nenhum vídeo configurado</p>
                      <p className="text-xs text-muted-foreground">Adicione um vídeo de demonstração para esta funcionalidade.</p>
                    </div>
                    <div className="flex flex-col gap-3 w-full max-w-xs">
                      <Button
                        variant="default"
                        size="sm"
                        className="gap-2"
                        onClick={() => handleUploadClick(feature.feature_key)}
                        disabled={isUploading === feature.feature_key}
                      >
                        {isUploading === feature.feature_key ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Upload className="h-4 w-4" />}
                        Upload de Arquivo
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        className="gap-2"
                        onClick={() => {
                          setEditingUrlForFeatureKey(feature.feature_key);
                          setTempVideoUrl(""); // Clear for new entry
                        }}
                      >
                        <ExternalLink className="h-4 w-4" /> Inserir URL Externa
                      </Button>
                    </div>
                    {editingUrlForFeatureKey === feature.feature_key && (
                      <div className="w-full max-w-xs space-y-2 mt-4 animate-fade-in">
                        <Label className="sr-only">URL do Vídeo</Label>
                        <Input
                          placeholder="https://www.youtube.com/watch?v=..."
                          value={tempVideoUrl}
                          onChange={e => setTempVideoUrl(e.target.value)}
                          disabled={isSaving}
                          autoFocus
                        />
                        <Button
                          size="sm"
                          className="w-full gap-2"
                          onClick={() => handleUpdateVideoUrl(feature.feature_key, tempVideoUrl)}
                          disabled={isSaving || !tempVideoUrl.trim()}
                        >
                          {isSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />} Salvar URL
                        </Button>
                        <Button variant="ghost" size="sm" className="w-full" onClick={() => setEditingUrlForFeatureKey(null)}>Cancelar</Button>
                      </div>
                    )}
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
        accept="video/mp4,video/webm,video/quicktime" 
        onChange={handleFileUpload} 
      />
    </div>
  );
};

export default FeatureVideosPage;
