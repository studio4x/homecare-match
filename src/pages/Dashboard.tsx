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
  Zap
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
    subscription_tier: "free",
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
    if (state?.selectedPlan && profile.subscription_tier === 'free' && !isUpgrading) {
      handleUpgrade(state.selectedPlan);
      // Limpa o state para não disparar novamente
      window.history.replaceState({}, document.title);
    }
  }, [location.state, profile.subscription_tier]);

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
        subscription_tier: data.subscription_tier || "free",
        is_verified: data.is_verified || false
      });
    }
  };

  const handleUpgrade = async (tier: string) => {
    if (!user) return;
    setIsUpgrading(true);
    
    try {
      // Simulação de checkout - Em produção aqui iria a integração com Stripe/Pagar.me
      await new Promise(resolve => setTimeout(resolve, 1500));

      const { error } = await supabase
        .from("profiles")
        .update({ 
          subscription_tier: tier,
          is_verified: tier === 'yearly' ? true : profile.is_verified // Plano anual ganha verificação automática
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
      toast.error("Preencha seu nome, especialidade e experiência para que a IA possa gerar uma bio melhor.");
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
      console.error(error);
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
      options: {
        emailRedirectTo: window.location.origin,
      }
    });

    if (error) {
      toast.error("Erro ao reenviar: " + error.message);
    } else {
      toast.success("E-mail de confirmação reenviado com sucesso!");
    }
    setIsResending(false);
  };

  const handleUploadClick = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file || !user) return;

    if (!file.type.startsWith('image/')) {
      toast.error("Por favor, selecione uma imagem.");
      return;
    }

    if (file.size > 2 * 1024 * 1024) {
      toast.error("A imagem deve ter no máximo 2MB.");
      return;
    }

    setIsUploading(true);
    const fileExt = file.name.split('.').pop();
    const filePath = `${user.id}/${Math.random()}.${fileExt}`;

    try {
      const { error: uploadError } = await supabase.storage
        .from('avatars')
        .upload(filePath, file);

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage
        .from('avatars')
        .getPublicUrl(filePath);

      setProfile({ ...profile, avatar_url: publicUrl });
      
      const { error: updateError } = await supabase
        .from("profiles")
        .update({ avatar_url: publicUrl })
        .eq("id", user.id);

      if (updateError) throw updateError;

      toast.success("Foto atualizada!");
    } catch (error: any) {
      console.error(error);
      toast.error("Erro ao subir imagem.");
    } finally {
      setIsUploading(false);
    }
  };

  const handleSave = async () => {
    if (!user) return;
    setIsSaving(true);
    
    const { error } = await supabase
      .from("profiles")
      .upsert({
        id: user.id,
        ...profile,
        updated_at: new Date().toISOString(),
      });

    if (error) {
      toast.error("Erro ao salvar perfil.");
      console.error(error);
    } else {
      toast.success("Perfil atualizado com sucesso!");
      setIsEditing(false);
    }
    setIsSaving(false);
  };

  const handleDeleteAccount = async () => {
    if (deleteConfirmation !== "EXCLUIR") {
      toast.error("Digite EXCLUIR para confirmar.");
      return;
    }

    setIsDeleting(true);
    try {
      const { error } = await supabase.functions.invoke('delete-user');
      
      if (error) throw error;
      
      await signOut();
      toast.success("Sua conta foi excluída definitivamente.");
      navigate("/");
    } catch (error: any) {
      console.error(error);
      toast.error("Erro ao excluir conta. Tente novamente mais tarde.");
    } finally {
      setIsDeleting(false);
    }
  };

  const specialties = [
    { value: "enfermeiro", label: "Enfermeiro(a)" },
    { value: "tecnico-enfermagem", label: "Técnico(a) de Enfermagem" },
    { value: "fisioterapeuta", label: "Fisioterapeuta" },
    { value: "terapeuta-ocupacional", label: "Terapeuta Ocupacional" },
    { value: "fonoaudiologo", label: "Fonoaudiólogo(a)" },
    { value: "nutricionista", label: "Nutricionista" },
    { value: "cuidador", label: "Cuidador(a) de Idosos" },
  ];

  const states = [
    "AC", "AL", "AP", "AM", "BA", "CE", "DF", "ES", "GO", "MA",
    "MT", "MS", "MG", "PA", "PB", "PR", "PE", "PI", "RJ", "RN",
    "RS", "RO", "RR", "SC", "SP", "SE", "TO"
  ];

  if (loading) return null;
  if (!session) return <Navigate to="/login" replace />;

  const isEmailConfirmed = !!user?.email_confirmed_at;

  const initials = profile.full_name
    ? profile.full_name.split(" ").map(n => n[0]).join("").slice(0, 2).toUpperCase()
    : "??";

  const getTierLabel = () => {
    switch (profile.subscription_tier) {
      case 'yearly': return 'Plano Anual (Premium)';
      case 'monthly': return 'Plano Mensal';
      default: return 'Plano Gratuito';
    }
  };

  return (
    <Layout>
      <div className="min-h-screen bg-secondary/20 py-8">
        <div className="container mx-auto px-4">
          
          {/* Alerta de confirmação de e-mail */}
          {!isEmailConfirmed && (
            <Alert variant="destructive" className="mb-8 border-destructive/50 bg-destructive/5">
              <Mail className="h-4 w-4" />
              <AlertTitle>Confirme seu e-mail</AlertTitle>
              <AlertDescription className="flex flex-col gap-4">
                <p>
                  Enviamos um link de confirmação para <strong>{user?.email}</strong>. Por favor, valide seu e-mail para que seu perfil fique visível para as empresas.
                </p>
                <Button 
                  variant="outline" 
                  size="sm" 
                  className="w-fit gap-2 border-destructive/20 hover:bg-destructive/10"
                  onClick={handleResendEmail}
                  disabled={isResending}
                >
                  {isResending ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <RefreshCw className="h-4 w-4" />
                  )}
                  Reenviar e-mail de confirmação
                </Button>
              </AlertDescription>
            </Alert>
          )}

          <div className="mb-8 flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-foreground">Meu Perfil</h1>
              <p className="mt-2 text-muted-foreground">
                Gerencie suas informações profissionais e status da assinatura.
              </p>
            </div>
            <Button variant="ghost" onClick={signOut} className="gap-2 text-muted-foreground">
              <LogOut className="h-4 w-4" />
              Sair
            </Button>
          </div>

          <div className="grid gap-6 lg:grid-cols-3">
            {/* Sidebar - Status */}
            <div className="space-y-6 lg:col-span-1">
              <div className="rounded-2xl border border-border bg-card p-6 shadow-card">
                <h3 className="mb-4 font-semibold text-foreground">
                  Status da Assinatura
                </h3>
                <div className={cn(
                  "flex items-center gap-3 rounded-lg p-4",
                  profile.subscription_tier !== 'free' ? "bg-primary/10" : "bg-success/10"
                )}>
                  {profile.subscription_tier === 'yearly' ? (
                    <Star className="h-6 w-6 text-primary fill-primary" />
                  ) : profile.subscription_tier === 'monthly' ? (
                    <Zap className="h-6 w-6 text-primary fill-primary" />
                  ) : (
                    <CheckCircle className="h-6 w-6 text-success" />
                  )}
                  <div>
                    <p className={cn(
                      "font-medium",
                      profile.subscription_tier !== 'free' ? "text-primary" : "text-success"
                    )}>
                      {getTierLabel()}
                    </p>
                    <p className="text-sm text-muted-foreground">
                      {isEmailConfirmed ? "Perfil visível para empresas" : "Invisível (e-mail não confirmado)"}
                    </p>
                  </div>
                </div>

                {profile.subscription_tier === 'free' && (
                  <div className="mt-4 space-y-2">
                    <p className="text-xs text-muted-foreground mb-3">Upgrade para aparecer no topo das buscas e ganhar selo de verificação.</p>
                    <Button 
                      className="w-full gap-2" 
                      onClick={() => handleUpgrade('yearly')}
                      disabled={isUpgrading}
                    >
                      {isUpgrading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Star className="h-4 w-4" />}
                      Assinar Plano Anual
                    </Button>
                    <Button 
                      className="w-full" 
                      variant="outline"
                      onClick={() => handleUpgrade('monthly')}
                      disabled={isUpgrading}
                    >
                      Assinar Plano Mensal
                    </Button>
                  </div>
                )}
              </div>

              <div className="rounded-2xl border border-border bg-card p-6 shadow-card">
                <h3 className="mb-4 font-semibold text-foreground">
                  Prévia do Perfil
                </h3>
                <div className="text-center">
                  <div className="relative mx-auto w-fit">
                    <Avatar className="h-20 w-20 ring-4 ring-border shadow-md">
                      <AvatarImage src={profile.avatar_url} alt={profile.full_name} />
                      <AvatarFallback className="bg-primary/10 text-xl font-semibold text-primary">
                        {initials}
                      </AvatarFallback>
                    </Avatar>
                    {profile.is_verified && (
                      <div className="absolute -bottom-1 -right-1 rounded-full bg-success p-1 text-white ring-2 ring-background">
                        <CheckCircle className="h-3 w-3 fill-current" />
                      </div>
                    )}
                  </div>
                  <h4 className="mt-4 font-semibold text-foreground flex items-center justify-center gap-1">
                    {profile.full_name || "Seu Nome Aqui"}
                    {profile.subscription_tier === 'yearly' && <Star className="h-4 w-4 text-primary fill-primary" />}
                  </h4>
                  <Badge variant="secondary" className="mt-2">
                    {specialties.find((s) => s.value === profile.specialty)?.label || "Especialidade"}
                  </Badge>
                </div>

                <div className="mt-6 space-y-3">
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Award className="h-4 w-4 text-primary" />
                    <span>{profile.registration || "Registro Profissional"}</span>
                  </div>
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <MapPin className="h-4 w-4 text-primary" />
                    <span>
                      {profile.neighborhood || "Bairro"}, {profile.city || "Cidade"} - {profile.state || "UF"}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Phone className="h-4 w-4 text-primary" />
                    <span>{profile.phone || "WhatsApp não cadastrado"}</span>
                  </div>
                </div>
              </div>

              {/* Zona de Perigo */}
              <div className="rounded-2xl border border-destructive/20 bg-destructive/5 p-6 shadow-card">
                <h3 className="mb-4 font-semibold text-destructive flex items-center gap-2">
                  <AlertCircle className="h-4 w-4" />
                  Zona de Perigo
                </h3>
                <p className="text-xs text-muted-foreground mb-4">
                  A exclusão da conta é permanente e removerá todos os seus dados e visibilidade profissional.
                </p>
                
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button variant="destructive" className="w-full gap-2" size="sm">
                      <Trash2 className="h-4 w-4" />
                      Excluir Minha Conta
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>Você tem certeza absoluta?</AlertDialogTitle>
                      <AlertDialogDescription className="space-y-4">
                        <p>
                          Esta ação não pode ser desfeita. Isso excluirá permanentemente sua conta de nossos servidores.
                        </p>
                        <div className="space-y-2 rounded-lg bg-muted p-4">
                          <Label htmlFor="confirm" className="text-foreground">Para confirmar, digite <strong>EXCLUIR</strong> abaixo:</Label>
                          <Input 
                            id="confirm"
                            value={deleteConfirmation}
                            onChange={(e) => setDeleteConfirmation(e.target.value)}
                            placeholder="Digite EXCLUIR"
                            className="bg-background"
                          />
                        </div>
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel onClick={() => setDeleteConfirmation("")}>Cancelar</AlertDialogCancel>
                      <AlertDialogAction 
                        onClick={(e) => {
                          e.preventDefault();
                          handleDeleteAccount();
                        }}
                        className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                        disabled={deleteConfirmation !== "EXCLUIR" || isDeleting}
                      >
                        {isDeleting ? "Excluindo..." : "Sim, excluir minha conta"}
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              </div>
            </div>

            {/* Main Content */}
            <div className="lg:col-span-2">
              <div className="rounded-2xl border border-border bg-card p-6 shadow-card lg:p-8">
                <div className="mb-6 flex items-center justify-between">
                  <h3 className="text-xl font-semibold text-foreground">
                    Informações do Perfil
                  </h3>
                  {!isEditing ? (
                    <Button onClick={() => setIsEditing(true)}>
                      Editar Perfil
                    </Button>
                  ) : (
                    <div className="flex gap-2">
                      <Button variant="outline" onClick={() => setIsEditing(false)} disabled={isSaving}>
                        Cancelar
                      </Button>
                      <Button onClick={handleSave} className="gap-2" disabled={isSaving}>
                        {isSaving ? "Salvando..." : (
                          <>
                            <Save className="h-4 w-4" />
                            Salvar
                          </>
                        )}
                      </Button>
                    </div>
                  )}
                </div>

                <div className="space-y-6">
                  {/* Photo Upload */}
                  <div className="flex items-center gap-6">
                    <div className="relative group">
                      <Avatar className="h-24 w-24 ring-4 ring-border">
                        <AvatarImage src={profile.avatar_url} alt={profile.full_name} />
                        <AvatarFallback className="bg-primary/10 text-2xl font-semibold text-primary">
                          {initials}
                        </AvatarFallback>
                      </Avatar>
                      {isEditing && (
                        <button 
                          onClick={handleUploadClick}
                          className="absolute inset-0 flex items-center justify-center rounded-full bg-black/40 text-white opacity-0 transition-opacity group-hover:opacity-100"
                        >
                          <Camera className="h-6 w-6" />
                        </button>
                      )}
                    </div>
                    {isEditing && (
                      <div className="flex-1">
                        <input 
                          type="file" 
                          ref={fileInputRef} 
                          onChange={handleFileChange}
                          className="hidden" 
                          accept="image/*"
                        />
                        <Button 
                          variant="outline" 
                          size="sm" 
                          className="gap-2" 
                          onClick={handleUploadClick}
                          disabled={isUploading}
                        >
                          {isUploading ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <Camera className="h-4 w-4" />
                          )}
                          Alterar Foto
                        </Button>
                        <p className="mt-2 text-xs text-muted-foreground">
                          JPG ou PNG. Máx. 2MB. Clique na foto para alterar.
                        </p>
                      </div>
                    )}
                  </div>

                  {/* Nome e WhatsApp */}
                  <div className="grid gap-4 md:grid-cols-2">
                    <div className="grid gap-2">
                      <Label htmlFor="full_name">Nome Completo</Label>
                      <Input
                        id="full_name"
                        value={profile.full_name}
                        onChange={(e) => setProfile({ ...profile, full_name: e.target.value })}
                        disabled={!isEditing}
                      />
                    </div>
                    <div className="grid gap-2">
                      <Label htmlFor="phone">WhatsApp (com DDD)</Label>
                      <Input
                        id="phone"
                        value={profile.phone}
                        onChange={(e) => setProfile({ ...profile, phone: e.target.value })}
                        disabled={!isEditing}
                        placeholder="Ex: 11999999999"
                      />
                    </div>
                  </div>

                  {/* Especialidade e Registro */}
                  <div className="grid gap-4 md:grid-cols-2">
                    <div className="grid gap-2">
                      <Label htmlFor="specialty">Especialidade</Label>
                      <Select
                        value={profile.specialty}
                        onValueChange={(value) => setProfile({ ...profile, specialty: value })}
                        disabled={!isEditing}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Selecione" />
                        </SelectTrigger>
                        <SelectContent>
                          {specialties.map((spec) => (
                            <SelectItem key={spec.value} value={spec.value}>
                              {spec.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="grid gap-2">
                      <Label htmlFor="registration">Registro Profissional</Label>
                      <Input
                        id="registration"
                        value={profile.registration}
                        onChange={(e) => setProfile({ ...profile, registration: e.target.value })}
                        disabled={!isEditing}
                      />
                    </div>
                  </div>

                  {/* Localização */}
                  <div className="grid gap-4 md:grid-cols-3">
                    <div className="grid gap-2">
                      <Label htmlFor="neighborhood">Bairro</Label>
                      <Input
                        id="neighborhood"
                        value={profile.neighborhood}
                        onChange={(e) => setProfile({ ...profile, neighborhood: e.target.value })}
                        disabled={!isEditing}
                      />
                    </div>
                    <div className="grid gap-2">
                      <Label htmlFor="city">Cidade</Label>
                      <Input
                        id="city"
                        value={profile.city}
                        onChange={(e) => setProfile({ ...profile, city: e.target.value })}
                        disabled={!isEditing}
                      />
                    </div>
                    <div className="grid gap-2">
                      <Label htmlFor="state">Estado</Label>
                      <Select
                        value={profile.state}
                        onValueChange={(value) => setProfile({ ...profile, state: value })}
                        disabled={!isEditing}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="UF" />
                        </SelectTrigger>
                        <SelectContent>
                          {states.map((state) => (
                            <SelectItem key={state} value={state}>
                              {state}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  <div className="grid gap-2">
                    <Label htmlFor="experience">Experiência Profissional</Label>
                    <Textarea
                      id="experience"
                      value={profile.experience}
                      onChange={(e) => setProfile({ ...profile, experience: e.target.value })}
                      disabled={!isEditing}
                      rows={3}
                      placeholder="Ex: 5 anos de atuação em UTI, experiência com pacientes de alta complexidade..."
                    />
                  </div>

                  <div className="grid gap-2">
                    <div className="flex items-center justify-between">
                      <Label htmlFor="bio">Mini-bio</Label>
                      {isEditing && (
                        <Button 
                          type="button" 
                          variant="ghost" 
                          size="sm" 
                          className="h-8 gap-2 text-primary hover:text-primary/80 hover:bg-primary/5"
                          onClick={generateBioWithAI}
                          disabled={isGeneratingBio}
                        >
                          {isGeneratingBio ? (
                            <Loader2 className="h-3 w-3 animate-spin" />
                          ) : (
                            <Sparkles className="h-3 w-3" />
                          )}
                          Gerar com IA
                        </Button>
                      )}
                    </div>
                    <Textarea
                      id="bio"
                      value={profile.bio}
                      onChange={(e) => setProfile({ ...profile, bio: e.target.value })}
                      disabled={!isEditing}
                      rows={4}
                      placeholder="Conte um pouco sobre sua trajetória profissional..."
                    />
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