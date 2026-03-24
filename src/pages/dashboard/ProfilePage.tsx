"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useAuth } from "@/components/auth/AuthProvider";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { Checkbox } from "@/components/ui/checkbox";
import { Switch } from "@/components/ui/switch";
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
  Clock,
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
  Navigation,
  Users,
  User, // Added User icon for patient name
  HeartPulse, // Added HeartPulse for medical conditions
  Footprints, // Replaced Walk with Footprints for mobility
  Brain, // Added Brain for cognitive state
  Syringe, // Added Syringe for special equipment
  MessageSquare, // Added MessageSquare for communication skills
  Calendar, // Added Calendar icon for age
  AlertOctagon,
  RotateCcw
} from "lucide-react";
import { toast } from "sonner";
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
import ImageCropper from "@/components/profile/ImageCropper";
import { getCoordinates } from "@/lib/geo-utils";
import { useSiteConfig } from "@/hooks/use-site-config";
import {
  getCompanyFamilyContactBlockMessage,
  getCompanyFamilyContactEligibility,
} from "@/lib/contact-eligibility";
import { Link } from "react-router-dom";
import { BRAZIL_STATES, fetchCitiesByState } from "@/lib/brazil-locations";
import { sanitizeStoragePath } from "@/lib/storage-path";

type UploadType = "avatar" | "id_doc" | "prof_doc" | "patient_doc" | "patient_address_proof";
type VerificationUploadType = Exclude<UploadType, "avatar">;
type VerificationFieldKey = "id_document_url" | "prof_registration_url" | "patient_document_url" | "patient_address_proof_url";

const ProfilePage = () => {
  const { user, signOut } = useAuth();
  const { data: siteConfig } = useSiteConfig();
  const [profile, setProfile] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isGeneratingBio, setIsGeneratingBio] = useState(false);
  const [isUploading, setIsUploading] = useState<string | null>(null);
  const [isLoadingCep, setIsLoadingCep] = useState(false);
  const [imageToCrop, setImageToCrop] = useState<string | null>(null);
  const [tempFileExt, setTempFileExt] = useState<string>("jpg");
  const [isGeocoding, setIsGeocoding] = useState(false);
  const [citiesByState, setCitiesByState] = useState<string[]>([]);
  const [loadingCitiesByState, setLoadingCitiesByState] = useState(false);
  const [isDangerZoneOpen, setIsDangerZoneOpen] = useState(false);
  const [isOnboardingOpen, setIsOnboardingOpen] = useState(false);
  
  const [deleteAccountModalOpen, setDeleteAccountModalOpen] = useState(false);
  const [deleteStep, setDeleteStep] = useState<1 | 2>(1);
  const [deleteConfirmationText, setDeleteConfirmationText] = useState("");
  const [isDeletingAccount, setIsDeletingAccount] = useState(false);

  const avatarRef = useRef<HTMLInputElement>(null);
  const idDocRef = useRef<HTMLInputElement>(null);
  const profDocRef = useRef<HTMLInputElement>(null);
  const patientDocRef = useRef<HTMLInputElement>(null);
  const patientAddressProofRef = useRef<HTMLInputElement>(null);
  const [uploadedDocNames, setUploadedDocNames] = useState<Partial<Record<VerificationUploadType, string>>>({});

  const specialties = [
    { value: "assistente-social", label: "Assistente Social" },
    { value: "auxiliar-enfermagem", label: "Auxiliar de Enfermagem" },
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
    "1h de atendimento",
    "2h de atendimento",
    "3h de atendimento",
  ];

  const patientProfileOptions = [
    "Idosos",
    "Pediátrico",
    "Pós-cirúrgico",
    "Doenças Crônicas",
    "Cuidados Paliativos",
    "Reabilitação Neurológica",
  ];

  // New options for patient-specific fields
  const mobilityLevelOptions = [
    "Acamado",
    "Cadeira de Rodas",
    "Anda com Auxílio",
    "Totalmente Móvel",
  ];

  const cognitiveStateOptions = [
    "Alerta e Orientado",
    "Comprometimento Leve",
    "Demência",
    "Confusão/Agitação",
  ];

  const specialEquipmentOptions = [
    "Oxigênio",
    "Sonda de Alimentação",
    "Cateter",
    "Ventilador",
    "Ostomia",
  ];

  const communicationSkillsOptions = [
    "Verbal",
    "Não-Verbal",
    "Com Dificuldade",
    "Prancha de Comunicação",
  ];

  const familyProfileColumns = [
    "patient_name",
    "patient_age",
    "patient_medical_conditions",
    "patient_specialties",
    "patient_mobility_level",
    "patient_cognitive_state",
    "patient_special_equipment",
    "patient_communication_skills",
    "patient_document_url",
    "patient_address_proof_url",
  ];

  useEffect(() => {
    let active = true;

    const loadCities = async () => {
      const selectedState = String(profile?.state || "").trim().toUpperCase();
      if (!selectedState) {
        if (active) {
          setCitiesByState([]);
          setLoadingCitiesByState(false);
        }
        return;
      }

      setLoadingCitiesByState(true);
      try {
        const cities = await fetchCitiesByState(selectedState);
        if (active) {
          setCitiesByState(cities);
        }
      } catch (err) {
        console.error("[ProfilePage] Erro ao carregar cidades por estado:", err);
        if (active) {
          setCitiesByState([]);
        }
      } finally {
        if (active) {
          setLoadingCitiesByState(false);
        }
      }
    };

    loadCities();

    return () => {
      active = false;
    };
  }, [profile?.state]);

  const handleStateProfileChange = (stateValue: string) => {
    setProfile((prev: any) => ({
      ...prev,
      state: stateValue,
      city: "",
    }));
  };

  const handleCityProfileChange = (cityValue: string) => {
    setProfile((prev: any) => ({
      ...prev,
      city: cityValue,
    }));
  };

  const verificationUploadTypeToField: Record<VerificationUploadType, VerificationFieldKey> = {
    id_doc: "id_document_url",
    prof_doc: "prof_registration_url",
    patient_doc: "patient_document_url",
    patient_address_proof: "patient_address_proof_url",
  };

  const wait = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

  const sanitizeFileName = (name: string) => {
    const trimmed = name.trim();
    if (!trimmed) return "documento";
    return trimmed
      .replace(/\s+/g, "_")
      .replace(/[^a-zA-Z0-9._-]/g, "")
      .slice(0, 120);
  };

  const extractFileNameFromStorageValue = (storageValue?: string | null) => {
    if (!storageValue || typeof storageValue !== "string") return "";
    const cleanValue = storageValue.split("?")[0];
    const segments = cleanValue.split("/");
    const lastSegment = segments[segments.length - 1] || "";
    if (!lastSegment) return "";

    try {
      const decoded = decodeURIComponent(lastSegment);
      return decoded.replace(/^\d{10,}-/, "");
    } catch {
      return lastSegment;
    }
  };

  const getMissingProfileColumn = (err: any) => {
    const text = `${err?.message || ""} ${err?.details || ""} ${err?.hint || ""}`;
    const quotedColumn = text.match(/Could not find the '([^']+)' column of 'profiles'/i);
    if (quotedColumn?.[1]) return quotedColumn[1];

    return familyProfileColumns.find((column) => {
      const pattern = new RegExp(`\\b${column}\\b`, "i");
      return pattern.test(text);
    }) || null;
  };

  const isMissingFamilyFieldError = (err: any) => {
    const missingColumn = getMissingProfileColumn(err);
    if (missingColumn && missingColumn.startsWith("patient_")) return true;
    return err?.code === "PGRST204" && !!missingColumn;
  };

  const showFamilySchemaOutdatedToast = (missingColumn?: string | null) => {
    const missingFieldLabel = missingColumn ? `Coluna ausente: ${missingColumn}. ` : "";
    toast.error("Estrutura do banco desatualizada para perfil da família.", {
      description: `${missingFieldLabel}Peça para um admin abrir Painel Admin > Configurações > Manutenção e clicar em "Campos de Perfil da Família".`,
    });
  };

  const retryProfileUpdateAfterFamilySetup = async (updateData: Record<string, any>) => {
    const setup = await supabase.functions.invoke("setup-family-profile-fields");
    if (setup.error) {
      console.error("[ProfilePage] Falha ao executar setup-family-profile-fields:", setup.error);
      return { error: setup.error };
    }

    const setupData = setup.data as any;
    if (Array.isArray(setupData?.missing_columns) && setupData.missing_columns.length > 0) {
      return { error: { code: "FAMILY_SCHEMA_NOT_READY", message: "Campos de perfil da família não foram criados.", details: setupData.missing_columns.join(", ") } };
    }

    // Dá tempo para o PostgREST recarregar o schema antes de reexecutar o update.
    const delays = [600, 1200, 2000];
    for (const delay of delays) {
      await wait(delay);
      const retry = await supabase.from("profiles").update(updateData).eq("id", user?.id);
      if (!retry.error || !isMissingFamilyFieldError(retry.error)) {
        return retry;
      }
    }

    const finalRetry = await supabase.from("profiles").update(updateData).eq("id", user?.id);
    if (finalRetry.error && isMissingFamilyFieldError(finalRetry.error)) {
      return { error: { code: "FAMILY_SCHEMA_NOT_READY", message: "Campos de perfil da família ainda ausentes após sincronização.", details: getMissingProfileColumn(finalRetry.error) } };
    }

    return finalRetry;
  };

  useEffect(() => {
    fetchProfile();
  }, [user]);

  const fetchProfile = async () => {
    if (!user) return;
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', user.id)
        .maybeSingle();
      
      if (error) {
        console.error("[ProfilePage] Error fetching profile:", error); // Added log
        throw error;
      }

      if (data) {
        console.log("[ProfilePage] Fetched profile data:", data); // Added log
        setProfile({
          ...data,
          availability: data.availability || [],
          patient_profiles: data.patient_profiles || [],
          notifications_enabled: data.notifications_enabled ?? true,
          whatsapp_opt_in: data.whatsapp_opt_in ?? false,
          whatsapp_opt_in_at: data.whatsapp_opt_in_at || null,
          // New patient-specific fields
          patient_name: data.patient_name || "",
          patient_age: data.patient_age ?? "",
          patient_medical_conditions: data.patient_medical_conditions || "",
          patient_specialties:
            (Array.isArray(data.patient_specialties) && data.patient_specialties.length > 0)
              ? data.patient_specialties
              : (data.specialty ? [data.specialty] : []),
          patient_mobility_level: data.patient_mobility_level || [],
          patient_cognitive_state: data.patient_cognitive_state || [],
          patient_special_equipment: data.patient_special_equipment || [],
          patient_communication_skills: data.patient_communication_skills || [],
          patient_document_url: data.patient_document_url || "",
          patient_address_proof_url: data.patient_address_proof_url || "",
          birth_date: data.birth_date || "",
        });
        setUploadedDocNames({
          id_doc: extractFileNameFromStorageValue(data.id_document_url),
          prof_doc: extractFileNameFromStorageValue(data.prof_registration_url),
          patient_doc: extractFileNameFromStorageValue(data.patient_document_url),
          patient_address_proof: extractFileNameFromStorageValue(data.patient_address_proof_url),
        });
        console.log("[ProfilePage] Profile state updated. verification_sent:", data.verification_sent); // NEW LOG
      }
    } catch (err) {
      console.error("[ProfilePage] Erro ao carregar seus dados:", err);
      toast.error("Erro ao carregar seus dados.");
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

  const handleValidateLocation = useCallback(async (currentProfile?: any) => {
    const p = currentProfile || profile;
    if (!p?.address_street || !p?.city || !p?.state || !p?.address_zip) return;

    if (!siteConfig?.google_maps_api_key) {
      toast.error("Chave da API do Google Maps não configurada. Acesse o Painel Admin > Configurações.");
      return;
    }

    setIsGeocoding(true);
    try {
      const coords = await getCoordinates({
        street: p.address_street,
        number: p.address_number,
        neighborhood: p.neighborhood,
        city: p.city,
        state: p.state,
        zip: p.address_zip
      });

      if (coords) {
        setProfile(prev => ({ ...prev, lat: coords.lat, lng: coords.lng }));
        toast.success("Localização detectada automaticamente!");
      }
    } catch (err) {
      console.warn("[AutoGeocode] Falha silenciosa na detecção automática.");
    } finally {
      setIsGeocoding(false);
    }
  }, [profile, siteConfig?.google_maps_api_key]);

  const handleCepBlur = async () => {
    if (!profile?.address_zip) return;
    const cep = profile.address_zip.replace(/\D/g, '');
    if (cep.length !== 8) return;
    setIsLoadingCep(true);
    try {
      const response = await fetch(`https://viacep.com.br/ws/${cep}/json/`);
      const data = await response.json();
      if (!data.erro) {
        const updatedProfile = {
          ...profile,
          address_street: data.logradouro,
          neighborhood: data.bairro,
          city: data.localidade,
          state: data.uf
        };
        setProfile(updatedProfile);
        
        if (updatedProfile.address_number) {
          handleValidateLocation(updatedProfile);
        }
      }
    } finally {
      setIsLoadingCep(false);
    }
  };

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>, type: UploadType) => {
    const input = event.target;
    const file = event.target.files?.[0];
    if (!file || !user) return;
    setIsUploading(type);
    
    const safeOriginalName = sanitizeFileName(file.name);
    const fileExt = (safeOriginalName.split('.').pop() || "bin").toLowerCase();
    if (type === 'avatar') {
      setTempFileExt(fileExt);
      const reader = new FileReader();
      reader.onload = () => {
        setImageToCrop(reader.result as string);
        setIsUploading(null);
      };
      reader.readAsDataURL(file);
      return;
    }

    const bucket = type === 'avatar' ? 'avatars' : 'documents';
    const filePath = sanitizeStoragePath(
      type === "avatar"
        ? `${user.id}/${crypto.randomUUID()}.${fileExt}`
        : `${user.id}/${Date.now()}-${safeOriginalName}`,
      { bucket },
    );
    
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
                        type === 'prof_doc' ? { prof_registration_url: storageValue } :
                        type === 'patient_doc' ? { patient_document_url: storageValue } :
                        { patient_address_proof_url: storageValue };

      let { error: updateError } = await supabase.from("profiles").update(updateData).eq("id", user.id);

      // Compatibilidade: tenta provisionar os novos campos da família caso não existam no schema.
      if (updateError && isMissingFamilyFieldError(updateError)) {
        const retry = await retryProfileUpdateAfterFamilySetup(updateData);
        updateError = retry.error;
      }

      if (updateError) throw updateError;
      setProfile(prev => ({ ...prev, ...updateData }));
      if (type !== "avatar") {
        setUploadedDocNames(prev => ({ ...prev, [type]: file.name }));
      }
      toast.success("Arquivo carregado!");
    } catch (err: any) {
      console.error(err);
      const missingColumn = getMissingProfileColumn(err);
      if (missingColumn?.startsWith("patient_")) {
        showFamilySchemaOutdatedToast(missingColumn);
      } else if (err?.code === "FAMILY_SCHEMA_NOT_READY") {
        showFamilySchemaOutdatedToast(err?.details || null);
      } else {
        toast.error("Erro ao enviar arquivo.");
      }
    } finally {
      setIsUploading(null);
      input.value = "";
    }
  };

  const handleCropComplete = async (croppedBlob: Blob) => {
    if (!user) return;
    setIsUploading('avatar');
    setImageToCrop(null);

    const filePath = sanitizeStoragePath(`${user.id}/${crypto.randomUUID()}.${tempFileExt}`, { bucket: 'avatars' });
    
    try {
      const { error: uploadError } = await supabase.storage.from('avatars').upload(filePath, croppedBlob);
      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage.from('avatars').getPublicUrl(filePath);
      const { error: updateError } = await supabase.from("profiles").update({ avatar_url: publicUrl }).eq("id", user.id);
      
      if (updateError) throw updateError;
      setProfile(prev => ({ ...prev, avatar_url: publicUrl }));
      toast.success("Foto de perfil atualizada!");
    } catch (err) {
      console.error(err);
      toast.error("Erro ao salvar foto recortada.");
    } finally {
      setIsUploading(null);
    }
  };

  const getDocumentButtonLabel = (type: VerificationUploadType, storagePath?: string | null) => {
    const explicitName = uploadedDocNames[type];
    if (explicitName) return explicitName;

    const nameFromStorage = extractFileNameFromStorageValue(storagePath);
    return nameFromStorage || "Selecionar arquivo";
  };

  const handleRemoveUploadedDocument = async (type: VerificationUploadType) => {
    if (!user || !profile) return;
    const field = verificationUploadTypeToField[type];
    const currentPath = profile[field];
    setIsUploading(type);

    try {
      const { error } = await supabase
        .from("profiles")
        .update({ [field]: null })
        .eq("id", user.id);
      if (error) throw error;

      if (typeof currentPath === "string" && currentPath && !/^https?:\/\//i.test(currentPath)) {
        try {
          const safePath = sanitizeStoragePath(currentPath, { bucket: "documents" });
          const { error: storageDeleteError } = await supabase.storage.from("documents").remove([safePath]);
          if (storageDeleteError) {
            console.warn("[ProfilePage] Não foi possível remover arquivo antigo do storage:", storageDeleteError);
          }
        } catch (pathError) {
          console.warn("[ProfilePage] Caminho inválido ao remover arquivo antigo:", pathError);
        }
      }

      setProfile((prev: any) => ({ ...prev, [field]: null }));
      setUploadedDocNames((prev) => {
        const next = { ...prev };
        delete next[type];
        return next;
      });
      toast.success("Documento removido. Você pode selecionar outro arquivo.");
    } catch (err) {
      console.error("[ProfilePage] Erro ao remover documento:", err);
      toast.error("Erro ao remover documento.");
    } finally {
      setIsUploading(null);
    }
  };

  const handleGenerateBio = async () => {
    if (!profile?.full_name || !profile?.specialty || !profile?.experience) {
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

      if (error) throw new Error("Falha na comunicação com o servidor de IA.");

      if (data?.bio) {
        setProfile(prev => ({ ...prev, bio: data.bio }));
        toast.success("Biografia gerada com sucesso!");
      }
    } catch (err: any) {
      toast.error(err.message || "Erro ao gerar biografia.");
    } finally {
      setIsGeneratingBio(false);
    }
  };

  const handleSave = async () => {
    if (!user || !profile) return;

    const isProfessional = profile.role === 'professional';
    const isCompany = profile.role === 'company';
    const isFamily = profile.role === 'family';
    const cleanPhone = profile.phone?.replace(/\D/g, "") || "";
    const cleanCpf = profile.cpf?.replace(/\D/g, "") || "";
    const cleanCnpj = profile.cnpj?.replace(/\D/g, "") || "";

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
    if (!isCompany && cleanCpf.length !== 11) {
      toast.error("Informe um CPF válido para cobrança.");
      return;
    }
    if (isCompany && cleanCnpj.length !== 14) {
      toast.error("Informe um CNPJ válido para cobrança.");
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

    // New validation for family profile fields
    if (isFamily) {
      if (!profile.patient_name?.trim()) {
        toast.error("O nome do paciente é obrigatório.");
        return;
      }
      if (!profile.patient_age) {
        toast.error("A idade do paciente é obrigatória.");
        return;
      }
      if (!profile.patient_medical_conditions?.trim()) {
        toast.error("A condição médica do paciente é obrigatória.");
        return;
      }
      if ((profile.patient_specialties?.length || 0) === 0) {
        toast.error("Selecione ao menos uma especialidade necessária.");
        return;
      }
      if (profile.availability?.length === 0) {
        toast.error("O horário de atendimento é obrigatório.");
        return;
      }
    }

    setIsSaving(true);
    try {
      let finalLat = profile.lat;
      let finalLng = profile.lng;

      if (!finalLat || !finalLng) {
        if (!siteConfig?.google_maps_api_key) {
          toast.error("Chave da API do Google Maps não configurada. Acesse o Painel Admin > Configurações.");
          setIsSaving(false);
          return;
        }

        const coords = await getCoordinates({
          street: profile.address_street,
          number: profile.address_number,
          neighborhood: profile.neighborhood,
          city: profile.city,
          state: profile.state,
          zip: profile.address_zip
        });
        if (coords) {
          finalLat = coords.lat;
          finalLng = coords.lng;
        } else {
          toast.error("Não foi possível obter coordenadas para o endereço. Verifique o endereço ou a chave da API de mapas.");
          setIsSaving(false);
          return;
        }
      }

      const normalizedHourlyRate = (() => {
        const rawValue = String(profile.hourly_rate ?? "").trim();
        if (!rawValue) return null;
        const parsed = Number(rawValue.replace(",", "."));
        return Number.isFinite(parsed) ? parsed : null;
      })();

      const normalizedPatientAge = (() => {
        const rawValue = String(profile.patient_age ?? "").trim();
        if (!rawValue) return null;
        const parsed = Number.parseInt(rawValue, 10);
        return Number.isFinite(parsed) ? parsed : null;
      })();

      const whatsappOptIn = Boolean(profile.whatsapp_opt_in);
      const whatsappOptInAt = whatsappOptIn
        ? (profile.whatsapp_opt_in_at || new Date().toISOString())
        : null;

      const updatePayload = {
        full_name: profile.full_name,
        phone: profile.phone,
        bio: profile.bio,
        experience: profile.experience,
        professional_experiences: profile.professional_experiences,
        city: profile.city,
        state: profile.state,
        neighborhood: profile.neighborhood,
        specialty: isFamily
          ? (Array.isArray(profile.patient_specialties) && profile.patient_specialties.length > 0
              ? profile.patient_specialties[0]
              : null)
          : profile.specialty,
        registration: profile.registration,
        company_name: profile.company_name,
        cpf: profile.cpf,
        cnpj: profile.cnpj,
        ans_registration: profile.ans_registration, // Save new field
        hourly_rate: normalizedHourlyRate,
        availability: profile.availability,
        patient_profiles: profile.patient_profiles,
        address_zip: profile.address_zip,
        address_street: profile.address_street,
        address_number: profile.address_number,
        address_complement: profile.address_complement,
        lat: finalLat,
        lng: finalLng,
        updated_at: new Date().toISOString(),
        // New patient-specific fields
        patient_name: profile.patient_name,
        patient_age: normalizedPatientAge,
        patient_medical_conditions: profile.patient_medical_conditions,
        patient_specialties: profile.patient_specialties,
        patient_mobility_level: profile.patient_mobility_level,
        patient_cognitive_state: profile.patient_cognitive_state,
        patient_special_equipment: profile.patient_special_equipment,
        patient_communication_skills: profile.patient_communication_skills,
        whatsapp_opt_in: whatsappOptIn,
        whatsapp_opt_in_at: whatsappOptInAt,
        birth_date: profile.birth_date,
      };

      let { error } = await supabase.from("profiles").update(updatePayload).eq("id", user.id);

      // Compatibilidade: tenta criar os campos de família se o projeto ainda não tiver essa extensão aplicada.
      if (error && isFamily && isMissingFamilyFieldError(error)) {
        const retry = await retryProfileUpdateAfterFamilySetup(updatePayload);
        error = retry.error;
      }

      if (error) throw error;
      toast.success("Perfil salvo com sucesso!");
      fetchProfile();
    } catch (err: any) {
      console.error("[ProfilePage] Erro ao salvar perfil:", err);
      const missingColumn = getMissingProfileColumn(err);
      if (missingColumn?.startsWith("patient_")) {
        showFamilySchemaOutdatedToast(missingColumn);
      } else {
        const details = err?.message || err?.details || "Erro ao salvar perfil.";
        toast.error(details);
      }
    } finally {
      setIsSaving(false);
    }
  };

  const handleCheckboxChange = (
    field:
      | 'availability'
      | 'patient_profiles'
      | 'patient_specialties'
      | 'patient_mobility_level'
      | 'patient_cognitive_state'
      | 'patient_special_equipment'
      | 'patient_communication_skills',
    value: string,
  ) => {
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
      toast.error("Erro ao excluir conta.");
    } finally {
      setIsDeletingAccount(false);
    }
  };

  const handleRequestVerification = async () => {
    console.log("[handleRequestVerification] Iniciando solicitação de verificação para user:", user?.id);
    const isFamily = profile?.role === 'family';
    const isCompany = profile?.role === 'company';

    if (isFamily && (!profile?.id_document_url || !profile?.patient_document_url || !profile?.patient_address_proof_url)) {
      toast.error("Envie RG/CNH do responsável, RG/CNH do paciente e comprovante de endereço do paciente.");
      console.log("[handleRequestVerification] Erro: Documentação obrigatória ausente para família.");
      return;
    }
    if (isCompany && (!profile?.id_document_url || !profile?.prof_registration_url)) {
      toast.error("Envie o cartão CNPJ e o documento de identidade do responsável antes de solicitar análise.");
      console.log("[handleRequestVerification] Erro: documentação obrigatória ausente para empresa.");
      return;
    }
    if (!isFamily && !isCompany && (!profile?.id_document_url || !profile?.prof_registration_url)) {
      toast.error("Envie os dois documentos antes de solicitar análise.");
      console.log("[handleRequestVerification] Erro: Um ou ambos os documentos ausentes para profissional.");
      return;
    }

    setIsSaving(true);
    try {
      console.log("[handleRequestVerification] Atualizando profile.verification_sent para true no banco de dados.");
      const { error } = await supabase.from("profiles").update({ verification_sent: true }).eq("id", user?.id);
      if (error) throw error;
      
      console.log("[handleRequestVerification] Profile.verification_sent atualizado com sucesso no banco.");
      toast.success("Solicitação enviada!");
      
      // Call fetchProfile to re-fetch the latest data from the database
      await fetchProfile(); // <--- ADDED THIS LINE

      // NOTIFICAÇÃO ADMIN: Envia e-mail e notificação no dashboard
      const { data: authSession } = await supabase.auth.getSession();
      const accessToken = authSession?.session?.access_token || "";
      const { error: notifyError } = await supabase.functions.invoke('notify-verification', {
        body: {
          userName: profile.full_name,
          userEmail: user?.email,
          userId: user?.id,
          access_token: accessToken,
        }
      });
      if (notifyError) {
        console.warn("Falha ao notificar admin sobre verificação:", notifyError);
        toast.warning("Solicitação enviada, mas houve falha no envio das notificações.");
      }

    } catch (err) {
      console.error("[handleRequestVerification] Erro ao enviar solicitação:", err);
      toast.error("Erro ao enviar solicitação.");
    } finally {
      setIsSaving(false);
      console.log("[handleRequestVerification] Finalizando processo de solicitação.");
    }
  };

  const handleRetryVerification = async () => {
    if (!user) return;
    try {
      const { error } = await supabase
        .from("profiles")
        .update({ 
          rejection_reason: null, 
          verification_sent: false,
          id_document_url: null, // Clear document URLs
          prof_registration_url: null, // Clear document URLs
          patient_document_url: null,
          patient_address_proof_url: null,
          cnpj: null, // Clear CNPJ for company
          ans_registration: null // Clear ANS registration for company
        })
        .eq("id", user.id);
      if (error) throw error;
      toast.success("Agora você pode reenviar seus documentos na seção Meus Dados.");
      setProfile((prev: any) => ({ 
        ...prev, 
        rejection_reason: null, 
        verification_sent: false,
        id_document_url: null, // Clear document URLs in state
        prof_registration_url: null, // Clear document URLs in state
        patient_document_url: null,
        patient_address_proof_url: null,
        cnpj: null, // Clear CNPJ for company
        ans_registration: null // Clear ANS registration for company
      }));
      setUploadedDocNames({});
    } catch (err) {
      toast.error("Erro ao reiniciar processo.");
    }
  };

  if (loading) return <div className="flex justify-center p-8"><Loader2 className="animate-spin text-primary" /></div>;

  const isProfessional = profile.role === 'professional';
  const isCompany = profile.role === 'company';
  const isFamily = profile.role === 'family';
  const initials = profile.full_name?.split(" ").map((n: any) => n[0]).join("").slice(0, 2).toUpperCase() || "??";

  const doc1Label = isCompany ? "Cartão CNPJ" : isFamily ? "RG ou CNH do Responsável" : "RG ou CNH";
  const doc2Label = isCompany ? "RG ou CNH do Responsável" : "Registro Profissional";
  const familyDoc2Label = "RG ou CNH do Paciente";
  const familyDoc3Label = "Comprovante de Endereço (Paciente)";

  const getBenefits = () => {
    if (isProfessional) return ["Visibilidade para empresas.", "Cursos exclusivos.", "Propostas no WhatsApp.", "Selo de verificação."];
    if (isCompany) return ["Acesso a profissionais.", "Filtros avançados.", "Histórico centralizado.", "Suporte prioritário."];
    return ["Cuidadores verificados.", "Contato direto.", "Segurança documental.", "Suporte humanizado."];
  };

  const CONFIRMATION_PHRASE = "EXCLUIR MINHA CONTA";
  const isCompanyOrFamily = isCompany || isFamily;
  const companyFamilyContactEligibility = getCompanyFamilyContactEligibility(profile);
  const showCompanyFamilyContactWarning =
    isCompanyOrFamily && !companyFamilyContactEligibility.canAddProfessionalContact;

  const VerificationCard = (
    <Card>
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-2"><FileCheck className="h-4 w-4 text-primary" /> Verificação de Perfil</CardTitle>
        <CardDescription className="text-[10px]">O selo de verificação comprova a autenticidade dos seus documentos.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="bg-secondary/30 p-3 rounded-lg flex gap-3 items-start border border-border/50">
          <ShieldCheck className="h-5 w-5 text-primary shrink-0 mt-0.5" />
          <div className="space-y-1">
            <p className="text-sm font-semibold">Upload Seguro</p>
            <p className="text-[10px] text-muted-foreground leading-relaxed">Seus documentos são armazenados em um servidor privado com criptografia.</p>
          </div>
        </div>

        {profile.is_verified ? (
          <div className="bg-success/5 border border-success/20 rounded-lg p-4 flex flex-col items-center text-center"><CheckCircle2 className="h-8 w-8 text-success mb-2" /><p className="font-semibold text-success">Perfil Verificado</p></div>
        ) : profile.rejection_reason ? (
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
        ) : profile.verification_sent ? (
          <div className="bg-primary/5 border border-primary/20 rounded-lg p-4 text-center">
            <Clock className="h-8 w-8 text-primary mx-auto mb-2 animate-pulse" />
            <div>
              <p className="font-semibold text-primary">Documentos em Análise</p>
              <p className="text-xs text-muted-foreground mt-1">Aguarde o retorno por e-mail em até 24 horas úteis.</p>
            </div>
          </div>
        ) : (
          <div className="space-y-3">
            <p className="text-xs text-muted-foreground">Envie seus documentos para ganhar o selo de verificado.</p>
            <div className="space-y-1">
              <Label className="text-[10px] uppercase">{doc1Label}</Label>
              <div className="flex items-center gap-2">
                <Button variant="outline" size="sm" className="flex-1 justify-start text-xs h-9 truncate" onClick={() => idDocRef.current?.click()} disabled={!!isUploading}>
                  {isUploading === "id_doc" ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                  {getDocumentButtonLabel("id_doc", profile.id_document_url)}
                </Button>
                {profile.id_document_url && (
                  <Button variant="outline" size="sm" className="h-9 shrink-0" onClick={() => handleRemoveUploadedDocument("id_doc")} disabled={!!isUploading}>
                    Excluir
                  </Button>
                )}
              </div>
              <input type="file" id="id_doc" ref={idDocRef} className="hidden" accept="image/*,application/pdf" onChange={e => handleFileUpload(e, 'id_doc')} />
            </div>
            {!isFamily && (
              <div className="space-y-1">
                <Label className="text-[10px] uppercase">{doc2Label}</Label>
                <div className="flex items-center gap-2">
                  <Button variant="outline" size="sm" className="flex-1 justify-start text-xs h-9 truncate" onClick={() => profDocRef.current?.click()} disabled={!!isUploading}>
                    {isUploading === "prof_doc" ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                    {getDocumentButtonLabel("prof_doc", profile.prof_registration_url)}
                  </Button>
                  {profile.prof_registration_url && (
                    <Button variant="outline" size="sm" className="h-9 shrink-0" onClick={() => handleRemoveUploadedDocument("prof_doc")} disabled={!!isUploading}>
                      Excluir
                    </Button>
                  )}
                </div>
                <input type="file" id="prof_doc" ref={profDocRef} className="hidden" accept="image/*,application/pdf" onChange={e => handleFileUpload(e, 'prof_doc')} />
              </div>
            )}
            {isFamily && (
              <>
                <div className="space-y-1">
                  <Label className="text-[10px] uppercase">{familyDoc2Label}</Label>
                  <div className="flex items-center gap-2">
                    <Button variant="outline" size="sm" className="flex-1 justify-start text-xs h-9 truncate" onClick={() => patientDocRef.current?.click()} disabled={!!isUploading}>
                      {isUploading === "patient_doc" ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                      {getDocumentButtonLabel("patient_doc", profile.patient_document_url)}
                    </Button>
                    {profile.patient_document_url && (
                      <Button variant="outline" size="sm" className="h-9 shrink-0" onClick={() => handleRemoveUploadedDocument("patient_doc")} disabled={!!isUploading}>
                        Excluir
                      </Button>
                    )}
                  </div>
                  <input type="file" id="patient_doc" ref={patientDocRef} className="hidden" accept="image/*,application/pdf" onChange={e => handleFileUpload(e, 'patient_doc')} />
                </div>
                <div className="space-y-1">
                  <Label className="text-[10px] uppercase">{familyDoc3Label}</Label>
                  <div className="flex items-center gap-2">
                    <Button variant="outline" size="sm" className="flex-1 justify-start text-xs h-9 truncate" onClick={() => patientAddressProofRef.current?.click()} disabled={!!isUploading}>
                      {isUploading === "patient_address_proof" ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                      {getDocumentButtonLabel("patient_address_proof", profile.patient_address_proof_url)}
                    </Button>
                    {profile.patient_address_proof_url && (
                      <Button variant="outline" size="sm" className="h-9 shrink-0" onClick={() => handleRemoveUploadedDocument("patient_address_proof")} disabled={!!isUploading}>
                        Excluir
                      </Button>
                    )}
                  </div>
                  <input type="file" id="patient_address_proof" ref={patientAddressProofRef} className="hidden" accept="image/*,application/pdf" onChange={e => handleFileUpload(e, 'patient_address_proof')} />
                </div>
              </>
            )}
            <Button className="w-full" disabled={(!isFamily && (!profile.id_document_url || !profile.prof_registration_url)) || (isFamily && (!profile.id_document_url || !profile.patient_document_url || !profile.patient_address_proof_url)) || isSaving} onClick={handleRequestVerification}>{isSaving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null} Solicitar Análise</Button>
          </div>
        )}
      </CardContent>
    </Card>
  );

  const SecurityCard = (
    <Card>
      <CardHeader><CardTitle className="text-base flex items-center gap-2"><KeyRound className="h-4 w-4 text-primary" /> Segurança</CardTitle></CardHeader>
      <CardContent><ChangePasswordDialog /></CardContent>
    </Card>
  );

  const DangerZoneCard = (
    <Collapsible open={isDangerZoneOpen} onOpenChange={setIsDangerZoneOpen} className="border border-destructive/20 rounded-xl bg-card overflow-hidden">
      <CollapsibleTrigger asChild><Button variant="ghost" className="w-full flex items-center justify-between p-6 h-auto hover:bg-destructive/5 group"><div className="flex items-center gap-2 text-destructive"><Trash2 className="h-4 w-4" /><span className="font-semibold text-base">Zona de Perigo</span></div>{isDangerZoneOpen ? <ChevronUp className="h-4 w-4 text-destructive" /> : <ChevronDown className="h-4 w-4 text-destructive" />}</Button></CollapsibleTrigger>
      <CollapsibleContent className="px-6 pb-6 space-y-4 animate-accordion-down"><p className="text-[10px] text-muted-foreground">Ações irreversíveis relacionadas à exclusão definitiva da sua conta.</p><Button variant="destructive" size="sm" className="w-full justify-start gap-2 h-10" onClick={() => { setDeleteStep(1); setDeleteAccountModalOpen(true); }}><Trash2 className="h-4 w-4" /> Excluir minha conta permanentemente</Button></CollapsibleContent>
    </Collapsible>
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-1">
        <h1 className="text-2xl font-bold tracking-tight">Meus Dados</h1>
        <p className="text-muted-foreground">Mantenha seu perfil atualizado para melhores resultados.</p>
      </div>
      {showCompanyFamilyContactWarning && (
        <Card className="border-amber-300/60 bg-amber-50/80">
          <CardContent className="pt-6">
            <div className="flex items-start gap-3">
              <AlertTriangle className="h-5 w-5 text-amber-700 mt-0.5 shrink-0" />
              <div className="space-y-1">
                <p className="font-semibold text-amber-900">
                  Contato com profissionais bloqueado até concluir os requisitos
                </p>
                <p className="text-sm text-amber-800">
                  {getCompanyFamilyContactBlockMessage(companyFamilyContactEligibility)}
                </p>
                {!companyFamilyContactEligibility.isProfileComplete && companyFamilyContactEligibility.missingProfileFields.length > 0 && (
                  <p className="text-xs text-amber-800/90">
                    Pendências do perfil: {companyFamilyContactEligibility.missingProfileFields.join(", ")}.
                  </p>
                )}
                {!companyFamilyContactEligibility.isDocumentsVerified && (
                  <p className="text-xs text-amber-800/90">
                    Assim que seus documentos forem aprovados, o contato será liberado automaticamente.
                  </p>
                )}
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      <div className="grid gap-6 lg:grid-cols-3">
        <div className={`${isCompanyOrFamily ? "order-2 lg:order-none " : ""}lg:col-span-2 flex flex-col gap-6`}>
          <div className={isFamily ? "order-2 lg:order-none" : isCompany ? "order-1 lg:order-none" : ""}>
            <Card>
            <CardHeader>
              <CardTitle>Informações Básicas</CardTitle>
              <CardDescription>Dados essenciais para identificação na plataforma.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="flex items-center gap-4">
                <div className="relative">
                  <Avatar className="h-24 w-24 ring-4 ring-border">
                    <AvatarImage src={profile.avatar_url} />
                    <AvatarFallback className="text-2xl">{initials}</AvatarFallback>
                  </Avatar>
                  <Button size="icon" variant="secondary" className="absolute -bottom-1 -right-1 rounded-full shadow-md" onClick={() => avatarRef.current?.click()} disabled={!!isUploading}>
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
                  <Label>{isFamily ? "Nome Completo do Responsável *" : isCompany ? "Nome Fantasia *" : "Nome Completo *"}</Label>
                  <Input value={profile.full_name || ""} onChange={e => setProfile({...profile, full_name: e.target.value})} />
                </div>
                <div className="grid gap-2"><Label>WhatsApp *</Label><Input value={profile.phone || ""} onChange={handlePhoneChange} placeholder="(11) 99999-9999" /></div>
              </div>

              <div className="flex items-center justify-between rounded-lg border p-3">
                <div className="space-y-1 pr-3">
                  <Label className="text-sm">Receber notificações por WhatsApp</Label>
                  <p className="text-[10px] text-muted-foreground">
                    Ao ativar, você autoriza alertas transacionais da plataforma no seu número cadastrado.
                  </p>
                </div>
                <Switch
                  checked={!!profile.whatsapp_opt_in}
                  onCheckedChange={(checked) =>
                    setProfile((prev: any) => ({
                      ...prev,
                      whatsapp_opt_in: checked,
                      whatsapp_opt_in_at: checked ? prev?.whatsapp_opt_in_at || new Date().toISOString() : null,
                    }))
                  }
                />
              </div>

              <div className="grid gap-2">
                <Label className="flex items-center gap-2"><Mail className="h-3 w-3 text-muted-foreground" /> E-mail de Acesso</Label>
                <Input value={profile.email || ""} disabled readOnly className="bg-muted" />
              </div>

              {isProfessional ? (
                <div className="grid gap-4 md:grid-cols-2">
                  <div className="grid gap-2">
                    <Label>Especialidade *</Label>
                    <Select value={profile.specialty} onValueChange={v => setProfile({...profile, specialty: v})}>
                      <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                      <SelectContent>{specialties.map(s => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                  <div className="grid gap-2"><Label>Registro Profissional</Label><Input value={profile.registration || ""} onChange={e => setProfile({...profile, registration: e.target.value})} /></div>
                  <div className="grid gap-2"><Label>CPF *</Label><Input value={profile.cpf || ""} onChange={e => setProfile({...profile, cpf: e.target.value})} placeholder="000.000.000-00" /></div>
                  <div className="grid gap-2"><Label>Data de Nascimento</Label><Input type="date" value={profile.birth_date || ""} onChange={e => setProfile({...profile, birth_date: e.target.value})} /></div>
                </div>
              ) : (
                <div className="grid gap-4 md:grid-cols-2">
                  {isCompany && ( // Render only if it's a company profile
                    <>
                      <div className="grid gap-2">
                        <Label>Razão Social</Label>
                        <Input value={profile.company_name || ""} onChange={e => setProfile({...profile, company_name: e.target.value})} />
                      </div>
                      <div className="grid gap-2"><Label>CNPJ</Label><Input value={profile.cnpj || ""} onChange={e => setProfile({...profile, cnpj: e.target.value})} /></div>
                      <div className="grid gap-2"><Label>Registro ANS</Label><Input value={profile.ans_registration || ""} onChange={e => setProfile({...profile, ans_registration: e.target.value})} /></div>
                    </>
                  )}
                  {!isCompany && (
                    <div className="grid gap-2">
                      <Label>{isFamily ? "CPF do Responsável *" : "CPF *"}</Label>
                      <Input value={profile.cpf || ""} onChange={e => setProfile({...profile, cpf: e.target.value})} placeholder="000.000.000-00" />
                    </div>
                  )}
                </div>
              )}
            </CardContent>
            </Card>
          </div>

          <div className={isFamily ? "order-3 lg:order-none" : isCompany ? "order-4 lg:order-none" : ""}>
            <Card>
            <CardHeader>
              <CardTitle>Endereço e Localização *</CardTitle>
              <CardDescription>Sua localização é usada para te conectar a oportunidades próximas.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {!siteConfig?.google_maps_api_key && (
                <div className="bg-destructive/10 border border-destructive/20 rounded-lg p-4 flex items-start gap-3 text-destructive">
                  <AlertCircle className="h-5 w-5 shrink-0 mt-0.5" />
                  <div className="text-sm">
                    <p className="font-bold">Chave da API do Google Maps ausente!</p>
                    <p className="text-xs">A geolocalização automática não funcionará. Configure a chave em <Link to="/admin/configuracoes" className="underline">Painel Admin {'>'} Configurações</Link>.</p>
                  </div>
                </div>
              )}
              <div className="grid gap-4 md:grid-cols-4">
                <div className="grid gap-2">
                  <Label>CEP *</Label>
                  <div className="relative">
                    <Input value={profile.address_zip || ""} onChange={e => setProfile({...profile, address_zip: e.target.value})} onBlur={handleCepBlur} />
                    {isLoadingCep && <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 animate-spin text-muted-foreground" />}
                  </div>
                </div>
                <div className="grid gap-2 md:col-span-2"><Label>Rua *</Label><Input value={profile.address_street || ""} onChange={e => setProfile({...profile, address_street: e.target.value})} /></div>
                <div className="grid gap-2"><Label>Número</Label><Input value={profile.address_number || ""} onChange={e => setProfile({...profile, address_number: e.target.value})} onBlur={() => handleValidateLocation()} /></div>
              </div>
              <div className="grid gap-4 md:grid-cols-3">
                <div className="grid gap-2">
                  <Label>Estado (UF) *</Label>
                  <Select value={profile.state || ""} onValueChange={handleStateProfileChange}>
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione o estado" />
                    </SelectTrigger>
                    <SelectContent>
                      {BRAZIL_STATES.map((uf) => (
                        <SelectItem key={uf} value={uf}>
                          {uf}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid gap-2">
                  <Label>Cidade *</Label>
                  <Select
                    value={profile.city || ""}
                    onValueChange={handleCityProfileChange}
                    disabled={!profile.state || loadingCitiesByState}
                  >
                    <SelectTrigger>
                      <SelectValue
                        placeholder={
                          !profile.state
                            ? "Selecione o estado primeiro"
                            : loadingCitiesByState
                              ? "Carregando cidades..."
                              : "Selecione a cidade"
                        }
                      />
                    </SelectTrigger>
                    <SelectContent>
                      {profile.city && !citiesByState.includes(profile.city) && (
                        <SelectItem value={profile.city}>{profile.city}</SelectItem>
                      )}
                      {citiesByState.map((city) => (
                        <SelectItem key={city} value={city}>
                          {city}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid gap-2"><Label>Bairro *</Label><Input value={profile.neighborhood || ""} onChange={e => setProfile({...profile, neighborhood: e.target.value})} /></div>
              </div>
              <div className="grid gap-4 md:grid-cols-1">
                <div className="grid gap-2"><Label>Complemento</Label><Input value={profile.address_complement || ""} onChange={e => setProfile({...profile, address_complement: e.target.value})} /></div>
              </div>

              <div className="pt-4 border-t space-y-4">
                <div className="flex items-center justify-between">
                  <div className="space-y-1">
                    <Label className="flex items-center gap-2"><Navigation className="h-4 w-4 text-primary" /> Coordenadas Geográficas</Label>
                    <p className="text-[10px] text-muted-foreground">Detectadas automaticamente.</p>
                  </div>
                  <Button variant="outline" size="sm" className="gap-2 h-8 text-xs" onClick={() => handleValidateLocation()} disabled={isGeocoding}>
                    {isGeocoding ? <Loader2 className="h-3 w-3 animate-spin" /> : <RefreshCw className="h-3 w-3" />} Recalcular
                  </Button>
                </div>
                <div className="grid gap-4 md:grid-cols-2">
                  <div className="grid gap-1.5"><Label className="text-[10px] uppercase text-muted-foreground">Latitude</Label><Input value={profile.lat || ""} readOnly className="bg-muted font-mono text-xs h-8" /></div>
                  <div className="grid gap-1.5"><Label className="text-[10px] uppercase text-muted-foreground">Longitude</Label><Input value={profile.lng || ""} readOnly className="bg-muted font-mono text-xs h-8" /></div>
                </div>
              </div>
            </CardContent>
            </Card>
          </div>

          {isProfessional && (
            <>
              <Card>
                <CardHeader>
                  <CardTitle>Currículo e Biografia *</CardTitle>
                  <CardDescription>Destaque suas competências e trajetória.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid gap-2"><Label>Formações *</Label><Textarea value={profile.experience || ""} onChange={e => setProfile({...profile, experience: e.target.value})} rows={3} /></div>
                  <div className="grid gap-2"><Label>Experiências Profissionais *</Label><Textarea value={profile.professional_experiences || ""} onChange={e => setProfile({...profile, professional_experiences: e.target.value})} rows={3} /></div>
                  <div className="pt-2 flex flex-col gap-2">
                    <div className="flex items-center justify-between"><Label>Biografia para o Perfil *</Label><Button variant="outline" size="sm" className="h-8 gap-2 text-xs" onClick={handleGenerateBio} disabled={isGeneratingBio}>{isGeneratingBio ? <Loader2 className="h-3 w-3 animate-spin" /> : <Sparkles className="h-3 w-3 text-primary" />} Gerar com IA</Button></div>
                    <Textarea value={profile.bio || ""} onChange={e => setProfile({...profile, bio: e.target.value})} rows={5} maxLength={700} />
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Detalhes do Atendimento *</CardTitle>
                  <CardDescription>Defina suas preferências e valores.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                  <div className="grid gap-2"><Label>Valor/Hora (R$) *</Label><Input type="number" value={profile.hourly_rate || ""} onChange={e => setProfile({...profile, hourly_rate: e.target.value})} /></div>
                  <Separator />
                  <div className="space-y-3">
                    <Label className="text-xs uppercase">Disponibilidade *</Label>
                    <p className="text-[10px] text-muted-foreground">
                      Você pode selecionar mais de uma opção. Ex.: Dia Integral (Diurno) + 1h de atendimento.
                    </p>
                    <div className="grid gap-2">{availabilityOptions.map(opt => (<div key={opt} className="flex items-center gap-2"><Checkbox id={opt} checked={profile.availability?.includes(opt)} onCheckedChange={() => handleCheckboxChange('availability', opt)} /><label htmlFor={opt} className="text-xs">{opt}</label></div>))}</div>
                  </div>
                  <Separator />
                  <div className="space-y-3">
                    <Label className="text-xs uppercase">Público-alvo *</Label>
                    <div className="grid gap-2">{patientProfileOptions.map(opt => (<div key={opt} className="flex items-center gap-2"><Checkbox id={opt} checked={profile.patient_profiles?.includes(opt)} onCheckedChange={() => handleCheckboxChange('patient_profiles', opt)} /><label htmlFor={opt} className="text-xs">{opt}</label></div>))}</div>
                  </div>
                </CardContent>
              </Card>
            </>
          )}

          {isCompany && <div className="lg:hidden order-6">{SecurityCard}</div>}
          {isCompany && <div className="lg:hidden order-7">{DangerZoneCard}</div>}

          {isCompany && (
            <div className="order-5 lg:order-none">
              <Card>
                <CardHeader><CardTitle>Sobre a Empresa *</CardTitle></CardHeader>
                <CardContent><Textarea value={profile.bio || ""} onChange={e => setProfile({...profile, bio: e.target.value})} rows={6} /></CardContent>
              </Card>
            </div>
          )}

          {isFamily && (
            <div className="order-1 lg:order-none">
              <Card>
                <CardHeader>
                  <CardTitle>Informações do Paciente *</CardTitle>
                  <CardDescription>Detalhes sobre a pessoa que precisa de atendimento.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                <div className="grid gap-4 md:grid-cols-2">
                  <div className="grid gap-2">
                    <Label className="flex items-center gap-2"><User className="h-4 w-4 text-primary" /> Nome do Paciente *</Label>
                    <Input placeholder="Ex: João Silva" value={profile.patient_name || ""} onChange={e => setProfile({...profile, patient_name: e.target.value})} />
                    <p className="text-[10px] text-muted-foreground">Pode ser apenas o primeiro nome ou iniciais para privacidade.</p>
                  </div>
                  <div className="grid gap-2">
                    <Label className="flex items-center gap-2"><Calendar className="h-4 w-4 text-primary" /> Idade *</Label>
                    <Input type="number" value={profile.patient_age || ""} onChange={e => setProfile({...profile, patient_age: parseInt(e.target.value) || ""})} />
                  </div>
                </div>

                <div className="grid gap-2">
                  <Label className="flex items-center gap-2"><HeartPulse className="h-4 w-4 text-primary" /> Condição Médica/Histórico de Doenças *</Label>
                  <Textarea 
                    value={profile.patient_medical_conditions || ""} 
                    onChange={e => setProfile({...profile, patient_medical_conditions: e.target.value})} 
                    rows={3} 
                    placeholder="Ex: AVC com sequelas motoras, Alzheimer em estágio inicial, Diabetes tipo 2."
                  />
                  <p className="text-[10px] text-muted-foreground">Descreva o diagnóstico principal e outras condições relevantes.</p>
                </div>

                <Separator />

                <div className="space-y-3">
                  <Label className="text-xs uppercase flex items-center gap-2">
                    <Users className="h-4 w-4 text-primary" /> Especialidades Necessárias *
                  </Label>
                  <div className="grid gap-2 md:grid-cols-2">
                    {specialties.map((option) => (
                      <div key={`family-specialty-${option.value}`} className="flex items-center gap-2">
                        <Checkbox
                          id={`family-specialty-${option.value}`}
                          checked={profile.patient_specialties?.includes(option.value)}
                          onCheckedChange={() => handleCheckboxChange("patient_specialties", option.value)}
                        />
                        <label htmlFor={`family-specialty-${option.value}`} className="text-sm">{option.label}</label>
                      </div>
                    ))}
                  </div>
                  <p className="text-[10px] text-muted-foreground">
                    Selecione uma ou mais especialidades para o atendimento do paciente.
                  </p>
                </div>

                <Separator />

                <div className="space-y-3">
                  <Label className="text-xs uppercase flex items-center gap-2"><Footprints className="h-4 w-4 text-primary" /> Nível de Mobilidade</Label>
                  <div className="grid gap-2 md:grid-cols-2">
                    {mobilityLevelOptions.map(opt => (
                      <div key={opt} className="flex items-center gap-2">
                        <Checkbox 
                          id={`mobility-${opt}`} 
                          checked={profile.patient_mobility_level?.includes(opt)} 
                          onCheckedChange={() => handleCheckboxChange('patient_mobility_level', opt)} 
                        />
                        <label htmlFor={`mobility-${opt}`} className="text-sm">{opt}</label>
                      </div>
                    ))}
                  </div>
                  <p className="text-[10px] text-muted-foreground">Selecione as opções que melhor descrevem a capacidade de movimentação do paciente.</p>
                </div>

                <Separator />

                <div className="space-y-3">
                  <Label className="text-xs uppercase flex items-center gap-2"><Brain className="h-4 w-4 text-primary" /> Estado Cognitivo</Label>
                  <div className="grid gap-2 md:grid-cols-2">
                    {cognitiveStateOptions.map(opt => (
                      <div key={opt} className="flex items-center gap-2">
                        <Checkbox 
                          id={`cognitive-${opt}`} 
                          checked={profile.patient_cognitive_state?.includes(opt)} 
                          onCheckedChange={() => handleCheckboxChange('patient_cognitive_state', opt)} 
                        />
                        <label htmlFor={`cognitive-${opt}`} className="text-sm">{opt}</label>
                      </div>
                    ))}
                  </div>
                  <p className="text-[10px] text-muted-foreground">Indique o nível de clareza mental e orientação do paciente.</p>
                </div>

                <Separator />

                <div className="space-y-3">
                  <Label className="text-xs uppercase flex items-center gap-2"><Syringe className="h-4 w-4 text-primary" /> Equipamentos Especiais Utilizados</Label>
                  <div className="grid gap-2 md:grid-cols-2">
                    {specialEquipmentOptions.map(opt => (
                      <div key={opt} className="flex items-center gap-2">
                        <Checkbox 
                          id={`equipment-${opt}`} 
                          checked={profile.patient_special_equipment?.includes(opt)} 
                          onCheckedChange={() => handleCheckboxChange('patient_special_equipment', opt)} 
                        />
                        <label htmlFor={`equipment-${opt}`} className="text-sm">{opt}</label>
                      </div>
                    ))}
                  </div>
                  <p className="text-[10px] text-muted-foreground">Marque os equipamentos que o profissional precisará manusear.</p>
                </div>

                <Separator />

                <div className="space-y-3">
                  <Label className="text-xs uppercase flex items-center gap-2"><MessageSquare className="h-4 w-4 text-primary" /> Habilidades de Comunicação</Label>
                  <div className="grid gap-2 md:grid-cols-2">
                    {communicationSkillsOptions.map(opt => (
                      <div key={opt} className="flex items-center gap-2">
                        <Checkbox 
                          id={`communication-${opt}`} 
                          checked={profile.patient_communication_skills?.includes(opt)} 
                          onCheckedChange={() => handleCheckboxChange('patient_communication_skills', opt)} 
                        />
                        <label htmlFor={`communication-${opt}`} className="text-sm">{opt}</label>
                      </div>
                    ))}
                  </div>
                  <p className="text-[10px] text-muted-foreground">Como o paciente se comunica com o ambiente e as pessoas?</p>
                </div>

                <Separator />

                <div className="space-y-3">
                  <Label className="text-xs uppercase">Horário de Atendimento *</Label>
                  <div className="grid gap-2 md:grid-cols-2">
                    {availabilityOptions.map(opt => (
                      <div key={opt} className="flex items-center gap-2">
                        <Checkbox 
                          id={`availability-${opt}`} 
                          checked={profile.availability?.includes(opt)} 
                          onCheckedChange={() => handleCheckboxChange('availability', opt)} 
                        />
                        <label htmlFor={`availability-${opt}`} className="text-xs">{opt}</label>
                      </div>
                    ))}
                  </div>
                  <p className="text-[10px] text-muted-foreground">Você pode selecionar mais de uma opção. Ex.: Dia Integral (Diurno) + 1h de atendimento.</p>
                </div>

                <Separator />

                <div className="grid gap-2">
                  <Label>Outras observações sobre o paciente *</Label>
                  <Textarea value={profile.bio || ""} onChange={e => setProfile({...profile, bio: e.target.value})} rows={6} />
                  <p className="text-[10px] text-muted-foreground">Informações adicionais que o profissional precisa saber (ex: preferências, rotina, temperamento).</p>
                </div>
                </CardContent>
              </Card>
            </div>
          )}

          {isFamily && <div className="lg:hidden order-4">{SecurityCard}</div>}
          {isFamily && <div className="lg:hidden order-5">{DangerZoneCard}</div>}

          <div className={isFamily ? "order-6 lg:order-none" : isCompany ? "order-8 lg:order-none" : ""}>
            <div className="flex justify-end gap-3">
            <Button variant="outline" onClick={() => fetchProfile()}>Descartar</Button>
            <Button onClick={handleSave} disabled={isSaving} className="gap-2">{isSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />} Salvar Alterações</Button>
            </div>
          </div>
        </div>

        <div className={`${isCompanyOrFamily ? "order-1 lg:order-none " : ""}space-y-6`}>
          {VerificationCard}
          {isCompanyOrFamily ? (
            <>
              <div className="hidden lg:block">{SecurityCard}</div>
              <div className="hidden lg:block">{DangerZoneCard}</div>
            </>
          ) : (
            <>
              {SecurityCard}
              {DangerZoneCard}
            </>
          )}
        </div>
      </div>

      <Dialog open={deleteAccountModalOpen} onOpenChange={(open) => { setDeleteAccountModalOpen(open); if (!open) { setDeleteStep(1); setDeleteConfirmationText(""); } }}>
        <DialogContent className="sm:max-w-[500px]">
          {deleteStep === 1 ? (
            <>
              <DialogHeader><DialogTitle className="flex items-center gap-2 text-destructive"><ShieldAlert className="h-5 w-5" /> Sentiremos sua falta!</DialogTitle><DialogDescription className="pt-2 text-base">Você tem certeza que deseja excluir sua conta?</DialogDescription></DialogHeader>
              <div className="py-4 space-y-3">{getBenefits().map((benefit, i) => (<div key={i} className="flex items-start gap-3 bg-secondary/20 p-3 rounded-lg border border-border/50"><div className="h-5 w-5 rounded-full bg-success/10 flex items-center justify-center shrink-0 mt-0.5"><Check className="h-3 w-3 text-success" /></div><span className="text-sm text-foreground/80">{benefit}</span></div>))}</div>
              <DialogFooter className="mt-6 gap-2 sm:gap-0"><Button variant="ghost" onClick={() => setDeleteAccountModalOpen(false)}>Manter Minha Conta</Button><Button variant="destructive" onClick={() => setDeleteStep(2)}>Prosseguir com a Exclusão</Button></DialogFooter>
            </>
          ) : (
            <>
              <DialogHeader><DialogTitle className="flex items-center gap-2 text-destructive"><AlertTriangle className="h-5 w-5" /> Confirmação Final</DialogTitle><DialogDescription className="pt-2">Digite a frase abaixo exatamente como aparece:</DialogDescription></DialogHeader>
              <div className="py-6 space-y-4"><div className="text-center p-4 bg-muted rounded-lg border border-dashed border-muted-foreground/30"><span className="font-mono font-bold text-lg tracking-wider select-none">{CONFIRMATION_PHRASE}</span></div><div className="space-y-2"><Label htmlFor="delete-confirm-input">Digite a frase de confirmação</Label><Input id="delete-confirm-input" placeholder="EXCLUIR MINHA CONTA" value={deleteConfirmationText} onChange={(e) => setDeleteConfirmationText(e.target.value)} className="h-12 text-center font-medium" autoFocus /></div></div>
              <DialogFooter className="gap-2 sm:gap-0"><Button variant="ghost" onClick={() => setDeleteStep(1)} disabled={isDeletingAccount}>Voltar</Button><Button variant="destructive" onClick={handleDeleteAccount} disabled={isDeletingAccount || deleteConfirmationText !== CONFIRMATION_PHRASE} className="gap-2">{isDeletingAccount ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />} Excluir Conta Permanentemente</Button></DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>

      <OnboardingModal open={isOnboardingOpen} onOpenChange={setIsOnboardingOpen} forceShow={true} role={profile?.role} />
      {imageToCrop && (
        <ImageCropper 
          image={imageToCrop} 
          onCropComplete={handleCropComplete} 
          onCancel={() => setImageToCrop(null)} 
        />
      )}
    </div>
  );
};

export default ProfilePage;


