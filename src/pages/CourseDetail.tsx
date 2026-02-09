"use client";

import { useEffect, useMemo, useState } from "react";
import Layout from "@/components/layout/Layout";
import { supabase } from "@/integrations/supabase/client";
import { useParams, Link } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Loader2, Check, Award, FileText, PlayCircle, FileSearch, ExternalLink } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/components/auth/AuthProvider";
import { AspectRatio } from "@/components/ui/aspect-ratio";

// ... Tipagens permanecem ...

const CourseDetail = () => {
  // ... Estados e efeitos permanecem ...
  const { slug } = useParams();
  const { user } = useAuth();
  const [course, setCourse] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [enrollData, setEnrollData] = useState<any>({ enrolledSlugs: [], progress: {} });
  const [certificateId, setCertificateId] = useState<string | null>(null);

  useEffect(() => {
    const fetchAll = async () => {
      setLoading(true);
      try {
        const { data: c } = await supabase.from("academy_courses").select("*").eq("slug", slug).single();
        const { data: m } = await supabase.from("academy_modules").select("*").eq("course_slug", slug).order("position", { ascending: true });
        
        const modsWithLessons = [];
        for (const mod of m || []) {
          const { data: l } = await supabase.from("academy_lessons").select("*").eq("module_id", mod.id).order("position", { ascending: true });
          modsWithLessons.push({ ...mod, lessons: l || [] });
        }
        setCourse({ ...c, modules: modsWithLessons });
      } finally {
        setLoading(false);
      }
    };
    fetchAll();
  }, [slug]);

  // ... Lógica de progresso e inscrição ...
  useEffect(() => {
    const loadProgress = async () => {
      if (!user || !slug) return;
      const { data: enr } = await supabase.from("academy_enrollments").select("*").eq("user_id", user.id).eq("course_slug", slug);
      const { data: prog } = await supabase.from("academy_progress").select("*").eq("user_id", user.id).eq("course_slug", slug);
      const { data: cert } = await supabase.from("certificates").select("id").eq("user_id", user.id).eq("course_slug", slug).maybeSingle();
      
      const pMap: any = {};
      prog?.forEach(p => pMap[p.lesson_id] = p.status);
      setEnrollData({ enrolledSlugs: enr?.length ? [slug] : [], progress: { [slug]: pMap } });
      if (cert) setCertificateId(cert.id);
    };
    loadProgress();
  }, [user, slug]);

  const toggleComplete = async (lessonId: string, current: string) => {
    const newStatus = current === 'completed' ? 'in-progress' : 'completed';
    const { error } = await supabase.from("academy_progress").upsert({
      user_id: user?.id, course_slug: slug, lesson_id: lessonId, status: newStatus, updated_at: new Date().toISOString()
    }, { onConflict: 'user_id,lesson_id' });
    
    if (!error) {
      const next = { ...enrollData.progress[slug!] };
      next[lessonId] = newStatus;
      setEnrollData({ ...enrollData, progress: { [slug!]: next } });
    }
  };

  const total = useMemo(() => course?.modules?.reduce((acc: any, m: any) => acc + m.lessons.length, 0) || 0, [course]);
  const done = useMemo(() => Object.values(enrollData.progress[slug!] || {}).filter(s => s === 'completed').length, [enrollData, slug]);
  const progress = total > 0 ? Math.round((done / total) * 100) : 0;

  if (loading) return <Layout><div className="flex h-screen items-center justify-center"><Loader2 className="animate-spin" /></div></Layout>;

  return (
    <Layout>
      <div className="container mx-auto px-4 py-8 space-y-8">
        <div className="flex flex-col md:flex-row gap-8">
          <div className="w-full md:w-1/3">
            <AspectRatio ratio={4/3} className="rounded-2xl border overflow-hidden shadow-lg">
              <img src={course.hero_asset_url} className="object-cover w-full h-full" alt="" />
            </AspectRatio>
          </div>
          <div className="flex-1 space-y-4">
            <h1 className="text-3xl font-bold">{course.title}</h1>
            <div className="prose prose-sm max-w-none text-muted-foreground" dangerouslySetInnerHTML={{ __html: course.description }} />
            <div className="space-y-2">
              <div className="flex justify-between text-sm"><span>Progresso</span><span>{progress}%</span></div>
              <Progress value={progress} />
            </div>
            {certificateId && (
              <Button asChild className="bg-yellow-600 hover:bg-yellow-700 gap-2">
                <Link to={`/certificate/${certificateId}`} target="_blank"><Award size={18} /> Meu Certificado</Link>
              </Button>
            )}
          </div>
        </div>

        <div className="grid gap-6">
          {course.modules.map((m: any) => (
            <Card key={m.id}>
              <CardHeader><CardTitle className="text-lg">{m.title}</CardTitle></CardHeader>
              <CardContent className="space-y-4">
                {m.lessons.map((l: any) => {
                  const status = enrollData.progress[slug!]?.[l.id] || 'pending';
                  return (
                    <div key={l.id} className="border rounded-xl p-5 space-y-4">
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex gap-3">
                          <div className="mt-1">
                            {l.type === 'video' && <PlayCircle className="text-primary" />}
                            {l.type === 'text' && <FileText className="text-primary" />}
                            {l.type === 'pdf' && <FileSearch className="text-primary" />}
                            {l.type === 'link' && <ExternalLink className="text-primary" />}
                          </div>
                          <div>
                            <h4 className="font-semibold">{l.title}</h4>
                            <p className="text-xs text-muted-foreground uppercase">{l.type} • {l.duration_minutes} min</p>
                          </div>
                        </div>
                        <Button 
                          variant={status === 'completed' ? 'default' : 'outline'} 
                          size="sm" 
                          className={status === 'completed' ? 'bg-success hover:bg-success' : ''}
                          onClick={() => toggleComplete(l.id, status)}
                        >
                          {status === 'completed' ? <Check size={16} /> : 'Concluir'}
                        </Button>
                      </div>

                      {l.type === 'text' && l.content && (
                        <div className="bg-muted/30 rounded-lg p-6 prose prose-sm max-w-none" dangerouslySetInnerHTML={{ __html: l.content }} />
                      )}

                      {l.type === 'video' && l.resource_url && (
                        <AspectRatio ratio={16/9} className="bg-black rounded-lg overflow-hidden">
                          <iframe src={l.resource_url} className="w-full h-full" allowFullScreen />
                        </AspectRatio>
                      )}
                    </div>
                  );
                })}
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </Layout>
  );
};

export default CourseDetail;