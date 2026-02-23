"use client";

import React, { useEffect } from "react";
import { Link, useSearchParams } from "react-router-dom";
import Layout from "@/components/layout/Layout";
import { Button } from "@/components/ui/button";
import { CheckCircle2, Zap, ArrowRight } from "lucide-react";
import { toast } from "sonner";

const ConversionSubscription = () => {
  const [searchParams] = useSearchParams();
  const planId = searchParams.get("planId");
  const planName = searchParams.get("planName");

  useEffect(() => {
    // Aqui você pode adicionar scripts de rastreamento de conversão específicos para assinaturas.
    // Ex: gtag('event', 'purchase', { ... }); fbq('track', 'Purchase', { ... });
    // A lógica para isso será adicionada em MarketingScripts.tsx
    toast.success("Assinatura confirmada!", {
      description: `Seu plano "${planName || 'selecionado'}" foi ativado com sucesso.`,
      duration: 8000,
    });
  }, [planId, planName]);

  return (
    <Layout>
      <div className="container mx-auto px-4 py-12 text-center max-w-2xl">
        <div className="mx-auto mb-6 flex h-20 w-20 items-center justify-center rounded-full bg-success/10">
          <CheckCircle2 className="h-10 w-10 text-success" />
        </div>
        <h1 className="text-3xl font-bold text-foreground">Sua assinatura foi ativada!</h1>
        <p className="mt-4 text-lg text-muted-foreground">
          Parabéns! Seu plano <span className="font-semibold">{planName || "selecionado"}</span> já está ativo.
        </p>
        <div className="mt-8 flex flex-col sm:flex-row items-center justify-center gap-4">
          <Button asChild size="lg" className="gap-2">
            <Link to="/dashboard">
              <Zap className="h-5 w-5" />
              Ir para o Painel
            </Link>
          </Button>
          <Button asChild variant="outline" size="lg" className="gap-2">
            <Link to="/dashboard/pagamentos">
              Ver Histórico de Pagamentos
              <ArrowRight className="h-5 w-5" />
            </Link>
          </Button>
        </div>
      </div>
    </Layout>
  );
};

export default ConversionSubscription;