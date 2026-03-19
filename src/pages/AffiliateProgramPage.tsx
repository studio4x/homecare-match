"use client";

import { FormEvent, useEffect, useRef, useState } from "react";
import Layout from "@/components/layout/Layout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Loader2, Megaphone, Repeat, Wallet } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

const AFFILIATE_TERMS_VERSION = "2026-03-19-v1";
const AFFILIATE_TERMS_LAST_UPDATE = "19/03/2026";

const affiliateTermsSections = [
  {
    title: "1. Objeto",
    paragraphs: [
      "Este termo regula a participação no Programa de Afiliados da Home Care Match para divulgação da plataforma e captação de novos profissionais.",
      "A participação no programa não cria vínculo trabalhista, societário, de representação comercial exclusiva ou de franquia.",
    ],
  },
  {
    title: "2. Elegibilidade",
    paragraphs: [
      "O cadastro de afiliado é destinado a parceiros dedicados. Contas profissionais da plataforma seguem regras próprias no sistema de indicações.",
      "A Home Care Match pode aprovar, reprovar, suspender ou encerrar participação no programa, com base em critérios operacionais, legais e antifraude.",
    ],
  },
  {
    title: "3. Regras de atribuição",
    paragraphs: [
      "A atribuição de indicados segue regra de primeiro afiliado (first-touch) e permanece imutável após atribuída, conforme configuração vigente do programa.",
      "Não há retroatividade para cadastros anteriores à ativação do módulo de afiliados.",
    ],
  },
  {
    title: "4. Comissões e apuração",
    paragraphs: [
      "No modelo atual, o afiliado recebe bônus fixo por marco de cadastros completos validados e comissão recorrente sobre pagamentos válidos do indicado, conforme configuração ativa no admin.",
      "Valores, percentuais, gatilhos e critérios de validação podem ser atualizados pela Home Care Match para novos ciclos de apuração.",
    ],
  },
  {
    title: "5. Pagamento",
    paragraphs: [
      "O pagamento é realizado por lote manual, em ciclo mensal, observando valor mínimo de saque e chave PIX válida cadastrada.",
      "Valores podem permanecer em status de sombra, pendente, disponível, reservado ou pago, conforme etapas operacionais do programa.",
    ],
  },
  {
    title: "6. Estornos, cancelamentos e clawback",
    paragraphs: [
      "Pagamentos estornados, cancelados, contestados ou invalidados podem gerar ajuste negativo no extrato do afiliado (clawback), inclusive após créditos anteriores.",
      "A Home Care Match pode compensar ajustes negativos em créditos futuros, observando controles de auditoria do ledger.",
    ],
  },
  {
    title: "7. Condutas proibidas",
    paragraphs: [
      "É proibido auto-indicação, fraude, uso de identidades de terceiros, spam, publicidade enganosa, promessa de resultado garantido ou uso indevido de marca.",
      "Violações podem resultar em bloqueio de atribuições, estorno de comissões, suspensão do parceiro e medidas legais cabíveis.",
    ],
  },
  {
    title: "8. Responsabilidades do afiliado",
    paragraphs: [
      "O afiliado é responsável pelas informações enviadas no cadastro, pela manutenção de dados de pagamento atualizados e pelo cumprimento da legislação aplicável em suas ações de divulgação.",
      "O afiliado deve manter postura ética e comunicar de forma clara que atua como parceiro de divulgação da plataforma.",
    ],
  },
  {
    title: "9. Privacidade e dados",
    paragraphs: [
      "A Home Care Match trata dados pessoais conforme legislação aplicável e sua política de privacidade.",
      "Dados de cadastro e operação do afiliado podem ser usados para análise de risco, auditoria, prevenção a fraude, suporte e obrigações legais.",
    ],
  },
  {
    title: "10. Vigência e alterações",
    paragraphs: [
      "Este termo vigora a partir do aceite e permanece válido enquanto o afiliado participar do programa.",
      "A Home Care Match pode alterar este termo e regras do programa. Novas condições passam a valer na versão publicada.",
    ],
  },
];

const AffiliateProgramPage = () => {
  const emailValidationRequestIdRef = useRef(0);
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [city, setCity] = useState("");
  const [state, setState] = useState("");
  const [pixKeyType, setPixKeyType] = useState("random");
  const [pixKey, setPixKey] = useState("");
  const [audience, setAudience] = useState("");
  const [experience, setExperience] = useState("");
  const [message, setMessage] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [termsOpen, setTermsOpen] = useState(false);
  const [acceptedTerms, setAcceptedTerms] = useState(false);
  const [emailValidationStatus, setEmailValidationStatus] = useState<"idle" | "invalid" | "checking" | "available" | "unavailable">("idle");
  const [emailValidationMessage, setEmailValidationMessage] = useState("");

  const normalizeEmail = (value: string) => value.trim().toLowerCase();
  const isValidEmail = (value: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);

  useEffect(() => {
    const normalizedEmail = normalizeEmail(email);

    if (!normalizedEmail) {
      setEmailValidationStatus("idle");
      setEmailValidationMessage("");
      return;
    }

    if (!isValidEmail(normalizedEmail)) {
      setEmailValidationStatus("invalid");
      setEmailValidationMessage("Digite um e-mail válido.");
      return;
    }

    const requestId = emailValidationRequestIdRef.current + 1;
    emailValidationRequestIdRef.current = requestId;
    setEmailValidationStatus("checking");
    setEmailValidationMessage("Validando disponibilidade...");

    const timer = setTimeout(async () => {
      try {
        const { data, error } = await supabase.functions.invoke("affiliate-check-email", {
          body: { email: normalizedEmail },
        });

        if (requestId !== emailValidationRequestIdRef.current) return;
        if (error) throw error;

        if (data?.available === true) {
          setEmailValidationStatus("available");
          setEmailValidationMessage(data?.message || "E-mail aceito para utilização.");
          return;
        }

        setEmailValidationStatus("unavailable");
        setEmailValidationMessage(data?.message || "Este e-mail já possui cadastro.");
      } catch (_error) {
        if (requestId !== emailValidationRequestIdRef.current) return;
        setEmailValidationStatus("idle");
        setEmailValidationMessage("");
      }
    }, 450);

    return () => clearTimeout(timer);
  }, [email]);

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    const normalizedEmail = normalizeEmail(email);

    if (!isValidEmail(normalizedEmail)) {
      toast.error("Digite um e-mail válido.");
      return;
    }

    if (emailValidationStatus === "checking") {
      toast.error("Aguarde a validação do e-mail antes de enviar.");
      return;
    }

    if (emailValidationStatus === "unavailable") {
      toast.error(emailValidationMessage || "Este e-mail já possui cadastro.");
      return;
    }

    if (!acceptedTerms) {
      toast.error("Você precisa aceitar o Termo e Condições para continuar.");
      return;
    }

    setIsSubmitting(true);

    try {
      const { data, error } = await supabase.functions.invoke("affiliate-register-interest", {
        body: {
          full_name: fullName,
          email: normalizedEmail,
          phone,
          city,
          state,
          pix_key_type: pixKeyType || null,
          pix_key: pixKey || null,
          audience,
          experience,
          message,
          terms_accepted: true,
          terms_version: AFFILIATE_TERMS_VERSION,
        },
      });

      if (error) throw error;

      toast.success(data?.message || "Cadastro recebido com sucesso.");

      if (!data?.already_exists) {
        setFullName("");
        setEmail("");
        setPhone("");
        setCity("");
        setState("");
        setPixKeyType("random");
        setPixKey("");
        setAudience("");
        setExperience("");
        setMessage("");
        setAcceptedTerms(false);
      }
    } catch (error: any) {
      toast.error(error?.message || "Erro ao enviar candidatura de afiliado.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Layout>
      <div className="container mx-auto max-w-6xl px-4 py-12 space-y-8">
        <div className="rounded-3xl border bg-gradient-to-br from-primary/10 via-background to-emerald-50 p-6 md:p-10">
          <h1 className="text-3xl md:text-4xl font-bold">Programa de Afiliados Home Care Match</h1>
          <p className="mt-3 text-muted-foreground max-w-3xl">
            Divulgue a plataforma, traga novos profissionais e receba comissões de acordo com o desempenho.
            Este programa é separado do sistema de indicações de profissionais.
          </p>
          <div className="mt-4 flex flex-wrap gap-2">
            <Badge variant="outline">Bônus de R$ 50 a cada 10 cadastros completos</Badge>
            <Badge variant="outline">10% recorrente enquanto ativo</Badge>
            <Badge variant="outline">Payout mensal mínimo de R$ 100</Badge>
          </div>
        </div>

        <div className="grid gap-6 lg:grid-cols-3">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg"><Megaphone className="h-5 w-5" /> Como funciona</CardTitle>
            </CardHeader>
            <CardContent className="text-sm text-muted-foreground space-y-2">
              <p>1. Você recebe um link curto oficial de afiliado.</p>
              <p>2. O primeiro toque fica atribuído ao seu código.</p>
              <p>3. A cada 10 cadastros completos validados, libera um bônus de R$ 50.</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg"><Repeat className="h-5 w-5" /> Comissão recorrente</CardTitle>
            </CardHeader>
            <CardContent className="text-sm text-muted-foreground space-y-2">
              <p>1. Pagamentos válidos do profissional indicado geram 10% recorrente.</p>
              <p>2. Estorno/cancelamento gera ajuste negativo (clawback).</p>
              <p>3. Tudo fica registrado em extrato de auditoria.</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg"><Wallet className="h-5 w-5" /> Pagamento</CardTitle>
            </CardHeader>
            <CardContent className="text-sm text-muted-foreground space-y-2">
              <p>1. Fechamento mensal manual no v1.</p>
              <p>2. Mínimo de R$ 100 para entrar no lote.</p>
              <p>3. Pagamento via PIX com comprovante interno.</p>
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Cadastro de interesse para afiliado</CardTitle>
            <CardDescription>
              Este cadastro é para parceiros afiliados dedicados. Não é o mesmo fluxo de conta profissional da plataforma.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="full_name">Nome completo *</Label>
                <Input id="full_name" value={fullName} onChange={(e) => setFullName(e.target.value)} required />
              </div>
              <div className="space-y-2">
                <Label htmlFor="email">E-mail *</Label>
                <Input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
                {emailValidationMessage ? (
                  <p
                    className={`text-xs ${
                      emailValidationStatus === "available"
                        ? "text-emerald-600"
                        : emailValidationStatus === "unavailable" || emailValidationStatus === "invalid"
                          ? "text-destructive"
                          : "text-muted-foreground"
                    }`}
                  >
                    {emailValidationMessage}
                  </p>
                ) : null}
              </div>
              <div className="space-y-2">
                <Label htmlFor="phone">Telefone/WhatsApp *</Label>
                <Input id="phone" value={phone} onChange={(e) => setPhone(e.target.value)} required />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label htmlFor="city">Cidade</Label>
                  <Input id="city" value={city} onChange={(e) => setCity(e.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="state">Estado</Label>
                  <Input id="state" value={state} onChange={(e) => setState(e.target.value)} />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="pix_type">Tipo de chave PIX</Label>
                <Input
                  id="pix_type"
                  value={pixKeyType}
                  onChange={(e) => setPixKeyType(e.target.value)}
                  placeholder="cpf | cnpj | email | phone | random"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="pix_key">Chave PIX</Label>
                <Input id="pix_key" value={pixKey} onChange={(e) => setPixKey(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="audience">Seu público principal</Label>
                <Input
                  id="audience"
                  value={audience}
                  onChange={(e) => setAudience(e.target.value)}
                  placeholder="Instagram, comunidade, base de contatos..."
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="experience">Experiência com afiliação</Label>
                <Input
                  id="experience"
                  value={experience}
                  onChange={(e) => setExperience(e.target.value)}
                  placeholder="Iniciante, intermediário, avançado"
                />
              </div>
              <div className="md:col-span-2 space-y-2">
                <Label htmlFor="message">Mensagem complementar</Label>
                <Textarea
                  id="message"
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  placeholder="Conte como pretende divulgar a plataforma."
                />
              </div>
              <div className="md:col-span-2 space-y-3 rounded-md border p-3">
                <div className="flex items-start gap-2">
                  <Checkbox
                    id="affiliate_terms"
                    checked={acceptedTerms}
                    onCheckedChange={(checked) => setAcceptedTerms(checked === true)}
                  />
                  <div className="space-y-1">
                    <Label htmlFor="affiliate_terms" className="text-sm font-medium">
                      Li e aceito o Termo e Condições para Afiliados *
                    </Label>
                    <p className="text-xs text-muted-foreground">
                      Versão {AFFILIATE_TERMS_VERSION} (última atualização: {AFFILIATE_TERMS_LAST_UPDATE}).
                    </p>
                  </div>
                </div>
                <div>
                  <Button type="button" variant="outline" size="sm" onClick={() => setTermsOpen(true)}>
                    Ler termo completo
                  </Button>
                </div>
              </div>
              <div className="md:col-span-2 flex justify-end">
                <Button
                  type="submit"
                  disabled={
                    isSubmitting ||
                    emailValidationStatus === "checking" ||
                    emailValidationStatus === "unavailable" ||
                    emailValidationStatus === "invalid" ||
                    !acceptedTerms
                  }
                  className="gap-2"
                >
                  {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                  Enviar candidatura
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>

        <Dialog open={termsOpen} onOpenChange={setTermsOpen}>
          <DialogContent className="sm:max-w-2xl">
            <DialogHeader>
              <DialogTitle>Termo e Condições para Afiliados</DialogTitle>
              <DialogDescription>
                Versão {AFFILIATE_TERMS_VERSION} - última atualização em {AFFILIATE_TERMS_LAST_UPDATE}.
              </DialogDescription>
            </DialogHeader>
            <div className="max-h-[60vh] space-y-4 overflow-y-auto pr-2 text-sm">
              {affiliateTermsSections.map((section) => (
                <div key={section.title} className="space-y-2">
                  <h3 className="font-semibold">{section.title}</h3>
                  {section.paragraphs.map((paragraph, index) => (
                    <p key={`${section.title}-${index}`} className="text-muted-foreground">
                      {paragraph}
                    </p>
                  ))}
                </div>
              ))}
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </Layout>
  );
};

export default AffiliateProgramPage;
