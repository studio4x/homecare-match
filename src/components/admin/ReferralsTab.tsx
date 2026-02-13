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
  ShieldAlert,
  MessageSquare,
  Link as LinkIcon,
  UserCheck
} from "lucide-react";

interface Referral {
  id: string;
  referred_name: string;
  referred_phone?: string;
  referred_email?: string;
  referred_role?: string;
  status: string;
  created_at: string;
  type?: 'manual' | 'link';
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
      }
    });
  };

  const getWhatsappLink = (phone: string, name: string) => {
    const cleanPhone = phone.replace(/\D/g, '');
    const message = encodeURIComponent(`Olá \${name || 'profissional'}, sou da equipe HomeCare Match. Recebemos sua indicação e gostaríamos de te ajudar a se cadastrar na plataforma!`);
    return `https://wa.me/\${cleanPhone}?text=\${message}`;
  };

  return (
    <div className="space-y-6">
      <div className="rounded-xl border bg-card overflow-x-auto shadow-sm">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Indicado</TableHead>
              <TableHead>Contato / Info</TableHead>
              <TableHead>Indicador</TableHead>
              <TableHead>Data</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {referrals.length > 0 ? referrals.map(r => (
              <TableRow key={r.id}>
                <TableCell>
                  <div className="font-medium">{r.referred_name || 'Não informado'}</div>
                  {r.type === 'link' && (
                    <Badge variant="outline" className="text-[8px] h-4 uppercase mt-1">
                      {r.referred_role === 'professional' ? 'Profissional' : r.referred_role === 'company' ? 'Empresa' : 'Família'}
                    </Badge>
                  )}
                </TableCell>
                <TableCell>
                  {r.type === 'manual' ? (
                    <a href={`https://wa.me/\${r.referred_phone}`} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline text-sm">
                      {r.referred_phone}
                    </a>
                  ) : (
                    <div className="text-xs text-muted-foreground truncate max-w-[150px]">
                      {r.referred_email}
                    </div>
                  )}
                </TableCell>
                <TableCell>
                  <div className="font-medium text-sm">{r.referrer?.full_name || 'N/A'}</div>
                  <div className="text-[10px] text-muted-foreground">{r.referrer?.email}</div>
                </TableCell>
                <TableCell className="text-xs">{new Date(r.created_at).toLocaleDateString('pt-BR')}</TableCell>
                <TableCell>
                  <Badge variant={r.type === 'link' ? "default" : "secondary"} className="capitalize text-[10px] h-5">
                    {r.type === 'link' ? <UserCheck className="h-3 w-3 mr-1" /> : null}
                    {r.status === 'registered' ? 'Cadastrado' : r.status}
                  </Badge>
                </TableCell>
                <TableCell className="text-right whitespace-nowrap">
                  {r.type === 'manual' && r.referred_phone ? (
                    <>
                      <Button 
                        variant="outline" 
                        size="sm" 
                        className="text-success hover:bg-success/10 mr-2 h-8 gap-1"
                        asChild
                      >
                        <a 
                          href={getWhatsappLink(r.referred_phone, r.referred_name || '')} 
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
                        className="text-destructive hover:bg-destructive/10 h-8"
                        onClick={() => { setReferralToDelete(r); setDeleteModalOpen(true); }}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </>
                  ) : (
                    <Badge variant="outline" className="gap-1 text-[10px]">
                      <LinkIcon className="h-3 w-3" /> Via Link
                    </Badge>
                  )}
                </TableCell>
              </TableRow>
            )) : <TableRow><TableCell colSpan={6} className="h-32 text-center text-muted-foreground">Nenhuma indicação encontrada.</TableCell></TableRow>}
          </TableBody>
        </Table>
      </div>

      {/* Modal de Confirmação de Exclusão */}
      <Dialog open={deleteModalOpen} onOpenChange={setDeleteModalOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-destructive">
              <ShieldAlert className="h-5 w-5" />
              Excluir Indicação
            </DialogTitle>
            <DialogDescription className="pt-2">
              Você tem certeza que deseja excluir a indicação de <strong>{referralToDelete?.referred_name || referralToDelete?.referred_phone}</strong>?
              <br/><br/>
              Esta ação é irreversível e removerá o registro da indicação.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="mt-4">
            <Button variant="ghost" onClick={() => setDeleteModalOpen(false)} disabled={isDeleting}>
              Cancelar
            </Button>
            <Button variant="destructive" onClick={handleDeleteReferral} disabled={isDeleting}>
              {isDeleting ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              Confirmar Exclusão
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default ReferralsTab;