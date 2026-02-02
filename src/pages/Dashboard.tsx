"use client";

import { useState, useEffect } from "react";
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
  LogOut,
} from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/components/auth/AuthProvider";
import { supabase } from "@/integrations/supabase/client";
import { Navigate } from "react-router-dom";

const Dashboard = () => {
  const { user, session, loading, signOut } = useAuth();
  const [isSaving, setIsSaving] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [profile, setProfile] = useState({
    full_name: "",
    registration: "",
    specialty: "",
    city: "",
    state: "",
    neighborhood: "",
    experience: "",
    bio: "",
    avatar_url: "",
  });

  useEffect(() => {
    if (user) {
      fetchProfile();
    }
  }, [user]);

  const fetchProfile = async () => {
    const { data, error } = await supabase
      .from("profiles")
      .select("*")
      .eq("id", user?.id)
      .single();

    if (error) {
      console.error("Erro ao carregar perfil:", error);
    } else if (data) {
      setProfile({
        full_name: data.full_name || "",
        registration: data.registration || "",
        specialty: data.specialty || "",
        city: data.city || "",
        state: data.state || "",
        neighborhood: data.neighborhood || "",
        experience: data.experience || "",
        bio: data.bio || "",
        avatar_url: data.avatar_url || "",
      });
    }
  };

  const handleSave = async () => {
    if (!user) return;
    setIsSaving(true);
    
    const { error } = await supabase
      .from("profiles")
      .upsert({
        id: user.id,
        ...profile,
        updated_at: new Date().toISOString(),
      });

    if (error) {
      toast.error("Erro ao salvar perfil.");
      console.error(error);
    } else {
      toast.success("Perfil atualizado com sucesso!");
      setIsEditing(false);
    }
    setIsSaving(false);
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

  if (loading) return null;
  if (!session) return <Navigate to="/login" replace />;

  const initials = profile.full_name
    ? profile.full_name.split(" ").map(n => n[0]).join("").slice(0, 2).toUpperCase()
    : "??";

  return (
    <Layout>
      <div className="min-h-screen bg-secondary/20 py-8">
        <div className="container mx-auto px-4">
          <div className="mb-8 flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-foreground">Meu Perfil</h1>
              <p className="mt-2 text-muted-foreground">
                Gerencie suas informações profissionais e status da assinatura.
              </p>
            </div>
            <Button variant="ghost" onClick={signOut} className="gap-2 text-muted-foreground">
              <LogOut className="h-4 w-4" />
              Sair
            </Button>
          </div>

          <div className="grid gap-6 lg:grid-cols-3">
            {/* Sidebar - Status */}
            <div className="space-y-6 lg:col-span-1">
              {/* Subscription Status Card */}
              <div className="rounded-2xl border border-border bg-card p-6 shadow-card">
                <h3 className="mb-4 font-semibold text-foreground">
                  Status da Assinatura
                </h3>
                <div className="flex items-center gap-3 rounded-lg bg-success/10 p-4">
                  <CheckCircle className="h-6 w-6 text-success" />
                  <div>
                    <p className="font-medium text-success">Acesso Gratuito (Beta)</p>
                    <p className="text-sm text-muted-foreground">
                      Perfil visível para empresas
                    </p>
                  </div>
                </div>
                <Button className="mt-4 w-full" variant="outline" disabled>
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
                    <AvatarImage src={profile.avatar_url} alt={profile.full_name} />
                    <AvatarFallback className="bg-primary/10 text-xl font-semibold text-primary">
                      {initials}
                    </AvatarFallback>
                  </Avatar>
                  <h4 className="mt-4 font-semibold text-foreground">
                    {profile.full_name || "Seu Nome Aqui"}
                  </h4>
                  <Badge variant="secondary" className="mt-2">
                    {specialties.find((s) => s.value === profile.specialty)?.label || "Especialidade"}
                  </Badge>
                </div>

                <div className="mt-6 space-y-3">
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Award className="h-4 w-4 text-primary" />
                    <span>{profile.registration || "Registro Profissional"}</span>
                  </div>
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <MapPin className="h-4 w-4 text-primary" />
                    <span>
                      {profile.neighborhood || "Bairro"}, {profile.city || "Cidade"} - {profile.state || "UF"}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Calendar className="h-4 w-4 text-primary" />
                    <span>Membro desde {new Date(user?.created_at || "").toLocaleDateString('pt-BR', { month: 'short', year: 'numeric' })}</span>
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
                      <Button variant="outline" onClick={() => setIsEditing(false)} disabled={isSaving}>
                        Cancelar
                      </Button>
                      <Button onClick={handleSave} className="gap-2" disabled={isSaving}>
                        {isSaving ? "Salvando..." : (
                          <>
                            <Save className="h-4 w-4" />
                            Salvar
                          </>
                        )}
                      </Button>
                    </div>
                  )}
                </div>

                <div className="space-y-6">
                  {/* Photo Upload Placeholder */}
                  <div className="flex items-center gap-6">
                    <Avatar className="h-24 w-24 ring-4 ring-border">
                      <AvatarImage src={profile.avatar_url} alt={profile.full_name} />
                      <AvatarFallback className="bg-primary/10 text-2xl font-semibold text-primary">
                        {initials}
                      </AvatarFallback>
                    </Avatar>
                    {isEditing && (
                      <div>
                        <Button variant="outline" className="gap-2" onClick={() => toast.info("Upload de fotos em breve!")}>
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
                    <Label htmlFor="full_name">Nome Completo</Label>
                    <Input
                      id="full_name"
                      value={profile.full_name}
                      onChange={(e) =>
                        setProfile({ ...profile, full_name: e.target.value })
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