"use client";

import { useState, useEffect } from "react";
import { useParams, Link, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import Layout from "@/components/layout/Layout";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { 
  MapPin, 
  Award, 
  Briefcase, 
  MessageSquare, 
  ArrowLeft,
  Calendar,
  Share2,
  Star,
  Loader2,
  Lock,
  UserCheck,
  X,
  Users,
  LayoutGrid,
  DollarSign,
  Clock,
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { useAuth } from "@/components/auth/AuthProvider";
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Separator } from "@/components/ui/separator";

const Perfil = () => {
  const { id } = useParams();
  const { session, user } = useAuth();
  const navigate = useNavigate();
  
  const [profile, setProfile] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [isContacting, setIsContacting] = useState(false);
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [viewerRole, setViewerRole] = useState<string | null>(null);

  useEffect(() => {
    const fetchViewerRole = async () => {
      if (user) {
        const { data } = await supabase
          .from("profiles")
          .select("role")
          .eq("id", user.id)
          .single();
        setViewerRole(data?.role || null);
      }
    };
    fetchViewerRole();
  }, [user]);

  useEffect(() => {
    fetchProfile();
  }, [id]);

  const fetchProfile = async () => {
    setLoading(true);
    const safePublicFields = "id, full_name, avatar_url, specialty, registration, city, state, neighborhood, experience, bio, subscription_tier, is_verified, role, updated_at, phone, hourly_rate, availability, patient_profiles";
    
    const { data, error } = await supabase
      .from("profiles")
      .select(safePublicFields)
      .eq("id", id)
      .single();

    if (error) {
      console.error(error);
      toast.error("Perfil não encontrado.");
    } else {
      setProfile(data);
    }
    setLoading(false);
  };

  const handleContact = async () => {
    if (!session || !user) {
      toast.info("Você precisa estar logado para entrar em contato.");
      navigate("/login");
      return;
    }

    if (user.id === profile.id) {
      toast.error("Você não pode entrar em contato com você mesmo.");
      return;
    }

    setIsContacting(true);

    try {
      const { error } = await supabase.from('interactions').insert({
        sender_id: user.id,
        professional_id: profile.id
      });

      if (error) throw error;

      // Dispara a notificação por e-mail em segundo plano
      supabase.functions.invoke('notify-contact', {
        body: { professional_id: profile.id, sender_id: user.id }
      }).catch(err => console.warn("Falha ao enviar notificação por e-mail:", err));

      setShowSuccessModal(true);
      
    } catch (error) {
      toast.error("Erro ao adicionar profissional aos contatos.");
      console.error("Erro ao registrar interação:", error);
    } finally {
      setIsContacting(false);
    }
  };

  const shareProfile = () => {
    navigator.clipboard.writeText(window.location.href);
    toast.success("Link do perfil copiado!");
  };

  if (loading) return (
    <Layout>
      <div className="flex h-96 items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent"></div>
      </div>
    </Layout>
  );

  if (!profile) return (
    <Layout>
      <div className="container mx-auto px-4 py-20 text-center">
        <h2 className="text-2xl font-bold">Profissional não encontrado</h2>
        <Button asChild className="mt-4">
          <Link to="/buscar">Voltar para a busca</Link>
        </Button>
      </div>
    </Layout>
  );

  const initials = profile.full_name?.split(" ").map((n: any) => n[0]).join("").slice(0, 2).toUpperCase();
  const isPremium = profile.subscription_tier === 'yearly';
  
  return (
    <Layout>
      <div className="bg-secondary/20 py-8">
        <div className="container mx-auto px-4">
          <Button variant="ghost" asChild className="mb-6 gap-2">
            <Link to="/buscar">
              <ArrowLeft className="h-4 w-4" />
              Voltar para busca
            </Link>
          </Button>

          <div className="grid gap-8 lg:grid-cols-3">
            {/* Perfil Principal */}
            <div className="lg:col-span-2 space-y-6">
              <div className={cn(
                "rounded-2xl border bg-card p-8 shadow-card",
                isPremium ? "border-amber-400/30" : "border-border"
              )}>
                <div className="flex flex-col md:flex-row gap-6 items-start">
                  <div className="relative">
                    <Avatar className="h-32 w-32 ring-4 ring-background shadow-lg">
                      <AvatarImage src={profile.avatar_url} />
                      <AvatarFallback className="bg-primary/10 text-3xl font-bold text-primary">
                        {initials}
                      </AvatarFallback>
                    </Avatar>
                    {isPremium && (
                      <div className="absolute -bottom-2 -right-2 bg-gold p-1.5 rounded-full ring-4 ring-background shadow-md">
                        <Star className="h-5 w-5 text-white fill-current" />
                      </div>
                    )}
                  </div>
                  <div className="flex-1">
                    <div className="flex flex-wrap items-center gap-3">
                      <h1 className="text-3xl font-bold text-foreground flex items-center gap-2">
                        {profile.full_name}
                        {isPremium && <Star className="h-6 w-6 text-gold fill-current" />}
                      </h1>
                      {/* Badge responsivo: whitespace-nowrap para não quebrar feio, e text-sm no mobile */}
                      {profile.is_verified && (
                        <Badge className={cn(
                          "border-none text-white whitespace-nowrap",
                          isPremium ? "bg-gold" : "bg-success"
                        )}>
                          {isPremium ? "Verificado Premium" : "Verificado"}
                        </Badge>
                      )}
                    </div>
                    <p className="mt-2 text-xl text-muted-foreground font-medium uppercase tracking-tight">
                      {profile.specialty}
                    </p>
                    <div className="mt-4 flex flex-wrap gap-4 text-sm text-muted-foreground">
                      <div className="flex items-center gap-1">
                        <MapPin className="h-4 w-4 text-primary" />
                        {profile.neighborhood}, {profile.city} - {profile.state}
                      </div>
                      <div className="flex items-center gap-1">
                        <Award className="h-4 w-4 text-primary" />
                        {profile.registration}
                      </div>
                    </div>
                  </div>
                </div>

                <div className="mt-10">
                  <h3 className="text-lg font-semibold border-b pb-2 mb-4">Sobre mim</h3>
                  <p className="text-muted-foreground whitespace-pre-wrap leading-relaxed">
                    {profile.bio || "Este profissional ainda não preencheu sua biografia."}
                  </p>
                </div>

                <div className="mt-10">
                  <h3 className="text-lg font-semibold border-b pb-2 mb-4 flex items-center gap-2">
                    <Briefcase className="h-5 w-5 text-primary" />
                    Experiência Profissional
                  </h3>
                  <p className="text-muted-foreground whitespace-pre-wrap leading-relaxed">
                    {profile.experience || "Informações de experiência não detalhadas."}
                  </p>
                </div>

                <Separator className="my-10" />

                <div>
                  <h3 className="text-lg font-semibold mb-6">Detalhes do Atendimento</h3>
                  <div className="grid gap-8 md:grid-cols-2">
                    <div>
                      <h4 className="font-semibold flex items-center gap-2 mb-3">
                        <Clock className="h-5 w-5 text-primary" />
                        Disponibilidade
                      </h4>
                      {profile.availability?.length > 0 ? (
                        <div className="flex flex-wrap gap-2">
                          {profile.availability.map((item: string) => (
                            <Badge key={item} variant="secondary">{item}</Badge>
                          ))}
                        </div>
                      ) : (
                        <p className="text-sm text-muted-foreground">Não informado.</p>
                      )}
                    </div>
                    <div>
                      <h4 className="font-semibold flex items-center gap-2 mb-3">
                        <Users className="h-5 w-5 text-primary" />
                        Perfis de Pacientes
                      </h4>
                      {profile.patient_profiles?.length > 0 ? (
                        <div className="flex flex-wrap gap-2">
                          {profile.patient_profiles.map((item: string) => (
                            <Badge key={item} variant="secondary">{item}</Badge>
                          ))}
                        </div>
                      ) : (
                        <p className="text-sm text-muted-foreground">Não informado.</p>
                      )}
                    </div>
                    {viewerRole === 'family' && profile.hourly_rate && (
                      <div className="md:col-span-2">
                        <h4 className="font-semibold flex items-center gap-2 mb-3">
                          <DollarSign className="h-5 w-5 text-primary" />
                          Valor por Hora
                        </h4>
                        <p className="text-2xl font-bold text-foreground">
                          R$ {Number(profile.hourly_rate).toFixed(2).replace('.', ',')}
                        </p>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>

            {/* Sidebar de Ações */}
            <div className="space-y-6">
              <div className="rounded-2xl border border-border bg-card p-6 shadow-card sticky top-24">
                <h3 className="font-semibold text-lg mb-2 text-center">Interessado?</h3>
                <p className="text-xs text-muted-foreground text-center mb-4">
                  Ao clicar, o profissional será salvo em sua lista de contatos no seu painel, onde você poderá ver o WhatsApp e iniciar a conversa.
                </p>
                <div className="space-y-3">
                  <Button 
                    onClick={handleContact} 
                    disabled={isContacting}
                    className="w-full h-12 gap-2 text-lg bg-primary hover:bg-primary/90"
                  >
                    {isContacting ? (
                      <Loader2 className="h-5 w-5 animate-spin" />
                    ) : (
                      <MessageSquare className="h-5 w-5" />
                    )}
                    Adicionar aos Contatos
                  </Button>
                  
                  {!session && (
                    <p className="text-xs text-center text-muted-foreground flex items-center justify-center gap-1">
                      <Lock className="h-3 w-3" />
                      Login necessário para visualizar contato
                    </p>
                  )}

                  <Button onClick={shareProfile} variant="outline" className="w-full gap-2">
                    <Share2 className="h-4 w-4" />
                    Compartilhar Perfil
                  </Button>
                </div>
                
                <div className="mt-6 pt-6 border-t border-border">
                  <div className="flex items-center gap-3 text-sm text-muted-foreground">
                    <Calendar className="h-4 w-4" />
                    <span>Membro desde {new Date(profile.updated_at).toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })}</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <Dialog open={showSuccessModal} onOpenChange={setShowSuccessModal}>
        <DialogContent className="max-w-2xl p-0 overflow-hidden border-none shadow-2xl animate-scale-in">
          <div className="relative bg-card p-12 md:p-16 flex flex-col items-center text-center space-y-8">
            <button 
              onClick={() => setShowSuccessModal(false)}
              className="absolute right-6 top-6 p-2 rounded-full hover:bg-secondary transition-colors"
            >
              <X className="h-6 w-6 text-muted-foreground" />
            </button>

            <div className="h-24 w-24 rounded-full bg-success/10 flex items-center justify-center animate-bounce">
              <UserCheck className="h-12 w-12 text-success" />
            </div>

            <div className="space-y-4">
              <DialogTitle className="text-4xl font-bold tracking-tight text-foreground">
                Profissional Adicionado!
              </DialogTitle>
              <DialogDescription className="text-xl text-muted-foreground leading-relaxed max-w-lg mx-auto">
                {profile?.full_name} foi salvo na sua lista de contatos. Você pode ver os detalhes e iniciar a conversa a partir do seu painel.
              </DialogDescription>
            </div>

            <div className="flex flex-col sm:flex-row gap-4 w-full max-w-md">
              <Button 
                size="lg" 
                variant="outline"
                className="w-full h-14 text-lg font-semibold shadow-lg gap-2"
                asChild
              >
                <Link to="/buscar">
                  <Users className="h-5 w-5" />
                  Buscar Outros
                </Link>
              </Button>
              <Button 
                size="lg" 
                className="w-full h-14 text-lg font-semibold shadow-lg gap-2"
                asChild
              >
                <Link to="/dashboard">
                  <LayoutGrid className="h-5 w-5" />
                  Ir para o Painel
                </Link>
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </Layout>
  );
};

export default Perfil;