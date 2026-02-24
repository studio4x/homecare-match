"use client";

import React from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { X, Printer } from 'lucide-react';
import CertificateDisplayContent from './CertificateDisplayContent'; // Import the content component

interface CertificateModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  certificateId: string | null;
}

const CertificateModal = ({ open, onOpenChange, certificateId }: CertificateModalProps) => {
  const handlePrint = () => {
    // Create a temporary iframe to print the content
    const printWindow = window.open('', '_blank');
    if (printWindow && certificateId) {
      printWindow.document.write(`
        <!DOCTYPE html>
        <html>
        <head>
          <title>Selo de Conclusão</title>
          <link rel="stylesheet" href="/src/index.css">
          <style>
            @page { size: A4 landscape; margin: 0; }
            body { margin: 0; padding: 0; height: 100%; background: white !important; }
            .certificate-container {
              width: 297mm;
              height: 210mm;
              border-width: 10mm !important;
              padding: 10mm !important;
              margin: 0 !important;
              box-sizing: border-box !important;
              page-break-inside: avoid;
              display: flex;
              flex-direction: column;
              justify-content: space-between;
              position: absolute;
              top: 0;
              left: 0;
            }
            * { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
          </style>
        </head>
        <body>
          <div class="certificate-container">
            <div id="certificate-content-to-print"></div>
          </div>
          <script>
            window.onload = function() {
              const content = window.opener.document.getElementById('certificate-content-${certificateId}').innerHTML;
              document.getElementById('certificate-content-to-print').innerHTML = content;
              setTimeout(() => {
                window.print();
                window.close();
              }, 500); // Give a small delay for content to render
            };
          </script>
        </body>
        </html>
      `);
      printWindow.document.close();
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl p-0 overflow-hidden bg-white border-none shadow-2xl max-h-[95vh] flex flex-col">
        <DialogHeader className="p-4 border-b bg-card flex-row items-center justify-between shrink-0">
          <DialogTitle className="text-lg font-bold">Selo de Conclusão</DialogTitle>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={handlePrint} className="gap-2">
              <Printer size={16} /> Imprimir
            </Button>
            <Button variant="ghost" size="icon" onClick={() => onOpenChange(false)}>
              <X className="h-5 w-5" />
            </Button>
          </div>
        </DialogHeader>
        <div className="flex-1 overflow-y-auto">
          {certificateId ? (
            <div id={`certificate-content-${certificateId}`}> {/* Add ID for printing */}
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