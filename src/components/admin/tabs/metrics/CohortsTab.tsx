import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { toPercent } from "./shared";

type CohortsTabProps = {
  stats: any;
};

export const CohortsTab = ({ stats }: CohortsTabProps) => (
  <Card>
    <CardHeader>
      <CardTitle className="text-base">Retencao por Coorte de Assinantes</CardTitle>
      <CardDescription>M0-M5 representa retencao percentual por mes apos entrada.</CardDescription>
    </CardHeader>
    <CardContent>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Coorte</TableHead>
            <TableHead>Tamanho</TableHead>
            <TableHead>M0</TableHead>
            <TableHead>M1</TableHead>
            <TableHead>M2</TableHead>
            <TableHead>M3</TableHead>
            <TableHead>M4</TableHead>
            <TableHead>M5</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {stats.cohortRows.map((r: any) => (
            <TableRow key={r.cohort}>
              <TableCell className="font-medium">{r.cohort}</TableCell>
              <TableCell>{r.size}</TableCell>
              <TableCell>{toPercent(r.m0)}</TableCell>
              <TableCell>{toPercent(r.m1)}</TableCell>
              <TableCell>{toPercent(r.m2)}</TableCell>
              <TableCell>{toPercent(r.m3)}</TableCell>
              <TableCell>{toPercent(r.m4)}</TableCell>
              <TableCell>{toPercent(r.m5)}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </CardContent>
  </Card>
);
