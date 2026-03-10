"use client";

import { useState, useEffect, useMemo, useRef } from "react";
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
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import Layout from "@/components/layout/Layout";
import ProfessionalCard from "@/components/ProfessionalCard";
import ProfessionalMap from "@/components/ProfessionalMap";
import ProfessionalMapModal from "@/components/ProfessionalMapModal";
import { Search, Filter, Building2, Home, DollarSign, Sparkles, Headset, ArrowRight, Users, Star, ShieldCheck, Loader2, MapPin, AlertCircle, Map as MapIcon, LayoutGrid, ChevronDown, ChevronUp } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Skeleton } from "@/components/ui/skeleton";
import { useAuth } from "@/components/auth/AuthProvider";
import { Link, Navigate } from "react-router-dom";
import { useSiteConfig } from "@/hooks/use-site-config";
import AccessRestricted from "@/components/AccessRestricted";
import { subDays } from "date-fns";
import { calculateDistance } from "@/lib/geo-utils";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { BRAZIL_STATES, fetchCitiesByState } from "@/lib/brazil-locations";

const getInitialSpecialtyFromUrl = () => {
  const value = new URLSearchParams(window.location.search).get("specialty");
  return value || "";
};

const normalizeSearchText = (value?: string | null) =>
  (value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/\bjd\b/g, "jardim")
    .replace(/\bvl\b/g, "vila")
    .replace(/\bsta\b/g, "santa")
    .replace(/\bsto\b/g, "santo")
    .replace(/\bsao\b/g, "sao")
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();

const Buscar = () => {
  const { user, session, loading: authLoading } = useAuth();
  const { data: config, isLoading: isLoadingConfig } = useSiteConfig();
  const [userProfile, setUserProfile] = useState<any>(null);
  const [allProfessionals, setAllProfessionals] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [isMapExpanded, setIsMapExpanded] = useState(false);
  const [selectedProfessional, setSelectedProfessional] = useState<any | null>(null);
  const [mapBounds, setMapBounds] = useState<google.maps.LatLngBounds | null>(null);
  const [searchTrigger, setSearchTrigger] = useState(0);
  const [mapRefitTrigger, setMapRefitTrigger] = useState(0); // NEW: Trigger for map refit
  const [companyPatientLocations, setCompanyPatientLocations] = useState<Array<{
    id: string;
    lat: number;
    lng: number;
    label: string;
    zip?: string;
  }>>([]);
  const [conciergeModalOpen, setConciergeModalOpen] = useState(false);
  const [isSubmittingConcierge, setIsSubmittingConcierge] = useState(false);
  const [conciergeForm, setConciergeForm] = useState({
    specialty: "",
    city: "",
    state: "",
    neighborhood: "",
    availability: "",
    patient_profile: "",
    max_hourly_rate: "",
    urgency: "esta-semana",
    details: "",
  });
  
  const [filters, setFilters] = useState({
    specialty: getInitialSpecialtyFromUrl(),
    city: "",
    neighborhood: "",
    state: "",
    search: "",
    availability: "",
    patient_profile: "",
    max_hourly_rate: "",
  });

  const [showFilters, setShowFilters] = useState(false);
  const [availableCities, setAvailableCities] = useState<string[]>([]);
  const [loadingCities, setLoadingCities] = useState(false);
  const [conciergeCities, setConciergeCities] = useState<string[]>([]);
  const [loadingConciergeCities, setLoadingConciergeCities] = useState(false);
  const resultsSectionRef = useRef<HTMLDivElement | null>(null);
  const pendingMobileResultsScrollRef = useRef(false);

  const isMobileViewport = () =>
    typeof window !== "undefined" && window.matchMedia("(max-width: 767px)").matches;

  const setFilterValue = (
    field: keyof typeof filters,
    value: string,
    options?: { scrollToResultsOnMobile?: boolean },
  ) => {
    if (options?.scrollToResultsOnMobile && isMobileViewport()) {
      pendingMobileResultsScrollRef.current = true;
    }
    setFilters((prev) => ({ ...prev, [field]: value }));
  };

  useEffect(() => {
    const fetchMyProfile = async () => {
      if (user) {
        const { data, error } = await supabase
          .from("profiles")
          .select("*")
          .eq("id", user.id)
          .maybeSingle();
        
        if (!error && data) {
          setUserProfile(data);
        } else {
          setUserProfile({ role: 'guest' });
        }
      }
    };
    fetchMyProfile();
  }, [user]);

  useEffect(() => {
    const loadCitiesByState = async () => {
      if (!filters.state) {
        setAvailableCities([]);
        return;
      }

      setLoadingCities(true);
      try {
        const cities = await fetchCitiesByState(filters.state);
        setAvailableCities(cities);
      } catch (err) {
        console.error("[Buscar] Erro ao carregar cidades por estado:", err);
        setAvailableCities([]);
      } finally {
        setLoadingCities(false);
      }
    };

    loadCitiesByState();
  }, [filters.state]);

  useEffect(() => {
    const loadConciergeCitiesByState = async () => {
      if (!conciergeForm.state) {
        setConciergeCities([]);
        return;
      }

      setLoadingConciergeCities(true);
      try {
        const cities = await fetchCitiesByState(conciergeForm.state);
        setConciergeCities(cities);
      } catch (err) {
        console.error("[Buscar] Erro ao carregar cidades do concierge por estado:", err);
        setConciergeCities([]);
      } finally {
        setLoadingConciergeCities(false);
      }
    };

    loadConciergeCitiesByState();
  }, [conciergeForm.state]);

  useEffect(() => {
    const geocodeZipWithCache = async (zipRaw?: string | null) => {
      const zip = (zipRaw || "").replace(/\D/g, "");
      if (zip.length !== 8) return null;

      const cacheKey = `hcm:zip-geocode:${zip}`;
      try {
        const cached = localStorage.getItem(cacheKey);
        if (cached) {
          const parsed = JSON.parse(cached);
          const lat = Number(parsed?.lat);
          const lng = Number(parsed?.lng);
          if (Number.isFinite(lat) && Number.isFinite(lng)) {
            return { lat, lng };
          }
        }
      } catch {
        // Ignore cache parse errors and continue with geocoding
      }

      const { data, error } = await supabase.functions.invoke("geocode-address", {
        body: { address: `${zip}, Brasil` }
      });

      if (error || !data?.lat || !data?.lng) return null;

      const coords = { lat: Number(data.lat), lng: Number(data.lng) };
      localStorage.setItem(cacheKey, JSON.stringify(coords));
      return coords;
    };

    const fetchCompanyPatientLocations = async () => {
      if (!user || userProfile?.role !== "company" || !isMapExpanded) {
        setCompanyPatientLocations([]);
        return;
      }

      try {
        const { data: patients, error } = await supabase
          .from("company_patients")
          .select("id, patient_name, patient_zip")
          .eq("company_id", user.id)
          .order("created_at", { ascending: false });

        if (error) throw error;

        let rateLimited = false;
        const points: Array<{ id: string; lat: number; lng: number; label: string; zip?: string }> = [];

        for (const patient of patients || []) {
          const zip = (patient.patient_zip || "").replace(/\D/g, "");
          if (zip.length !== 8) continue;

          const coords = await geocodeZipWithCache(zip);
          if (!coords) {
            rateLimited = true;
            continue;
          }

          points.push({
            id: patient.id,
            lat: coords.lat,
            lng: coords.lng,
            label: patient.patient_name?.trim() || `Paciente ${patient.id.slice(0, 4).toUpperCase()}`,
            zip,
          });
        }

        setCompanyPatientLocations(points);
        setMapRefitTrigger((prev) => prev + 1);

        if (rateLimited && points.length === 0) {
          toast.warning("Não foi possível localizar alguns CEPs de pacientes no momento.");
        }
      } catch (err) {
        console.error("[Buscar] Erro ao carregar localizações dos pacientes:", err);
        setCompanyPatientLocations([]);
      }
    };

    fetchCompanyPatientLocations();
  }, [user?.id, userProfile?.role, isMapExpanded]);

  useEffect(() => {
    const fetchProfessionals = async () => {
      if (!userProfile || isLoadingConfig) return;
      
      if (userProfile.role === 'professional') {
        setLoading(false);
        return;
      }
      
      setLoading(true);

      if (config && config.enable_professional_list === false) {
        setAllProfessionals([]);
        setLoading(false);
        setMapRefitTrigger(prev => prev + 1); // Trigger map refit
        return;
      }

      const parsePeriodToDays = (periodValue?: string | null, fallbackDays = 30) => {
        const period = String(periodValue || "").toLowerCase();
        if (!period) return fallbackDays;
        const numberMatch = period.match(/\d+/);
        const amount = numberMatch ? Number(numberMatch[0]) : 1;
        const safeAmount = Number.isFinite(amount) && amount > 0 ? amount : 1;
        if (period.includes("dia")) return safeAmount;
        if (period.includes("ano")) return safeAmount * 365;
        if (period.includes("mes") || period.includes("mês")) return safeAmount * 30;
        return fallbackDays;
      };

      const { data: freeTrialPlan } = await supabase
        .from("plans")
        .select("period")
        .eq("id", "free_trial")
        .maybeSingle();

      const freeTrialDays = parsePeriodToDays(freeTrialPlan?.period, 30);
      const trialLimitDate = subDays(new Date(), freeTrialDays).toISOString();
      const nowIso = new Date().toISOString();

      // ALTERAÇÃO DE SEGURANÇA: consultamos a VIEW 'professional_discovery',
      // que não contém campos sensíveis como telefone ou endereço exato.
      let query = supabase
        .from("professional_discovery")
        .select("*")
        .or(
          `and(subscription_tier.in.(monthly,yearly),or(subscription_end_at.is.null,subscription_end_at.gte.${nowIso})),and(subscription_tier.eq.free_trial,trial_started_at.gte.${trialLimitDate},or(cancel_at_period_end.is.false,cancel_at_period_end.is.null))`,
        );

      if (filters.specialty) query = query.eq("specialty", filters.specialty);
      if (filters.state) query = query.eq("state", filters.state);
      if (filters.city) query = query.ilike("city", `%${filters.city}%`);
      if (filters.search) query = query.or(`full_name.ilike.%${filters.search}%,experience.ilike.%${filters.search}%`);

      const { data, error } = await query;
      
      if (error) {
        console.error("[Buscar] Erro na consulta:", error);
        setAllProfessionals([]);
      } else if (data) {
        let filteredProfessionals = [...data];
        const normalizedNeighborhoodFilter = normalizeSearchText(filters.neighborhood);

        if (normalizedNeighborhoodFilter) {
          filteredProfessionals = filteredProfessionals.filter((professional: any) => {
            const normalizedNeighborhood = normalizeSearchText(professional.neighborhood);
            if (!normalizedNeighborhood) return false;

            if (normalizedNeighborhood.includes(normalizedNeighborhoodFilter)) return true;

            const filterTokens = normalizedNeighborhoodFilter.split(" ").filter(Boolean);
            return filterTokens.every((token) => normalizedNeighborhood.includes(token));
          });
        }

        const hasProfileDrivenFilters = Boolean(
          filters.availability || filters.patient_profile || filters.max_hourly_rate
        );

        if (hasProfileDrivenFilters) {
          const professionalIds = filteredProfessionals.map((professional) => professional.id);
          const needsProfileEnrichment = filteredProfessionals.some((professional: any) =>
            typeof professional.availability === "undefined" ||
            typeof professional.patient_profiles === "undefined" ||
            typeof professional.hourly_rate === "undefined"
          );

          if (needsProfileEnrichment && professionalIds.length > 0) {
            const { data: profileDetails, error: profileDetailsError } = await supabase
              .from("profiles")
              .select("id, availability, patient_profiles, hourly_rate")
              .in("id", professionalIds);

            if (profileDetailsError) {
              console.warn("[Buscar] Não foi possível enriquecer filtros por disponibilidade/perfil/valor:", profileDetailsError);
            } else if (profileDetails) {
              const profileDetailsMap = new Map(profileDetails.map((row: any) => [row.id, row]));
              filteredProfessionals = filteredProfessionals.map((professional: any) => ({
                ...professional,
                availability: professional.availability ?? profileDetailsMap.get(professional.id)?.availability ?? [],
                patient_profiles: professional.patient_profiles ?? profileDetailsMap.get(professional.id)?.patient_profiles ?? [],
                hourly_rate: professional.hourly_rate ?? profileDetailsMap.get(professional.id)?.hourly_rate ?? null,
              }));
            }
          }

          const maxHourlyRate = filters.max_hourly_rate ? Number(filters.max_hourly_rate) : null;
          filteredProfessionals = filteredProfessionals.filter((professional: any) => {
            const availability = Array.isArray(professional.availability) ? professional.availability : [];
            const patientProfiles = Array.isArray(professional.patient_profiles) ? professional.patient_profiles : [];
            const hourlyRate = Number(professional.hourly_rate);

            const matchesAvailability = !filters.availability || availability.includes(filters.availability);
            const matchesPatientProfile = !filters.patient_profile || patientProfiles.includes(filters.patient_profile);
            const matchesHourlyRate = !maxHourlyRate || (Number.isFinite(hourlyRate) && hourlyRate <= maxHourlyRate);

            return matchesAvailability && matchesPatientProfile && matchesHourlyRate;
          });
        }

        const professionalIds = filteredProfessionals.map((professional) => professional.id);
        const completedCoursesMap: Record<string, number> = {};

        if (professionalIds.length > 0) {
          const { data: certificatesData, error: certificatesError } = await supabase
            .from("certificates")
            .select("user_id")
            .in("user_id", professionalIds);

          if (certificatesError) {
            console.warn("[Buscar] Erro ao carregar contagem de cursos concluídos:", certificatesError);
          } else {
            certificatesData?.forEach((certificate) => {
              completedCoursesMap[certificate.user_id] = (completedCoursesMap[certificate.user_id] || 0) + 1;
            });
          }
        }

        const processed = filteredProfessionals.map(p => {
          const dist = (userProfile.lat && userProfile.lng && p.lat && p.lng)
            ? calculateDistance(Number(userProfile.lat), Number(userProfile.lng), Number(p.lat), Number(p.lng))
            : 9999;
          
          const isPremium = p.subscription_tier === 'yearly';
          const referrals = p.referral_count || 0;
          
          const score = (isPremium ? 10000 : 0) + (referrals * 100) - (dist * 2);

          return {
            ...p,
            distance: dist,
            rankingScore: score,
            completed_courses_count: completedCoursesMap[p.id] || 0
          };
        });

        processed.sort((a, b) => b.rankingScore - a.rankingScore);
        setAllProfessionals(processed);
      }
      
      setLoading(false);
      setMapRefitTrigger(prev => prev + 1); // Trigger map refit after new data is loaded
    };

    fetchProfessionals();
  }, [userProfile, isLoadingConfig, config, filters, searchTrigger]);

  useEffect(() => {
    if (loading || !pendingMobileResultsScrollRef.current || !isMobileViewport()) return;
    pendingMobileResultsScrollRef.current = false;

    window.requestAnimationFrame(() => {
      if (!resultsSectionRef.current) return;
      const targetTop = resultsSectionRef.current.getBoundingClientRect().top + window.scrollY - 88;
      window.scrollTo({ top: Math.max(targetTop, 0), behavior: "smooth" });
    });
  }, [loading, allProfessionals.length]);

  const displayedProfessionals = useMemo(() => {
    if (!isMapExpanded || !mapBounds || typeof google === 'undefined') return allProfessionals;

    return allProfessionals.filter(p => {
      if (!p.lat || !p.lng) return false;
      try {
        const latLng = new google.maps.LatLng(Number(p.lat), Number(p.lng));
        return mapBounds.contains(latLng);
      } catch (e) {
        return true;
      }
    });
  }, [allProfessionals, mapBounds, isMapExpanded]);

  if (authLoading) {
    return (
      <Layout>
        <div className="flex h-[60vh] items-center justify-center">
          <div className="flex flex-col items-center gap-4">
            <Loader2 className="h-10 w-10 animate-spin text-primary" />
            <p className="text-sm text-muted-foreground">Carregando base de profissionais...</p>
          </div>
        </div>
      </Layout>
    );
  }

  if (!session) {
    return (
      <Layout>
        <AccessRestricted
          description="A busca de profissionais é exclusiva para Empresas de Home Care e Famílias em busca de atendimento."
          primaryAction={{ label: "Entrar", to: "/login" }}
          secondaryAction={{ label: "Assinar Agora", to: "/login#auth-sign-up" }}
        />
      </Layout>
    );
  }

  if (userProfile?.role === 'professional') {
    return <Navigate to="/dashboard" replace />;
  }

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
    "Período da Manhã", "Período da Tarde", "Período da Noite",
    "Dia Integral (Diurno)", "Plantão 12h (Noturno)", "Finais de Semana",
    "1h de atendimento", "2h de atendimento", "3h de atendimento",
  ];

  const patientProfileOptions = [
    "Idosos", "Pediátrico", "Pós-cirúrgico", "Doenças Crônicas",
    "Cuidados Paliativos", "Reabilitação Neurológica",
  ];
  const urgencyOptions = [
    { value: "urgente-24h", label: "Urgente (até 24h)" },
    { value: "esta-semana", label: "Ainda esta semana" },
    { value: "sem-urgencia", label: "Sem urgência" },
  ];

  const states = BRAZIL_STATES;

  const handleStateChange = (state: string) => {
    if (isMobileViewport()) {
      pendingMobileResultsScrollRef.current = true;
    }
    setFilters((prev) => ({
      ...prev,
      state,
      city: "",
      neighborhood: "",
    }));
  };

  const handleCityChange = (cityValue: string) => {
    const city = cityValue === "__all" ? "" : cityValue;
    if (isMobileViewport()) {
      pendingMobileResultsScrollRef.current = true;
    }
    setFilters((prev) => ({
      ...prev,
      city,
      neighborhood: "",
    }));
  };

  const openConciergeModal = () => {
    setConciergeForm({
      specialty: filters.specialty || "",
      city: filters.city || userProfile?.city || "",
      state: filters.state || userProfile?.state || "",
      neighborhood: filters.neighborhood || userProfile?.neighborhood || "",
      availability: filters.availability || "",
      patient_profile: filters.patient_profile || "",
      max_hourly_rate: filters.max_hourly_rate || "",
      urgency: "esta-semana",
      details: "",
    });
    setConciergeModalOpen(true);
  };

  const handleSubmitConciergeRequest = async () => {
    if (!user || !userProfile) {
      toast.error("Faça login para solicitar o concierge.");
      return;
    }

    if (!conciergeForm.details.trim()) {
      toast.error("Descreva a necessidade para nossa equipe de concierge.");
      return;
    }

    setIsSubmittingConcierge(true);
    try {
      const { data: conciergeRequest, error } = await supabase.from("concierge_requests").insert({
        user_id: user.id,
        requester_role: userProfile.role,
        requester_name: userProfile.full_name || null,
        requester_email: user.email || null,
        specialty: conciergeForm.specialty || null,
        city: conciergeForm.city || null,
        state: conciergeForm.state || null,
        neighborhood: conciergeForm.neighborhood || null,
        availability: conciergeForm.availability || null,
        patient_profile: conciergeForm.patient_profile || null,
        max_hourly_rate: conciergeForm.max_hourly_rate ? Number(conciergeForm.max_hourly_rate) : null,
        urgency: conciergeForm.urgency || "esta-semana",
        details: conciergeForm.details.trim(),
      }).select("id").single();

      if (error) throw error;

      if (conciergeRequest?.id) {
        const { error: notifyError } = await supabase.functions.invoke("notify-concierge", {
          body: { requestId: conciergeRequest.id },
        });

        if (notifyError) {
          console.error("[Buscar] Falha ao disparar notificação de concierge:", notifyError);
          toast.warning("Solicitação enviada, mas houve falha no envio de e-mail para o admin.");
        }
      }

      toast.success("Pedido enviado para a equipe de concierge.");
      setConciergeModalOpen(false);
    } catch (err: any) {
      console.error("[Buscar] Erro ao enviar solicitação de concierge:", err);
      toast.error(err?.message || "Não foi possível enviar sua solicitação agora.");
    } finally {
      setIsSubmittingConcierge(false);
    }
  };

  const hasLocation = userProfile?.lat && userProfile?.lng;

  return (
    <Layout>
      <div className="container mx-auto px-4 pb-4">
        <div className="mobile-fade-up mb-6 rounded-[2rem] border border-border/70 bg-gradient-to-br from-primary/10 via-card to-success/10 p-5 shadow-xl md:mb-8 md:p-6">
          <div className="mb-4 flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div>
              <h1 className="text-2xl font-bold text-foreground md:text-3xl">Buscar Profissionais</h1>
              <p className="mt-2 flex items-center gap-2 text-sm text-muted-foreground">
              {userProfile?.role === 'company' ? <Building2 className="h-4 w-4" /> : <Home className="h-4 w-4" />}
              {userProfile?.role === 'company' ? 'Painel de Recrutamento para Empresa' : 'Painel de Recrutamento para Família'}
              </p>
            </div>

            <Button 
              variant="outline" 
              size="sm" 
              className={cn(
                "h-10 w-full gap-2 border-border/70 bg-background/80 transition-all md:w-auto",
                isMapExpanded ? "bg-primary text-primary-foreground hover:bg-primary/90" : "hover:bg-secondary"
              )}
              onClick={() => setIsMapExpanded(!isMapExpanded)}
            >
              <MapIcon className="h-4 w-4" />
              {isMapExpanded ? "Recolher Mapa" : "Ver no Mapa"}
              {isMapExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
            </Button>
          </div>

          <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
            <div className="flex items-center gap-1 rounded-full border border-border/80 bg-background/80 px-2 py-1">
              <Star className="h-3 w-3 fill-current text-amber-500" />
              <span className="leading-none">Destaque Premium</span>
            </div>
            <div className="flex items-center gap-1 rounded-full border border-border/80 bg-background/80 px-2 py-1">
              <ShieldCheck className="h-3 w-3 text-success" />
              <span className="leading-none">Perfil Verificado</span>
            </div>
          </div>
        </div>

        {!hasLocation && !loading && (
          <div className="mb-6 bg-amber-50 border border-amber-200 rounded-2xl p-4 flex items-start gap-4 animate-fade-in">
            <div className="h-10 w-10 rounded-full bg-amber-100 flex items-center justify-center shrink-0">
              <MapPin className="h-5 w-5 text-amber-600" />
            </div>
            <div className="flex-1 space-y-1">
              <h4 className="font-bold text-amber-900 text-sm">Sua localização não foi detectada</h4>
              <p className="text-xs text-amber-800 leading-relaxed">
                Para visualizar a distância dos profissionais e ver os resultados mais próximos primeiro, você precisa salvar seu endereço completo em seu perfil.
              </p>
              <Button asChild variant="link" size="sm" className="p-0 h-auto text-amber-700 font-bold hover:text-amber-900">
                <Link to="/dashboard/perfil" className="gap-1">
                  Atualizar meu endereço agora <ArrowRight className="h-3 w-3" />
                </Link>
              </Button>
            </div>
          </div>
        )}

        <div className="mobile-fade-up mb-8 rounded-3xl border border-border/80 bg-card/95 p-4 shadow-xl md:p-6">
          <div className="flex flex-col gap-4 md:flex-row md:items-end">
            <div className="flex-1">
              <Label htmlFor="search" className="sr-only">Buscar</Label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  id="search"
                  placeholder="Nome ou experiência..."
                  className="pl-10"
                  value={filters.search}
                  onChange={(e) => setFilterValue("search", e.target.value)}
                />
              </div>
            </div>
            <Button variant="outline" onClick={() => setShowFilters(!showFilters)} className="h-11 w-full gap-2 sm:w-auto">
              <Filter className="h-4 w-4" /> Filtros {showFilters ? "(RECOLHER)" : "(EXPANDIR)"}
            </Button>
            <Button className="h-11 w-full gap-2 sm:w-auto" onClick={() => setSearchTrigger(prev => prev + 1)}>
              <Search className="h-4 w-4" /> Buscar
            </Button>
          </div>

          {showFilters && (
            <div className="mt-6 animate-fade-in border-t border-border pt-6">
              <div className="mobile-stagger grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                <div className="grid gap-2">
                  <Label>Especialidade</Label>
                  <Select
                    value={filters.specialty}
                    onValueChange={(v) => setFilterValue("specialty", v, { scrollToResultsOnMobile: true })}
                  >
                    <SelectTrigger><SelectValue placeholder="Todas" /></SelectTrigger>
                    <SelectContent>{specialties.map(s => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div className="grid gap-2">
                  <Label>Estado (UF)</Label>
                  <Select
                    value={filters.state}
                    onValueChange={handleStateChange}
                  >
                    <SelectTrigger><SelectValue placeholder="Todos" /></SelectTrigger>
                    <SelectContent>{states.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div className="grid gap-2">
                  <Label>Cidade</Label>
                  <Select
                    value={filters.city || "__all"}
                    onValueChange={handleCityChange}
                    disabled={!filters.state || loadingCities}
                  >
                    <SelectTrigger>
                      <SelectValue
                        placeholder={
                          !filters.state
                            ? "Selecione o estado primeiro"
                            : loadingCities
                              ? "Carregando cidades..."
                              : "Selecione a cidade"
                        }
                      />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__all">Todas as cidades</SelectItem>
                      {availableCities.map((city) => (
                        <SelectItem key={city} value={city}>
                          {city}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid gap-2">
                  <Label>Bairro</Label>
                  <Input
                    placeholder={!filters.city ? "Selecione a cidade primeiro" : "Digite o bairro"}
                    value={filters.neighborhood}
                    disabled={!filters.city}
                    onChange={(e) =>
                      setFilterValue("neighborhood", e.target.value, { scrollToResultsOnMobile: true })
                    }
                  />
                </div>
                <div className="grid gap-2">
                  <Label>Disponibilidade</Label>
                  <Select
                    value={filters.availability || "all"}
                    onValueChange={(v) => setFilterValue("availability", v === "all" ? "" : v, { scrollToResultsOnMobile: true })}
                  >
                    <SelectTrigger><SelectValue placeholder="Todos os períodos" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Todos os períodos</SelectItem>
                      {availabilityOptions.map(option => (
                        <SelectItem key={option} value={option}>{option}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid gap-2">
                  <Label>Público-alvo</Label>
                  <Select
                    value={filters.patient_profile || "all"}
                    onValueChange={(v) => setFilterValue("patient_profile", v === "all" ? "" : v, { scrollToResultsOnMobile: true })}
                  >
                    <SelectTrigger><SelectValue placeholder="Todos os públicos" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Todos os públicos</SelectItem>
                      {patientProfileOptions.map(option => (
                        <SelectItem key={option} value={option}>{option}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid gap-2">
                  <Label>Valor/Hora até (R$)</Label>
                  <Input
                    type="number"
                    min="1"
                    placeholder="Ex: 120"
                    value={filters.max_hourly_rate}
                    onChange={(e) => setFilterValue("max_hourly_rate", e.target.value)}
                  />
                </div>
              </div>
            </div>
          )}
        </div>

        {isMapExpanded && (
          <div className="mobile-fade-up mb-8 animate-slide-up">
            {!isLoadingConfig && config?.google_maps_api_key ? (
              <ProfessionalMap 
                userLocation={hasLocation ? { lat: Number(userProfile.lat), lng: Number(userProfile.lng) } : null}
                professionals={allProfessionals} // Pass allProfessionals to the map for initial fitting
                patientLocations={companyPatientLocations}
                onProfessionalClick={setSelectedProfessional}
                onBoundsChange={setMapBounds}
                refitTrigger={mapRefitTrigger} // Pass the new trigger
              />
            ) : (
              <div className="w-full h-[450px] bg-secondary/20 rounded-3xl flex flex-col items-center justify-center gap-3 border border-dashed">
                <MapPin className="h-8 w-8 text-muted-foreground/50" />
                <p className="text-sm text-muted-foreground">
                  {isLoadingConfig ? "Carregando configurações..." : "Mapa indisponível. Configure a chave de API no Painel Admin."}
                </p>
              </div>
            )}
          </div>
        )}

        <div
          ref={resultsSectionRef}
          id="resultados-profissionais"
          className="mobile-stagger grid gap-4 md:grid-cols-2 md:gap-6 lg:grid-cols-3 xl:grid-cols-4"
        >
          {loading ? (
            Array.from({ length: 8 }).map((_, i) => <Skeleton key={i} className="h-64 rounded-2xl" />)
          ) : displayedProfessionals.length > 0 ? (
            displayedProfessionals.map((p) => (
              <ProfessionalCard
                key={p.id}
                id={p.id}
                name={p.full_name}
                photo={p.avatar_url}
                specialty={specialties.find(s => s.value === p.specialty)?.label || p.specialty}
                registration={p.registration}
                location={`${p.neighborhood || ""}, ${p.city || ""} - ${p.state || ""}`}
                experience={p.experience}
                isVerified={p.is_verified}
                subscriptionTier={p.subscription_tier}
                distance={p.distance}
                completedCoursesCount={p.completed_courses_count}
              />
            ))
          ) : config?.enable_professional_list !== false ? (
            <div className="col-span-full py-12 text-center bg-secondary/10 rounded-2xl border border-dashed">
              <Users className="h-12 w-12 mx-auto mb-4 opacity-20" />
              <h3 className="text-lg font-semibold">Nenhum profissional nesta região</h3>
              <p className="text-muted-foreground">Tente mover o mapa ou ajustar seus filtros.</p>
            </div>
          ) : null}
        </div>

        {!loading && (
          <div className="mobile-fade-up mt-12 animate-fade-in rounded-3xl border border-primary/10 bg-primary/5 p-6 py-10 text-center md:mt-16 md:p-8 md:py-12">
            <div className="relative mx-auto mb-6 flex h-20 w-20 items-center justify-center rounded-full bg-primary/10">
              <Headset className="h-10 w-10 text-primary" />
              <Sparkles className="absolute -top-1 -right-1 h-6 w-6 text-yellow-500 fill-yellow-500" />
            </div>
            <h3 className="text-2xl font-bold text-foreground mb-3">Não encontrou quem procurava?</h3>
            <p className="max-w-2xl mx-auto text-lg text-muted-foreground mb-8">
              Nossa equipe de <strong>Concierge</strong> pode realizar uma busca personalizada e manual para você, 
              selecionando os melhores profissionais que ainda estão em processo de verificação.
            </p>
            <Button
              size="lg"
              className="h-12 w-full gap-2 px-6 text-base shadow-lg transition-transform hover:scale-[1.02] sm:h-14 sm:w-auto sm:px-8 sm:text-lg"
              onClick={openConciergeModal}
            >
              Solicitar Busca Personalizada
              <ArrowRight className="h-5 w-5" />
            </Button>
            <p className="mt-6 text-sm text-muted-foreground">
              Serviço gratuito para {userProfile?.role === 'company' ? 'empresas parceiras' : 'famílias cadastradas'}.
            </p>
          </div>
        )}
      </div>

      <ProfessionalMapModal 
        professional={selectedProfessional} 
        onClose={() => setSelectedProfessional(null)} 
        specialties={specialties}
      />

      <Dialog open={conciergeModalOpen} onOpenChange={setConciergeModalOpen}>
        <DialogContent className="sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>Solicitar Busca com Concierge</DialogTitle>
            <DialogDescription>
              Preencha os dados abaixo para nossa equipe realizar uma busca personalizada.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="grid gap-4 md:grid-cols-2">
              <div className="grid gap-2">
                <Label>Especialidade</Label>
                <Select value={conciergeForm.specialty || "all"} onValueChange={(v) => setConciergeForm(prev => ({ ...prev, specialty: v === "all" ? "" : v }))}>
                  <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Não especificar</SelectItem>
                    {specialties.map(s => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-2">
                <Label>Urgência</Label>
                <Select value={conciergeForm.urgency} onValueChange={(v) => setConciergeForm(prev => ({ ...prev, urgency: v }))}>
                  <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                  <SelectContent>
                    {urgencyOptions.map(option => <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid gap-4 md:grid-cols-3">
              <div className="grid gap-2 md:col-span-2">
                <Label>Cidade</Label>
                <Select
                  value={conciergeForm.city || "all"}
                  onValueChange={(v) => setConciergeForm(prev => ({ ...prev, city: v === "all" ? "" : v }))}
                  disabled={!conciergeForm.state || loadingConciergeCities}
                >
                  <SelectTrigger>
                    <SelectValue
                      placeholder={
                        !conciergeForm.state
                          ? "Selecione o estado primeiro"
                          : loadingConciergeCities
                            ? "Carregando cidades..."
                            : "Selecione a cidade"
                      }
                    />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Nao especificar</SelectItem>
                    {conciergeForm.city && !conciergeCities.includes(conciergeForm.city) && (
                      <SelectItem value={conciergeForm.city}>{conciergeForm.city}</SelectItem>
                    )}
                    {conciergeCities.map((city) => (
                      <SelectItem key={city} value={city}>{city}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-2">
                <Label>UF</Label>
                <Select value={conciergeForm.state || "all"} onValueChange={(v) => setConciergeForm(prev => ({ ...prev, state: v === "all" ? "" : v, city: "" }))}>
                  <SelectTrigger><SelectValue placeholder="UF" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Não especificar</SelectItem>
                    {states.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid gap-4 md:grid-cols-3">
              <div className="grid gap-2">
                <Label>Bairro</Label>
                <Input value={conciergeForm.neighborhood} onChange={(e) => setConciergeForm(prev => ({ ...prev, neighborhood: e.target.value }))} placeholder="Opcional" />
              </div>
              <div className="grid gap-2">
                <Label>Disponibilidade</Label>
                <Select value={conciergeForm.availability || "all"} onValueChange={(v) => setConciergeForm(prev => ({ ...prev, availability: v === "all" ? "" : v }))}>
                  <SelectTrigger><SelectValue placeholder="Não especificar" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Não especificar</SelectItem>
                    {availabilityOptions.map(option => (
                      <SelectItem key={option} value={option}>{option}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-2">
                <Label>Público-alvo</Label>
                <Select value={conciergeForm.patient_profile || "all"} onValueChange={(v) => setConciergeForm(prev => ({ ...prev, patient_profile: v === "all" ? "" : v }))}>
                  <SelectTrigger><SelectValue placeholder="Não especificar" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Não especificar</SelectItem>
                    {patientProfileOptions.map(option => (
                      <SelectItem key={option} value={option}>{option}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid gap-2">
              <Label>Valor/Hora máximo (R$)</Label>
              <Input
                type="number"
                min="1"
                placeholder="Ex: 120"
                value={conciergeForm.max_hourly_rate}
                onChange={(e) => setConciergeForm(prev => ({ ...prev, max_hourly_rate: e.target.value }))}
              />
            </div>

            <div className="grid gap-2">
              <Label>Descreva a necessidade *</Label>
              <Textarea
                rows={5}
                placeholder="Ex: Preciso de profissional para início imediato, 5 dias por semana, atendimento domiciliar..."
                value={conciergeForm.details}
                onChange={(e) => setConciergeForm(prev => ({ ...prev, details: e.target.value }))}
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setConciergeModalOpen(false)} disabled={isSubmittingConcierge}>
              Cancelar
            </Button>
            <Button onClick={handleSubmitConciergeRequest} disabled={isSubmittingConcierge}>
              {isSubmittingConcierge ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : null}
              Enviar para Concierge
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Layout>
  );
};

export default Buscar;
