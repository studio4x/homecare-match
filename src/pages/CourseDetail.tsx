"use client";

import { useEffect, useMemo, useState } from "react";
import Layout from "@/components/layout/Layout";
import { supabase } from "@/integrations/supabase/client";
import { useParams, Link, useNavigate, useSearchParams } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import SafeHTML from "@/components/SafeHTML";
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
  ShoppingCart,
  Zap,
  ShieldCheck,
  X
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
import { COURSE_LEVEL_LABELS } from "@/components/admin/CoursesTab";
import { getYouTubeEmbedUrl } from "@/lib/video-utils"; // Import the new utility
import LandingVideoPlayer from "@/components/LandingVideoPlayer"; // Import LandingVideoPlayer
import { createCheckoutSession } from "@/lib/checkout";
import { fixMojibake, fixNullableMojibake } from "@/lib/encoding";
import SubscriptionCouponModal from "@/components/SubscriptionCouponModal";
import CourseAIDisclaimer from "@/components/CourseAIDisclaimer";

const PRIVATE_BUCKET = "academy-private";

const normalizeCourseData = (course: any) => ({
  ...course,
  title: fixMojibake(course?.title),
  description: fixNullableMojibake(course?.description) || "",
  content_url: fixNullableMojibake(course?.content_url) || "",
});

const normalizeModuleData = (module: any) => ({
  ...module,
  title: fixMojibake(module?.title),
  description: fixNullableMojibake(module?.description) || "",
});

const normalizeLessonData = (lesson: any) => ({
  ...lesson,
  title: fixMojibake(lesson?.title),
  content: fixNullableMojibake(lesson?.content) || "",
  resource_url: fixNullableMojibake(lesson?.resource_url) || "",
});

const CourseDetail = () => {
  const { slug } = useParams();
  const { user, session } = useAuth();
  const navigate = useNavigate();
  const isMobile = useIsMobile();
  const [searchParams, setSearchParams] = useSearchParams();
  
  const [course, setCourse] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [isEnrolled, setIsEnrolled] = useState(false);
  const [enrollmentLoading, setEnrollmentLoading] = useState(false);
  const [progress, setProgress] = useState<Record<string, string>>({});
  const [certificateId, setCertificateId] = useState<string | null>(null);
  const [signedUrls, setSignedUrls] = useState<Record<string, string>>({});
  const [userProfile, setUserProfile] = useState<any>(null);
  const [selectedPlanForCheckout, setSelectedPlanForCheckout] = useState<"yearly" | "monthly" | null>(null);
  
  const [selectedLesson, setSelectedLesson] = useState<any>(null);
  const [videoEnded, setVideoEnded] = useState(false);
  const [isIssuingCertificate, setIsIssuingCertificate] = useState(false);
  const [videoPreviewUrl, setVideoPreviewUrl] = useState<string | null>(null);
  const [videoLoading, setVideoLoading] = useState(false);
  const [isVideoModalOpen, setIsVideoModalOpen] = useState(false);
  const [viewInside, setViewInside] = useState(false);
  const hasCheckoutSuccess = searchParams.get("success") === "true";

  const isAdmin = userProfile?.is_admin || userProfile?.role === 'admin';

  const fetchCourseData = async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      const { data: c, error: cErr } = await supabase.from("academy_courses").select("*").eq(slug ? "slug" : "", slug).single();
      if (cErr) throw cErr;
      const normalizedCourse = normalizeCourseData(c);

      const { data: m } = await supabase.from("academy_modules").select("*").eq("course_slug", slug).order("position", { ascending: true });
      
      const modsWithLessons: any[] = [];
      const storagePathsToSign: string[] = [];

      for (const mod of m || []) {
        const { data: l } = await supabase.from("academy_lessons").select("*").eq("module_id", mod.id).order("position", { ascending: true });
        const lessons = (l || []).map(normalizeLessonData);
        
        lessons.forEach(lesson => {
          if (lesson.resource_url && !lesson.resource_url.startsWith('http')) {
            storagePathsToSign.push(lesson.resource_url);
          }
        });

        modsWithLessons.push({ ...normalizeModuleData(mod), lessons });
      }
      setCourse({ ...normalizedCourse, modules: modsWithLessons });

      if (user) {
        const { data: prof } = await supabase.from("profiles").select("subscription_tier, is_admin, role").eq("id", user.id).single();
        setUserProfile(prof);

        const { data: enr } = await supabase.from("academy_enrollments").select("id").eq("user_id", user.id).eq("course_slug", slug).maybeSingle();
        setIsEnrolled(!!enr);

        if (enr || (prof?.is_admin || prof?.role === 'admin')) {
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
      if (!silent) {
        toast.error("Curso não encontrado.");
        navigate("/cursos");
      }
    } finally {
      if (!silent) setLoading(false);
    }
  };

  useEffect(() => {
    if (slug) fetchCourseData();
  }, [slug, user]);

  useEffect(() => {
    if (!hasCheckoutSuccess || !slug || !user?.id) return;

    const clearSuccessParam = () => {
      const nextParams = new URLSearchParams(searchParams);
      nextParams.delete("success");
      setSearchParams(nextParams, { replace: true });
    };

    if (isEnrolled) {
      clearSuccessParam();
      return;
    }

    toast.success("Pagamento confirmado! Estamos liberando seu curso...", {
      duration: 5000,
    });

    let active = true;

    const pollEnrollment = async () => {
      if (!active) return;
      await fetchCourseData(true);
    };

    void pollEnrollment();

    const interval = setInterval(() => {
      if (!active) return;
      void pollEnrollment();
    }, 2000);

    const timeout = setTimeout(() => {
      if (!active) return;
      clearInterval(interval);
      clearSuccessParam();

      if (!isEnrolled) {
        toast.message("Ainda estamos processando sua matricula. Tente novamente em alguns segundos.");
      }
    }, 45000);

    return () => {
      active = false;
      clearInterval(interval);
      clearTimeout(timeout);
    };
  }, [hasCheckoutSuccess, isEnrolled, searchParams, setSearchParams, slug, user?.id]);

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
    if (!loading && isEnrolled && stats.total > 0 && stats.done === stats.total && !certificateId && !isIssuingCertificate) {
      issueCertificate();
    }
  }, [loading, isEnrolled, stats.done, stats.total, certificateId]);

  const isYearlyPlan = userProfile?.subscription_tier === 'yearly' || isAdmin;

  const startPlanCheckout = async (planId: "yearly" | "monthly") => {
    setSelectedPlanForCheckout(null);
    setEnrollmentLoading(true);
    const toastId = toast.loading("Iniciando checkout...");
    try {
      const data = await createCheckoutSession({ planId });
      if (data?.url) {
        window.location.href = data.url;
        return;
      }

      throw new Error("URL de checkout não retornada pelo servidor.");
    } catch (err: any) {
      toast.error(err.message || "Erro ao iniciar pagamento.");
      toast.dismiss(toastId);
    } finally {
      setEnrollmentLoading(false);
    }
  };

  const handlePlanCheckout = (planId: "yearly" | "monthly") => {
    setSelectedPlanForCheckout(planId);
  };

  const handleEnroll = async () => {
    if (!session) {
      toast.info("Faça login para se inscrever.");
      navigate("/login");
      return;
    }

    const isFree = !course.price || course.price === 0;
    
    // Se for gratuito, exige plano anual (exceto para admin)
    if (isFree && !isYearlyPlan && !isAdmin) {
      toast.error("Acesso restrito!", {
        description: "Cursos gratuitos são exclusivos para assinantes do Plano Anual."
      });
      handlePlanCheckout("yearly");
      return;
    }

    if (course.price && course.price > 0 && !isAdmin) {
      await handleCoursePayment();
      return;
    }

    // Se for gratuito ou admin, inscreve direto
    try {
      setEnrollmentLoading(true);
      const { error } = await supabase.from("academy_enrollments").upsert({ user_id: user?.id, course_slug: slug }, { onConflict: "user_id,course_slug" });
      if (error) throw error;
      setIsEnrolled(true);
      toast.success("Inscrição realizada! Bons estudos.");
      fetchCourseData();
    } catch (e) {
      console.error("[Courses] Enroll error:", e);
      toast.error("Falha ao inscrever.");
    } finally {
      setEnrollmentLoading(false);
    }
  };

  const handleCoursePayment = async () => {
    if (!slug) return;
    setEnrollmentLoading(true);
    const toastId = toast.loading("Iniciando checkout...");
    try {
      const data = await createCheckoutSession({ courseSlug: slug });
      if (data?.url) {
        window.location.href = data.url;
        return;
      }

      throw new Error("URL de checkout não retornada pelo servidor.");
    } catch (err: any) {
      toast.error(err.message || "Erro ao iniciar pagamento.");
      toast.dismiss(toastId);
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
      
      if (error) {
        let msg = "Erro ao gerar selo.";
        try {
          const body = await error.context?.json();
          if (body?.error) msg = body.error;
        } catch {}
        throw new Error(msg);
      }
      
      if (data?.certificate_id) {
        setCertificateId(data.certificate_id);
        toast.success("Parabéns! Seu selo de conclusão foi gerado.", {
          description: "Você já pode visualizá-lo na barra lateral.",
          icon: <Award className="text-yellow-600" />
        });
      }
    } catch (err: any) {
      console.error("[CourseDetail] Erro ao emitir selo:", err.message);
      if (!err.message.includes("not completed yet")) {
        toast.error("Não foi possível gerar seu selo automaticamente. Tente atualizar a página.");
      }
    } finally {
      setIsIssuingCertificate(false);
    }
  };

  const handleOpenLesson = (lesson: any) => {
    if (!isEnrolled && !isAdmin) return;
    
    const isFree = !course.price || course.price === 0;
    if (isFree && !isYearlyPlan && !isAdmin) {
      toast.error("Acesso restrito!", {
        description: "Sua assinatura atual não permite o acesso a este conteúdo gratuito."
      });
      handlePlanCheckout("yearly");
      return;
    }

    setSelectedLesson(normalizeLessonData(lesson));
    setVideoEnded(false);
    setViewInside(false);
  };

  let videoToShow = videoPreviewUrl;
  // Apply YouTube embed conversion if it's a YouTube URL
  if (videoToShow && (videoToShow.includes("youtube.com") || videoToShow.includes("youtu.be"))) {
    videoToShow = getYouTubeEmbedUrl(videoToShow);
  }
  const isEmbeddedVideo = !!videoToShow && (videoToShow.includes("youtube.com/embed") || videoToShow.includes("vimeo.com/video"));

  if (loading) return <Layout><div className="flex h-[60vh] items-center justify-center"><Loader2 className="animate-spin h-8 w-8 text-primary" /></div></Layout>;

  return (
    <Layout>
      <div className="container mx-auto px-4 py-8 max-w-5xl">
        <Button variant="ghost" asChild className="mb-6 gap-2">
          <Link to="/cursos"><ArrowLeft size={16} /> Voltar para Cursos</Link>
        </Button>

        <CourseAIDisclaimer className="mb-6" />

        <div className="grid gap-8 md:grid-cols-3">
          <div className="space-y-6">
            <Card className="overflow-hidden border-none shadow-lg">
              <AspectRatio ratio={4/3}>
                <img src={course.hero_asset_url || "/placeholder.svg"} className="object-cover w-full h-full" alt={course.title} />
              </AspectRatio>

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
                  <Badge variant="secondary" className="capitalize">
                    {course.level ? COURSE_LEVEL_LABELS[course.level] || course.level : "Iniciante"}
                  </Badge>
                  <span className="text-sm text-muted-foreground">{course.duration_minutes} min</span>
                </div>
                
                {!isEnrolled && !isAdmin ? (
                  <div className="space-y-4">
                    {course.price && course.price > 0 ? (
                      <div className="text-center p-3 bg-secondary/20 rounded-lg border border-dashed">
                        <p className="text-xs text-muted-foreground uppercase font-bold tracking-wider">Investimento</p>
                        <p className="text-2xl font-bold text-destructive">R$ {Number(course.price).toFixed(2).replace('.', ',')}</p>
                      </div>
                    ) : (
                      <div className="bg-amber-50 border border-amber-200 p-3 rounded-lg flex items-start gap-3">
                        <Lock className="h-4 w-4 text-amber-600 shrink-0 mt-0.5" />
                        <p className="text-[10px] text-amber-800 leading-relaxed">
                          Este curso é <strong>gratuito</strong>, mas o acesso é exclusivo para assinantes do <strong>Plano Anual</strong>.
                        </p>
                      </div>
                    )}
                    
                    <Button onClick={handleEnroll} disabled={enrollmentLoading} className="w-full h-12 text-lg gap-2">
                      {enrollmentLoading ? (
                        <Loader2 className="animate-spin h-5 w-5" />
                      ) : course.price && course.price > 0 ? (
                        <><ShoppingCart className="h-5 w-5" /> Comprar Curso</>
                      ) : !isYearlyPlan ? (
                        <><Zap className="h-5 w-5 fill-current" /> Assinar Plano Anual</>
                      ) : (
                        <><GraduationCap className="h-5 w-5" /> Inscrever-se Grátis</>
                      )}
                    </Button>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {isAdmin && !isEnrolled && (
                      <div className="bg-primary/10 border border-primary/20 p-3 rounded-lg flex items-center gap-2 text-[10px] text-primary font-bold uppercase">
                        <ShieldCheck className="h-4 w-4" />
                        Acesso Administrativo Liberado
                      </div>
                    )}
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

            {/* Quadro Informativo do Selo */}
            <div className="rounded-2xl border border-primary/10 bg-primary/5 p-4 flex items-center gap-3 animate-fade-in">
              <div className="h-10 w-10 rounded-full bg-white shadow-sm flex items-center justify-center shrink-0">
                <Award className="h-6 w-6 text-primary" />
              </div>
              <div className="space-y-0.5">
                <p className="text-sm font-bold text-foreground">Selo de Conclusão</p>
                <p className="text-[10px] text-muted-foreground leading-tight">
                  Este curso oferece emissão de selo digital exclusivo para o seu perfil após a conclusão de 100% das aulas.
                </p>
              </div>
            </div>
          </div>

          <div className="md:col-span-2 space-y-8">
            <div>
              <h1 className="text-2xl sm:text-3xl md:text-4xl font-bold text-foreground mb-4 break-words">{course.title}</h1>
              <SafeHTML content={course.description || "Sem descrição disponível."} />
            </div>

            {course.content_url && (isEnrolled || isAdmin) && (
              <Card className="border-primary/20 bg-primary/5">
                <CardContent className="p-6 flex flex-col items-center text-center space-y-4">
                  <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center">
                    <ExternalLink className="h-6 w-6 text-primary" />
                  </div>
                  <div className="space-y-1">
                    <h3 className="font-bold">Plataforma de Ensino Externa</h3>
                    <p className="text-sm text-muted-foreground">Este curso é realizado em uma plataforma parceira.</p>
                  </div>
                  <div className="flex flex-col sm:flex-row gap-3 w-full max-w-md">
                    <Button 
                      className="flex-1 gap-2" 
                      onClick={() => {
                        setSelectedLesson({
                          id: 'external-course',
                          title: course.title,
                          type: 'link',
                          resource_url: course.content_url,
                          duration_minutes: course.duration_minutes
                        });
                        setViewInside(true);
                      }}
                    >
                      <Eye size={16} /> Acessar Agora (Visualizar Aqui)
                    </Button>
                    <Button asChild variant="outline" className="flex-1 gap-2">
                      <a href={course.content_url} target="_blank" rel="noopener noreferrer">
                        Abrir em Nova Aba <ExternalLink size={16} />
                      </a>
                    </Button>
                  </div>
                </CardContent>
              </Card>
            )}

            <div className="space-y-4">
              <h2 className="text-2xl font-bold flex items-center gap-2">Conteúdo do Curso</h2>
              <div className="space-y-6">
                {course.modules?.map((m: any) => (
                  <Card key={m.id} className={cn(!isEnrolled && !isAdmin && "opacity-80")}>
                    <CardHeader className="bg-muted/30 py-4">
                      <CardTitle className="text-lg">{m.title}</CardTitle>
                    </CardHeader>
                    <CardContent className="p-0">
                      <div className="divide-y">
                        {m.lessons?.map((l: any) => {
                          const status = progress[l.id] || 'pending';
                          const isFree = !course.price || course.price === 0;
                          const isLocked = isFree && !isYearlyPlan && !isEnrolled && !isAdmin;
                          
                          // Determine the URL for the lesson video/resource
                          let lessonResourceUrl = l.resource_url;
                          if (l.type === 'video' && l.resource_url && !l.resource_url.startsWith('http')) {
                            lessonResourceUrl = signedUrls[l.resource_url]; // Use signed URL for storage videos
                          } else if (l.type === 'video' && l.resource_url && (l.resource_url.includes("youtube.com") || l.resource_url.includes("youtu.be"))) {
                            lessonResourceUrl = getYouTubeEmbedUrl(l.resource_url); // Convert YouTube to embed
                          }

                          return (
                            <div
                              key={l.id}
                              className={cn(
                                "p-3 sm:p-4 flex items-center justify-between gap-2 sm:gap-4 transition-colors",
                                (isEnrolled || isAdmin) && !isLocked ? "hover:bg-secondary/30 cursor-pointer" : "cursor-not-allowed"
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
                                {(isEnrolled || isAdmin) && !isLocked ? (
                                  <>
                                    <Button
                                      variant="outline"
                                      size="sm"
                                      className="h-7 sm:h-8 px-2 sm:px-3 text-[10px] sm:text-xs gap-1 sm:gap-1.5"
                                    >
                                      <Eye size={12} className="sm:w-3.5 sm:h-3.5" /> <span className="hidden xs:inline">Acessar</span>
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
                autoPlay={false} // Desativar autoplay
              />
            )}
          </AspectRatio>
        </DialogContent>
      </Dialog>

      <Dialog open={!!selectedLesson} onOpenChange={(open) => !open && setSelectedLesson(null)}>
        <DialogContent className={cn(
          "w-[95vw] h-[92dvh] sm:h-auto sm:max-h-[95vh] flex flex-col p-0 overflow-hidden transition-all duration-300",
          viewInside ? "max-w-[98vw] h-[96dvh]" : "max-w-5xl"
        )}>
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

              <div className="flex-1 overflow-y-auto p-4 sm:p-6 bg-secondary/5 flex flex-col">
                {(selectedLesson.type === 'text' || selectedLesson.type === 'html') && selectedLesson.content && (
                  <div className="max-w-none bg-card p-4 sm:p-8 rounded-xl sm:rounded-2xl shadow-sm border break-words overflow-x-hidden">
                    <SafeHTML content={selectedLesson.content} />
                  </div>
                )}

                {selectedLesson.type === 'video' && (
                  <div className="space-y-4">
                    <AspectRatio ratio={16/9} className="bg-black rounded-xl overflow-hidden shadow-2xl">
                      {selectedLesson.resource_url?.includes('.mp4') || selectedLesson.mime_type?.startsWith('video/') ? (
                        <LandingVideoPlayer // Use LandingVideoPlayer for lesson videos
                          url={signedUrls[selectedLesson.resource_url] || selectedLesson.resource_url} 
                          title={selectedLesson.title}
                          autoplay={false} // Desativar autoplay
                        />
                      ) : (
                        <iframe 
                          src={getYouTubeEmbedUrl(signedUrls[selectedLesson.resource_url] || selectedLesson.resource_url)} 
                          className="w-full h-full" 
                          allowFullScreen 
                          onLoad={() => setVideoEnded(true)}
                          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
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
                  <div className="flex-1 flex flex-col items-center justify-center py-4 text-center space-y-6">
                    {viewInside ? (
                      <div className="w-full flex-1 min-h-[75vh] border rounded-xl overflow-hidden bg-white relative shadow-inner">
                        <iframe 
                          src={signedUrls[selectedLesson.resource_url] || selectedLesson.resource_url} 
                          className="w-full h-full absolute inset-0"
                          title={selectedLesson.title}
                          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                          allowFullScreen
                        />
                        <div className="absolute top-2 right-2 flex gap-2">
                          <Button 
                            variant="secondary" 
                            size="sm" 
                            className="h-8 text-[10px] gap-1 shadow-md bg-white/90 backdrop-blur hover:bg-white"
                            onClick={() => setViewInside(false)}
                          >
                            <X className="h-3 w-3" /> Sair do Modo Visualização
                          </Button>
                          <Button 
                            variant="secondary" 
                            size="sm" 
                            className="h-8 text-[10px] gap-1 shadow-md bg-white/90 backdrop-blur hover:bg-white"
                            asChild
                          >
                            <a href={signedUrls[selectedLesson.resource_url] || selectedLesson.resource_url} target="_blank" rel="noopener noreferrer">
                              <ExternalLink className="h-3 w-3" /> Abrir em Nova Aba
                            </a>
                          </Button>
                        </div>
                      </div>
                    ) : (
                      <div className="py-12">
                        <div className="h-20 w-20 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-6">
                          {selectedLesson.type === 'pdf' ? <FileSearch className="h-10 w-10 text-primary" /> : <ExternalLink className="h-10 w-10 text-primary" />}
                        </div>
                        <div className="space-y-2 mb-8">
                          <h3 className="text-lg font-semibold">Conteúdo Externo</h3>
                          <p className="text-sm text-muted-foreground max-w-xs mx-auto">
                            Este conteúdo está hospedado em uma plataforma externa ou arquivo dedicado.
                          </p>
                        </div>
                        <div className="flex flex-col sm:flex-row gap-3 justify-center">
                          <Button 
                            onClick={() => setViewInside(true)} 
                            size="lg" 
                            className="gap-2 px-8"
                          >
                            <Eye size={16} /> Visualizar Aqui
                          </Button>
                          <Button asChild variant="outline" size="lg" className="gap-2 px-8">
                            <a href={signedUrls[selectedLesson.resource_url] || selectedLesson.resource_url} target="_blank" rel="noopener noreferrer">
                              {selectedLesson.type === 'pdf' ? 'Abrir PDF em nova aba' : 'Abrir em nova aba'}
                              <ExternalLink size={16} />
                            </a>
                          </Button>
                        </div>
                        <p className="text-[10px] text-muted-foreground max-w-xs mx-auto mt-6 italic">
                          Nota: Algumas plataformas podem bloquear a visualização interna por segurança. Caso não carregue, use o botão "Abrir em nova aba".
                        </p>
                      </div>
                    )}
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

      <SubscriptionCouponModal
        open={selectedPlanForCheckout !== null}
        onOpenChange={(open) => {
          if (!open) setSelectedPlanForCheckout(null);
        }}
        planId={selectedPlanForCheckout}
        onProceedToCheckout={startPlanCheckout}
      />
    </Layout>
  );
};

export default CourseDetail;

