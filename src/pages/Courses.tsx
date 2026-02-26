"use client";

import { useEffect, useState, useMemo } from "react";
import Layout from "@/components/layout/Layout";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { 
  Loader2, 
  LayoutDashboard, 
  Filter, 
  X, 
  Search,
  BookOpen,
  Lock,
  Zap,
  ShoppingCart,
  ShieldCheck
} from "lucide-react";
import { Link } from "react-router-dom";
import { toast } from "sonner";
import { useAuth } from "@/components/auth/AuthProvider";
import AccessRestricted from "@/components/AccessRestricted";
import { AspectRatio } from "@/components/ui/aspect-ratio";
import { cn } from "@/lib/utils";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import PlanSelectionModal from "@/components/PlanSelectionModal";
import { COURSE_LEVEL_LABELS } from "@/components/admin/CoursesTab";
import { createCheckoutSession } from "@/lib/checkout";
import CoursePaymentMethodDialog from "@/components/CoursePaymentMethodDialog";
import { fixMojibake, fixNullableMojibake } from "@/lib/encoding";

type CourseLevel = "iniciante" | "basico" | "intermediario" | "avancado";

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
  course_slug: string;
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
  price?: number;
  modules?: Module[];
}

interface EnrollmentData {
  enrolledSlugs: string[];
  progress: Record<string, Record<string, "completed" | "in-progress">>;
}

const normalizeCourseData = (course: any): Course => ({
  ...course,
  title: fixMojibake(course?.title),
  description: fixNullableMojibake(course?.description) || "",
  content_url: fixNullableMojibake(course?.content_url) || "",
});

const Courses = () => {
  const { user, session } = useAuth();
  const [courses, setCourses] = useState<Course[]>([]);
  const [enrollments, setEnrollments] = useState<EnrollmentData>({ enrolledSlugs: [], progress: {} });
  const [loading, setLoading] = useState(true);
  const [loadingEnroll, setLoadingEnroll] = useState(false);
  const [userProfile, setUserProfile] = useState<any>(null);
  const [userRole, setUserRole] = useState<string>("guest");
  const [roleLoading, setRoleLoading] = useState<boolean>(true);
  const [completedSlugs, setCompletedSlugs] = useState<string[]>([]);
  const [isPlanModalOpen, setIsPlanModalOpen] = useState(false);
  const [paymentMethodOpen, setPaymentMethodOpen] = useState(false);
  const [pendingCourse, setPendingCourse] = useState<Course | null>(null);

  // Estados dos Filtros
  const [filterLevel, setFilterLevel] = useState<string>("all");
  const [filterType, setFilterType] = useState<string>("all");

  // Carrega papel do usuário
  useEffect(() => {
    const loadRole = async () => {
      try {
        if (user) {
          const { data } = await supabase
            .from("profiles")
            .select("role, subscription_tier, is_admin")
            .eq("id", user.id)
            .single();
          setUserProfile(data);
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
        setCourses((data || []).map(normalizeCourseData));
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

  // Checa conclusão dos cursos do usuário
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

  // Lógica de Filtragem
  const filteredCourses = useMemo(() => {
    return courses.filter(c => {
      const matchesLevel = filterLevel === "all" || c.level === filterLevel;
      const isFree = !c.price || c.price === 0;
      const matchesType = filterType === "all" || 
                         (filterType === "free" && isFree) || 
                         (filterType === "paid" && !isFree);
      
      return matchesLevel && matchesType;
    });
  }, [courses, filterLevel, filterType]);

  const isAdmin = userProfile?.is_admin || userProfile?.role === 'admin';
  const isEnrolled = (slug: string) => enrollments.enrolledSlugs.includes(slug);
  const isCompleted = (slug: string) => completedSlugs.includes(slug);
  const isYearlyPlan = userProfile?.subscription_tier === 'yearly' || isAdmin;

  const enroll = async (course: Course) => {
    if (!user) {
      toast.error("Entre na sua conta para se inscrever.");
      return;
    }

    const isFree = !course.price || course.price === 0;
    
    // Se for gratuito, exige plano anual (exceto para admin)
    if (isFree && !isYearlyPlan && !isAdmin) {
      toast.error("Acesso restrito!", {
        description: "Cursos gratuitos são exclusivos para assinantes do Plano Anual."
      });
      setIsPlanModalOpen(true);
      return;
    }

    // Se for pago, inicia o checkout de pagamento (exceto para admin que acessa tudo)
    if (!isFree && !isAdmin) {
      setPendingCourse(course);
      setPaymentMethodOpen(true);
      return;
    }

    // Se for gratuito ou admin, inscreve direto
    try {
      setLoadingEnroll(true);
      const { error } = await supabase
        .from("academy_enrollments")
        .upsert({ user_id: user.id, course_slug: course.slug }, { onConflict: "user_id,course_slug" });
      if (error) throw error;
      setEnrollments((prev) => ({
        enrolledSlugs: Array.from(new Set([...(prev.enrolledSlugs || []), course.slug])),
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

  const handleCoursePayment = async (method: "credit_card" | "pix") => {
    if (!pendingCourse) return;
    setLoadingEnroll(true);
    const toastId = toast.loading("Iniciando checkout...");
    try {
      const data = await createCheckoutSession({ courseSlug: pendingCourse.slug, paymentMethod: method });
      if (data?.url) {
        window.location.href = data.url;
        return;
      }

      throw new Error("URL de checkout nao retornada pelo servidor.");
    } catch (err: any) {
      toast.error(err.message || "Erro ao iniciar pagamento.");
      toast.dismiss(toastId);
    } finally {
      setLoadingEnroll(false);
      setPaymentMethodOpen(false);
      setPendingCourse(null);
    }
  };

  const clearFilters = () => {
    setFilterLevel("all");
    setFilterType("all");
  };

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

  // Admins podem acessar mesmo que não tenham o papel 'professional'
  if (session && userRole !== "professional" && !isAdmin) {
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
          <div className="space-y-1">
            <h1 className="text-3xl font-bold flex items-center gap-2">
              <BookOpen className="h-8 w-8 text-primary" />
              Cursos de Capacitação
            </h1>
            <p className="text-muted-foreground">Aprimore seus conhecimentos e conquiste novos selos para seu perfil.</p>
          </div>
          <div className="flex gap-2">
            {isAdmin && (
              <Button asChild variant="outline" className="gap-2 border-primary/20 bg-primary/5 text-primary">
                <Link to="/admin/cursos">
                  <ShieldCheck className="h-4 w-4" />
                  Gerenciar Cursos
                </Link>
              </Button>
            )}
            <Button asChild variant="outline" className="hidden md:flex gap-2">
              <Link to="/dashboard">
                <LayoutDashboard className="h-4 w-4" />
                Voltar ao Dashboard
              </Link>
            </Button>
          </div>
        </div>

        {/* Barra de Filtros */}
        <div className="mb-8 rounded-2xl border border-border bg-card p-6 shadow-sm">
          <div className="flex flex-col md:flex-row items-end gap-4">
            <div className="grid gap-2 w-full md:w-64">
              <Label className="text-xs font-bold uppercase text-muted-foreground flex items-center gap-2">
                <Filter className="h-3 w-3" /> Nível do Curso
              </Label>
              <Select value={filterLevel} onValueChange={setFilterLevel}>
                <SelectTrigger>
                  <SelectValue placeholder="Todos os níveis" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos os níveis</SelectItem>
                  <SelectItem value="iniciante">Iniciante</SelectItem>
                  <SelectItem value="basico">Básico</SelectItem>
                  <SelectItem value="intermediario">Intermediário</SelectItem>
                  <SelectItem value="avancado">Avançado</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="grid gap-2 w-full md:w-64">
              <Label className="text-xs font-bold uppercase text-muted-foreground flex items-center gap-2">
                <Filter className="h-3 w-3" /> Tipo de Inscrição
              </Label>
              <Select value={filterType} onValueChange={setFilterType}>
                <SelectTrigger>
                  <SelectValue placeholder="Todos os tipos" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos os tipos</SelectItem>
                  <SelectItem value="free">Gratuito</SelectItem>
                  <SelectItem value="paid">Pago</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {(filterLevel !== "all" || filterType !== "all") && (
              <Button variant="ghost" size="sm" onClick={clearFilters} className="gap-2 text-muted-foreground hover:text-foreground">
                <X className="h-4 w-4" /> Limpar Filtros
              </Button>
            )}
          </div>
        </div>

        {loading ? (
          <div className="flex flex-col items-center justify-center py-20 gap-3 text-muted-foreground">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
            <p>Carregando catálogo de cursos...</p>
          </div>
        ) : filteredCourses.length > 0 ? (
          <>
            <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {filteredCourses.map((c) => {
                const isFree = !c.price || c.price === 0;
                const needsYearly = isFree && !isYearlyPlan && !isEnrolled(c.slug) && !isAdmin;

                return (
                  <Card key={c.slug} className="overflow-hidden flex flex-col group hover:shadow-md transition-all border-primary/5">
                    {c.hero_asset_url ? (
                      <AspectRatio ratio={4/3} className="relative w-full bg-muted shrink-0 overflow-hidden">
                        {isCompleted(c.slug) ? (
                          <Badge className="absolute left-2 top-2 bg-success z-10 shadow-sm">Concluído</Badge>
                        ) : null}
                        <img
                          src={c.hero_asset_url}
                          alt={c.title}
                          className="h-full w-full object-cover rounded-t-md group-hover:scale-105 transition-transform duration-500"
                        />
                        <div className="absolute bottom-2 right-2">
                          {isFree ? (
                            <Badge className="bg-success/90 text-white border-none">Grátis</Badge>
                          ) : (
                            <Badge className="bg-destructive text-white border-none">R$ {Number(c.price).toFixed(2).replace('.', ',')}</Badge>
                          )}
                        </div>
                      </AspectRatio>
                    ) : null}
                    <CardHeader className="pb-2">
                      <CardTitle className="flex items-start justify-between gap-2 text-lg">
                        <span className="line-clamp-2 leading-tight">{c.title}</span>
                      </CardTitle>
                      <div className="flex items-center gap-2 mt-1">
                        <Badge variant="secondary" className="capitalize text-[10px] h-5">
                          {c.level ? COURSE_LEVEL_LABELS[c.level] || c.level : "Iniciante"}
                        </Badge>
                        <span className="text-[10px] text-muted-foreground uppercase font-bold tracking-wider">
                          {c.duration_minutes ? `${c.duration_minutes} min` : ""}
                        </span>
                      </div>
                    </CardHeader>
                    <CardContent className="space-y-4 flex-1 flex flex-col pt-0">
                      <div 
                        className="text-sm text-muted-foreground prose prose-sm max-none line-clamp-3 flex-1"
                        dangerouslySetInnerHTML={{ __html: c.description || "" }}
                      />
                      
                      {needsYearly && (
                        <div className="bg-amber-50 border border-amber-200 p-2 rounded-lg flex items-center gap-2 text-[10px] text-amber-700 font-medium">
                          <Lock className="h-3 w-3" />
                          Exclusivo para Plano Anual
                        </div>
                      )}

                      <div className="flex gap-2 pt-2">
                        <Button asChild variant="outline" size="sm" className="flex-1">
                          <Link to={`/cursos/${c.slug}`}>Ver detalhes</Link>
                        </Button>
                        {isEnrolled(c.slug) || isAdmin ? (
                          <Button 
                            asChild 
                            size="sm"
                            className={cn("flex-1", isCompleted(c.slug) && "bg-success hover:bg-success/90 border-none")}
                          >
                            <Link to={`/cursos/${c.slug}`}>
                              {isAdmin && !isEnrolled(c.slug) ? "Acesso Admin" : isCompleted(c.slug) ? "Rever Curso" : "Continuar"}
                            </Link>
                          </Button>
                        ) : needsYearly ? (
                          <Button 
                            size="sm" 
                            className="flex-1 gap-2 bg-amber-500 hover:bg-amber-600 border-none"
                            onClick={() => setIsPlanModalOpen(true)}
                          >
                            <Zap className="h-3 w-3 fill-current" />
                            Assinar Anual
                          </Button>
                        ) : (
                          <Button size="sm" onClick={() => enroll(c)} disabled={loadingEnroll} className="flex-1 gap-2">
                            {loadingEnroll ? <Loader2 className="h-4 w-4 animate-spin" /> : isFree ? <BookOpen className="h-4 w-4" /> : <ShoppingCart className="h-4 w-4" />}
                            {isFree ? "Inscrever-se" : "Comprar"}
                          </Button>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
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
          <div className="text-center py-20 bg-secondary/10 rounded-3xl border border-dashed">
            <Search className="h-12 w-12 mx-auto mb-4 opacity-20" />
            <h3 className="text-lg font-semibold">Nenhum curso encontrado</h3>
            <p className="text-muted-foreground">Tente ajustar os filtros para encontrar o que procura.</p>
            <Button variant="link" onClick={clearFilters} className="mt-2">Limpar todos os filtros</Button>
          </div>
        )}
      </div>

      <PlanSelectionModal
        open={isPlanModalOpen}
        onOpenChange={setIsPlanModalOpen}
        showCoupon={false}
      />

      <CoursePaymentMethodDialog
        open={paymentMethodOpen}
        onOpenChange={(open) => {
          setPaymentMethodOpen(open);
          if (!open) setPendingCourse(null);
        }}
        courseTitle={pendingCourse?.title}
        priceLabel={
          pendingCourse?.price
            ? `R$ ${Number(pendingCourse.price).toFixed(2).replace(".", ",")}`
            : undefined
        }
        loading={loadingEnroll}
        onSelect={handleCoursePayment}
      />
    </Layout>
  );
};

export default Courses;
