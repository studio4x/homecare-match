"use client";

import { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { Loader2, Award, Printer, ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import CertificateDisplayContent from "@/components/CertificateDisplayContent";
import { supabase } from "@/integrations/supabase/client";

const CertificateView = () => {
  const { id } = useParams();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [certificateExists, setCertificateExists] = useState(false);

  useEffect(() => {
    const checkCertificateExistence = async () => {
      if (!id) {
        setLoading(false);
        setError("ID do certificado ausente.");
        return;
      }

      try {
        const { data, error: fetchError } = await supabase
          .from("certificates")
          .select("id")
          .eq("id", id)
          .maybeSingle();

        if (fetchError) throw fetchError;
        setCertificateExists(!!data);
      } catch (e: any) {
        console.error("[CertificateView] Erro ao verificar existencia:", e);
        setError(e.message || "Erro ao verificar o certificado.");
      } finally {
        setLoading(false);
      }
    };

    checkCertificateExistence();
  }, [id]);

  const handlePrint = () => window.print();

  if (loading) {
    return (
      <div className="flex h-screen flex-col items-center justify-center gap-4">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
        <p className="text-sm text-muted-foreground">Carregando selo...</p>
      </div>
    );
  }

  if (error || !certificateExists) {
    return (
      <div className="flex h-screen flex-col items-center justify-center gap-4 p-6 text-center">
        <Award className="h-12 w-12 text-muted-foreground opacity-20" />
        <h2 className="text-xl font-bold">Selo nao encontrado</h2>
        <p className="max-w-xs text-muted-foreground">O link acessado pode estar incorreto ou o selo foi removido.</p>
        <Button asChild variant="outline" className="mt-4">
          <Link to="/">Voltar para o inicio</Link>
        </Button>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-secondary/10 px-4 py-6 print:m-0 print:bg-white print:p-0">
      <div className="mx-auto max-w-[1100px] space-y-6 print:max-w-none print:space-y-0">
        <div className="flex items-center justify-between print:hidden">
          <Button variant="ghost" asChild className="gap-2">
            <Link to="/dashboard/cursos">
              <ArrowLeft size={16} /> Voltar
            </Link>
          </Button>
          <Button onClick={handlePrint} className="gap-2 bg-primary">
            <Printer size={16} /> Imprimir / Salvar PDF
          </Button>
        </div>

        <div className="certificate-print-area">
          <div className="certificate-container relative w-full overflow-hidden border-2 border-primary/10 bg-white shadow-2xl sm:border-4 md:border-8 print:m-0 print:border-[10mm] print:border-primary/20 print:shadow-none">
            <CertificateDisplayContent certificateId={id!} />
          </div>
        </div>
      </div>

      <style
        dangerouslySetInnerHTML={{
          __html: `
            @media screen {
              .certificate-print-area {
                width: 100%;
              }

              .certificate-container {
                width: 100%;
                min-height: 0;
              }
            }

            @media screen and (min-width: 640px) {
              .certificate-container {
                aspect-ratio: 297 / 210;
              }
            }

            @media screen and (max-width: 639px) {
              .certificate-container {
                aspect-ratio: auto;
              }
            }

            @media print {
              @page {
                size: A4 landscape;
                margin: 0;
              }

              html,
              body {
                margin: 0 !important;
                padding: 0 !important;
                width: 297mm !important;
                height: 210mm !important;
                overflow: hidden !important;
                background: #fff !important;
              }

              .print\\:hidden {
                display: none !important;
              }

              body * {
                visibility: hidden !important;
              }

              .certificate-print-area,
              .certificate-print-area * {
                visibility: visible !important;
              }

              .certificate-print-area {
                position: fixed !important;
                inset: 0 !important;
                width: 297mm !important;
                height: 210mm !important;
                margin: 0 !important;
                padding: 0 !important;
              }

              .certificate-container {
                position: relative !important;
                inset: 0 !important;
                width: 100% !important;
                height: 100% !important;
                aspect-ratio: auto !important;
                margin: 0 !important;
                padding: 0 !important;
                box-sizing: border-box !important;
                border-width: 10mm !important;
                overflow: hidden !important;
                page-break-inside: avoid;
              }

              .certificate-content {
                padding: 8mm !important;
              }

              * {
                -webkit-print-color-adjust: exact !important;
                print-color-adjust: exact !important;
              }
            }

            @media print and (orientation: portrait) {
              .certificate-print-area {
                width: 210mm !important;
                height: 297mm !important;
              }

              .certificate-container {
                width: 297mm !important;
                height: 210mm !important;
                transform-origin: top left !important;
                transform: translateY(297mm) rotate(-90deg) !important;
              }
            }
          `,
        }}
      />
    </div>
  );
};

export default CertificateView;
