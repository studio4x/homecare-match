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
  GraduationCap,
  ChevronRight,
  Eye,
  Maximize2,
  ShoppingCart
} from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/components/auth/AuthProvider";
import { AspectRatio } from "@/components/ui/aspect-ratio";
import { cn } from "@/lib/utils";
import { useIsMobile } from "@/hooks/use-mobile";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

const PRIVATE_BUCKET = "academy-private";

const CourseDetail = () => {
  const { slug } = useParams();
  const { user, session } = useAuth();
  const navigate = useNavigate();
  const isMobile = useIsMobile();
  
  const [course, setCourse] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [isEnrolled, setIsEnrolled] = useState(false);
  const [enrollmentLoading, setEnrollmentLoading] = useState(false);
  const [progress, setProgress] = useState<Record<string, string>>({});
  const [certificateId, setCertificateId] = useState<string | null>(null);
  const [signedUrls, setSignedUrls] = useState<Record<string, string>>({});
  
  const [selectedLesson, setSelectedLesson] = useState<any>(null);
  const [videoEnded, setVideoEnded] = useState(false);
  const [isIssuingCertificate, setIsIssuingCertificate] = useState(false);
  const [videoPreviewUrl, setVideoPreviewUrl] = useState<string | null>(null);
  const [videoLoading, setVideoLoading] = useState(false);
  const [isVideoModalOpen, setIsVideoModalOpen] = useState(false);

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
          const pMap: Record<string, string> = {};
          prog?.forEach(p => pMap[p.lesson_id] = p.status);
          setProgress(pMap);

          try {
            const { data: cert } = await supabase.from("certificates").select("id").eq("user_id", user.id).eq("course_slug", slug).maybeSingle();
            if (cert) setCertificateId(cert.id);
          } catch {
            console.warn("Tabela de certificados não encontrada.");
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

  useEffect(() => {
    if (!course) {
      setVideoPreviewUrl(null);
      return;
    }

    const sourcePath = course.video_storage_path;
    if (sourcePath) {
      setVideoLoading(true);
      supabase.storage
        .from(PRIVATE_BUCKET)
        .createSignedUrl(sourcePath, 3600)
        .then(({ data, error }) => {
          if (!error && data?.signedUrl) {
            setVideoPreviewUrl(data.signedUrl);
          } else {
            setVideoPreviewUrl(course.video_url || null);
          }
        })
        .finally(() => setVideoLoading(false));
      return;
    }

    if (course.video_source === "url" && course.video_url) {
      setVideoPreviewUrl(course.video_url);
    } else {
      setVideoPreviewUrl(null);
    }
  }, [course]);

  const stats = useMemo(() => {
    const total = course?.modules?.reduce((acc: number, m: any) => acc + m.lessons.length, 0) || 0;
    const done = Object.values(progress).filter(s => s === 'completed').length;
    return { 
      total, 
      done, 
      pct: total > 0 ? Math.round((done / total) * 100) : 0 
    };
  }, [course, progress]);

  useEffect(() => {
    if (!loading && isEnrolled && stats.pct === 100 && !certificateId && !isIssuingCertificate) {
      issueCertificate();
    }
  }, [loading, isEnrolled, stats.pct, certificateId]);

  const handleEnroll = async () => {
    if (!session) {
      toast.info("Faça login para se inscrever.");
      navigate("/login");
      return;
    }

    setEnrollmentLoading(true);

    // Se o curso for pago, redireciona para o checkout
    if (course.price && course.price > 0) {
      const toastId = toast.loading("Iniciando checkout...");
      try {
        const { data, error } = await supabase.functions.invoke('create-checkout-session', {
          body: { courseSlug: slug }
        });

        if (error) throw error;
        if (data?.url) {
          window.location.href = data.url;
          return;
        }
      } catch (err: any) {
        toast.error(err.message || "Erro ao iniciar pagamento.");
        toast.dismiss(toastId);
      } finally {
        setEnrollmentLoading(false);
      }
      return;
    }

    // Se for grátis, inscreve direto
    try {
      const { error } = await supabase.from("academy_enrollments").insert({
        user_id: user?.id,
        course_slug: slug
      });
      if (error) throw error;
      setIsEnrolled(true);
      toast.success("Inscrição realizada! Bons estudos.");
      fetchCourseData();
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
      
      const newProgress = { ...progress, [lessonId]: newStatus };
      setProgress(newProgress);
      
      if (newStatus === 'completed') {
        toast.success("Aula concluída!");
      }
    } catch (err) {
      console.error("[CourseDetail] Erro ao salvar progresso:", err);
      toast.error("Erro ao salvar progresso.");
    }
  };

  const issueCertificate = async () => {
    setIsIssuingCertificate(true);
    try {
      const { data, error } = await supabase.functions.invoke('issue-certificate', {
        body: { course_slug: slug }
      });
      
      if (error) throw error;
      
      if (data?.certificate_id) {
        setCertificateId(data.certificate_id);
        toast.success("Parabéns! Seu selo de conclusão foi gerado.", {
          description: "Você já pode visualizá-lo na barra lateral.",
          icon: <Award className="text-yellow-600" />
        });
      }
    } catch (err) {
      console.error("[CourseDetail] Erro ao emitir selo:", err);
    } finally {
      setIsIssuingCertificate(false);
    }
  };

  const handleOpenLesson = (lesson: any) => {
    if (!isEnrolled) return;
    setSelectedLesson(lesson);
    setVideoEnded(false);
  };

  const videoToShow = videoPreviewUrl;
  const isEmbeddedVideo = !!videoToShow && (videoToShow.includes("youtube.com") || videoToShow.includes("youtu.be"));

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
              <AspectRatio ratio={4/3}>
                <img src={course.hero_asset_url || "/placeholder.svg"} className="object-cover w-full h-full" alt={course.title} />
              </AspectRatio>

              {/* Vídeo de Apresentação abaixo da capa */}
              {videoToShow && (
                <div className="p-4 border-t bg-secondary/5">
                  <div className="relative group cursor-pointer" onClick={() => setIsVideoModalOpen(true)}>
                    <AspectRatio ratio={16/9} className="overflow-hidden rounded-lg border bg-black">
                      {isEmbeddedVideo ? (
                        <div className="w-full h-full flex items-center justify-center bg-slate-900">
                          <PlayCircle className="h-12 w-12 text-white/50 group-hover:text-white/80 transition-colors" />
                        </div>
                      ) : (
                        <video src={videoToShow} className="w-full h-full object-cover opacity-60" />
                      )}
                      <div className="absolute inset-0 flex items-center justify-center">
                        <div className="bg-primary/90 text-white p-2 rounded-full shadow-xl group-hover:scale-110 transition-transform">
                          <PlayCircle className="h-8 w-8" />
                        </div>
                      </div>
                    </AspectRatio>
                  </div>
                  <Button 
                    variant="outline" 
                    size="sm" 
                    className="w-full mt-3 gap-2 h-9" 
                    onClick={() => setIsVideoModalOpen(true)}
                  >
                    <Maximize2 className="h-4 w-4" /> Expandir Vídeo
                  </Button>
                </div>
              )}

              <CardContent className="pt-6">
                <div className="flex items-center justify-between mb-4">
                  <Badge variant="secondary" className="capitalize">{course.level}</Badge>
                  <span className="text-sm text-muted-foreground">{course.duration_minutes} min</span>
                </div>
                
                {!isEnrolled ? (
                  <div className="space-y-4">
                    {course.price && course.price > 0 ? (
                      <div className="text-center p-3 bg-secondary/20 rounded-lg border border-dashed">
                        <p className="text-xs text-muted-foreground uppercase font-bold tracking-wider">Investimento</p>
                        <p className="text-2xl font-bold text-foreground">R$ {Number(course.price).toFixed(2).replace('.', ',')}</p>
                      </div>
                    ) : null}
                    
                    <Button onClick={handleEnroll} disabled={enrollmentLoading} className="w-full h-12 text-lg gap-2">
                      {enrollmentLoading ? (
                        <Loader2 className="animate-spin h-5 w-5" />
                      ) : course.price && course.price > 0 ? (
                        <><ShoppingCart className="h-5 w-5" /> Comprar Curso</>
                      ) : (
                        <><GraduationCap className="h-5 w-5" /> Inscrever-se Grátis</>
                      )}
                    </Button>
                  </div>
                ) : (
                  <div className="space-y-4">
                    <div className="space-y-2">
                      <div className="flex justify-between text-sm font-medium">
                        <span>Seu Progresso</span>
                        <span>{stats.pct}%</span>
                      </div>
                      <Progress value={stats.pct} className="h-2" />
                    </div>
                    
                    {isIssuingCertificate ? (
                      <div className="flex items-center justify-center p-3 bg-yellow-50 rounded-lg border border-yellow-200 text-yellow-700 text-xs gap-2">
                        <Loader2 className="h-4 w-4 animate-spin" /> Gerando selo...
                      </div>
                    ) : certificateId ? (
                      <Button asChild className="w-full bg-yellow-600 hover:bg-yellow-700 gap-2 shadow-lg animate-scale-in">
                        <Link to={`/certificado/${certificateId}`} target="_blank"><Award size={18} /> Ver Selo de Conclusão</Link>
                      </Button>
                    ) : null}

                    <div className="bg-success/10 text-success text-xs p-3 rounded-lg flex items-center gap-2">
                      <Check size={14} /> 
                      {stats.pct === 100 ? "Você concluiu este curso!" : "Você está matriculado."}
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          <div className="md:col-span-2 space-y-8">
            <div>
              <h1 className="text-2xl sm:text-3xl md:text-4xl font-bold text-foreground mb-4 break-words">{course.title}</h1>
              <div
                className="prose prose-slate max-w-none text-muted-foreground break-words"
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
                          
                          return (
                            <div
                              key={l.id}
                              className={cn(
                                "p-3 sm:p-4 flex items-center justify-between gap-2 sm:gap-4 transition-colors",
                                isEnrolled ? "hover:bg-secondary/30 cursor-pointer" : "cursor-not-allowed"
                              )}
                              onClick={() => handleOpenLesson(l)}
                            >
                              <div className="flex items-center gap-2 sm:gap-3 min-w-0 flex-1">
                                <div className="text-primary shrink-0">
                                  {l.type === 'video' ? <PlayCircle size={18} className="sm:w-5 sm:h-5" /> : l.type === 'pdf' ? <FileSearch size={18} className="sm:w-5 sm:h-5" /> : l.type === 'text' ? <FileText size={18} className="sm:w-5 sm:h-5" /> : <ExternalLink size={18} className="sm:w-5 sm:h-5" />}
                                </div>
                                <div className="min-w-0 flex-1">
                                  <h4 className="font-medium text-xs sm:text-base line-clamp-2">{l.title}</h4>
                                  <div className="flex items-center gap-2 mt-0.5">
                                    <p className="text-[9px] sm:text-[10px] text-muted-foreground uppercase">{l.duration_minutes || 0} min</p>
                                    {status === 'completed' && <Badge variant="secondary" className="h-3 sm:h-4 text-[7px] sm:text-[8px] bg-success/10 text-success border-none px-1 sm:px-2">Concluída</Badge>}
                                  </div>
                                </div>
                              </div>
                              
                              <div className="flex items-center gap-2 sm:gap-3 shrink-0">
                                {isEnrolled ? (
                                  <>
                                    <Button
                                      variant="outline"
                                      size="sm"
                                      className="h-7 sm:h-8 px-2 sm:px-3 text-[10px] sm:text-xs gap-1 sm:gap-1.5"
                                    >
                                      <Eye size={12} className="sm:w-3.5 sm:h-3.5" /> <span className="hidden xs:inline sm:inline">Acessar</span>
                                    </Button>
                                    <ChevronRight size={14} className="text-muted-foreground/50 sm:w-4 sm:h-4" />
                                  </>
                                ) : (
                                  <Lock size={14} className="text-muted-foreground/40 sm:w-4 sm:h-4" />
                                )}
                              </div>
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

      {/* Modal para o Vídeo de Apresentação */}
      <Dialog open={isVideoModalOpen} onOpenChange={setIsVideoModalOpen}>
        <DialogContent className="max-w-4xl p-0 overflow-hidden bg-black border-none">
          <DialogHeader className="sr-only">
            <DialogTitle>Vídeo de Apresentação</DialogTitle>
          </DialogHeader>
          <AspectRatio ratio={16/9}>
            {isEmbeddedVideo ? (
              <iframe
                src={videoToShow!}
                title="Vídeo de apresentação"
                className="h-full w-full"
                allowFullScreen
              />
            ) : (
              <video
                src={videoToShow!}
                className="h-full w-full object-contain"
                controls
                autoPlay
              />
            )}
          </AspectRatio>
        </DialogContent>
      </Dialog>

      <Dialog open={!!selectedLesson} onOpenChange={(open) => !open && setSelectedLesson(null)}>
        <DialogContent className="w-[95vw] max-w-5xl h-[92dvh] sm:h-auto sm:max-h-[95vh] flex flex-col p-0 overflow-hidden">
          {selectedLesson && (
            <>
              <DialogHeader className="p-4 sm:p-6 border-b bg-card shrink-0">
                <div className="flex items-center justify-between gap-4">
                  <DialogTitle className="text-lg sm:text-xl font-bold line-clamp-2">{selectedLesson.title}</DialogTitle>
                  <Badge variant="outline" className="uppercase text-[9px] sm:text-[10px] shrink-0">
                    {selectedLesson.duration_minutes} min
                  </Badge>
                </div>
              </DialogHeader>

              <div className="flex-1 overflow-y-auto p-4 sm:p-6 bg-secondary/5">
                {(selectedLesson.type === 'text' || selectedLesson.type === 'html') && selectedLesson.content && (
                  <div 
                    className={cn(
                      "max-w-none bg-card p-4 sm:p-8 rounded-xl sm:rounded-2xl shadow-sm border break-words overflow-x-hidden",
                      selectedLesson.type === 'text' && "prose prose-slate",
                      selectedLesson.type === 'html' && "p-0 min-h-[70vh] flex flex-col [&>iframe]:flex-1 [&>iframe]:w-full [&>iframe]:min-h-[70vh]"
                    )} 
                    dangerouslySetInnerHTML={{ __html: selectedLesson.content }} 
                  />
                )}

                {selectedLesson.type === 'video' && (
                  <div className="space-y-4">
                    <AspectRatio ratio={16/9} className="bg-black rounded-xl overflow-hidden shadow-2xl">
                      {selectedLesson.resource_url?.includes('.mp4') || selectedLesson.mime_type?.startsWith('video/') ? (
                        <video 
                          src={signedUrls[selectedLesson.resource_url] || selectedLesson.resource_url} 
                          className="w-full h-full" 
                          controls 
                          onEnded={() => setVideoEnded(true)}
                        />
                      ) : (
                        <iframe 
                          src={signedUrls[selectedLesson.resource_url] || selectedLesson.resource_url} 
                          className="w-full h-full" 
                          allowFullScreen 
                          onLoad={() => setVideoEnded(true)}
                        />
                      )}
                    </AspectRatio>
                    {!videoEnded && selectedLesson.type === 'video' && (
                      <p className="text-xs text-center text-amber-600 font-medium animate-pulse">
                        Assista ao vídeo completo para habilitar a conclusão.
                      </p>
                    )}
                  </div>
                )}

                {(selectedLesson.type === 'pdf' || selectedLesson.type === 'link') && (
                  <div className="flex flex-col items-center justify-center py-12 text-center space-y-6">
                    <div className="h-20 w-20 rounded-full bg-primary/10 flex items-center justify-center">
                      {selectedLesson.type === 'pdf' ? <FileSearch className="h-10 w-10 text-primary" /> : <ExternalLink className="h-10 w-10 text-primary" />}
                    </div>
                    <div className="space-y-2">
                      <h3 className="text-lg font-semibold">Material Complementar</h3>
                      <p className="text-sm text-muted-foreground max-w-xs">
                        Este conteúdo está disponível em um arquivo externo ou link dedicado.
                      </p>
                    </div>
                    <Button asChild size="lg" className="gap-2">
                      <a href={signedUrls[selectedLesson.resource_url] || selectedLesson.resource_url} target="_blank" rel="noopener noreferrer">
                        {selectedLesson.type === 'pdf' ? 'Abrir PDF em nova aba' : 'Acessar Link Externo'}
                        <ExternalLink size={16} />
                      </a>
                    </Button>
                  </div>
                )}
              </div>

              <div className="p-4 sm:p-4 border-t bg-card flex justify-between items-center gap-2 shrink-0 pb-6 sm:pb-4">
                <Button variant="ghost" size="sm" onClick={() => setSelectedLesson(null)} className="text-xs sm:text-sm">Fechar</Button>
                <Button
                  size="sm"
                  className={cn(
                    "gap-1.5 sm:gap-2 text-xs sm:text-sm",
                    progress[selectedLesson.id] === 'completed' ? "bg-success hover:bg-success/90" : "bg-primary"
                  )}
                  disabled={selectedLesson.type === 'video' && !videoEnded && progress[selectedLesson.id] !== 'completed'}
                  onClick={() => {
                    toggleComplete(selectedLesson.id, progress[selectedLesson.id] || 'pending');
                  }}
                >
                  {progress[selectedLesson.id] === 'completed' ? (
                    <><Check size={14} className="sm:w-4 sm:h-4" /> <span className="hidden xs:inline">Aula Concluída</span><span className="xs:hidden">Concluída</span></>
                  ) : (
                    <><span className="hidden xs:inline">Marcar como Concluída</span><span className="xs:hidden">Concluir</span></>
                  )}
                </Button>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </Layout>
  );
};

export default CourseDetail;