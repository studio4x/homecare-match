"use client";

import { useState, useEffect } from "react";
import { useParams, Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import Layout from "@/components/layout/Layout";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { 
  MapPin, 
  ArrowLeft,
  Loader2,
  Building2,
  Home,
  Info
} from "lucide-react";
import { toast } from "sonner";

const RecruiterProfile = () => {
  const { id } = useParams();
  const [profile, setProfile] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchProfile = async () => {
      setLoading(true);
      const { data, error } = await supabase
        .from("profiles")
        .select("id, full_name, avatar_url, city, state, bio, role")
        .eq("id", id)
        .single();

      if (error) {
        console.error(error);
        toast.error("Perfil do recrutador não encontrado.");
      } else {
        setProfile(data);
      }
      setLoading(false);
    };

    fetchProfile();
  }, [id]);

  if (loading) {
    return (
      <Layout>
        <div className="flex h-96 items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      </Layout>
    );
  }

  if (!profile) {
    return (
      <Layout>
        <div className="container mx-auto px-4 py-20 text-center">
          <h2 className="text-2xl font-bold">Recrutador não encontrado</h2>
          <Button asChild className="mt-4">
            <Link to="/dashboard">Voltar para o Painel</Link>
          </Button>
        </div>
      </Layout>
    );
  }

  const initials = profile.full_name?.split(" ").map((n: any) => n[0]).join("").slice(0, 2).toUpperCase();
  const isCompany = profile.role === 'company';

  return (
    <Layout>
      <div className="bg-secondary/20 py-8 min-h-[calc(100vh-10rem)]">
        <div className="container mx-auto px-4">
          <Button variant="ghost" asChild className="mb-6 gap-2">
            <Link to="/dashboard">
              <ArrowLeft className="h-4 w-4" />
              Voltar para o Painel
            </Link>
          </Button>

          <div className="max-w-3xl mx-auto">
            <div className="rounded-2xl border bg-card p-8 shadow-card">
              <div className="flex flex-col md:flex-row gap-6 items-start">
                <Avatar className="h-24 w-24 ring-4 ring-background shadow-lg">
                  <AvatarImage src={profile.avatar_url} />
                  <AvatarFallback className="bg-primary/10 text-2xl font-bold text-primary">
                    {initials}
                  </AvatarFallback>
                </Avatar>
                <div className="flex-1">
                  <h1 className="text-3xl font-bold text-foreground">{profile.full_name}</h1>
                  <div className="mt-2 flex flex-wrap items-center gap-3">
                    <Badge variant={isCompany ? "secondary" : "outline"} className="capitalize flex items-center gap-1.5">
                      {isCompany ? <Building2 className="h-3 w-3" /> : <Home className="h-3 w-3" />}
                      {isCompany ? 'Empresa' : 'Família'}
                    </Badge>
                    <div className="flex items-center gap-1 text-sm text-muted-foreground">
                      <MapPin className="h-4 w-4 text-primary" />
                      {profile.city && profile.state ? `${profile.city} - ${profile.state}` : 'Localização não informada'}
                    </div>
                  </div>
                </div>
              </div>

              <div className="mt-10">
                <h3 className="text-lg font-semibold border-b pb-2 mb-4 flex items-center gap-2">
                  <Info className="h-5 w-5 text-primary" />
                  {isCompany ? 'Sobre a Empresa' : 'Descrição da Necessidade'}
                </h3>
                <p className="text-muted-foreground whitespace-pre-wrap leading-relaxed">
                  {profile.bio || "Nenhuma descrição fornecida."}
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </Layout>
  );
};

export default RecruiterProfile;