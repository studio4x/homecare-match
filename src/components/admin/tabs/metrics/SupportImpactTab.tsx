import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { toCurrency, toPercent } from "./shared";

type SupportImpactTabProps = {
  stats: any;
};

export const SupportImpactTab = ({ stats }: SupportImpactTabProps) => (
  <div className="space-y-4">
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Impacto de Volume de Tickets em Receita/Churn/Inadimplencia</CardTitle>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Bucket</TableHead>
              <TableHead>Usuarios</TableHead>
              <TableHead>Receita Media</TableHead>
              <TableHead>Churn</TableHead>
              <TableHead>Inadimplencia</TableHead>
              <TableHead>SLA Medio (h)</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {stats.supportVolumeImpact.map((r: any) => (
              <TableRow key={r.bucket}>
                <TableCell className="font-medium">{r.bucket}</TableCell>
                <TableCell>{r.users}</TableCell>
                <TableCell>{toCurrency(r.avgRevenue)}</TableCell>
                <TableCell>{toPercent(r.churnRate)}</TableCell>
                <TableCell>{toPercent(r.defaultRate)}</TableCell>
                <TableCell>{r.avgSlaHours > 0 ? Number(r.avgSlaHours).toFixed(1) : "-"}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Impacto de SLA em Receita/Churn/Inadimplencia</CardTitle>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Bucket SLA</TableHead>
              <TableHead>Usuarios</TableHead>
              <TableHead>Receita Media</TableHead>
              <TableHead>Churn</TableHead>
              <TableHead>Inadimplencia</TableHead>
              <TableHead>SLA Medio (h)</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {stats.supportSlaImpact.map((r: any) => (
              <TableRow key={r.bucket}>
                <TableCell className="font-medium">{r.bucket}</TableCell>
                <TableCell>{r.users}</TableCell>
                <TableCell>{toCurrency(r.avgRevenue)}</TableCell>
                <TableCell>{toPercent(r.churnRate)}</TableCell>
                <TableCell>{toPercent(r.defaultRate)}</TableCell>
                <TableCell>{r.avgSlaHours > 0 ? Number(r.avgSlaHours).toFixed(1) : "-"}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  </div>
);
