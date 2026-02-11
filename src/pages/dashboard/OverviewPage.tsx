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
  Lock
} from "lucide-react";
import { Link } from "react-router-dom";
import { differenceInDays, addDays, parseISO, isValid } from "date-fns";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

const OverviewPage = () => {
  const { user } = useAuth();
  const [profile, setProfile] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchProfile();
  }, [user]);

  const fetchProfile = async () => {
    if (!user) return;
    try {
      const { data } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', user.id)
        .single();
      setProfile(data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const getProfileCompleteness = () => {
    if (!profile) return { progress: 0, missingFields: [], isComplete: false };
    if (profile.role !== 'professional') return { progress: 100, missingFields: [], isComplete: true };
    
    const requiredFields: { [key: string]: string } = {
      avatar_url: "Foto",
      full_name: "Nome",
      phone: "WhatsApp",
      specialty: "Especialidade",
      registration: "Registro",
      neighborhood: "Bairro",
      city: "Cidade",
      state: "Estado",
      experience: "Formações",
      bio: "Biografia",
    };
    
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
    return { daysRemaining, progress, isExpired: daysRemaining <= 0 };
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

  if (loading) return <div className="flex justify-center p-8"><Loader2 className="animate-spin text-primary" /></div>;

  const completeness = getProfileCompleteness();
  const trial = getTrialInfo();
  const isProfessional = profile?.role === 'professional';
  const isAdmin = profile?.is_admin || profile?.role === 'admin';
  const firstName = profile?.full_name?.split(' ')[0] || "Usuário";

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-1">
        <h1 className="text-3xl font-bold tracking-tight">Olá, {firstName}!</h1>
        <p className="text-muted-foreground max-w-2xl">
          {isProfessional 
            ? "Gerencie seu perfil profissional, acompanhe suas verificações e acesse conteúdos educativos para impulsionar sua carreira no Home Care."
            : "Encontre os melhores profissionais para sua escala de atendimento, gerencie seus contatos salvos e acompanhe suas interações recentes."
          }
        </p>
      </div>

      {isProfessional && !completeness.isComplete && (
        <Card className="border-primary/20 bg-primary/5">
          <CardContent className="pt-6">
            <div className="flex items-start gap-4">
              <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                <AlertCircle className="h-6 w-6 text-primary" />
              </div>
              <div className="space-y-3 flex-1">
                <h3 className="font-semibold text-primary">Seu perfil ainda não está visível</h3>
                <p className="text-sm text-muted-foreground">
                  Para aparecer nas buscas das empresas e famílias, complete os seguintes campos: 
                  <span className="font-medium"> {completeness.missingFields.join(", ")}</span>.
                </p>
                <div className="space-y-1">
                  <div className="flex justify-between text-xs mb-1">
                    <span>Progresso do Perfil</span>
                    <span>{completeness.progress}%</span>
                  </div>
                  <Progress value={completeness.progress} className="h-2" />
                </div>
                <Button asChild size="sm" className="gap-2">
                  <Link to="/dashboard/perfil">Completar Perfil <ArrowRight className="h-4 w-4" /></Link>
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      <div className="grid gap-6 md:grid-cols-2">
        {/* Status Section */}
        {isProfessional ? (
          <div className="space-y-6">
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
                      <p className="text-[10px] opacity-80">Selo de confiança ativo nas buscas.</p>
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
                      <p className="text-[10px] opacity-80">Aguarde o retorno por e-mail.</p>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-3">
                    <p className="text-xs text-muted-foreground">Envie seus documentos para ganhar o selo de verificado e transmitir mais segurança.</p>
                    <Button asChild variant="outline" size="sm" className="w-full">
                      <Link to="/dashboard/perfil">Enviar Documentos</Link>
                    </Button>
                  </div>
                )}
                
                <div className="mt-4 pt-4 border-t border-border/50">
                  <p className="text-[10px] text-muted-foreground flex items-center gap-1.5">
                    <Lock className="h-3 w-3 text-primary/60" />
                    Seus documentos são armazenados em ambiente privado e criptografado.
                  </p>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2"><Star className="h-4 w-4 text-amber-500" /> Plano Atual</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex items-center justify-between mb-4">
                  <Badge variant="outline" className="capitalize">
                    {profile?.subscription_tier === 'free_trial' ? 'Teste Grátis' : profile?.subscription_tier === 'monthly' ? 'Mensal' : 'Anual'}
                  </Badge>
                  {trial && !trial.isExpired && (
                    <span className="text-xs font-medium text-primary">{trial.daysRemaining} dias restantes</span>
                  )}
                </div>
                {trial && (
                  <div className="space-y-2">
                    <Progress value={trial.progress} className="h-2" />
                    {trial.isExpired ? (
                      <p className="text-[10px] text-destructive font-medium">Período gratuito expirado. Escolha um plano para continuar visível.</p>
                    ) : (
                      <p className="text-[10px] text-muted-foreground italic">* Plano de 30 dias aplicado automaticamente no cadastro.</p>
                    )}
                    <Button asChild size="sm" className="w-full mt-2" variant={trial.isExpired ? "default" : "outline"}>
                      <a href="/#planos">Ver Planos de Assinatura</a>
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        ) : (
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

        {/* Quick Links Section */}
        <div className="space-y-6">
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
        </div>
      </div>
    </div>
  );
};

export default OverviewPage;