"use client";

import { useEffect, useState } from "react";
import Layout from "@/components/layout/Layout";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Loader2 } from "lucide-react";
import { Link } from "react-router-dom";
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

const STORAGE_PATH = "academy/courses.json";

const Courses = () => {
  const { user } = useAuth();
  const [courses, setCourses] = useState<Course[]>([]);
  const [enrollments, setEnrollments] = useState<EnrollmentData>({ enrolledSlugs: [], progress: {} });
  const [loading, setLoading] = useState(true);
  const [loadingEnroll, setLoadingEnroll] = useState(false);

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

  const isEnrolled = (slug: string) => enrollments.enrolledSlugs.includes(slug);

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

  return (
    <Layout>
      <div className="container mx-auto px-4 py-8">
        <h1 className="text-3xl font-bold mb-6">Cursos de Capacitação</h1>

        {loading ? (
          <div className="flex items-center gap-2 text-muted-foreground">
            <Loader2 className="h-5 w-5 animate-spin" /> Carregando cursos...
          </div>
        ) : courses.length > 0 ? (
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {courses.map((c) => (
              <Card key={c.slug} className="overflow-hidden">
                {c.hero_asset_url ? (
                  <img src={c.hero_asset_url} alt={c.title} className="w-full h-40 object-cover" />
                ) : null}
                <CardHeader>
                  <CardTitle className="flex items-center justify-between">
                    <span>{c.title}</span>
                    <Badge variant="secondary" className="capitalize">{c.level || "iniciante"}</Badge>
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <p className="text-sm text-muted-foreground">{c.description}</p>
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-muted-foreground">{c.duration_minutes ? `${c.duration_minutes} min` : ""}</span>
                    <div className="flex gap-2">
                      <Button asChild variant="outline" size="sm">
                        <Link to={`/cursos/${c.slug}`}>Ver detalhes</Link>
                      </Button>
                      {isEnrolled(c.slug) ? (
                        <Button asChild size="sm">
                          <Link to={`/cursos/${c.slug}`}>Continuar</Link>
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
        ) : (
          <p className="text-muted-foreground">Nenhum curso disponível no momento.</p>
        )}
      </div>
    </Layout>
  );
};

export default Courses;