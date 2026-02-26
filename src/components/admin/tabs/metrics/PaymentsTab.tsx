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
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { toPercent } from "./shared";

type PaymentsTabProps = {
  stats: any;
};

export const PaymentsTab = ({ stats }: PaymentsTabProps) => (
  <div className="space-y-4">
    <div className="grid gap-4 md:grid-cols-2">
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Aprovacao por Metodo</CardTitle>
        </CardHeader>
        <CardContent className="h-[320px]">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={stats.methodApproval}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} />
              <XAxis dataKey="method" />
              <YAxis allowDecimals={false} />
              <RechartsTooltip />
              <Bar dataKey="total" name="Total" fill="#94a3b8" radius={[4, 4, 0, 0]} />
              <Bar dataKey="paid" name="Pago" fill="#16a34a" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Parcelamento no Cartao</CardTitle>
        </CardHeader>
        <CardContent className="h-[320px]">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={stats.installmentDist}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} />
              <XAxis dataKey="name" />
              <YAxis allowDecimals={false} />
              <RechartsTooltip />
              <Bar dataKey="value" fill="#2563eb" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>
    </div>

    <Card>
      <CardHeader>
        <CardTitle className="text-base">Taxa de Estorno/Inadimplencia por Segmento</CardTitle>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Segmento</TableHead>
              <TableHead>Total</TableHead>
              <TableHead>Estornos</TableHead>
              <TableHead>Inadimplentes</TableHead>
              <TableHead>Taxa Estorno</TableHead>
              <TableHead>Taxa Inadimplencia</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {stats.refundDefaultRows.map((r: any) => (
              <TableRow key={r.segment}>
                <TableCell className="font-medium">{r.segment}</TableCell>
                <TableCell>{r.total}</TableCell>
                <TableCell>{r.refunds}</TableCell>
                <TableCell>{r.defaults}</TableCell>
                <TableCell>{toPercent(r.refundRate)}</TableCell>
                <TableCell>{toPercent(r.defaultRate)}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  </div>
);
