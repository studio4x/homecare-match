"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Loader2, Award, Calendar, Clock, User, Info, AlertTriangle, ShieldCheck } from "lucide-react";
import { useSiteConfig } from "@/hooks/use-site-config";
import { cn } from "@/lib/utils";

interface CertificateDisplayContentProps {
  certificateId: string;
}

const CertificateDisplayContent = ({ certificateId }: CertificateDisplayContentProps) => {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { data: config } = useSiteConfig();

  const fetchCertificate = async () => {
    setLoading(true);
    setError(null);
    try {
      const { data: cert, error: fetchError } = await supabase
        .from("certificates")
        .select(`
          *,
          course:academy_courses(title, level, duration_minutes, slug),
          user:profiles(id, full_name, registration)
        `)
        .eq("id", certificateId)
        .maybeSingle();

      if (fetchError) throw fetchError;

      if (!cert) {
        setError("Selo não encontrado.");
        return;
      }

      setData(cert);
    } catch (e: any) {
      console.error("[CertificateDisplayContent] Erro ao buscar:", e);
      setError(e.message || "Erro ao carregar o selo.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (certificateId) fetchCertificate();
  }, [certificateId]);

  const formatWorkload = (minutes: number) => {
    if (!minutes || minutes <= 0) return "—";
    const h = Math.floor(minutes / 60);
    const m = minutes % 60;
    if (h > 0 && m > 0) return `${h}h ${m}min`;
    if (h > 0) return `${h} ${h === 1 ? 'hora' : 'horas'}`;
    return `${m} minutos`;
  };

  if (loading) return (
    <div className="flex flex-col items-center justify-center gap-4 p-8">
      <Loader2 className="animate-spin h-8 w-8 text-primary" />
      <p className="text-sm text-muted-foreground">Carregando selo...</p>
    </div>
  );

  if (error) return (
    <div className="flex flex-col items-center justify-center gap-4 p-8 text-center">
      <AlertTriangle className="h-12 w-12 text-destructive opacity-50" />
      <h2 className="text-xl font-bold">Erro ao carregar selo</h2>
      <p className="text-muted-foreground max-w-xs">{error}</p>
    </div>
  );

  if (!data) return (
    <div className="flex flex-col items-center justify-center gap-4 p-8 text-center">
      <Award className="h-12 w-12 text-muted-foreground opacity-20" />
      <h2 className="text-xl font-bold">Selo não encontrado</h2>
      <p className="text-muted-foreground max-w-xs">O código de validação não corresponde a nenhum selo.</p>
    </div>
  );

  const issueDate = new Date(data.issued_at).toLocaleDateString('pt-BR', {
    day: '2-digit', month: 'long', year: 'numeric'
  });

  const workloadMinutes = data.workload_minutes || data.course?.duration_minutes || 0;
  const isCorrupted = data.validation_code?.includes("${"); // Check for corrupted code

  return (
    <div className="certificate-content relative w-full bg-white p-8 md:p-12 flex flex-col items-center text-center overflow-hidden">
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
            {isCorrupted ? "PROCESSANDO..." : data.validation_code}
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
  );
};

export default CertificateDisplayContent;