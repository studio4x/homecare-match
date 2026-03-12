"use client";

import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import Layout from "@/components/layout/Layout";
import { useAuth } from "@/components/auth/AuthProvider";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { CheckCircle2, Loader2, MailCheck } from "lucide-react";

type UserRole = "professional" | "company" | "family";

const EmailConfirmed = () => {
  const { user, loading } = useAuth();
  const [role, setRole] = useState<UserRole>("professional");
  const [name, setName] = useState<string>("");
  const [loadingRole, setLoadingRole] = useState(true);

  useEffect(() => {
    let active = true;

    const resolveRole = async () => {
      if (!user) {
        if (active) {
          setLoadingRole(false);
        }
        return;
      }

      const metadataRole = String((user.user_metadata as any)?.role || "").toLowerCase();
      const metadataName = String((user.user_metadata as any)?.full_name || "").trim();
      if (active && metadataName) {
        setName(metadataName);
      }
      if (metadataRole === "company" || metadataRole === "family" || metadataRole === "professional") {
        if (active) setRole(metadataRole);
      }

      try {
        const { data } = await supabase
          .from("profiles")
          .select("role, full_name")
          .eq("id", user.id)
          .maybeSingle();

        if (!active) return;

        const dbRole = String(data?.role || "").toLowerCase();
        if (dbRole === "company" || dbRole === "family" || dbRole === "professional") {
          setRole(dbRole);
        }
        if (typeof data?.full_name === "string" && data.full_name.trim()) {
          setName(data.full_name.trim());
        }
      } finally {
        if (active) setLoadingRole(false);
      }
    };

    resolveRole();

    return () => {
      active = false;
    };
  }, [user]);

  const roleLabel = useMemo(() => {
    if (role === "company") return "Empresa";
    if (role === "family") return "Família";
    return "Profissional";
  }, [role]);

  const steps = useMemo(() => {
    const common = [
      "1) Complete seu perfil no Dashboard > Perfil.",
      "2) Envie/valide seus documentos para análise.",
    ];

    if (role === "company") {
      return [
        ...common,
        "3) Cadastre os pacientes que necessitam de profissionais.",
        "4) Busque profissionais para iniciar os contatos.",
      ];
    }

    if (role === "family") {
      return [
        ...common,
        "3) Insira as informações sobre o paciente.",
        "4) Busque profissionais para iniciar os contatos.",
      ];
    }

    return [
      ...common,
      "3) Mantenha-se conectado(a) na plataforma, e-mail ou WhatsApp para receber contatos de empresas e famílias.",
    ];
  }, [role]);

  if (loading || loadingRole) {
    return (
      <Layout>
        <div className="flex h-[60vh] items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      </Layout>
    );
  }

  if (!user) {
    return (
      <Layout>
        <div className="mx-auto flex min-h-[60vh] max-w-xl items-center px-4">
          <Card className="w-full">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <MailCheck className="h-5 w-5 text-primary" />
                E-mail confirmado
              </CardTitle>
              <CardDescription>
                Seu e-mail foi confirmado. Faça login para continuar a configuração da sua conta.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Button asChild className="w-full">
                <Link to="/login">Ir para Login</Link>
              </Button>
            </CardContent>
          </Card>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="mx-auto max-w-3xl px-4 py-10 md:py-16">
        <Card>
          <CardHeader className="space-y-3">
            <Badge className="w-fit bg-success/10 text-success border-success/30 hover:bg-success/10">
              <CheckCircle2 className="mr-1 h-3.5 w-3.5" />
              E-mail confirmado com sucesso
            </Badge>
            <CardTitle className="text-2xl md:text-3xl">
              {name ? `Tudo certo, ${name.split(" ")[0]}!` : "Tudo certo!"}
            </CardTitle>
            <CardDescription className="text-base">
              Sua conta está ativa. Agora siga estes próximos passos para concluir seu acesso na plataforma.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="rounded-lg border bg-secondary/30 p-4">
              <p className="text-sm font-medium">
                Tipo de perfil identificado: <span className="text-primary">{roleLabel}</span>
              </p>
            </div>

            <div className="space-y-3">
              {steps.map((step) => (
                <div key={step} className="rounded-lg border p-3 text-sm text-foreground">
                  {step}
                </div>
              ))}
            </div>

            <div className="flex flex-col gap-3 sm:flex-row">
              <Button asChild className="sm:flex-1">
                <Link to="/dashboard/perfil">Ir para Dashboard / Perfil</Link>
              </Button>
              <Button asChild variant="outline" className="sm:flex-1">
                <Link to="/dashboard">Abrir Dashboard</Link>
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </Layout>
  );
};

export default EmailConfirmed;
