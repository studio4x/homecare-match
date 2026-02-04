"use client";

import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ThumbsDown, ThumbsUp } from "lucide-react";

interface VerificationQueueProps {
  profiles: any[];
  onApprove: (profile: any) => void;
  onReject: (profile: any) => void;
}

const VerificationQueue = ({ profiles, onApprove, onReject }: VerificationQueueProps) => {
  return (
    <div className="rounded-xl border bg-card overflow-x-auto shadow-sm">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Profissional</TableHead>
            <TableHead>Documentos</TableHead>
            <TableHead className="text-right">Ações</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {profiles.length > 0 ? (
            profiles.map((p) => (
              <TableRow key={p.id}>
                <TableCell>
                  <div className="font-medium">{p.full_name}</div>
                  <div className="text-xs text-muted-foreground">{p.email}</div>
                </TableCell>
                <TableCell>
                  <div className="flex flex-wrap gap-2">
                    {p.id_document_url && (
                      <Button variant="outline" size="sm" asChild className="h-7 text-xs">
                        <a href={p.id_document_url} target="_blank" rel="noreferrer">
                          RG/CNH
                        </a>
                      </Button>
                    )}
                    {p.prof_registration_url && (
                      <Button variant="outline" size="sm" asChild className="h-7 text-xs">
                        <a href={p.prof_registration_url} target="_blank" rel="noreferrer">
                          Registro
                        </a>
                      </Button>
                    )}
                  </div>
                </TableCell>
                <TableCell className="text-right">
                  <Button variant="ghost" size="sm" className="text-destructive" onClick={() => onReject(p)}>
                    <ThumbsDown className="h-4 w-4 mr-1" />
                    Reprovar
                  </Button>
                  <Button variant="ghost" size="sm" className="text-success" onClick={() => onApprove(p)}>
                    <ThumbsUp className="h-4 w-4 mr-1" />
                    Aprovar
                  </Button>
                </TableCell>
              </TableRow>
            ))
          ) : (
            <TableRow>
              <TableCell colSpan={3} className="h-32 text-center text-muted-foreground">
                Nenhuma solicitação pendente.
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>
    </div>
  );
};

export default VerificationQueue;