"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Link as LinkIcon,
  Loader2,
  MessageSquare,
  ShieldAlert,
  Trash2,
  UserCheck,
} from "lucide-react";

interface Referral {
  id: string;
  referred_name: string;
  referred_phone?: string;
  referred_email?: string;
  referred_role?: string;
  status: string;
  created_at: string;
  type?: "manual" | "link";
  referrer: {
    full_name: string;
    email: string;
  };
}

interface ReferralsTabProps {
  referrals: Referral[];
  onDelete: (id: string, options?: { onSuccess?: () => void }) => void;
  isDeleting: boolean;
}

const ReferralsTab = ({ referrals, onDelete, isDeleting }: ReferralsTabProps) => {
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [referralToDelete, setReferralToDelete] = useState<Referral | null>(null);

  const handleDeleteReferral = () => {
    if (!referralToDelete) return;
    onDelete(referralToDelete.id, {
      onSuccess: () => {
        setDeleteModalOpen(false);
        setReferralToDelete(null);
      },
    });
  };

  const getWhatsappLink = (phone: string, name: string, status: string) => {
    const cleanPhone = phone.replace(/\D/g, "");
    const fallbackName = status === "company_pending" ? "empresa parceira" : "profissional";
    const message = encodeURIComponent(
      `Ola ${name || fallbackName}, sou da equipe HomeCare Match. Recebemos sua indicacao e gostaríamos de apresentar a plataforma!`,
    );
    return `https://wa.me/${cleanPhone}?text=${message}`;
  };

  const getRoleBadge = (role: string | undefined) => {
    if (!role) return null;

    if (role === "professional") {
      return (
        <Badge variant="secondary" className="mt-1 h-4 border-primary/20 bg-primary/10 text-[8px] uppercase text-primary">
          Profissional
        </Badge>
      );
    }
    if (role === "company") {
      return (
        <Badge variant="secondary" className="mt-1 h-4 text-[8px] uppercase">
          Empresa
        </Badge>
      );
    }
    if (role === "family") {
      return (
        <Badge variant="outline" className="mt-1 h-4 text-[8px] uppercase">
          Familia
        </Badge>
      );
    }
    return null;
  };

  const getStatusBadge = (referral: Referral) => {
    if (referral.status === "registered") return "Cadastrado";
    if (referral.status === "company_pending") return "Empresa indicada";
    if (referral.status === "pending") return "Pendente";
    return referral.status;
  };

  return (
    <div className="space-y-6">
      <div className="overflow-x-auto rounded-xl border bg-card shadow-sm">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Indicado</TableHead>
              <TableHead>Contato / Info</TableHead>
              <TableHead>Indicador</TableHead>
              <TableHead>Data</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Acoes</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {referrals.length > 0 ? (
              referrals.map((referral) => (
                <TableRow key={referral.id}>
                  <TableCell>
                    <div className="font-medium">{referral.referred_name || "Nao informado"}</div>
                    {referral.type === "link" ? getRoleBadge(referral.referred_role) : null}
                    {referral.type === "manual" && referral.status === "company_pending" ? (
                      <Badge variant="secondary" className="mt-1 h-4 text-[8px] uppercase">
                        Empresa
                      </Badge>
                    ) : null}
                  </TableCell>
                  <TableCell>
                    {referral.type === "manual" ? (
                      <a
                        href={`https://wa.me/${referral.referred_phone}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-sm text-primary hover:underline"
                      >
                        {referral.referred_phone}
                      </a>
                    ) : (
                      <div className="max-w-[150px] truncate text-xs text-muted-foreground">{referral.referred_email}</div>
                    )}
                  </TableCell>
                  <TableCell>
                    <div className="text-sm font-medium">{referral.referrer?.full_name || "N/A"}</div>
                    <div className="text-[10px] text-muted-foreground">{referral.referrer?.email}</div>
                  </TableCell>
                  <TableCell className="text-xs">{new Date(referral.created_at).toLocaleDateString("pt-BR")}</TableCell>
                  <TableCell>
                    <Badge variant={referral.type === "link" ? "default" : "secondary"} className="h-5 text-[10px] capitalize">
                      {referral.type === "link" ? <UserCheck className="mr-1 h-3 w-3" /> : null}
                      {getStatusBadge(referral)}
                    </Badge>
                  </TableCell>
                  <TableCell className="whitespace-nowrap text-right">
                    {referral.type === "manual" && referral.referred_phone ? (
                      <>
                        <Button variant="outline" size="sm" className="mr-2 h-8 gap-1 text-success hover:bg-success/10" asChild>
                          <a
                            href={getWhatsappLink(referral.referred_phone, referral.referred_name || "", referral.status)}
                            target="_blank"
                            rel="noopener noreferrer"
                          >
                            <MessageSquare className="h-4 w-4" />
                            WhatsApp
                          </a>
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-8 text-destructive hover:bg-destructive/10"
                          onClick={() => {
                            setReferralToDelete(referral);
                            setDeleteModalOpen(true);
                          }}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </>
                    ) : (
                      <Badge variant="outline" className="gap-1 text-[10px]">
                        <LinkIcon className="h-3 w-3" />
                        Via Link
                      </Badge>
                    )}
                  </TableCell>
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell colSpan={6} className="h-32 text-center text-muted-foreground">
                  Nenhuma indicacao encontrada.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      <Dialog open={deleteModalOpen} onOpenChange={setDeleteModalOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-destructive">
              <ShieldAlert className="h-5 w-5" />
              Excluir Indicacao
            </DialogTitle>
            <DialogDescription className="pt-2">
              Voce tem certeza que deseja excluir a indicacao de{" "}
              <strong>{referralToDelete?.referred_name || referralToDelete?.referred_phone}</strong>?
              <br />
              <br />
              Esta acao e irreversivel e removera o registro da indicacao.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="mt-4">
            <Button variant="ghost" onClick={() => setDeleteModalOpen(false)} disabled={isDeleting}>
              Cancelar
            </Button>
            <Button variant="destructive" onClick={handleDeleteReferral} disabled={isDeleting}>
              {isDeleting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              Confirmar Exclusao
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default ReferralsTab;
