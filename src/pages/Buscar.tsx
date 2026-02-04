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
import { Search, Filter, ShieldAlert, Building2, Home, DollarSign, Sparkles, Headset, ArrowRight, X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Skeleton } from "@/components/ui/skeleton";
import { useAuth } from "@/components/auth/AuthProvider";
import { Link } from "react-router-dom";
import { useSiteConfig } from "@/hooks/use-site-config";

// Configuração do limite mínimo para exibir a lista
const MIN_RESULTS_TO_SHOW = 10;

const Buscar = () => {
  const { user } = useAuth();
  const { data: config } = useSiteConfig();
  const [userRole, setUserRole] = useState<string | null>(null);
  const [professionals, setProfessionals] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState({
    specialty: "",
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
    const checkRole = async () => {
      if (user) {
        const { data } = await supabase
          .from("profiles")
          .select("role")
          .eq("id", user.id)
          .single();
        setUserRole(data?.role || 'professional');
      } else {
        setUserRole('guest');
      }
    };
    
    checkRole();
  }, [user]);

  useEffect(() => {
    if (userRole && userRole !== 'professional') {
      fetchProfessionals();
    }
  }, [userRole]);

  const fetchProfessionals = async () => {
    setLoading(true);
    const safePublicFields = "id, full_name, avatar_url, specialty, registration, city, state, neighborhood, experience, bio, subscription_tier, is_verified, role, updated_at";
    
    let query = supabase
      .from("profiles")
      .select(safePublicFields)
      .eq("role", "professional")
      .not("full_name", "is", null)
      .order('subscription_tier', { ascending: false })
      .order('updated_at', { ascending: false });

    if (filters.specialty) query = query.eq("specialty", filters.specialty);
    if (filters.state) query = query.eq("state", filters.state);
    if (filters.city) query = query.ilike("city", `%${filters.city}%`);
    if (filters.neighborhood) query = query.ilike("neighborhood", `%${filters.neighborhood}%`);
    if (filters.search) query = query.or(`full_name.ilike.%${filters.search}%,experience.ilike.%${filters.search}%`);
    if (filters.availability) query = query.contains('availability', [filters.availability]);
    if (filters.patient_profile) query = query.contains('patient_profiles', [filters.patient_profile]);
    if (userRole === 'family' && filters.max_hourly_rate) {
      query = query.lte('hourly_rate', parseFloat(filters.max_hourly_rate));
    }

    const { data } = await query;
    setProfessionals(data || []);
    setLoading(false);
  };

  if (userRole === 'professional') {
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

  const clearFilters = () => {
    setFilters({ specialty: "", city: "", neighborhood: "", state: "", search: "", availability: "", patient_profile: "", max_hourly_rate: "" });
    setTimeout(fetchProfessionals, 0); 
  };

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

  const states = ["AC", "AL", "AP", "AM", "BA", "CE", "DF", "ES", "GO", "MA", "MT", "MS", "MG", "PA", "PB", "PR", "PE", "PI", "RJ", "RN", "RS", "RO", "RR", "SC", "SP", "SE", "TO"];
  
  // Lógica do Concierge
  const showConcierge = !loading && professionals.length < MIN_RESULTS_TO_SHOW;

  // Número do WhatsApp dinâmico
  const whatsappNumber = config?.whatsapp_number?.replace(/\D/g, '') || "5511999999999";
  const conciergeMessage = `Olá, sou ${userRole === 'company' ? 'uma empresa' : 'uma família'} buscando profissionais no HomeCareMatch e gostaria de ajuda da equipe de concierge.`;

  return (
    <Layout>
      <div className="min-h-screen bg-secondary/20 py-8">
        <div className="container mx-auto px-4">
          <div className="mb-8 flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <h1 className="text-3xl font-bold text-foreground">Buscar Profissionais</h1>
              <p className="mt-2 text-muted-foreground flex items-center gap-2">
                {userRole === 'company' ? <Building2 className="h-4 w-4" /> : <Home className="h-4 w-4" />}
                Painel de Recrutamento para {userRole === 'company' ? 'Empresa' : 'Família'}
              </p>
            </div>
          </div>

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
              <Button className="gap-2" onClick={fetchProfessionals}>
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
                  {userRole === 'family' && (
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

          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {loading ? (
              Array.from({ length: 8 }).map((_, i) => <Skeleton key={i} className="h-64 rounded-2xl" />)
            ) : showConcierge ? (
              // Componente Concierge (Ativado quando há poucos resultados)
              <div className="col-span-full py-16 text-center animate-fade-in bg-card border border-border rounded-2xl shadow-card p-8">
                <div className="mx-auto mb-6 flex h-20 w-20 items-center justify-center rounded-full bg-primary/10 animate-pulse">
                  <Headset className="h-10 w-10 text-primary" />
                  <div className="absolute -top-1 -right-1">
                    <Sparkles className="h-6 w-6 text-yellow-500 fill-yellow-500" />
                  </div>
                </div>
                
                <h3 className="text-2xl font-bold text-foreground mb-3">Busca Personalizada (Concierge)</h3>
                
                <p className="max-w-xl mx-auto text-lg text-muted-foreground mb-8">
                  Para garantir a melhor experiência, nossa equipe realiza uma seleção manual dos melhores profissionais para o seu perfil. 
                  <br/><br/>
                  Temos profissionais disponíveis que correspondem aos seus critérios, mas que estão passando por nossa verificação de qualidade rigorosa neste momento.
                </p>

                <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
                  <Button size="lg" className="gap-2 h-14 px-8 text-lg shadow-lg hover:scale-105 transition-transform" asChild>
                    <a 
                      href={`https://wa.me/${whatsappNumber}?text=${encodeURIComponent(conciergeMessage)}`} 
                      target="_blank" 
                      rel="noopener noreferrer"
                    >
                      Solicitar Profissionais Agora
                      <ArrowRight className="h-5 w-5" />
                    </a>
                  </Button>
                </div>
                
                <p className="mt-6 text-sm text-muted-foreground">
                  Serviço gratuito para {userRole === 'company' ? 'empresas parceiras' : 'famílias cadastradas'}.
                </p>
              </div>
            ) : (
              // Lista normal de profissionais (Só aparece se tiver >= MIN_RESULTS_TO_SHOW)
              professionals.map((professional) => (
                <ProfessionalCard
                  key={professional.id}
                  id={professional.id}
                  name={professional.full_name}
                  photo={professional.avatar_url}
                  specialty={specialties.find(s => s.value === professional.specialty)?.label || professional.specialty}
                  registration={professional.registration}
                  location={`${professional.neighborhood || ""}, ${professional.city || ""} - ${professional.state || ""}`}
                  experience={professional.experience}
                  isVerified={professional.is_verified}
                  subscriptionTier={professional.subscription_tier}
                />
              ))
            )}
          </div>
        </div>
      </div>
    </Layout>
  );
};

export default Buscar;