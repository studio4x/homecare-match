"use client";

import React from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import CertificateDisplayContent from './CertificateDisplayContent';

interface CertificateModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  certificateId: string | null;
}

const CertificateModal = ({ open, onOpenChange, certificateId }: CertificateModalProps) => {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl p-0 overflow-hidden bg-white border-none shadow-2xl max-h-[95vh] flex flex-col">
        <DialogHeader className="p-4 border-b bg-card shrink-0">
          <DialogTitle className="text-lg font-bold">Selo de Conclusão</DialogTitle>
        </DialogHeader>
        <div className="flex-1 overflow-y-auto">
          {certificateId ? (
            <div id={`certificate-content-${certificateId}`}>
              <CertificateDisplayContent certificateId={certificateId} />
            </div>
          ) : (
            <div className="p-8 text-center text-muted-foreground">Nenhum certificado selecionado.</div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default CertificateModal;