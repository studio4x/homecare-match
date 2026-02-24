"use client";

import React from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import ProfessionalCard from './ProfessionalCard';

interface ProfessionalMapModalProps {
  professional: any | null;
  onClose: () => void;
  specialties: { value: string; label: string }[];
}

const ProfessionalMapModal = ({ professional, onClose, specialties }: ProfessionalMapModalProps) => {
  if (!professional) return null;

  const specialtyLabel = specialties.find(s => s.value === professional.specialty)?.label || professional.specialty;

  return (
    <Dialog open={!!professional} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-[450px] p-0 overflow-hidden border-none shadow-2xl">
        <DialogHeader className="sr-only">
          <DialogTitle>Resumo do Profissional</DialogTitle>
        </DialogHeader>
        
        <div className="p-4">
          <ProfessionalCard
            id={professional.id}
            name={professional.full_name}
            photo={professional.avatar_url}
            specialty={specialtyLabel}
            registration={professional.registration}
            location={`${professional.neighborhood || ""}, ${professional.city || ""} - ${professional.state || ""}`}
            experience={professional.experience}
            isVerified={professional.is_verified}
            subscriptionTier={professional.subscription_tier}
            distance={professional.distance}
            completedCoursesCount={professional.completed_courses_count}
          />
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default ProfessionalMapModal;
