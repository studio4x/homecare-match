"use client";

import { useState, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import Layout from "@/components/layout/Layout";
import {
  Camera,
  Save,
  CheckCircle,
  AlertCircle,
  Award,
  MapPin,
  Briefcase,
  Calendar,
  LogOut,
  Phone,
  Loader2,
  Mail,
  RefreshCw,
  Sparkles,
  Trash2,
  Star,
  Zap,
  CreditCard
} from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/components/auth/AuthProvider";
import { supabase } from "@/integrations/supabase/client";
import { Navigate, useNavigate, useLocation } from "react-router-dom";
import { cn } from "@/lib/utils";

const Dashboard = () => {
  const { user, session, loading, signOut } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [isSaving, setIsSaving] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [isResending, setIsResending] = useState(false);
  const [isGeneratingBio, setIsGeneratingBio] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isUpgrading, setIsUpgrading] = useState(false);
  const [deleteConfirmation, setDeleteConfirmation] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);
  
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
    subscription_tier: "monthly",
    is_verified: false
  });

  useEffect(() => {
    if (user) {
      fetchProfile();
    }
  }, [user]);

  // Captura plano selecionado vindo da Home
  useEffect(() => {
    const state = location.state as { selectedPlan?: string };
    if (state?.selectedPlan && !isUpgrading) {
      handleUpgrade(state.selectedPlan);
      window.history.replaceState({}, document.title);
    }
  }, [location.state]);

  const fetchProfile = async () => {
    const { data, error } = await supabase
      .from("profiles")
      .select("*")
      .eq("id", user?.id)
      .single();

    if (error) {
      console.error("Erro ao carregar perfil:", error);
    } else if (data) {
      setProfile({
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
        subscription_tier: data.subscription_tier || "monthly",
        is_verified: data.is_verified || false
      });
    }
  };

  const handleUpgrade = async (tier: string) => {
    if (!user) return;
    setIsUpgrading(true);
    
    try {
      // Simulação de checkout
      await new Promise(resolve => setTimeout(resolve, 1500));

      const { error } = await supabase
        .from("profiles")
        .update({ 
          subscription_tier: tier,
          is_verified: tier === 'yearly' ? true : profile.is_verified
        })
        .eq("id", user.id);

      if (error) throw error;

      setProfile(prev => ({ 
        ...prev, 
        subscription_tier: tier, 
        is_verified: tier === 'yearly' ? true : prev.is_verified 
      }));
      
      toast.success(`Plano ${tier === 'yearly' ? 'Anual' : 'Mensal'} ativado com sucesso!`);
    } catch (error) {
      toast.error("Erro ao processar assinatura.");
    } finally {
      setIsUpgrading(false);
    }
  };

  const generateBioWithAI = async () => {
    if (!profile.full_name || !profile.specialty || !profile.experience) {
      toast.error("Preencha seu nome, especialidade e experiência para gerar uma bio.");
      return;
    }

    setIsGeneratingBio(true);
    try {
      const { data, error } = await supabase.functions.invoke('generate-bio', {
        body: {
          name: profile.full_name,
          specialty: specialties.find(s => s.value === profile.specialty)?.label || profile.specialty,
          experience: profile.experience,
          city: profile.city,
          state: profile.state
        }
      });

      if (error) throw error;
      setProfile(prev => ({ ...prev, bio: data.bio }));
      toast.success("Mini-bio gerada com sucesso!");
    } catch (error: any) {
      toast.error("Erro ao gerar bio com IA.");
    } finally {
      setIsGeneratingBio(false);
    }
  };

  const handleResendEmail = async () => {
    if (!user?.email) return;
    setIsResending(true);
    const { error } = await supabase.auth.resend({
      type: 'signup',
      email: user.email,
    });
    if (error) toast.error("Erro ao reenviar.");
    else toast.success("E-mail reenviado!");
    setIsResending(false);
  };

  const handleUploadClick = () => fileInputRef.current?.click();

  const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file || !user) return;
    setIsUploading(true);
    const fileExt = file.name.split('.').pop();
    const filePath = `${user.id}/${Math.random()}.${fileExt}`;

    try {
      await supabase.storage.from('avatars').upload(filePath, file);
      const { data: { publicUrl } } = supabase.storage.from('avatars').getPublicUrl(filePath);
      setProfile({ ...profile, avatar_url: publicUrl });
      await supabase.from("profiles").update({ avatar_url: publicUrl }).eq("id", user.id);
      toast.success("Foto atualizada!");
    } catch (error: any) {
      toast.error("Erro ao subir imagem.");
    } finally {
      setIsUploading(false);
    }
  };

  const handleSave = async () => {
    if (!user) return;
    setIsSaving(true);
    const { error } = await supabase.from("profiles").upsert({ id: user.id, ...profile });
    if (error) toast.error("Erro ao salvar.");
    else {
      toast.success("Perfil salvo!");
      setIsEditing(false);
    }
    setIsSaving(false);
  };

  const specialties = [
    { value: "enfermeiro", label: "Enfermeiro(a)" },
    { value: "tecnico-enfermagem", label: "Técnico(a) de Enfermagem" },
    { value: "fisioterapeuta", label: "Fisioterapeuta" },
    { value: "cuidador", label: "Cuidador(a) de Idosos" },
  ];

  const states = ["AC", "AL", "AP", "AM", "BA", "CE", "DF", "ES", "GO", "MA", "MT", "MS", "MG", "PA", "PB", "PR", "PE", "PI", "RJ", "RN", "RS", "RO", "RR", "SC", "SP", "SE", "TO"];

  if (loading) return null;
  if (!session) return <Navigate to="/login" replace />;

  const isEmailConfirmed = !!user?.email_confirmed_at;
  const initials = profile.full_name ? profile.full_name.split(" ").map(n => n[0]).join("").slice(0, 2).toUpperCase() : "??";

  return (
    <Layout>
      <div className="min-h-screen bg-secondary/20 py-8">
        <div className="container mx-auto px-4">
          {!isEmailConfirmed && (
            <Alert variant="destructive" className="mb-8">
              <Mail className="h-4 w-4" />
              <AlertTitle>Confirme seu e-mail</AlertTitle>
              <AlertDescription className="flex flex-col gap-4">
                <p>Valide seu e-mail para que seu perfil fique visível.</p>
                <Button variant="outline" size="sm" className="w-fit" onClick={handleResendEmail} disabled={isResending}>
                  {isResending ? <Loader2 className="h-4 w-4 animate-spin" /> : "Reenviar e-mail"}
                </Button>
              </AlertDescription>
            </Alert>
          )}

          <div className="mb-8 flex items-center justify-between">
            <h1 className="text-3xl font-bold">Meu Perfil</h1>
            <Button variant="ghost" onClick={signOut} className="gap-2">
              <LogOut className="h-4 w-4" /> Sair
            </Button>
          </div>

          <div className="grid gap-6 lg:grid-cols-3">
            <div className="space-y-6">
              <div className="rounded-2xl border border-border bg-card p-6 shadow-card">
                <h3 className="mb-4 font-semibold">Assinatura Ativa</h3>
                <div className="flex items-center gap-3 rounded-lg bg-primary/10 p-4">
                  {profile.subscription_tier === 'yearly' ? (
                    <Star className="h-6 w-6 text-primary fill-primary" />
                  ) : (
                    <Zap className="h-6 w-6 text-primary fill-primary" />
                  )}
                  <div>
                    <p className="font-medium text-primary">
                      {profile.subscription_tier === 'yearly' ? 'Plano Anual' : 'Plano Mensal'}
                    </p>
                    <p className="text-xs text-muted-foreground">Status: Ativo</p>
                  </div>
                </div>
                
                <div className="mt-4 pt-4 border-t border-border">
                  <p className="text-xs text-muted-foreground mb-3">Deseja mudar de plano?</p>
                  <Button 
                    variant="outline" 
                    className="w-full gap-2"
                    onClick={() => handleUpgrade(profile.subscription_tier === 'monthly' ? 'yearly' : 'monthly')}
                    disabled={isUpgrading}
                  >
                    <CreditCard className="h-4 w-4" />
                    Mudar para {profile.subscription_tier === 'monthly' ? 'Plano Anual' : 'Plano Mensal'}
                  </Button>
                </div>
              </div>

              <div className="rounded-2xl border border-border bg-card p-6 shadow-card">
                <h3 className="mb-4 font-semibold">Prévia do Perfil</h3>
                <div className="text-center">
                  <div className="relative mx-auto w-fit">
                    <Avatar className="h-20 w-20 ring-4 ring-border">
                      <AvatarImage src={profile.avatar_url} />
                      <AvatarFallback className="bg-primary/10 text-xl font-semibold text-primary">{initials}</AvatarFallback>
                    </Avatar>
                    {profile.is_verified && (
                      <div className="absolute -bottom-1 -right-1 rounded-full bg-success p-1 text-white ring-2 ring-background">
                        <CheckCircle className="h-3 w-3 fill-current" />
                      </div>
                    )}
                  </div>
                  <h4 className="mt-4 font-semibold flex items-center justify-center gap-1">
                    {profile.full_name || "Seu Nome"}
                    {profile.subscription_tier === 'yearly' && <Star className="h-4 w-4 text-primary fill-primary" />}
                  </h4>
                  <Badge variant="secondary" className="mt-2">
                    {specialties.find(s => s.value === profile.specialty)?.label || "Especialidade"}
                  </Badge>
                </div>
                <div className="mt-6 space-y-3 text-sm text-muted-foreground">
                  <div className="flex items-center gap-2"><Award className="h-4 w-4 text-primary" /> {profile.registration || "Registro"}</div>
                  <div className="flex items-center gap-2"><MapPin className="h-4 w-4 text-primary" /> {profile.city || "Cidade"}</div>
                  <div className="flex items-center gap-2"><Phone className="h-4 w-4 text-primary" /> {profile.phone || "WhatsApp"}</div>
                </div>
              </div>
            </div>

            <div className="lg:col-span-2">
              <div className="rounded-2xl border border-border bg-card p-6 shadow-card lg:p-8">
                <div className="mb-6 flex items-center justify-between">
                  <h3 className="text-xl font-semibold">Informações do Perfil</h3>
                  {!isEditing ? (
                    <Button onClick={() => setIsEditing(true)}>Editar Perfil</Button>
                  ) : (
                    <div className="flex gap-2">
                      <Button variant="outline" onClick={() => setIsEditing(false)}>Cancelar</Button>
                      <Button onClick={handleSave} disabled={isSaving}>{isSaving ? "Salvando..." : "Salvar"}</Button>
                    </div>
                  )}
                </div>

                <div className="space-y-6">
                  <div className="flex items-center gap-6">
                    <div className="relative group">
                      <Avatar className="h-24 w-24 ring-4 ring-border">
                        <AvatarImage src={profile.avatar_url} />
                        <AvatarFallback className="bg-primary/10 text-2xl font-semibold text-primary">{initials}</AvatarFallback>
                      </Avatar>
                      {isEditing && (
                        <button onClick={handleUploadClick} className="absolute inset-0 flex items-center justify-center rounded-full bg-black/40 text-white opacity-0 transition-opacity group-hover:opacity-100">
                          <Camera className="h-6 w-6" />
                        </button>
                      )}
                    </div>
                    <input type="file" ref={fileInputRef} onChange={handleFileChange} className="hidden" accept="image/*" />
                  </div>

                  <div className="grid gap-4 md:grid-cols-2">
                    <div className="grid gap-2"><Label>Nome Completo</Label><Input value={profile.full_name} onChange={e => setProfile({...profile, full_name: e.target.value})} disabled={!isEditing} /></div>
                    <div className="grid gap-2"><Label>WhatsApp</Label><Input value={profile.phone} onChange={e => setProfile({...profile, phone: e.target.value})} disabled={!isEditing} /></div>
                  </div>

                  <div className="grid gap-4 md:grid-cols-2">
                    <div className="grid gap-2">
                      <Label>Especialidade</Label>
                      <Select value={profile.specialty} onValueChange={v => setProfile({...profile, specialty: v})} disabled={!isEditing}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>{specialties.map(s => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}</SelectContent>
                      </Select>
                    </div>
                    <div className="grid gap-2"><Label>Registro</Label><Input value={profile.registration} onChange={e => setProfile({...profile, registration: e.target.value})} disabled={!isEditing} /></div>
                  </div>

                  <div className="grid gap-2">
                    <div className="flex items-center justify-between">
                      <Label>Mini-bio</Label>
                      {isEditing && <Button variant="ghost" size="sm" className="h-8 gap-2 text-primary" onClick={generateBioWithAI} disabled={isGeneratingBio}><Sparkles className="h-3 w-3" /> Gerar com IA</Button>}
                    </div>
                    <Textarea value={profile.bio} onChange={e => setProfile({...profile, bio: e.target.value})} disabled={!isEditing} rows={4} />
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </Layout>
  );
};

export default Dashboard;