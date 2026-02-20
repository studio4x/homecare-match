"use client";

import { useState, useEffect } from "react";
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
  TrendingUp,
  Ticket,
  Gift,
  Info
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

const OverviewPage = () => {
  const { user } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const [profile, setProfile] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isSyncingStripe, setIsSyncingStripe] = useState(false);
  const [isManagingBilling, setIsManagingBilling] = useState(false);
  const [isPlanModalOpen, setIsPlanModalOpen] = useState(false);
  const [isOnboardingOpen, setIsOnboardingOpen] = useState(false);
  const [referralStats, setReferralStats] = useState<any>(null);

  // Busca detalhes do plano anual para o tooltip
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
      
      // Dispara onboarding se for profissional ou empresa e ainda não viu
      if ((data.role === 'professional' || data.role === 'company' || data.role === 'family') && !data.has_seen_onboarding) {
        setIsOnboardingOpen(true);
      }

      // Busca estatísticas de indicação se for profissional
      if (data.role === 'professional') {
        const { data: stats } = await supabase.functions.invoke('referral-stats', {
          body: { referrerId: user.id }
        });
        if (stats) setReferralStats(stats);
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

  const handleSyncStripe = async () => {
    setIsSyncingStripe(true);
    const toastId = toast.loading("Consultando Stripe...");
    try {
      const { data, error } = await supabase.functions.invoke('sync-user-subscription');
      
      if (error) {
        let errorMessage = "Erro ao sincronizar com Stripe.";
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
        toast.info(data.message || "Nenhuma alteração encontrada.", { id: toastId });
      }
    } catch (err: any) {
      console.error("[Sync Error]", err);
      toast.error(err.message || "Erro ao sincronizar com Stripe.", { id: toastId });
    } finally {
      setIsSyncingStripe(false);
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
      toast.error("Não foi possível acessar o portal de pagamentos.");
    } finally {
      setIsManagingBilling(false);
    }
  };

  const getProfileCompleteness = () => {
    if (!profile) return { progress: 0, missingFields: [], iComplete: false };
    
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
    } else {
      requiredFields.bio = "Descrição";
    }
    
    let completedCount = 0;
    const missingFields: string[] = [];
    const totalFields = Object.keys(requiredFields).length;
    
    for (const [key, label] of Object.entries(requiredFields)) {
      if (profile[key] && String(profile[key]).trim() !== '') {
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
      toast.success("Agora você pode reenviar seus documentos na seção Meus Dados.");
      fetchProfile();
    } catch (err) {
      toast.error("Erro ao reiniciar processo.");
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

  const completeness = getProfileCompleteness();
  const trial = getTrialInfo();
  const isProfessional = profile?.role === 'professional';
  const isAdmin = profile?.is_admin || profile?.role === 'admin';
  const firstName = profile?.full_name?.split(' ')[0] || "Usuário";
  
  const hasPaidPlan = profile?.subscription_tier && profile?.subscription_tier !== 'free_trial';
  const subStatus = getSubscriptionStatus();

  const getPlanLabel = (tier: string) => {
    if (tier === 'monthly') return 'Plano Mensal';
    if (tier === 'yearly') return 'Plano Anual';
    if (tier === 'free_trial') return 'Período de 30 dias Gratuitos';
    return tier;
  };

  return (
    <TooltipProvider>
      <div className="space-y-6">
        <div className="flex flex-col gap-1">
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
              ? "Gerencie seu perfil profissional, acompanhe suas verificações e acesse conteúdos educativos para impulsionar sua carreira no Home Care."
              : "Encontre os melhores profissionais para sua escala de atendimento, gerencie seus contatos salvos e acompanhe suas interações recentes."
            }
          </p>
        </div>

        {isProfessional && trial?.isExpired && (
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
            {/* Gerenciar Assinatura - Agora como primeiro quadro */}
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
                      {profile.coupon_days && profile.cancel_at_period_end && (
                        <div className="bg-primary/5 border border-primary/10 rounded-xl p-4 space-y-3 animate-fade-in">
                          <div className="flex items-start gap-3">
                            <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                              <Gift className="h-4 w-4 text-primary" />
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
                                    {annualPlan?.features ? (
                                      annualPlan.features.map((f: string, i: number) => (
                                        <li key={i} className="flex items-center gap-2 text-[10px]">
                                          <CheckCircle2 className="h-3 w-3 text-success" /> {f}
                                        </li>
                                      ))
                                    ) : (
                                      <>
                                        <li className="flex items-center gap-2 text-[10px]"><CheckCircle2 className="h-3 w-3 text-success" /> Destaque no topo das buscas</li>
                                        <li className="flex items-center gap-2 text-[10px]"><CheckCircle2 className="h-3 w-3 text-success" /> Selo dourado de verificação</li>
                                        <li className="flex items-center gap-2 text-[10px]"><CheckCircle2 className="h-3 w-3 text-success" /> Acesso grátis aos cursos Academy</li>
                                        <li className="flex items-center gap-2 text-[10px]"><CheckCircle2 className="h-3 w-3 text-success" /> Suporte prioritário</li>
                                      </>
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
                          {/* Oculta botão de sincronização se for cupom */}
                          {!profile.coupon_days && (
                            <Button 
                              variant="ghost" 
                              size="sm" 
                              className="h-6 text-[10px] gap-1 text-primary hover:bg-primary/10"
                              onClick={handleSyncStripe}
                              disabled={isSyncingStripe}
                            >
                              {isSyncingStripe ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
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
                            Clique em sincronizar se você já realizou o pagamento.
                          </p>
                        )}
                        {profile.cancel_at_period_end && !profile.coupon_days && (
                          <p className="text-[10px] text-amber-600 mt-1 font-medium">
                            Sua assinatura não será renovada automaticamente.
                          </p>
                        )}
                      </div>

                      {/* Oculta botão de gerenciar faturamento se for cupom */}
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
                        onClick={() => setIsPlanModalOpen(true)}
                      >
                        Assinar Agora
                      </Button>
                    </div>
                  )}
                </CardContent>
              </Card>
            )}

            {/* Nível de Indicação (Apenas para Profissionais) */}
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
          </div>

          <div className="space-y-6">
            {!isProfessional && (
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
                <CardTitle className="text-base">Acesso Rápido</CardTitle>
              </CardHeader>
              <CardContent className="grid gap-2">
                {isAdmin && (
                  <Button variant="outline" asChild className="justify-start gap-3 h-12 border-primary/20 bg-primary/5 hover:bg-primary/10">
                    <Link to="/admin">
                      <div className="h-8 w-8 rounded-lg bg-primary flex items-center justify-center shrink-0">
                        <Settings className="h-4 w-4 text-white" />
                      </div>
                      <span className="font-bold text-primary">Painel Administrativo</span>
                    </Link>
                  </Button>
                )}
                {isProfessional && (
                  <Button variant="outline" asChild className="justify-start gap-3 h-12 border-primary/20 hover:bg-primary/5">
                    <Link to={`/profissional/${user?.id}`}>
                      <div className="h-8 w-8 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                        <Eye className="h-4 w-4 text-primary" />
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
                  <div className="flex items-center gap-3 text-primary bg-primary/5 p-4 rounded-lg border border-primary/10">
                    <Clock className="h-5 w-5 animate-pulse" />
                    <div>
                      <p className="text-sm font-semibold">Em Análise</p>
                      <p className="text-[10px] opacity-80">Aguardu o retorno por e-mail.</p>
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
          </div>
        </div>

        <PlanSelectionModal 
          open={isPlanModalOpen} 
          onOpenChange={setIsPlanModalOpen} 
        />

        <OnboardingModal 
          open={isOnboardingOpen} 
          onOpenChange={setIsOnboardingOpen} 
          role={profile?.role}
        />
      </div>
    </TooltipProvider>
  );
};

export default OverviewPage;