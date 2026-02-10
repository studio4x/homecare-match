"use client";

import { useEffect, useMemo, useState } from "react";
import Layout from "@/components/layout/Layout";
import { supabase } from "@/integrations/supabase/client";
import { useParams, Link, useNavigate } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { 
  Loader2, 
  Check, 
  Award, 
  FileText, 
  PlayCircle, 
  FileSearch, 
  ExternalLink, 
  Lock, 
  ArrowLeft,
  GraduationCap
} from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/components/auth/AuthProvider";
import { AspectRatio } from "@/components/ui/aspect-ratio";
import { cn } from "@/lib/utils";

const PRIVATE_BUCKET = "academy-private";

const CourseDetail = () => {
  const { slug } = useParams();
  const { user, session } = useAuth();
  const navigate = useNavigate();
  
  const [course, setCourse] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [isEnrolled, setIsEnrolled] = useState(false);
  const [enrollmentLoading, setEnrollmentLoading] = useState(false);
  const [progress, setProgress] = useState<any>({});
  const [certificateId, setCertificateId] = useState<string | null>(null);
  const [signedUrls, setSignedUrls] = useState<Record<string, string>>({});

  const fetchCourseData = async () => {
    setLoading(true);
    try {
      const { data: c, error: cErr } = await supabase.from("academy_courses").select("*").eq("slug", slug).single();
      if (cErr) throw cErr;

      const { data: m } = await supabase.from("academy_modules").select("*").eq("course_slug", slug).order("position", { ascending: true });
      
      const modsWithLessons: any[] = [];
      const storagePathsToSign: string[] = [];

      for (const mod of m || []) {
        const { data: l } = await supabase.from("academy_lessons").select("*").eq("module_id", mod.id).order("position", { ascending: true });
        const lessons = l || [];
        
        lessons.forEach(lesson => {
          if (lesson.resource_url && !lesson.resource_url.startsWith('http')) {
            storagePathsToSign.push(lesson.resource_url);
          }
        });

        modsWithLessons.push({ ...mod, lessons });
      }
      setCourse({ ...c, modules: modsWithLessons });

      if (user) {
        const { data: enr } = await supabase.from("academy_enrollments").select("id").eq("user_id", user.id).eq("course_slug", slug).maybeSingle();
        setIsEnrolled(!!enr);

        if (enr) {
          // Gerar URLs assinadas se estiver matriculado
          if (storagePathsToSign.length > 0) {
            const { data: signedData, error: signErr } = await supabase.storage
              .from(PRIVATE_BUCKET)
              .createSignedUrls(storagePathsToSign, 3600);
            
            if (!signErr && signedData) {
              const urlMap: Record<string, string> = {};
              signedData.forEach((item, idx) => {
                if (item.signedUrl) urlMap[storagePathsToSign[idx]] = item.signedUrl;
              });
              setSignedUrls(urlMap);
            }
          }

          const { data: prog } = await supabase.from("academy_progress").select("*").eq("user_id", user.id).eq("course_slug", slug);
          const pMap: any = {};
          prog?.forEach(p => pMap[p.lesson_id] = p.status);
          setProgress(pMap);

          // Buscar certificado (usando query segura para evitar erro se tabela não existir)
          try {
            const { data: cert } = await supabase.from("certificates").select("id").eq("user_id", user.id).eq("course_slug", slug).maybeSingle();
            if (cert) setCertificateId(cert.id);
          } catch {
            console.warn("Tabela de certificados não encontrada ou inacessível.");
          }
        }
      }
    } catch (err) {
      console.error(err);
      toast.error("Curso não encontrado.");
      navigate("/cursos");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (slug) fetchCourseData();
  }, [slug, user]);

  const handleEnroll = async () => {
    if (!session) {
      toast.info("Faça login para se inscrever.");
      navigate("/login");
      return;
    }
    setEnrollmentLoading(true);
    try {
      const { error } = await supabase.from("academy_enrollments").insert({
        user_id: user?.id,
        course_slug: slug
      });
      if (error) throw error;
      setIsEnrolled(true);
      toast.success("Inscrição realizada! Bons estudos.");
      fetchCourseData(); // Recarrega para gerar URLs assinadas
    } catch (err) {
      toast.error("Erro ao realizar inscrição.");
    } finally {
      setEnrollmentLoading(false);
    }
  };

  const toggleComplete = async (lessonId: string, currentStatus: string) => {
    const newStatus = currentStatus === 'completed' ? 'in-progress' : 'completed';
    try {
      const { error } = await supabase.from("academy_progress").upsert({
        user_id: user?.id, 
        course_slug: slug, 
        lesson_id: lessonId, 
        status: newStatus, 
        updated_at: new Date().toISOString()
      }, { onConflict: 'user_id,lesson_id' });
      
      if (error) throw error;
      setProgress({ ...progress, [lessonId]: newStatus });
      
      // Se completou, verifica se terminou o curso (opcional: aqui poderia disparar a verificação de certificado)
    } catch (err) {
      toast.error("Erro ao salvar progresso.");
    }
  };

  const stats = useMemo(() => {
    const total = course?.modules?.reduce((acc: any, m: any) => acc + m.lessons.length, 0) || 0;
    const done = Object.values(progress).filter(s => s === 'completed').length;
    return { 
      total, 
      done, 
      pct: total > 0 ? Math.round((done / total) * 100) : 0 
    };
  }, [course, progress]);

  if (loading) return <Layout><div className="flex h-[60vh] items-center justify-center"><Loader2 className="animate-spin h-8 w-8 text-primary" /></div></Layout>;

  return (
    <Layout>
      <div className="container mx-auto px-4 py-8 max-w-5xl">
        <Button variant="ghost" asChild className="mb-6 gap-2">
          <Link to="/cursos"><ArrowLeft size={16} /> Voltar para Cursos</Link>
        </Button>

        <div className="grid gap-8 md:grid-cols-3">
          <div className="space-y-6">
            <Card className="overflow-hidden border-none shadow-lg">
              <AspectRatio ratio={16/9}>
                <img src={course.hero_asset_url || "/placeholder.svg"} className="object-cover w-full h-full" alt={course.title} />
              </AspectRatio>
              <CardContent className="pt-6">
                <div className="flex items-center justify-between mb-4">
                  <Badge variant="secondary" className="capitalize">{course.level}</Badge>
                  <span className="text-sm text-muted-foreground">{course.duration_minutes} min</span>
                </div>
                {!isEnrolled ? (
                  <Button onClick={handleEnroll} disabled={enrollmentLoading} className="w-full h-12 text-lg">
                    {enrollmentLoading ? <Loader2 className="animate-spin mr-2" /> : <GraduationCap className="mr-2" />}
                    Inscrever-se Grátis
                  </Button>
                ) : (
                  <div className="space-y-4">
                    <div className="space-y-2">
                      <div className="flex justify-between text-sm font-medium">
                        <span>Seu Progresso</span>
                        <span>{stats.pct}%</span>
                      </div>
                      <Progress value={stats.pct} className="h-2" />
                    </div>
                    {certificateId && (
                      <Button asChild className="w-full bg-yellow-600 hover:bg-yellow-700 gap-2">
                        <Link to={`/certificado/${certificateId}`} target="_blank"><Award size={18} /> Ver Certificado</Link>
                      </Button>
                    )}
                    <div className="bg-success/10 text-success text-xs p-3 rounded-lg flex items-center gap-2">
                      <Check size={14} /> Você está matriculado.
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          <div className="md:col-span-2 space-y-8">
            <div>
              <h1 className="text-4xl font-bold text-foreground mb-4">{course.title}</h1>
              <div 
                className="prose prose-slate max-w-none text-muted-foreground" 
                dangerouslySetInnerHTML={{ __html: course.description || "Sem descrição disponível." }} 
              />
            </div>

            <div className="space-y-4">
              <h2 className="text-2xl font-bold flex items-center gap-2">Conteúdo do Curso</h2>
              <div className="space-y-6">
                {course.modules?.map((m: any) => (
                  <Card key={m.id} className={cn(!isEnrolled && "opacity-80")}>
                    <CardHeader className="bg-muted/30 py-4">
                      <CardTitle className="text-lg">{m.title}</CardTitle>
                    </CardHeader>
                    <CardContent className="p-0">
                      <div className="divide-y">
                        {m.lessons?.map((l: any) => {
                          const status = progress[l.id] || 'pending';
                          const finalUrl = signedUrls[l.resource_url] || l.resource_url;
                          
                          return (
                            <div key={l.id} className="p-4 space-y-4">
                              <div className="flex items-center justify-between gap-4">
                                <div className="flex items-center gap-3">
                                  <div className="text-primary shrink-0">
                                    {l.type === 'video' ? <PlayCircle size={20} /> : l.type === 'pdf' ? <FileSearch size={20} /> : l.type === 'text' ? <FileText size={20} /> : <ExternalLink size={20} />}
                                  </div>
                                  <div>
                                    <h4 className="font-medium text-sm sm:text-base">{l.title}</h4>
                                    <p className="text-[10px] text-muted-foreground uppercase">{l.duration_minutes || 0} min</p>
                                  </div>
                                </div>
                                {isEnrolled ? (
                                  <Button 
                                    variant={status === 'completed' ? 'default' : 'outline'} 
                                    size="sm" 
                                    className={cn("h-8 px-3 text-xs", status === 'completed' && "bg-success hover:bg-success/90")}
                                    onClick={() => toggleComplete(l.id, status)}
                                  >
                                    {status === 'completed' ? <><Check size={14} className="mr-1" /> Concluído</> : 'Concluir'}
                                  </Button>
                                ) : <Lock size={16} className="text-muted-foreground/40" />}
                              </div>

                              {isEnrolled && (
                                <div className="animate-fade-in pl-8 border-l-2 border-primary/20 pt-2 pb-4">
                                  {l.type === 'text' && l.content && (
                                    <div className="prose prose-sm max-w-none bg-muted/20 p-6 rounded-xl" dangerouslySetInnerHTML={{ __html: l.content }} />
                                  )}
                                  {l.type === 'video' && finalUrl && (
                                    <AspectRatio ratio={16/9} className="bg-black rounded-xl overflow-hidden shadow-inner">
                                      <iframe 
                                        src={finalUrl} 
                                        className="w-full h-full" 
                                        allowFullScreen 
                                      />
                                    </AspectRatio>
                                  )}
                                  {(l.type === 'pdf' || l.type === 'link') && finalUrl && (
                                    <Button asChild variant="secondary" size="sm">
                                      <a href={finalUrl} target="_blank" rel="noopener noreferrer">
                                        <ExternalLink size={14} className="mr-2" /> {l.type === 'pdf' ? 'Abrir PDF' : 'Acessar Link'}
                                      </a>
                                    </Button>
                                  )}
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </Layout>
  );
};

export default CourseDetail;