"use client";

import { FormEvent, useState } from "react";
import Layout from "@/components/layout/Layout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Loader2, Megaphone, Repeat, Wallet } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

const AffiliateProgramPage = () => {
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

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setIsSubmitting(true);

    try {
      const { data, error } = await supabase.functions.invoke("affiliate-register-interest", {
        body: {
          full_name: fullName,
          email,
          phone,
          city,
          state,
          pix_key_type: pixKeyType || null,
          pix_key: pixKey || null,
          audience,
          experience,
          message,
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
            Divulgue a plataforma, traga novos profissionais e receba comissoes de acordo com o desempenho.
            Este programa e separado do sistema de indicacoes de profissionais.
          </p>
          <div className="mt-4 flex flex-wrap gap-2">
            <Badge variant="outline">Bonus de R$ 50 a cada 10 cadastros completos</Badge>
            <Badge variant="outline">10% recorrente enquanto ativo</Badge>
            <Badge variant="outline">Payout mensal minimo de R$ 100</Badge>
          </div>
        </div>

        <div className="grid gap-6 lg:grid-cols-3">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg"><Megaphone className="h-5 w-5" /> Como funciona</CardTitle>
            </CardHeader>
            <CardContent className="text-sm text-muted-foreground space-y-2">
              <p>1. Voce recebe um link curto oficial de afiliado.</p>
              <p>2. O primeiro toque fica atribuido ao seu codigo.</p>
              <p>3. A cada 10 cadastros completos validados, libera um bonus de R$ 50.</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg"><Repeat className="h-5 w-5" /> Comissao recorrente</CardTitle>
            </CardHeader>
            <CardContent className="text-sm text-muted-foreground space-y-2">
              <p>1. Pagamentos validos do profissional indicado geram 10% recorrente.</p>
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
              <p>2. Minimo de R$ 100 para entrar no lote.</p>
              <p>3. Pagamento via PIX com comprovante interno.</p>
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Cadastro de interesse para afiliado</CardTitle>
            <CardDescription>
              Este cadastro e para parceiros afiliados dedicados. Nao e o mesmo fluxo de conta profissional da plataforma.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="full_name">Nome completo *</Label>
                <Input id="full_name" value={fullName} onChange={(e) => setFullName(e.target.value)} required />
              </div>
              <div className="space-y-2">
                <Label htmlFor="email">Email *</Label>
                <Input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
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
                <Label htmlFor="audience">Seu publico principal</Label>
                <Input
                  id="audience"
                  value={audience}
                  onChange={(e) => setAudience(e.target.value)}
                  placeholder="Instagram, comunidade, base de contatos..."
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="experience">Experiencia com afiliacao</Label>
                <Input
                  id="experience"
                  value={experience}
                  onChange={(e) => setExperience(e.target.value)}
                  placeholder="Iniciante, intermediario, avancado"
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
              <div className="md:col-span-2 flex justify-end">
                <Button type="submit" disabled={isSubmitting} className="gap-2">
                  {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                  Enviar candidatura
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      </div>
    </Layout>
  );
};

export default AffiliateProgramPage;
