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
import { useNavigate, useLocation, Link } from "react-router-dom";

const Dashboard = () => {
  const { user, session, loading: authLoading, signOut } = useAuth();
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
  const [isLoadingProfile, setIsLoadingProfile] = useState(true);
  
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
    if (!authLoading) {
      if (!session) {
        navigate("/login");
      } else {
        fetchProfile();
      }
    }
  }, [authLoading, session, user]);

  useEffect(() => {
    const state = location.state as { selectedPlan?: string };
    if (state?.selectedPlan && !isUpgrading) {
      handleUpgrade(state.selectedPlan);
      window.history.replaceState({}, document.title);
    }
  }, [location.state]);

  const fetchProfile = async () => {
    try {
      if (!user?.id) return;
      
      const { data, error } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", user.id)
        .single();

      if (error) throw error;

      if (data) {
        if (data.is_admin || data.role === 'admin') {
          navigate('/admin', { replace: true });
          return;
        }

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
    } catch (err) {
      console.error("Erro ao carregar perfil:", err);
    } finally {
      setIsLoadingProfile(false);
    }
  };

  const handleUpgrade = async (tier: string) => {
    if (!user) return;
    setIsUpgrading(true);
    try {
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
      toast.success(`Plano ativado!`);
    } catch (error) {
      toast.error("Erro na assinatura.");
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

      toast.success("Arquivo atualizado!");
    } catch (error: any) {
      toast.error("Erro no upload.");
    } finally {
      setIsUploading(false);
      setIsUploadingDoc(null);
    }
  };

  const handleSubmitVerification = async () => {
    if (!profile.id_document_url || !profile.prof_registration_url) {
      toast.error("Envie os documentos antes.");
      return;
    }
    setIsSubmittingDocs(true);
    try {
      await supabase.functions.invoke('notify-verification', {
        body: { userName: profile.full_name, userEmail: user?.email, userId: user?.id }
      });
      await supabase.from("profiles").update({ verification_sent: true }).eq("id", user?.id);
      setProfile(prev => ({ ...prev, verification_sent: true }));
      toast.success("Enviado para análise!");
    } catch (error) {
      toast.error("Erro ao processar.");
    } finally {
      setIsSubmittingDocs(false);
    }
  };

  const generateBioWithAI = async () => {
    if (!profile.full_name || !profile.specialty || !profile.experience) {
      toast.error("Preencha os campos básicos.");
      return;
    }
    setIsGeneratingBio(true);
    try {
      const { data, error } = await supabase.functions.invoke('generate-bio', {
        body: {
          name: profile.full_name,
          specialty: profile.specialty,
          experience: profile.experience,
          city: profile.city,
          state: profile.state
        }
      });
      if (error) throw error;
      setProfile(prev => ({ ...prev, bio: data.bio }));
    } catch (error: any) {
      toast.error("Erro na IA.");
    } finally {
      setIsGeneratingBio(false);
    }
  };

  const handleDeleteAccount = async () => {
    if (deleteConfirmation !== "EXCLUIR") return;
    setIsDeleting(true);
    try {
      await supabase.functions.invoke('delete-user');
      await signOut();
      navigate("/");
    } catch (error: any) {
      toast.error("Erro ao excluir.");
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
      toast.success("Salvo!");
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
  const initials = profile.full_name ? profile.full_name.split(" ").map(n => n[0]).join("").slice(0, 2).toUpperCase() : "??";

  return (
    <Layout>
      <div className="min-h-screen bg-secondary/20 py-8">
        <div className="container mx-auto px-4">
          {!isEmailConfirmed && (
            <Alert variant="destructive" className="mb-8">
              <Mail className="h-4 w-4" />
              <AlertTitle>Confirme seu e-mail</AlertTitle>
              <AlertDescription>Valide seu e-mail para visibilidade.</AlertDescription>
            </Alert>
          )}

          <div className="mb-8 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <h1 className="text-3xl font-bold">Meu Perfil</h1>
            <div className="flex flex-wrap gap-2">
              <Button variant="outline" asChild className="gap-2">
                <Link to={`/profissional/${user?.id}`}><ExternalLink className="h-4 w-4" /> Ver Público</Link>
              </Button>
              <Button variant="ghost" onClick={signOut} className="gap-2 hover:text-destructive"><LogOut className="h-4 w-4" /> Sair</Button>
            </div>
          </div>

          <div className="grid gap-6 lg:grid-cols-3">
            <div className="space-y-6">
              <div className="rounded-2xl border bg-card p-6 shadow-card">
                <h3 className="mb-4 font-semibold">Verificação</h3>
                {profile.is_verified ? (
                  <div className="flex flex-col items-center py-4 text-center">
                    <CheckCircle2 className="h-10 w-10 text-success mb-2" />
                    <p className="font-semibold">Verificado</p>
                  </div>
                ) : profile.verification_sent ? (
                  <div className="flex flex-col items-center py-4 text-center">
                    <Clock className="h-10 w-10 text-primary animate-pulse mb-2" />
                    <p className="font-semibold">Em análise</p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    <Button variant="outline" size="sm" className="w-full border-dashed" onClick={() => idDocRef.current?.click()} disabled={!!isUploadingDoc}>
                      {isUploadingDoc === 'id_doc' ? <Loader2 className="h-4 w-4 animate-spin" /> : "Enviar RG/CNH"}
                    </Button>
                    <input type="file" ref={idDocRef} onChange={(e) => handleFileUpload(e, 'id_doc')} className="hidden" />
                    
                    <Button variant="outline" size="sm" className="w-full border-dashed" onClick={() => profDocRef.current?.click()} disabled={!!isUploadingDoc}>
                      {isUploadingDoc === 'prof_doc' ? <Loader2 className="h-4 w-4 animate-spin" /> : "Enviar Registro"}
                    </Button>
                    <input type="file" ref={profDocRef} onChange={(e) => handleFileUpload(e, 'prof_doc')} className="hidden" />
                    
                    <Button onClick={handleSubmitVerification} className="w-full" disabled={isSubmittingDocs || !profile.id_document_url || !profile.prof_registration_url}>Verificar</Button>
                  </div>
                )}
              </div>
            </div>

            <div className="lg:col-span-2">
              <div className="rounded-2xl border bg-card p-6 shadow-card">
                <div className="mb-6 flex items-center justify-between">
                  <h3 className="text-xl font-semibold">Dados</h3>
                  {!isEditing ? <Button onClick={() => setIsEditing(true)}>Editar</Button> : <Button onClick={handleSave} disabled={isSaving}>Salvar</Button>}
                </div>
                <div className="space-y-6">
                  <Avatar className="h-20 w-20 ring-4 ring-border"><AvatarImage src={profile.avatar_url} /><AvatarFallback>{initials}</AvatarFallback></Avatar>
                  <div className="grid gap-4 md:grid-cols-2">
                    <div className="grid gap-2"><Label>Nome</Label><Input value={profile.full_name} onChange={e => setProfile({...profile, full_name: e.target.value})} disabled={!isEditing} /></div>
                    <div className="grid gap-2"><Label>WhatsApp</Label><Input value={profile.phone} onChange={e => setProfile({...profile, phone: e.target.value})} disabled={!isEditing} /></div>
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