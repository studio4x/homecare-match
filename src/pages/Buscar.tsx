"use client";

import { useState, useEffect } from "react";
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
import { Search, Filter, ShieldAlert, Building2, Home, DollarSign, Sparkles, Headset, ArrowRight, Users, Star, ShieldCheck, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Skeleton } from "@/components/ui/skeleton";
import { useAuth } from "@/components/auth/AuthProvider";
import { Link } from "react-router-dom";
import { useSiteConfig } from "@/hooks/use-site-config";
import AccessRestricted from "@/components/AccessRestricted";
import { subDays } from "date-fns";
import { calculateDistance } from "@/lib/geo-utils";

const getInitialSpecialtyFromUrl = () => {
  const value = new URLSearchParams(window.location.search).get("specialty");
  return value || "";
};

const Buscar = () => {
  const { user, session, loading: authLoading } = useAuth();
  const { data: config, isLoading: isLoadingConfig } = useSiteConfig();
  const [userProfile, setUserProfile] = useState<any>(null);
  const [professionals, setProfessionals] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
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
        // Usamos select("*") para evitar erro 400 se lat/lng ainda não existirem
        const { data, error } = await supabase
          .from("profiles")
          .select("*")
          .eq("id", user.id)
          .maybeSingle();
        
        if (!error && data) {
          setUserProfile(data);
        } else {
          // Fallback mínimo para não travar a página
          setUserProfile({ role: 'guest' });
        }
      }
    };
    fetchMyProfile();
  }, [user]);

  useEffect(() => {
    const fetchProfessionals = async () => {
      if (!userProfile || userProfile.role === 'professional' || isLoadingConfig) return;
      
      setLoading(true);

      if (config && config.enable_professional_list === false) {
        setProfessionals([]);
        setLoading(false);
        return;
      }

      const trialLimitDate = subDays(new Date(), 30).toISOString();

      // Buscamos todos os campos (*) para evitar erro de coluna inexistente
      let query = supabase
        .from("profiles")
        .select("*")
        .eq("role", "professional")
        .not("full_name", "is", null)
        .or(`subscription_tier.in.(monthly,yearly),and(subscription_tier.eq.free_trial,trial_started_at.gte.${trialLimitDate})`);

      if (filters.specialty) query = query.eq("specialty", filters.specialty);
      if (filters.state) query = query.eq("state", filters.state);
      if (filters.city) query = query.ilike("city", `%${filters.city}%`);
      if (filters.neighborhood) query = query.ilike("neighborhood", `%${filters.neighborhood}%`);
      if (filters.search) query = query.or(`full_name.ilike.%${filters.search}%,experience.ilike.%${filters.search}%`);
      if (filters.availability) query = query.contains('availability', [filters.availability]);
      if (filters.patient_profile) query = query.contains('patient_profiles', [filters.patient_profile]);
      
      if (userProfile.role === 'family' && filters.max_hourly_rate) {
        query = query.lte('hourly_rate', parseFloat(filters.max_hourly_rate));
      }

      const { data, error } = await query;
      
      if (error) {
        console.error("[Buscar] Erro na consulta:", error);
        setProfessionals([]);
      } else if (data) {
        // Lógica de Cálculo de Distância e Ranking
        const processed = data.map(p => {
          const dist = (userProfile.lat && userProfile.lng && p.lat && p.lng)
            ? calculateDistance(userProfile.lat, userProfile.lng, p.lat, p.lng)
            : 9999;
          
          const isPremium = p.subscription_tier === 'yearly';
          const referrals = p.referral_count || 0;
          
          // Score de Ranking
          const score = (isPremium ? 10000 : 0) + (referrals * 100) - (dist * 2);

          return { ...p, distance: dist, rankingScore: score };
        });

        // Ordena pelo Score (Maior primeiro)
        processed.sort((a, b) => b.rankingScore - a.rankingScore);
        setProfessionals(processed);
      }
      
      setLoading(false);
    };

    fetchProfessionals();
  }, [userProfile, isLoadingConfig, config, filters]);

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

          <div className="flex items-center gap-3 text-xs text-muted-foreground">
            <div className="flex items-center gap-1 rounded-full border px-2 py-1 bg-card">
              <Star className="h-3 w-3 text-amber-500 fill-current" />
              <span className="leading-none">Destaque Premium</span>
            </div>
            <div className="flex items-center gap-1 rounded-full border px-2 py-1 bg-card">
              <ShieldCheck className="h-3 w-3 text-success" />
              <span className="leading-none">Perfil Verificado</span>
            </div>
          </div>
        </div>

        {/* Filtros */}
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
            <Button className="gap-2" onClick={() => setLoading(true)}>
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
                  <Select value={filters.availability} onValueChange={(v) => setFilters({...filters, availability: v})}>
                    <SelectTrigger><SelectValue placeholder="Qualquer" /></SelectTrigger>
                    <SelectContent>{availabilityOptions.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div className="grid gap-2">
                  <Label>Perfil do Paciente</Label>
                  <Select value={filters.patient_profile} onValueChange={(v) => setFilters({...filters, patient_profile: v})}>
                    <SelectTrigger><SelectValue placeholder="Qualquer" /></SelectTrigger>
                    <SelectContent>{patientProfileOptions.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                {userProfile?.role === 'family' && (
                  <div className="grid gap-2 lg:col-span-2">
                    <Label>Valor Máximo por Hora (R$)</Label>
                    <div className="relative">
                      <DollarSign className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                      <Input
                        type="number"
                        placeholder="Ex: 100.00"
                        className="pl-10"
                        value={filters.max_hourly_rate}
                        onChange={(e) => setFilters({...filters, max_hourly_rate: e.target.value})}
                      />
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Resultados */}
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {loading ? (
            Array.from({ length: 8 }).map((_, i) => <Skeleton key={i} className="h-64 rounded-2xl" />)
          ) : professionals.length > 0 ? (
            professionals.map((p) => (
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
              />
            ))
          ) : (
            <div className="col-span-full py-12 text-center bg-secondary/10 rounded-2xl border border-dashed">
              <Users className="h-12 w-12 mx-auto mb-4 opacity-20" />
              <h3 className="text-lg font-semibold">Nenhum profissional encontrado</h3>
              <p className="text-muted-foreground">Tente ajustar seus filtros ou use o serviço de Concierge abaixo.</p>
            </div>
          )}
        </div>

        {/* Bloco de Concierge */}
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
    </Layout>
  );
};

export default Buscar;