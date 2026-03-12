"use client";

import { useState, useEffect } from "react";
import { useParams, Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import Layout from "@/components/layout/Layout";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import ReviewList from "@/components/ReviewList";
import { 
  MapPin, 
  ArrowLeft,
  Loader2,
  Building2,
  Home,
  Info,
  MessageCircle,
  AlertTriangle,
  Users,
  HeartPulse,
  Footprints,
  Brain,
  Syringe,
  MessageSquare,
  Calendar,
  User,
  DollarSign, // New import
  Clock // New import
} from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/components/auth/AuthProvider";
import ReportModal from "@/components/ReportModal";
import SafeHTML from "@/components/SafeHTML"; // Import SafeHTML

const RecruiterProfile = () => {
  const { id } = useParams();
  const { user } = useAuth();
  const [profile, setProfile] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [showReportModal, setShowReportModal] = useState(false);
  const [companyPatients, setCompanyPatients] = useState<any[]>([]);
  const [loadingPatients, setLoadingPatients] = useState(true);

  useEffect(() => {
    const fetchProfile = async () => {
      setLoading(true);
      const { data, error } = await supabase
        .from("profiles")
        .select("id, full_name, avatar_url, city, state, bio, role, ans_registration, specialty, patient_specialties")
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

  useEffect(() => {
    const fetchCompanyPatients = async () => {
      if (!id || profile?.role !== 'company') return;
      setLoadingPatients(true);
      try {
        const { data, error } = await supabase
          .from('company_patients')
          .select('*')
          .eq('company_id', id)
          .eq('is_visible', true) // Only fetch visible patients
          .order('patient_name', { ascending: true });

        if (error) throw error;
        setCompanyPatients(data || []);
      } catch (err) {
        console.error("[RecruiterProfile] Erro ao carregar pacientes da empresa:", err);
      } finally {
        setLoadingPatients(false);
      }
    };

    if (profile?.id && profile?.role === 'company') {
      fetchCompanyPatients();
    }
  }, [profile?.id, profile?.role]);

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

  const initials = (profile.full_name || "")
    .split(" ")
    .filter(Boolean)
    .map((n: string) => n[0])
    .join("")
    .slice(0, 2)
    .toUpperCase() || "??";

  const isCompany = profile.role === 'company';
  const desiredSpecialties = Array.isArray(profile.patient_specialties) && profile.patient_specialties.length > 0
    ? profile.patient_specialties
    : (typeof profile.specialty === "string" && profile.specialty ? [profile.specialty] : []);

  const renderPatientDetail = (label: string, value: string | number | string[] | undefined, Icon: any) => {
    if (!value || (Array.isArray(value) && value.length === 0)) return null;
    return (
      <div className="flex items-center gap-3">
        <Icon className="h-5 w-5 text-primary shrink-0" />
        <div>
          <p className="text-[10px] font-bold text-muted-foreground uppercase">{label}</p>
          {Array.isArray(value) ? (
            <div className="flex flex-wrap gap-1 mt-1">
              {value.map((item, idx) => (
                <Badge key={idx} variant="secondary" className="text-xs">{item.replace(/-/g, ' ')}</Badge>
              ))}
            </div>
          ) : (
            <p className="font-semibold text-sm">{value}</p>
          )}
        </div>
      </div>
    );
  };

  return (
    <Layout>
      <div className="bg-secondary/20 py-8 min-h-[calc(100vh-10rem)]">
        <div className="container mx-auto px-4">
          <div className="flex items-center justify-between mb-6">
            <Button variant="ghost" asChild className="gap-2">
              <Link to="/dashboard">
                <ArrowLeft className="h-4 w-4" />
                Voltar para o Painel
              </Link>
            </Button>

            {user && user.id !== profile.id && (
              <Button 
                variant="ghost" 
                size="sm" 
                className="text-muted-foreground hover:text-destructive gap-2"
                onClick={() => setShowReportModal(true)}
              >
                <AlertTriangle className="h-4 w-4" />
                Denunciar Perfil
              </Button>
            )}
          </div>

          <div className="max-w-3xl mx-auto space-y-6">
            <div className="rounded-2xl border bg-card p-8 shadow-card">
              <div className="flex flex-col md:flex-row gap-6 items-start">
                <Avatar className="h-24 w-24 ring-4 ring-background shadow-lg">
                  <AvatarImage src={profile.avatar_url} />
                  <AvatarFallback className="bg-primary/10 text-2xl font-bold text-primary">
                    {initials}
                  </AvatarFallback>
                </Avatar>
                <div className="flex-1">
                  <h1 className="text-3xl font-bold text-foreground">{profile.full_name || "Recrutador"}</h1>
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
                  {isCompany && profile.ans_registration && (
                    <p className="text-sm text-muted-foreground mt-2">
                      Registro ANS: <span className="font-medium">{profile.ans_registration}</span>
                    </p>
                  )}
                  {!isCompany && desiredSpecialties.length > 0 && (
                    <div className="mt-2">
                      <p className="text-sm text-muted-foreground mb-1">Especialidades necessárias:</p>
                      <div className="flex flex-wrap gap-1">
                        {desiredSpecialties.map((item: string) => (
                          <Badge key={`family-specialty-${item}`} variant="secondary" className="text-xs">
                            {item.replace(/-/g, " ")}
                          </Badge>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>

              <div className="mt-10">
                <h3 className="text-lg font-semibold border-b pb-2 mb-4 flex items-center gap-2">
                  <Info className="h-5 w-5 text-primary" />
                  {isCompany ? 'Sobre a Empresa' : 'Sobre o paciente que precisa de atendimento'}
                </h3>
                <p className="text-muted-foreground whitespace-pre-wrap leading-relaxed">
                  {profile.bio || "Nenhuma descrição fornecida."}
                </p>
              </div>
            </div>

            {isCompany && (
              <div className="rounded-2xl border bg-card p-8 shadow-card">
                <h3 className="text-lg font-semibold border-b pb-2 mb-4 flex items-center gap-2">
                  <Users className="h-5 w-5 text-primary" /> Pacientes da Empresa
                </h3>
                {loadingPatients ? (
                  <div className="flex justify-center py-4">
                    <Loader2 className="h-6 w-6 animate-spin text-primary" />
                  </div>
                ) : companyPatients.length > 0 ? (
                  <div className="space-y-6">
                    {companyPatients.map((patient) => (
                      <div key={patient.id} className="border rounded-lg p-4 space-y-3 bg-secondary/10">
                        <div className="flex items-center gap-3">
                          <User className="h-5 w-5 text-primary" />
                          <h4 className="font-bold text-lg">{patient.patient_name || 'ID/Código não informado'}</h4>
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
                          {renderPatientDetail("Idade", patient.patient_age, Calendar)}
                          {renderPatientDetail("CEP", patient.patient_zip, MapPin)}
                          {renderPatientDetail("Especialidades", patient.patient_specialties, Users)}
                          {renderPatientDetail("Período", patient.patient_period, Clock)}
                          {renderPatientDetail("Valor Repasse", patient.patient_repass_value ? `R$ ${patient.patient_repass_value.toFixed(2).replace('.', ',')}` : undefined, DollarSign)}
                          {renderPatientDetail("Dias/Semana", patient.patient_days_per_week, Calendar)}
                          {renderPatientDetail("Condições Médicas", patient.patient_medical_conditions, HeartPulse)}
                          {renderPatientDetail("Mobilidade", patient.patient_mobility_level, Footprints)}
                          {renderPatientDetail("Estado Cognitivo", patient.patient_cognitive_state, Brain)}
                          {renderPatientDetail("Equipamentos", patient.patient_special_equipment, Syringe)}
                          {renderPatientDetail("Comunicação", patient.patient_communication_skills, MessageSquare)}
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-muted-foreground text-sm">Nenhum paciente visível cadastrado por esta empresa.</p>
                )}
              </div>
            )}

            <div className="rounded-2xl border bg-card p-8 shadow-card">
              <h3 className="text-lg font-semibold border-b pb-2 mb-4 flex items-center gap-2">
                <MessageCircle className="h-5 w-5 text-primary" />
                Avaliações de Profissionais
              </h3>
              <ReviewList subjectId={profile.id} />
            </div>
          </div>
        </div>
      </div>

      <ReportModal 
        open={showReportModal} 
        onOpenChange={setShowReportModal} 
        reportedId={profile.id} 
        reportedName={profile.full_name} 
      />
    </Layout>
  );
};

export default RecruiterProfile;
