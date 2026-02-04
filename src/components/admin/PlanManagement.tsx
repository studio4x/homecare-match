"use client";

import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Edit2, Plus } from "lucide-react";

interface PlanManagementProps {
  plans: any[];
  onNew: () => void;
  onEdit: (plan: any) => void;
}

const PlanManagement = ({ plans, onNew, onEdit }: PlanManagementProps) => {
  return (
    <div>
      <div className="mb-4 flex justify-end">
        <Button onClick={onNew} className="gap-2">
          <Plus className="h-4 w-4" /> Novo Plano
        </Button>
      </div>
      <div className="rounded-xl border bg-card overflow-x-auto shadow-sm">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Nome</TableHead>
              <TableHead>Preço</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            <TableRow>
              <TableCell>
                <div className="font-medium">Teste Grátis (Sistema)</div>
                <div className="text-xs text-muted-foreground text-primary">Plano Padrão de Cadastro</div>
              </TableCell>
              <TableCell>R$ 0,00/30 dias</TableCell>
              <TableCell>
                <Badge variant="outline">Automático</Badge>
              </TableCell>
              <TableCell className="text-right">
                <span className="text-xs text-muted-foreground px-2">Gerido pelo sistema</span>
              </TableCell>
            </TableRow>
            {plans.length > 0 &&
              plans.map((p) => (
                <TableRow key={p.id}>
                  <TableCell>
                    <div className="font-medium">{p.name}</div>
                    <div className="text-xs text-muted-foreground">{p.id}</div>
                  </TableCell>
                  <TableCell>
                    {p.price}/{p.period}
                  </TableCell>
                  <TableCell>{p.popular && <Badge variant="secondary" className="bg-primary/10 text-primary">Popular</Badge>}</TableCell>
                  <TableCell className="text-right">
                    <Button variant="ghost" size="sm" onClick={() => onEdit(p)}>
                      <Edit2 className="h-4 w-4" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
};

export default PlanManagement;