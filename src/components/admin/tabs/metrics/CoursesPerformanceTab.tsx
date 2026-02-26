import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { toPercent } from "./shared";

type CoursesPerformanceTabProps = {
  stats: any;
};

export const CoursesPerformanceTab = ({ stats }: CoursesPerformanceTabProps) => (
  <Card>
    <CardHeader>
      <CardTitle className="text-base">Taxa de Conclusao e Tempo Medio ate Certificado</CardTitle>
    </CardHeader>
    <CardContent>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Curso</TableHead>
            <TableHead>Inscritos</TableHead>
            <TableHead>Concluidos</TableHead>
            <TableHead>Taxa Conclusao</TableHead>
            <TableHead>Tempo Medio (dias)</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {stats.coursePerformanceRows.map((r: any) => (
            <TableRow key={r.course}>
              <TableCell className="font-medium">{r.course}</TableCell>
              <TableCell>{r.enrolled}</TableCell>
              <TableCell>{r.completed}</TableCell>
              <TableCell>{toPercent(r.completionRate)}</TableCell>
              <TableCell>{Number(r.avgDaysToCertificate || 0).toFixed(1)}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </CardContent>
  </Card>
);
