"use client";

import { useState, useEffect } from "react";
import { useAuth } from "@/components/auth/AuthProvider";
import { supabase } from "@/integrations/supabase/client";
import CourseSummaryList from "@/components/CourseSummaryList";
import { Button } from "@/components/ui/button";
import { BookOpen, ArrowRight, Loader2 } from "lucide-react";
import { Link } from "react-router-dom";

const AcademyPage = () => {
  const { user } = useAuth();
  const [started, setStarted] = useState<any[]>([]);
  const [completed, setCompleted] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadCourses();
  }, [user]);

  const loadCourses = async () => {
    if (!user) return;
    setLoading(true);
    try {
      const { data: enrolls } = await supabase.from("academy_enrollments").select("course_slug").eq("user_id", user.id);
      const { data: certs } = await supabase.from("certificates").select("id, course_slug").eq("user_id", user.id);
      
      const certMap = new Map();
      (certs || []).forEach(c => certMap.set(c.course_slug, c.id));

      const slugs = (enrolls || []).map((e: any) => e.course_slug);
      const sArr = [];
      const cArr = [];
      
      for (const slug of slugs) {
        const { data: courseData } = await supabase.from("academy_courses").select("slug,title,hero_asset_url").eq("slug", slug).maybeSingle();
        if (!courseData) continue;
        const { data: mods } = await supabase.from("academy_modules").select("id").eq("course_slug", slug);
        const moduleIds = (mods || []).map((m: any) => m.id);
        let total = 0;
        if (moduleIds.length > 0) {
          const { count } = await supabase.from("academy_lessons").select("id", { count: "exact", head: true }).in("module_id", moduleIds);
          total = count || 0;
        }
        const { count: done } = await supabase.from("academy_progress").select("id", { count: "exact", head: true }).eq("user_id", user.id).eq("course_slug", slug).eq("status", "completed");
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