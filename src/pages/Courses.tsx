"use client";

import { useEffect, useState } from "react";
import Layout from "@/components/layout/Layout";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Loader2, LayoutDashboard } from "lucide-react";
import { Link } from "react-router-dom";
import { toast } from "sonner";
import { useAuth } from "@/components/auth/AuthProvider";
import AccessRestricted from "@/components/AccessRestricted";
import { AspectRatio } from "@/components/ui/aspect-ratio";
import { cn } from "@/lib/utils";

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

const Courses = () => {
  const { user, session } = useAuth();
  const [courses, setCourses] = useState<Course[]>([]);
  const [enrollments, setEnrollments] = useState<EnrollmentData>({ enrolledSlugs: [], progress: {} });
  const [loading, setLoading] = useState(true);
  const [loadingEnroll, setLoadingEnroll] = useState(false);
  const [userRole, setUserRole] = useState<string>("guest");
  const [roleLoading, setRoleLoading] = useState<boolean>(true);
  const [completedSlugs, setCompletedSlugs] = useState<string[]>([]);

  // Carrega papel do usuário
  useEffect(() => {
    const loadRole = async () => {
      try {
        if (user) {
          const { data } = await supabase
            .from("profiles")
            .select("role")
            .eq("id", user.id)
            .single();
          setUserRole(data?.role || "professional");
        } else {
          setUserRole("guest");
        }
      } finally {
        setRoleLoading(false);
      }
    };
    loadRole();
  }, [user]);

  // Carrega cursos ativos
  useEffect(() => {
    const loadCourses = async () => {
      setLoading(true);
      try {
        const { data, error } = await supabase
          .from("academy_courses")
          .select("*")
          .eq("is_active", true)
          .order("created_at", { ascending: false });
        if (error) throw error;
        setCourses(data || []);
      } catch (e) {
        console.warn("[Courses] Falha ao carregar cursos:", e);
        setCourses([]);
      } finally {
        setLoading(false);
      }
    };
    loadCourses();
  }, []);

  // Carrega inscrições do usuário
  useEffect(() => {
    const loadEnrollment = async () => {
      if (!user) return;
      try {
        const { data, error } = await supabase
          .from("academy_enrollments")
          .select("course_slug")
          .eq("user_id", user.id);
        if (error) throw error;
        setEnrollments({
          enrolledSlugs: (data || []).map((d: any) => d.course_slug),
          progress: {},
        });
      } catch {
        setEnrollments({ enrolledSlugs: [], progress: {} });
      }
    };
    loadEnrollment();
  }, [user]);

  // Checa conclusão dos cursos do usuário (100% aulas concluídas)
  useEffect(() => {
    const checkCompletion = async () => {
      if (!user || courses.length === 0) {
        setCompletedSlugs([]);
        return;
      }
      try {
        const results = await Promise.all(
          courses.map(async (c) => {
            const { data: mods } = await supabase
              .from("academy_modules")
              .select("id")
              .eq("course_slug", c.slug);
            const moduleIds = (mods || []).map((m: any) => m.id);
            if (moduleIds.length === 0) return { slug: c.slug, completed: false };

            const { count: totalLessons } = await supabase
              .from("academy_lessons")
              .select("id", { count: "exact", head: true })
              .in("module_id", moduleIds);

            const { count: done } = await supabase
              .from("academy_progress")
              .select("id", { count: "exact", head: true })
              .eq("user_id", user.id)
              .eq("course_slug", c.slug)
              .eq("status", "completed");

            const completed = (totalLessons || 0) > 0 && (done || 0) >= (totalLessons || 0);
            return { slug: c.slug, completed };
          })
        );
        setCompletedSlugs(results.filter(r => r.completed).map(r => r.slug));
      } catch {
        setCompletedSlugs([]);
      }
    };
    checkCompletion();
  }, [user, courses]);

  const isEnrolled = (slug: string) => enrollments.enrolledSlugs.includes(slug);
  const isCompleted = (slug: string) => completedSlugs.includes(slug);

  const enroll = async (slug: string) => {
    if (!user) {
      toast.error("Entre na sua conta para se inscrever.");
      return;
    }
    setLoadingEnroll(true);
    try {
      const { error } = await supabase
        .from("academy_enrollments")
        .upsert({ user_id: user.id, course_slug: slug }, { onConflict: "user_id,course_slug" });
      if (error) throw error;
      setEnrollments((prev) => ({
        enrolledSlugs: Array.from(new Set([...(prev.enrolledSlugs || []), slug])),
        progress: prev.progress || {},
      }));
      toast.success("Inscrição realizada!");
    } catch (e) {
      console.error("[Courses] Enroll error:", e);
      toast.error("Falha ao inscrever.");
    } finally {
      setLoadingEnroll(false);
    }
  };

  // Estado de carregamento do papel (evita decisões antes de saber se é profissional)
  if (roleLoading) {
    return (
      <Layout>
        <div className="container mx-auto px-4 py-12">
          <div className="flex items-center gap-2 text-muted-foreground">
            <Loader2 className="h-5 w-5 animate-spin" /> Carregando...
          </div>
        </div>
      </Layout>
    );
  }

  // Acesso restrito para deslogados
  if (!session) {
    return (
      <Layout>
        <AccessRestricted
          description="Os cursos de capacitação são exclusivos para Profissionais."
          primaryAction={{ label: "Entrar", to: "/login" }}
          secondaryAction={{ label: "Assinar Agora", to: "/login#auth-sign-up" }}
        />
      </Layout>
    );
  }

  // Acesso restrito para papéis que não são profissionais
  if (session && userRole !== "professional") {
    return (
      <Layout>
        <AccessRestricted
          description="Os cursos de capacitação são exclusivos para Profissionais."
          primaryAction={{ label: "Ir para Meu Painel", to: "/dashboard" }}
        />
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="container mx-auto px-4 py-8">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
          <h1 className="text-3xl font-bold">Cursos de Capacitação</h1>
          <Button asChild variant="outline" className="hidden md:flex gap-2">
            <Link to="/dashboard">
              <LayoutDashboard className="h-4 w-4" />
              Voltar ao Dashboard
            </Link>
          </Button>
        </div>

        {loading ? (
          <div className="flex items-center gap-2 text-muted-foreground">
            <Loader2 className="h-5 w-5 animate-spin" /> Carregando cursos...
          </div>
        ) : courses.length > 0 ? (
          <>
            <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {courses.map((c) => (
                <Card key={c.slug} className="overflow-hidden flex flex-col">
                  {c.hero_asset_url ? (
                    <AspectRatio ratio={4/3} className="relative w-full bg-muted shrink-0">
                      {isCompleted(c.slug) ? (
                        <Badge className="absolute left-2 top-2 bg-success z-10">Concluído</Badge>
                      ) : null}
                      <img
                        src={c.hero_asset_url}
                        alt={c.title}
                        className="h-full w-full object-cover rounded-t-md"
                      />
                    </AspectRatio>
                  ) : null}
                  <CardHeader>
                    <CardTitle className="flex items-center justify-between gap-2">
                      <span className="line-clamp-2">{c.title}</span>
                      <Badge variant="secondary" className="capitalize shrink-0">{c.level || "iniciante"}</Badge>
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4 flex-1 flex flex-col">
                    <div 
                      className="text-sm text-muted-foreground prose prose-sm max-w-none line-clamp-4 flex-1"
                      dangerouslySetInnerHTML={{ __html: c.description || "" }}
                    />
                    <div className="flex items-center justify-between pt-2">
                      <span className="text-xs text-muted-foreground flex items-center gap-1">
                        {c.duration_minutes ? `${c.duration_minutes} min` : ""}
                      </span>
                      <div className="flex gap-2">
                        <Button asChild variant="outline" size="sm">
                          <Link to={`/cursos/${c.slug}`}>Ver detalhes</Link>
                        </Button>
                        {isEnrolled(c.slug) ? (
                          <Button 
                            asChild 
                            size="sm"
                            className={cn(isCompleted(c.slug) && "bg-success hover:bg-success/90 border-none")}
                          >
                            <Link to={`/cursos/${c.slug}`}>{isCompleted(c.slug) ? "Rever Curso" : "Continuar"}</Link>
                          </Button>
                        ) : (
                          <Button size="sm" onClick={() => enroll(c.slug)} disabled={loadingEnroll}>
                            {loadingEnroll ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                            Inscrever-se
                          </Button>
                        )}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
            
            <div className="mt-12 flex md:hidden justify-center">
              <Button asChild variant="outline" className="w-full max-w-xs gap-2 h-12">
                <Link to="/dashboard">
                  <LayoutDashboard className="h-4 w-4" />
                  Voltar ao Dashboard
                </Link>
              </Button>
            </div>
          </>
        ) : (
          <p className="text-muted-foreground">Nenhum curso disponível no momento.</p>
        )}
      </div>
    </Layout>
  );
};

export default Courses;