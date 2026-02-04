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
import { Search, Filter, X, Users, ShieldAlert, Building2, Home } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Skeleton } from "@/components/ui/skeleton";
import { useAuth } from "@/components/auth/AuthProvider";
import { Link } from "react-router-dom";

const Buscar = () => {
  const { user } = useAuth();
  const [userRole, setUserRole] = useState<string | null>(null);
  const [professionals, setProfessionals] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState({
    specialty: "",
    city: "",
    neighborhood: "",
    state: "",
    search: "",
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
    // Only select safe public fields - never use .select("*") for security
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
    setFilters({ specialty: "", city: "", neighborhood: "", state: "", search: "" });
    fetchProfessionals();
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

  const states = ["AC", "AL", "AP", "AM", "BA", "CE", "DF", "ES", "GO", "MA", "MT", "MS", "MG", "PA", "PB", "PR", "PE", "PI", "RJ", "RN", "RS", "RO", "RR", "SC", "SP", "SE", "TO"];
  const hasActiveFilters = filters.specialty || filters.city || filters.neighborhood || filters.search || filters.state;

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
                <div className="grid gap-4 md:grid-cols-4">
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
                </div>
              </div>
            )}
          </div>

          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {loading ? (
              Array.from({ length: 8 }).map((_, i) => <Skeleton key={i} className="h-64 rounded-2xl" />)
            ) : professionals.length > 0 ? (
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
            ) : (
              <div className="col-span-full py-20 text-center">
                <Users className="mx-auto mb-4 h-12 w-12 text-muted-foreground" />
                <h3 className="text-lg font-semibold">Nenhum profissional encontrado</h3>
                <Button variant="link" onClick={clearFilters}>Limpar Filtros</Button>
              </div>
            )}
          </div>
        </div>
      </div>
    </Layout>
  );
};

export default Buscar;