import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as RechartsTooltip,
  ResponsiveContainer,
} from "recharts";
import { toPercent } from "./shared";

type CheckoutTabProps = {
  stats: any;
};

export const CheckoutTab = ({ stats }: CheckoutTabProps) => (
  <div className="space-y-4">
    <div className="grid gap-4 md:grid-cols-2">
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Funil de Checkout - Cursos</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          <p>
            Iniciados: <strong>{stats.checkoutCourse.started}</strong>
          </p>
          <p>
            Pagos: <strong>{stats.checkoutCourse.paid}</strong>
          </p>
          <p>
            Abandonados: <strong>{stats.checkoutCourse.abandoned}</strong>
          </p>
          <p>
            Conversao: <strong>{toPercent(stats.checkoutCourse.conversionRate)}</strong>
          </p>
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Funil de Checkout - Planos</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          <p>
            Iniciados: <strong>{stats.checkoutPlan.started}</strong>
          </p>
          <p>
            Pagos: <strong>{stats.checkoutPlan.paid}</strong>
          </p>
          <p>
            Abandonados: <strong>{stats.checkoutPlan.abandoned}</strong>
          </p>
          <p>
            Conversao: <strong>{toPercent(stats.checkoutPlan.conversionRate)}</strong>
          </p>
        </CardContent>
      </Card>
    </div>
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Comparativo por Tipo</CardTitle>
      </CardHeader>
      <CardContent className="h-[340px]">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={stats.checkoutRows}>
            <CartesianGrid strokeDasharray="3 3" vertical={false} />
            <XAxis dataKey="name" />
            <YAxis allowDecimals={false} />
            <RechartsTooltip />
            <Bar dataKey="started" name="Iniciados" fill="#2563eb" radius={[4, 4, 0, 0]} />
            <Bar dataKey="paid" name="Pagos" fill="#16a34a" radius={[4, 4, 0, 0]} />
            <Bar dataKey="abandoned" name="Abandonados" fill="#dc2626" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  </div>
);

