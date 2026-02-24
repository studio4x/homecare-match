"use client";

import React from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter, // Import DialogFooter
} from "@/components/ui/dialog";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { MapPin, Building2, Home, Info, MessageCircle, ShieldCheck, Users, HeartPulse, Footprints, Brain, Syringe, MessageSquare, Calendar, User, DollarSign, Clock, Loader2 } from "lucide-react";
import SafeHTML from './SafeHTML';
import ReviewList from './ReviewList';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button'; // Import Button

// WhatsApp Icon component (copied from InteractionHistory)
const WhatsAppIcon = ({ className, ...props }: React.ComponentProps<"svg">) => (
  <svg viewBox="0 0 24 24" fill="currentColor" className={className} {...props}>
    <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.272-.57-.422z" />
    <path fillRule="evenodd" clipRule="evenodd" d="M12 2C6.48 2 2 6.48 2 12c0 1.85.5 3.58 1.38 5.08L2 22l5.05-1.32A9.95 9.95 0 0112 22c5.52 0 10-4.48 10-10S17.52 2 12 2zm0 18c-1.65 0-3.21-.49-4.54-1.33l-.33-.21-3.37.88.9-3.28-.21-.34A7.95 7.95 0 014 12c0-4.41 3.59-8 8-8s8 3.59 8 8-3.59 8-8 8z" />
  </svg>
);

// Função auxiliar para mascarar o número de telefone (últimos 4 dígitos)
const maskPhoneNumber = (phone: string | undefined): string => {
  if (!phone) return "Número não disponível";
  const cleanPhone = phone.replace(/\D/g, ''); // Remove non-digits
  if (cleanPhone.length < 11) return phone; // Don't mask if too short or invalid format
  
  const ddd = cleanPhone.substring(0, 2);
  const firstPart = cleanPhone.substring(2, 7); // First 5 digits after DDD
  
  return `(${ddd}) ${firstPart}-****`; // Mask the last 4 digits
};

interface ProfileData {
  id: string;
  full_name: string;
  avatar_url: string;
  role?: string;
  phone?: string; // Ensure phone is included
  city?: string;
  state?: string;
  neighborhood?: string;
  bio?: string;
  specialty?: string;
  registration?: string;
  experience?: string;
  professional_experiences?: string;
  is_verified?: boolean;
  ans_registration?: string;
  // Family patient fields
  patient_name?: string;
  patient_age?: number;
  patient_medical_conditions?: string;
  patient_mobility_level?: string[];
  patient_cognitive_state?: string[];
  patient_special_equipment?: string[];
  patient_communication_skills?: string[];
  availability?: string[];
}

interface PatientData {
  id: string;
  patient_name?: string;
  patient_age?: number;
  patient_medical_conditions?: string;
  patient_mobility_level?: string[];
  patient_cognitive_state?: string[];
  patient_special_equipment?: string[];
  patient_communication_skills?: string[];
  patient_zip?: string;
  patient_specialties?: string[];
  patient_period?: string[];
  patient_repass_value?: number;
  patient_days_per_week?: number;
}

interface InteractionProfileModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  profile: ProfileData | null;
  viewerFullName: string; // Name of the logged-in user (professional)
  viewerRole: 'professional' | 'company' | 'family'; // Role of the logged-in user
  companyPatients: PatientData[]; // New prop for company patients
  loadingCompanyPatients: boolean; // New prop for loading state
}

const InteractionProfileModal = ({ open, onOpenChange, profile, viewerFullName, viewerRole, companyPatients, loadingCompanyPatients }: InteractionProfileModalProps) => {
  if (!profile) return null;

  const initials = (profile.full_name || "")
    .split(" ")
    .filter(Boolean)
    .map((n: string) => n[0])
    .join("")
    .slice(0, 2)
    .toUpperCase() || "??";

  const isProfessional = profile.role === 'professional';
  const isCompany = profile.role === 'company';
  const isFamily = profile.role === 'family';

  const getRoleBadge = (role: string | undefined) => {
    if (!role) return null;
    if (role === 'professional') return <Badge variant="secondary" className="capitalize flex items-center gap-1.5 bg-primary/10 text-primary border-primary/20"><ShieldCheck className="h-3 w-3" /> Profissional</Badge>;
    if (role === 'company') return <Badge variant="secondary" className="capitalize flex items-center gap-1.5 bg-success/10 text-success border-success/20"><Building2 className="h-3 w-3" /> Empresa</Badge>;
    if (role === 'family') return <Badge variant="outline" className="capitalize flex items-center gap-1.5 bg-amber-50 text-amber-700 border-amber-200"><Home className="h-3 w-3" /> Família</Badge>;
    return null;
  };

  const handleWhatsAppClick = () => {
    const contactName = profile.full_name || "o contato";
    let defaultMessage = "";

    if (viewerRole === 'professional') {
      defaultMessage = `Olá ${contactName}, sou ${viewerFullName} da HomeCare Match. Tenho interesse em sua vaga/necessidade.`;
    } else { // company or family
      defaultMessage = `Olá ${contactName}, sou ${viewerFullName} da HomeCare Match. Tenho interesse em seu perfil para uma vaga/necessidade.`;
    }

    const encodedMessage = encodeURIComponent(defaultMessage);
    const phone = profile.phone?.replace(/\D/g, '');
    if (phone) {
      window.open(`https://wa.me/${phone}?text=${encodedMessage}`, '_blank');
    } else {
      // This case should ideally not happen if the button is only shown when phone exists
      console.error("Número de WhatsApp não disponível para iniciar conversa.");
    }
  };

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
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl p-0 overflow-hidden border-none shadow-2xl max-h-[90vh] flex flex-col">
        <DialogHeader className="p-6 border-b bg-card shrink-0">
          <div className="flex items-center gap-4">
            <Avatar className="h-16 w-16 ring-2 ring-background shadow-lg">
              <AvatarImage src={profile.avatar_url} />
              <AvatarFallback className="bg-primary/10 text-xl font-bold text-primary">
                {initials}
              </AvatarFallback>
            </Avatar>
            <div className="flex-1 min-w-0">
              <DialogTitle className="text-2xl font-bold text-foreground line-clamp-1">{profile.full_name || "Usuário"}</DialogTitle>
              <div className="flex flex-wrap items-center gap-2 mt-1">
                {getRoleBadge(profile.role)}
                {profile.city && profile.state && (
                  <div className="flex items-center gap-1 text-sm text-muted-foreground">
                    <MapPin className="h-4 w-4 text-primary" />
                    {profile.neighborhood ? `${profile.neighborhood}, ` : ''}{profile.city} - {profile.state}
                  </div>
                )}
              </div>
            </div>
          </div>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          <section>
            <h3 className="text-lg font-semibold border-b pb-2 mb-4 flex items-center gap-2">
              <Info className="h-5 w-5 text-primary" />
              {isProfessional ? 'Sobre mim' : isCompany ? 'Sobre a Empresa' : 'Descrição da Necessidade'}
            </h3>
            <SafeHTML content={profile.bio || "Nenhuma descrição fornecida."} />
          </section>

          {isProfessional && (
            <>
              <section>
                <h3 className="text-lg font-semibold border-b pb-2 mb-4 flex items-center gap-2">
                  <Info className="h-5 w-5 text-primary" />
                  Especialidade
                </h3>
                <p className="text-muted-foreground">{profile.specialty || "Não informado"}</p>
              </section>
              <section>
                <h3 className="text-lg font-semibold border-b pb-2 mb-4 flex items-center gap-2">
                  <Info className="h-5 w-5 text-primary" />
                  Formações
                </h3>
                <SafeHTML content={profile.experience || "Informações de formações não detalhadas."} />
              </section>
              <section>
                <h3 className="text-lg font-semibold border-b pb-2 mb-4 flex items-center gap-2">
                  <Info className="h-5 w-5 text-primary" />
                  Experiências Profissionais
                </h3>
                <SafeHTML content={profile.professional_experiences || "Informações de experiências profissionais não detalhadas."} />
              </section>
            </>
          )}
          {isCompany && profile.ans_registration && (
            <section>
              <h3 className="text-lg font-semibold border-b pb-2 mb-4 flex items-center gap-2">
                <Info className="h-5 w-5 text-primary" />
                Registro ANS
              </h3>
              <p className="text-muted-foreground">{profile.ans_registration}</p>
            </section>
          )}

          {isCompany && (
            <section>
              <h3 className="text-lg font-semibold border-b pb-2 mb-4 flex items-center gap-2">
                <Users className="h-5 w-5 text-primary" /> Pacientes da Empresa
              </h3>
              {loadingCompanyPatients ? (
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
            </section>
          )}

          {isFamily && (
            <section>
              <h3 className="text-lg font-semibold border-b pb-2 mb-4 flex items-center gap-2">
                <User className="h-5 w-5 text-primary" /> Informações do Paciente
              </h3>
              <div className="border rounded-lg p-4 space-y-3 bg-secondary/10">
                <div className="flex items-center gap-3">
                  <User className="h-5 w-5 text-primary" />
                  <h4 className="font-bold text-lg">{profile.patient_name || 'Nome não informado'}</h4>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
                  {renderPatientDetail("Idade", profile.patient_age, Calendar)}
                  {renderPatientDetail("Condições Médicas", profile.patient_medical_conditions, HeartPulse)}
                  {renderPatientDetail("Mobilidade", profile.patient_mobility_level, Footprints)}
                  {renderPatientDetail("Estado Cognitivo", profile.patient_cognitive_state, Brain)}
                  {renderPatientDetail("Equipamentos", profile.patient_special_equipment, Syringe)}
                  {renderPatientDetail("Comunicação", profile.patient_communication_skills, MessageSquare)}
                  {renderPatientDetail("Horário de Atendimento", profile.availability, Clock)}
                </div>
              </div>
            </section>
          )}

          <section>
            <h3 className="text-lg font-semibold border-b pb-2 mb-4 flex items-center gap-2">
              <MessageCircle className="h-5 w-5 text-primary" />
              Avaliações
            </h3>
            <ReviewList subjectId={profile.id} />
          </section>
        </div>

        {profile.phone && (
          <DialogFooter className="p-6 border-t bg-card">
            <Button 
              onClick={handleWhatsAppClick} 
              className="w-full gap-2 bg-green-600 hover:bg-green-700"
            >
              <WhatsAppIcon className="h-5 w-5" /> Iniciar Conversa no WhatsApp
            </Button>
          </DialogFooter>
        )}
      </DialogContent>
    </Dialog>
  );
};

export default InteractionProfileModal;
