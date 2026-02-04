"use client";

import { useState } from "react";
import { Link } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Users, ArrowRight, Trash2, Building2, Home, Phone } from "lucide-react";
import {
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationNext,
  PaginationPrevious,
} from "@/components/ui/pagination";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";

interface Interaction {
  interacted_at: string;
  profile: {
    id: string;
    full_name: string;
    avatar_url: string;
    specialty?: string;
    role?: string;
    phone?: string;
  };
}

interface InteractionHistoryProps {
  title: string;
  interactions: Interaction[];
  loading: boolean;
  totalItems: number;
  itemsPerPage: number;
  currentPage: number;
  onPageChange: (page: number) => void;
  onClear: () => void;
  viewerRole: 'professional' | 'company' | 'family';
}

const InteractionHistory = ({
  title,
  interactions,
  loading,
  totalItems,
  itemsPerPage,
  currentPage,
  onPageChange,
  onClear,
  viewerRole,
}: InteractionHistoryProps) => {
  const [contactModalOpen, setContactModalOpen] = useState(false);
  const [selectedContact, setSelectedContact] = useState<Interaction['profile'] | null>(null);

  const handleContactClick = (profile: Interaction['profile']) => {
    setSelectedContact(profile);
    setContactModalOpen(true);
  };

  const getInitials = (name: string) =>
    name
      ?.split(" ")
      .map((n) => n[0])
      .join("")
      .slice(0, 2)
      .toUpperCase() || "??";

  const totalPages = Math.ceil(totalItems / itemsPerPage);

  return (
    <>
      <Card className="shadow-card flex flex-col">
        <CardHeader className="flex-row items-center justify-between">
          <CardTitle>{title}</CardTitle>
          {totalItems > 0 && !loading && (
            <Button variant="ghost" size="sm" className="h-8 text-xs text-muted-foreground hover:text-destructive" onClick={onClear}>
              <Trash2 className="h-3 w-3 mr-1" />
              Limpar Lista
            </Button>
          )}
        </CardHeader>
        <CardContent className="flex-grow">
          <div className="space-y-4">
            {loading ? (
              Array.from({ length: 3 }).map((_, i) => (
                <div key={i} className="flex items-center gap-4">
                  <Skeleton className="h-12 w-12 rounded-full" />
                  <div className="flex-1 space-y-2">
                    <Skeleton className="h-4 w-3/4" />
                    <Skeleton className="h-3 w-1/2" />
                  </div>
                </div>
              ))
            ) : interactions.length > 0 ? (
              interactions.map(({ interacted_at, profile }) => (
                <div key={profile.id} className="flex items-center justify-between gap-4 rounded-lg p-3 hover:bg-secondary/50 transition-colors">
                  <div className="flex items-center gap-4">
                    <Avatar className="h-12 w-12">
                      <AvatarImage src={profile.avatar_url} />
                      <AvatarFallback>{getInitials(profile.full_name)}</AvatarFallback>
                    </Avatar>
                    <div>
                      <div className="flex items-center gap-2">
                        <p className="font-semibold text-foreground">{profile.full_name}</p>
                        {profile.role && profile.role !== 'professional' && (
                          <Badge variant={profile.role === 'company' ? "secondary" : "outline"} className="capitalize flex items-center gap-1 text-xs">
                            {profile.role === 'company' ? (
                              <>
                                <Building2 className="h-3 w-3" />
                                Empresa
                              </>
                            ) : (
                              <>
                                <Home className="h-3 w-3" />
                                Família
                              </>
                            )}
                          </Badge>
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground">
                        Contato em: {new Date(interacted_at).toLocaleDateString('pt-BR')}
                      </p>
                    </div>
                  </div>
                  {viewerRole === 'professional' ? (
                    <Button variant="default" size="sm" onClick={() => handleContactClick(profile)} className="gap-2">
                      Contato <Phone className="h-3 w-3" />
                    </Button>
                  ) : (
                    <Button variant="ghost" size="sm" asChild>
                      <Link to={`/profissional/${profile.id}`}>
                        Ver Perfil <ArrowRight className="h-3 w-3 ml-2" />
                      </Link>
                    </Button>
                  )}
                </div>
              ))
            ) : (
              <div className="py-10 text-center text-muted-foreground">
                <Users className="mx-auto h-8 w-8 mb-2" />
                <p className="text-sm">Nenhuma interação registrada ainda.</p>
              </div>
            )}
          </div>
        </CardContent>
        {totalPages > 1 && (
          <CardFooter className="border-t pt-4">
            <Pagination>
              <PaginationContent>
                <PaginationItem>
                  <PaginationPrevious
                    href="#"
                    onClick={(e) => {
                      e.preventDefault();
                      if (currentPage > 1) onPageChange(currentPage - 1);
                    }}
                    className={cn("cursor-pointer", currentPage === 1 && "pointer-events-none opacity-50")}
                  />
                </PaginationItem>
                <PaginationItem>
                  <span className="text-sm font-medium text-muted-foreground">
                    Página {currentPage} de {totalPages}
                  </span>
                </PaginationItem>
                <PaginationItem>
                  <PaginationNext
                    href="#"
                    onClick={(e) => {
                      e.preventDefault();
                      if (currentPage < totalPages) onPageChange(currentPage + 1);
                    }}
                    className={cn("cursor-pointer", currentPage === totalPages && "pointer-events-none opacity-50")}
                  />
                </PaginationItem>
              </PaginationContent>
            </Pagination>
          </CardFooter>
        )}
      </Card>

      <Dialog open={contactModalOpen} onOpenChange={setContactModalOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Informações de Contato</DialogTitle>
            <DialogDescription>
              Entre em contato com {selectedContact?.full_name} para discutir oportunidades.
            </DialogDescription>
          </DialogHeader>
          <div className="py-4 space-y-4">
            <div className="flex items-center gap-3 rounded-lg border p-4">
              <Phone className="h-5 w-5 text-primary" />
              <div>
                <p className="text-sm text-muted-foreground">WhatsApp</p>
                <p className="font-semibold">{selectedContact?.phone || "Não informado"}</p>
              </div>
            </div>
            {selectedContact?.phone && (
              <Button asChild className="w-full gap-2">
                <a href={`https://wa.me/${selectedContact.phone.replace(/\D/g, '')}`} target="_blank" rel="noopener noreferrer">
                  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"></path><path d="M14.05 2.95A16 16 0 0 1 21.05 9.95"></path><path d="M14.05 6.95A12 12 0 0 1 17.05 9.95"></path></svg>
                  Iniciar Conversa
                </a>
              </Button>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
};

export default InteractionHistory;