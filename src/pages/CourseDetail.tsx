"use client";

import { useEffect, useMemo, useState } from "react";
import Layout from "@/components/layout/Layout";
import { supabase } from "@/integrations/supabase/client";
import { useParams, Link } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Loader2, Check } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/components/auth/AuthProvider";
import { AspectRatio } from "@/components/ui/aspect-ratio";

type CourseLevel = "iniciante" | "intermediario" | "avancado";

interface Lesson {
  id: string;
  title: string;
  type: "video" | "pdf" | "link";
  duration_minutes?: number;
  resource_url?: string;
  position?: number;
  storage_path?: string;
  mime_type?: string;
}

interface Module {
  id: string;
  title: string;
  description?: string;
  position?: number;
  lessons: Lesson[];
}

interface Course {
  slug: string;
  title: string;
  description?: string;
  level?: CourseLevel;
  duration_minutes?: number;
  is_active?: boolean;
  hero_asset_url?: string;
  content_url?: string;
  created_at?: string;
  modules?: Module[];
}

interface EnrollmentData {
  enrolledSlugs: string[];
  progress: Record<string, Record<string, "completed" | "in-progress">>;
}

const STORAGE_COURSES = "academy/courses.json";
const PRIVATE_BUCKET = "academy-private";

const CourseDetail = () => {
  const { slug } = useParams();
  const { user } = useAuth();
  const [course, setCourse] = useState<Course | null>(null);
  const [loading, setLoading] = useState(true);
  const [enrollData, setEnrollData] = useState<EnrollmentData>({ enrolledSlugs: [], progress: {} });
  const [savingProgress, setSavingProgress] = useState(false);
  const [viewerUrls, setViewerUrls] = useState<Record<string, string>>({});
  const [openViewer, setOpenViewer] = useState<Record<string, boolean>>({});
  const [isEnrolling, setIsEnrolling] = useState(false);
  const [videoEndedMap, setVideoEndedMap] = useState<Record<string, boolean>>({});
  const [pdfOpenedMap, setPdfOpenedMap] = useState<Record<string, boolean>>({});

  useEffect(() => {
    const loadCourse = async () => {
      setLoading(true);
      try {
        // curso
        const { data: courseData, error: courseErr } = await supabase
          .from("academy_courses")
          .select("*")
          .eq("slug", slug)
          .single();
        if (courseErr) throw courseErr;

        // módulos
        const { data: mods, error: modErr } = await supabase
          .from("academy_modules")
          .select("*")
          .eq("course_slug", slug)
          .order("position", { ascending: true });
        if (modErr) throw modErr;

        // aulas por módulo
        const modulesWithLessons = [];
        for (const m of mods || []) {
          const { data: lessons, error: lessonErr } = await supabase
            .from("academy_lessons")
            .select("*")
            .eq("module_id", m.id)
            .order("position", { ascending: true });
          if (lessonErr) throw lessonErr;
          modulesWithLessons.push({
            id: m.id,
            title: m.title,
            description: m.description || "",
            position: m.position || 1,
            lessons: (lessons || []).map((l) => ({
              id: l.id,
              title: l.title,
              type: l.type,
              duration_minutes: l.duration_minutes || 0,
              resource_url: l.resource_url || "",
              position: l.position || 1,
            })),
          });
        }

        setCourse({
          slug: courseData.slug,
          title: courseData.title,
          description: courseData.description,
          level: courseData.level,
          duration_minutes: courseData.duration_minutes,
          is_active: courseData.is_active,
          hero_asset_url: courseData.hero_asset_url,
          content_url: courseData.content_url,
          created_at: courseData.created_at,
          modules: modulesWithLessons,
        });
      } catch (e) {
        console.warn("[CourseDetail] Falha ao carregar curso:", e);
        setCourse(null);
      } finally {
        setLoading(false);
      }
    };
    if (slug) loadCourse();
  }, [slug]);

  useEffect(() => {
    const loadEnrollment = async () => {
      if (!user || !slug) return;
      try {
        const { data: enrolls } = await supabase
          .from("academy_enrollments")
          .select("course_slug")
          .eq("user_id", user.id)
          .eq("course_slug", slug);
        const isEnr = !!(enrolls && enrolls.length > 0);

        const { data: prog } = await supabase
          .from("academy_progress")
          .select("lesson_id,status")
          .eq("user_id", user.id)
          .eq("course_slug", slug);

        const progressMap = {} as Record<string, "completed" | "in-progress">;
        (prog || []).forEach((p: any) => {
          progressMap[p.lesson_id] = p.status as "completed" | "in-progress";
        });

        setEnrollData({
          enrolledSlugs: isEnr ? [slug] : [],
          progress: { [slug]: progressMap },
        });
      } catch {
        setEnrollData({ enrolledSlugs: [], progress: {} });
      }
    };
    loadEnrollment();
  }, [user, slug]);

  const isEnrolled = useMemo(() => {
    if (!course || !user) return false;
    return enrollData.enrolledSlugs.includes(course.slug);
  }, [course, user, enrollData]);

  const enroll = async () => {
    if (!user || !course) return;
    setIsEnrolling(true);
    try {
      const { error } = await supabase
        .from("academy_enrollments")
        .upsert({ user_id: user.id, course_slug: course.slug }, { onConflict: "user_id,course_slug" });
      if (error) throw error;
      setEnrollData((prev) => ({
        enrolledSlugs: Array.from(new Set([...(prev.enrolledSlugs || []), course.slug])),
        progress: prev.progress || {},
      }));
      toast.success("Inscrição realizada!");
    } catch (e) {
      console.error("[CourseDetail] Enroll error:", e);
      toast.error("Falha ao inscrever.");
    } finally {
      setIsEnrolling(false);
    }
  };

  const totalLessons = useMemo(() => {
    if (!course?.modules) return 0;
    return course.modules.reduce((acc, m) => acc + (m.lessons?.length || 0), 0);
  }, [course]);

  const completedLessons = useMemo(() => {
    if (!course || !user) return 0;
    const map = enrollData.progress[course.slug] || {};
    return Object.values(map).filter((s) => s === "completed").length;
  }, [course, user, enrollData]);

  const toggleLessonViewer = async (lesson: Lesson) => {
    const isOpen = !!openViewer[lesson.id];
    if (isOpen) {
      setOpenViewer(prev => ({ ...prev, [lesson.id]: false }));
      return;
    }
    // Fallback: se não tiver storage_path, usa resource_url (quando for um caminho interno)
    const storagePath = lesson.storage_path || ((lesson.resource_url && !lesson.resource_url.startsWith("http")) ? lesson.resource_url : "");
    if (!storagePath) {
      toast.error("Este conteúdo ainda não foi enviado para visualização interna.");
      return;
    }
    const { data, error } = await supabase.storage.from(PRIVATE_BUCKET).createSignedUrl(storagePath, 3600);
    if (error || !data?.signedUrl) {
      toast.error("Não foi possível abrir o conteúdo.");
      return;
    }
    setViewerUrls(prev => ({ ...prev, [lesson.id]: data.signedUrl }));
    setOpenViewer(prev => ({ ...prev, [lesson.id]: true }));
    // Se for PDF, marcar que foi aberto (permite concluir)
    if (lesson.type === "pdf" || lesson.mime_type === "application/pdf") {
      setPdfOpenedMap(prev => ({ ...prev, [lesson.id]: true }));
    }
  };

  const downloadPdf = async (lesson: Lesson) => {
    // Fallback do caminho
    const storagePath = lesson.storage_path || ((lesson.resource_url && !lesson.resource_url.startsWith("http")) ? lesson.resource_url : "");
    if (!storagePath) {
      toast.error("PDF não disponível para download.");
      return;
    }
    const { data, error } = await supabase.storage
      .from(PRIVATE_BUCKET)
      .createSignedUrl(storagePath, 600);

    if (error || !data?.signedUrl) {
      toast.error("Falha ao gerar link de download.");
      return;
    }

    const res = await fetch(data.signedUrl);
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${(course?.slug || "curso")}-${lesson.id}.pdf`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
    toast.success("Download iniciado!");
  };

  const toggleLessonCompleted = async (lessonId: string, value: boolean) => {
    if (!user || !course) {
      toast.error("Entre na sua conta para registrar progresso.");
      return;
    }
    setSavingProgress(true);
    try {
      // verifica se existe
      const { data: existing } = await supabase
        .from("academy_progress")
        .select("id")
        .eq("user_id", user.id)
        .eq("course_slug", course.slug)
        .eq("lesson_id", lessonId)
        .maybeSingle();

      if (existing?.id) {
        const { error: updErr } = await supabase
          .from("academy_progress")
          .update({ status: value ? "completed" : "in-progress", updated_at: new Date().toISOString() })
          .eq("id", existing.id);
        if (updErr) throw updErr;
      } else {
        const { error: insErr } = await supabase
          .from("academy_progress")
          .insert({ user_id: user.id, course_slug: course.slug, lesson_id: lessonId, status: value ? "completed" : "in-progress" });
        if (insErr) throw insErr;
      }

      const nextProg = { ...(enrollData.progress[course.slug] || {}) };
      nextProg[lessonId] = value ? "completed" : "in-progress";
      setEnrollData({
        enrolledSlugs: Array.from(new Set([...(enrollData.enrolledSlugs || []), course.slug])),
        progress: { ...enrollData.progress, [course.slug]: nextProg },
      });
    } catch (e) {
      console.error("[CourseDetail] Progress save error:", e);
      toast.error("Falha ao salvar progresso.");
    } finally {
      setSavingProgress(false);
    }
  };

  if (loading) {
    return (
      <Layout>
        <div className="container mx-auto px-4 py-12">
          <div className="flex items-center gap-2 text-muted-foreground">
            <Loader2 className="h-5 w-5 animate-spin" /> Carregando curso...
          </div>
        </div>
      </Layout>
    );
  }

  if (!course) {
    return (
      <Layout>
        <div className="container mx-auto px-4 py-12">
          <Card>
            <CardHeader>
              <CardTitle>Curso não encontrado</CardTitle>
            </CardHeader>
            <CardContent>
              <Button asChild>
                <Link to="/cursos">Voltar aos cursos</Link>
              </Button>
            </CardContent>
          </Card>
        </div>
      </Layout>
    );
  }

  const progressPct = totalLessons > 0 ? Math.round((completedLessons / totalLessons) * 100) : 0;

  return (
    <Layout>
      <div className="container mx-auto px-4 py-8 space-y-6">
        <div className="flex flex-col md:flex-row gap-6">
          {course.hero_asset_url ? (
            <img src={course.hero_asset_url} alt={course.title} className="w-full md:w-1/3 h-48 object-cover rounded-lg border" />
          ) : null}
          <div className="flex-1 space-y-3">
            <h1 className="text-3xl font-bold">{course.title}</h1>
            <div className="flex items-center gap-3">
              <Badge variant="secondary" className="capitalize">{course.level || "iniciante"}</Badge>
              {course.duration_minutes ? <span className="text-sm text-muted-foreground">{course.duration_minutes} min</span> : null}
            </div>
            <p className="text-muted-foreground">{course.description}</p>
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium">Seu progresso</span>
                <span className="text-sm">{progressPct}%</span>
              </div>
              <Progress value={progressPct} />
            </div>
            {!isEnrolled && (
              <div className="pt-2">
                <Button onClick={enroll} disabled={isEnrolling}>
                  {isEnrolling ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                  Inscrever-se
                </Button>
              </div>
            )}
          </div>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Conteúdo</CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            {(course.modules || []).length > 0 ? (
              (course.modules || []).map((m) => (
                <div key={m.id} className="space-y-3">
                  <div>
                    <h3 className="text-xl font-semibold">{m.title}</h3>
                    {m.description ? <p className="text-sm text-muted-foreground">{m.description}</p> : null}
                  </div>
                  <div className="space-y-2">
                    {(m.lessons || []).map((l) => {
                      const status = (enrollData.progress[course.slug] || {})[l.id];
                      const completed = status === "completed";
                      return (
                        <div key={l.id} className="border rounded-lg p-4 space-y-4">
                          {/* Título da aula no topo */}
                          <div>
                            <h4 className="font-medium">{l.title}</h4>
                            <p className="text-xs text-muted-foreground capitalize">
                              {l.type}{l.duration_minutes ? ` • ${l.duration_minutes} min` : ""}
                            </p>
                          </div>

                          {/* Viewer central com tamanho ajustado */}
                          {openViewer[l.id] && viewerUrls[l.id] ? (
                            <div className="w-full">
                              {(l.type === "video" || (l.mime_type || "").startsWith("video/")) ? (
                                <AspectRatio ratio={16 / 9} className="rounded-lg border bg-black/5">
                                  <video
                                    controls
                                    playsInline
                                    src={viewerUrls[l.id]}
                                    className="w-full h-full rounded-lg object-contain"
                                    onEnded={() => setVideoEndedMap(prev => ({ ...prev, [l.id]: true }))}
                                  />
                                </AspectRatio>
                              ) : (l.type === "pdf" || l.mime_type === "application/pdf") ? (
                                <iframe
                                  src={`${viewerUrls[l.id]}#toolbar=1&navpanes=0`}
                                  className="w-full h-[70vh] rounded-lg border"
                                  title={l.title}
                                />
                              ) : (
                                <p className="text-sm text-muted-foreground">
                                  Tipo de conteúdo não suportado para visualização interna.
                                </p>
                              )}
                            </div>
                          ) : null}

                          {/* Botões na base */}
                          <div className="flex flex-wrap items-center gap-2">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => toggleLessonViewer(l)}
                            >
                              {openViewer[l.id] ? "Fechar" : "Abrir"}
                            </Button>
                            {(l.type === "pdf" || l.mime_type === "application/pdf") && (
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => downloadPdf(l)}
                              >
                                Baixar PDF
                              </Button>
                            )}
                            {(() => {
                              const isVideo = l.type === "video" || (l.mime_type || "").startsWith("video/");
                              const isPdf = l.type === "pdf" || l.mime_type === "application/pdf";
                              const canComplete = isVideo ? !!videoEndedMap[l.id] : isPdf ? !!pdfOpenedMap[l.id] : true;
                              const disableComplete = savingProgress || (!completed && !canComplete);
                              return (
                                <Button
                                  variant={completed ? "default" : "outline"}
                                  size="sm"
                                  onClick={() => toggleLessonCompleted(l.id, !completed)}
                                  disabled={disableComplete}
                                  className={completed ? "bg-success hover:bg-success/90 text-white" : ""}
                                >
                                  {completed ? <Check className="h-4 w-4 mr-1" /> : null}
                                  {completed ? "Concluída" : "Concluir"}
                                </Button>
                              );
                            })()}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))
            ) : (
              <p className="text-muted-foreground">Este curso ainda não possui módulos e aulas configurados.</p>
            )}
            <div className="pt-2">
              <Button asChild variant="outline">
                <Link to="/cursos">Voltar</Link>
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </Layout>
  );
};

export default CourseDetail;