"use client";

import { useEffect, useRef, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { Loader2, Award, Printer, ArrowLeft, Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import CertificateDisplayContent from "@/components/CertificateDisplayContent";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

const CertificateView = () => {
  const { id } = useParams();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [certificateExists, setCertificateExists] = useState(false);
  const [isGeneratingPdf, setIsGeneratingPdf] = useState(false);
  const certificateExportRef = useRef<HTMLDivElement | null>(null);

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

  const handleDownloadPdf = async () => {
    if (!certificateExportRef.current || !id) return;

    setIsGeneratingPdf(true);
    const toastId = toast.loading("Gerando PDF em paisagem...");
    let clonedNode: HTMLDivElement | null = null;

    try {
      const [{ default: html2canvas }, { jsPDF }] = await Promise.all([
        import("html2canvas"),
        import("jspdf"),
      ]);

      clonedNode = certificateExportRef.current.cloneNode(true) as HTMLDivElement;
      clonedNode.classList.add("pdf-export-force");
      clonedNode.style.position = "fixed";
      clonedNode.style.left = "-100000px";
      clonedNode.style.top = "0";
      clonedNode.style.margin = "0";
      clonedNode.style.boxShadow = "none";
      clonedNode.style.zIndex = "-1";
      document.body.appendChild(clonedNode);

      const canvas = await html2canvas(clonedNode, {
        backgroundColor: "#ffffff",
        scale: 2,
        useCORS: true,
        logging: false,
        allowTaint: true,
      });

      const imageData = canvas.toDataURL("image/jpeg", 0.98);
      const pdf = new jsPDF({
        orientation: "landscape",
        unit: "mm",
        format: "a4",
        compress: true,
      });

      const pageWidth = 297;
      const pageHeight = 210;
      const imageProps = pdf.getImageProperties(imageData);

      let renderWidth = pageWidth;
      let renderHeight = (imageProps.height * renderWidth) / imageProps.width;

      if (renderHeight > pageHeight) {
        renderHeight = pageHeight;
        renderWidth = (imageProps.width * renderHeight) / imageProps.height;
      }

      const offsetX = (pageWidth - renderWidth) / 2;
      const offsetY = (pageHeight - renderHeight) / 2;

      pdf.addImage(imageData, "JPEG", offsetX, offsetY, renderWidth, renderHeight, undefined, "FAST");
      pdf.save(`selo-${id}.pdf`);
      toast.success("PDF gerado com sucesso.", { id: toastId });
    } catch (err) {
      console.error("[CertificateView] Erro ao gerar PDF:", err);
      toast.error("Nao foi possivel gerar o PDF agora.", { id: toastId });
    } finally {
      setIsGeneratingPdf(false);
      if (clonedNode && clonedNode.parentNode) {
        clonedNode.parentNode.removeChild(clonedNode);
      }
    }
  };

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
          <div className="flex gap-2">
            <Button onClick={handleDownloadPdf} variant="outline" className="gap-2" disabled={isGeneratingPdf}>
              {isGeneratingPdf ? <Loader2 size={16} className="animate-spin" /> : <Download size={16} />}
              Baixar PDF
            </Button>
            <Button onClick={handlePrint} className="hidden gap-2 bg-primary sm:inline-flex">
              <Printer size={16} /> Imprimir / Salvar PDF
            </Button>
          </div>
        </div>

        <div className="certificate-print-area">
          <div
            ref={certificateExportRef}
            className="certificate-container relative w-full overflow-hidden border-2 border-primary/10 bg-white shadow-2xl sm:border-4 md:border-8 print:m-0 print:border-[10mm] print:border-primary/20 print:shadow-none"
          >
            <CertificateDisplayContent certificateId={id!} />
          </div>
        </div>
      </div>

      <style
        dangerouslySetInnerHTML={{
          __html: `
            @media screen {
              .pdf-export-force {
                width: 297mm !important;
                height: 210mm !important;
                aspect-ratio: auto !important;
                border-width: 10mm !important;
                overflow: hidden !important;
              }

              .pdf-export-force .certificate-content {
                padding: 8mm !important;
                height: 100% !important;
                min-height: 0 !important;
                display: flex !important;
                flex-direction: column !important;
                justify-content: space-between !important;
              }

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
                height: 100% !important;
                min-height: 0 !important;
                display: flex !important;
                flex-direction: column !important;
                justify-content: space-between !important;
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
