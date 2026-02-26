"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useAuth } from "@/components/auth/AuthProvider";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";
import { 
  ShieldCheck, 
  Clock, 
  AlertCircle, 
  Star, 
  ArrowRight, 
  CheckCircle2, 
  AlertOctagon,
  RotateCcw,
  LayoutGrid,
  Loader2,
  Eye,
  LifeBuoy,
  Settings,
  CreditCard,
  EyeOff,
  Calendar,
  User,
  Building2,
  Home,
  XCircle,
  RefreshCw,
  Mail,
  Award,
  Ticket,
  Gift,
  PlayCircle,
  Users,
  Edit2
} from "lucide-react";
import { Link, useSearchParams } from "react-router-dom";
import { differenceInDays, addDays, parseISO, isValid, format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import PlanSelectionModal from "@/components/PlanSelectionModal";
import OnboardingModal from "@/components/OnboardingModal";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { useQuery } from "@tanstack/react-query";
import { Switch } from "@/components/ui/switch"; 
import { Label } from "@/components/ui/label";

const OverviewPage = () => {
  const { user } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const [profile, setProfile] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isSyncingBilling, setIsSyncingBilling] = useState(false);
  const [isManagingBilling, setIsManagingBilling] = useState(false);
  const [isPlanModalOpen, setIsPlanModalOpen] = useState(false);
  const [isOnboardingOpen, setIsOnboardingOpen] = useState(false);
  const [referralStats, setReferralStats] = useState<any>(null);
  const [isSavingOnboardingPref, setIsSavingOnboardingPref] = useState(false);
  const [companyPatients, setCompanyPatients] = useState<any[]>([]);

  const { data: annualPlan } = useQuery({
    queryKey: ["annual-plan-details"],
    queryFn: async () => {
      const { data } = await supabase.from('plans').select('features').eq('id', 'yearly').single();
      return data;
    }
  });

  const fetchProfile = async (showToast = false) => {
    if (!user) return;
    if (showToast) setIsRefreshing(true);
    
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', user.id)
        .single();
      
      if (error) throw error;

      setProfile(data);
      
      if ((data.role === 'professional' || data.role === 'company' || data.role === 'family') && !data.has_seen_onboarding && !isOnboardingOpen) {
        setIsOnboardingOpen(true);
      }

      if (data.role === 'professional') {
        const { data: stats } = await supabase.functions.invoke('referral-stats', {
          body: { referrerId: user.id }
        });
        if (stats) setReferralStats(stats);
      }

      if (data.role === 'company') {
        const { data: patientsData, error: patientsError } = await supabase
          .from('company_patients')
          .select('*')
          .eq('company_id', user.id)
          .eq('is_visible', true)
          .order('created_at', { ascending: false });
        
        if (patientsError) throw patientsError;
        setCompanyPatients(patientsData || []);
      } else {
        setCompanyPatients([]);
      }

      if (showToast) toast.success("Dados atualizados!");
    } catch (err) {
      console.error("[Overview] Erro ao carregar perfil:", err);
      if (showToast) toast.error("Erro ao atualizar dados.");
    } finally {
      setLoading(false);
      setIsRefreshing(false);
    }
  };

  useEffect(() => {
    fetchProfile();
  }, [user]);

  useEffect(() => {
    if (searchParams.get("success") === "true") {
      toast.success("Pagamento processado! Atualizando seu plano...", {
        duration: 5000,
      });
      
      const interval = setInterval(() => fetchProfile(false), 3000);
      const timeout = setTimeout(() => {
        clearInterval(interval);
        searchParams.delete("success");
        setSearchParams(searchParams);
      }, 15000);

      return () => {
        clearInterval(interval);
        clearTimeout(timeout);
      };
    }
  }, [searchParams]);

  const handleSyncBilling = async () => {
    setIsSyncingBilling(true);
    const toastId = toast.loading("Consultando pagamentos...");
    try {
      const { data, error } = await supabase.functions.invoke('sync-user-subscription');
      
      if (error) {
        let errorMessage = "Erro ao sincronizar pagamentos.";
        try {
          const body = await error.context?.json();
          if (body?.error) errorMessage = body.error;
        } catch {}
        throw new Error(errorMessage);
      }
      
      if (data?.success) {
        toast.success(data.message, { id: toastId });
        if (data.profile) {
          setProfile(data.profile);
        } else {
          await fetchProfile();
        }
      } else {
        toast.info(data.message || "Nenhuma alteraÃ§Ã£o encontrada.", { id: toastId });
      }
    } catch (err: any) {
      console.error("[Sync Error]", err);
      toast.error(err.message || "Erro ao sincronizar pagamentos.", { id: toastId });
    } finally {
      setIsSyncingBilling(false);
    }
  };

  const handleManageBilling = async () => {
    setIsManagingBilling(true);
    try {
      const { data, error } = await supabase.functions.invoke('create-portal-session');
      if (error) throw error;
      if (data?.url) {
        window.location.href = data.url;
      }
    } catch (err: any) {
      console.error(err);
      toast.error("NÃ£o foi possÃ­vel acessar o portal de pagamentos.");
    } finally {
      setIsManagingBilling(false);
    }
  };

  const getProfileCompleteness = () => {
    if (!profile) return { progress: 0, missingFields: [], isComplete: false };
    
    const requiredFields: { [key: string]: string } = {
      avatar_url: "Foto",
      full_name: "Nome",
      phone: "WhatsApp",
      neighborhood: "Bairro",
      city: "Cidade",
      state: "Estado",
    };

    if (profile.role === 'professional') {
      requiredFields.specialty = "Especialidade";
      requiredFields.registration = "Registro";
      requiredFields.experience = "FormaÃ§Ãµes";
      requiredFields.bio = "Biografia";
    } else if (profile.role === 'company') {
      requiredFields.company_name = "RazÃ£o Social";
      requiredFields.cnpj = "CNPJ";
      requiredFields.bio = "DescriÃ§Ã£o da Empresa";
    } else if (profile.role === 'family') {
      requiredFields.patient_name = "Nome do Paciente";
      requiredFields.patient_age = "Idade do Paciente";
      requiredFields.patient_medical_conditions = "CondiÃ§Ã£o MÃ©dica";
      requiredFields.bio = "Outras ObservaÃ§Ãµes";
      requiredFields.availability = "HorÃ¡rio de Atendimento";
    }
    
    let completedCount = 0;
    const missingFields: string[] = [];
    const totalFields = Object.keys(requiredFields).length;
    
    for (const [key, label] of Object.entries(requiredFields)) {
      const value = profile[key];
      if (Array.isArray(value)) {
        if (value.length > 0) {
          completedCount++;
        } else {
          missingFields.push(label);
        }
      } else if (value && String(value).trim() !== '') {
        completedCount++;
      } else {
        missingFields.push(label);
      }
    }
    
    return { 
      progress: Math.round((completedCount / totalFields) * 100), 
      missingFields, 
      isComplete: missingFields.length === 0 
    };
  };

  const getTrialInfo = () => {
    if (profile?.subscription_tier !== 'free_trial' || !profile?.trial_started_at) return null;
    const start = parseISO(profile.trial_started_at);
    const startDate = isValid(start) ? start : new Date(profile.trial_started_at);
    const endDate = addDays(startDate, 30);
    const rawDaysRemaining = differenceInDays(endDate, new Date());
    const daysRemaining = Math.max(0, rawDaysRemaining);
    const progress = Math.min(100, Math.max(0, ((30 - daysRemaining) / 30) * 100));
    return { daysRemaining, progress, isExpired: daysRemaining <= 0, endDate };
  };

  const handleRetryVerification = async () => {
    if (!user) return;
    try {
      const { error } = await supabase
        .from("profiles")
        .update({ rejection_reason: null, verification_sent: false })
        .eq("id", user.id);
      if (error) throw error;
      toast.success("Agora vocÃª pode reenviar seus documentos na seÃ§Ã£o Meus Dados.");
      fetchProfile();
    } catch (err) {
      toast.error("Erro ao reiniciar processo.");
    }
  };

  const handleToggleOnboardingVisibility = async (checked: boolean) => {
    if (!user) return;
    setIsSavingOnboardingPref(true);
    try {
      const newHasSeenOnboarding = !checked; 
      const { error } = await supabase
        .from("profiles")
        .update({ has_seen_onboarding: newHasSeenOnboarding })
        .eq("id", user.id);
      
      if (error) throw error;
      setProfile(prev => prev ? { ...prev, has_seen_onboarding: newHasSeenOnboarding } : prev);
      toast.success("PreferÃªncia de tutorial salva!");
    } catch (err) {
      toast.error("Erro ao salvar preferÃªncia.");
    } finally {
      setIsSavingOnboardingPref(false);
    }
  };

  const getRoleBadge = () => {
    if (!profile?.role) return null;
    
    const roles: Record<string, { label: string, icon: any, color: string }> = {
      professional: { label: "Profissional", icon: User, color: "bg-primary/10 text-primary border-primary/20" },
      company: { label: "Empresa", icon: Building2, color: "bg-success/10 text-success border-success/20" },
      family: { label: "FamÃ­lia", icon: Home, color: "bg-amber-100 text-amber-700 border-amber-200" },
      admin: { label: "Administrador", icon: ShieldCheck, color: "bg-slate-100 text-slate-700 border-slate-200" }
    };

    const config = roles[profile.role] || { label: profile.role, icon: User, color: "bg-secondary text-secondary-foreground" };
    const Icon = config.icon;

    return (
      <Badge variant="outline" className={cn("w-fit gap-1.5 py-1 px-3 text-[10px] uppercase font-bold tracking-wider mb-2", config.color)}>
        <Icon className="h-3 w-3" />
        {config.label}
      </Badge>
    );
  };

  const getSubscriptionStatus = () => {
    if (!profile) return null;
    
    if (!profile.subscription_end_at) {
      return {
        label: "Ativa",
        description: "Aguardando sincronizaÃ§Ã£o...",
        icon: CheckCircle2,
        color: "text-green-600",
        bg: "bg-green-50 border-green-200",
        dateLabel: "Status da Data"
      };
    }

    const endDate = parseISO(profile.subscription_end_at);
    const now = new Date();
    const isExpired = endDate < now;

    if (profile.cancel_at_period_end) {
      if (isExpired) {
        return {
          label: "Expirada",
          description: "Assinatura encerrada.",
          icon: XCircle,
          color: "text-red-600",
          bg: "bg-red-50 border-red-200",
          dateLabel: "Expirou em"
        };
      }
      return {
        label: "Ativa",
        description: "PerÃ­odo de acesso garantido.",
        icon: Ticket,
        color: "text-primary",
        bg: "bg-primary/5 border-primary/20",
        dateLabel: "VÃ¡lido atÃ©"
      };
    }

    return {
      label: "Ativa",
      description: "RenovaÃ§Ã£o automÃ¡tica.",
      icon: CheckCircle2,
      color: "text-green-600",
      bg: "bg-green-50 border-green-200",
      dateLabel: "PrÃ³xima renovaÃ§Ã£o"
    };
  };

  const completeness = getProfileCompleteness();
  const trial = getTrialInfo();
  const isProfessional = profile?.role === 'professional';
  const isCompany = profile?.role === 'company';
  const isFamily = profile?.role === 'family';
  const isAdmin = profile?.is_admin || profile?.role === 'admin';
  const firstName = profile?.full_name?.split(' ')[0] || "UsuÃ¡rio";
  
  const hasPaidPlan = (profile?.subscription_tier && profile?.subscription_tier !== 'free_trial') || profile?.coupon_days;
  const subStatus = getSubscriptionStatus();

  const getPlanLabel = (tier: string) => {
    if (tier === 'monthly') return 'Plano Mensal';
    if (tier === 'yearly') return 'Plano Anual';
    if (tier === 'free_trial') return 'PerÃ­odo de 30 dias Gratuitos';
    return tier;
  };

  const getPatientCode = (patient: any) => {
    const rawCode = (patient?.patient_name ?? "").toString().trim();
    if (!rawCode) return patient?.id?.slice(0, 6)?.toUpperCase() || "N/A";
    if (/^\d+$/.test(rawCode)) return rawCode.padStart(3, "0");
    return rawCode;
  };

  const familyAvailability = Array.isArray(profile?.availability) ? profile.availability : [];
  const familyMedicalSummary = profile?.patient_medical_conditions
    ? profile.patient_medical_conditions.length > 180
      ? `${profile.patient_medical_conditions.slice(0, 180)}...`
      : profile.patient_medical_conditions
    : "NÃ£o informado";

  const QuickAccessCard = (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base">Acesso RÃ¡pido</CardTitle>
      </CardHeader>
      <CardContent className="grid gap-2">
        {isAdmin && (
          <Button variant="outline" asChild className="justify-start gap-3 h-12 border-primary/20 bg-primary/5 hover:bg-primary/10">
            <Link to="/admin">
              <div className="h-8 w-8 rounded-lg bg-primary flex items-center justify-center shrink-0">
                <Settings className="h-4 w-4" />
              </div>
              <span className="font-bold text-primary">Painel Administrativo</span>
            </Link>
          </Button>
        )}
        {isProfessional && (
          <Button variant="outline" asChild className="justify-start gap-3 h-12 border-primary/20 hover:bg-primary/5">
            <Link to={`/profissional/${user?.id}`}>
              <div className="h-8 w-8 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                <Eye className="h-4 w-4" />
              </div>
              Ver Perfil PÃºblico
            </Link>
          </Button>
        )}
        <Button variant="outline" asChild className="justify-start gap-3 h-12">
          <Link to="/dashboard/perfil">
            <div className="h-8 w-8 rounded-lg bg-secondary flex items-center justify-center shrink-0">
              <ShieldCheck className="h-4 w-4 text-primary" />
            </div>
            Gerenciar Perfil
          </Link>
        </Button>
        <Button variant="outline" asChild className="justify-start gap-3 h-12">
          <Link to="/dashboard/contatos">
            <div className="h-8 w-8 rounded-lg bg-secondary flex items-center justify-center shrink-0">
              <LayoutGrid className="h-4 w-4 text-primary" />
            </div>
            HistÃ³rico de Contatos
          </Link>
        </Button>
        <Button variant="outline" asChild className="justify-start gap-3 h-12 border-amber-200 hover:bg-amber-50">
          <Link to="/suporte">
            <div className="h-8 w-8 rounded-lg bg-amber-100 flex items-center justify-center shrink-0">
              <LifeBuoy className="h-4 w-4 text-amber-600" />
            </div>
            Central de Ajuda (FAQs)
          </Link>
        </Button>
      </CardContent>
    </Card>
  );

  return (
    <TooltipProvider>
      <div className="space-y-6">
        <div className="flex flex-col gap-1">
          {getRoleBadge()}
          <div className="flex items-center justify-between">
            <div className="space-y-1">
              <h1 className="text-3xl font-bold tracking-tight">OlÃ¡, {firstName}!</h1>
              <p className="text-sm text-muted-foreground flex items-center gap-1.5">
                <Mail className="h-3.5 w-3.5" />
                {user?.email}
              </p>
            </div>
            <Button 
              variant="ghost" 
              size="sm" 
              className="text-muted-foreground gap-2" 
              onClick={() => fetchProfile(true)}
              disabled={isRefreshing}
            >
              {isRefreshing ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
              <span className="hidden sm:inline">Atualizar Painel</span>
            </Button>
          </div>
          <p className="text-muted-foreground max-w-2xl mt-2">
            {isProfessional 
              ? "Gerencie seu perfil profissional, acompanhe suas verificaÃ§Ãµes e acesse conteÃºdos educativos para impulsionar sua carreira no HomeCare Match."
              : isCompany
              ? "Encontre os melhores profissionais para sua escala de atendimento, gerencie seus contatos salvos e acompanhe suas interaÃ§Ãµes recentes."
              : "Encontre profissionais verificados para o seu familiar, acompanhe seus contatos e mantenha as informaÃ§Ãµes do paciente sempre atualizadas."
            }
          </p>
        </div>

        {isProfessional && trial?.isExpired && !profile?.coupon_days && (
          <Card className="border-destructive/50 bg-destructive/5 animate-pulse">
            <CardContent className="pt-6">
              <div className="flex items-start gap-4">
                <div className="h-12 w-12 rounded-full bg-destructive/10 flex items-center justify-center shrink-0">
                  <EyeOff className="h-6 w-6 text-destructive" />
                </div>
                <div className="space-y-3 flex-1">
                  <h3 className="font-bold text-destructive text-lg">Seu perfil estÃ¡ OCULTO nas buscas!</h3>
                  <p className="text-sm text-muted-foreground leading-relaxed">
                    Seu perÃ­odo de teste gratuito chegou ao fim. Para continuar visÃ­vel para empresas e famÃ­lias, escolha um plano.
                  </p>
                  <div className="flex flex-wrap gap-3">
                    <Button 
                      onClick={() => setIsPlanModalOpen(true)} 
                      className="gap-2 bg-destructive hover:bg-destructive/90 text-white shadow-lg"
                    >
                      <CreditCard className="h-4 w-4" />
                      Escolher Plano Agora
                    </Button>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {!completeness.isComplete && (
          <Card className="border-primary/20 bg-primary/5">
            <CardContent className="pt-6">
              <div className="flex items-start gap-4">
                <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                  <AlertCircle className="h-6 w-6 text-primary" />
                </div>
                <div className="space-y-3 flex-1">
                  <h3 className="font-semibold text-primary">Perfil Incompleto</h3>
                  <p className="text-sm text-muted-foreground">
                    Complete: <span className="font-medium">{completeness.missingFields.join(", ")}</span>.
                  </p>
                  <div className="space-y-1">
                    <div className="flex justify-between text-xs mb-1">
                      <span>Progresso</span>
                      <span>{completeness.progress}%</span>
                    </div>
                    <Progress value={completeness.progress} className="h-2" />
                  </div>
                  <Button asChild size="sm" className="gap-2">
                    <Link to="/dashboard/perfil">Completar Agora <ArrowRight className="h-4 w-4" /></Link>
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        <div className="grid gap-6 md:grid-cols-2">
          <div className="space-y-6">
            {isProfessional && (
              <Card className="border-amber-400/30 shadow-md">
                <CardHeader className="pb-3">
                  <CardTitle className="text-base flex items-center gap-2"><Star className="h-4 w-4 text-amber-500" /> Gerenciar Assinatura</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="flex items-center justify-between mb-4">
                    <Badge variant="outline" className="capitalize text-base px-3 py-1">
                      {getPlanLabel(profile?.subscription_tier)}
                    </Badge>
                    {subStatus && (
                      <div className={cn("flex items-center gap-1.5 px-2 py-1 rounded text-xs font-medium", subStatus.bg, subStatus.color)}>
                        <subStatus.icon className="h-3.5 w-3.5" />
                        {subStatus.label}
                      </div>
                    )}
                  </div>
                  
                  {hasPaidPlan ? (
                    <div className="space-y-4">
                      {profile.coupon_days && (
                        <div className="bg-primary/5 border border-primary/10 rounded-xl p-4 space-y-3 animate-fade-in">
                          <div className="flex items-start gap-3">
                            <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                              <Gift className="h-4 w-4" />
                            </div>
                            <div className="space-y-1">
                              <p className="text-xs font-bold text-primary uppercase tracking-wider">BonificaÃ§Ã£o Ativa</p>
                              <p className="text-xs text-muted-foreground leading-relaxed">
                                Sua assinatura atual foi bonificada com <strong>{profile.coupon_days} dias</strong> atravÃ©s de um cupom de desconto.
                              </p>
                            </div>
                          </div>
                          <div className="pl-11">
                            <p className="text-[10px] text-muted-foreground leading-relaxed">
                              Ao tÃ©rmino deste perÃ­odo, vocÃª poderÃ¡ optar por renovar o plano mensal ou atualizar para o{" "}
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <span className="text-primary font-bold cursor-help underline decoration-dotted underline-offset-2">plano Anual</span>
                                </TooltipTrigger>
                                <TooltipContent className="max-w-xs p-4 space-y-2">
                                  <p className="font-bold text-xs uppercase tracking-wider border-b pb-1 mb-2">BenefÃ­cios do Plano Anual:</p>
                                  <ul className="space-y-1.5">
                                    {annualPlan?.features ? (
                                      annualPlan.features.map((f: string, i: number) => (
                                        <li key={i} className="flex items-center gap-2 text-[10px]">
                                          <CheckCircle2 className="h-3 w-3 text-success" /> {f}
                                        </li>
                                      ))
                                    ) : (
                                      <>
                                        <li className="flex items-center gap-2 text-[10px]"><CheckCircle2 className="h-3 w-3 text-success" /> Destaque no topo das buscas</li>
                                        <li className="flex items-center gap-2 text-[10px]"><CheckCircle2 className="h-3 w-3 text-success" /> Selo dourado de verificaÃ§Ã£o</li>
                                        <li className="flex items-center gap-2 text-[10px]"><CheckCircle2 className="h-3 w-3 text-success" /> Acesso grÃ¡tis aos cursos Academy</li>
                                        <li className="flex items-center gap-2 text-[10px]"><CheckCircle2 className="h-3 w-3 text-success" /> Suporte prioritÃ¡rio</li>
                                      </>
                                    )}
                                  </ul>
                                </TooltipContent>
                              </Tooltip>
                              {" "}e ganhar novos benefÃ­cios exclusivos.
                            </p>
                          </div>
                        </div>
                      )}

                      <div className="p-4 rounded-lg border bg-secondary/10 flex flex-col gap-1">
                        <div className="flex items-center justify-between mb-1">
                          <p className="text-xs text-muted-foreground font-medium uppercase tracking-wider">
                            {subStatus?.dateLabel || "Data"}
                          </p>
                          {!profile.coupon_days && (
                            <Button 
                              variant="ghost" 
                              size="sm" 
                              className="h-6 text-[10px] gap-1 text-primary hover:bg-primary/10"
                              onClick={handleSyncBilling}
                              disabled={isSyncingBilling}
                            >
                              {isSyncingBilling ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
                              Sincronizar Agora
                            </Button>
                          )}
                        </div>
                        <div className="flex items-center gap-2">
                          <Calendar className="h-4 w-4 text-primary" />
                          <span className="text-sm font-bold text-foreground">
                            {profile.subscription_end_at 
                              ? format(parseISO(profile.subscription_end_at), "dd/MM/yyyy", { locale: ptBR })
                              : "Aguardando sistema..."
                            }
                          </span>
                        </div>
                        {!profile.subscription_end_at && (
                          <p className="text-[10px] text-muted-foreground mt-1 italic">
                            Clique em sincronizar se vocÃª jÃ¡ realizou o pagamento.
                          </p>
                        )}
                        {profile.cancel_at_period_end && !profile.coupon_days && (
                          <p className="text-[10px] text-amber-600 mt-1 font-medium">
                            Sua assinatura nÃ£o serÃ¡ renovada automaticamente.
                          </p>
                        )}
                      </div>

                      {!profile.coupon_days && (
                        <Button 
                          variant="outline" 
                          size="sm" 
                          className="w-full gap-2 h-10" 
                          onClick={handleManageBilling}
                          disabled={isManagingBilling}
                        >
                          {isManagingBilling ? <Loader2 className="h-4 w-4 animate-spin" /> : <CreditCard className="h-4 w-4" />}
                          Gerenciar Assinatura
                        </Button>
                      )}
                    </div>
                  ) : trial && (
                    <div className="space-y-3">
                      <div className="flex justify-between text-xs mb-1">
                        <span className="text-muted-foreground">PerÃ­odo de Teste</span>
                        <span className={cn("font-medium", trial.daysRemaining <= 5 ? "text-destructive" : "text-primary")}>
                          {trial.daysRemaining} dias restantes
                        </span>
                      </div>
                      <Progress value={trial.progress} className="h-2" />
                      
                      <p className="text-[10px] text-muted-foreground italic text-center pt-1">
                        Expira em: <strong>{format(trial.endDate, "dd/MM/yyyy")}</strong>
                      </p>
                      
                      <Button 
                        size="sm" 
                        className="w-full mt-2" 
                        variant={trial.isExpired ? "default" : "outline"}
                        onClick={() => setIsPlanModalOpen(true)}
                      >
                        Assinar Agora
                      </Button>
                    </div>
                  )}
                </CardContent>
              </Card>
            )}

            {isProfessional && referralStats && (
              <Card className="border-primary/20 bg-gradient-to-br from-primary/5 to-transparent">
                <CardHeader className="pb-3">
                  <CardTitle className="text-base flex items-center gap-2">
                    <Award className="h-4 w-4 text-primary" /> 
                    NÃ­vel de Embaixador
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="flex items-center justify-between mb-4">
                    <div className="space-y-1">
                      <p className="text-xs text-muted-foreground uppercase font-bold tracking-wider">Selo Atual</p>
                      <Badge className="bg-primary text-white text-sm px-3 py-1">
                        {referralStats.currentTier?.badge_label || "NÃ­vel Inicial"}
                      </Badge>
                    </div>
                    <div className="text-right">
                      <p className="text-xs text-muted-foreground uppercase font-bold tracking-wider">IndicaÃ§Ãµes</p>
                      <p className="text-2xl font-bold text-primary">{referralStats.count}</p>
                    </div>
                  </div>
                  
                  {referralStats.nextTier && (
                    <div className="space-y-2">
                      <div className="flex justify-between text-[10px] font-medium">
                        <span className="text-muted-foreground">Progresso para {referralStats.nextTier.badge_label}</span>
                        <span>{referralStats.count} / {referralStats.nextTier.threshold}</span>
                      </div>
                      <Progress 
                        value={(referralStats.count / referralStats.nextTier.threshold) * 100} 
                        className="h-1.5" 
                      />
                      <p className="text-[10px] text-muted-foreground italic text-center">
                        Faltam {referralStats.nextTier.threshold - referralStats.count} indicaÃ§Ãµes para o prÃ³ximo selo.
                      </p>
                    </div>
                  )}
                  
                  <Button asChild variant="link" size="sm" className="w-full mt-2 text-primary h-auto p-0">
                    <Link to="/dashboard/indicacoes" className="gap-1">
                      Ver detalhes do programa <ArrowRight className="h-3 w-3" />
                    </Link>
                  </Button>
                </CardContent>
              </Card>
            )}

            {(!isProfessional && !isCompany && !isFamily) && (
              <Card className="h-fit">
                <CardHeader>
                  <CardTitle className="text-base">Busca de Profissionais</CardTitle>
                  <CardDescription>Encontre o profissional ideal para sua necessidade.</CardDescription>
                </CardHeader>
                <CardContent>
                  <Button asChild className="w-full gap-2">
                    <Link to="/buscar">Ir para a Busca <ArrowRight className="h-4 w-4" /></Link>
                  </Button>
                </CardContent>
              </Card>
            )}

            {isCompany && companyPatients.length > 0 && (
              <div className="space-y-6">
                <div className="flex items-center justify-between">
                  <h2 className="text-xl font-bold tracking-tight flex items-center gap-2">
                    <Users className="h-5 w-5 text-primary" />
                    Pacientes Recentes
                  </h2>
                </div>

                {/* Exibe atÃ© 4 pacientes em grid 2x2 no resumo do dashboard */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {companyPatients.slice(0, 4).map((patient) => (
                    <Card key={patient.id} className="border-primary/10">
                      <CardContent className="p-4 flex items-center justify-between gap-3">
                        <div className="space-y-1">
                          <p className="text-[11px] uppercase tracking-wider text-muted-foreground font-semibold">ID do Paciente</p>
                          <p className="text-xl font-bold text-foreground">{getPatientCode(patient)}</p>
                        </div>
                        <Button asChild size="sm" variant="outline" className="gap-1">
                          <Link to={`/dashboard/pacientes?edit=${patient.id}`}>
                            <Edit2 className="h-3.5 w-3.5" />
                            Editar
                          </Link>
                        </Button>
                      </CardContent>
                    </Card>
                  ))}
                </div>

                <Button asChild variant="outline" className="w-full gap-2">
                  <Link to="/dashboard/pacientes">
                    Ver todos os pacientes ({companyPatients.length})
                    <ArrowRight className="h-4 w-4" />
                  </Link>
                </Button>
              </div>
            )}

            {isFamily && (
              <div className="space-y-6">
                <Card className="border-amber-300/40 bg-amber-50/30">
                  <CardHeader className="pb-3">
                    <CardTitle className="text-base flex items-center gap-2">
                      <Home className="h-4 w-4 text-amber-600" />
                      Resumo do Paciente
                    </CardTitle>
                    <CardDescription>Esses dados sÃ£o usados para encontrar profissionais compatÃ­veis.</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="grid gap-3 sm:grid-cols-2">
                      <div className="rounded-lg border bg-background/70 p-3">
                        <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">Paciente</p>
                        <p className="text-sm font-semibold mt-1">{profile?.patient_name || "NÃ£o informado"}</p>
                      </div>
                      <div className="rounded-lg border bg-background/70 p-3">
                        <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">Idade</p>
                        <p className="text-sm font-semibold mt-1">{profile?.patient_age || "NÃ£o informado"}</p>
                      </div>
                    </div>
                    <div className="rounded-lg border bg-background/70 p-3">
                      <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">CondiÃ§Ã£o MÃ©dica</p>
                      <p className="text-sm mt-1 leading-relaxed">{familyMedicalSummary}</p>
                    </div>
                    <div className="space-y-2">
                      <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">Disponibilidade</p>
                      {familyAvailability.length > 0 ? (
                        <div className="flex flex-wrap gap-2">
                          {familyAvailability.slice(0, 4).map((slot: string) => (
                            <Badge key={slot} variant="outline" className="bg-background/80 text-[11px]">
                              {slot}
                            </Badge>
                          ))}
                          {familyAvailability.length > 4 && (
                            <Badge variant="outline" className="bg-background/80 text-[11px]">
                              +{familyAvailability.length - 4}
                            </Badge>
                          )}
                        </div>
                      ) : (
                        <p className="text-xs text-muted-foreground">Nenhuma disponibilidade cadastrada.</p>
                      )}
                    </div>
                    <Button asChild variant="outline" className="w-full gap-2">
                      <Link to="/dashboard/perfil">
                        Editar informaÃ§Ãµes do paciente
                        <Edit2 className="h-4 w-4" />
                      </Link>
                    </Button>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-base flex items-center gap-2">
                      <Users className="h-4 w-4 text-primary" />
                      AÃ§Ãµes rÃ¡pidas da famÃ­lia
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-2">
                    <Button asChild className="w-full gap-2">
                      <Link to="/buscar">
                        Buscar profissionais agora
                        <ArrowRight className="h-4 w-4" />
                      </Link>
                    </Button>
                    <Button asChild variant="outline" className="w-full gap-2">
                      <Link to="/dashboard/contatos">
                        Ver contatos salvos
                        <ArrowRight className="h-4 w-4" />
                      </Link>
                    </Button>
                    <Button asChild variant="outline" className="w-full gap-2">
                      <Link to="/dashboard/suporte">
                        Abrir suporte
                        <ArrowRight className="h-4 w-4" />
                      </Link>
                    </Button>
                  </CardContent>
                </Card>
              </div>
            )}

            {(!isProfessional && !isCompany && !isFamily) && QuickAccessCard}
          </div>

          <div className="space-y-6">
            {isProfessional && QuickAccessCard}

            {isProfessional && (
              <Card className="h-fit">
                <CardHeader>
                  <CardTitle className="text-base">Busca de Profissionais</CardTitle>
                  <CardDescription>Encontre o profissional ideal para sua necessidade.</CardDescription>
                </CardHeader>
                <CardContent>
                  <Button asChild className="w-full gap-2">
                    <Link to="/buscar">Ir para a Busca <ArrowRight className="h-4 w-4" /></Link>
                  </Button>
                </CardContent>
              </Card>
            )}

            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2"><ShieldCheck className="h-4 w-4 text-primary" /> VerificaÃ§Ã£o de Perfil</CardTitle>
              </CardHeader>
              <CardContent>
                {profile?.is_verified ? (
                  <div className="flex items-center gap-3 text-success bg-success/5 p-4 rounded-lg border border-success/10">
                    <CheckCircle2 className="h-5 w-5" />
                    <div>
                      <p className="text-sm font-semibold">Perfil Verificado</p>
                      <p className="text-[10px] opacity-80">Selo de confianÃ§a ativo.</p>
                    </div>
                  </div>
                ) : profile?.rejection_reason ? (
                  <div className="space-y-3">
                    <div className="flex items-start gap-3 text-destructive bg-destructive/5 p-4 rounded-lg border border-destructive/10">
                      <AlertOctagon className="h-5 w-5 mt-0.5 shrink-0" />
                      <div>
                        <p className="text-sm font-semibold">Documentos Reprovados</p>
                        <p className="text-xs mt-1">{profile.rejection_reason}</p>
                      </div>
                    </div>
                    <Button variant="outline" size="sm" className="w-full gap-2" onClick={handleRetryVerification}>
                      <RotateCcw className="h-3 w-3" /> Reiniciar Processo
                    </Button>
                  </div>
                ) : profile?.verification_sent ? (
                  <div className="bg-primary/5 border border-primary/20 rounded-lg p-4 text-center">
                    <Clock className="h-8 w-8 text-primary mx-auto mb-2 animate-pulse" />
                    <div>
                      <p className="font-semibold text-primary">Documentos em AnÃ¡lise</p>
                      <p className="text-xs text-muted-foreground mt-1">Aguarde o retorno por e-mail em atÃ© 24 horas Ãºteis.</p>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-3">
                    <p className="text-xs text-muted-foreground">Envie seus documentos para ganhar o selo de verificado.</p>
                    <Button asChild variant="outline" size="sm" className="w-full">
                      <Link to="/dashboard/perfil">Enviar Documentos</Link>
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                  <PlayCircle className="h-4 w-4 text-primary" /> ConfiguraÃ§Ãµes do Tutorial
                </CardTitle>
                <CardDescription>Gerencie a exibiÃ§Ã£o do tutorial de boas-vindas.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <Button 
                  variant="outline" 
                  className="w-full gap-2" 
                  onClick={() => setIsOnboardingOpen(true)}
                >
                  <PlayCircle className="h-4 w-4" /> Rever Tutorial de Boas-vindas
                </Button>
                <div className="flex items-center justify-between rounded-lg border p-3">
                  <div className="space-y-0.5">
                    <Label>Exibir tutorial ao fazer login</Label>
                    <p className="text-[10px] text-muted-foreground">
                      Se desativado, o tutorial nÃ£o aparecerÃ¡ automaticamente.
                    </p>
                  </div>
                  <Switch
                    checked={!profile?.has_seen_onboarding}
                    onCheckedChange={handleToggleOnboardingVisibility}
                    disabled={isSavingOnboardingPref}
                  />
                </div>
              </CardContent>
            </Card>
          </div>
        </div>

        <PlanSelectionModal 
          open={isPlanModalOpen} 
          onOpenChange={setIsPlanModalOpen} 
        />

        <OnboardingModal open={isOnboardingOpen} onOpenChange={setIsOnboardingOpen} forceShow={true} role={profile?.role} />
      </div>
    </TooltipProvider>
  );
};

export default OverviewPage;


