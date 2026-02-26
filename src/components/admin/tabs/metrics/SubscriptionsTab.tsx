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

type SubscriptionsTabProps = {
  stats: any;
};

export const SubscriptionsTab = ({ stats }: SubscriptionsTabProps) => (
  <Card>
    <CardHeader>
      <CardTitle className="text-base">MRR, Receita Nova, Expansao e Churn (12 meses)</CardTitle>
    </CardHeader>
    <CardContent className="h-[360px]">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={stats.subscriptionSeries}>
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis dataKey="month" />
          <YAxis yAxisId="money" />
          <YAxis yAxisId="rate" orientation="right" />
          <RechartsTooltip />
          <Line yAxisId="money" type="monotone" dataKey="mrr" name="MRR" stroke="#2563eb" strokeWidth={2} />
          <Line yAxisId="money" type="monotone" dataKey="newRevenue" name="Receita Nova" stroke="#16a34a" strokeWidth={2} />
          <Line yAxisId="money" type="monotone" dataKey="expansionRevenue" name="Expansao" stroke="#f59e0b" strokeWidth={2} />
          <Line yAxisId="rate" type="monotone" dataKey="churnRate" name="Churn %" stroke="#dc2626" strokeWidth={2} />
        </LineChart>
      </ResponsiveContainer>
    </CardContent>
  </Card>
);
