import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

type CoursesFunnelTabProps = {
  stats: any;
};

export const CoursesFunnelTab = ({ stats }: CoursesFunnelTabProps) => (
  <div className="space-y-4">
    <div className="grid gap-4 md:grid-cols-4">
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">Comprados</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{stats.courseFunnelOverall.purchased}</div>
        </CardContent>
      </Card>
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">Iniciados</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{stats.courseFunnelOverall.started}</div>
        </CardContent>
      </Card>
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">Concluidos</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{stats.courseFunnelOverall.completed}</div>
        </CardContent>
      </Card>
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">Certificados</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{stats.courseFunnelOverall.certified}</div>
        </CardContent>
      </Card>
    </div>
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Funil por Curso (Top 12)</CardTitle>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Curso</TableHead>
              <TableHead>Comprados</TableHead>
              <TableHead>Iniciados</TableHead>
              <TableHead>Concluidos</TableHead>
              <TableHead>Certificados</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {stats.courseFunnelRows.map((r: any) => (
              <TableRow key={r.course}>
                <TableCell className="font-medium">{r.course}</TableCell>
                <TableCell>{r.purchased}</TableCell>
                <TableCell>{r.started}</TableCell>
                <TableCell>{r.completed}</TableCell>
                <TableCell>{r.certified}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  </div>
);
