"use client";

import { useState, useEffect } from "react";
import { useSearchParams, useNavigate, Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import Layout from "@/components/layout/Layout";
import AuthForm from "@/components/auth/AuthForm";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Loader2, Award, CheckCircle2 } from "lucide-react";

const ReferralLanding = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const referrerId = searchParams.get("ref");
  
  const [referrer, setReferrer] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchReferrer = async () => {
      if (!referrerId) {
        setLoading(false);
        return;
      }

      try {
        const { data, error } = await supabase
          .from("profiles")
          .select("full_name, avatar_url, specialty")
          .eq("id", referrerId)
          .single();

        if (data) setReferrer(data);
      } catch (err) {
        console.error("Erro ao buscar indicador:", err);
      } finally {
        setLoading(false);
      }
    };

    fetchReferrer();
  }, [referrerId]);

  if (loading) {
    return (
      <Layout>
        <div className="flex h-[60vh] items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      </Layout>
    );
  }

  const initials = referrer?.full_name?.split(" ").map((n: any) => n[0]).join("").slice(0, 2).toUpperCase() || "??";

  return (
    <Layout>
      <div className="container mx-auto px-4 py-8 md:py-16">
        <div className="mx-auto max-w-4xl overflow-hidden rounded-3xl border border-border bg-card shadow-xl">
          <div className="grid md:grid-cols-2">
            {/* Coluna da Esquerda: Mensagem Personalizada */}
            <div className="bg-primary/5 p-8 md:p-12 flex flex-col justify-center border-r">
              <div className="mb-6 inline-flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10 text-primary">
                <Award className="h-6 w-6" />
              </div>
              
              {referrer ? (
                <div className="space-y-6">
                  <div className="flex items-center gap-4">
                    <Avatar className="h-16 w-16 ring-2 ring-primary/20">
                      <AvatarImage src={referrer.avatar_url} />
                      <AvatarFallback className="bg-primary/10 text-primary font-bold">{initials}</AvatarFallback>
                    </Avatar>
                    <div>
                      <p className="text-sm font-medium text-muted-foreground uppercase tracking-wider">Convite de</p>
                      <h2 className="text-xl font-bold text-foreground">{referrer.full_name}</h2>
                    </div>
                  </div>
                  
                  <h1 className="text-3xl font-bold leading-tight text-foreground">
                    Junte-se à maior rede de <span className="text-primary">Home Care</span> do Brasil
                  </h1>
                  
                  <p className="text-lg text-muted-foreground leading-relaxed">
                    Você foi convidado por um colega para fazer parte da nossa plataforma exclusiva para profissionais de saúde.
                  </p>
                  
                  <div className="space-y-3">
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <CheckCircle2 className="h-4 w-4 text-success" />
                      <span>Visibilidade para centenas de empresas</span>
                    </div>
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <CheckCircle2 className="h-4 w-4 text-success" />
                      <span>Contato direto via WhatsApp</span>
                    </div>
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <CheckCircle2 className="h-4 w-4 text-success" />
                      <span>Selo de verificação profissional</span>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="space-y-6">
                  <h1 className="text-3xl font-bold leading-tight text-foreground">
                    Sua carreira no <span className="text-primary">Home Care</span> começa aqui
                  </h1>
                  <p className="text-lg text-muted-foreground">
                    Crie seu perfil profissional e receba propostas diretamente das maiores empresas de saúde do país.
                  </p>
                </div>
              )}
            </div>

            {/* Coluna da Direita: Formulário de Registro */}
            <div className="p-8 md:p-12 bg-card">
              <div className="mb-8 text-center md:text-left">
                <h3 className="text-2xl font-bold">Crie sua conta agora</h3>
                <p className="text-muted-foreground mt-1">Leva menos de 2 minutos.</p>
              </div>
              
              <AuthForm mode="register" />
              
              <p className="mt-8 text-center text-sm text-muted-foreground">
                Já tem conta? <Link to="/login" className="font-semibold text-primary hover:underline">Faça login aqui</Link>
              </p>
            </div>
          </div>
        </div>
      </div>
    </Layout>
  );
};

export default ReferralLanding;