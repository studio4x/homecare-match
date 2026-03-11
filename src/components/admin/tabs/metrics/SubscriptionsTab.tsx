import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as RechartsTooltip,
  ResponsiveContainer,
} from "recharts";
import { toCurrency, toPercent } from "./shared";

type SubscriptionsTabProps = {
  stats: any;
};

export const SubscriptionsTab = ({ stats }: SubscriptionsTabProps) => {
  const series = Array.isArray(stats.subscriptionSeries) ? stats.subscriptionSeries : [];
  const latest = series.length ? series[series.length - 1] : null;

  if (!series.length) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Assinaturas</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">Sem dados de assinaturas no periodo.</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Assinaturas (12 meses) - Visao simplificada</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="rounded-lg border bg-muted/30 p-3 text-sm">
            <p className="font-medium">Como ler esta aba:</p>
            <p className="text-muted-foreground">MRR: receita recorrente mensal dos planos pagos.</p>
            <p className="text-muted-foreground">Receita nova: valor vindo de novos assinantes no mes.</p>
            <p className="text-muted-foreground">Expansao: aumento de receita da base atual.</p>
            <p className="text-muted-foreground">Churn: percentual de cancelamentos no mes.</p>
          </div>

          <div className="grid gap-3 md:grid-cols-4">
            <div className="rounded-lg border p-3">
              <p className="text-xs text-muted-foreground">Mes de referencia</p>
              <p className="text-lg font-semibold">{latest?.month || "-"}</p>
            </div>
            <div className="rounded-lg border p-3">
              <p className="text-xs text-muted-foreground">MRR</p>
              <p className="text-lg font-semibold">{toCurrency(Number(latest?.mrr || 0))}</p>
            </div>
            <div className="rounded-lg border p-3">
              <p className="text-xs text-muted-foreground">Receita nova + expansao</p>
              <p className="text-lg font-semibold">
                {toCurrency(Number(latest?.newRevenue || 0) + Number(latest?.expansionRevenue || 0))}
              </p>
            </div>
            <div className="rounded-lg border p-3">
              <p className="text-xs text-muted-foreground">Churn do mes</p>
              <p className="text-lg font-semibold">{toPercent(Number(latest?.churnRate || 0))}</p>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Evolucao mensal de MRR, receita e churn</CardTitle>
        </CardHeader>
        <CardContent className="h-[360px]">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={series}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="month" />
              <YAxis yAxisId="money" tickFormatter={(value) => toCurrency(Number(value || 0))} />
              <YAxis yAxisId="rate" orientation="right" tickFormatter={(value) => `${Number(value || 0)}%`} />
              <RechartsTooltip
                formatter={(value: any, name: string) => {
                  if (name === "Churn") return [toPercent(Number(value || 0)), name];
                  return [toCurrency(Number(value || 0)), name];
                }}
              />
              <Line yAxisId="money" type="monotone" dataKey="mrr" name="MRR" stroke="#2563eb" strokeWidth={2} />
              <Line yAxisId="money" type="monotone" dataKey="newRevenue" name="Receita nova" stroke="#16a34a" strokeWidth={2} />
              <Line yAxisId="money" type="monotone" dataKey="expansionRevenue" name="Expansao" stroke="#f59e0b" strokeWidth={2} />
              <Line yAxisId="rate" type="monotone" dataKey="churnRate" name="Churn" stroke="#dc2626" strokeWidth={2} />
            </LineChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>
    </div>
  );
};
