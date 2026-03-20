"use client";

import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { CheckCircle2, Loader2, MailCheck, PlayCircle } from "lucide-react";
import { toast } from "sonner";
import Layout from "@/components/layout/Layout";
import FeatureVideoModal from "@/components/FeatureVideoModal";
import { useAuth } from "@/components/auth/AuthProvider";
import { supabase } from "@/integrations/supabase/client";
import { getEmailConfirmationSteps, type EmailTutorialRole } from "@/lib/email-confirmation-tutorials";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { sanitizeStoragePath } from "@/lib/storage-path";

type FeatureVideoRecord = {
  feature_key: string;
  title: string;
  video_url?: string | null;
  video_storage_path?: string | null;
  video_mime?: string | null;
};

const EmailConfirmed = () => {
  const { user, loading } = useAuth();
  const [role, setRole] = useState<EmailTutorialRole>("professional");
  const [name, setName] = useState<string>("");
  const [loadingRole, setLoadingRole] = useState(true);
  const [loadingTutorials, setLoadingTutorials] = useState(false);
  const [tutorialMap, setTutorialMap] = useState<Record<string, FeatureVideoRecord>>({});
  const [selectedVideo, setSelectedVideo] = useState<{ url: string; title: string; type: "url" | "storage" } | null>(null);

  const steps = useMemo(() => getEmailConfirmationSteps(role), [role]);
  const roleLabel = useMemo(() => steps[0]?.roleLabel ?? "Profissional", [steps]);

  useEffect(() => {
    let active = true;

    const resolveRole = async () => {
      if (!user) {
        if (active) setLoadingRole(false);
        return;
      }

      const metadataRole = String((user.user_metadata as any)?.role || "").toLowerCase();
      const metadataName = String((user.user_metadata as any)?.full_name || "").trim();

      if (active && metadataName) {
        setName(metadataName);
      }
      if (metadataRole === "company" || metadataRole === "family" || metadataRole === "professional") {
        if (active) setRole(metadataRole);
      }

      try {
        const { data } = await supabase
          .from("profiles")
          .select("role, full_name")
          .eq("id", user.id)
          .maybeSingle();

        if (!active) return;

        const dbRole = String(data?.role || "").toLowerCase();
        if (dbRole === "company" || dbRole === "family" || dbRole === "professional") {
          setRole(dbRole);
        }

        if (typeof data?.full_name === "string" && data.full_name.trim()) {
          setName(data.full_name.trim());
        }
      } finally {
        if (active) setLoadingRole(false);
      }
    };

    resolveRole();

    return () => {
      active = false;
    };
  }, [user]);

  useEffect(() => {
    let active = true;

    const fetchTutorials = async () => {
      if (!user || steps.length === 0) return;

      setLoadingTutorials(true);
      try {
        const keys = steps.map((item) => item.featureKey);
        const { data, error } = await supabase
          .from("feature_videos")
          .select("feature_key,title,video_url,video_storage_path,video_mime")
          .in("feature_key", keys);

        if (error) throw error;
        if (!active) return;

        const map = (data || []).reduce<Record<string, FeatureVideoRecord>>((acc, row: any) => {
          acc[row.feature_key] = row;
          return acc;
        }, {});
        setTutorialMap(map);
      } catch (error) {
        console.error("[EmailConfirmed] fetchTutorials:", error);
      } finally {
        if (active) setLoadingTutorials(false);
      }
    };

    fetchTutorials();

    return () => {
      active = false;
    };
  }, [user, steps]);

  const handleOpenTutorial = async (featureKey: string, title: string) => {
    const tutorial = tutorialMap[featureKey];
    if (!tutorial) return;

    try {
      if (tutorial.video_storage_path) {
        const safePath = sanitizeStoragePath(tutorial.video_storage_path, { bucket: "uploads" });
        const { data, error } = await supabase.storage.from("uploads").createSignedUrl(safePath, 3600);
        if (error) throw error;
        setSelectedVideo({ url: data.signedUrl, title, type: "storage" });
        return;
      }

      if (tutorial.video_url) {
        setSelectedVideo({ url: tutorial.video_url, title, type: "url" });
      }
    } catch (error) {
      console.error("[EmailConfirmed] handleOpenTutorial:", error);
      toast.error("Nao foi possivel abrir o tutorial.");
    }
  };

  if (loading || loadingRole) {
    return (
      <Layout>
        <div className="flex h-[60vh] items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      </Layout>
    );
  }

  if (!user) {
    return (
      <Layout>
        <div className="mx-auto flex min-h-[60vh] max-w-xl items-center px-4">
          <Card className="w-full">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <MailCheck className="h-5 w-5 text-primary" />
                E-mail confirmado
              </CardTitle>
              <CardDescription>Seu e-mail foi confirmado. Faca login para continuar a configuracao da sua conta.</CardDescription>
            </CardHeader>
            <CardContent>
              <Button asChild className="w-full">
                <Link to="/login">Ir para Login</Link>
              </Button>
            </CardContent>
          </Card>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="mx-auto max-w-3xl px-4 py-10 md:py-16">
        <Card>
          <CardHeader className="space-y-3">
            <Badge className="w-fit bg-success/10 text-success border-success/30 hover:bg-success/10">
              <CheckCircle2 className="mr-1 h-3.5 w-3.5" />
              E-mail confirmado com sucesso
            </Badge>
            <CardTitle className="text-2xl md:text-3xl">{name ? `Tudo certo, ${name.split(" ")[0]}!` : "Tudo certo!"}</CardTitle>
            <CardDescription className="text-base">
              Sua conta esta ativa. Agora siga estes proximos passos para concluir seu acesso na plataforma.
            </CardDescription>
          </CardHeader>

          <CardContent className="space-y-6">
            <div className="rounded-lg border bg-secondary/30 p-4">
              <p className="text-sm font-medium">
                Tipo de perfil identificado: <span className="text-primary">{roleLabel}</span>
              </p>
            </div>

            <div className="space-y-3">
              {steps.map((step) => {
                const tutorial = tutorialMap[step.featureKey];
                const hasTutorial = Boolean(tutorial?.video_url || tutorial?.video_storage_path);

                return (
                  <div key={step.featureKey} className="rounded-lg border p-3">
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                      <p className="text-sm text-foreground">
                        {step.step}) {step.text}
                      </p>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="gap-2 self-start sm:self-auto"
                        disabled={!hasTutorial || loadingTutorials}
                        onClick={() => handleOpenTutorial(step.featureKey, step.title)}
                      >
                        <PlayCircle className="h-4 w-4" />
                        {hasTutorial ? "Ver tutorial" : "Tutorial em breve"}
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="flex flex-col gap-3 sm:flex-row">
              <Button asChild className="sm:flex-1">
                <Link to="/dashboard/perfil">Ir para Dashboard / Perfil</Link>
              </Button>
              <Button asChild variant="outline" className="sm:flex-1">
                <Link to="/dashboard">Abrir Dashboard</Link>
              </Button>
            </div>

            {loadingTutorials ? <p className="text-xs text-muted-foreground">Carregando tutoriais...</p> : null}
          </CardContent>
        </Card>
      </div>

      <FeatureVideoModal open={Boolean(selectedVideo)} onOpenChange={() => setSelectedVideo(null)} video={selectedVideo} />
    </Layout>
  );
};

export default EmailConfirmed;
