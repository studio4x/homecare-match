import { useState } from "react";
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
import { Search, Filter, X, Users } from "lucide-react";

const Buscar = () => {
  const [filters, setFilters] = useState({
    specialty: "",
    city: "",
    neighborhood: "",
  });

  const [showFilters, setShowFilters] = useState(false);

  const specialties = [
    { value: "enfermeiro", label: "Enfermeiro(a)" },
    { value: "tecnico-enfermagem", label: "Técnico(a) de Enfermagem" },
    { value: "fisioterapeuta", label: "Fisioterapeuta" },
    { value: "terapeuta-ocupacional", label: "Terapeuta Ocupacional" },
    { value: "fonoaudiologo", label: "Fonoaudiólogo(a)" },
    { value: "nutricionista", label: "Nutricionista" },
    { value: "cuidador", label: "Cuidador(a) de Idosos" },
  ];

  const cities = [
    "São Paulo",
    "Rio de Janeiro",
    "Belo Horizonte",
    "Curitiba",
    "Porto Alegre",
    "Salvador",
    "Brasília",
    "Fortaleza",
  ];

  // Mock data for professionals
  const professionals = [
    {
      name: "Maria Silva",
      specialty: "Enfermeiro(a)",
      registration: "COREN-SP 123456",
      location: "Vila Mariana, São Paulo - SP",
      experience: "5 anos em Home Care",
    },
    {
      name: "João Santos",
      specialty: "Fisioterapeuta",
      registration: "CREFITO-3 654321",
      location: "Pinheiros, São Paulo - SP",
      experience: "8 anos de experiência",
    },
    {
      name: "Ana Costa",
      specialty: "Técnico(a) de Enfermagem",
      registration: "COREN-SP 789012",
      location: "Moema, São Paulo - SP",
      experience: "3 anos em Home Care",
    },
    {
      name: "Carlos Oliveira",
      specialty: "Cuidador(a) de Idosos",
      registration: "Certificado CBO",
      location: "Santana, São Paulo - SP",
      experience: "6 anos de experiência",
    },
    {
      name: "Fernanda Lima",
      specialty: "Fonoaudiólogo(a)",
      registration: "CRFa-2 345678",
      location: "Itaim Bibi, São Paulo - SP",
      experience: "4 anos em Home Care",
    },
    {
      name: "Roberto Almeida",
      specialty: "Nutricionista",
      registration: "CRN-3 901234",
      location: "Jardins, São Paulo - SP",
      experience: "7 anos de experiência",
    },
    {
      name: "Patrícia Mendes",
      specialty: "Terapeuta Ocupacional",
      registration: "CREFITO-3 567890",
      location: "Brooklin, São Paulo - SP",
      experience: "5 anos em Home Care",
    },
    {
      name: "Lucas Ferreira",
      specialty: "Enfermeiro(a)",
      registration: "COREN-RJ 234567",
      location: "Copacabana, Rio de Janeiro - RJ",
      experience: "10 anos de experiência",
    },
  ];

  const clearFilters = () => {
    setFilters({
      specialty: "",
      city: "",
      neighborhood: "",
    });
  };

  const hasActiveFilters = filters.specialty || filters.city || filters.neighborhood;

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
                    placeholder="Buscar por nome ou especialidade..."
                    className="pl-10"
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
              <Button className="gap-2">
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
                    <Select
                      value={filters.city}
                      onValueChange={(value) =>
                        setFilters({ ...filters, city: value })
                      }
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Todas as cidades" />
                      </SelectTrigger>
                      <SelectContent>
                        {cities.map((city) => (
                          <SelectItem key={city} value={city}>
                            {city}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
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
              <strong className="text-foreground">{professionals.length}</strong>{" "}
              profissionais encontrados
            </span>
          </div>

          {/* Results Grid */}
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {professionals.map((professional, index) => (
              <ProfessionalCard
                key={index}
                name={professional.name}
                specialty={professional.specialty}
                registration={professional.registration}
                location={professional.location}
                experience={professional.experience}
              />
            ))}
          </div>

          {/* Load More */}
          <div className="mt-12 text-center">
            <Button variant="outline" size="lg">
              Carregar Mais Profissionais
            </Button>
          </div>
        </div>
      </div>
    </Layout>
  );
};

export default Buscar;
