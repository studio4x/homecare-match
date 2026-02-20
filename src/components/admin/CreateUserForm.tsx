"use client";

import React, { useState, useRef, useCallback } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
  FormDescription, // Added FormDescription import
} from "@/components/ui/form";
import { Checkbox } from "@/components/ui/checkbox";
import { Switch } from "@/components/ui/switch";
import {
  Loader2,
  Eye,
  EyeOff,
  Save,
  Camera,
  Sparkles,
  RefreshCw,
  MapPin,
  ShieldCheck,
  User,
  Building2,
  Home,
  DollarSign,
  Bell,
  PlayCircle,
  FileCheck,
  Info,
  Navigation,
  ExternalLink
} from "lucide-react";
import { toast } from "sonner";
import { translateAuthError } from "@/lib/error-utils";
import { getCoordinates } from "@/lib/geo-utils";
import RichTextEditor from "@/components/ui/RichTextEditor";
import { AspectRatio } from "@/components/ui/aspect-ratio";
import { cn } from "@/lib/utils";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";

const MAX_AVATAR_SIZE_MB = 2;
const MAX_DOC_SIZE_MB = 5;

const formSchema = z.object({
  email: z.string().email("E-mail inválido").min(1, "E-mail é obrigatório"),
  password: z.string().min(6, "A senha deve ter pelo menos 6 caracteres"),
  fullName: z.string().min(3, "Nome completo é obrigatório"),
  role: z.enum(["professional", "company", "family"], { required_error: "Selecione o tipo de conta" }),
  
  // Shared fields
  phone: z.string().optional(),
  bio: z.string().optional(),
  avatar_url: z.string().optional(),
  address_zip: z.string().optional(),
  address_street: z.string().optional(),
  address_number: z.string().optional(),
  address_complement: z.string().optional(),
  city: z.string().optional(),
  state: z.string().optional(),
  neighborhood: z.string().optional(),
  lat: z.number().optional().nullable(),
  lng: z.number().optional().nullable(),
  is_verified: z.boolean().default(false),
  verification_sent: z.boolean().default(false),
  has_seen_onboarding: z.boolean().default(false),
  notifications_enabled: z.boolean().default(true),

  // Professional specific
  registration: z.string().optional(),
  specialty: z.string().optional(),
  experience: z.string().optional(), // Formações
  professional_experiences: z.string().optional(), // Experiências profissionais
  hourly_rate: z.string().optional(),
  availability: z.array(z.string()).optional(),
  patient_profiles: z.array(z.string()).optional(),
  id_document_url: z.string().optional(),
  prof_registration_url: z.string().optional(),

  // Company/Family specific
  company_name: z.string().optional(),
  cnpj: z.string().optional(),
  ans_registration: z.string().optional(), // New field
});

type FormData = z.infer<typeof formSchema>;

interface CreateUserFormProps {
  onUserCreated?: () => void;
}

const CreateUserForm = ({ onUserCreated }: CreateUserFormProps) => {
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [isGeneratingBio, setIsGeneratingBio] = useState(false);
  const [isUploading, setIsUploading] = useState<string | null>(null); // 'avatar', 'id_doc', 'prof_doc'
  const [isLoadingCep, setIsLoadingCep] = useState(false);
  const [isGeocoding, setIsGeocoding] = useState(false);

  const avatarRef = useRef<HTMLInputElement>(null);
  const idDocRef = useRef<HTMLInputElement>(null);
  const profDocRef = useRef<HTMLInputElement>(null);

  const form = useForm<FormData>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      email: "",
      password: "",
      fullName: "",
      role: "professional",
      phone: "",
      bio: "",
      avatar_url: "",
      address_zip: "",
      address_street: "",
      address_number: "",
      address_complement: "",
      city: "",
      state: "",
      neighborhood: "",
      lat: null,
      lng: null,
      is_verified: false,
      verification_sent: false,
      has_seen_onboarding: false,
      notifications_enabled: true,

      registration: "",
      specialty: "",
      experience: "",
      professional_experiences: "",
      hourly_rate: "",
      availability: [],
      patient_profiles: [],
      id_document_url: "",
      prof_registration_url: "",

      company_name: "",
      cnpj: "",
      ans_registration: "", // New field default
    },
  });

  const currentRole = form.watch("role");
  const isProfessional = currentRole === 'professional';
  const isCompany = currentRole === 'company';
  const isFamily = currentRole === 'family';
  const currentAvatarUrl = form.watch("avatar_url");
  const currentIdDocUrl = form.watch("id_document_url");
  const currentProfDocUrl = form.watch("prof_registration_url");
  const currentAddressZip = form.watch("address_zip");
  const currentAddressStreet = form.watch("address_street");
  const currentAddressNumber = form.watch("address_number");
  const currentNeighborhood = form.watch("neighborhood");
  const currentCity = form.watch("city");
  const currentState = form.watch("state");

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
    "Período da Manhã", "Período da Tarde", "Período da Noite",
    "Dia Integral (Diurno)", "Plantão 12h (Noturno)", "Finais de Semana",
  ];

  const patientProfileOptions = [
    "Idosos", "Pediátrico", "Pós-cirúrgico", "Doenças Crônicas",
    "Cuidados Paliativos", "Reabilitação Neurológica",
  ];

  const handlePhoneChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const numbers = e.target.value.replace(/\D/g, '').slice(0, 11);
    let formatted = numbers;
    if (numbers.length > 2) formatted = `(${numbers.slice(0, 2)}) ${numbers.slice(2)}`;
    if (numbers.length > 7) formatted = `(${numbers.slice(0, 2)}) ${numbers.slice(2, 7)}-${numbers.slice(7)}`;
    form.setValue("phone", formatted);
  };

  const handleValidateLocation = useCallback(async () => {
    const addressData = {
      street: currentAddressStreet || "",
      number: currentAddressNumber || "",
      neighborhood: currentNeighborhood || "",
      city: currentCity || "",
      state: currentState || "",
      zip: currentAddressZip || ""
    };

    if (!addressData.street || !addressData.city || !addressData.state || !addressData.zip) {
      toast.error("Preencha rua, cidade, estado e CEP para geocodificar.");
      return;
    }

    setIsGeocoding(true);
    try {
      const coords = await getCoordinates(addressData);
      if (coords) {
        form.setValue("lat", coords.lat);
        form.setValue("lng", coords.lng);
        toast.success("Localização detectada automaticamente!");
      }
    } catch (err: any) {
      toast.error(err.message || "Falha ao detectar localização.");
    } finally {
      setIsGeocoding(false);
    }
  }, [form, currentAddressStreet, currentAddressNumber, currentNeighborhood, currentCity, currentState, currentAddressZip]);

  const handleCepBlur = async () => {
    if (!currentAddressZip) return;
    const cep = currentAddressZip.replace(/\D/g, '');
    if (cep.length !== 8) return;
    setIsLoadingCep(true);
    try {
      const response = await fetch(`https://viacep.com.br/ws/${cep}/json/`);
      const data = await response.json();
      if (!data.erro) {
        form.setValue("address_street", data.logradouro);
        form.setValue("neighborhood", data.bairro);
        form.setValue("city", data.localidade);
        form.setValue("state", data.uf);
        
        // Tenta geocodificar se o número já estiver preenchido
        if (currentAddressNumber) {
          handleValidateLocation();
        }
      } else {
        toast.error("CEP não encontrado.");
      }
    } catch (err) {
      toast.error("Erro ao buscar CEP.");
    } finally {
      setIsLoadingCep(false);
    }
  };

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>, type: 'avatar' | 'id_doc' | 'prof_doc') => {
    const file = event.target.files?.[0];
    if (!file) return;

    const maxSize = type === 'avatar' ? MAX_AVATAR_SIZE_MB : MAX_DOC_SIZE_MB;
    if (file.size > maxSize * 1024 * 1024) {
      toast.error(`O arquivo é muito grande. Limite máximo: ${maxSize}MB.`);
      return;
    }

    setIsUploading(type);
    
    const fileExt = file.name.split('.').pop();
    const bucket = type === 'avatar' ? 'avatars' : 'documents';
    const filePath = `admin-uploads/${Date.now()}_${file.name}`; // Unique path for admin uploads
    
    try {
      const { error: uploadError } = await supabase.storage.from(bucket).upload(filePath, file);
      if (uploadError) throw uploadError;
      
      let storageValue = filePath;
      
      if (type === 'avatar') {
        const { data: { publicUrl } } = supabase.storage.from(bucket).getPublicUrl(filePath);
        storageValue = publicUrl;
      }

      if (type === 'avatar') form.setValue("avatar_url", storageValue);
      else if (type === 'id_doc') form.setValue("id_document_url", storageValue);
      else if (type === 'prof_doc') form.setValue("prof_registration_url", storageValue);
      
      toast.success("Arquivo carregado!");
    } catch (err) {
      console.error(err);
      toast.error("Erro ao enviar arquivo.");
    } finally {
      setIsUploading(null);
      if (event.target) event.target.value = ""; // Clear file input
    }
  };

  const handleGenerateBio = async () => {
    const values = form.getValues();
    if (!values.fullName || !values.specialty || !values.experience) {
      toast.error("Preencha nome, especialidade e formações primeiro.");
      return;
    }
    setIsGeneratingBio(true);
    try {
      const { data, error } = await supabase.functions.invoke('generate-bio', {
        body: {
          name: values.fullName,
          specialty: values.specialty,
          experience: values.experience,
          professional_experiences: values.professional_experiences || "",
          city: values.city || "",
          state: values.state || ""
        }
      });

      if (error) throw new Error("Falha na comunicação com o servidor de IA.");

      if (data?.bio) {
        form.setValue("bio", data.bio);
        toast.success("Biografia gerada com sucesso!");
      }
    } catch (err: any) {
      toast.error(err.message || "Erro ao gerar biografia.");
    } finally {
      setIsGeneratingBio(false);
    }
  };

  const onSubmit = async (data: FormData) => {
    setLoading(true);
    try {
      // Ensure lat/lng are set if address is provided
      if (data.address_street && data.city && data.state && data.address_zip && (!data.lat || !data.lng)) {
        const coords = await getCoordinates({
          street: data.address_street,
          number: data.address_number,
          neighborhood: data.neighborhood,
          city: data.city,
          state: data.state,
          zip: data.address_zip
        });
        if (coords) {
          data.lat = coords.lat;
          data.lng = coords.lng;
        } else {
          toast.error("Não foi possível obter coordenadas para o endereço. Verifique o endereço ou a chave da API de mapas.");
          setLoading(false);
          return;
        }
      }

      const { error } = await supabase.functions.invoke('admin-create-user', {
        body: {
          email: data.email,
          password: data.password,
          fullName: data.fullName,
          role: data.role,
          registration: data.registration,
          specialty: data.specialty,
          city: data.city,
          state: data.state,
          neighborhood: data.neighborhood,
          experience: data.experience,
          professional_experiences: data.professional_experiences,
          bio: data.bio,
          avatar_url: data.avatar_url,
          phone: data.phone,
          hourly_rate: data.hourly_rate,
          id_document_url: data.id_document_url,
          prof_registration_url: data.prof_registration_url,
          company_name: data.company_name,
          cnpj: data.cnpj,
          ans_registration: data.ans_registration, // New field
          availability: data.availability,
          patient_profiles: data.patient_profiles,
          address_zip: data.address_zip,
          address_street: data.address_street,
          address_number: data.address_number,
          address_complement: data.address_complement,
          lat: data.lat,
          lng: data.lng,
          is_verified: data.is_verified,
          verification_sent: data.verification_sent,
          has_seen_onboarding: data.has_seen_onboarding,
          notifications_enabled: data.notifications_enabled
        }
      });

      if (error) throw error;
      toast.success("Usuário e perfil criados com sucesso!");
      form.reset();
      if (onUserCreated) onUserCreated();
    } catch (error: any) {
      console.error("[CreateUserForm] Erro:", error);
      toast.error(translateAuthError(error.message));
    } finally {
      setLoading(false);
    }
  };

  const doc1Label = currentRole === 'company' ? "Cartão CNPJ" : currentRole === 'family' ? "RG ou CNH do Responsável" : "RG ou CNH";
  const doc2Label = currentRole === 'company' ? "RG ou CNH do Responsável" : "Registro (COREN/CREFITO)";

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <User className="h-5 w-5 text-primary" />
              Dados de Acesso
            </CardTitle>
            <CardDescription>Informações para login e tipo de conta.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <FormField
              control={form.control}
              name="email"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>E-mail *</FormLabel>
                  <FormControl><Input type="email" placeholder="email@exemplo.com" {...field} /></FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="password"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Senha *</FormLabel>
                  <FormControl>
                    <div className="relative">
                      <Input type={showPassword ? "text" : "password"} {...field} />
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                      >
                        {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                      </button>
                    </div>
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="role"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Tipo de Conta *</FormLabel>
                  <Select onValueChange={field.onChange} defaultValue={field.value}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Selecione o tipo de conta" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="professional">Profissional</SelectItem>
                      <SelectItem value="company">Empresa</SelectItem>
                      <SelectItem value="family">Família</SelectItem>
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <User className="h-5 w-5 text-primary" />
              Informações Básicas do Perfil
            </CardTitle>
            <CardDescription>Dados essenciais para identificação na plataforma.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="flex items-center gap-4">
              <div className="relative">
                <Avatar className="h-24 w-24 ring-4 ring-border">
                  <AvatarImage src={currentAvatarUrl || ""} />
                  <AvatarFallback className="text-2xl">
                    {form.watch("fullName")?.split(" ").map((n) => n[0]).join("").slice(0, 2).toUpperCase() || "??"}
                  </AvatarFallback>
                </Avatar>
                <Button size="icon" variant="secondary" className="absolute -bottom-1 -right-1 rounded-full shadow-md" onClick={() => avatarRef.current?.click()} disabled={isUploading === 'avatar'}>
                  {isUploading === 'avatar' ? <Loader2 className="h-4 w-4 animate-spin" /> : <Camera className="h-4 w-4" />}
                </Button>
                <input type="file" ref={avatarRef} className="hidden" accept="image/*" onChange={e => handleFileUpload(e, 'avatar')} />
              </div>
              <div className="space-y-1">
                <h4 className="font-medium">Foto de Perfil *</h4>
                <p className="text-xs text-muted-foreground">Recomendado: Quadrada, máx. {MAX_AVATAR_SIZE_MB}MB.</p>
              </div>
            </div>

            <FormField
              control={form.control}
              name="fullName"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Nome Completo / Razão Social *</FormLabel>
                  <FormControl><Input placeholder="Nome ou Razão Social" {...field} /></FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="phone"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>WhatsApp *</FormLabel>
                  <FormControl><Input placeholder="(11) 99999-9999" {...field} onChange={handlePhoneChange} /></FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {isProfessional && (
              <div className="grid gap-4 md:grid-cols-2">
                <FormField
                  control={form.control}
                  name="specialty"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Especialidade *</FormLabel>
                      <Select onValueChange={field.onChange} defaultValue={field.value}>
                        <FormControl><SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger></FormControl>
                        <SelectContent>{specialties.map(s => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}</SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="registration"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Registro (COREN/CREFITO)</FormLabel>
                      <FormControl><Input {...field} /></FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
            )}

            {(isCompany || isFamily) && (
              <>
                <FormField
                  control={form.control}
                  name="company_name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{isCompany ? "Nome da Empresa" : "Nome do Responsável"}</FormLabel>
                      <FormControl><Input {...field} /></FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                {isCompany && (
                  <>
                    <FormField
                      control={form.control}
                      name="cnpj"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>CNPJ</FormLabel>
                          <FormControl><Input {...field} /></FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="ans_registration"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Registro ANS</FormLabel>
                          <FormControl><Input {...field} /></FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </>
                )}
              </>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <MapPin className="h-5 w-5 text-primary" />
              Endereço e Localização *
            </CardTitle>
            <CardDescription>Sua localização é usada para conectar a oportunidades próximas.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="grid gap-4 md:grid-cols-3">
              <FormField
                control={form.control}
                name="address_zip"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>CEP *</FormLabel>
                    <FormControl>
                      <div className="relative">
                        <Input {...field} onBlur={handleCepBlur} />
                        {isLoadingCep && <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 animate-spin text-muted-foreground" />}
                      </div>
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="address_street"
                render={({ field }) => (
                  <FormItem className="md:col-span-2">
                    <FormLabel>Rua *</FormLabel>
                    <FormControl><Input {...field} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
            <div className="grid gap-4 md:grid-cols-3">
              <FormField
                control={form.control}
                name="neighborhood"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Bairro *</FormLabel>
                    <FormControl><Input {...field} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="city"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Cidade *</FormLabel>
                    <FormControl><Input {...field} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="state"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Estado (UF) *</FormLabel>
                    <FormControl><Input maxLength={2} {...field} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
            <div className="grid gap-4 md:grid-cols-2">
              <FormField
                control={form.control}
                name="address_number"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Número</FormLabel>
                    <FormControl><Input {...field} onBlur={handleValidateLocation} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="address_complement"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Complemento</FormLabel>
                    <FormControl><Input {...field} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <div className="pt-4 border-t space-y-4">
              <div className="flex items-center justify-between">
                <div className="space-y-1">
                  <Label className="flex items-center gap-2"><Navigation className="h-4 w-4 text-primary" /> Coordenadas Geográficas</Label>
                  <p className="text-[10px] text-muted-foreground">Detectadas automaticamente.</p>
                </div>
                <Button variant="outline" size="sm" className="gap-2 h-8 text-xs" onClick={handleValidateLocation} disabled={isGeocoding}>
                  {isGeocoding ? <Loader2 className="h-3 w-3 animate-spin" /> : <RefreshCw className="h-3 w-3" />} Recalcular
                </Button>
              </div>
              <div className="grid gap-4 md:grid-cols-2">
                <FormField
                  control={form.control}
                  name="lat"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-[10px] uppercase text-muted-foreground">Latitude</FormLabel>
                      <FormControl><Input {...field} readOnly className="bg-muted font-mono text-xs h-8" /></FormControl>
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="lng"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-[10px] uppercase text-muted-foreground">Longitude</FormLabel>
                      <FormControl><Input {...field} readOnly className="bg-muted font-mono text-xs h-8" /></FormControl>
                    </FormItem>
                  )}
                />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Info className="h-5 w-5 text-primary" />
              Biografia e Descrição *
            </CardTitle>
            <CardDescription>Apresente-se ou descreva sua empresa/família.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {isProfessional && (
              <>
                <FormField
                  control={form.control}
                  name="experience"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Formações *</FormLabel>
                      <FormControl><Textarea rows={3} {...field} /></FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="professional_experiences"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Experiências Profissionais *</FormLabel>
                      <FormControl><Textarea rows={3} {...field} /></FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </>
            )}
            <FormField
              control={form.control}
              name="bio"
              render={({ field }) => (
                <FormItem>
                  <div className="flex items-center justify-between">
                    <FormLabel>Biografia para o Perfil *</FormLabel>
                    {isProfessional && (
                      <Button variant="outline" size="sm" className="h-8 gap-2 text-xs" onClick={handleGenerateBio} disabled={isGeneratingBio}>
                        {isGeneratingBio ? <Loader2 className="h-3 w-3 animate-spin" /> : <Sparkles className="h-3 w-3 text-primary" />} Gerar com IA
                      </Button>
                    )}
                  </div>
                  <FormControl>
                    <RichTextEditor content={field.value || ""} onChange={field.onChange} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </CardContent>
        </Card>

        {isProfessional && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <DollarSign className="h-5 w-5 text-primary" />
                Detalhes do Atendimento *
              </CardTitle>
              <CardDescription>Defina suas preferências e valores.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <FormField
                control={form.control}
                name="hourly_rate"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Valor/Hora (R$) *</FormLabel>
                    <FormControl><Input type="number" {...field} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="availability"
                render={() => (
                  <FormItem>
                    <FormLabel className="text-xs uppercase">Disponibilidade *</FormLabel>
                    <div className="grid gap-2">
                      {availabilityOptions.map((item) => (
                        <FormField
                          key={item}
                          control={form.control}
                          name="availability"
                          render={({ field }) => (
                            <FormItem key={item} className="flex flex-row items-start space-x-3 space-y-0">
                              <FormControl>
                                <Checkbox
                                  checked={field.value?.includes(item)}
                                  onCheckedChange={(checked) => {
                                    return checked
                                      ? field.onChange([...(field.value || []), item])
                                      : field.onChange(
                                          (field.value || []).filter(
                                            (value) => value !== item
                                          )
                                        );
                                  }}
                                />
                              </FormControl>
                              <FormLabel className="text-xs font-normal">{item}</FormLabel>
                            </FormItem>
                          )}
                        />
                      ))}
                    </div>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="patient_profiles"
                render={() => (
                  <FormItem>
                    <FormLabel className="text-xs uppercase">Público-alvo *</FormLabel>
                    <div className="grid gap-2">
                      {patientProfileOptions.map((item) => (
                        <FormField
                          key={item}
                          control={form.control}
                          name="patient_profiles"
                          render={({ field }) => (
                            <FormItem key={item} className="flex flex-row items-start space-x-3 space-y-0">
                              <FormControl>
                                <Checkbox
                                  checked={field.value?.includes(item)}
                                  onCheckedChange={(checked) => {
                                    return checked
                                      ? field.onChange([...(field.value || []), item])
                                      : field.onChange(
                                          (field.value || []).filter(
                                            (value) => value !== item
                                          )
                                        );
                                  }}
                                />
                              </FormControl>
                              <FormLabel className="text-xs font-normal">{item}</FormLabel>
                            </FormItem>
                          )}
                        />
                      ))}
                    </div>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </CardContent>
          </Card>
        )}

        {!isProfessional && (
          <Card>
            <CardHeader><CardTitle>{isCompany ? "Sobre a Empresa *" : "Sobre a Família *"}</CardTitle></CardHeader>
            <CardContent><Textarea value={form.watch("bio") || ""} onChange={e => form.setValue("bio", e.target.value)} rows={6} /></CardContent>
          </Card>
        )}

        <Button type="submit" className="w-full gap-2" disabled={loading}>
          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
          Criar Usuário e Perfil
        </Button>
      </form>
    </Form>
  );
};

export default CreateUserForm;