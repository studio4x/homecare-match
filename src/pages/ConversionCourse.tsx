"use client";

import React, { useEffect } from "react";
import { Link, useSearchParams } from "react-router-dom";
import Layout from "@/components/layout/Layout";
import { Button } from "@/components/ui/button";
import { CheckCircle2, BookOpen, ArrowRight } from "lucide-react";
import { toast } from "sonner";

const ConversionCourse = () => {
  const [searchParams] = useSearchParams();
  const courseSlug = searchParams.get("courseSlug");
  const courseTitle = searchParams.get("courseTitle");

  useEffect(() => {
    // Aqui você pode adicionar scripts de rastreamento de conversão específicos para cursos.
    // Ex: gtag('event', 'purchase', { ... }); fbq('track', 'Purchase', { ... });
    // A lógica para isso será adicionada em MarketingScripts.tsx
    toast.success("Compra de curso confirmada!", {
      description: `Seu acesso ao curso "${courseTitle || 'selecionado'}" foi liberado.`,
      duration: 8000,
    });
  }, [courseSlug, courseTitle]);

  return (
    <Layout>
      <div className="container mx-auto px-4 py-12 text-center max-w-2xl">
        <div className="mx-auto mb-6 flex h-20 w-20 items-center justify-center rounded-full bg-success/10">
          <CheckCircle2 className="h-10 w-10 text-success" />
        </div>
        <h1 className="text-3xl font-bold text-foreground">Parabéns pela sua compra!</h1>
        <p className="mt-4 text-lg text-muted-foreground">
          Seu acesso ao curso <span className="font-semibold">{courseTitle || "selecionado"}</span> foi liberado com sucesso.
        </p>
        <div className="mt-8 flex flex-col sm:flex-row items-center justify-center gap-4">
          <Button asChild size="lg" className="gap-2">
            <Link to={courseSlug ? `/cursos/${courseSlug}` : "/dashboard/cursos"}>
              <BookOpen className="h-5 w-5" />
              Acessar o Curso
            </Link>
          </Button>
          <Button asChild variant="outline" size="lg" className="gap-2">
            <Link to="/dashboard">
              Ir para o Painel
              <ArrowRight className="h-5 w-5" />
            </Link>
          </Button>
        </div>
      </div>
    </Layout>
  );
};

export default ConversionCourse;