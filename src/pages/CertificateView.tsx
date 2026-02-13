"use client";

import { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Loader2, Award, Printer, ArrowLeft, ShieldCheck, Calendar, Clock, Info, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useSiteConfig } from "@/hooks/use-site-config";
import { useAuth } from "@/components/auth/AuthProvider";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

const CertificateView = () => {
  const { id } = useParams();
  const { session } = useAuth();
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [isFixing, setIsFixing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { data: config } = useSiteConfig();

  const fetchCertificate = async () => {
    try {
      setError(null);
      const { data: cert, error: fetchError } = await supabase
        .from("certificates")
        .select(`
          *,
          course:academy_courses(title, level, duration_minutes, slug),
          user:profiles(full_name, registration)
        `)
        .eq("id", id)
        .maybeSingle();

      if (fetchError) throw fetchError;

      if (!cert) {
        setLoading(false);
        return;
      }

      // Lógica de Auto-Correção: Só tenta se o código estiver corrompido E o usuário estiver logado
      if (cert.validation_code && cert.validation_code.includes("${") && session) {
        console.log("[CertificateView] Detectado código corrompido. Iniciando correção...");
        await fixCertificate(cert.course.slug, cert);
        return; 
      }

      setData(cert);
    } catch (e: any) {
      console.error("[CertificateView] Erro ao buscar:", e);
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  const fixCertificate = async (courseSlug: string, currentData: any) => {
    setIsFixing(true);
    try {
      const { error: invokeError } = await supabase.functions.invoke('issue-certificate', {
        body: { course_slug: courseSlug }
      });
      
      if (invokeError) throw invokeError;
      
      // Recarrega os dados agora corrigidos
      await fetchCertificate();
    } catch (err) {
      console.error("[CertificateView] Falha ao auto-corrigir:", err);
      // Se falhar a correção (ex: permissão), mostra o que tem
      setData(currentData);
      setLoading(false);
    } finally {
      setIsFixing(false);
    }
  };

  useEffect(() => {
    if (id) fetchCertificate();
  }, [id, session]);

  const handlePrint = () => window.print();

  if (loading || isFixing) return (
    <div className="flex flex-col h-screen items-center justify-center gap-4">
      <Loader2 className="animate-spin h-8 w-8 text-primary" />
      {isFixing && <p className="text-sm text-muted-foreground animate-pulse">Atualizando informações do selo...</p>}
    </div>
  );

  if (error) return (
    <div className="flex flex-col h-screen items-center justify-center gap-4 p-6 text-center">
      <AlertTriangle className="h-12 w-12 text-destructive opacity-50" />
      <h2 className="text-xl font-bold">Erro ao carregar selo</h2>
      <p className="text-muted-foreground max-w-xs">{error}</p>
      <Button variant="outline" onClick={() => window.location.reload()}>Tentar Novamente</Button>
    </div>
  );

  if (!data) return (
    <div className="flex flex-col h-screen items-center justify-center gap-4 p-6 text-center">
      <Award className="h-12 w-12 text-muted-foreground opacity-20" />
      <h2 className="text-xl font-bold">Selo não encontrado</h2>
      <p className="text-muted-foreground max-w-xs">O link acessado pode estar incorreto ou o selo foi removido.</p>
      <Button asChild variant="outline" className="mt-4">
        <Link to="/">Voltar para o Início</Link>
      </Button>
    </div>
  );

  const issueDate = new Date(data.issued_at).toLocaleDateString('pt-BR', {
    day: '2-digit', month: 'long', year: 'numeric'
  });

  const workloadMinutes = data.workload_minutes || data.course?.duration_minutes || 0;

  const formatWorkload = (minutes: number) => {
    const h = Math.floor(minutes / 60);
    const m = minutes % 60;
    if (h > 0 && m > 0) return `${h}h ${m}min`;
    if (h > 0) return `${h} ${h === 1 ? 'hora' : 'horas'}`;
    return `${m} minutos`;
  };

  const isCorrupted = data.validation_code?.includes("${");

  return (
    <div className="min-h-screen bg-secondary/10 py-6 px-4 print:p-0 print:m-0 print:bg-white">
      <div className="mx-auto max-w-[1100px] space-y-6 print:max-w-none print:space-y-0">
        {/* Barra de Ações */}
        <div className="flex items-center justify-between print:hidden">
          <Button variant="ghost" asChild className="gap-2">
            <Link to="/dashboard/cursos"><ArrowLeft size={16} /> Voltar</Link>
          </Button>
          <div className="flex gap-2">
            {isCorrupted && !session && (
              <Badge variant="outline" className="bg-amber-50 text-amber-700 border-amber-200 hidden md:flex">
                Aguardando atualização do proprietário
              </Badge>
            )}
            <Button onClick={handlePrint} className="gap-2 bg-primary" disabled={isCorrupted}>
              <Printer size={16} /> Imprimir / Salvar PDF
            </Button>
          </div>
        </div>

        {/* O Selo - Container A4 Paisagem */}
        <div className="certificate-container relative w-full bg-white shadow-2xl border-[10mm] border-primary/10 p-8 md:p-12 flex flex-col items-center text-center overflow-hidden print:shadow-none print:border-primary/20 print:m-0 print:border-[10mm]">
          
          <Award className="absolute -top-10 -right-10 h-48 w-48 md:h-64 md:w-64 text-primary/5 rotate-12 pointer-events-none" />
          <Award className="absolute -bottom-10 -left-10 h-48 w-48 md:h-64 md:w-64 text-primary/5 -rotate-12 pointer-events-none" />

          <div className="mb-4 md:mb-6">
            <img src={config?.logo_url || ""} alt="Logo" className="h-10 md:h-14 mx-auto mb-2 object-contain" />
            <div className="h-0.5 w-16 md:w-20 bg-primary mx-auto rounded-full" />
          </div>

          <h1 className="text-2xl md:text-4xl font-serif font-bold text-slate-800 mb-1 uppercase tracking-widest">Selo de Conclusão</h1>
          <p className="text-primary font-semibold tracking-[0.2em] mb-6 md:mb-8 uppercase text-[10px] md:text-xs">Conquista Academy</p>

          <p className="text-sm md:text-lg text-slate-600 mb-1">Reconhecemos que o(a) profissional</p>
          <h2 className="text-xl md:text-3xl font-bold text-slate-900 mb-1 border-b-2 border-slate-200 px-4 md:px-8 pb-1 inline-block">
            {data.user?.full_name || "Profissional"}
          </h2>
          
          <div className="max-w-3xl w-full flex-1 flex flex-col justify-center">
            <p className="text-sm md:text-base text-slate-600 leading-relaxed">
              concluiu com aproveitamento o conteúdo educativo de
            </p>
            <h3 className="text-lg md:text-xl font-bold text-primary mt-1 mb-4 md:mb-6 uppercase leading-tight">
              {data.course?.title || "Curso"}
            </h3>
            
            <div className="flex items-center justify-center gap-4 md:gap-10 py-3 px-6 md:px-8 bg-secondary/30 rounded-xl border border-slate-200 mb-4 print:bg-slate-50">
              <div className="flex items-center gap-2 text-slate-700">
                <Calendar className="h-4 w-4 md:h-5 md:w-5 text-primary shrink-0" />
                <div className="text-left">
                  <p className="text-[8px] uppercase font-bold text-slate-400 leading-none mb-0.5">Concluído em</p>
                  <p className="font-semibold text-xs md:text-sm">{issueDate}</p>
                </div>
              </div>
              <div className="h-8 w-px bg-slate-300" />
              <div className="flex items-center gap-2 text-slate-700">
                <Clock className="h-4 w-4 md:h-5 md:w-5 text-primary shrink-0" />
                <div className="text-left">
                  <p className="text-[8px] uppercase font-bold text-slate-400 leading-none mb-0.5">Carga Horária</p>
                  <p className="font-semibold text-xs md:text-sm">{formatWorkload(workloadMinutes)}</p>
                </div>
              </div>
            </div>

            {/* Disclaimer Legal */}
            <div className="max-w-2xl mx-auto p-3 bg-slate-50 border rounded-lg flex gap-3 items-start text-left mb-4">
              <Info className="h-4 w-4 text-slate-400 shrink-0 mt-0.5" />
              <p className="text-[8px] md:text-[9px] text-slate-500 leading-tight">
                <strong>AVISO LEGAL:</strong> Este documento é um registro de participação e aproveitamento em conteúdo educativo digital interno da plataforma <strong>HomeCare Match</strong>. Este selo não possui validade como título acadêmico, técnico ou profissional perante órgãos reguladores, universidades ou conselhos de classe (MEC, COREN, CREFITO, etc). Sua finalidade é exclusivamente para destaque de perfil dentro do ecossistema HomeCare Match.
              </p>
            </div>
          </div>

          <div className="w-full flex flex-row items-end justify-between gap-4 pt-4 border-t border-slate-100">
            <div className="text-left space-y-1">
              <p className="text-[8px] text-slate-400 font-mono uppercase tracking-tighter">Código de Validação:</p>
              <p className={cn(
                "text-[10px] font-mono font-bold px-2 py-0.5 rounded print:bg-slate-100",
                isCorrupted ? "text-amber-600 bg-amber-50" : "text-slate-700 bg-secondary/50"
              )}>
                {isCorrupted ? "AGUARDANDO ATUALIZAÇÃO" : data.validation_code}
              </p>
              <p className="text-[7px] text-slate-400">Valide em: homecarematch.com.br/validar</p>
            </div>

            <div className="flex flex-col items-center">
              <div className="flex items-center gap-1.5 text-success mb-1">
                <ShieldCheck size={18} className="shrink-0" />
                <span className="font-bold text-[9px] uppercase tracking-tighter">Plataforma HomeCare Match</span>
              </div>
              <div className="h-px w-32 md:w-40 bg-slate-300 mb-0.5" />
              <p className="text-[9px] text-slate-500">Registro de Conquista Academy</p>
            </div>
          </div>
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