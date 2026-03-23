"use client";

import { useState, useEffect, useRef, useCallback, useMemo } from "react";
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
  Edit2,
  ChevronDown
} from "lucide-react";
import { Link, useSearchParams } from "react-router-dom";
import { differenceInDays, addDays, parseISO, isValid, format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import OnboardingModal from "@/components/OnboardingModal";
import PlanSelectionModal from "@/components/PlanSelectionModal";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { AdminMessageAlert } from "@/components/dashboard/AdminMessageAlert";
import { useQuery } from "@tanstack/react-query";
import { Switch } from "@/components/ui/switch"; 
import { Label } from "@/components/ui/label";
import { navigateSafely } from "@/lib/safe-navigation";

const PLAN_DISPLAY_ORDER = ["free_trial", "monthly", "yearly", "annual"];
const getPlanDisplayPriority = (planId: string) => {
  const index = PLAN_DISPLAY_ORDER.indexOf(planId);
  return index === -1 ? Number.MAX_SAFE_INTEGER : index;
};

const normalizeFeatureKey = (value: string) =>
  String(value || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^\w\s]/g, "")
    .replace(/\s+/g, " ")
    .trim();

type PlanCatalogItem = {
  id: string;
  name: string | null;
  period: string | null;
  features: string[];
};

const isTransientNetworkError = (error: unknown) => {
  const message = String((error as any)?.message || "").toLowerCase();
  return (
    message.includes("networkerror") ||
    message.includes("failed to fetch") ||
    message.includes("fetch resource") ||
    message.includes("network request failed")
  );
};

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

const OverviewPage = () => {
  const { user } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const [profile, setProfile] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isManagingBilling, setIsManagingBilling] = useState(false);
  const [isPlanSelectionOpen, setIsPlanSelectionOpen] = useState(false);
  const [isOnboardingOpen, setIsOnboardingOpen] = useState(false);
  const [isPlanFeaturesOpen, setIsPlanFeaturesOpen] = useState(false);
  const [referralStats, setReferralStats] = useState<any>(null);
  const [isSavingOnboardingPref, setIsSavingOnboardingPref] = useState(false);
  const [companyPatients, setCompanyPatients] = useState<any[]>([]);

  const { data: planCatalog = [] } = useQuery<PlanCatalogItem[]>({
    queryKey: ["dashboard-plan-catalog"],
    queryFn: async () => {
      const { data } = await supabase
        .from("plans")
        .select("id, name, period, features")
        .in("id", ["free_trial", "monthly", "yearly", "annual"]);

      return (data || [])
        .map((plan) => ({
          id: String(plan.id || "").toLowerCase(),
          name: plan.name ? String(plan.name) : null,
          period: plan.period ? String(plan.period) : null,
          features: Array.isArray(plan.features)
            ? plan.features.map((feature) => String(feature || "").trim()).filter(Boolean)
            : String(plan.features || "")
                .split("\n")
                .map((feature) => feature.trim())
                .filter(Boolean),
        }))
        .filter((plan) => plan.id.length > 0);
    }
  });

  const fetchProfile = async (showToast = false) => {
    if (!user) return;
    if (showToast) setIsRefreshing(true);
    
    try {
      let data: any = null;
      let error: any = null;
      for (let attempt = 0; attempt < 2; attempt += 1) {
        const response = await supabase
          .from('profiles')
          .select('*')
          .eq('id', user.id)
          .single();
        data = response.data;
        error = response.error;
        if (!error) break;
        if (!isTransientNetworkError(error) || attempt === 1) break;
        await sleep(500);
      }
      
      if (error) throw error;

      setProfile(data);
      
      if ((data.role === 'professional' || data.role === 'company' || data.role === 'family') && !data.has_seen_onboarding && !isOnboardingOpen) {
        setIsOnboardingOpen(true);
      }

      if (data.role === 'professional') {
        const { data: stats } = await supabase.functions.invoke('referral-stats', {
          body: { referrerId: user.id, issueRewards: true }
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
      if (!isTransientNetworkError(err)) {
        console.error("[Overview] Erro ao carregar perfil:", err);
      }
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

  const handleManageBilling = async () => {
    setIsManagingBilling(true);
    try {
      const { data, error } = await supabase.functions.invoke('create-portal-session');
      if (error) throw error;
      if (data?.url) {
        const redirected = navigateSafely(data.url);
        if (!redirected) {
          throw new Error("URL de redirecionamento invalida.");
        }
      }
    } catch (err: any) {
      console.error(err);
      toast.error("Não foi possível acessar o portal de pagamentos.");
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
      requiredFields.experience = "Formações";
      requiredFields.bio = "Biografia";
    } else if (profile.role === 'company') {
      requiredFields.company_name = "Razão Social";
      requiredFields.cnpj = "CNPJ";
      requiredFields.bio = "Descrição da Empresa";
    } else if (profile.role === 'family') {
      requiredFields.patient_name = "Nome do Paciente";
      requiredFields.patient_age = "Idade do Paciente";
      requiredFields.patient_medical_conditions = "Condição Médica";
      requiredFields.bio = "Outras Observações";
      requiredFields.availability = "Horário de Atendimento";
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

  const getPlanDurationDays = (periodValue: string | null | undefined, fallbackDays: number) => {
    const period = String(periodValue || "").toLowerCase();
    if (!period) return fallbackDays;

    const numberMatch = period.match(/\d+/);
    const amount = numberMatch ? Number(numberMatch[0]) : 1;
    const safeAmount = Number.isFinite(amount) && amount > 0 ? amount : 1;

    if (period.includes("dia")) return safeAmount;
    if (period.includes("ano")) return safeAmount * 365;
    if (period.includes("mes") || period.includes("mês")) return safeAmount * 30;
    return fallbackDays;
  };

  const freeTrialDurationDays = useMemo(() => {
    const freeTrialPlan = planCatalog.find((plan) => plan.id === "free_trial");
    return getPlanDurationDays(freeTrialPlan?.period, 7);
  }, [planCatalog]);

  const getTrialInfo = () => {
    if (profile?.subscription_tier !== 'free_trial' || !profile?.trial_started_at || profile?.cancel_at_period_end) return null;
    const start = parseISO(profile.trial_started_at);
    const startDate = isValid(start) ? start : new Date(profile.trial_started_at);
    const endDate = addDays(startDate, freeTrialDurationDays);
    const rawDaysRemaining = differenceInDays(endDate, new Date());
    const daysRemaining = Math.max(0, rawDaysRemaining);
    const progress = Math.min(100, Math.max(0, ((freeTrialDurationDays - daysRemaining) / freeTrialDurationDays) * 100));
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
      toast.success("Agora você pode reenviar seus documentos na seção Meus Dados.");
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
      toast.success("Preferência de tutorial salva!");
    } catch (err) {
      toast.error("Erro ao salvar preferência.");
    } finally {
      setIsSavingOnboardingPref(false);
    }
  };

  const getRoleBadge = () => {
    if (!profile?.role) return null;
    
    const roles: Record<string, { label: string, icon: any, color: string }> = {
      professional: { label: "Profissional", icon: User, color: "bg-primary/10 text-primary border-primary/20" },
      company: { label: "Empresa", icon: Building2, color: "bg-success/10 text-success border-success/20" },
      family: { label: "Família", icon: Home, color: "bg-amber-100 text-amber-700 border-amber-200" },
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
        description: "Aguardando sincronização...",
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
        description: "Período de acesso garantido.",
        icon: Ticket,
        color: "text-primary",
        bg: "bg-primary/5 border-primary/20",
        dateLabel: "Válido até"
      };
    }

    return {
      label: "Ativa",
      description: "Renovação automática.",
      icon: CheckCircle2,
      color: "text-green-600",
      bg: "bg-green-50 border-green-200",
      dateLabel: "Próxima renovação"
    };
  };

  const getRenewalAlert = () => {
    if (!profile?.subscription_tier || !profile?.subscription_end_at) return null;
    if (!["monthly", "yearly"].includes(profile.subscription_tier)) return null;

    const endDate = parseISO(profile.subscription_end_at);
    if (!isValid(endDate)) return null;

    const daysRemaining = differenceInDays(endDate, new Date());
    if (daysRemaining < 0 || daysRemaining > 7) return null;

    if (profile.subscription_tier === "monthly") {
      return {
        title: daysRemaining === 0 ? "Renovação automática hoje" : "Renovação automática próxima",
        description:
          daysRemaining === 0
            ? "Seu plano mensal renova automaticamente hoje. Verifique seu cartão para evitar interrupção."
            : `Seu plano mensal renova automaticamente em ${daysRemaining} dia(s). Verifique seu cartão para evitar interrupção.`,
      };
    }

    return {
      title: daysRemaining === 0 ? "Plano anual vence hoje" : "Plano anual perto do vencimento",
      description:
        daysRemaining === 0
          ? "Seu plano anual vence hoje. A renovação é manual e pode ser feita com parcelamento em até 12x."
          : `Seu plano anual vence em ${daysRemaining} dia(s). A renovação é manual e pode ser feita com parcelamento em até 12x.`,
    };
  };

  const completeness = getProfileCompleteness();
  const trial = getTrialInfo();
  const isProfessional = profile?.role === 'professional';
  const isCompany = profile?.role === 'company';
  const isFamily = profile?.role === 'family';
  const isAdmin = profile?.is_admin || profile?.role === 'admin';
  const firstName = profile?.full_name?.split(' ')[0] || "Usuário";
  
  const hasPaidPlan = (profile?.subscription_tier && profile?.subscription_tier !== 'free_trial') || profile?.coupon_days;
  const subStatus = getSubscriptionStatus();
  const renewalAlert = getRenewalAlert();

  const getPlanLabel = (tier?: string | null) => {
    if (!tier) return 'Nenhum plano definido';
    if (tier === 'monthly') return 'Plano Mensal';
    if (tier === 'yearly') return 'Plano Anual';
    if (tier === 'annual') return 'Plano Anual';
    if (tier === 'free_trial') return `Período de ${freeTrialDurationDays} dias Gratuitos`;
    return tier;
  };

  const subscriptionEndDate = profile?.subscription_end_at ? parseISO(profile.subscription_end_at) : null;
  const isExpiredSubscriptionEnd = !!subscriptionEndDate && isValid(subscriptionEndDate) && subscriptionEndDate < new Date();
  const showNoPlanLabel =
    !!profile?.cancel_at_period_end &&
    isExpiredSubscriptionEnd &&
    !['monthly', 'yearly', 'annual'].includes(String(profile?.subscription_tier || '').toLowerCase());
  const displayedPlanLabel = showNoPlanLabel ? 'Nenhum plano definido' : getPlanLabel(profile?.subscription_tier);
  const currentPlanId = showNoPlanLabel
    ? "no_plan"
    : String(profile?.subscription_tier || "no_plan").toLowerCase();
  const normalizedCurrentPlanId = currentPlanId === "annual" ? "yearly" : currentPlanId;

  const annualPlanFeatures = useMemo(() => {
    const yearlyVariants = planCatalog.filter((plan) => plan.id === "yearly" || plan.id === "annual");
    const seen = new Set<string>();
    const features: string[] = [];
    for (const plan of yearlyVariants) {
      for (const feature of plan.features || []) {
        const normalized = normalizeFeatureKey(feature);
        if (!normalized || seen.has(normalized)) continue;
        seen.add(normalized);
        features.push(feature);
      }
    }
    return features;
  }, [planCatalog]);

  const planFeatureMatrix = useMemo(() => {
    const normalizedCatalog = [...planCatalog]
      .map((plan) => ({
        ...plan,
        id: String(plan.id || "").toLowerCase(),
        features: (plan.features || []).map((feature) => String(feature || "").trim()).filter(Boolean),
      }))
      .sort((a, b) => {
        const priorityDiff = getPlanDisplayPriority(a.id) - getPlanDisplayPriority(b.id);
        if (priorityDiff !== 0) return priorityDiff;
        return String(a.name || a.id).localeCompare(String(b.name || b.id), "pt-BR");
      });

    const uniqueFeatures = (features: string[]) => {
      const seen = new Set<string>();
      const deduped: string[] = [];
      for (const feature of features) {
        const normalized = normalizeFeatureKey(feature);
        if (!normalized || seen.has(normalized)) continue;
        seen.add(normalized);
        deduped.push(feature);
      }
      return deduped;
    };

    const getPlanFeatures = (planId: string) => {
      const aliases = planId === "yearly" ? ["yearly", "annual"] : [planId];
      const features: string[] = [];
      for (const plan of normalizedCatalog) {
        if (aliases.includes(plan.id)) {
          features.push(...plan.features);
        }
      }
      return uniqueFeatures(features);
    };

    const annualFeatures = getPlanFeatures("yearly");
    const monthlyFeatures = getPlanFeatures("monthly");
    const activeFeatures = getPlanFeatures(normalizedCurrentPlanId);
    const activeFeatureKeys = new Set(activeFeatures.map((feature) => normalizeFeatureKey(feature)));

    if (normalizedCurrentPlanId === "yearly") {
      return activeFeatures.map((feature) => ({ label: feature, available: true }));
    }

    if (normalizedCurrentPlanId === "monthly") {
      const baseList = annualFeatures.length > 0 ? annualFeatures : monthlyFeatures;
      const seen = new Set(baseList.map((feature) => normalizeFeatureKey(feature)));
      const monthlyExtras = monthlyFeatures.filter((feature) => !seen.has(normalizeFeatureKey(feature)));
      const comparisonList = [...baseList, ...monthlyExtras].filter(
        (feature) => normalizeFeatureKey(feature) !== normalizeFeatureKey("Tudo do plano Mensal"),
      );

      const rows = comparisonList.map((feature) => ({
        label: feature,
        available: activeFeatureKeys.has(normalizeFeatureKey(feature)),
      }));

      return [
        ...rows.filter((row) => row.available),
        ...rows.filter((row) => !row.available),
      ];
    }

    if (normalizedCurrentPlanId === "free_trial") {
      const baseList = annualFeatures.length > 0 ? annualFeatures : activeFeatures;
      const seen = new Set(baseList.map((feature) => normalizeFeatureKey(feature)));
      const freeExtras = activeFeatures.filter((feature) => !seen.has(normalizeFeatureKey(feature)));
      return [...baseList, ...freeExtras].map((feature) => ({
        label: feature,
        available: activeFeatureKeys.has(normalizeFeatureKey(feature)),
      }));
    }

    const fallbackBase = annualFeatures.length > 0 ? annualFeatures : activeFeatures;
    return fallbackBase.map((feature) => ({
      label: feature,
      available: activeFeatureKeys.has(normalizeFeatureKey(feature)),
    }));
  }, [planCatalog, normalizedCurrentPlanId]);

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
    : "Não informado";

  const QuickAccessCard = (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base">Acesso Rápido</CardTitle>
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
              Ver Perfil Público
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
            Histórico de Contatos
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

  const CompanyQuickActionsCard = (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <Building2 className="h-4 w-4 text-primary" />
          Ações rápidas da empresa
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
          <Link to="/dashboard/pacientes">
            Gerenciar pacientes
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
  );

  const FamilyQuickActionsCard = (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <Users className="h-4 w-4 text-primary" />
          Ações rápidas da família
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
  );

  const FamilyPatientSummaryCard = (
    <Card className="border-amber-300/40 bg-amber-50/30">
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <Home className="h-4 w-4 text-amber-600" />
          Resumo do Paciente
        </CardTitle>
        <CardDescription>Esses dados são usados para encontrar profissionais compatíveis.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="rounded-lg border bg-background/70 p-3">
            <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">Paciente</p>
            <p className="text-sm font-semibold mt-1">{profile?.patient_name || "Não informado"}</p>
          </div>
          <div className="rounded-lg border bg-background/70 p-3">
            <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">Idade</p>
            <p className="text-sm font-semibold mt-1">{profile?.patient_age || "Não informado"}</p>
          </div>
        </div>
        <div className="rounded-lg border bg-background/70 p-3">
          <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">Condição Médica</p>
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
            Editar informações do paciente
            <Edit2 className="h-4 w-4" />
          </Link>
        </Button>
      </CardContent>
    </Card>
  );

  const CompanyRecentPatientsCard = (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <Users className="h-4 w-4 text-primary" />
          Pacientes Recentes
        </CardTitle>
        <CardDescription>Acompanhe os últimos pacientes cadastrados pela sua empresa.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {companyPatients.length > 0 ? (
          <>
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
          </>
        ) : (
          <>
            <p className="text-sm text-muted-foreground">Nenhum paciente visível cadastrado ainda.</p>
            <Button asChild variant="outline" className="w-full gap-2">
              <Link to="/dashboard/pacientes">
                Cadastrar primeiro paciente
                <ArrowRight className="h-4 w-4" />
              </Link>
            </Button>
          </>
        )}
      </CardContent>
    </Card>
  );

  const VerificationCard = (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2"><ShieldCheck className="h-4 w-4 text-primary" /> Verificação de Perfil</CardTitle>
      </CardHeader>
      <CardContent>
        {profile?.is_verified ? (
          <div className="flex items-center gap-3 text-success bg-success/5 p-4 rounded-lg border border-success/10">
            <CheckCircle2 className="h-5 w-5" />
            <div>
              <p className="text-sm font-semibold">Perfil Verificado</p>
              <p className="text-[10px] opacity-80">Selo de confiança ativo.</p>
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
              <p className="font-semibold text-primary">Documentos em Análise</p>
              <p className="text-xs text-muted-foreground mt-1">Aguarde o retorno por e-mail em até 24 horas úteis.</p>
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
  );

  return (
    <TooltipProvider>
      <div className="space-y-6">
        <div className="flex flex-col gap-1">
          <AdminMessageAlert />
          {getRoleBadge()}
          <div className="flex items-center justify-between">
            <div className="space-y-1">
              <h1 className="text-3xl font-bold tracking-tight">Olá, {firstName}!</h1>
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
              ? "Gerencie seu perfil profissional, acompanhe suas verificações e acesse conteúdos educativos para impulsionar sua carreira no HomeCare Match."
              : isCompany
              ? "Encontre os melhores profissionais para sua escala de atendimento, gerencie seus contatos salvos e acompanhe suas interações recentes."
              : "Encontre profissionais verificados para o seu familiar, acompanhe seus contatos e mantenha as informações do paciente sempre atualizadas."
            }
          </p>
        </div>

        {renewalAlert && (
          <Card className="border-amber-300/40 bg-amber-50/40">
            <CardContent className="pt-6">
              <div className="flex items-start gap-3">
                <AlertCircle className="h-5 w-5 text-amber-600 shrink-0 mt-0.5" />
                <div className="space-y-1">
                  <p className="font-semibold text-amber-900">{renewalAlert.title}</p>
                  <p className="text-sm text-amber-800">{renewalAlert.description}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {isProfessional && trial?.isExpired && !profile?.coupon_days && (
          <Card className="border-destructive/50 bg-destructive/5 animate-pulse">
            <CardContent className="pt-6">
              <div className="flex items-start gap-4">
                <div className="h-12 w-12 rounded-full bg-destructive/10 flex items-center justify-center shrink-0">
                  <EyeOff className="h-6 w-6 text-destructive" />
                </div>
                <div className="space-y-3 flex-1">
                  <h3 className="font-bold text-destructive text-lg">Seu perfil está OCULTO nas buscas!</h3>
                  <p className="text-sm text-muted-foreground leading-relaxed">
                    Seu período de teste gratuito chegou ao fim. Para continuar visível para empresas e famílias, escolha um plano.
                  </p>
                  <div className="flex flex-wrap gap-3">
                    <Button 
                      onClick={() => navigateSafely("/#planos")}
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

        {isProfessional && showNoPlanLabel && (
          <Card className="border-destructive/50 bg-destructive/5">
            <CardContent className="pt-6">
              <div className="flex items-start gap-4">
                <div className="h-12 w-12 rounded-full bg-destructive/10 flex items-center justify-center shrink-0">
                  <EyeOff className="h-6 w-6 text-destructive" />
                </div>
                <div className="space-y-3 flex-1">
                  <h3 className="font-bold text-destructive text-lg">Seu perfil não está visível nas buscas</h3>
                  <p className="text-sm text-muted-foreground leading-relaxed">
                    Seu perfil está oculto porque não existe um plano ativo no momento. Assine um plano para voltar a aparecer para empresas e famílias.
                  </p>
                  <div className="flex flex-wrap gap-3">
                    <Button
                      onClick={() => setIsPlanSelectionOpen(true)}
                      className="gap-2 bg-destructive hover:bg-destructive/90 text-white shadow-lg"
                    >
                      <CreditCard className="h-4 w-4" />
                      Assinar Agora
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
            {isProfessional && QuickAccessCard}
            {isCompany && CompanyQuickActionsCard}
            {isCompany && VerificationCard}
            {isFamily && FamilyQuickActionsCard}

            {isProfessional && (
              <Card className="border-amber-400/30 shadow-md">
                <CardHeader className="pb-3">
                  <CardTitle className="text-base flex items-center gap-2"><Star className="h-4 w-4 text-amber-500" /> Gerenciar Assinatura</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="flex items-center justify-between mb-4">
                    <Badge variant="outline" className="capitalize text-base px-3 py-1">
                      {displayedPlanLabel}
                    </Badge>
                    {subStatus && (
                      <div className={cn("flex items-center gap-1.5 px-2 py-1 rounded text-xs font-medium", subStatus.bg, subStatus.color)}>
                        <subStatus.icon className="h-3.5 w-3.5" />
                        {subStatus.label}
                      </div>
                    )}
                  </div>

                  <div className="mb-4 rounded-xl border border-border/70 bg-background/70 p-4">
                    <div className="mb-3 flex items-center justify-between gap-2">
                      <p className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
                        Funções do seu plano
                      </p>
                      <Badge variant="secondary" className="hidden text-[10px] sm:inline-flex">
                        {displayedPlanLabel}
                      </Badge>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => setIsPlanFeaturesOpen((prev) => !prev)}
                        className="h-7 gap-1 px-2 text-[11px] sm:hidden"
                      >
                        {isPlanFeaturesOpen ? "Ocultar" : "Ver funções"}
                        <ChevronDown className={cn("h-3.5 w-3.5 transition-transform", isPlanFeaturesOpen && "rotate-180")} />
                      </Button>
                    </div>
                    <Badge variant="secondary" className="mb-3 text-[10px] sm:hidden">
                      {displayedPlanLabel}
                    </Badge>
                    <div className={cn("space-y-2", !isPlanFeaturesOpen && "hidden sm:block")}>
                      {planFeatureMatrix.length > 0 ? (
                        planFeatureMatrix.map((feature) => (
                          <div
                            key={feature.label}
                            className={cn(
                              "flex items-center justify-between rounded-lg border px-3 py-2",
                              feature.available
                                ? "border-emerald-200 bg-emerald-50/70"
                                : "border-slate-200 bg-slate-50/80",
                            )}
                          >
                            <div className="flex items-center gap-2">
                              {feature.available ? (
                                <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                              ) : (
                                <XCircle className="h-4 w-4 text-slate-400" />
                              )}
                              <span className={cn("text-xs", feature.available ? "text-emerald-900" : "text-slate-600")}>
                                {feature.label}
                              </span>
                            </div>
                            <Badge
                              variant="outline"
                              className={cn(
                                "text-[10px]",
                                feature.available
                                  ? "border-emerald-300 text-emerald-700"
                                  : "border-slate-300 text-slate-500",
                              )}
                            >
                              {feature.available ? "Disponível" : "Indisponível"}
                            </Badge>
                          </div>
                        ))
                      ) : (
                        <p className="text-xs text-muted-foreground">
                          Recursos do plano ainda não configurados em <strong>/admin/planos</strong>.
                        </p>
                      )}
                    </div>
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
                              <p className="text-xs font-bold text-primary uppercase tracking-wider">Bonificação Ativa</p>
                              <p className="text-xs text-muted-foreground leading-relaxed">
                                Sua assinatura atual foi bonificada com <strong>{profile.coupon_days} dias</strong> através de um cupom de desconto.
                              </p>
                            </div>
                          </div>
                          <div className="pl-11">
                            <p className="text-[10px] text-muted-foreground leading-relaxed">
                              Ao término deste período, você poderá optar por renovar o plano mensal ou atualizar para o{" "}
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <span className="text-primary font-bold cursor-help underline decoration-dotted underline-offset-2">plano Anual</span>
                                </TooltipTrigger>
                                <TooltipContent className="max-w-xs p-4 space-y-2">
                                  <p className="font-bold text-xs uppercase tracking-wider border-b pb-1 mb-2">Benefícios do Plano Anual:</p>
                                  <ul className="space-y-1.5">
                                    {annualPlanFeatures.length > 0 ? (
                                      annualPlanFeatures.map((f: string, i: number) => (
                                        <li key={i} className="flex items-center gap-2 text-[10px]">
                                          <CheckCircle2 className="h-3 w-3 text-success" /> {f}
                                        </li>
                                      ))
                                    ) : (
                                      <li className="flex items-center gap-2 text-[10px] text-muted-foreground">
                                        Recursos do plano anual não configurados.
                                      </li>
                                    )}
                                  </ul>
                                </TooltipContent>
                              </Tooltip>
                              {" "}e ganhar novos benefícios exclusivos.
                            </p>
                          </div>
                        </div>
                      )}

                      <div className="p-4 rounded-lg border bg-secondary/10 flex flex-col gap-1">
                        <div className="flex items-center justify-between mb-1">
                          <p className="text-xs text-muted-foreground font-medium uppercase tracking-wider">
                            {subStatus?.dateLabel || "Data"}
                          </p>
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
                            Aguardando confirmação automática do pagamento.
                          </p>
                        )}
                        {profile.cancel_at_period_end && !profile.coupon_days && (
                          <p className="text-[10px] text-amber-600 mt-1 font-medium">
                            Sua assinatura não será renovada automaticamente.
                          </p>
                        )}
                        {!profile.cancel_at_period_end && profile.subscription_tier === "monthly" && !profile.coupon_days && (
                          <p className="text-[10px] text-green-700 mt-1 font-medium">
                            Sua assinatura mensal está com renovação automática ativa.
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
                  ) : trial ? (
                    <div className="space-y-3">
                      <div className="flex justify-between text-xs mb-1">
                        <span className="text-muted-foreground">Período de Teste</span>
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
                        onClick={() => setIsPlanSelectionOpen(true)}
                      >
                        Assinar Agora
                      </Button>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      <p className="text-sm text-muted-foreground">
                        Você não possui um plano ativo no momento.
                      </p>
                      <Button
                        size="sm"
                        className="w-full"
                        onClick={() => setIsPlanSelectionOpen(true)}
                      >
                        Assinar Agora
                      </Button>
                    </div>
                  )}
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

            {(!isProfessional && !isCompany && !isFamily) && QuickAccessCard}
          </div>

          <div className="space-y-6">
            {!isCompany && VerificationCard}

            {isCompany && CompanyRecentPatientsCard}
            {isFamily && FamilyPatientSummaryCard}

            {isProfessional && referralStats && (
              <Card className="border-primary/20 bg-gradient-to-br from-primary/5 to-transparent">
                <CardHeader className="pb-3">
                  <CardTitle className="text-base flex items-center gap-2">
                    <Award className="h-4 w-4 text-primary" /> 
                    Nível de Embaixador
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="flex items-center justify-between mb-4">
                    <div className="space-y-1">
                      <p className="text-xs text-muted-foreground uppercase font-bold tracking-wider">Selo Atual</p>
                      <Badge className="bg-primary text-white text-sm px-3 py-1">
                        {referralStats.currentTier?.badge_label || "Nível Inicial"}
                      </Badge>
                    </div>
                    <div className="text-right">
                      <p className="text-xs text-muted-foreground uppercase font-bold tracking-wider">Indicações</p>
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
                        Faltam {referralStats.nextTier.threshold - referralStats.count} indicações para o próximo selo.
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

            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                  <PlayCircle className="h-4 w-4 text-primary" /> Configurações do Tutorial
                </CardTitle>
                <CardDescription>Gerencie a exibição do tutorial de boas-vindas.</CardDescription>
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
                      Se desativado, o tutorial não aparecerá automaticamente.
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

        <OnboardingModal open={isOnboardingOpen} onOpenChange={setIsOnboardingOpen} forceShow={true} role={profile?.role} />
        <PlanSelectionModal open={isPlanSelectionOpen} onOpenChange={setIsPlanSelectionOpen} />
      </div>
    </TooltipProvider>
  );
};

export default OverviewPage;



