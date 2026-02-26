"use client";

import { useState, useEffect } from "react";
import { useAuth } from "@/components/auth/AuthProvider";
import { supabase } from "@/integrations/supabase/client";
import CourseSummaryList from "@/components/CourseSummaryList";
import { Button } from "@/components/ui/button";
import { BookOpen, ArrowRight, Loader2 } from "lucide-react";
import { Link } from "react-router-dom";

interface EnrollmentRow {
  course_slug: string;
}

interface CertificateRow {
  id: string;
  course_slug: string;
}

interface CourseRow {
  slug: string;
  title: string;
  hero_asset_url: string | null;
}

interface ModuleRow {
  id: string;
  course_slug: string;
}

interface LessonRow {
  id: string;
  module_id: string;
}

interface ProgressRow {
  id: string;
  course_slug: string;
  lesson_id: string | null;
}

const AcademyPage = () => {
  const { user } = useAuth();
  const [started, setStarted] = useState<any[]>([]);
  const [completed, setCompleted] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadCourses();
  }, [user?.id]);

  const loadCourses = async () => {
    if (!user) {
      setStarted([]);
      setCompleted([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    try {
      const [{ data: enrolls, error: enrollError }, { data: certs, error: certError }] = await Promise.all([
        supabase.from("academy_enrollments").select("course_slug").eq("user_id", user.id),
        supabase.from("certificates").select("id, course_slug").eq("user_id", user.id),
      ]);
      if (enrollError) throw enrollError;
      if (certError) throw certError;

      const certMap = new Map();
      (certs as CertificateRow[] | null)?.forEach((c) => certMap.set(c.course_slug, c.id));

      const slugs = Array.from(
        new Set(
          ((enrolls as EnrollmentRow[] | null) || [])
            .map((e) => e.course_slug)
            .filter(Boolean)
        )
      );
      if (slugs.length === 0) {
        setStarted([]);
        setCompleted([]);
        return;
      }

      const [
        { data: courses, error: coursesError },
        { data: modules, error: modulesError },
        { data: progressRows, error: progressError },
      ] = await Promise.all([
        supabase.from("academy_courses").select("slug,title,hero_asset_url").in("slug", slugs),
        supabase.from("academy_modules").select("id,course_slug").in("course_slug", slugs),
        supabase
          .from("academy_progress")
          .select("id,course_slug,lesson_id")
          .eq("user_id", user.id)
          .eq("status", "completed")
          .in("course_slug", slugs),
      ]);

      if (coursesError) throw coursesError;
      if (modulesError) throw modulesError;
      if (progressError) throw progressError;

      const courseBySlug = new Map<string, CourseRow>();
      (courses as CourseRow[] | null)?.forEach((course) => {
        courseBySlug.set(course.slug, course);
      });

      const moduleToCourse = new Map<string, string>();
      const moduleIds: string[] = [];
      (modules as ModuleRow[] | null)?.forEach((module) => {
        moduleIds.push(module.id);
        moduleToCourse.set(module.id, module.course_slug);
      });

      let lessons: LessonRow[] = [];
      if (moduleIds.length > 0) {
        const { data: lessonRows, error: lessonsError } = await supabase
          .from("academy_lessons")
          .select("id,module_id")
          .in("module_id", moduleIds);
        if (lessonsError) throw lessonsError;
        lessons = (lessonRows as LessonRow[] | null) || [];
      }

      const totalLessonsByCourse = new Map<string, number>();
      lessons.forEach((lesson) => {
        const courseSlug = moduleToCourse.get(lesson.module_id);
        if (!courseSlug) return;
        totalLessonsByCourse.set(courseSlug, (totalLessonsByCourse.get(courseSlug) || 0) + 1);
      });

      const doneLessonSetByCourse = new Map<string, Set<string>>();
      (progressRows as ProgressRow[] | null)?.forEach((row) => {
        const key = row.lesson_id || row.id;
        if (!key) return;
        if (!doneLessonSetByCourse.has(row.course_slug)) {
          doneLessonSetByCourse.set(row.course_slug, new Set<string>());
        }
        doneLessonSetByCourse.get(row.course_slug)?.add(key);
      });

      const sArr = [];
      const cArr = [];

      for (const slug of slugs) {
        const courseData = courseBySlug.get(slug);
        if (!courseData) continue;

        const total = totalLessonsByCourse.get(slug) || 0;
        const done = doneLessonSetByCourse.get(slug)?.size || 0;
        const progressPct = total > 0 ? Math.round(((done || 0) / total) * 100) : 0;
        const item = { 
          slug: courseData.slug, 
          title: courseData.title, 
          hero: courseData.hero_asset_url || "", 
          progressPct,
          certificateId: certMap.get(slug) || null
        };
        if (total > 0 && (done || 0) >= total) cArr.push(item); else sArr.push(item);
      }
      setStarted(sArr);
      setCompleted(cArr);
    } catch (error) {
      console.error("[AcademyPage] Falha ao carregar cursos:", error);
      setStarted([]);
      setCompleted([]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-8">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex flex-col gap-1">
          <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2"><BookOpen className="h-6 w-6 text-primary" /> Academy</h1>
          <p className="text-muted-foreground">Continue sua evolução profissional com nossos cursos exclusivos.</p>
        </div>
        <Button asChild className="gap-2">
          <Link to="/cursos">Catálogo de Cursos <ArrowRight className="h-4 w-4" /></Link>
        </Button>
      </div>

      <div className="grid gap-8">
        <div className="bg-card rounded-2xl border p-6 shadow-sm">
          <CourseSummaryList title="Cursos em Andamento" items={started} perPage={6} loading={loading} />
        </div>
        <div className="bg-card rounded-2xl border p-6 shadow-sm">
          <CourseSummaryList title="Concluídos" items={completed} perPage={6} loading={loading} />
        </div>
      </div>
    </div>
  );
};

export default AcademyPage;
