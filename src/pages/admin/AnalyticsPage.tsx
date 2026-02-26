"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as RechartsTooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
} from "recharts";
import {
  Loader2,
  Eye,
  Users,
  AlertCircle,
  ArrowUpRight,
  DollarSign,
  ShoppingCart,
  CreditCard,
} from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

const COLORS = ["#0088FE", "#00C49F", "#FFBB28", "#FF8042", "#8884d8"];

type NameValue = {
  name: string;
  value: number;
};

type AdminPaymentRecord = {
  transaction_type: string;
  item_name: string;
  status: string;
  amount: number;
};

type SalesStats = {
  paidRevenue: number;
  totalTransactions: number;
  paidTransactions: number;
  averageTicket: number;
  statusBreakdown: NameValue[];
  topByRevenue: NameValue[];
  topByCount: NameValue[];
};

type AnalyticsState = {
  profileViews: NameValue[];
  contactAdditions: NameValue[];
  whatsappClicks: NameValue[];
  ticketsByUrgency: NameValue[];
  ticketsByUserType: NameValue[];
  courseSales: SalesStats;
  planSales: SalesStats;
};

type InvokeFunctionError = {
  context?: Response;
};

const EMPTY_SALES: SalesStats = {
  paidRevenue: 0,
  totalTransactions: 0,
  paidTransactions: 0,
  averageTicket: 0,
  statusBreakdown: [],
  topByRevenue: [],
  topByCount: [],
};

const EMPTY_STATE: AnalyticsState = {
  profileViews: [],
  contactAdditions: [],
  whatsappClicks: [],
  ticketsByUrgency: [],
  ticketsByUserType: [],
  courseSales: EMPTY_SALES,
  planSales: EMPTY_SALES,
};

const toCurrency = (value: number) =>
  new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
    minimumFractionDigits: 2,
  }).format(Number(value || 0));

const normalizeSalesName = (rawName: string, fallback: string) => {
  const cleaned = String(rawName || "")
    .replace(/parcela\s+\d+\s+de\s*\d+\.?/gi, "")
    .replace(/parcelamento\s*\(\s*\d+\s*\/\s*\d+\s*\)\s*[-:]*\s*/gi, "")
    .replace(/\s{2,}/g, " ")
    .trim();

  return cleaned || fallback;
};

const mapStatusBucket = (rawStatus: string) => {
  const status = String(rawStatus || "").toLowerCase().trim();
  if (status === "paid" || status === "succeeded") return "Pago";
  if (status === "open") return "Pendente";
  if (status === "refund_pending") return "Estorno pendente";
  if (status === "refunded") return "Estornado";
  if (status === "canceled" || status === "cancelled" || status === "void") return "Cancelado";
  return "Outros";
};

const buildSalesStats = (
  payments: AdminPaymentRecord[],
  transactionType: "course" | "plan",
  fallbackName: string,
): SalesStats => {
  const scoped = payments.filter((payment) => payment.transaction_type === transactionType);
  if (scoped.length === 0) return EMPTY_SALES;

  const revenueByItem = new Map<string, number>();
  const countByItem = new Map<string, number>();
  const statusCounters = new Map<string, number>();

  let paidRevenue = 0;
  let paidTransactions = 0;

  scoped.forEach((payment) => {
    const statusBucket = mapStatusBucket(payment.status);
    statusCounters.set(statusBucket, (statusCounters.get(statusBucket) || 0) + 1);

    if (statusBucket !== "Pago") return;

    const itemName = normalizeSalesName(payment.item_name, fallbackName);
    const amount = Number(payment.amount || 0);
    paidRevenue += amount;
    paidTransactions += 1;
    revenueByItem.set(itemName, (revenueByItem.get(itemName) || 0) + amount);
    countByItem.set(itemName, (countByItem.get(itemName) || 0) + 1);
  });

  const topByRevenue = Array.from(revenueByItem.entries())
    .map(([name, value]) => ({ name, value: Number(value.toFixed(2)) }))
    .sort((a, b) => b.value - a.value)
    .slice(0, 10);

  const topByCount = Array.from(countByItem.entries())
    .map(([name, value]) => ({ name, value }))
    .sort((a, b) => b.value - a.value)
    .slice(0, 10);

  const statusBreakdown = Array.from(statusCounters.entries())
    .map(([name, value]) => ({ name, value }))
    .sort((a, b) => b.value - a.value);

  return {
    paidRevenue: Number(paidRevenue.toFixed(2)),
    totalTransactions: scoped.length,
    paidTransactions,
    averageTicket: paidTransactions > 0 ? Number((paidRevenue / paidTransactions).toFixed(2)) : 0,
    statusBreakdown,
    topByRevenue,
    topByCount,
  };
};

const readFunctionErrorMessage = async (funcError: InvokeFunctionError | null, fallback: string) => {
  const response = funcError?.context;
  if (!response) return fallback;

  try {
    const body = await response.clone().json();
    if (typeof body?.error === "string" && body.error.trim()) return body.error;
    if (typeof body?.message === "string" && body.message.trim()) return body.message;
  } catch {
    // ignore
  }

  try {
    const text = await response.clone().text();
    if (text.trim()) return text;
  } catch {
    // ignore
  }

  return fallback;
};

const SalesTab = ({ title, subtitle, stats }: { title: string; subtitle: string; stats: SalesStats }) => (
  <div className="space-y-4">
    <div className="grid gap-4 md:grid-cols-4">
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium">Faturamento Pago</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{toCurrency(stats.paidRevenue)}</div>
        </CardContent>
      </Card>
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium">Transacoes Totais</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{stats.totalTransactions}</div>
        </CardContent>
      </Card>
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium">Transacoes Pagas</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{stats.paidTransactions}</div>
        </CardContent>
      </Card>
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium">Ticket Medio</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{toCurrency(stats.averageTicket)}</div>
        </CardContent>
      </Card>
    </div>

    <div className="grid gap-4 md:grid-cols-2">
      <Card>
        <CardHeader>
          <CardTitle className="text-base">{title}</CardTitle>
          <CardDescription>{subtitle}</CardDescription>
        </CardHeader>
        <CardContent className="h-[300px]">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={stats.topByRevenue} layout="vertical">
              <CartesianGrid strokeDasharray="3 3" horizontal={false} />
              <XAxis type="number" hide />
              <YAxis dataKey="name" type="category" width={150} fontSize={10} />
              <RechartsTooltip formatter={(value: number) => toCurrency(Number(value || 0))} />
              <Bar dataKey="value" fill="#10b981" radius={[0, 4, 4, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Status das Transacoes</CardTitle>
          <CardDescription>Distribuicao por status de pagamento.</CardDescription>
        </CardHeader>
        <CardContent className="h-[300px]">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={stats.statusBreakdown}
                cx="50%"
                cy="50%"
                outerRadius={90}
                dataKey="value"
                label={({ name, value }) => `${name}: ${value}`}
              >
                {stats.statusBreakdown.map((entry, index) => (
                  <Cell key={`status-${entry.name}-${index}`} fill={COLORS[index % COLORS.length]} />
                ))}
              </Pie>
              <RechartsTooltip />
            </PieChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      <Card className="md:col-span-2">
        <CardHeader>
          <CardTitle className="text-base">Mais Vendidos (Quantidade de Transacoes Pagas)</CardTitle>
          <CardDescription>Ranking por volume de vendas confirmadas.</CardDescription>
        </CardHeader>
        <CardContent className="h-[300px]">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={stats.topByCount}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} />
              <XAxis dataKey="name" fontSize={10} interval={0} angle={-10} height={70} textAnchor="end" />
              <YAxis allowDecimals={false} fontSize={12} />
              <RechartsTooltip />
              <Bar dataKey="value" fill="#3b82f6" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>
    </div>
  </div>
);

const AnalyticsPage = () => {
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState<AnalyticsState>(EMPTY_STATE);

  useEffect(() => {
    fetchAnalytics();
  }, []);

  const fetchAnalytics = async () => {
    setLoading(true);
    try {
      const [
        viewsResult,
        interactionsResult,
        clicksResult,
        ticketsResult,
        adminPaymentsResult,
      ] = await Promise.all([
        supabase.from("profile_views").select("profile:profiles(full_name)").limit(5000),
        supabase
          .from("interactions")
          .select("professional:profiles!interactions_professional_id_fkey(full_name)")
          .limit(5000),
        supabase.from("whatsapp_clicks").select("clicker_role").limit(5000),
        supabase.from("support_tickets").select("priority, user:profiles(role)").neq("status", "closed"),
        supabase.functions.invoke("get-admin-payment-history"),
      ]);

      const viewsMap = new Map<string, number>();
      viewsResult.data?.forEach((item: any) => {
        const name = item.profile?.full_name || "Desconhecido";
        viewsMap.set(name, (viewsMap.get(name) || 0) + 1);
      });
      const profileViews = Array.from(viewsMap.entries())
        .map(([name, value]) => ({ name, value }))
        .sort((a, b) => b.value - a.value)
        .slice(0, 10);

      const interactionsMap = new Map<string, number>();
      interactionsResult.data?.forEach((item: any) => {
        const name = item.professional?.full_name || "Desconhecido";
        interactionsMap.set(name, (interactionsMap.get(name) || 0) + 1);
      });
      const contactAdditions = Array.from(interactionsMap.entries())
        .map(([name, value]) => ({ name, value }))
        .sort((a, b) => b.value - a.value)
        .slice(0, 10);

      const clicksMap = new Map<string, number>();
      clicksResult.data?.forEach((item: any) => {
        const role =
          item.clicker_role === "company"
            ? "Empresa"
            : item.clicker_role === "family"
              ? "Familia"
              : "Profissional";
        clicksMap.set(role, (clicksMap.get(role) || 0) + 1);
      });
      const whatsappClicks = Array.from(clicksMap.entries()).map(([name, value]) => ({ name, value }));

      const urgencyMap = new Map<string, number>();
      const typeMap = new Map<string, number>();
      ticketsResult.data?.forEach((ticket: any) => {
        const priority =
          ticket.priority === "urgent"
            ? "Urgente"
            : ticket.priority === "high"
              ? "Alta"
              : ticket.priority === "medium"
                ? "Media"
                : "Baixa";
        const role =
          ticket.user?.role === "company"
            ? "Empresa"
            : ticket.user?.role === "family"
              ? "Familia"
              : "Profissional";

        urgencyMap.set(priority, (urgencyMap.get(priority) || 0) + 1);
        typeMap.set(role, (typeMap.get(role) || 0) + 1);
      });

      if (adminPaymentsResult.error) {
        const message = await readFunctionErrorMessage(
          adminPaymentsResult.error as InvokeFunctionError,
          "Erro ao consultar metricas de vendas.",
        );
        console.warn("[AnalyticsPage] Falha em get-admin-payment-history:", message);
      }

      const adminPayments = Array.isArray((adminPaymentsResult.data as any)?.payments)
        ? ((adminPaymentsResult.data as any).payments as AdminPaymentRecord[])
        : [];

      const courseSales = buildSalesStats(adminPayments, "course", "Curso");
      const planSales = buildSalesStats(adminPayments, "plan", "Plano");

      setStats({
        profileViews,
        contactAdditions,
        whatsappClicks,
        ticketsByUrgency: Array.from(urgencyMap.entries()).map(([name, value]) => ({ name, value })),
        ticketsByUserType: Array.from(typeMap.entries()).map(([name, value]) => ({ name, value })),
        courseSales,
        planSales,
      });
    } catch (error) {
      console.error("[AnalyticsPage] Erro ao carregar metricas:", error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center p-12">
        <Loader2 className="animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Metricas e Analises</h1>
        <p className="text-muted-foreground">Acompanhe engajamento, suporte e vendas da plataforma.</p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total de Visualizacoes</CardTitle>
            <Eye className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {stats.profileViews.reduce((acc, curr) => acc + curr.value, 0)}
            </div>
            <p className="text-xs text-muted-foreground">Nos perfis do Top 10</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Contatos Iniciados</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {stats.contactAdditions.reduce((acc, curr) => acc + curr.value, 0)}
            </div>
            <p className="text-xs text-muted-foreground">Adicoes a lista de contatos</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Cliques no WhatsApp</CardTitle>
            <ArrowUpRight className="h-4 w-4 text-emerald-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {stats.whatsappClicks.reduce((acc, curr) => acc + curr.value, 0)}
            </div>
            <p className="text-xs text-muted-foreground">Interesse direto confirmado</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Tickets Abertos</CardTitle>
            <AlertCircle className="h-4 w-4 text-destructive" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {stats.ticketsByUrgency.reduce((acc, curr) => acc + curr.value, 0)}
            </div>
            <p className="text-xs text-muted-foreground">Aguardando atendimento</p>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="engagement" className="space-y-4">
        <TabsList>
          <TabsTrigger value="engagement">Engajamento</TabsTrigger>
          <TabsTrigger value="support">Suporte</TabsTrigger>
          <TabsTrigger value="course-sales">Vendas de Cursos</TabsTrigger>
          <TabsTrigger value="plan-sales">Vendas de Planos</TabsTrigger>
        </TabsList>

        <TabsContent value="engagement" className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Top 10 Perfis Mais Visualizados</CardTitle>
                <CardDescription>Quantidade de aberturas do perfil publico.</CardDescription>
              </CardHeader>
              <CardContent className="h-[300px]">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={stats.profileViews} layout="vertical">
                    <CartesianGrid strokeDasharray="3 3" horizontal={false} />
                    <XAxis type="number" hide />
                    <YAxis dataKey="name" type="category" width={120} fontSize={10} />
                    <RechartsTooltip />
                    <Bar dataKey="value" fill="#007BFF" radius={[0, 4, 4, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-base">Profissionais Mais Adicionados</CardTitle>
                <CardDescription>Interesse de empresas e familias.</CardDescription>
              </CardHeader>
              <CardContent className="h-[300px]">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={stats.contactAdditions} layout="vertical">
                    <CartesianGrid strokeDasharray="3 3" horizontal={false} />
                    <XAxis type="number" hide />
                    <YAxis dataKey="name" type="category" width={120} fontSize={10} />
                    <RechartsTooltip />
                    <Bar dataKey="value" fill="#28A745" radius={[0, 4, 4, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            <Card className="md:col-span-2">
              <CardHeader>
                <CardTitle className="text-base">Cliques no WhatsApp por Tipo de Usuario</CardTitle>
                <CardDescription>Quem mais entra em contato direto.</CardDescription>
              </CardHeader>
              <CardContent className="h-[300px] flex items-center justify-center">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={stats.whatsappClicks}
                      cx="50%"
                      cy="50%"
                      innerRadius={60}
                      outerRadius={80}
                      paddingAngle={5}
                      dataKey="value"
                      label={({ name, percent }) => `${name} (${(percent * 100).toFixed(0)}%)`}
                    >
                      {stats.whatsappClicks.map((entry, index) => (
                        <Cell key={`whatsapp-${entry.name}-${index}`} fill={COLORS[index % COLORS.length]} />
                      ))}
                    </Pie>
                    <RechartsTooltip />
                  </PieChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="support" className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Tickets por Urgencia</CardTitle>
                <CardDescription>Distribuicao de chamados abertos.</CardDescription>
              </CardHeader>
              <CardContent className="h-[300px]">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={stats.ticketsByUrgency}
                      cx="50%"
                      cy="50%"
                      outerRadius={80}
                      dataKey="value"
                      label={({ name, value }) => `${name}: ${value}`}
                    >
                      {stats.ticketsByUrgency.map((entry, index) => (
                        <Cell
                          key={`urgency-${entry.name}-${index}`}
                          fill={
                            entry.name === "Urgente"
                              ? "#ef4444"
                              : entry.name === "Alta"
                                ? "#f97316"
                                : "#3b82f6"
                          }
                        />
                      ))}
                    </Pie>
                    <RechartsTooltip />
                  </PieChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-base">Tickets por Tipo de Usuario</CardTitle>
                <CardDescription>Quem mais solicita suporte.</CardDescription>
              </CardHeader>
              <CardContent className="h-[300px]">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={stats.ticketsByUserType}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} />
                    <XAxis dataKey="name" fontSize={12} />
                    <YAxis fontSize={12} />
                    <RechartsTooltip />
                    <Bar dataKey="value" fill="#8884d8" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="course-sales">
          <SalesTab
            title="Top Cursos por Faturamento"
            subtitle="Somente transacoes com pagamento confirmado."
            stats={stats.courseSales}
          />
        </TabsContent>

        <TabsContent value="plan-sales">
          <SalesTab
            title="Top Planos por Faturamento"
            subtitle="Somente transacoes com pagamento confirmado."
            stats={stats.planSales}
          />
        </TabsContent>
      </Tabs>

      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Receita Cursos (Pagos)</CardTitle>
            <ShoppingCart className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{toCurrency(stats.courseSales.paidRevenue)}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Receita Planos (Pagos)</CardTitle>
            <CreditCard className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{toCurrency(stats.planSales.paidRevenue)}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Receita Total (Pagos)</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {toCurrency(stats.courseSales.paidRevenue + stats.planSales.paidRevenue)}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default AnalyticsPage;
