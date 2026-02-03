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
  CheckCircle2,
  Clock,
  ExternalLink,
  FileCheck,
  Loader2,
  LogOut,
  Mail,
  Send,
  ShieldAlert,
  Sparkles,
  Star,
  Trash2,
  Upload,
  Zap
} from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/components/auth/AuthProvider";
import { supabase } from "@/integrations/supabase/client";
import { Navigate, useNavigate, useLocation, Link } from "react-router-dom";

const Dashboard = () => {
  const { user, session, loading, signOut } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [isSaving, setIsSaving] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [isUploadingDoc, setIsUploadingDoc] = useState<string | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [isGeneratingBio, setIsGeneratingBio] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isUpgrading, setIsUpgrading] = useState(false);
  const [isSubmittingDocs, setIsSubmittingDocs] = useState(false);
  const [deleteConfirmation, setDeleteConfirmation] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);
  const idDocRef = useRef<HTMLInputElement>(null);
  const profDocRef = useRef<HTMLInputElement>(null);
  
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
    is_verified: false,
    verification_sent: false,
    id_document_url: "",
    prof_registration_url: ""
  });

  useEffect(() => {
    if (user) {
      fetchProfile();
    }
  }, [user]);

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
        is_verified: data.is_verified || false,
        verification_sent: data.verification_sent || false,
        id_document_url: data.id_document_url || "",
        prof_registration_url: data.prof_registration_url || ""
      });
    }
  };

  const handleUpgrade = async (tier: string) => {
    if (!user) return;
    setIsUpgrading(true);
    
    try {
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

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>, type: 'avatar' | 'id_doc' | 'prof_doc') => {
    const file = event.target.files?.[0];
    if (!file || !user) return;

    if (type === 'avatar') setIsUploading(true);
    else setIsUploadingDoc(type);

    const fileExt = file.name.split('.').pop();
    const bucket = type === 'avatar' ? 'avatars' : 'documents';
    const filePath = `${user.id}/${Math.random()}.${fileExt}`;

    try {
      const { error: uploadError } = await supabase.storage.from(bucket).upload(filePath, file);
      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage.from(bucket).getPublicUrl(filePath);
      
      let updateData = {};
      if (type === 'avatar') {
        updateData = { avatar_url: publicUrl };
        setProfile(prev => ({ ...prev, avatar_url: publicUrl }));
      } else if (type === 'id_doc') {
        updateData = { id_document_url: publicUrl };
        setProfile(prev => ({ ...prev, id_document_url: publicUrl }));
      } else if (type === 'prof_doc') {
        updateData = { prof_registration_url: publicUrl };
        setProfile(prev => ({ ...prev, prof_registration_url: publicUrl }));
      }

      const { error: updateError } = await supabase.from("profiles").update(updateData).eq("id", user.id);
      if (updateError) throw updateError;

      toast.success(type === 'avatar' ? "Foto atualizada!" : "Documento enviado com sucesso!");
    } catch (error: any) {
      console.error(error);
      toast.error("Erro ao enviar arquivo.");
    } finally {
      setIsUploading(false);
      setIsUploadingDoc(null);
    }
  };

  const handleSubmitVerification = async () => {
    if (!profile.id_document_url || !profile.prof_registration_url) {
      toast.error("Por favor, envie ambos os documentos antes de solicitar a verificação.");
      return;
    }

    setIsSubmittingDocs(true);
    try {
      await supabase.functions.invoke('notify-verification', {
        body: {
          userName: profile.full_name,
          userEmail: user?.email,
          userId: user?.id
        }
      });

      const { error } = await supabase
        .from("profiles")
        .update({ verification_sent: true })
        .eq("id", user?.id);

      if (error) throw error;

      setProfile(prev => ({ ...prev, verification_sent: true }));
      toast.success("Documentos enviados com sucesso!");
    } catch (error) {
      console.error(error);
      toast.error("Ocorreu um erro ao processar seu pedido.");
    } finally {
      setIsSubmittingDocs(false);
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

  const handleDeleteAccount = async () => {
    if (deleteConfirmation !== "EXCLUIR") {
      toast.error("Digite EXCLUIR para confirmar.");
      return;
    }
    setIsDeleting(true);
    try {
      const { error } = await supabase.functions.invoke('delete-user');
      if (error) throw error;
      toast.success("Sua conta foi excluída definitivamente.");
      await signOut();
      navigate("/");
    } catch (error: any) {
      toast.error("Erro ao excluir conta.");
    } finally {
      setIsDeleting(false);
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
              </AlertDescription>
            </Alert>
          )}

          <div className="mb-8 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <h1 className="text-3xl font-bold">Meu Perfil</h1>
            <div className="flex flex-wrap gap-2">
              <Button variant="outline" asChild className="gap-2">
                <Link to={`/profissional/${user?.id}`}>
                  <ExternalLink className="h-4 w-4" /> Ver Perfil Público
                </Link>
              </Button>
              <Button variant="ghost" onClick={signOut} className="gap-2 text-muted-foreground hover:text-destructive hover:bg-destructive/10">
                <LogOut className="h-4 w-4" /> Sair
              </Button>
            </div>
          </div>

          <div className="grid gap-6 lg:grid-cols-3">
            <div className="space-y-6">
              {/* Verificação de Identidade */}
              <div className="rounded-2xl border border-border bg-card p-6 shadow-card">
                <h3 className="mb-4 font-semibold">Verificação de Identidade</h3>
                
                {profile.is_verified ? (
                  <div className="flex flex-col items-center justify-center py-4 text-center">
                    <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-success/10">
                      <CheckCircle2 className="h-6 w-6 text-success" />
                    </div>
                    <p className="font-semibold text-foreground">Perfil Verificado</p>
                    <p className="mt-1 text-xs text-muted-foreground">Sua identidade foi validada com sucesso.</p>
                  </div>
                ) : profile.verification_sent ? (
                  <div className="flex flex-col items-center justify-center py-4 text-center">
                    <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
                      <Clock className="h-6 w-6 text-primary animate-pulse" />
                    </div>
                    <p className="font-semibold text-foreground">Análise em Andamento</p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      Seus documentos foram enviados e estão sendo analisados pela nossa equipe. 
                      Aguarde o retorno em até 48 horas úteis.
                    </p>
                  </div>
                ) : (
                  <>
                    <p className="text-xs text-muted-foreground mb-4">
                      Envie seus documentos para validarmos seu perfil. Estes arquivos são privados.
                    </p>
                    
                    <div className="space-y-4">
                      <div className="space-y-2">
                        <Label className="text-xs">RG ou CNH (Frente e Verso)</Label>
                        <div className="flex items-center gap-2">
                          <Button 
                            variant="outline" 
                            size="sm" 
                            className="w-full gap-2 border-dashed"
                            onClick={() => idDocRef.current?.click()}
                            disabled={!!isUploadingDoc}
                          >
                            {isUploadingDoc === 'id_doc' ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
                            {profile.id_document_url ? "Substituir Documento" : "Enviar RG/CNH"}
                          </Button>
                          {profile.id_document_url && <FileCheck className="h-5 w-5 text-success" />}
                        </div>
                        <input type="file" ref={idDocRef} onChange={(e) => handleFileUpload(e, 'id_doc')} className="hidden" accept="image/*,.pdf" />
                      </div>

                      <div className="space-y-2">
                        <Label className="text-xs">Registro Profissional (COREN, etc)</Label>
                        <div className="flex items-center gap-2">
                          <Button 
                            variant="outline" 
                            size="sm" 
                            className="w-full gap-2 border-dashed"
                            onClick={() => profDocRef.current?.click()}
                            disabled={!!isUploadingDoc}
                          >
                            {isUploadingDoc === 'prof_doc' ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
                            {profile.prof_registration_url ? "Substituir Documento" : "Enviar Registro"}
                          </Button>
                          {profile.prof_registration_url && <FileCheck className="h-5 w-5 text-success" />}
                        </div>
                        <input type="file" ref={profDocRef} onChange={(e) => handleFileUpload(e, 'prof_doc')} className="hidden" accept="image/*,.pdf" />
                      </div>

                      <div className="pt-2">
                        <Button 
                          onClick={handleSubmitVerification} 
                          className="w-full gap-2 bg-primary hover:bg-primary/90"
                          disabled={isSubmittingDocs || !profile.id_document_url || !profile.prof_registration_url}
                        >
                          {isSubmittingDocs ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                          Enviar para Análise
                        </Button>
                      </div>
                    </div>
                  </>
                )}
              </div>

              <div className="rounded-2xl border border-border bg-card p-6 shadow-card">
                <h3 className="mb-4 font-semibold">Assinatura Ativa</h3>
                <div className="flex items-center gap-3 rounded-lg bg-primary/10 p-4">
                  {profile.subscription_tier === 'yearly' ? <Star className="h-6 w-6 text-primary fill-primary" /> : <Zap className="h-6 w-6 text-primary fill-primary" />}
                  <div>
                    <p className="font-medium text-primary">{profile.subscription_tier === 'yearly' ? 'Plano Anual' : 'Plano Mensal'}</p>
                    <p className="text-xs text-muted-foreground">Status: Ativo</p>
                  </div>
                </div>
              </div>

              <div className="rounded-2xl border border-destructive/20 bg-destructive/5 p-6 shadow-sm">
                <h3 className="mb-4 font-semibold text-destructive flex items-center gap-2"><ShieldAlert className="h-4 w-4" /> Zona de Perigo</h3>
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button variant="destructive" className="w-full gap-2"><Trash2 className="h-4 w-4" /> Excluir Minha Conta</Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>Você tem certeza?</AlertDialogTitle>
                      <AlertDialogDescription>Digite EXCLUIR para confirmar.</AlertDialogDescription>
                      <Input className="mt-4" value={deleteConfirmation} onChange={e => setDeleteConfirmation(e.target.value)} />
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Cancelar</AlertDialogCancel>
                      <AlertDialogAction onClick={handleDeleteAccount} className="bg-destructive" disabled={deleteConfirmation !== "EXCLUIR"}>Sim, excluir</AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              </div>
            </div>

            <div className="lg:col-span-2">
              <div className="rounded-2xl border border-border bg-card p-6 shadow-card lg:p-8">
                <div className="mb-6 flex items-center justify-between">
                  <h3 className="text-xl font-semibold">Informações do Perfil</h3>
                  {!isEditing ? <Button onClick={() => setIsEditing(true)}>Editar Perfil</Button> : <div className="flex gap-2"><Button variant="outline" onClick={() => setIsEditing(false)}>Cancelar</Button><Button onClick={handleSave} disabled={isSaving}>{isSaving ? "Salvando..." : "Salvar"}</Button></div>}
                </div>

                <div className="space-y-6">
                  <div className="flex items-center gap-6">
                    <div className="relative group">
                      <Avatar className="h-24 w-24 ring-4 ring-border">
                        <AvatarImage src={profile.avatar_url} />
                        <AvatarFallback className="bg-primary/10 text-2xl font-semibold text-primary">{initials}</AvatarFallback>
                      </Avatar>
                      {isEditing && <button onClick={() => fileInputRef.current?.click()} className="absolute inset-0 flex items-center justify-center rounded-full bg-black/40 text-white opacity-0 group-hover:opacity-100"><Camera className="h-6 w-6" /></button>}
                    </div>
                    <input type="file" ref={fileInputRef} onChange={e => handleFileUpload(e, 'avatar')} className="hidden" accept="image/*" />
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
                    <Label>Experiência Profissional</Label>
                    <Textarea value={profile.experience} onChange={e => setProfile({...profile, experience: e.target.value})} disabled={!isEditing} rows={3} />
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