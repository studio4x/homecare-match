"use client";

import React from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { MapPin, Building2, Home, Info, MessageCircle, ShieldCheck } from "lucide-react";
import SafeHTML from './SafeHTML';
import ReviewList from './ReviewList';
import { cn } from '@/lib/utils';

interface ProfileData {
  id: string;
  full_name: string;
  avatar_url: string;
  role?: string;
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
}

interface InteractionProfileModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  profile: ProfileData | null;
}

const InteractionProfileModal = ({ open, onOpenChange, profile }: InteractionProfileModalProps) => {
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

  const getRoleBadge = (role: string | undefined) => {
    if (!role) return null;
    if (role === 'professional') return <Badge variant="secondary" className="capitalize flex items-center gap-1.5 bg-primary/10 text-primary border-primary/20"><ShieldCheck className="h-3 w-3" /> Profissional</Badge>;
    if (role === 'company') return <Badge variant="secondary" className="capitalize flex items-center gap-1.5 bg-success/10 text-success border-success/20"><Building2 className="h-3 w-3" /> Empresa</Badge>;
    if (role === 'family') return <Badge variant="outline" className="capitalize flex items-center gap-1.5 bg-amber-50 text-amber-700 border-amber-200"><Home className="h-3 w-3" /> Família</Badge>;
    return null;
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

          <section>
            <h3 className="text-lg font-semibold border-b pb-2 mb-4 flex items-center gap-2">
              <MessageCircle className="h-5 w-5 text-primary" />
              Avaliações
            </h3>
            <ReviewList subjectId={profile.id} />
          </section>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default InteractionProfileModal;