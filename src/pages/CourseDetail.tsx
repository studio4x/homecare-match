"use client";

import { useEffect, useMemo, useState } from "react";
import Layout from "@/components/layout/Layout";
import { supabase } from "@/integrations/supabase/client";
import { useParams, Link } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Loader2, Check, Award } from "lucide-react";
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
  const [certificateId, setCertificateId] = useState<string | null>(null);

  useEffect(() => {
    const loadCourse = async () => {
      setLoading(true);
      try {
        const { data: courseData, error: courseErr } = await supabase
          .from("academy_courses")
          .select("*")
          .eq("slug", slug)
          .single();
        if (courseErr) throw courseErr;

        const { data: mods, error: modErr } = await supabase
          .from("academy_modules")
          .select("*")
          .eq("course_slug", slug)
          .order("position", { ascending: true });
        if (modErr) throw modErr;

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
              storage_path: l.storage_path,
              mime_type: l.mime_type
            })),
          });
        }

        setCourse({
          ...courseData,
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

  const fetchCertificate = async () => {
    if (!user || !slug) return;
    const { data } = await supabase
      .from("certificates")
      .select("id")
      .eq("user_id", user.id)
      .eq("course_slug", slug)
      .maybeSingle();
    if (data) setCertificateId(data.id);
  };

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
        
        if (isEnr) fetchCertificate();
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

  const progressPct = totalLessons > 0 ? Math.round((completedLessons / totalLessons) * 100) : 0;

  // Lógica de emissão automática
  useEffect(() => {
    if (progressPct === 100 && isEnrolled && !certificateId && !savingProgress) {
      const issueCertificate = async () => {
        try {
          const workload = course?.duration_minutes || (totalLessons * 15);
          const validationCode = `HCM-${Math.random().toString(36).substring(2, 8).toUpperCase()}-${Date.now().toString(36).toUpperCase()}`;
          
          const { data, error } = await supabase
            .from("certificates")
            .insert({
              user_id: user?.id,
              course_slug: course?.slug,
              validation_code: validationCode,
              workload_minutes: workload
            })
            .select("id")
            .single();

          if (!error && data) {
            setCertificateId(data.id);
            toast.success("Parabéns! Seu certificado foi emitido automaticamente.", {
              icon: <Award className="text-yellow-500" />,
              duration: 8000
            });
          }
        } catch (e) {
          console.warn("Falha ao emitir certificado automaticamente:", e);
        }
      };
      issueCertificate();
    }
  }, [progressPct, isEnrolled, certificateId, savingProgress]);

  const toggleLessonViewer = async (lesson: Lesson) => {
    const isOpen = !!openViewer[lesson.id];
    if (isOpen) {
      setOpenViewer(prev => ({ ...prev, [lesson.id]: false }));
      return;
    }
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
    if (lesson.type === "pdf" || lesson.mime_type === "application/pdf") {
      setPdfOpenedMap(prev => ({ ...prev, [lesson.id]: true }));
    }
  };

  const downloadPdf = async (lesson: Lesson) => {
    const storagePath = lesson.storage_path || ((lesson.resource_url && !lesson.resource_url.startsWith("http")) ? lesson.resource_url : "");
    if (!storagePath) {
      toast.error("PDF não disponível para download.");
      return;
    }
    const { data, error } = await supabase.storage.from(PRIVATE_BUCKET).createSignedUrl(storagePath, 600);
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
    if (!user || !course) return;
    setSavingProgress(true);
    try {
      const { data: existing } = await supabase
        .from("academy_progress")
        .select("id")
        .eq("user_id", user.id)
        .eq("course_slug", course.slug)
        .eq("lesson_id", lessonId)
        .maybeSingle();

      if (existing?.id) {
        await supabase
          .from("academy_progress")
          .update({ status: value ? "completed" : "in-progress", updated_at: new Date().toISOString() })
          .eq("id", existing.id);
      } else {
        await supabase
          .from("academy_progress")
          .insert({ user_id: user.id, course_slug: course.slug, lesson_id: lessonId, status: value ? "completed" : "in-progress" });
      }

      const nextProg = { ...(enrollData.progress[course.slug] || {}) };
      nextProg[lessonId] = value ? "completed" : "in-progress";
      setEnrollData(prev => ({
        ...prev,
        progress: { ...prev.progress, [course.slug]: nextProg },
      }));
    } catch (e) {
      toast.error("Falha ao salvar progresso.");
    } finally {
      setSavingProgress(false);
    }
  };

  if (loading) return <Layout><div className="flex h-96 items-center justify-center"><Loader2 className="animate-spin" /></div></Layout>;
  if (!course) return <Layout><div className="container mx-auto px-4 py-12 text-center">Curso não encontrado.</div></Layout>;

  return (
    <Layout>
      <div className="container mx-auto px-4 py-8 space-y-6">
        <div className="flex flex-col md:flex-row gap-6">
          {course.hero_asset_url && (
            <div className="w-full md:w-1/3">
              <AspectRatio ratio={4/3} className="rounded-lg border bg-muted">
                <img src={course.hero_asset_url} alt={course.title} className="h-full w-full object-cover rounded-lg" />
              </AspectRatio>
            </div>
          )}
          <div className="flex-1 space-y-3">
            <h1 className="text-3xl font-bold">{course.title}</h1>
            <div className="flex items-center gap-3">
              <Badge variant="secondary" className="capitalize">{course.level || "iniciante"}</Badge>
              {course.duration_minutes ? <span className="text-sm text-muted-foreground">{course.duration_minutes} min</span> : null}
              {progressPct === 100 && <Badge className="bg-success">Concluído</Badge>}
            </div>
            <p className="text-muted-foreground">{course.description}</p>
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium">Seu progresso</span>
                <span className="text-sm">{progressPct}%</span>
              </div>
              <Progress value={progressPct} />
            </div>

            <div className="pt-2 flex flex-wrap gap-2">
              {!isEnrolled ? (
                <Button onClick={enroll} disabled={isEnrolling}>
                  {isEnrolling ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                  Inscrever-se
                </Button>
              ) : progressPct === 100 && certificateId && (
                <Button asChild className="bg-yellow-600 hover:bg-yellow-700 gap-2">
                  <Link to={`/certificado/${certificateId}`} target="_blank">
                    <Award size={18} /> Acessar Meu Certificado
                  </Link>
                </Button>
              )}
            </div>
          </div>
        </div>

        <Card>
          <CardHeader><CardTitle>Conteúdo</CardTitle></CardHeader>
          <CardContent className="space-y-6">
            {(course.modules || []).map((m) => (
              <div key={m.id} className="space-y-3">
                <h3 className="text-xl font-semibold">{m.title}</h3>
                <div className="space-y-2">
                  {(m.lessons || []).map((l) => {
                    const status = (enrollData.progress[course.slug!] || {})[l.id];
                    const completed = status === "completed";
                    return (
                      <div key={l.id} className="border rounded-lg p-4 space-y-4">
                        <div>
                          <h4 className="font-medium">{l.title}</h4>
                          <p className="text-xs text-muted-foreground capitalize">{l.type}{l.duration_minutes ? ` • ${l.duration_minutes} min` : ""}</p>
                        </div>

                        {openViewer[l.id] && viewerUrls[l.id] && (
                          <div className="w-full">
                            {(l.type === "video" || (l.mime_type || "").startsWith("video/")) ? (
                              <AspectRatio ratio={16 / 9} className="rounded-lg border bg-black/5">
                                <video controls playsInline src={viewerUrls[l.id]} className="w-full h-full rounded-lg object-contain" onEnded={() => setVideoEndedMap(prev => ({ ...prev, [l.id]: true }))} />
                              </AspectRatio>
                            ) : (
                              <iframe src={`${viewerUrls[l.id]}#toolbar=1&navpanes=0`} className="w-full h-[70vh] rounded-lg border" title={l.title} />
                            )}
                          </div>
                        )}

                        <div className="flex flex-wrap items-center gap-2">
                          <Button variant="outline" size="sm" onClick={() => toggleLessonViewer(l)}>{openViewer[l.id] ? "Fechar" : "Abrir"}</Button>
                          {(l.type === "pdf" || l.mime_type === "application/pdf") && <Button variant="outline" size="sm" onClick={() => downloadPdf(l)}>Baixar PDF</Button>}
                          <Button
                            variant={completed ? "default" : "outline"}
                            size="sm"
                            onClick={() => toggleLessonCompleted(l.id, !completed)}
                            disabled={savingProgress || (!completed && !((l.type === "video" ? !!videoEndedMap[l.id] : l.type === "pdf" ? !!pdfOpenedMap[l.id] : true)))}
                            className={completed ? "bg-success hover:bg-success/90 text-white" : ""}
                          >
                            {completed ? <Check className="h-4 w-4 mr-1" /> : null}
                            {completed ? "Concluída" : "Concluir"}
                          </Button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
    </Layout>
  );
};

export default CourseDetail;