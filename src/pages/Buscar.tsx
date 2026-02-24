"use client";

import { useState, useEffect, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import Layout from "@/components/layout/Layout";
import ProfessionalCard from "@/components/ProfessionalCard";
import ProfessionalMap from "@/components/ProfessionalMap";
import ProfessionalMapModal from "@/components/ProfessionalMapModal";
import { Search, Filter, ShieldAlert, Building2, Home, DollarSign, Sparkles, Headset, ArrowRight, Users, Star, ShieldCheck, Loader2, MapPin, AlertCircle, Map as MapIcon, LayoutGrid, ChevronDown, ChevronUp } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Skeleton } from "@/components/ui/skeleton";
import { useAuth } from "@/components/auth/AuthProvider";
import { Link } from "react-router-dom";
import { useSiteConfig } from "@/hooks/use-site-config";
import AccessRestricted from "@/components/AccessRestricted";
import { subDays } from "date-fns";
import { calculateDistance } from "@/lib/geo-utils";
import { cn } from "@/lib/utils";

const getInitialSpecialtyFromUrl = () => {
  const value = new URLSearchParams(window.location.search).get("specialty");
  return value || "";
};

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

      const trialLimitDate = subDays(new Date(), 30).toISOString();

      // ALTERAÇÃO DE SEGURANÇA: consultamos a VIEW 'professional_discovery',
      // que não contém campos sensíveis como telefone ou endereço exato.
      let query = supabase
        .from("professional_discovery")
        .select("*")
        .or(`subscription_tier.in.(monthly,yearly),and(subscription_tier.eq.free_trial,trial_started_at.gte.${trialLimitDate})`);

      if (filters.specialty) query = query.eq("specialty", filters.specialty);
      if (filters.state) query = query.eq("state", filters.state);
      if (filters.city) query = query.ilike("city", `%${filters.city}%`);
      if (filters.neighborhood) query = query.ilike("neighborhood", `%${filters.neighborhood}%`);
      if (filters.search) query = query.or(`full_name.ilike.%${filters.search}%,experience.ilike.%${filters.search}%`);

      const { data, error } = await query;
      
      if (error) {
        console.error("[Buscar] Erro na consulta:", error);
        setAllProfessionals([]);
      } else if (data) {
        let filteredProfessionals = [...data];
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
    return (
      <Layout>
        <div className="container mx-auto px-4 py-20 text-center">
          <div className="mx-auto mb-6 flex h-20 w-20 items-center justify-center rounded-full bg-primary/10">
            <ShieldAlert className="h-10 w-10 text-primary" />
          </div>
          <h2 className="text-2xl font-bold">Acesso Restrito</h2>
          <p className="mx-auto mt-4 max-w-md text-muted-foreground">
            A busca de profissionais é uma ferramenta exclusiva para <strong>Empresas de Home Care</strong> e <strong>Famílias</strong> em busca de atendimento.
          </p>
          <div className="mt-8 flex justify-center gap-4">
            <Button asChild variant="outline">
              <Link to="/dashboard">Ir para Meu Painel</Link>
            </Button>
          </div>
        </div>
      </Layout>
    );
  }

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
    "1h de atendimento", "2h de atendimento", "3h de atendimento",
  ];

  const patientProfileOptions = [
    "Idosos", "Pediátrico", "Pós-cirúrgico", "Doenças Crônicas",
    "Cuidados Paliativos", "Reabilitação Neurológica",
  ];

  const states = ["AC", "AL", "AP", "AM", "BA", "CE", "DF", "ES", "GO", "MA", "MT", "MS", "MG", "PA", "PB", "PR", "PE", "PI", "RJ", "RN", "RS", "RO", "RR", "SC", "SP", "SE", "TO"];
  
  const whatsappNumber = config?.whatsapp_number?.replace(/\D/g, '') || "5511999999999";
  const roleLabel = userProfile?.role === 'company' ? 'Empresa' : 'Família';
  const requestedSpecialtyLabel = filters.specialty ? (specialties.find(s => s.value === filters.specialty)?.label || filters.specialty) : '';

  const conciergeMessage = [
    'Olá!', '',
    `Sou uma *${roleLabel}* e gostaria de ajuda da equipe de concierge do HomeCare Match para encontrar profissionais.`,
    '',
    filters.specialty ? `• Especialidade: ${requestedSpecialtyLabel}` : '',
    filters.city ? `• Cidade: ${filters.city}` : '',
    filters.state ? `• Estado: ${filters.state}` : '',
  ].filter(Boolean).join('\n');

  const hasLocation = userProfile?.lat && userProfile?.lng;

  return (
    <Layout>
      <div className="container mx-auto px-4">
        <div className="mb-8 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold text-foreground">Buscar Profissionais</h1>
            <p className="mt-2 text-muted-foreground flex items-center gap-2">
              {userProfile?.role === 'company' ? <Building2 className="h-4 w-4" /> : <Home className="h-4 w-4" />}
              {userProfile?.role === 'company' ? 'Painel de Recrutamento para Empresa' : 'Painel de Recrutamento para Família'}
            </p>
          </div>

          <div className="flex items-center gap-3">
            <div className="hidden sm:flex items-center gap-3 text-xs text-muted-foreground mr-4">
              <div className="flex items-center gap-1 rounded-full border px-2 py-1 bg-card">
                <Star className="h-3 w-3 text-amber-500 fill-current" />
                <span className="leading-none">Destaque Premium</span>
              </div>
              <div className="flex items-center gap-1 rounded-full border px-2 py-1 bg-card">
                <ShieldCheck className="h-3 w-3 text-success" />
                <span className="leading-none">Perfil Verificado</span>
              </div>
            </div>
            <Button 
              variant="outline" 
              size="sm" 
              className={cn(
                "h-9 gap-2 transition-all",
                isMapExpanded ? "bg-primary text-primary-foreground hover:bg-primary/90" : "hover:bg-secondary"
              )}
              onClick={() => setIsMapExpanded(!isMapExpanded)}
            >
              <MapIcon className="h-4 w-4" />
              {isMapExpanded ? "Recolher Mapa" : "Ver no Mapa"}
              {isMapExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
            </Button>
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

        <div className="mb-8 rounded-2xl border border-border bg-card p-6 shadow-card">
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
                  onChange={(e) => setFilters({...filters, search: e.target.value})}
                />
              </div>
            </div>
            <Button variant="outline" onClick={() => setShowFilters(!showFilters)} className="gap-2">
              <Filter className="h-4 w-4" /> Filtros
            </Button>
            <Button className="gap-2" onClick={() => setSearchTrigger(prev => prev + 1)}>
              <Search className="h-4 w-4" /> Buscar
            </Button>
          </div>

          {showFilters && (
            <div className="mt-6 animate-fade-in border-t border-border pt-6">
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                <div className="grid gap-2">
                  <Label>Especialidade</Label>
                  <Select value={filters.specialty} onValueChange={(v) => setFilters({...filters, specialty: v})}>
                    <SelectTrigger><SelectValue placeholder="Todas" /></SelectTrigger>
                    <SelectContent>{specialties.map(s => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div className="grid gap-2">
                  <Label>Estado (UF)</Label>
                  <Select value={filters.state} onValueChange={(v) => setFilters({...filters, state: v})}>
                    <SelectTrigger><SelectValue placeholder="Todos" /></SelectTrigger>
                    <SelectContent>{states.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div className="grid gap-2">
                  <Label>Cidade</Label>
                  <Input placeholder="Ex: São Paulo" value={filters.city} onChange={(e) => setFilters({...filters, city: e.target.value})} />
                </div>
                <div className="grid gap-2">
                  <Label>Bairro</Label>
                  <Input placeholder="Digite o bairro..." value={filters.neighborhood} onChange={(e) => setFilters({...filters, neighborhood: e.target.value})} />
                </div>
                <div className="grid gap-2">
                  <Label>Disponibilidade</Label>
                  <Select value={filters.availability || "all"} onValueChange={(v) => setFilters({...filters, availability: v === "all" ? "" : v})}>
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
                  <Select value={filters.patient_profile || "all"} onValueChange={(v) => setFilters({...filters, patient_profile: v === "all" ? "" : v})}>
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
                    onChange={(e) => setFilters({...filters, max_hourly_rate: e.target.value})}
                  />
                </div>
              </div>
            </div>
          )}
        </div>

        {isMapExpanded && (
          <div className="mb-8 animate-slide-up">
            {!isLoadingConfig && config?.google_maps_api_key ? (
              <ProfessionalMap 
                userLocation={hasLocation ? { lat: Number(userProfile.lat), lng: Number(userProfile.lng) } : null}
                professionals={allProfessionals} // Pass allProfessionals to the map for initial fitting
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

        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
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
          <div className="mt-16 py-12 text-center animate-fade-in bg-primary/5 border border-primary/10 rounded-3xl p-8">
            <div className="relative mx-auto mb-6 flex h-20 w-20 items-center justify-center rounded-full bg-primary/10">
              <Headset className="h-10 w-10 text-primary" />
              <Sparkles className="absolute -top-1 -right-1 h-6 w-6 text-yellow-500 fill-yellow-500" />
            </div>
            <h3 className="text-2xl font-bold text-foreground mb-3">Não encontrou quem procurava?</h3>
            <p className="max-w-2xl mx-auto text-lg text-muted-foreground mb-8">
              Nossa equipe de <strong>Concierge</strong> pode realizar uma busca personalizada e manual para você, 
              selecionando os melhores profissionais que ainda estão em processo de verificação.
            </p>
            <Button size="lg" className="gap-2 h-14 px-8 text-lg shadow-lg hover:scale-105 transition-transform" asChild>
              <a 
                href={`https://wa.me/${whatsappNumber}?text=${encodeURIComponent(conciergeMessage)}`} 
                target="_blank" 
                rel="noopener noreferrer"
              >
                Solicitar Busca Personalizada
                <ArrowRight className="h-5 w-5" />
              </a>
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
    </Layout>
  );
};

export default Buscar;
