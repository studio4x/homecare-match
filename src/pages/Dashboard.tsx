"use client";

import { useState, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Progress } from "@/components/ui/progress";
import Layout from "@/components/layout/Layout";
import InteractionHistory from "@/components/InteractionHistory";
import {
  CheckCircle2,
  Clock,
  ExternalLink,
  Loader2,
  LogOut,
  Mail,
  ShieldAlert,
  Star,
  Zap,
  Sparkles,
  RefreshCw,
  FileCheck,
  X,
  ClipboardCheck,
  RotateCcw,
  AlertOctagon,
  Trash2,
  Info,
  Building2,
  Home,
  Search,
} from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/components/auth/AuthProvider";
import { supabase } from "@/integrations/supabase/client";
import { useNavigate, Link } from "react-router-dom";
import { differenceInDays, addDays, isValid, parseISO } from "date-fns";
import { cn } from "@/lib/utils";
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DialogHeader
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const Dashboard = () => {
  const { user, session, loading: authLoading, signOut } = useAuth();
  const navigate = useNavigate();
  
  const [isSaving, setIsSaving] = useState(false);
  const [isUploadingDoc, setIsUploadingDoc] = useState<string | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [isLoadingProfile, setIsLoadingProfile] = useState(true);
  const [isGeneratingBio, setIsGeneratingBio] = useState(false);
  const [isRequestingVerification, setIsRequestingVerification] = useState(false);
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [deleteAccountModalOpen, setDeleteAccountModalOpen] = useState(false);
  const [isDeletingAccount, setIsDeletingAccount] = useState(false);
  const [showClearConfirm, setShowClearConfirm] = useState(false);
  const [isClearing, setIsClearing] = useState(false);
  
  const idDocRef = useRef<HTMLInputElement>(null);
  const profDocRef = useRef<HTMLInputElement>(null);
  const avatarRef = useRef<HTMLInputElement>(null);
  
  const [profile, setProfile] = useState({
    full_name: "",
    registration: "",
    specialty: "",
    city: "",
    state: "",
    neighborhood: "",
    experience: "",
    bio: "",
    avatar_url: "",
    phone: "",
    subscription_tier: "free_trial",
    is_verified: false,
    verification_sent: false,
    rejection_reason: null as string | null,
    id_document_url: "",
    prof_registration_url: "",
    trial_started_at: null as string | null,
    role: "professional",
    company_name: "",
    cnpj: ""
  });

  const [interactions, setInteractions] = useState<any[]>([]);
  const [loadingInteractions, setLoadingInteractions] = useState(true);
  const [currentPage, setCurrentPage] = useState(1);
  const ITEMS_PER_PAGE = 7;

  const specialties = [
    { value: "assistente-social", label: "Assistente Social" },
    { value: "cuidador-idosos", label: "Cuidador(a) de Idosos" },
    { value: "dentista", label: "Dentista" },
    { value: "enfermeiro", label: "Enfermeiro(a)" },
    { value: "farmaceutico", label: "Farmacêutico(a)" },
    { value: "fisioterapeuta", label: "Fisioterapeuta" },
    { value: "fonoaudiologo", label: "Fonoaudiólogo(a)" },
    { value: "medico-clinico", label: "Médico(a) - Clínico Geral / Geriatra" },
    { value: "nutricionista", label: "Nutricionista" },
    { value: "psicologo", label: "Psicólogo(a)" },
    { value: "tecnico-enfermagem", label: "Técnico(a) de Enfermagem" },
    { value: "terapeuta-ocupacional", label: "Terapeuta Ocupacional" },
  ];

  const getProfileCompleteness = () => {
    if (profile.role !== 'professional') {
      return { progress: 100, missingFields: [], isComplete: true };
    }
    const requiredFields: { [key: string]: string } = {
      avatar_url: "Foto de Perfil",
      full_name: "Nome Completo",
      phone: "WhatsApp",
      specialty: "Especialidade",
      registration: "Registro",
      neighborhood: "Bairro",
      city: "Cidade",
      state: "Estado",
      experience: "Formações",
      bio: "Biografia Profissional",
    };
    let completedCount = 0;
    const missingFields: string[] = [];
    const totalFields = Object.keys(requiredFields).length;
    for (const [key, label] of Object.entries(requiredFields)) {
      if (profile[key as keyof typeof profile] && String(profile[key as keyof typeof profile]).trim() !== '') {
        completedCount++;
      } else {
        missingFields.push(label);
      }
    }
    const progress = Math.round((completedCount / totalFields) * 100);
    return { progress, missingFields, isComplete: missingFields.length === 0 };
  };

  useEffect(() => {
    if (!authLoading) {
      if (!session) {
        navigate("/login");
      } else {
        fetchProfileAndInteractions();
      }
    }
  }, [authLoading, session]);

  useEffect(() => {
    if (!isLoadingProfile) {
      const { isComplete } = getProfileCompleteness();
      if (!isComplete) {
        setIsEditing(true);
      }
    }
  }, [isLoadingProfile]);

  const fetchProfileAndInteractions = async () => {
    if (!user?.id) return;

    try {
      const { data, error } = await supabase
        .from("profiles")
        .select("*, rejection_reason")
        .eq("id", user.id)
        .maybeSingle();

      if (error) throw error;

      if (data) {
        if (data.is_admin || data.role === 'admin') {
          navigate('/admin', { replace: true });
          return;
        }

        const userProfile = {
          full_name: data.full_name || "",
          registration: data.registration || "",
          specialty: data.specialty || "",
          city: data.city || "",
          state: data.state || "",
          neighborhood: data.neighborhood || "",
          experience: data.experience || "",
          bio: data.bio || "",
          avatar_url: data.avatar_url || "",
          phone: data.phone || "",
          subscription_tier: data.subscription_tier || "free_trial",
          is_verified: data.is_verified || false,
          verification_sent: data.verification_sent || false,
          rejection_reason: data.rejection_reason || null,
          id_document_url: data.id_document_url || "",
          prof_registration_url: data.prof_registration_url || "",
          trial_started_at: data.trial_started_at,
          role: data.role || "professional",
          company_name: data.company_name || "",
          cnpj: data.cnpj || ""
        };
        setProfile(userProfile);
        
        await fetchInteractions(user.id, userProfile.role);

      } else {
        console.warn("Usuário autenticado sem perfil encontrado. Forçando logout.");
        toast.error("Sua conta não foi encontrada ou foi desativada.");
        await signOut();
        navigate("/");
      }
    } catch (err) {
      console.error("[Dashboard] Erro ao carregar perfil:", err);
    } finally {
      setIsLoadingProfile(false);
    }
  };

  const fetchInteractions = async (userId: string, userRole: string) => {
    setLoadingInteractions(true);
    try {
      const profileColumns = 'id, full_name, avatar_url, specialty, role, phone, bio, city, state, neighborhood';
      let query;
  
      if (userRole === 'professional') {
        query = supabase
          .from('interactions')
          .select(`created_at, sender:sender_id (${profileColumns})`)
          .eq('professional_id', userId)
          .order('created_at', { ascending: false });
      } else {
        query = supabase
          .from('interactions')
          .select(`created_at, professional:professional_id (${profileColumns})`)
          .eq('sender_id', userId)
          .order('created_at', { ascending: false });
      }
  
      const { data, error } = await query;
      if (error) throw error;
  
      const uniqueInteractions = new Map();
      data.forEach(item => {
        const profile = item.sender || item.professional;
        if (profile && !uniqueInteractions.has(profile.id)) {
          uniqueInteractions.set(profile.id, {
            interacted_at: item.created_at,
            profile: profile
          });
        }
      });

      const formattedInteractions = Array.from(uniqueInteractions.values());
      setInteractions(formattedInteractions);
    } catch (error) {
      console.error("[Dashboard] Erro ao buscar interações:", error);
    } finally {
      setLoadingInteractions(false);
    }
  };

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>, type: 'avatar' | 'id_doc' | 'prof_doc') => {
    const file = event.target.files?.[0];
    if (!file || !user) return;

    setIsUploadingDoc(type);
    const fileExt = file.name.split('.').pop();
    const bucket = type === 'avatar' ? 'avatars' : 'documents';
    const filePath = `${user.id}/${Math.random()}.${fileExt}`;

    try {
      const { error: uploadError } = await supabase.storage.from(bucket).upload(filePath, file);
      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage.from(bucket).getPublicUrl(filePath);
      
      const updateData = type === 'avatar' ? { avatar_url: publicUrl } : 
                        type === 'id_doc' ? { id_document_url: publicUrl } : 
                        { prof_registration_url: publicUrl };

      const { error: updateError } = await supabase.from("profiles").update(updateData).eq("id", user.id);
      if (updateError) throw updateError;

      setProfile(prev => ({ ...prev, ...updateData }));
      toast.success("Arquivo carregado com sucesso!");
    } catch (error: any) {
      console.error("[Dashboard] Erro upload:", error);
      toast.error("Erro ao enviar arquivo.");
    } finally {
      setIsUploadingDoc(null);
    }
  };

  const handleRequestVerification = async () => {
    if (!user) return;
    setIsRequestingVerification(true);
    
    try {
      const { error: updateError } = await supabase
        .from("profiles")
        .update({ verification_sent: true })
        .eq("id", user.id);

      if (updateError) throw updateError;

      try {
        await supabase.functions.invoke('notify-verification', { 
          body: { 
            userName: profile.full_name, 
            userEmail: user.email,
            userId: user.id 
          } 
        });
      } catch (notifyErr) {
        console.warn("[Dashboard] Erro ao notificar admin:", notifyErr);
      }

      setProfile(prev => ({ ...prev, verification_sent: true }));
      setShowSuccessModal(true);
    } catch (err: any) {
      console.error("[Dashboard] Erro verificação:", err);
      toast.error("Erro ao processar solicitação.");
    } finally {
      setIsRequestingVerification(false);
    }
  };

  const handleRetryVerification = async () => {
    if (!user) return;
    try {
      const { error } = await supabase
        .from("profiles")
        .update({ rejection_reason: null, verification_sent: false })
        .eq("id", user.id);

      if (error) throw error;
      setProfile(prev => ({ ...prev, rejection_reason: null, verification_sent: false }));
      toast.success("Agora você pode reenviar seus documentos.");
    } catch (err) {
      console.error(err);
      toast.error("Erro ao reiniciar processo.");
    }
  };

  const handleGenerateBio = async () => {
    if (!profile.full_name || !profile.specialty || !profile.experience) {
      toast.error("Preencha nome, especialidade e formações primeiro.");
      return;
    }

    setIsGeneratingBio(true);
    try {
      const { data, error } = await supabase.functions.invoke('generate-bio', {
        body: {
          name: profile.full_name,
          specialty: profile.specialty,
          experience: profile.experience,
          city: profile.city || "sua cidade",
          state: profile.state || ""
        }
      });

      if (error) throw error;
      
      if (data?.bio) {
        setProfile(prev => ({ ...prev, bio: data.bio }));
        toast.success("Biografia profissional gerada!");
      }
    } catch (err: any) {
      console.error("[Dashboard] Erro IA:", err);
      toast.error("Erro ao gerar biografia automática.");
    } finally {
      setIsGeneratingBio(false);
    }
  };

  const handleSave = async () => {
    if (!user) return;

    const { isComplete, missingFields } = getProfileCompleteness();
    if (isProfessional && !isComplete) {
      toast.error("Complete seu perfil para salvar", {
        description: `Campos pendentes: ${missingFields.join(", ")}.`,
      });
      return;
    }

    setIsSaving(true);
    try {
      const { error } = await supabase.from("profiles").update({
        full_name: profile.full_name,
        phone: profile.phone,
        bio: profile.bio,
        experience: profile.experience,
        city: profile.city,
        state: profile.state,
        neighborhood: profile.neighborhood,
        specialty: profile.specialty,
        registration: profile.registration,
        company_name: profile.company_name,
        cnpj: profile.cnpj
      }).eq("id", user.id);

      if (error) throw error;
      
      toast.success("Perfil atualizado com sucesso!");
      setIsEditing(false);
    } catch (error) {
      toast.error("Erro ao salvar alterações.");
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeleteAccount = async () => {
    setIsDeletingAccount(true);
    try {
      const { error } = await supabase.functions.invoke('delete-user');
      if (error) throw error;

      await signOut();
      toast.success("Sua conta foi excluída com sucesso.");
      navigate("/");
    } catch (error) {
      console.error("Erro ao excluir conta:", error);
      toast.error("Não foi possível excluir sua conta. Tente novamente mais tarde.");
    } finally {
      setIsDeletingAccount(false);
      setDeleteAccountModalOpen(false);
    }
  };

  const handleClearInteractions = () => {
    if (interactions.length === 0) return;
    setShowClearConfirm(true);
  };

  const performClearInteractions = async () => {
    if (!user) return;
    setIsClearing(true);
    try {
      const columnToFilter = profile.role === 'professional' ? 'professional_id' : 'sender_id';
      const { error } = await supabase
        .from('interactions')
        .delete()
        .eq(columnToFilter, user.id);

      if (error) throw error;

      toast.success("Histórico de contatos limpo!");
      setInteractions([]);
      setCurrentPage(1);
      setShowClearConfirm(false);
    } catch (err) {
      toast.error("Erro ao limpar o histórico.");
      console.error(err);
    } finally {
      setIsClearing(false);
    }
  };

  const getTrialInfo = () => {
    if (profile.subscription_tier !== 'free_trial' || !profile.trial_started_at) return null;
    
    const startDate = parseISO(profile.trial_started_at);
    if (!isValid(startDate)) return null;

    const endDate = addDays(startDate, 30);
    const now = new Date();
    const daysRemaining = differenceInDays(endDate, now);
    const daysPassed = 30 - daysRemaining;
    const progress = Math.min(100, Math.max(0, (daysPassed / 30) * 100)) || 0;
    
    return {
      daysRemaining: Math.max(0, daysRemaining),
      progress,
      isExpired: daysRemaining <= 0
    };
  };

  if (authLoading || isLoadingProfile) {
    return (
      <Layout>
        <div className="flex h-[80vh] items-center justify-center">
          <Loader2 className="h-10 w-10 animate-spin text-primary" />
        </div>
      </Layout>
    );
  }

  const isEmailConfirmed = !!user?.email_confirmed_at;
  const initials = profile.full_name 
    ? profile.full_name.split(" ").map(n => n[0]).join("").slice(0, 2).toUpperCase() 
    : "??";
  const trial = getTrialInfo();
  const isProfessional = profile.role === 'professional';
  const isCompany = profile.role === 'company';
  const profileCompleteness = getProfileCompleteness();

  const paginatedInteractions = interactions.slice(
    (currentPage - 1) * ITEMS_PER_PAGE,
    currentPage * ITEMS_PER_PAGE
  );

  return (
    <Layout>
      <div className="min-h-screen bg-secondary/20 py-8">
        <div className="container mx-auto px-4">
          {!isEmailConfirmed && (
            <Alert variant="destructive" className="mb-8">
              <Mail className="h-4 w-4" />
              <AlertTitle>Confirme seu e-mail</AlertTitle>
              <AlertDescription>Seu perfil só ficará visível para buscas após a confirmação do e-mail.</AlertDescription>
            </Alert>
          )}

          {trial && isProfessional && (
            <div className="mb-8 rounded-2xl border border-primary/20 bg-primary/5 p-6 shadow-sm">
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div className="space-y-1">
                  <div className="flex items-center gap-2 font-semibold text-primary">
                    <Zap className="h-5 w-5 fill-current" />
                    Período de Teste Gratuito
                  </div>
                  <p className="text-sm text-muted-foreground">
                    Você tem <strong>{trial.daysRemaining} dias</strong> de acesso gratuito restante.
                  </p>
                </div>
                <div className="flex-1 max-w-md">
                  <div className="mb-2 flex justify-between text-xs font-medium">
                    <span>Progresso do teste</span>
                    <span>{Math.round(trial.progress)}%</span>
                  </div>
                  <Progress value={trial.progress} className="h-2" />
                </div>
                <Button size="sm" asChild className="shrink-0">
                  <Link to="/#planos">Assinar agora</Link>
                </Button>
              </div>
            </div>
          )}

          <div className="mb-8 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <h1 className="text-3xl font-bold">Meu Painel</h1>
            <div className="flex flex-wrap gap-2">
              {isProfessional && (
                <Button variant="outline" asChild className="gap-2">
                  <Link to={`/profissional/${user?.id}`}><ExternalLink className="h-4 w-4" /> Ver Público</Link>
                </Button>
              )}
              <Button variant="ghost" onClick={signOut} className="gap-2 hover:text-destructive"><LogOut className="h-4 w-4" /> Sair</Button>
            </div>
          </div>

          <div className="grid gap-6 lg:grid-cols-3">
            {/* --- COLUNA ESQUERDA --- */}
            <div className="space-y-6">
              {isProfessional ? (
                <>
                  <div className="rounded-2xl border bg-card p-6 shadow-card">
                    <h3 className="mb-4 font-semibold">Status de Verificação</h3>
                    {profile.is_verified ? (
                      <div className="flex flex-col items-center py-4 text-center bg-success/5 rounded-xl border border-success/20">
                        <CheckCircle2 className="h-10 w-10 text-success mb-2" />
                        <p className="font-semibold text-success">Perfil Verificado</p>
                        <p className="text-[10px] text-muted-foreground mt-1 px-4">Seu selo de confiança está ativo.</p>
                      </div>
                    ) : profile.rejection_reason ? (
                      <div className="flex flex-col items-center py-6 text-center bg-destructive/5 rounded-xl border border-destructive/20 animate-fade-in">
                        <AlertOctagon className="h-10 w-10 text-destructive mb-3" />
                        <h4 className="font-semibold text-destructive mb-2">Documentos Reprovados</h4>
                        <p className="text-xs text-muted-foreground px-4 mb-4 leading-relaxed">
                          O motivo da recusa foi enviado para seu e-mail. Por favor, verifique, corrija os problemas e tente novamente.
                        </p>
                        <Button variant="destructive" size="sm" onClick={handleRetryVerification} className="gap-2 w-full">
                          <RotateCcw className="h-3 w-3" />
                          Enviar Novos Documentos
                        </Button>
                      </div>
                    ) : profile.verification_sent ? (
                      <div className="flex flex-col items-center py-6 text-center bg-primary/5 rounded-xl border border-primary/20">
                        <Clock className="h-10 w-10 text-primary animate-pulse mb-3" />
                        <h4 className="font-semibold text-primary mb-2">Documentos em Análise</h4>
                        <p className="text-xs text-muted-foreground px-4 leading-relaxed">
                          Seus documentos foram enviados e serão analisados. Você receberá um e-mail informando a decisão sobre a aprovação.
                        </p>
                      </div>
                    ) : (
                      <div className="space-y-4">
                        <p className="text-xs text-muted-foreground mb-4">Envie seus documentos para ganhar o selo de verificação.</p>
                        <div className="space-y-3">
                          <div className="space-y-1">
                            <Label className="text-[10px] uppercase tracking-wider text-muted-foreground">RG ou CNH (Frente/Verso)</Label>
                            <Button variant="outline" size="sm" className={cn("w-full border-dashed justify-start h-10", profile.id_document_url && "border-success/50 bg-success/5")} onClick={() => idDocRef.current?.click()} disabled={!!isUploadingDoc}>
                              {isUploadingDoc === 'id_doc' ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <FileCheck className={cn("h-4 w-4 mr-2", profile.id_document_url ? "text-success" : "text-muted-foreground")} />}
                              <span className="truncate text-xs">{profile.id_document_url ? "Documento Enviado ✓" : "Selecionar Arquivo"}</span>
                            </Button>
                            <input type="file" ref={idDocRef} onChange={(e) => handleFileUpload(e, 'id_doc')} className="hidden" accept="image/*,.pdf" />
                          </div>
                          <div className="space-y-1">
                            <Label className="text-[10px] uppercase tracking-wider text-muted-foreground">Registro Profissional (COREN/CREFITO)</Label>
                            <Button variant="outline" size="sm" className={cn("w-full border-dashed justify-start h-10", profile.prof_registration_url && "border-success/50 bg-success/5")} onClick={() => profDocRef.current?.click()} disabled={!!isUploadingDoc}>
                              {isUploadingDoc === 'prof_doc' ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <FileCheck className={cn("h-4 w-4 mr-2", profile.prof_registration_url ? "text-success" : "text-muted-foreground")} />}
                              <span className="truncate text-xs">{profile.prof_registration_url ? "Registro Enviado ✓" : "Selecionar Arquivo"}</span>
                            </Button>
                            <input type="file" ref={profDocRef} onChange={(e) => handleFileUpload(e, 'prof_doc')} className="hidden" accept="image/*,.pdf" />
                          </div>
                        </div>
                        <Button onClick={handleRequestVerification} className="w-full mt-4" disabled={!profile.id_document_url || !profile.prof_registration_url || isRequestingVerification}>
                          {isRequestingVerification ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                          Solicitar Verificação
                        </Button>
                      </div>
                    )}
                  </div>

                  <div className="rounded-2xl border bg-card p-6 shadow-card">
                    <h3 className="mb-4 font-semibold flex items-center gap-2"><Star className="h-4 w-4 text-primary" /> Plano Atual</h3>
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm text-muted-foreground">Nível:</span>
                      <Badge variant="outline" className="capitalize">
                        {profile.subscription_tier === 'free_trial' ? 'Teste Grátis' : profile.subscription_tier}
                      </Badge>
                    </div>
                    {profile.subscription_tier === 'free_trial' && (
                      <p className="text-[10px] text-muted-foreground mt-2 italic">
                        * Após 30 dias, seu perfil deixará de aparecer no topo das buscas.
                      </p>
                    )}
                  </div>
                </>
              ) : (
                <InteractionHistory
                  title="Profissionais que contatei"
                  interactions={paginatedInteractions}
                  loading={loadingInteractions}
                  totalItems={interactions.length}
                  itemsPerPage={ITEMS_PER_PAGE}
                  currentPage={currentPage}
                  onPageChange={setCurrentPage}
                  onClear={handleClearInteractions}
                  viewerRole={profile.role}
                />
              )}
            </div>

            {/* --- COLUNA DIREITA --- */}
            <div className="lg:col-span-2 space-y-8">
              <div className="rounded-2xl border bg-card p-6 shadow-card">
                <div className="mb-6 flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-3">
                    <h3 className="text-xl font-semibold">Meus Dados</h3>
                    {!isProfessional && (
                      <Badge variant={isCompany ? "secondary" : "outline"} className="capitalize flex items-center gap-1.5">
                        {isCompany ? (
                          <>
                            <Building2 className="h-3 w-3" />
                            Empresa
                          </>
                        ) : (
                          <>
                            <Home className="h-3 w-3" />
                            Família
                          </>
                        )}
                      </Badge>
                    )}
                  </div>
                  {isProfessional && profileCompleteness.isComplete && !isEditing ? (
                    <Button onClick={() => setIsEditing(true)}>Editar Perfil</Button>
                  ) : !isProfessional && !isEditing ? (
                    <Button onClick={() => setIsEditing(true)}>Editar Perfil</Button>
                  ) : null}
                </div>
                
                {isProfessional && !profileCompleteness.isComplete && (
                  <Alert className="mb-6 border-primary/20 bg-primary/5">
                    <Info className="h-4 w-4 text-primary" />
                    <AlertTitle className="text-primary">Complete seu Perfil</AlertTitle>
                    <AlertDescription className="text-xs text-muted-foreground">
                      Para que seu perfil seja visível nas buscas, todos os campos abaixo são obrigatórios.
                      <div className="mt-3">
                        <Progress value={profileCompleteness.progress} className="h-2" />
                        <p className="mt-2 text-[10px]">
                          Pendente: {profileCompleteness.missingFields.join(", ")}
                        </p>
                      </div>
                    </AlertDescription>
                  </Alert>
                )}

                <div className="space-y-6">
                  <div className="flex items-center gap-4">
                    <div className="relative">
                      <Avatar className={cn("h-20 w-20 ring-4 ring-border", isProfessional && !profile.avatar_url && "ring-destructive")}>
                        <AvatarImage src={profile.avatar_url} />
                        <AvatarFallback className="text-xl">{initials}</AvatarFallback>
                      </Avatar>
                      {isProfessional && !profile.avatar_url && (
                        <div className="absolute -top-1 -right-1 h-4 w-4 rounded-full bg-destructive border-2 border-card" />
                      )}
                    </div>
                    {isEditing && (
                      <div className="flex flex-col gap-2">
                        <Button variant="outline" size="sm" onClick={() => avatarRef.current?.click()}>Alterar Foto *</Button>
                        <p className="text-[10px] text-muted-foreground">JPG ou PNG, máx. 2MB</p>
                        <input type="file" ref={avatarRef} onChange={(e) => handleFileUpload(e, 'avatar')} className="hidden" accept="image/*" />
                      </div>
                    )}
                  </div>

                  <div className="grid gap-4 md:grid-cols-2">
                    <div className="grid gap-2">
                      <Label>{isProfessional ? "Nome Completo *" : (isCompany ? "Razão Social / Nome do Responsável" : "Nome do Responsável")}</Label>
                      <Input value={profile.full_name} onChange={e => setProfile({...profile, full_name: e.target.value})} disabled={!isEditing} />
                    </div>
                    <div className="grid gap-2">
                      <Label>WhatsApp (com DDD) {isProfessional && "*"}</Label>
                      <Input value={profile.phone} onChange={e => setProfile({...profile, phone: e.target.value})} disabled={!isEditing} placeholder="11999999999" />
                    </div>
                    {isCompany && (
                      <>
                        <div className="grid gap-2">
                          <Label>Nome Fantasia</Label>
                          <Input value={profile.company_name} onChange={e => setProfile({...profile, company_name: e.target.value})} disabled={!isEditing} />
                        </div>
                        <div className="grid gap-2">
                          <Label>CNPJ</Label>
                          <Input value={profile.cnpj} onChange={e => setProfile({...profile, cnpj: e.target.value})} disabled={!isEditing} />
                        </div>
                      </>
                    )}
                    {isProfessional && (
                      <>
                        <div className="grid gap-2">
                          <Label>Especialidade *</Label>
                          <Select
                            value={profile.specialty}
                            onValueChange={(value) => setProfile({ ...profile, specialty: value })}
                            disabled={!isEditing}
                          >
                            <SelectTrigger>
                              <SelectValue placeholder="Selecione sua especialidade" />
                            </SelectTrigger>
                            <SelectContent>
                              {specialties.map((s) => (
                                <SelectItem key={s.value} value={s.value}>
                                  {s.label}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="grid gap-2">
                          <Label>Registro (COREN/CREFITO) *</Label>
                          <Input value={profile.registration} onChange={e => setProfile({...profile, registration: e.target.value})} disabled={!isEditing} />
                        </div>
                      </>
                    )}
                  </div>

                  {isProfessional ? (
                    <>
                      <div className="grid gap-4 md:grid-cols-3">
                        <div className="grid gap-2">
                          <Label>Bairro *</Label>
                          <Input value={profile.neighborhood} onChange={e => setProfile({...profile, neighborhood: e.target.value})} disabled={!isEditing} />
                        </div>
                        <div className="grid gap-2">
                          <Label>Cidade *</Label>
                          <Input value={profile.city} onChange={e => setProfile({...profile, city: e.target.value})} disabled={!isEditing} />
                        </div>
                        <div className="grid gap-2">
                          <Label>Estado (UF) *</Label>
                          <Input value={profile.state} onChange={e => setProfile({...profile, state: e.target.value})} disabled={!isEditing} maxLength={2} />
                        </div>
                      </div>
                      <div className="grid gap-2">
                        <Label>Formações *</Label>
                        <Textarea value={profile.experience} onChange={e => setProfile({...profile, experience: e.target.value})} disabled={!isEditing} className="min-h-[120px]" placeholder="Cursos, especializações e histórico acadêmico..." />
                      </div>
                      <div className="grid gap-2">
                        <div className="flex items-center justify-between">
                          <Label>Biografia Profissional *</Label>
                          {isEditing && (
                            <Button type="button" variant="outline" size="sm" className="h-7 gap-1 text-[10px] bg-primary/5 hover:bg-primary/10 border-primary/20" onClick={handleGenerateBio} disabled={isGeneratingBio}>
                              {isGeneratingBio ? <RefreshCw className="h-3 w-3 animate-spin" /> : <Sparkles className="h-3 w-3 text-primary" />}
                              Gerar com IA
                            </Button>
                          )}
                        </div>
                        <Textarea value={profile.bio} onChange={e => setProfile({...profile, bio: e.target.value})} disabled={!isEditing} className="min-h-[120px]" placeholder="Conte um pouco sobre sua trajetória..." />
                      </div>
                    </>
                  ) : (
                    <div className="space-y-6">
                      <div className="grid gap-4 md:grid-cols-2">
                        <div className="grid gap-2">
                          <Label>Cidade</Label>
                          <Input value={profile.city} onChange={e => setProfile({...profile, city: e.target.value})} disabled={!isEditing} />
                        </div>
                        <div className="grid gap-2">
                          <Label>Estado (UF)</Label>
                          <Input value={profile.state} onChange={e => setProfile({...profile, state: e.target.value})} disabled={!isEditing} maxLength={2} />
                        </div>
                      </div>
                      <div className="grid gap-2">
                        <Label>Bairro</Label>
                        <Input value={profile.neighborhood} onChange={e => setProfile({...profile, neighborhood: e.target.value})} disabled={!isEditing} />
                      </div>
                      <div className="grid gap-2">
                        <Label>{profile.role === 'company' ? 'Sobre a Empresa' : 'Descrição da Necessidade'}</Label>
                        <Textarea value={profile.bio} onChange={e => setProfile({...profile, bio: e.target.value})} disabled={!isEditing} className="min-h-[120px]" placeholder={profile.role === 'company' ? 'Descreva brevemente sua empresa...' : 'Descreva a necessidade do paciente, o local do atendimento, etc...'} />
                      </div>
                    </div>
                  )}
                  {isEditing && (
                    <div className="flex justify-end gap-2">
                      <Button variant="ghost" onClick={() => { if (profileCompleteness.isComplete) setIsEditing(false); }}>Cancelar</Button>
                      <Button onClick={handleSave} disabled={isSaving}>
                        {isSaving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                        Salvar Alterações
                      </Button>
                    </div>
                  )}
                </div>
              </div>

              {isProfessional && (
                <InteractionHistory
                  title="Quem me contatou"
                  interactions={paginatedInteractions}
                  loading={loadingInteractions}
                  totalItems={interactions.length}
                  itemsPerPage={ITEMS_PER_PAGE}
                  currentPage={currentPage}
                  onPageChange={setCurrentPage}
                  onClear={handleClearInteractions}
                  viewerRole={profile.role}
                />
              )}

              <div className="flex justify-end pt-4">
                <Button variant="ghost" size="sm" className="text-muted-foreground/50 hover:text-destructive hover:bg-destructive/5 text-xs h-8 px-2" onClick={() => setDeleteAccountModalOpen(true)}>
                  <Trash2 className="h-3 w-3 mr-2" />
                  Excluir minha conta permanentemente
                </Button>
              </div>
            </div>
          </div>
        </div>
      </div>

      <Dialog open={showSuccessModal} onOpenChange={setShowSuccessModal}>
        <DialogContent className="max-w-2xl p-0 overflow-hidden border-none shadow-2xl animate-scale-in">
          <div className="relative bg-card p-12 md:p-16 flex flex-col items-center text-center space-y-8">
            <button onClick={() => setShowSuccessModal(false)} className="absolute right-6 top-6 p-2 rounded-full hover:bg-secondary transition-colors">
              <X className="h-6 w-6 text-muted-foreground" />
            </button>
            <div className="h-24 w-24 rounded-full bg-primary/10 flex items-center justify-center animate-bounce">
              <ClipboardCheck className="h-12 w-12 text-primary" />
            </div>
            <div className="space-y-4">
              <DialogTitle className="text-4xl font-bold tracking-tight text-foreground">
                Documentos enviados!
              </DialogTitle>
              <DialogDescription className="text-xl text-muted-foreground leading-relaxed max-w-lg mx-auto">
                Sua solicitação de análise foi registrada com sucesso. Agora, nossa equipe revisará seus dados e você será notificado por e-mail em breve.
              </DialogDescription>
            </div>
            <Button size="lg" className="w-full max-w-xs h-14 text-lg font-semibold shadow-lg" onClick={() => setShowSuccessModal(false)}>
              Entendido
            </Button>
            <p className="text-sm text-muted-foreground italic">
              A análise costuma levar até 48 horas úteis.
            </p>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={deleteAccountModalOpen} onOpenChange={setDeleteAccountModalOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-destructive">
              <ShieldAlert className="h-5 w-5" />
              Excluir Conta
            </DialogTitle>
            <DialogDescription className="pt-2">
              Você tem certeza que deseja excluir sua conta?
              <br/><br/>
              Esta ação é **permanente** e excluirá todos os seus dados, documentos e histórico. Não será possível recuperar o acesso.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="mt-4">
            <Button variant="ghost" onClick={() => setDeleteAccountModalOpen(false)} disabled={isDeletingAccount}>
              Cancelar
            </Button>
            <Button variant="destructive" onClick={handleDeleteAccount} disabled={isDeletingAccount}>
              {isDeletingAccount ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              Confirmar Exclusão
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={showClearConfirm} onOpenChange={setShowClearConfirm}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Limpar Histórico?</DialogTitle>
            <DialogDescription className="pt-2">
              Esta ação é irreversível e removerá todos os contatos da sua lista. Deseja continuar?
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="mt-4">
            <Button variant="ghost" onClick={() => setShowClearConfirm(false)} disabled={isClearing}>
              Cancelar
            </Button>
            <Button variant="destructive" onClick={performClearInteractions} disabled={isClearing}>
              {isClearing ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              Limpar Histórico
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Layout>
  );
};

export default Dashboard;