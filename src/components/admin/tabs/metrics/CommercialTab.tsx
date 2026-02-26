import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
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

type CommercialTabProps = {
  stats: any;
};

export const CommercialTab = ({ stats }: CommercialTabProps) => (
  <div className="grid gap-4 md:grid-cols-2">
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Funil Comercial</CardTitle>
      </CardHeader>
      <CardContent className="h-[320px]">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={stats.commercialFunnel}>
            <CartesianGrid strokeDasharray="3 3" vertical={false} />
            <XAxis dataKey="step" fontSize={10} interval={0} angle={-10} height={80} textAnchor="end" />
            <YAxis allowDecimals={false} />
            <RechartsTooltip />
            <Bar dataKey="value" fill="#2563eb" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Taxas de Conversao</CardTitle>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Etapa</TableHead>
              <TableHead>Taxa</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {stats.commercialRates.map((r: any) => (
              <TableRow key={r.step}>
                <TableCell className="font-medium">{r.step}</TableCell>
                <TableCell>{toPercent(r.rate)}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  </div>
);
