"use client";

import { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { Loader2, Award, Printer, ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import CertificateDisplayContent from "@/components/CertificateDisplayContent"; // Import the new component
import { supabase } from "@/integrations/supabase/client"; // Import supabase

const CertificateView = () => {
  const { id } = useParams(); // Still use useParams for the page route
  const [loading, setLoading] = useState(true); // Keep loading state for initial fetch
  const [error, setError] = useState<string | null>(null); // Keep error state
  const [certificateExists, setCertificateExists] = useState(false); // To know if a certificate was found

  // This effect will only check if the certificate exists to decide what to render
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
        console.error("[CertificateView] Erro ao verificar existência:", e);
        setError(e.message || "Erro ao verificar o certificado.");
      } finally {
        setLoading(false);
      }
    };

    checkCertificateExistence();
  }, [id]);

  const handlePrint = () => window.print();

  if (loading) return (
    <div className="flex flex-col h-screen items-center justify-center gap-4">
      <Loader2 className="animate-spin h-8 w-8 text-primary" />
      <p className="text-sm text-muted-foreground">Carregando selo...</p>
    </div>
  );

  if (error || !certificateExists) return (
    <div className="flex flex-col h-screen items-center justify-center gap-4 p-6 text-center">
      <Award className="h-12 w-12 text-muted-foreground opacity-20" />
      <h2 className="text-xl font-bold">Selo não encontrado</h2>
      <p className="text-muted-foreground max-w-xs">O link acessado pode estar incorreto ou o selo foi removido.</p>
      <Button asChild variant="outline" className="mt-4">
        <Link to="/">Voltar para o Início</Link>
      </Button>
    </div>
  );

  return (
    <div className="min-h-screen bg-secondary/10 py-6 px-4 print:p-0 print:m-0 print:bg-white">
      <div className="mx-auto max-w-[1100px] space-y-6 print:max-w-none print:space-y-0">
        {/* Barra de Ações */}
        <div className="flex items-center justify-between print:hidden">
          <Button variant="ghost" asChild className="gap-2">
            <Link to="/dashboard/cursos"><ArrowLeft size={16} /> Voltar</Link>
          </Button>
          <div className="flex gap-2">
            <Button onClick={handlePrint} className="gap-2 bg-primary">
              <Printer size={16} /> Imprimir / Salvar PDF
            </Button>
          </div>
        </div>

        {/* O Selo - Container A4 Paisagem */}
        <div className="certificate-container relative w-full bg-white shadow-2xl border-[10mm] border-primary/10 p-8 md:p-12 flex flex-col items-center text-center overflow-hidden print:shadow-none print:border-primary/20 print:m-0 print:border-[10mm]">
          <CertificateDisplayContent certificateId={id!} /> {/* Render the content component */}
        </div>
      </div>

      <style dangerouslySetInnerHTML={{ __html: `
        @media screen {
          .certificate-container {
            aspect-ratio: 297 / 210;
            min-height: 550px;
          }
        }
        @media print {
          html, body { 
            margin: 0 !important; 
            padding: 0 !important; 
            height: 100%;
            background: white !important;
          }
          .print\\:hidden { display: none !important; }
          @page { 
            size: A4 landscape; 
            margin: 0; 
          }
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
        }
      `}} />
    </div>
  );
};

export default CertificateView;