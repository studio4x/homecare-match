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
import { Search, Filter, X, Users, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

const Buscar = () => {
  const [professionals, setProfessionals] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState({
    specialty: "",
    city: "",
    neighborhood: "",
    search: "",
  });

  const [showFilters, setShowFilters] = useState(false);

  useEffect(() => {
    fetchProfessionals();
  }, []);

  const fetchProfessionals = async () => {
    setLoading(true);
    let query = supabase
      .from("profiles")
      .select("*")
      .not("full_name", "is", null);

    if (filters.specialty) {
      query = query.eq("specialty", filters.specialty);
    }
    if (filters.city) {
      query = query.ilike("city", `%${filters.city}%`);
    }
    if (filters.neighborhood) {
      query = query.ilike("neighborhood", `%${filters.neighborhood}%`);
    }
    if (filters.search) {
      query = query.or(`full_name.ilike.%${filters.search}%,experience.ilike.%${filters.search}%`);
    }

    const { data, error } = await query;

    if (error) {
      console.error("Erro ao buscar profissionais:", error);
    } else {
      setProfessionals(data || []);
    }
    setLoading(false);
  };

  const clearFilters = () => {
    setFilters({
      specialty: "",
      city: "",
      neighborhood: "",
      search: "",
    });
    fetchProfessionals();
  };

  const specialties = [
    { value: "enfermeiro", label: "Enfermeiro(a)" },
    { value: "tecnico-enfermagem", label: "Técnico(a) de Enfermagem" },
    { value: "fisioterapeuta", label: "Fisioterapeuta" },
    { value: "terapeuta-ocupacional", label: "Terapeuta Ocupacional" },
    { value: "fonoaudiologo", label: "Fonoaudiólogo(a)" },
    { value: "nutricionista", label: "Nutricionista" },
    { value: "cuidador", label: "Cuidador(a) de Idosos" },
  ];

  const hasActiveFilters = filters.specialty || filters.city || filters.neighborhood || filters.search;

  return (
    <Layout>
      <div className="min-h-screen bg-secondary/20 py-8">
        <div className="container mx-auto px-4">
          {/* Header */}
          <div className="mb-8">
            <h1 className="text-3xl font-bold text-foreground">
              Buscar Profissionais
            </h1>
            <p className="mt-2 text-muted-foreground">
              Encontre profissionais de saúde qualificados para sua equipe de
              Home Care.
            </p>
          </div>

          {/* Search and Filters */}
          <div className="mb-8 rounded-2xl border border-border bg-card p-6 shadow-card">
            {/* Quick Search */}
            <div className="flex flex-col gap-4 md:flex-row md:items-end">
              <div className="flex-1">
                <Label htmlFor="search" className="sr-only">
                  Buscar
                </Label>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    id="search"
                    placeholder="Buscar por nome ou experiência..."
                    className="pl-10"
                    value={filters.search}
                    onChange={(e) => setFilters({...filters, search: e.target.value})}
                  />
                </div>
              </div>
              <Button
                variant="outline"
                onClick={() => setShowFilters(!showFilters)}
                className="gap-2"
              >
                <Filter className="h-4 w-4" />
                Filtros
                {hasActiveFilters && (
                  <span className="flex h-5 w-5 items-center justify-center rounded-full bg-primary text-xs text-primary-foreground">
                    !
                  </span>
                )}
              </Button>
              <Button className="gap-2" onClick={fetchProfessionals}>
                <Search className="h-4 w-4" />
                Buscar
              </Button>
            </div>

            {/* Advanced Filters */}
            {showFilters && (
              <div className="mt-6 animate-fade-in border-t border-border pt-6">
                <div className="mb-4 flex items-center justify-between">
                  <h3 className="font-medium text-foreground">Filtros Avançados</h3>
                  {hasActiveFilters && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={clearFilters}
                      className="gap-1 text-muted-foreground"
                    >
                      <X className="h-3 w-3" />
                      Limpar filtros
                    </Button>
                  )}
                </div>
                <div className="grid gap-4 md:grid-cols-3">
                  <div className="grid gap-2">
                    <Label htmlFor="specialty">Área de Atuação</Label>
                    <Select
                      value={filters.specialty}
                      onValueChange={(value) =>
                        setFilters({ ...filters, specialty: value })
                      }
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Todas as áreas" />
                      </SelectTrigger>
                      <SelectContent>
                        {specialties.map((spec) => (
                          <SelectItem key={spec.value} value={spec.value}>
                            {spec.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="city">Cidade</Label>
                    <Input
                      id="city"
                      placeholder="Ex: São Paulo"
                      value={filters.city}
                      onChange={(e) =>
                        setFilters({ ...filters, city: e.target.value })
                      }
                    />
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="neighborhood">Bairro</Label>
                    <Input
                      id="neighborhood"
                      placeholder="Digite o bairro..."
                      value={filters.neighborhood}
                      onChange={(e) =>
                        setFilters({ ...filters, neighborhood: e.target.value })
                      }
                    />
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Results Count */}
          <div className="mb-6 flex items-center gap-2 text-muted-foreground">
            <Users className="h-4 w-4" />
            <span>
              {loading ? (
                "Buscando profissionais..."
              ) : (
                <>
                  <strong className="text-foreground">{professionals.length}</strong>{" "}
                  profissionais encontrados
                </>
              )}
            </span>
          </div>

          {/* Results Grid */}
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {loading ? (
              <div className="col-span-full flex h-64 flex-col items-center justify-center gap-4 text-muted-foreground">
                <Loader2 className="h-8 w-8 animate-spin" />
                <p>Carregando talentos...</p>
              </div>
            ) : professionals.length > 0 ? (
              professionals.map((professional) => (
                <ProfessionalCard
                  key={professional.id}
                  name={professional.full_name}
                  photo={professional.avatar_url}
                  specialty={specialties.find(s => s.value === professional.specialty)?.label || professional.specialty}
                  registration={professional.registration}
                  location={`${professional.neighborhood}, ${professional.city} - ${professional.state}`}
                  experience={professional.experience}
                />
              ))
            ) : (
              <div className="col-span-full flex h-64 flex-col items-center justify-center rounded-2xl border border-dashed border-border bg-card p-12 text-center">
                <Users className="mb-4 h-12 w-12 text-muted-foreground" />
                <h3 className="text-lg font-semibold">Nenhum profissional encontrado</h3>
                <p className="text-muted-foreground">Tente ajustar seus filtros para encontrar mais resultados.</p>
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