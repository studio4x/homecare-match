"use client";

import { useState, useEffect, useRef } from "react";
import { useAuth } from "@/components/auth/AuthProvider";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Separator } from "@/components/ui/separator";
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from "@/components/ui/select";
import { 
  Loader2, 
  Save, 
  Camera, 
  RefreshCw, 
  Sparkles, 
  Trash2,
  ShieldAlert,
  FileCheck,
  CheckCircle2,
  ArrowRight,
  Clock,
  Lock,
  ShieldCheck,
  KeyRound,
  AlertTriangle,
  AlertCircle,
  Check,
  ChevronDown,
  ChevronUp,
  Mail,
  PlayCircle,
  HelpCircle,
  MapPin,
  Navigation
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogDescription,
  DialogHeader,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import ChangePasswordDialog from "@/components/ChangePasswordDialog";
import OnboardingModal from "@/components/OnboardingModal";
import { getCoordinates } from "@/lib/geo-utils";

const ProfilePage = () => {
  const { user, signOut } = useAuth();
  const [profile, setProfile] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isGeneratingBio, setIsGeneratingBio] = useState(false);
  const [isUploading, setIsUploading] = useState<string | null>(null);
  const [isLoadingCep, setIsLoadingCep] = useState(false);
  const [isGeocoding, setIsGeocoding] = useState(false);
  const [isDangerZoneOpen, setIsDangerZoneOpen] = useState(false);
  const [isOnboardingOpen, setIsOnboardingOpen] = useState(false);
  
  const [deleteAccountModalOpen, setDeleteAccountModalOpen] = useState(false);
  const [deleteStep, setDeleteStep] = useState<1 | 2>(1);
  const [deleteConfirmationText, setDeleteConfirmationText] = useState("");
  const [isDeletingAccount, setIsDeletingAccount] = useState(false);

  const avatarRef = useRef<HTMLInputElement>(null);
  const idDocRef = useRef<HTMLInputElement>(null);
  const profDocRef = useRef<HTMLInputElement>(null);

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

  const availabilityOptions = [
    "Período da Manhã",
    "Período da Tarde",
    "Período da Noite",
    "Dia Integral (Diurno)",
    "Plantão 12h (Noturno)",
    "Finais de Semana",
  ];

  const patientProfileOptions = [
    "Idosos",
    "Pediátrico",
    "Pós-cirúrgico",
    "Doenças Crônicas",
    "Cuidados Paliativos",
    "Reabilitação Neurológica",
  ];

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
      
      setProfile({
        ...data,
        availability: data.availability || [],
        patient_profiles: data.patient_profiles || [],
      });
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handlePhoneChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const numbers = e.target.value.replace(/\D/g, '').slice(0, 11);
    let formatted = numbers;
    if (numbers.length > 2) formatted = `(${numbers.slice(0, 2)}) ${numbers.slice(2)}`;
    if (numbers.length > 7) formatted = `(${numbers.slice(0, 2)}) ${numbers.slice(2, 7)}-${numbers.slice(7)}`;
    setProfile({ ...profile, phone: formatted });
  };

  const handleCepBlur = async () => {
    if (!profile.address_zip) return;
    const cep = profile.address_zip.replace(/\D/g, '');
    if (cep.length !== 8) return;
    setIsLoadingCep(true);
    try {
      const response = await fetch(`https://viacep.com.br/ws/${cep}/json/`);
      const data = await response.json();
      if (!data.erro) {
        setProfile(prev => ({
          ...prev,
          address_street: data.logradouro,
          neighborhood: data.bairro,
          city: data.localidade,
          state: data.uf
        }));
      }
    } finally {
      setIsLoadingCep(false);
    }
  };

  const handleValidateLocation = async () => {
    if (!profile.address_street || !profile.city || !profile.state) {
      toast.error("Preencha rua, cidade e estado para validar a localização.");
      return;
    }

    setIsGeocoding(true);
    try {
      const fullAddress = `${profile.address_street}, ${profile.address_number || ""}, ${profile.neighborhood}, ${profile.city} - ${profile.state}, Brasil`;
      const coords = await getCoordinates(fullAddress);

      if (coords) {
        setProfile(prev => ({ ...prev, lat: coords.lat, lng: coords.lng }));
        toast.success("Localização detectada com sucesso!");
      } else {
        toast.error("Não foi possível encontrar as coordenadas para este endereço. Verifique se os dados estão corretos.");
      }
    } catch (err) {
      toast.error("Erro ao buscar coordenadas.");
    } finally {
      setIsGeocoding(false);
    }
  };

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>, type: 'avatar' | 'id_doc' | 'prof_doc') => {
    const file = event.target.files?.[0];
    if (!file || !user) return;
    setIsUploading(type);
    
    const fileExt = file.name.split('.').pop();
    const bucket = type === 'avatar' ? 'avatars' : 'documents';
    const filePath = `${user.id}/${Math.random()}.${fileExt}`;
    
    try {
      const { error: uploadError } = await supabase.storage.from(bucket).upload(filePath, file);
      if (uploadError) throw uploadError;
      
      let storageValue = filePath;
      
      if (type === 'avatar') {
        const { data: { publicUrl } } = supabase.storage.from(bucket).getPublicUrl(filePath);
        storageValue = publicUrl;
      }

      const updateData = type === 'avatar' ? { avatar_url: storageValue } : 
                        type === 'id_doc' ? { id_document_url: storageValue } : 
                        { prof_registration_url: storageValue };
      
      await supabase.from("profiles").update(updateData).eq("id", user.id);
      setProfile(prev => ({ ...prev, ...updateData }));
      toast.success("Arquivo carregado!");
    } catch (err) {
      console.error(err);
      toast.error("Erro ao enviar arquivo.");
    } finally {
      setIsUploading(null);
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
          professional_experiences: profile.professional_experiences || "",
          city: profile.city || "",
          state: profile.state || ""
        }
      });

      if (error) {
        let msg = "Falha na comunicação com o servidor de IA.";
        try {
          const body = await error.context?.json();
          if (body?.error) msg = body.error;
        } catch {}
        throw new Error(msg);
      }

      if (data?.bio) {
        setProfile(prev => ({ ...prev, bio: data.bio }));
        toast.success("Biografia gerada com sucesso!");
      } else {
        throw new Error(data?.error || "A IA não retornou um texto válido.");
      }
    } catch (err: any) {
      console.error("[ProfilePage] Erro na geração:", err);
      toast.error(err.message || "Erro ao gerar biografia.");
    } finally {
      setIsGeneratingBio(false);
    }
  };

  const handleSave = async () => {
    if (!user || !profile) return;

    const isProfessional = profile.role === 'professional';
    const cleanPhone = profile.phone?.replace(/\D/g, "") || "";

    if (!profile.avatar_url) {
      toast.error("A foto de perfil é obrigatória.");
      return;
    }
    if (!profile.full_name?.trim()) {
      toast.error("O nome completo é obrigatório.");
      return;
    }
    if (cleanPhone.length < 10) {
      toast.error("Um número de WhatsApp válido é obrigatório.");
      return;
    }
    if (isProfessional && !profile.specialty) {
      toast.error("A especialidade é obrigatória.");
      return;
    }

    if (!profile.address_zip || !profile.address_street || !profile.neighborhood || !profile.city || !profile.state) {
      toast.error("Todos os campos de endereço são obrigatórios.");
      return;
    }

    if (!profile.bio?.trim()) {
      toast.error("A biografia/descrição é obrigatória.");
      return;
    }
    if (isProfessional) {
      if (!profile.experience?.trim()) {
        toast.error("O campo de formações é obrigatório.");
        return;
      }
      if (!profile.professional_experiences?.trim()) {
        toast.error("O campo de experiências profissionais é obrigatório.");
        return;
      }
    }

    setIsSaving(true);
    try {
      // Geocodificação automática antes de salvar se não houver lat/lng
      let finalLat = profile.lat;
      let finalLng = profile.lng;

      if (!finalLat || !finalLng) {
        const fullAddress = `${profile.address_street}, ${profile.address_number || ""}, ${profile.neighborhood}, ${profile.city} - ${profile.state}, Brasil`;
        const coords = await getCoordinates(fullAddress);
        if (coords) {
          finalLat = coords.lat;
          finalLng = coords.lng;
        }
      }

      const { error } = await supabase.from("profiles").update({
        full_name: profile.full_name,
        phone: profile.phone,
        bio: profile.bio,
        experience: profile.experience,
        professional_experiences: profile.professional_experiences,
        city: profile.city,
        state: profile.state,
        neighborhood: profile.neighborhood,
        specialty: profile.specialty,
        registration: profile.registration,
        company_name: profile.company_name,
        cnpj: profile.cnpj,
        hourly_rate: profile.hourly_rate,
        availability: profile.availability,
        patient_profiles: profile.patient_profiles,
        address_zip: profile.address_zip,
        address_street: profile.address_street,
        address_number: profile.address_number,
        address_complement: profile.address_complement,
        lat: finalLat,
        lng: finalLng,
        updated_at: new Date().toISOString()
      }).eq("id", user.id);

      if (error) throw error;
      toast.success("Perfil salvo com sucesso!");
      fetchProfile();
    } catch (err: any) {
      console.error("[ProfileSave] Erro:", err);
      toast.error("Erro ao salvar perfil: " + (err.message || "Erro desconhecido"));
    } finally {
      setIsSaving(false);
    }
  };

  const handleCheckboxChange = (field: 'availability' | 'patient_profiles', value: string) => {
    const current = profile[field] || [];
    const updated = current.includes(value) ? current.filter((i: any) => i !== value) : [...current, value];
    setProfile({ ...profile, [field]: updated });
  };

  const handleDeleteAccount = async () => {
    setIsDeletingAccount(true);
    try {
      const { error } = await supabase.functions.invoke('delete-user');
      if (error) throw error;
      
      toast.success("Sua conta foi excluída permanentemente.");
      await signOut();
    } catch (err) {
      console.error("[ProfilePage] Erro ao excluir conta:", err);
      toast.error("Ocorreu um erro ao tentar excluir sua conta. Por favor, tente novamente.");
    } finally {
      setIsDeletingAccount(false);
    }
  };

  const handleRequestVerification = async () => {
    const isFamily = profile.role === 'family';
    
    if (isFamily && !profile.id_document_url) {
      toast.error("Envie o documento de identidade antes de solicitar análise.");
      return;
    }

    if (!isFamily && (!profile.id_document_url || !profile.prof_registration_url)) {
      toast.error("Envie os dois documentos antes de solicitar análise.");
      return;
    }

    setIsSaving(true);
    try {
      const { error } = await supabase
        .from("profiles")
        .update({ verification_sent: true })
        .eq("id", user?.id);
      
      if (error) throw error;

      supabase.functions.invoke('notify-verification', {
        body: { userName: profile.full_name, userEmail: profile.email, userId: user?.id }
      }).catch(err => console.warn("Falha ao notificar admin:", err));

      toast.success("Solicitação enviada! Analisaremos em breve.");
      fetchProfile();
    } catch (err) {
      toast.error("Erro ao enviar solicitação.");
    } finally {
      setIsSaving(false);
    }
  };

  if (loading) return <div className="flex justify-center p-8"><Loader2 className="animate-spin text-primary" /></div>;

  const isProfessional = profile.role === 'professional';
  const isCompany = profile.role === 'company';
  const isFamily = profile.role === 'family';
  const initials = profile.full_name?.split(" ").map((n: any) => n[0]).join("").slice(0, 2).toUpperCase() || "??";

  const doc1Label = isCompany ? "Cartão CNPJ" : isFamily ? "RG ou CNH do Responsável" : "RG ou CNH";
  const doc2Label = isCompany ? "RG ou CNH do Responsável" : "Registro (COREN/CREFITO)";

  const getBenefits = () => {
    if (isProfessional) return [
      "Visibilidade para centenas de empresas de Home Care.",
      "Acesso a cursos de capacitação exclusivos.",
      "Recebimento de propostas direto no WhatsApp.",
      "Selo de verificação profissional."
    ];
    if (isCompany) return [
      "Acesso ilimitado à base de profissionais qualificados.",
      "Filtros avançados por região e especialidade.",
      "Histórico de contatos e recrutamento centralizado.",
      "Suporte prioritário para fechamento de escalas."
    ];
    return [
      "Encontre cuidadores e enfermeiros verificados perto de você.",
      "Contato direto sem taxas de agenciamento.",
      "Segurança na análise de documentos dos profissionais.",
      "Suporte humanizado para sua necessidade."
    ];
  };

  const CONFIRMATION_PHRASE = "EXCLUIR MINHA CONTA";

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-1">
        <h1 className="text-2xl font-bold tracking-tight">Meus Dados</h1>
        <p className="text-muted-foreground">Mantenha seu perfil atualizado para melhores resultados.</p>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2 space-y-6">
          {(isProfessional || isCompany || isFamily) && (
            <Card className="border-primary/20 bg-primary/5 overflow-hidden">
              <CardContent className="p-6">
                <div className="flex flex-col md:flex-row items-center gap-6">
                  <div className="h-16 w-16 rounded-2xl bg-primary/10 flex items-center justify-center shrink-0">
                    <HelpCircle className="h-8 w-8 text-primary" />
                  </div>
                  <div className="flex-1 text-center md:text-left space-y-1">
                    <h3 className="font-bold text-lg">Precisa de ajuda com seu perfil?</h3>
                    <p className="text-sm text-muted-foreground">
                      Reveja o tutorial de boas-vindas para aprender a utilizar todos os recursos da plataforma.
                    </p>
                  </div>
                  <Button 
                    onClick={() => setIsOnboardingOpen(true)} 
                    className="gap-2 h-12 px-6 shadow-md"
                  >
                    <PlayCircle className="h-5 w-5" />
                    Abrir Tutorial
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}

          <Card>
            <CardHeader>
              <CardTitle>Informações Básicas</CardTitle>
              <CardDescription>
                Esses dados são a sua porta de entrada. Um perfil com foto e nome completo transmite muito mais profissionalismo e confiança.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="flex items-center gap-4">
                <div className="relative">
                  <Avatar className="h-24 w-24 ring-4 ring-border">
                    <AvatarImage src={profile.avatar_url} />
                    <AvatarFallback className="text-2xl">{initials}</AvatarFallback>
                  </Avatar>
                  <Button 
                    size="icon" 
                    variant="secondary" 
                    className="absolute -bottom-1 -right-1 rounded-full shadow-md"
                    onClick={() => avatarRef.current?.click()}
                    disabled={!!isUploading}
                  >
                    {isUploading === 'avatar' ? <Loader2 className="h-4 w-4 animate-spin" /> : <Camera className="h-4 w-4" />}
                  </Button>
                  <input type="file" ref={avatarRef} className="hidden" accept="image/*" onChange={e => handleFileUpload(e, 'avatar')} />
                </div>
                <div className="space-y-1">
                  <h4 className="font-medium">Foto de Perfil *</h4>
                  <p className="text-xs text-muted-foreground">Recomendado: Quadrada, máx. 2MB.</p>
                </div>
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <div className="grid gap-2">
                  <Label>Nome Completo *</Label>
                  <Input 
                    value={profile.full_name || ""} 
                    onChange={e => setProfile({...profile, full_name: e.target.value})} 
                  />
                </div>
                <div className="grid gap-2">
                  <Label>WhatsApp *</Label>
                  <Input 
                    value={profile.phone || ""} 
                    onChange={handlePhoneChange} 
                    placeholder="(11) 99999-9999" 
                  />
                </div>
              </div>

              <div className="grid gap-2">
                <Label className="flex items-center gap-2">
                  <Mail className="h-3 w-3 text-muted-foreground" />
                  E-mail de Acesso
                </Label>
                <Input 
                  value={profile.email || ""} 
                  disabled
                  readOnly
                  className="bg-muted"
                />
                <p className="text-[10px] text-muted-foreground italic">O e-mail é usado para login e não pode ser alterado diretamente.</p>
              </div>

              {isProfessional ? (
                <div className="grid gap-4 md:grid-cols-2">
                  <div className="grid gap-2">
                    <Label>Especialidade *</Label>
                    <Select value={profile.specialty} onValueChange={v => setProfile({...profile, specialty: v})}>
                      <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                      <SelectContent>
                        {specialties.map(s => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="grid gap-2">
                    <Label>Registro (COREN/CREFITO)</Label>
                    <Input 
                      value={profile.registration || ""} 
                      onChange={e => setProfile({...profile, registration: e.target.value})} 
                    />
                  </div>
                </div>
              ) : (
                <div className="grid gap-4 md:grid-cols-2">
                  <div className="grid gap-2">
                    <Label>{profile.role === 'company' ? "Razão Social" : "Nome do Responsável"}</Label>
                    <Input 
                      value={profile.company_name || ""} 
                      onChange={e => setProfile({...profile, company_name: e.target.value})} 
                    />
                  </div>
                  {profile.role === 'company' && (
                    <div className="grid gap-2">
                      <Label>CNPJ</Label>
                      <Input 
                        value={profile.cnpj || ""} 
                        onChange={e => setProfile({...profile, cnpj: e.target.value})} 
                      />
                    </div>
                  )}
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Endereço e Localização *</CardTitle>
              <CardDescription>
                Sua localização é usada para te conectar a oportunidades próximas, facilitando o deslocamento e otimizando sua rotina.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid gap-4 md:grid-cols-3">
                <div className="grid gap-2">
                  <Label>CEP *</Label>
                  <div className="relative">
                    <Input 
                      value={profile.address_zip || ""} 
                      onChange={e => setProfile({...profile, address_zip: e.target.value})} 
                      onBlur={handleCepBlur} 
                    />
                    {isLoadingCep && <Loader2 className="absolute right-3 top-2.5 h-4 w-4 animate-spin text-muted-foreground" />}
                  </div>
                </div>
                <div className="grid gap-2 md:col-span-2">
                  <Label>Rua *</Label>
                  <Input 
                    value={profile.address_street || ""} 
                    onChange={e => setProfile({...profile, address_street: e.target.value})} 
                  />
                </div>
              </div>
              <div className="grid gap-4 md:grid-cols-3">
                <div className="grid gap-2">
                  <Label>Bairro *</Label>
                  <Input 
                    value={profile.neighborhood || ""} 
                    onChange={e => setProfile({...profile, neighborhood: e.target.value})} 
                  />
                </div>
                <div className="grid gap-2">
                  <Label>Cidade *</Label>
                  <Input 
                    value={profile.city || ""} 
                    onChange={e => setProfile({...profile, city: e.target.value})} 
                  />
                </div>
                <div className="grid gap-2">
                  <Label>Estado (UF) *</Label>
                  <Input 
                    value={profile.state || ""} 
                    onChange={e => setProfile({...profile, state: e.target.value})} 
                    maxLength={2} 
                  />
                </div>
              </div>
              <div className="grid gap-4 md:grid-cols-2">
                <div className="grid gap-2">
                  <Label>Número</Label>
                  <Input 
                    value={profile.address_number || ""} 
                    onChange={e => setProfile({...profile, address_number: e.target.value})} 
                  />
                </div>
                <div className="grid gap-2">
                  <Label>Complemento</Label>
                  <Input 
                    value={profile.address_complement || ""} 
                    onChange={e => setProfile({...profile, address_complement: e.target.value})} 
                  />
                </div>
              </div>

              <div className="pt-4 border-t space-y-4">
                <div className="flex items-center justify-between">
                  <div className="space-y-1">
                    <Label className="flex items-center gap-2">
                      <Navigation className="h-4 w-4 text-primary" />
                      Coordenadas Geográficas
                    </Label>
                    <p className="text-[10px] text-muted-foreground">Necessárias para o cálculo de distância na busca.</p>
                  </div>
                  <Button 
                    variant="outline" 
                    size="sm" 
                    className="gap-2 h-8 text-xs"
                    onClick={handleValidateLocation}
                    disabled={isGeocoding}
                  >
                    {isGeocoding ? <Loader2 className="h-3 w-3 animate-spin" /> : <RefreshCw className="h-3 w-3" />}
                    Validar Localização
                  </Button>
                </div>

                <div className="grid gap-4 md:grid-cols-2">
                  <div className="grid gap-1.5">
                    <Label className="text-[10px] uppercase text-muted-foreground">Latitude</Label>
                    <Input 
                      value={profile.lat || ""} 
                      readOnly 
                      className="bg-muted font-mono text-xs h-8" 
                      placeholder="Aguardando validação..."
                    />
                  </div>
                  <div className="grid gap-1.5">
                    <Label className="text-[10px] uppercase text-muted-foreground">Longitude</Label>
                    <Input 
                      value={profile.lng || ""} 
                      readOnly 
                      className="bg-muted font-mono text-xs h-8" 
                      placeholder="Aguardando validação..."
                    />
                  </div>
                </div>

                {profile.lat && profile.lng ? (
                  <div className="flex items-center gap-2 text-[10px] text-success font-medium bg-success/5 p-2 rounded border border-success/10">
                    <CheckCircle2 className="h-3 w-3" />
                    Localização validada e pronta para uso!
                  </div>
                ) : (
                  <div className="flex items-center gap-2 text-[10px] text-amber-600 font-medium bg-amber-50 p-2 rounded border border-amber-100">
                    <AlertCircle className="h-3 w-3" />
                    Clique em "Validar Localização" para gerar as coordenadas.
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          {isProfessional && (
            <>
              <Card>
                <CardHeader>
                  <CardTitle>Currículo e Biografia *</CardTitle>
                  <CardDescription>
                    Destaque suas competências e trajetória. Perfis detalhados têm 3x mais chances de atrair a atenção de recrutadores.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid gap-2">
                    <Label>Formações *</Label>
                    <Textarea value={profile.experience || ""} onChange={e => setProfile({...profile, experience: e.target.value})} rows={3} placeholder="Cursos e especializações..." />
                  </div>
                  <div className="grid gap-2">
                    <Label>Experiências Profissionais *</Label>
                    <Textarea value={profile.professional_experiences || ""} onChange={e => setProfile({...profile, professional_experiences: e.target.value})} rows={3} placeholder="Locais onde trabalhou..." />
                  </div>
                  
                  <div className="pt-2 flex flex-col gap-2">
                    <div className="flex items-center justify-between">
                      <Label>Biografia para o Perfil *</Label>
                      <Button 
                        variant="outline" 
                        size="sm" 
                        className="h-8 gap-2 text-xs" 
                        onClick={handleGenerateBio} 
                        disabled={isGeneratingBio}
                      >
                        {isGeneratingBio ? <Loader2 className="h-3 w-3 animate-spin" /> : <Sparkles className="h-3 w-3 text-primary" />}
                        Gerar com IA
                      </Button>
                    </div>
                    <Textarea value={profile.bio || ""} onChange={e => setProfile({...profile, bio: e.target.value})} rows={5} />
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Detalhes do Atendimento *</CardTitle>
                  <CardDescription>
                    Defina suas preferências e valores para receber propostas que realmente se encaixam no seu perfil de trabalho.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                  <div className="grid gap-2">
                    <Label>Valor/Hora (R$) *</Label>
                    <Input 
                      type="number" 
                      value={profile.hourly_rate || ""} 
                      onChange={e => setProfile({...profile, hourly_rate: e.target.value})} 
                      placeholder="0.00" 
                    />
                    <p className="text-[10px] text-muted-foreground italic">Visível apenas para famílias.</p>
                  </div>
                  <Separator />
                  <div className="space-y-3">
                    <Label className="text-xs uppercase">Disponibilidade *</Label>
                    <div className="grid gap-2">
                      {availabilityOptions.map(opt => (
                        <div key={opt} className="flex items-center gap-2">
                          <Checkbox id={opt} checked={profile.availability.includes(opt)} onCheckedChange={() => handleCheckboxChange('availability', opt)} />
                          <label htmlFor={opt} className="text-xs">{opt}</label>
                        </div>
                      ))}
                    </div>
                  </div>
                  <Separator />
                  <div className="space-y-3">
                    <Label className="text-xs uppercase">Público-alvo *</Label>
                    <div className="grid gap-2">
                      {patientProfileOptions.map(opt => (
                        <div key={opt} className="flex items-center gap-2">
                          <Checkbox id={opt} checked={profile.patient_profiles.includes(opt)} onCheckedChange={() => handleCheckboxChange('patient_profiles', opt)} />
                          <label htmlFor={opt} className="text-xs">{opt}</label>
                        </div>
                      ))}
                    </div>
                  </div>
                </CardContent>
              </Card>
            </>
          )}

          {!isProfessional && (
            <Card>
              <CardHeader>
                <CardTitle>{profile.role === 'company' ? "Sobre a Empresa *" : "Sobre a Família *"}</CardTitle>
                <CardDescription>
                  Conte um pouco sobre suas necessidades e o perfil de atendimento que busca.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Textarea value={profile.bio || ""} onChange={e => setProfile({...profile, bio: e.target.value})} rows={6} placeholder="Conte um pouco sobre suas necessidades..." />
              </CardContent>
            </Card>
          )}

          <div className="flex justify-end gap-3">
            <Button variant="outline" onClick={() => fetchProfile()}>Descartar</Button>
            <Button onClick={handleSave} disabled={isSaving} className="gap-2">
              {isSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
              Salvar Alterações
            </Button>
          </div>
        </div>

        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2"><FileCheck className="h-4 w-4 text-primary" /> Verificação</CardTitle>
              <CardDescription className="text-[10px]">
                O selo de verificação comprova a autenticidade dos seus documentos e coloca seu perfil em destaque nas buscas.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="bg-secondary/30 p-3 rounded-lg flex gap-3 items-start border border-border/50">
                <ShieldCheck className="h-5 w-5 text-primary shrink-0 mt-0.5" />
                <div className="space-y-1">
                  <p className="text-xs font-semibold">Upload Seguro</p>
                  <p className="text-[10px] text-muted-foreground leading-relaxed">
                    Seus documentos são armazenados em um servidor privado com criptografia. 
                    Apenas administradores autorizados podem visualizá-los através de links temporários protegidos.
                  </p>
                </div>
              </div>

              {profile.is_verified ? (
                <div className="bg-success/5 border border-success/20 rounded-lg p-4 flex flex-col items-center text-center">
                  <CheckCircle2 className="h-8 w-8 text-success mb-2" />
                  <p className="font-semibold text-success">Perfil Verificado</p>
                </div>
              ) : profile.verification_sent ? (
                <div className="bg-primary/5 border border-primary/20 rounded-lg p-4 text-center">
                  <Clock className="h-8 w-8 text-primary mx-auto mb-2 animate-pulse" />
                  <p className="font-semibold text-primary">Documentos em Análise</p>
                </div>
              ) : (
                <div className="space-y-3">
                  <div className="space-y-1">
                    <Label className="text-[10px] uppercase">{doc1Label}</Label>
                    <Button variant="outline" size="sm" className="w-full justify-start text-xs h-9 truncate" onClick={() => idDocRef.current?.click()} disabled={!!isUploading}>
                        {profile.id_document_url ? "✓ Documento enviado" : "Selecionar arquivo"}
                    </Button>
                    <input type="file" ref={idDocRef} className="hidden" onChange={e => handleFileUpload(e, 'id_doc')} />
                  </div>
                  
                  {!isFamily && (
                    <div className="space-y-1">
                      <Label className="text-[10px] uppercase">{doc2Label}</Label>
                      <Button variant="outline" size="sm" className="w-full justify-start text-xs h-9 truncate" onClick={() => profDocRef.current?.click()} disabled={!!isUploading}>
                          {profile.prof_registration_url ? "✓ Documento enviado" : "Selecionar arquivo"}
                      </Button>
                      <input type="file" ref={profDocRef} className="hidden" onChange={e => handleFileUpload(e, 'prof_doc')} />
                    </div>
                  )}

                  <Button 
                    className="w-full" 
                    disabled={(!isFamily && (!profile.id_document_url || !profile.prof_registration_url)) || (isFamily && !profile.id_document_url) || isSaving}
                    onClick={handleRequestVerification}
                  >
                    {isSaving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                    Solicitar Análise
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <KeyRound className="h-4 w-4 text-primary" /> Segurança
              </CardTitle>
              <CardDescription className="text-[10px]">
                Mantenha sua conta protegida e seus dados de acesso sempre atualizados.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <ChangePasswordDialog />
            </CardContent>
          </Card>

          <Collapsible
            open={isDangerZoneOpen}
            onOpenChange={setIsDangerZoneOpen}
            className="border border-destructive/20 rounded-xl bg-card overflow-hidden"
          >
            <CollapsibleTrigger asChild>
              <Button 
                variant="ghost" 
                className="w-full flex items-center justify-between p-6 h-auto hover:bg-destructive/5 group"
              >
                <div className="flex items-center gap-2 text-destructive">
                  <Trash2 className="h-4 w-4" />
                  <span className="font-semibold text-base">Zona de Perigo</span>
                </div>
                {isDangerZoneOpen ? <ChevronUp className="h-4 w-4 text-destructive" /> : <ChevronDown className="h-4 w-4 text-destructive" />}
              </Button>
            </CollapsibleTrigger>
            <CollapsibleContent className="px-6 pb-6 space-y-4 animate-accordion-down">
              <p className="text-[10px] text-muted-foreground">
                Ações irreversíveis relacionadas à exclusão definitiva da sua conta e de todos os seus dados.
              </p>
              <Button 
                variant="destructive" 
                size="sm" 
                className="w-full justify-start gap-2 h-10" 
                onClick={() => { setDeleteStep(1); setDeleteAccountModalOpen(true); }}
              >
                <Trash2 className="h-4 w-4" />
                Excluir minha conta permanentemente
              </Button>
            </CollapsibleContent>
          </Collapsible>
        </div>
      </div>

      <Dialog open={deleteAccountModalOpen} onOpenChange={(open) => {
        setDeleteAccountModalOpen(open);
        if (!open) {
          setDeleteStep(1);
          setDeleteConfirmationText("");
        }
      }}>
        <DialogContent className="sm:max-w-[500px]">
          {deleteStep === 1 ? (
            <>
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2 text-destructive">
                  <ShieldAlert className="h-5 w-5" /> 
                  Sentiremos sua falta!
                </DialogTitle>
                <DialogDescription className="pt-2 text-base">
                  Você tem certeza que deseja excluir sua conta? Ao manter seu perfil ativo, você continua aproveitando:
                </DialogDescription>
              </DialogHeader>
              
              <div className="py-4 space-y-3">
                {getBenefits().map((benefit, i) => (
                  <div key={i} className="flex items-start gap-3 bg-secondary/20 p-3 rounded-lg border border-border/50">
                    <div className="h-5 w-5 rounded-full bg-success/10 flex items-center justify-center shrink-0 mt-0.5">
                      <Check className="h-3 w-3 text-success" />
                    </div>
                    <span className="text-sm text-foreground/80">{benefit}</span>
                  </div>
                ))}
              </div>

              <div className="bg-destructive/5 border border-destructive/10 p-4 rounded-lg flex gap-3 items-start">
                <AlertTriangle className="h-5 w-5 text-destructive shrink-0 mt-0.5" />
                <p className="text-xs text-destructive font-medium">
                  A exclusão é irreversível. Todos os seus dados, documentos e histórico de contatos serão apagados permanentemente.
                </p>
              </div>

              <DialogFooter className="mt-6 gap-2 sm:gap-0">
                <Button variant="ghost" onClick={() => setDeleteAccountModalOpen(false)}>Manter Minha Conta</Button>
                <Button variant="destructive" onClick={() => setDeleteStep(2)}>
                  Prosseguir com a Exclusão
                </Button>
              </DialogFooter>
            </>
          ) : (
            <>
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2 text-destructive">
                  <AlertTriangle className="h-5 w-5" /> 
                  Confirmação Final
                </DialogTitle>
                <DialogDescription className="pt-2">
                  Para confirmar a exclusão definitiva, digite a frase abaixo exatamente como aparece:
                </DialogDescription>
              </DialogHeader>

              <div className="py-6 space-y-4">
                <div className="text-center p-4 bg-muted rounded-lg border border-dashed border-muted-foreground/30">
                  <span className="font-mono font-bold text-lg tracking-wider select-none">{CONFIRMATION_PHRASE}</span>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="delete-confirm-input">Digite a frase de confirmação</Label>
                  <Input 
                    id="delete-confirm-input"
                    placeholder="Digite aqui..."
                    value={deleteConfirmationText}
                    onChange={(e) => setDeleteConfirmationText(e.target.value)}
                    className="h-12 text-center font-medium"
                    autoFocus
                  />
                </div>
              </div>

              <DialogFooter className="gap-2 sm:gap-0">
                <Button variant="ghost" onClick={() => setDeleteStep(1)} disabled={isDeletingAccount}>Voltar</Button>
                <Button 
                  variant="destructive" 
                  onClick={handleDeleteAccount} 
                  disabled={isDeletingAccount || deleteConfirmationText !== CONFIRMATION_PHRASE}
                  className="gap-2"
                >
                  {isDeletingAccount ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
                  Excluir Conta Permanentemente
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>

      <OnboardingModal 
        open={isOnboardingOpen} 
        onOpenChange={setIsOnboardingOpen} 
        forceShow={true}
        role={profile?.role}
      />
    </div>
  );
};

export default ProfilePage;