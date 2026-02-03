"use client";

import { useState, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import Layout from "@/components/layout/Layout";
import {
  CheckCircle2,
  Clock,
  ExternalLink,
  Loader2,
  LogOut,
  Mail,
  ShieldAlert,
  Star
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
  }, [authLoading, session]);

  const fetchProfile = async () => {
    if (!user?.id) return;

    try {
      const { data, error } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", user.id)
        .maybeSingle();

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
      console.error("[Dashboard] Erro:", err);
    } finally {
      setIsLoadingProfile(false);
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
      toast.success("Documento atualizado!");
    } catch (error: any) {
      toast.error("Erro no upload.");
    } finally {
      setIsUploadingDoc(null);
    }
  };

  const handleSave = async () => {
    if (!user) return;
    setIsSaving(true);
    const { error } = await supabase.from("profiles").update({
      full_name: profile.full_name,
      phone: profile.phone,
      bio: profile.bio,
      experience: profile.experience,
      city: profile.city,
      state: profile.state,
      neighborhood: profile.neighborhood,
      specialty: profile.specialty,
      registration: profile.registration
    }).eq("id", user.id);

    if (error) toast.error("Erro ao salvar.");
    else {
      toast.success("Perfil atualizado!");
      setIsEditing(false);
    }
    setIsSaving(false);
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
  const initials = profile.full_name ? profile.full_name.split(" ").map(n => n[0]).join("").slice(0, 2).toUpperCase() : "??";

  return (
    <Layout>
      <div className="min-h-screen bg-secondary/20 py-8">
        <div className="container mx-auto px-4">
          {!isEmailConfirmed && (
            <Alert variant="destructive" className="mb-8">
              <Mail className="h-4 w-4" />
              <AlertTitle>Confirme seu e-mail</AlertTitle>
              <AlertDescription>Valide seu e-mail para que seu perfil apareça nas buscas.</AlertDescription>
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
                <h3 className="mb-4 font-semibold">Status de Verificação</h3>
                {profile.is_verified ? (
                  <div className="flex flex-col items-center py-4 text-center">
                    <CheckCircle2 className="h-10 w-10 text-success mb-2" />
                    <p className="font-semibold text-success">Perfil Verificado</p>
                  </div>
                ) : profile.verification_sent ? (
                  <div className="flex flex-col items-center py-4 text-center">
                    <Clock className="h-10 w-10 text-primary animate-pulse mb-2" />
                    <p className="font-semibold">Documentos em Análise</p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    <p className="text-sm text-muted-foreground mb-4">Envie seus documentos para ganhar o selo de verificação.</p>
                    <div className="space-y-3">
                      <div>
                        <Label className="text-xs mb-1 block">RG ou CNH (Frente/Verso)</Label>
                        <Button variant="outline" size="sm" className="w-full border-dashed" onClick={() => idDocRef.current?.click()} disabled={!!isUploadingDoc}>
                          {isUploadingDoc === 'id_doc' ? <Loader2 className="h-4 w-4 animate-spin" /> : profile.id_document_url ? "Documento Enviado ✓" : "Selecionar Arquivo"}
                        </Button>
                        <input type="file" ref={idDocRef} onChange={(e) => handleFileUpload(e, 'id_doc')} className="hidden" accept="image/*,.pdf" />
                      </div>
                      
                      <div>
                        <Label className="text-xs mb-1 block">Registro Profissional (COREN/CREFITO)</Label>
                        <Button variant="outline" size="sm" className="w-full border-dashed" onClick={() => profDocRef.current?.click()} disabled={!!isUploadingDoc}>
                          {isUploadingDoc === 'prof_doc' ? <Loader2 className="h-4 w-4 animate-spin" /> : profile.prof_registration_url ? "Registro Enviado ✓" : "Selecionar Arquivo"}
                        </Button>
                        <input type="file" ref={profDocRef} onChange={(e) => handleFileUpload(e, 'prof_doc')} className="hidden" accept="image/*,.pdf" />
                      </div>
                    </div>
                    
                    <Button onClick={() => toast.promise(supabase.functions.invoke('notify-verification', { body: { userName: profile.full_name, userId: user?.id }}), { loading: 'Enviando...', success: 'Enviado para análise!', error: 'Erro ao enviar.' })} className="w-full mt-4" disabled={!profile.id_document_url || !profile.prof_registration_url}>Solicitar Verificação</Button>
                  </div>
                )}
              </div>
            </div>

            <div className="lg:col-span-2">
              <div className="rounded-2xl border bg-card p-6 shadow-card">
                <div className="mb-6 flex items-center justify-between">
                  <h3 className="text-xl font-semibold">Dados Profissionais</h3>
                  {!isEditing ? (
                    <Button onClick={() => setIsEditing(true)}>Editar Perfil</Button>
                  ) : (
                    <div className="flex gap-2">
                      <Button variant="ghost" onClick={() => setIsEditing(false)}>Cancelar</Button>
                      <Button onClick={handleSave} disabled={isSaving}>
                        {isSaving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                        Salvar Alterações
                      </Button>
                    </div>
                  )}
                </div>
                
                <div className="space-y-6">
                  <div className="flex items-center gap-4">
                    <Avatar className="h-20 w-20 ring-4 ring-border">
                      <AvatarImage src={profile.avatar_url} />
                      <AvatarFallback className="text-xl">{initials}</AvatarFallback>
                    </Avatar>
                    {isEditing && (
                      <Button variant="outline" size="sm" onClick={() => idDocRef.current?.click()}>Alterar Foto</Button>
                    )}
                  </div>

                  <div className="grid gap-4 md:grid-cols-2">
                    <div className="grid gap-2">
                      <Label>Nome Completo</Label>
                      <Input value={profile.full_name} onChange={e => setProfile({...profile, full_name: e.target.value})} disabled={!isEditing} />
                    </div>
                    <div className="grid gap-2">
                      <Label>WhatsApp (com DDD)</Label>
                      <Input value={profile.phone} onChange={e => setProfile({...profile, phone: e.target.value})} disabled={!isEditing} placeholder="11999999999" />
                    </div>
                    <div className="grid gap-2">
                      <Label>Especialidade</Label>
                      <Input value={profile.specialty} onChange={e => setProfile({...profile, specialty: e.target.value})} disabled={!isEditing} />
                    </div>
                    <div className="grid gap-2">
                      <Label>Registro (COREN/CREFITO)</Label>
                      <Input value={profile.registration} onChange={e => setProfile({...profile, registration: e.target.value})} disabled={!isEditing} />
                    </div>
                  </div>

                  <div className="grid gap-2">
                    <Label>Biografia Profissional</Label>
                    <Textarea 
                      value={profile.bio} 
                      onChange={e => setProfile({...profile, bio: e.target.value})} 
                      disabled={!isEditing} 
                      className="h-32"
                      placeholder="Conte um pouco sobre sua trajetória e diferenciais..."
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