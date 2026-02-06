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

type CourseLevel = "iniciante" | "intermediario" | "avancado";

interface Lesson {
  id: string;
  title: string;
  type: "video" | "pdf" | "link";
  duration_minutes?: number;
  resource_url?: string;
  position?: number;
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

const CourseDetail = () => {
  const { slug } = useParams();
  const { user } = useAuth();
  const [course, setCourse] = useState<Course | null>(null);
  const [loading, setLoading] = useState(true);
  const [enrollData, setEnrollData] = useState<EnrollmentData>({ enrolledSlugs: [], progress: {} });
  const [savingProgress, setSavingProgress] = useState(false);

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

  const totalLessons = useMemo(() => {
    if (!course?.modules) return 0;
    return course.modules.reduce((acc, m) => acc + (m.lessons?.length || 0), 0);
  }, [course]);

  const completedLessons = useMemo(() => {
    if (!course || !user) return 0;
    const map = enrollData.progress[course.slug] || {};
    return Object.values(map).filter((s) => s === "completed").length;
  }, [course, user, enrollData]);

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
                        <div key={l.id} className="flex items-center justify-between border rounded-lg p-3">
                          <div className="flex flex-col">
                            <span className="font-medium">{l.title}</span>
                            <span className="text-xs text-muted-foreground capitalize">{l.type}{l.duration_minutes ? ` • ${l.duration_minutes} min` : ""}</span>
                          </div>
                          <div className="flex items-center gap-2">
                            {l.resource_url ? (
                              <Button asChild variant="outline" size="sm">
                                <a href={l.resource_url} target="_blank" rel="noreferrer">Abrir</a>
                              </Button>
                            ) : null}
                            <Button
                              variant={completed ? "default" : "outline"}
                              size="sm"
                              onClick={() => toggleLessonCompleted(l.id, !completed)}
                              disabled={savingProgress}
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