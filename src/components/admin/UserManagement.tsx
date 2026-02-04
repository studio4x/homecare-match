"use client";

import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2, Trash2, Calendar } from "lucide-react";
import { differenceInDays, addDays } from "date-fns";

interface UserManagementProps {
  users: any[];
  plans: any[];
  updatingRole: string | null;
  updatingPlan: string | null;
  onUpdateRole: (userId: string, newRole: string) => void;
  onUpdatePlan: (userId: string, newPlan: string) => void;
  onDelete: (user: any) => void;
  currentUser: any;
  masterAdminEmail: string;
}

const UserManagement = ({
  users,
  plans,
  updatingRole,
  updatingPlan,
  onUpdateRole,
  onUpdatePlan,
  onDelete,
  currentUser,
  masterAdminEmail,
}: UserManagementProps) => {
  const getTrialStatus = (user: any) => {
    if (user.subscription_tier !== 'free_trial' || !user.trial_started_at) return null;
    const startDate = new Date(user.trial_started_at);
    const endDate = addDays(startDate, 30);
    const daysRemaining = differenceInDays(endDate, new Date());
    return daysRemaining;
  };

  return (
    <div className="rounded-xl border bg-card overflow-x-auto shadow-sm">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Nome</TableHead>
            <TableHead>E-mail</TableHead>
            <TableHead>Função</TableHead>
            <TableHead>Plano / Status</TableHead>
            <TableHead>Verificado</TableHead>
            <TableHead className="text-right">Ações</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {users.map((u) => {
            const daysLeft = getTrialStatus(u);
            return (
              <TableRow key={u.id}>
                <TableCell className="font-medium">{u.full_name || "Sem nome"}</TableCell>
                <TableCell>{u.email}</TableCell>
                <TableCell>
                  {updatingRole === u.id ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Select
                      defaultValue={u.role}
                      onValueChange={(value) => onUpdateRole(u.id, value)}
                      disabled={u.email === masterAdminEmail}
                    >
                      <SelectTrigger className="w-[140px] h-8 text-xs">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="professional">Profissional</SelectItem>
                        <SelectItem value="company">Empresa</SelectItem>
                        <SelectItem value="family">Família</SelectItem>
                        <SelectItem value="admin" disabled={u.email !== masterAdminEmail}>
                          Admin
                        </SelectItem>
                      </SelectContent>
                    </Select>
                  )}
                </TableCell>
                <TableCell>
                  <div className="space-y-1">
                    {updatingPlan === u.id ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Select
                        defaultValue={u.subscription_tier || 'monthly'}
                        onValueChange={(value) => onUpdatePlan(u.id, value)}
                        disabled={u.role !== 'professional'}
                      >
                        <SelectTrigger className="w-[140px] h-8 text-xs">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="free_trial">Teste Grátis</SelectItem>
                          {plans.map((plan) => (
                            <SelectItem key={plan.id} value={plan.id}>
                              {plan.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    )}
                    {daysLeft !== null && (
                      <div
                        className={`text-[10px] font-medium flex items-center gap-1 ${
                          daysLeft <= 0 ? 'text-destructive' : 'text-primary'
                        }`}
                      >
                        <Calendar className="h-3 w-3" />
                        {daysLeft <= 0 ? 'Expirado' : `${daysLeft} dias restantes`}
                      </div>
                    )}
                  </div>
                </TableCell>
                <TableCell>
                  {u.is_verified ? <Badge className="bg-success">Sim</Badge> : <Badge variant="secondary">Não</Badge>}
                </TableCell>
                <TableCell className="text-right">
                  {u.id !== currentUser?.id && u.email !== masterAdminEmail && (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="text-destructive hover:bg-destructive/10"
                      onClick={() => onDelete(u)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  )}
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
};

export default UserManagement;