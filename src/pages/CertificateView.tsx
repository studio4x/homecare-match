"use client";

import { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Loader2, Award, Printer, ArrowLeft, ShieldCheck, Calendar, Clock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useSiteConfig } from "@/hooks/use-site-config";

const CertificateView = () => {
  const { id } = useParams();
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const { data: config } = useSiteConfig();

  useEffect(() => {
    const fetchCertificate = async () => {
      try {
        const { data: cert, error } = await supabase
          .from("certificates")
          .select(`
            *,
            course:academy_courses(title, level),
            user:profiles(full_name, registration)
          `)
          .eq("id", id)
          .single();

        if (error) throw error;
        setData(cert);
      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
      }
    };
    fetchCertificate();
  }, [id]);

  const handlePrint = () => window.print();

  if (loading) return <div className="flex h-screen items-center justify-center"><Loader2 className="animate-spin" /></div>;
  if (!data) return <div className="text-center p-20">Certificado não encontrado.</div>;

  const issueDate = new Date(data.issued_at).toLocaleDateString('pt-BR', {
    day: '2-digit', month: 'long', year: 'numeric'
  });

  const formatWorkload = (minutes: number) => {
    const h = Math.floor(minutes / 60);
    const m = minutes % 60;
    if (h > 0 && m > 0) return `${h}h ${m}min`;
    if (h > 0) return `${h} ${h === 1 ? 'hora' : 'horas'}`;
    return `${m} minutos`;
  };

  return (
    <div className="min-h-screen bg-secondary/10 py-10 px-4 print:p-0 print:bg-white">
      <div className="mx-auto max-w-4xl space-y-6">
        {/* Barra de Ações (Oculta na impressão) */}
        <div className="flex items-center justify-between print:hidden">
          <Button variant="ghost" asChild className="gap-2">
            <Link to="/dashboard/cursos"><ArrowLeft size={16} /> Voltar</Link>
          </Button>
          <Button onClick={handlePrint} className="gap-2 bg-primary">
            <Printer size={16} /> Imprimir / Salvar PDF
          </Button>
        </div>

        {/* O Certificado */}
        <div className="relative aspect-[1.414/1] w-full bg-white shadow-2xl border-[16px] border-primary/10 p-12 flex flex-col items-center text-center overflow-hidden print:shadow-none print:border-primary/20">
          {/* Decoração de Fundo */}
          <Award className="absolute -top-10 -right-10 h-64 w-64 text-primary/5 rotate-12" />
          <Award className="absolute -bottom-10 -left-10 h-64 w-64 text-primary/5 -rotate-12" />

          {/* Cabeçalho */}
          <div className="mb-8">
            <img src={config?.logo_url || ""} alt="Logo" className="h-16 mx-auto mb-4 object-contain" />
            <div className="h-1 w-24 bg-primary mx-auto rounded-full" />
          </div>

          <h1 className="text-5xl font-serif font-bold text-slate-800 mb-2 uppercase tracking-widest">Certificado</h1>
          <p className="text-primary font-semibold tracking-[0.2em] mb-12 uppercase">de Conclusão de Curso</p>

          <p className="text-xl text-slate-600 mb-2">Certificamos para os devidos fins que</p>
          <h2 className="text-4xl font-bold text-slate-900 mb-2 border-b-2 border-slate-200 px-8 pb-2 inline-block">
            {data.user.full_name}
          </h2>
          {data.user.registration && <p className="text-slate-500 mb-8 italic">Registro Profissional: {data.user.registration}</p>}

          <div className="max-w-2xl">
            <p className="text-lg text-slate-600 leading-relaxed">
              concluiu com êxito o curso de capacitação profissional em
            </p>
            <h3 className="text-2xl font-bold text-primary mt-2 mb-8 uppercase">
              {data.course.title}
            </h3>
            
            {/* Box de Informações Destacadas */}
            <div className="flex items-center justify-center gap-8 py-4 px-8 bg-secondary/30 rounded-2xl border border-slate-200 mb-8">
              <div className="flex items-center gap-2 text-slate-700">
                <Calendar className="h-5 w-5 text-primary" />
                <div className="text-left">
                  <p className="text-[10px] uppercase font-bold text-slate-400 leading-none mb-1">Concluído em</p>
                  <p className="font-semibold">{issueDate}</p>
                </div>
              </div>
              <div className="h-8 w-px bg-slate-300" />
              <div className="flex items-center gap-2 text-slate-700">
                <Clock className="h-5 w-5 text-primary" />
                <div className="text-left">
                  <p className="text-[10px] uppercase font-bold text-slate-400 leading-none mb-1">Carga Horária</p>
                  <p className="font-semibold">{formatWorkload(data.workload_minutes)}</p>
                </div>
              </div>
            </div>

            <p className="text-sm text-slate-500">
              Curso realizado integralmente na plataforma <strong>HomeCare Match</strong>.
            </p>
          </div>

          {/* Assinatura e Selo */}
          <div className="mt-auto w-full flex items-end justify-between pt-12">
            <div className="text-left space-y-1">
              <p className="text-[10px] text-slate-400 font-mono">Código de Validação:</p>
              <p className="text-xs font-mono font-bold text-slate-700 bg-secondary/50 px-2 py-1 rounded">
                {data.validation_code}
              </p>
              <p className="text-[9px] text-slate-400">Verifique a autenticidade em homecarematch.com.br/validar</p>
            </div>

            <div className="flex flex-col items-center">
              <div className="flex items-center gap-2 text-success mb-2">
                <ShieldCheck size={24} />
                <span className="font-bold text-xs uppercase tracking-tighter">Plataforma Verificada</span>
              </div>
              <div className="h-px w-48 bg-slate-300 mb-1" />
              <p className="text-xs text-slate-500">Diretoria HomeCare Match</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default CertificateView;