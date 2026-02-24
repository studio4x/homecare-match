"use client";

import React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  User,
  Calendar,
  MapPin,
  Users,
  Clock,
  DollarSign,
  HeartPulse,
  Footprints,
  Brain,
  Syringe,
  MessageSquare,
  Eye,
  EyeOff,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface PatientData {
  id: string;
  patient_name?: string;
  patient_age?: number;
  patient_medical_conditions?: string;
  patient_mobility_level?: string[];
  patient_cognitive_state?: string[];
  patient_special_equipment?: string[];
  patient_communication_skills?: string[];
  is_visible: boolean;
  patient_zip?: string;
  patient_specialties?: string[];
  patient_period?: string[];
  patient_repass_value?: number;
  patient_days_per_week?: number;
}

interface PatientInfoCardProps {
  patient: PatientData;
  viewerRole: 'company' | 'family';
}

const renderDetail = (label: string, value: string | number | string[] | undefined, Icon: React.ElementType, isCurrency = false) => {
  if (!value || (Array.isArray(value) && value.length === 0)) return null;

  const displayValue = Array.isArray(value)
    ? value.map((item, idx) => (
        <Badge key={idx} variant="secondary" className="mr-1 mb-1 text-xs">
          {item.replace(/-/g, ' ')}
        </Badge>
      ))
    : isCurrency && typeof value === 'number'
    ? `R$ ${value.toFixed(2).replace('.', ',')}`
    : value;

  return (
    <div className="flex items-center gap-3">
      <Icon className="h-5 w-5 text-primary shrink-0" />
      <div>
        <p className="text-[10px] font-bold text-muted-foreground uppercase">{label}</p>
        <div className={cn("font-semibold text-sm", Array.isArray(value) && "flex flex-wrap mt-1")}>
          {displayValue}
        </div>
      </div>
    </div>
  );
};

const PatientInfoCard = ({ patient, viewerRole }: PatientInfoCardProps) => {
  const isCompany = viewerRole === 'company';

  return (
    <Card className="shadow-sm border-primary/10 bg-primary/5">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base flex items-center gap-2">
            <User className="h-4 w-4 text-primary" />
            {isCompany ? 'Paciente' : 'Meu Familiar'}
            <span className="text-sm font-bold text-foreground ml-2">{patient.patient_name || 'ID/Código não informado'}</span>
          </CardTitle>
          {isCompany && (
            patient.is_visible ? (
              <Badge className="bg-success/10 text-success border-success/20 gap-1">
                <Eye className="h-3 w-3" /> Visível
              </Badge>
            ) : (
              <Badge variant="secondary" className="gap-1">
                <EyeOff className="h-3 w-3" /> Oculto
              </Badge>
            )
          )}
        </div>
      </CardHeader>
      <CardContent className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
        {renderDetail("Idade", patient.patient_age, Calendar)}
        {renderDetail("CEP", patient.patient_zip, MapPin)}
        {renderDetail("Especialidades", patient.patient_specialties, Users)}
        {renderDetail("Período", patient.patient_period, Clock)}
        {renderDetail("Valor Repasse", patient.patient_repass_value, DollarSign, true)}
        {renderDetail("Dias/Semana", patient.patient_days_per_week, Calendar)}
        {renderDetail("Condições Médicas", patient.patient_medical_conditions, HeartPulse)}
        {renderDetail("Mobilidade", patient.patient_mobility_level, Footprints)}
        {renderDetail("Estado Cognitivo", patient.patient_cognitive_state, Brain)}
        {renderDetail("Equipamentos", patient.patient_special_equipment, Syringe)}
        {renderDetail("Comunicação", patient.patient_communication_skills, MessageSquare)}
      </CardContent>
    </Card>
  );
};

export default PatientInfoCard;