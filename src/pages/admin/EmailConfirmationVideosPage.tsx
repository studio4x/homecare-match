"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { getAllEmailConfirmationSteps, type EmailTutorialStep } from "@/lib/email-confirmation-tutorials";
import FeatureVideoModal from "@/components/FeatureVideoModal";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2, Database, Upload, ExternalLink, Save, Trash2, PlayCircle, RefreshCw } from "lucide-react";
import { sanitizeStorageFileName, sanitizeStoragePath } from "@/lib/storage-path";

const VIDEO_STORAGE_BUCKET = "uploads";
const VIDEO_STORAGE_FOLDER = "feature-videos/email-confirmed";
const MAX_FILE_SIZE_MB = 50;
const ALL_STEPS = getAllEmailConfirmationSteps();
const ALL_KEYS = ALL_STEPS.map((item) => item.featureKey);

type FeatureVideoRecord = {
  feature_key: string;
  title: string;
  video_url?: string | null;
  video_storage_path?: string | null;
  video_mime?: string | null;
};

const toMap = (rows: FeatureVideoRecord[]) =>
  rows.reduce<Record<string, FeatureVideoRecord>>((acc, row) => {
    acc[row.feature_key] = row;
    return acc;
  }, {});

const EmailConfirmationVideosPage = () => {
  const queryClient = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [loading, setLoading] = useState(true);
  const [isSyncing, setIsSyncing] = useState(false);
  const [isSeeding, setIsSeeding] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isUploadingKey, setIsUploadingKey] = useState<string | null>(null);
  const [activeUploadStep, setActiveUploadStep] = useState<EmailTutorialStep | null>(null);
  const [editingUrlKey, setEditingUrlKey] = useState<string | null>(null);
  const [tempUrl, setTempUrl] = useState("");
  const [videoMap, setVideoMap] = useState<Record<string, FeatureVideoRecord>>({});
  const [selectedVideo, setSelectedVideo] = useState<{ url: string; title: string; type: "url" | "storage" } | null>(null);

  const groupedSteps = useMemo(
    () => [
      { role: "professional", label: "Profissional", steps: ALL_STEPS.filter((item) => item.role === "professional") },
      { role: "company", label: "Empresa", steps: ALL_STEPS.filter((item) => item.role === "company") },
      { role: "family", label: "Familia", steps: ALL_STEPS.filter((item) => item.role === "family") },
    ],
    [],
  );

  const fetchVideos = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("feature_videos")
        .select("feature_key,title,video_url,video_storage_path,video_mime")
        .in("feature_key", ALL_KEYS);

      if (error) throw error;
      setVideoMap(toMap((data || []) as FeatureVideoRecord[]));
    } catch (error) {
      console.error("[EmailConfirmationVideosPage] fetchVideos:", error);
      toast.error("Erro ao carregar videos dos passos de e-mail confirmado.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchVideos();
  }, []);

  const handleSyncDatabase = async () => {
    setIsSyncing(true);
    try {
      const { error } = await supabase.functions.invoke("setup-feature-videos");
      if (error) throw error;
      queryClient.invalidateQueries({ queryKey: ["feature-videos"] });
      toast.success("Estrutura de videos sincronizada.");
      await fetchVideos();
    } catch (error) {
      console.error("[EmailConfirmationVideosPage] handleSyncDatabase:", error);
      toast.error("Nao foi possivel sincronizar a estrutura de videos.");
    } finally {
      setIsSyncing(false);
    }
  };

  const handleSeedMatrix = async () => {
    setIsSeeding(true);
    try {
      const payload = ALL_STEPS.map((item) => ({
        feature_key: item.featureKey,
        title: item.title,
      }));

      const { error } = await supabase.from("feature_videos").upsert(payload, { onConflict: "feature_key" });
      if (error) throw error;

      toast.success("Matriz inicial pre-cadastrada com sucesso.");
      await fetchVideos();
    } catch (error) {
      console.error("[EmailConfirmationVideosPage] handleSeedMatrix:", error);
      toast.error("Nao foi possivel pre-cadastrar a matriz.");
    } finally {
      setIsSeeding(false);
    }
  };

  const handleUploadClick = (step: EmailTutorialStep) => {
    setActiveUploadStep(step);
    fileInputRef.current?.click();
  };

  const handleUploadFile = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file || !activeUploadStep) return;

    if (file.size > MAX_FILE_SIZE_MB * 1024 * 1024) {
      toast.error(`Video acima do limite de ${MAX_FILE_SIZE_MB}MB.`);
      return;
    }

    const featureKey = activeUploadStep.featureKey;
    setIsUploadingKey(featureKey);

    const safeName = sanitizeStorageFileName(file.name, "video");
    const fileExt = safeName.split(".").pop() || "mp4";
    const fileName = `${featureKey}_${Date.now()}.${fileExt}`;
    const filePath = sanitizeStoragePath(`${VIDEO_STORAGE_FOLDER}/${fileName}`);

    try {
      const { error: uploadError } = await supabase.storage.from(VIDEO_STORAGE_BUCKET).upload(filePath, file, {
        cacheControl: "31536000",
      });
      if (uploadError) throw uploadError;

      const { error: upsertError } = await supabase.from("feature_videos").upsert(
        {
          feature_key: featureKey,
          title: activeUploadStep.title,
          video_url: null,
          video_storage_path: filePath,
          video_mime: file.type,
        },
        { onConflict: "feature_key" },
      );
      if (upsertError) throw upsertError;

      toast.success("Video salvo com sucesso.");
      await fetchVideos();
    } catch (error) {
      console.error("[EmailConfirmationVideosPage] handleUploadFile:", error);
      toast.error("Falha ao enviar o video.");
    } finally {
      if (fileInputRef.current) fileInputRef.current.value = "";
      setActiveUploadStep(null);
      setIsUploadingKey(null);
    }
  };

  const handleSaveUrl = async (step: EmailTutorialStep) => {
    setIsSaving(true);
    try {
      const { error } = await supabase.from("feature_videos").upsert(
        {
          feature_key: step.featureKey,
          title: step.title,
          video_url: tempUrl.trim() || null,
          video_storage_path: null,
          video_mime: null,
        },
        { onConflict: "feature_key" },
      );
      if (error) throw error;

      toast.success("URL salva com sucesso.");
      setEditingUrlKey(null);
      setTempUrl("");
      await fetchVideos();
    } catch (error) {
      console.error("[EmailConfirmationVideosPage] handleSaveUrl:", error);
      toast.error("Nao foi possivel salvar a URL.");
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeleteVideo = async (step: EmailTutorialStep) => {
    const current = videoMap[step.featureKey];
    if (!current) return;

    if (!confirm(`Remover video da ${step.title}?`)) return;

    setIsSaving(true);
    try {
      if (current.video_storage_path) {
        const safePath = sanitizeStoragePath(current.video_storage_path, { bucket: VIDEO_STORAGE_BUCKET });
        await supabase.storage.from(VIDEO_STORAGE_BUCKET).remove([safePath]);
      }

      const { error } = await supabase.from("feature_videos").delete().eq("feature_key", step.featureKey);
      if (error) throw error;
      toast.success("Video removido.");
      await fetchVideos();
    } catch (error) {
      console.error("[EmailConfirmationVideosPage] handleDeleteVideo:", error);
      toast.error("Falha ao remover video.");
    } finally {
      setIsSaving(false);
    }
  };

  const handleOpenPreview = async (step: EmailTutorialStep) => {
    const current = videoMap[step.featureKey];
    if (!current) return;

    try {
      if (current.video_storage_path) {
        const safePath = sanitizeStoragePath(current.video_storage_path, { bucket: VIDEO_STORAGE_BUCKET });
        const { data, error } = await supabase.storage.from(VIDEO_STORAGE_BUCKET).createSignedUrl(safePath, 3600);
        if (error) throw error;
        setSelectedVideo({ url: data.signedUrl, title: step.title, type: "storage" });
        return;
      }

      if (current.video_url) {
        setSelectedVideo({ url: current.video_url, title: step.title, type: "url" });
      }
    } catch (error) {
      console.error("[EmailConfirmationVideosPage] handleOpenPreview:", error);
      toast.error("Nao foi possivel abrir o video.");
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Videos de E-mail Confirmado</h1>
          <p className="text-muted-foreground">
            Configure os tutoriais exibidos em cada etapa da pagina de confirmacao de e-mail, separados por tipo de usuario.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" className="gap-2" onClick={handleSeedMatrix} disabled={isSeeding || isSyncing}>
            {isSeeding ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
            Pre-cadastrar matriz
          </Button>
          <Button variant="outline" className="gap-2" onClick={handleSyncDatabase} disabled={isSyncing || isSeeding}>
            {isSyncing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Database className="h-4 w-4" />}
            Sincronizar estrutura
          </Button>
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center py-16">
          <Loader2 className="h-6 w-6 animate-spin text-primary" />
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4">
          {groupedSteps.map((group) => (
            <Card key={group.role}>
              <CardHeader>
                <CardTitle>{group.label}</CardTitle>
                <CardDescription>Defina os videos tutorial para cada etapa exibida apos a confirmacao do e-mail.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                {group.steps.map((step) => {
                  const current = videoMap[step.featureKey];
                  const hasVideo = Boolean(current?.video_url || current?.video_storage_path);
                  const isEditingThisStep = editingUrlKey === step.featureKey;

                  return (
                    <div key={step.featureKey} className="rounded-lg border p-3">
                      <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                        <div className="space-y-1">
                          <p className="text-sm font-semibold">
                            Etapa {step.step}
                          </p>
                          <p className="text-sm text-muted-foreground">{step.text}</p>
                          <div className="flex items-center gap-2">
                            <Badge variant={hasVideo ? "default" : "outline"} className={hasVideo ? "bg-success hover:bg-success" : ""}>
                              {hasVideo ? "Video configurado" : "Sem video"}
                            </Badge>
                          </div>
                        </div>

                        <div className="flex flex-wrap gap-2">
                          <Button variant="outline" size="sm" className="gap-2" disabled={!hasVideo} onClick={() => handleOpenPreview(step)}>
                            <PlayCircle className="h-4 w-4" />
                            Ver
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            className="gap-2"
                            disabled={isUploadingKey === step.featureKey}
                            onClick={() => handleUploadClick(step)}
                          >
                            {isUploadingKey === step.featureKey ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
                            Upload
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            className="gap-2"
                            onClick={() => {
                              setEditingUrlKey(step.featureKey);
                              setTempUrl(current?.video_url || "");
                            }}
                          >
                            <ExternalLink className="h-4 w-4" />
                            URL
                          </Button>
                          <Button variant="ghost" size="sm" className="gap-2 text-destructive hover:bg-destructive/10" disabled={!hasVideo || isSaving} onClick={() => handleDeleteVideo(step)}>
                            <Trash2 className="h-4 w-4" />
                            Remover
                          </Button>
                        </div>
                      </div>

                      {isEditingThisStep ? (
                        <div className="mt-3 rounded-md border bg-muted/30 p-3">
                          <Label className="mb-2 block text-xs">URL do video</Label>
                          <div className="flex flex-col gap-2 sm:flex-row">
                            <Input
                              placeholder="https://www.youtube.com/watch?v=..."
                              value={tempUrl}
                              onChange={(event) => setTempUrl(event.target.value)}
                              disabled={isSaving}
                            />
                            <Button className="gap-2" size="sm" disabled={isSaving || !tempUrl.trim()} onClick={() => handleSaveUrl(step)}>
                              {isSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                              Salvar
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="gap-2"
                              disabled={isSaving}
                              onClick={() => {
                                setEditingUrlKey(null);
                                setTempUrl("");
                              }}
                            >
                              <RefreshCw className="h-4 w-4" />
                              Cancelar
                            </Button>
                          </div>
                        </div>
                      ) : null}
                    </div>
                  );
                })}
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <input ref={fileInputRef} type="file" className="hidden" accept="video/mp4,video/webm,video/quicktime" onChange={handleUploadFile} />

      <FeatureVideoModal open={Boolean(selectedVideo)} onOpenChange={() => setSelectedVideo(null)} video={selectedVideo} />
    </div>
  );
};

export default EmailConfirmationVideosPage;
