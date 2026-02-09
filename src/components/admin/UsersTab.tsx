"use client";

import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/components/auth/AuthProvider";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { 
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle
} from "@/components/ui/dialog";
import { 
  Loader2,
  Trash2,
  Calendar,
  LogIn,
  ShieldAlert
} from "lucide-react";
import { toast } from "sonner";
import { differenceInDays, addDays } from "date-fns";
import { translateAuthError } from "@/lib/error-utils";

interface UsersTabProps {
  allUsers: any[];
  plans: any[];
  refetchData: () => void;
}

const UsersTab = ({ allUsers, plans, refetchData }: UsersTabProps) => {
  const { user } = useAuth();
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [userToDelete, setUserToDelete] = useState<any>(null);
  const [isDeletingUser, setIsDeletingUser] = useState(false);
  const [isUpdatingRole, setIsUpdatingRole] = useState<string | null>(null);
  const [isUpdatingPlan, setIsUpdatingPlan] = useState<string | null>(null);
  const [isImpersonating, setIsImpersonating] = useState<string | null>(null);

  const MASTER_ADMIN_EMAIL = "homecarematch@studio4x.com.br";

  const getTierLabel = (tier: string) => {
    switch (tier.toLowerCase()) {
      case 'monthly': return 'Mensal';
      case 'yearly': return 'Anual';
      default: return tier;
    }
  };

  const handleUpdateRole = async (profileId: string, newRole: string) => {
    setIsUpdatingRole(profileId);
    try {
      const { error } = await supabase
        .from("profiles")
        .update({ role: newRole, is_admin: newRole === 'admin' })
        .eq("id", profileId);
      if (error) throw error;
      toast.success("Função atualizada com sucesso!");
      refetchData();
    } catch (err: any) {
      toast.error("Erro ao atualizar função.");
      console.error(err);
    } finally {
      setIsUpdatingRole(null);
    }
  };

  const handleUpdatePlan = async (profileId: string, newPlan: string) => {
    setIsUpdatingPlan(profileId);
    try {
      const updateData: any = { subscription_tier: newPlan };
      if (newPlan === 'free_trial') {
        updateData.trial_started_at = new Date().toISOString();
      }
      const { error } = await supabase
        .from("profiles")
        .update(updateData)
        .eq("id", profileId);
      if (error) throw error;
      toast.success("Plano atualizado com sucesso!");
      refetchData();
    } catch (err: any) {
      toast.error("Erro ao atualizar plano.");
      console.error(err);
    } finally {
      setIsUpdatingPlan(null);
    }
  };

  const handleDeleteUser = async () => {
    if (!userToDelete) return;
    setIsDeletingUser(true);
    try {
      const { error } = await supabase.functions.invoke('admin-delete-user', {
        body: { targetUserId: userToDelete.id }
      });
      if (error) throw error;
      toast.success("Usuário excluído definitivamente!");
      setDeleteModalOpen(false);
      setUserToDelete(null);
      refetchData();
    } catch (error: any) {
      toast.error(translateAuthError(error.message));
    } finally {
      setIsDeletingUser(false);
    }
  };

  const handleImpersonate = async (targetId: string) => {
    setIsImpersonating(targetId);
    try {
      const { data, error } = await supabase.functions.invoke("impersonate-login", {
        body: { targetUserId: targetId }
      });
      if (error || !data?.action_link) {
        toast.error("Não foi possível gerar o acesso.");
        setIsImpersonating(null);
        return;
      }
      try {
        const { data: adminLink } = await supabase.functions.invoke("impersonate-login", {
          body: { targetUserId: user?.id }
        });
        if (adminLink?.action_link) {
          localStorage.setItem("adminReturnLink", adminLink.action_link);
        }
      } catch (e) {
        console.warn("[Admin] Falha ao gerar link de retorno do admin:", e);
      }
      toast.info("Entrando como o usuário...");
      try {
        localStorage.setItem("impersonatingAdmin", "true");
        if (user?.email) localStorage.setItem("impersonatorEmail", user.email);
      } catch {}
      window.location.href = data.action_link;
    } catch (e) {
      console.error("[Admin] Impersonate error:", e);
      toast.error("Falha ao entrar como usuário.");
    } finally {
      setIsImpersonating(null);
    }
  };

  const getTrialStatus = (user: any) => {
    if (user.subscription_tier !== 'free_trial' || !user.trial_started_at) return null;
    const startDate = new Date(user.trial_started_at);
    const endDate = addDays(startDate, 30);
    return differenceInDays(endDate, new Date());
  };

  return (
    <>
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
            {allUsers.map(u => {
              const daysLeft = getTrialStatus(u);
              return (
                <TableRow key={u.id}>
                  <TableCell className="font-medium">{u.full_name || "Sem nome"}</TableCell>
                  <TableCell>{u.email}</TableCell>
                  <TableCell>
                    {isUpdatingRole === u.id ? <Loader2 className="h-4 w-4 animate-spin" /> : (
                      <Select 
                        defaultValue={u.role} 
                        onValueChange={(value) => handleUpdateRole(u.id, value)}
                        disabled={u.email === MASTER_ADMIN_EMAIL}
                      >
                        <SelectTrigger className="w-[140px] h-8 text-xs"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="professional">Profissional</SelectItem>
                          <SelectItem value="company">Empresa</SelectItem>
                          <SelectItem value="family">Família</SelectItem>
                          <SelectItem value="admin" disabled={u.email !== MASTER_ADMIN_EMAIL}>Admin</SelectItem>
                        </SelectContent>
                      </Select>
                    )}
                  </TableCell>
                  <TableCell>
                    <div className="space-y-1">
                      {isUpdatingPlan === u.id ? <Loader2 className="h-4 w-4 animate-spin" /> : (
                        <Select 
                          defaultValue={u.subscription_tier || 'monthly'} 
                          onValueChange={(value) => handleUpdatePlan(u.id, value)}
                          disabled={u.role !== 'professional'}
                        >
                          <SelectTrigger className="w-[140px] h-8 text-xs"><SelectValue /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="free_trial">Teste Grátis</SelectItem>
                            {plans.map(plan => (
                              <SelectItem key={plan.id} value={plan.id}>{getTierLabel(plan.name)}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      )}
                      {daysLeft !== null && (
                        <div className={`text-[10px] font-medium flex items-center gap-1 ${daysLeft <= 0 ? 'text-destructive' : 'text-primary'}`}>
                          <Calendar className="h-3 w-3" />
                          {daysLeft <= 0 ? 'Expirado' : `${daysLeft} dias restantes`}
                        </div>
                      )}
                    </div>
                  </TableCell>
                  <TableCell>{u.is_verified ? <Badge className="bg-success">Sim</Badge> : <Badge variant="secondary">Não</Badge>}</TableCell>
                  <TableCell className="text-right">
                    {u.id !== user?.id && u.email !== MASTER_ADMIN_EMAIL && (
                      <Button variant="ghost" size="sm" className="text-destructive hover:bg-destructive/10" onClick={() => { setUserToDelete(u); setDeleteModalOpen(true); }}>
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    )}
                    {u.id !== user?.id && (
                      <Button variant="ghost" size="sm" className="text-primary hover:bg-primary/10 ml-2" onClick={() => handleImpersonate(u.id)} disabled={isImpersonating === u.id}>
                        {isImpersonating === u.id ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <LogIn className="h-4 w-4 mr-1" />}
                        Entrar como
                      </Button>
                    )}
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>

      <Dialog open={deleteModalOpen} onOpenChange={setDeleteModalOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-destructive"><ShieldAlert className="h-5 w-5" />Excluir Usuário Definitivamente</DialogTitle>
            <DialogDescription className="pt-2">
              Esta ação é **irreversível**. Todos os dados de perfil, documentos e o acesso do usuário <strong>{userToDelete?.full_name || userToDelete?.email}</strong> serão excluídos permanentemente.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="mt-4">
            <Button variant="ghost" onClick={() => { setDeleteModalOpen(false); setUserToDelete(null); }} disabled={isDeletingUser}>Cancelar</Button>
            <Button variant="destructive" onClick={handleDeleteUser} disabled={isDeletingUser}>
              {isDeletingUser ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              Excluir Definitivamente
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
};

export default UsersTab;