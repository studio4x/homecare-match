"use client";

import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Copy, Link as LinkIcon, Loader2, RefreshCw, Save, Ticket, Wallet } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/components/auth/AuthProvider";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";

const currency = (value: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(Number(value || 0));

const statusLabel: Record<string, string> = {
  shadow: "Sombra",
  available: "Disponivel",
  reserved: "Reservado",
  paid: "Pago",
  voided: "Anulado",
};

const entryTypeLabel: Record<string, string> = {
  signup_credit: "Bonus por marco de cadastros",
  recurring_credit: "Recorrente",
  clawback_debit: "Clawback",
  manual_adjustment: "Ajuste manual",
};

const payoutStatusLabel: Record<string, string> = {
  reserved: "Reservado",
  paid: "Pago",
  canceled: "Cancelado",
};

const AffiliatesPage = () => {
  const { user } = useAuth();
  const [isGenerating, setIsGenerating] = useState(false);
  const [isSavingPix, setIsSavingPix] = useState(false);
  const [pixKey, setPixKey] = useState("");
  const [pixKeyType, setPixKeyType] = useState("random");

  const { data, isLoading, refetch, isRefetching } = useQuery({
    queryKey: ["affiliate-dashboard", user?.id],
    enabled: !!user?.id,
    queryFn: async () => {
      const { data, error } = await supabase.functions.invoke("affiliate-dashboard-stats");
      if (error) throw error;
      return data as any;
    },
  });

  const partner = data?.partner;
  const config = data?.config;
  const balances = data?.balances || {
    shadow_balance: 0,
    available_balance: 0,
    reserved_balance: 0,
    paid_balance: 0,
    lifetime_balance: 0,
  };

  const links = Array.isArray(data?.links) ? data.links : [];
  const ledger = Array.isArray(data?.ledger) ? data.ledger : [];
  const payouts = Array.isArray(data?.payouts) ? data.payouts : [];

  const canGenerate = !!partner?.id;

  const isProgramDisabled = config?.affiliate_program_enabled !== true;
  const isShadowMode = config?.affiliate_shadow_mode === true;

  useEffect(() => {
    setPixKey(String(partner?.pix_key || ""));
    setPixKeyType(String(partner?.pix_key_type || "random"));
  }, [partner?.id, partner?.pix_key, partner?.pix_key_type]);

  const hasPixChanged = useMemo(() => {
    const partnerPix = String(partner?.pix_key || "");
    const partnerPixType = String(partner?.pix_key_type || "random");
    return pixKey !== partnerPix || pixKeyType !== partnerPixType;
  }, [partner?.pix_key, partner?.pix_key_type, pixKey, pixKeyType]);

  const handleCopy = async (value: string, message: string) => {
    try {
      await navigator.clipboard.writeText(value);
      toast.success(message);
    } catch {
      toast.error("Nao foi possivel copiar.");
    }
  };

  const handleGenerateLink = async () => {
    if (!canGenerate) return;
    setIsGenerating(true);
    try {
      const { data, error } = await supabase.functions.invoke("affiliate-generate-short-link", {
        body: { target_path: "/convite" },
      });
      if (error) throw error;
      if (data?.short_url) {
        toast.success(data?.reused ? "Link existente carregado." : "Link afiliado criado com sucesso.");
      }
      await refetch();
    } catch (error: any) {
      toast.error(error?.message || "Erro ao gerar link afiliado.");
    } finally {
      setIsGenerating(false);
    }
  };

  const handleSavePix = async () => {
    if (!partner?.id) return;
    setIsSavingPix(true);
    try {
      const { error } = await supabase
        .from("affiliate_partners")
        .update({ pix_key: pixKey || null, pix_key_type: pixKeyType || null, updated_at: new Date().toISOString() })
        .eq("id", partner.id);
      if (error) throw error;
      toast.success("Dados PIX atualizados.");
      await refetch();
    } catch (error: any) {
      toast.error(error?.message || "Erro ao salvar dados PIX.");
    } finally {
      setIsSavingPix(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center gap-2 text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" />
        Carregando painel de afiliados...
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Afiliados</h1>
        <p className="text-muted-foreground">Acompanhe comissoes, saldo e seu link oficial de divulgacao.</p>
      </div>

      <Card className={isProgramDisabled ? "border-amber-300 bg-amber-50/50" : ""}>
        <CardContent className="pt-6">
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant={isProgramDisabled ? "secondary" : "default"}>
              {isProgramDisabled ? "Programa desativado" : "Programa ativo"}
            </Badge>
            <Badge variant={isShadowMode ? "outline" : "default"}>
              {isShadowMode ? "Modo sombra" : "Payout habilitado"}
            </Badge>
            <Badge variant="outline">Bonus por 10 cadastros: {currency(config?.signup_commission_amount || 50)}</Badge>
            <Badge variant="outline">Recorrente: {Number(config?.recurring_commission_percent || 10)}%</Badge>
            <Badge variant="outline">Minimo payout: {currency(config?.payout_minimum_amount || 100)}</Badge>
            <Badge variant={partner?.status === "active" ? "default" : "secondary"}>
              Status do parceiro: {partner?.status || "active"}
            </Badge>
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-4 md:grid-cols-5">
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm">Saldo disponivel</CardTitle></CardHeader>
          <CardContent><p className="text-2xl font-bold">{currency(balances.available_balance)}</p></CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm">Saldo em sombra</CardTitle></CardHeader>
          <CardContent><p className="text-2xl font-bold">{currency(balances.shadow_balance)}</p></CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm">Reservado</CardTitle></CardHeader>
          <CardContent><p className="text-2xl font-bold">{currency(balances.reserved_balance)}</p></CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm">Pago</CardTitle></CardHeader>
          <CardContent><p className="text-2xl font-bold">{currency(balances.paid_balance)}</p></CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm">Acumulado</CardTitle></CardHeader>
          <CardContent><p className="text-2xl font-bold">{currency(balances.lifetime_balance)}</p></CardContent>
        </Card>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><LinkIcon className="h-4 w-4" /> Link afiliado</CardTitle>
            <CardDescription>Use este link para divulgar e atribuir novos cadastros ao seu perfil.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <Button onClick={handleGenerateLink} disabled={!canGenerate || isGenerating} className="gap-2">
              {isGenerating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Ticket className="h-4 w-4" />}
              {links.length > 0 ? "Revalidar link" : "Gerar link"}
            </Button>

            {links.length === 0 ? (
              <p className="text-sm text-muted-foreground">Nenhum link afiliado encontrado.</p>
            ) : (
              <div className="space-y-2">
                {links.map((link: any) => (
                  <div key={link.id} className="rounded-lg border p-3">
                    <p className="text-xs text-muted-foreground">{link.slug}</p>
                    <p className="break-all text-sm font-medium">{link.short_url}</p>
                    <div className="mt-2 flex flex-wrap gap-2">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleCopy(link.short_url, "Link copiado.")}
                        className="gap-1"
                      >
                        <Copy className="h-3.5 w-3.5" /> Copiar
                      </Button>
                      <Badge variant={link.is_active ? "default" : "secondary"}>
                        {link.is_active ? "Ativo" : "Inativo"}
                      </Badge>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><Wallet className="h-4 w-4" /> Dados de recebimento</CardTitle>
            <CardDescription>Informe a chave PIX para pagamento manual dos lotes aprovados.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="space-y-2">
              <Label htmlFor="pixType">Tipo da chave</Label>
              <Input
                id="pixType"
                value={pixKeyType}
                onChange={(e) => setPixKeyType(e.target.value)}
                placeholder="cpf | cnpj | email | phone | random"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="pixKey">Chave PIX</Label>
              <Input
                id="pixKey"
                value={pixKey}
                onChange={(e) => setPixKey(e.target.value)}
                placeholder="Informe sua chave PIX"
              />
            </div>
            <Button onClick={handleSavePix} disabled={isSavingPix || !hasPixChanged} className="gap-2">
              {isSavingPix ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
              Salvar PIX
            </Button>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Extrato de comissoes</CardTitle>
          <CardDescription>Ultimos lancamentos de credito/debito do seu afiliado.</CardDescription>
        </CardHeader>
        <CardContent>
          {ledger.length === 0 ? (
            <p className="text-sm text-muted-foreground">Sem movimentacoes no periodo.</p>
          ) : (
            <div className="space-y-2">
              {ledger.map((row: any) => (
                <div key={row.id} className="rounded-lg border p-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <p className="text-sm font-medium">{entryTypeLabel[row.entry_type] || row.entry_type}</p>
                      <p className="text-xs text-muted-foreground">
                        {row.referred_name} {row.referred_email ? `(${row.referred_email})` : ""}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className={`text-sm font-semibold ${row.direction === "debit" ? "text-destructive" : "text-emerald-700"}`}>
                        {row.direction === "debit" ? "-" : "+"}{currency(row.amount)}
                      </p>
                      <Badge variant="outline">{statusLabel[row.entry_status] || row.entry_status}</Badge>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Lotes de pagamento</CardTitle>
          <CardDescription>Historico de lotes reservados/pagos para sua conta afiliada.</CardDescription>
        </CardHeader>
        <CardContent>
          {payouts.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nenhum lote de payout encontrado.</p>
          ) : (
            <div className="space-y-2">
              {payouts.map((row: any) => (
                <div key={row.id} className="rounded-lg border p-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <p className="text-sm font-medium">{row?.batch?.period_label || "Periodo sem identificacao"}</p>
                      <p className="text-xs text-muted-foreground">
                        Criado em {new Date(row.created_at).toLocaleDateString("pt-BR")}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-semibold">{currency(row.amount)}</p>
                      <Badge variant="outline">{payoutStatusLabel[row.status] || row.status}</Badge>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <div className="flex justify-end">
        <Button variant="outline" onClick={() => refetch()} disabled={isRefetching} className="gap-2">
          {isRefetching ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
          Atualizar
        </Button>
      </div>
    </div>
  );
};

export default AffiliatesPage;
