import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import Layout from "@/components/layout/Layout";
import {
  Camera,
  Save,
  CheckCircle,
  AlertCircle,
  Award,
  MapPin,
  Briefcase,
  Calendar,
} from "lucide-react";
import { toast } from "sonner";

const Dashboard = () => {
  const [profile, setProfile] = useState({
    name: "Maria Silva",
    photo: "",
    registration: "COREN-SP 123456",
    specialty: "enfermeiro",
    city: "São Paulo",
    state: "SP",
    neighborhood: "Vila Mariana",
    experience: "5 anos de experiência em UTI e Home Care. Especialização em cuidados paliativos e administração de medicamentos.",
    bio: "Profissional dedicada com foco em qualidade de vida do paciente. Experiência em cuidados domiciliares para idosos e pacientes com doenças crônicas.",
  });

  const [subscriptionActive] = useState(true);
  const [isEditing, setIsEditing] = useState(false);

  const handleSave = () => {
    setIsEditing(false);
    toast.success("Perfil atualizado com sucesso!");
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

  const states = [
    "AC", "AL", "AP", "AM", "BA", "CE", "DF", "ES", "GO", "MA",
    "MT", "MS", "MG", "PA", "PB", "PR", "PE", "PI", "RJ", "RN",
    "RS", "RO", "RR", "SC", "SP", "SE", "TO"
  ];

  const initials = profile.name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  return (
    <Layout>
      <div className="min-h-screen bg-secondary/20 py-8">
        <div className="container mx-auto px-4">
          <div className="mb-8">
            <h1 className="text-3xl font-bold text-foreground">Meu Perfil</h1>
            <p className="mt-2 text-muted-foreground">
              Gerencie suas informações profissionais e status da assinatura.
            </p>
          </div>

          <div className="grid gap-6 lg:grid-cols-3">
            {/* Sidebar - Status */}
            <div className="space-y-6 lg:col-span-1">
              {/* Subscription Status Card */}
              <div className="rounded-2xl border border-border bg-card p-6 shadow-card">
                <h3 className="mb-4 font-semibold text-foreground">
                  Status da Assinatura
                </h3>
                {subscriptionActive ? (
                  <div className="flex items-center gap-3 rounded-lg bg-success/10 p-4">
                    <CheckCircle className="h-6 w-6 text-success" />
                    <div>
                      <p className="font-medium text-success">Assinatura Ativa</p>
                      <p className="text-sm text-muted-foreground">
                        Plano Anual - Renova em 15/02/2025
                      </p>
                    </div>
                  </div>
                ) : (
                  <div className="flex items-center gap-3 rounded-lg bg-destructive/10 p-4">
                    <AlertCircle className="h-6 w-6 text-destructive" />
                    <div>
                      <p className="font-medium text-destructive">
                        Assinatura Inativa
                      </p>
                      <p className="text-sm text-muted-foreground">
                        Seu perfil não está visível para empresas
                      </p>
                    </div>
                  </div>
                )}
                <Button className="mt-4 w-full" variant="outline">
                  Gerenciar Assinatura
                </Button>
              </div>

              {/* Profile Preview Card */}
              <div className="rounded-2xl border border-border bg-card p-6 shadow-card">
                <h3 className="mb-4 font-semibold text-foreground">
                  Prévia do Perfil
                </h3>
                <div className="text-center">
                  <Avatar className="mx-auto h-20 w-20 ring-4 ring-border">
                    <AvatarImage src={profile.photo} alt={profile.name} />
                    <AvatarFallback className="bg-primary/10 text-xl font-semibold text-primary">
                      {initials}
                    </AvatarFallback>
                  </Avatar>
                  <h4 className="mt-4 font-semibold text-foreground">
                    {profile.name}
                  </h4>
                  <Badge variant="secondary" className="mt-2">
                    {specialties.find((s) => s.value === profile.specialty)?.label}
                  </Badge>
                </div>

                <div className="mt-6 space-y-3">
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Award className="h-4 w-4 text-primary" />
                    <span>{profile.registration}</span>
                  </div>
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <MapPin className="h-4 w-4 text-primary" />
                    <span>
                      {profile.neighborhood}, {profile.city} - {profile.state}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Calendar className="h-4 w-4 text-primary" />
                    <span>Perfil criado em Jan/2024</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Main Content - Edit Form */}
            <div className="lg:col-span-2">
              <div className="rounded-2xl border border-border bg-card p-6 shadow-card lg:p-8">
                <div className="mb-6 flex items-center justify-between">
                  <h3 className="text-xl font-semibold text-foreground">
                    Informações do Perfil
                  </h3>
                  {!isEditing ? (
                    <Button onClick={() => setIsEditing(true)}>
                      Editar Perfil
                    </Button>
                  ) : (
                    <div className="flex gap-2">
                      <Button variant="outline" onClick={() => setIsEditing(false)}>
                        Cancelar
                      </Button>
                      <Button onClick={handleSave} className="gap-2">
                        <Save className="h-4 w-4" />
                        Salvar
                      </Button>
                    </div>
                  )}
                </div>

                <div className="space-y-6">
                  {/* Photo Upload */}
                  <div className="flex items-center gap-6">
                    <Avatar className="h-24 w-24 ring-4 ring-border">
                      <AvatarImage src={profile.photo} alt={profile.name} />
                      <AvatarFallback className="bg-primary/10 text-2xl font-semibold text-primary">
                        {initials}
                      </AvatarFallback>
                    </Avatar>
                    {isEditing && (
                      <div>
                        <Button variant="outline" className="gap-2">
                          <Camera className="h-4 w-4" />
                          Alterar Foto
                        </Button>
                        <p className="mt-2 text-xs text-muted-foreground">
                          JPG ou PNG. Máx. 2MB
                        </p>
                      </div>
                    )}
                  </div>

                  {/* Name */}
                  <div className="grid gap-2">
                    <Label htmlFor="name">Nome Completo</Label>
                    <Input
                      id="name"
                      value={profile.name}
                      onChange={(e) =>
                        setProfile({ ...profile, name: e.target.value })
                      }
                      disabled={!isEditing}
                      placeholder="Seu nome completo"
                    />
                  </div>

                  {/* Registration and Specialty */}
                  <div className="grid gap-4 md:grid-cols-2">
                    <div className="grid gap-2">
                      <Label htmlFor="registration">
                        Registro Profissional (COREN/CREFITO/etc)
                      </Label>
                      <Input
                        id="registration"
                        value={profile.registration}
                        onChange={(e) =>
                          setProfile({ ...profile, registration: e.target.value })
                        }
                        disabled={!isEditing}
                        placeholder="Ex: COREN-SP 123456"
                      />
                    </div>
                    <div className="grid gap-2">
                      <Label htmlFor="specialty">Especialidade</Label>
                      <Select
                        value={profile.specialty}
                        onValueChange={(value) =>
                          setProfile({ ...profile, specialty: value })
                        }
                        disabled={!isEditing}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Selecione" />
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
                  </div>

                  {/* Location */}
                  <div className="grid gap-4 md:grid-cols-3">
                    <div className="grid gap-2">
                      <Label htmlFor="neighborhood">Bairro</Label>
                      <Input
                        id="neighborhood"
                        value={profile.neighborhood}
                        onChange={(e) =>
                          setProfile({ ...profile, neighborhood: e.target.value })
                        }
                        disabled={!isEditing}
                        placeholder="Seu bairro"
                      />
                    </div>
                    <div className="grid gap-2">
                      <Label htmlFor="city">Cidade</Label>
                      <Input
                        id="city"
                        value={profile.city}
                        onChange={(e) =>
                          setProfile({ ...profile, city: e.target.value })
                        }
                        disabled={!isEditing}
                        placeholder="Sua cidade"
                      />
                    </div>
                    <div className="grid gap-2">
                      <Label htmlFor="state">Estado</Label>
                      <Select
                        value={profile.state}
                        onValueChange={(value) =>
                          setProfile({ ...profile, state: value })
                        }
                        disabled={!isEditing}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="UF" />
                        </SelectTrigger>
                        <SelectContent>
                          {states.map((state) => (
                            <SelectItem key={state} value={state}>
                              {state}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  {/* Experience */}
                  <div className="grid gap-2">
                    <Label htmlFor="experience">Experiência Profissional</Label>
                    <Textarea
                      id="experience"
                      value={profile.experience}
                      onChange={(e) =>
                        setProfile({ ...profile, experience: e.target.value })
                      }
                      disabled={!isEditing}
                      placeholder="Descreva sua experiência profissional..."
                      rows={3}
                    />
                  </div>

                  {/* Bio */}
                  <div className="grid gap-2">
                    <Label htmlFor="bio">Mini-bio</Label>
                    <Textarea
                      id="bio"
                      value={profile.bio}
                      onChange={(e) =>
                        setProfile({ ...profile, bio: e.target.value })
                      }
                      disabled={!isEditing}
                      placeholder="Uma breve descrição sobre você..."
                      rows={4}
                    />
                    <p className="text-xs text-muted-foreground">
                      Esta descrição será exibida no seu perfil público.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </Layout>
  );
};

export default Dashboard;
