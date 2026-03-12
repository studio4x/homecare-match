"use client";

import { useState, useEffect, useCallback } from "react";
import { useParams, Link, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import Layout from "@/components/layout/Layout";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import ReviewList from "@/components/ReviewList";
import SafeHTML from "@/components/SafeHTML";
import { 
  MapPin, 
  Award, 
  Briefcase, 
  MessageSquare, 
  ArrowLeft,
  Calendar,
  Share2,
  Star,
  Loader2,
  Lock,
  UserCheck,
  Users,
  LayoutGrid,
  DollarSign,
  Clock,
  GraduationCap,
  Info,
  ShieldCheck,
  MessageCircle,
  AlertTriangle,
  Eye,
  X
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { useAuth } from "@/components/auth/AuthProvider";
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Separator } from "@/components/ui/separator";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import ReportModal from "@/components/ReportModal";
import CertificateModal from "@/components/CertificateModal";

const Perfil = () => {
  const { id } = useParams();
  const { session, user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  
  const [profile, setProfile] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [isContacting, setIsContacting] = useState(false);
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [showReportModal, setShowReportModal] = useState(false);
  const [viewerRole, setViewerRole] = useState<string | null>(null);
  const [referralStats, setReferralStats] = useState<{ count: number; currentTier?: any; nextTier?: any } | null>(null);
  const [completedCourses, setCompletedCourses] = useState<Array<{ slug: string; title: string; hero_asset_url: string | null; workload_minutes: number; certificateId: string | null }>>([]);
  const [loadingCourses, setLoadingCourses] = useState<boolean>(false);

  const [showCertificateModal, setShowCertificateModal] = useState(false);
  const [certificateToView, setCertificateToView] = useState<string | null>(null);

  const fetchProfile = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    try {
      const { data: discoveryData } = await supabase
        .from("professional_discovery")
        .select("*")
        .eq("id", id)
        .maybeSingle();

      const { data: fullData } = await supabase
        .from("profiles")
        .select("phone, hourly_rate, availability, patient_profiles")
        .eq("id", id)
        .maybeSingle();

      if (!discoveryData) {
        const { data: isAdmin } = await supabase.rpc("check_is_admin");

        if (isAdmin) {
          const { data: adminData } = await supabase
            .from("profiles")
            .select("*")
            .eq("id", id)
            .maybeSingle();

          if (adminData?.role === "professional") {
            setProfile(adminData);
            toast.info("Perfil fora da busca pública (e-mail não confirmado ou oculto).");
            return;
          }
        }

        toast.error("Perfil não encontrado.");
        setLoading(false);
        return;
      }

      setProfile({
        ...discoveryData,
        ...fullData
      });
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    fetchProfile();
    
    if (id) {
      supabase.from('profile_views').insert({
        profile_id: id,
        viewer_id: user?.id || null
      }).then(({ error }) => {
        if (error) console.warn("[Analytics] Erro ao registrar visualização.");
      });
    }
  }, [id, user?.id, fetchProfile]);

  useEffect(() => {
    const fetchViewerRole = async () => {
      if (user) {
        const { data } = await supabase
          .from("profiles")
          .select("role")
          .eq("id", user.id)
          .single();
        setViewerRole(data?.role || null);
      }
    };
    if (!authLoading) fetchViewerRole();
  }, [user, authLoading]);

  useEffect(() => {
    const fetchStats = async () => {
      if (!id) return;
      try {
        const { data, error } = await supabase.functions.invoke('referral-stats', {
          body: { referrerId: id }
        });
        if (!error && data) setReferralStats(data as any);
      } catch (e) {
        console.warn("[ReferralStats] Falha ao buscar estatísticas.");
      }
    };
    fetchStats();
  }, [id]);

  useEffect(() => {
    const fetchCompleted = async () => {
      if (!id) return;
      setLoadingCourses(true);
      try {
        const { data, error } = await supabase.functions.invoke('public-profile-courses', {
          body: { userId: id }
        });
        if (!error && data?.courses) {
          // Mapeia o 'id' retornado pela função para 'certificateId'
          const mapped = data.courses.map((c: any) => ({
            slug: c.slug,
            title: c.title,
            hero_asset_url: c.hero_asset_url,
            workload_minutes: c.workload_minutes,
            certificateId: c.id // Aqui está a correção
          }));
          setCompletedCourses(mapped);
        }
      } catch {
        setCompletedCourses([]);
      } finally {
        setLoadingCourses(false);
      }
    };
    fetchCompleted();
  }, [id]);

  const handleContact = async () => {
    if (!session || !user) {
      toast.info("Você precisa estar logado para entrar em contato.");
      navigate("/login");
      return;
    }

    if (user.id === profile.id) {
      toast.error("Você não pode entrar em contato com você mesmo.");
      return;
    }

    setIsContacting(true);

    try {
      const { error } = await supabase.from('interactions').insert({
        sender_id: user.id,
        professional_id: profile.id
      });

      if (error) throw error;

      const { error: notifyError } = await supabase.functions.invoke('notify-contact', {
        body: { professional_id: profile.id, sender_id: user.id }
      });
      if (notifyError) {
        console.warn("Falha ao enviar notificações de contato:", notifyError);
        toast.warning("Contato salvo, mas houve falha ao enviar notificações.");
      }

      setShowSuccessModal(true);
      
    } catch (error) {
      toast.error("Erro ao adicionar profissional aos contatos.");
      console.error("Erro ao registrar interação:", error);
    } finally {
      setIsContacting(false);
    }
  };

  const shareProfile = () => {
    navigator.clipboard.writeText(window.location.href);
    toast.success("Link do perfil copiado!");
  };

  const formatMinutes = (min: number) => {
    if (!min || min <= 0) return "—";
    const h = Math.floor(min / 60);
    const m = min % 60;
    if (h > 0 && m > 0) return `${h}h ${m}min`;
    if (h > 0) return `${h}h`;
    return `${m}min`;
  };

  if (authLoading || loading) return (
    <Layout>
      <div className="flex h-96 items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    </Layout>
  );

  if (!profile) return (
    <Layout>
      <div className="container mx-auto px-4 py-20 text-center">
        <h2 className="text-2xl font-bold">Profissional não encontrado</h2>
        <Button asChild className="mt-4">
          <Link to="/buscar">Voltar para a busca</Link>
        </Button>
      </div>
    </Layout>
  );

  const initials = (profile.full_name || "")
    .split(" ")
    .filter(Boolean)
    .map((n: string) => n[0])
    .join("")
    .slice(0, 2)
    .toUpperCase() || "??";

  const isPremium = profile.subscription_tier === 'yearly';
  const specialtyLabel = (profile.specialty || '').replace(/-/g, ' ');
  
  return (
    <Layout>
      <TooltipProvider>
        <div className="bg-secondary/20 py-8">
          <div className="container mx-auto px-4">
            <div className="flex items-center justify-between mb-6">
              <Button variant="ghost" asChild className="gap-2">
                <Link to="/buscar">
                  <ArrowLeft className="h-4 w-4" />
                  Voltar para busca
                </Link>
              </Button>
              
              {user && user.id !== profile.id && (
                <Button 
                  variant="ghost" 
                  size="sm" 
                  className="text-muted-foreground hover:text-destructive gap-2"
                  onClick={() => setShowReportModal(true)}
                >
                  <AlertTriangle className="h-4 w-4" />
                  Denunciar Perfil
                </Button>
              )}
            </div>

            <div className="grid gap-8 lg:grid-cols-3">
              <div className="lg:col-span-2 space-y-6">
                <div className={cn(
                  "rounded-2xl border bg-card p-8 shadow-card",
                  isPremium ? "border-amber-400/30" : "border-border"
                )}>
                  <div className="flex flex-col md:flex-row gap-6 items-start">
                    <div className="relative">
                      <Avatar className="h-32 w-32 ring-4 ring-background shadow-lg">
                        <AvatarImage src={profile.avatar_url} />
                        <AvatarFallback className="bg-primary/10 text-3xl font-bold text-primary">
                          {initials}
                        </AvatarFallback>
                      </Avatar>
                    </div>
                    <div className="flex-1">
                      <div className="flex flex-wrap items-center gap-3">
                        <h1 className="text-3xl font-bold text-foreground flex items-center gap-2">
                          {profile.full_name || "Profissional"}
                          {isPremium && (
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Star className="h-5 w-5 text-amber-500 fill-current" />
                              </TooltipTrigger>
                              <TooltipContent>Destaque Premium</TooltipContent>
                            </Tooltip>
                          )}
                          {profile.is_verified && (
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <ShieldCheck className="h-5 w-5 text-success" />
                              </TooltipTrigger>
                              <TooltipContent>Perfil Verificado</TooltipContent>
                            </Tooltip>
                          )}
                        </h1>
                        {profile.is_verified && (
                          <Badge className={cn(
                            "border-none text-white whitespace-nowrap",
                            isPremium ? "bg-gold" : "bg-success"
                          )}>
                            {isPremium ? "Verificado Premium" : "Verificado"}
                          </Badge>
                        )}
                        {referralStats?.currentTier && (
                          <Badge variant="secondary" className="ml-2 whitespace-nowrap bg-primary/10 text-primary border-primary/20 gap-1.5">
                            <Award className="h-3 w-3" />
                            {referralStats.currentTier.badge_label}
                          </Badge>
                        )}
                      </div>
                      <p className="mt-2 text-xl text-muted-foreground font-medium uppercase tracking-tight">
                        {specialtyLabel || "Especialidade não informada"}
                      </p>
                      <div className="mt-4 flex flex-wrap gap-4 text-sm text-muted-foreground">
                        <div className="flex items-center gap-1">
                          <MapPin className="h-4 w-4 text-primary" />
                          {[profile.neighborhood, profile.city].filter(Boolean).join(", ")} {profile.state ? `- ${profile.state}` : ""}
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="mt-10">
                    <h3 className="text-lg font-semibold border-b pb-2 mb-4 flex items-center gap-2">
                      <Info className="h-5 w-5 text-primary" />
                      Sobre mim
                    </h3>
                    <SafeHTML content={profile.bio || "Este profissional ainda não preencheu sua biografia."} />
                  </div>

                  <div className="mt-10">
                    <h3 className="text-lg font-semibold border-b pb-2 mb-4 flex items-center gap-2">
                      <GraduationCap className="h-5 w-5 text-primary" />
                      Formações
                    </h3>
                    <SafeHTML content={profile.experience || "Informações de formações não detalhadas."} />
                  </div>

                  <div className="mt-8">
                    <h3 className="text-lg font-semibold border-b pb-2 mb-4 flex items-center gap-2">
                      <Briefcase className="h-5 w-5 text-primary" />
                      Experiências Profissionais
                    </h3>
                    <SafeHTML content={profile.professional_experiences || "Informações de experiências profissionais não detalhadas."} />
                  </div>

                  <div className="mt-10">
                    <h3 className="text-lg font-semibold border-b pb-2 mb-4 flex items-center gap-2">
                      <LayoutGrid className="h-5 w-5 text-primary" />
                      Cursos Concluídos na Plataforma
                    </h3>
                    {loadingCourses ? (
                      <div className="flex items-center gap-2 text-muted-foreground">
                        <Loader2 className="h-4 w-4 animate-spin" /> Carregando cursos...
                      </div>
                    ) : completedCourses.length > 0 ? (
                      <div className="space-y-3">
                        {completedCourses.map((c) => (
                          <div key={c.slug} className="border rounded-lg p-3 bg-card flex items-center justify-between">
                            <div>
                              <h4 className="font-semibold">{c.title}</h4>
                              <p className="text-xs text-muted-foreground">
                                Carga horária: {formatMinutes(c.workload_minutes)}
                              </p>
                            </div>
                            {c.certificateId && (
                              <Button 
                                variant="outline" 
                                size="sm" 
                                className="gap-2"
                                onClick={() => {
                                  setCertificateToView(c.certificateId);
                                  setShowCertificateModal(true);
                                }}
                              >
                                <Eye className="h-4 w-4" /> Ver Selo
                              </Button>
                            )}
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-sm text-muted-foreground">
                        Este profissional ainda não concluiu cursos ou optou por não exibi-los.
                      </p>
                    )}
                  </div>

                  <Separator className="my-10" />

                  <div>
                    <h3 className="text-lg font-semibold mb-6">Detalhes do Atendimento</h3>
                    <div className="grid gap-8 md:grid-cols-2">
                      <div>
                        <h4 className="font-semibold flex items-center gap-2 mb-3">
                          <Clock className="h-5 w-5 text-primary" />
                          Disponibilidade
                        </h4>
                        {profile.availability?.length > 0 ? (
                          <div className="flex flex-wrap gap-2">
                            {profile.availability.map((item: string) => (
                              <Badge key={item} variant="secondary">{item}</Badge>
                            ))}
                          </div>
                        ) : (
                          <p className="text-sm text-muted-foreground">Não informado.</p>
                        )}
                      </div>
                      <div>
                        <h4 className="font-semibold flex items-center gap-2 mb-3">
                          <Users className="h-5 w-5 text-primary" />
                          Perfis de Pacientes
                        </h4>
                        {profile.patient_profiles?.length > 0 ? (
                          <div className="flex flex-wrap gap-2">
                            {profile.patient_profiles.map((item: string) => (
                              <Badge key={item} variant="secondary">{item}</Badge>
                            ))}
                          </div>
                        ) : (
                          <p className="text-sm text-muted-foreground">Não informado.</p>
                        )}
                      </div>
                      {viewerRole === 'family' && profile.hourly_rate && (
                        <div className="md:col-span-2">
                          <h4 className="font-semibold flex items-center gap-2 mb-3">
                            <DollarSign className="h-5 w-5 text-primary" />
                            Valor por Hora
                          </h4>
                          <p className="text-2xl font-bold text-foreground">
                            R$ {Number(profile.hourly_rate).toFixed(2).replace('.', ',')}
                          </p>
                        </div>
                      )}
                    </div>
                  </div>

                  <Separator className="my-10" />

                  <div id="avaliacoes">
                    <h3 className="text-lg font-semibold mb-6 flex items-center gap-2">
                      <MessageCircle className="h-5 w-5 text-primary" />
                      Avaliações e Depoimentos
                    </h3>
                    <ReviewList subjectId={profile.id} />
                  </div>
                </div>
              </div>

              <div className="space-y-6">
                <div className="rounded-2xl border border-border bg-card p-6 shadow-card sticky top-24">
                  <h3 className="font-semibold text-lg mb-2 text-center">Interessado?</h3>
                  <p className="text-xs text-muted-foreground text-center mb-4">
                    Ao clicar, o profissional será salvo em sua lista de contatos no seu painel, onde você poderá ver o WhatsApp e iniciar a conversa.
                  </p>
                  <div className="space-y-3">
                    <Button 
                      onClick={handleContact} 
                      disabled={isContacting}
                      className="w-full h-12 gap-2 text-lg bg-primary hover:bg-primary/90"
                    >
                      {isContacting ? <Loader2 className="h-5 w-5 animate-spin" /> : <MessageSquare className="h-5 w-5" />}
                      Adicionar aos Contatos
                    </Button>
                    
                    {!session && (
                      <p className="text-xs text-center text-muted-foreground flex items-center justify-center gap-1">
                        <Lock className="h-3 w-3" />
                        Login necessário para visualizar contato
                      </p>
                    )}

                    <Button onClick={shareProfile} variant="outline" className="w-full gap-2">
                      <Share2 className="h-4 w-4" />
                      Compartilhar Perfil
                    </Button>
                  </div>
                  
                  <div className="mt-6 pt-6 border-t border-border">
                    <div className="flex items-center gap-3 text-sm text-muted-foreground">
                      <Calendar className="h-4 w-4" />
                      <span>Membro desde {new Date(profile.updated_at).toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })}</span>
                    </div>
                  </div>
                </div>

                <div className="rounded-2xl border border-border bg-card p-4 shadow-card">
                  <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
                    <div className="flex items-center gap-1 rounded-full border px-2 py-1 bg-card">
                      <ShieldCheck className="h-3 w-3 text-success" />
                      <span className="leading-none">Perfil Verificado</span>
                    </div>
                    <div className="flex items-center gap-1 rounded-full border px-2 py-1 bg-card">
                      <Star className="h-3 w-3 text-amber-500 fill-current" />
                      <span className="leading-none">Destaque Premium</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </TooltipProvider>

      <Dialog open={showSuccessModal} onOpenChange={setShowSuccessModal}>
        <DialogContent className="max-w-2xl p-0 overflow-hidden border-none shadow-2xl animate-scale-in">
          <div className="relative bg-card p-12 md:p-16 flex flex-col items-center text-center space-y-8">
            <button onClick={() => setShowSuccessModal(false)} className="absolute right-6 top-6 p-2 rounded-full hover:bg-secondary transition-colors">
              <X className="h-6 w-6 text-muted-foreground" />
            </button>
            <div className="h-24 w-24 rounded-full bg-success/10 flex items-center justify-center animate-bounce">
              <UserCheck className="h-12 w-12 text-success" />
            </div>
            <div className="space-y-4">
              <DialogTitle className="text-4xl font-bold tracking-tight text-foreground">Profissional Adicionado!</DialogTitle>
              <DialogDescription className="text-xl text-muted-foreground leading-relaxed max-w-lg mx-auto">
                {profile?.full_name} foi salvo na sua lista de contatos. Você pode ver os detalhes e iniciar a conversa a partir do seu painel.
              </DialogDescription>
            </div>
            <div className="flex flex-col sm:flex-row gap-4 w-full max-w-md">
              <Button size="lg" variant="outline" className="w-full h-14 text-lg font-semibold shadow-lg gap-2" asChild>
                <Link to="/buscar"><Users className="h-5 w-5" />Buscar Outros</Link>
              </Button>
              <Button size="lg" className="w-full h-14 text-lg font-semibold shadow-lg gap-2" asChild>
                <Link to="/dashboard/contatos"><LayoutGrid className="h-5 w-5" />Ir para o Painel</Link>
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <ReportModal open={showReportModal} onOpenChange={setShowReportModal} reportedId={profile.id} reportedName={profile.full_name} />
      
      <CertificateModal 
        open={showCertificateModal} 
        onOpenChange={setShowCertificateModal} 
        certificateId={certificateToView} 
      />
    </Layout>
  );
};

export default Perfil;
