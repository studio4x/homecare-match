"use client";

import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Users, Eye, Star, CheckCircle2, Loader2, Clock, AlertCircle } from "lucide-react";
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
import ReviewForm from "./ReviewForm";
import { useAuth } from "@/components/auth/AuthProvider";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

const WhatsAppIcon = ({ className, ...props }: React.ComponentProps<"svg">) => (
  <svg viewBox="0 0 24 24" fill="currentColor" className={className} {...props}>
    <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.272-.57-.422z" />
    <path fillRule="evenodd" clipRule="evenodd" d="M12 2C6.48 2 2 6.48 2 12c0 1.85.5 3.58 1.38 5.08L2 22l5.05-1.32A9.95 9.95 0 0012 22c5.52 0 10-4.48 10-10S17.52 2 12 2zm0 18c-1.65 0-3.21-.49-4.54-1.33l-.33-.21-3.37.88.9-3.28-.21-.34A7.95 7.95 0 014 12c0-4.41 3.59-8 8-8s8 3.59 8 8-3.59 8-8 8z" />
  </svg>
);

interface Interaction {
  id?: string;
  interacted_at: string;
  status?: string;
  profile: {
    id: string;
    full_name: string;
    avatar_url: string;
    role?: string;
    phone?: string;
    city?: string;
    state?: string;
    neighborhood?: string;
    bio?: string;
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
  const { user } = useAuth();
  const [contactModalOpen, setContactModalOpen] = useState(false);
  const [selectedContact, setSelectedContact] = useState<Interaction['profile'] | null>(null);
  const [reviewModalOpen, setReviewModalOpen] = useState(false);
  const [profileToReview, setProfileToReview] = useState<Interaction['profile'] | null>(null);
  const [isUpdatingStatus, setIsUpdatingStatus] = useState<string | null>(null);
  const [reviewedProfiles, setReviewedProfiles] = useState<string[]>([]);

  useEffect(() => {
    const fetchReviews = async () => {
      if (!user) return;
      const { data } = await supabase
        .from('reviews')
        .select('subject_id')
        .eq('reviewer_id', user.id);
      
      if (data) {
        setReviewedProfiles(data.map((r: any) => r.subject_id));
      }
    };
    fetchReviews();
  }, [user, reviewModalOpen]);

  const handleStatusUpdate = async (interactionId: string, currentStatus: string) => {
    setIsUpdatingStatus(interactionId);
    
    let newStatus = 'pending';
    const isProf = viewerRole === 'professional';

    if (isProf) {
      newStatus = currentStatus === 'sender_confirmed' ? 'completed' : 'professional_confirmed';
    } else {
      newStatus = currentStatus === 'professional_confirmed' ? 'completed' : 'sender_confirmed';
    }

    try {
      const { error } = await supabase
        .from('interactions')
        .update({ status: newStatus })
        .eq('id', interactionId);
      
      if (error) throw error;
      
      toast.success(newStatus === 'completed' ? "Atendimento concluído com sucesso!" : "Sua confirmação foi registrada.");
      setTimeout(() => window.location.reload(), 1000);
    } catch (err: any) {
      console.error(err);
      toast.error("Erro ao atualizar status.");
    } finally {
      setIsUpdatingStatus(null);
    }
  };

  const handleContactClick = (profile: Interaction['profile']) => {
    setSelectedContact(profile);
    setContactModalOpen(true);
  };

  const handleReviewClick = (profile: Interaction['profile']) => {
    setProfileToReview(profile);
    setReviewModalOpen(true);
  };

  const getInitials = (name: string) =>
    name?.split(" ").map((n) => n[0]).join("").slice(0, 2).toUpperCase() || "??";

  const getWhatsappMessage = (contact: Interaction['profile']) => {
    if (viewerRole === 'professional') {
      return ['Olá.', '', 'Vi que você teve interesse no meu perfil na HomeCare Match.', 'Podemos conversar?'].join('\n');
    }
    return [`Olá, ${contact.full_name}.`, '', 'Vi seu perfil na HomeCare Match e gostaria de conversar.', 'Podemos falar?'].join('\n');
  };

  const maskPhone = (phone: string | undefined) => {
    if (!phone) return "Não informado";
    // Mantém o DDD e os últimos 4 dígitos, mascarando o meio
    // Ex: (11) 99999-1234 -> (11) *****-1234
    if (phone.includes('(') && phone.includes(')')) {
      const parts = phone.split(')');
      const ddd = parts[0] + ')';
      const rest = parts[1];
      const maskedRest = rest.replace(/\d(?=\d{4})/g, "*");
      return ddd + maskedRest;
    }
    return phone.replace(/\d(?=\d{4})/g, "*");
  };

  const totalPages = Math.ceil(totalItems / itemsPerPage);

  const renderStatusButton = (interaction: Interaction) => {
    const status = interaction.status || 'pending';
    const isProf = viewerRole === 'professional';
    const interactionId = interaction.id!;
    const hasReviewed = reviewedProfiles.includes(interaction.profile.id);

    if (status === 'completed') {
      return (
        <div className="flex items-center gap-2">
          <Badge className="bg-success text-white hover:bg-success">
            <CheckCircle2 className="h-3 w-3 mr-1" /> Realizado
          </Badge>
          {hasReviewed ? (
            <Button variant="ghost" size="sm" disabled className="gap-1.5 h-8 text-yellow-600 opacity-70">
              <Star className="h-4 w-4 fill-yellow-600" /> <span className="text-xs">Avaliado</span>
            </Button>
          ) : (
            <Button 
              variant="outline" 
              size="sm" 
              onClick={() => handleReviewClick(interaction.profile)} 
              className="gap-1.5 h-8 border-yellow-500/50 text-yellow-600 hover:bg-yellow-50"
            >
              <Star className="h-4 w-4" /> <span className="text-xs">Avaliar</span>
            </Button>
          )}
        </div>
      );
    }

    if (isProf && status === 'professional_confirmed') {
      return (
        <Badge variant="outline" className="border-primary/30 text-primary bg-primary/5 h-8">
          <Clock className="h-3 w-3 mr-1" /> Aguardando Contratante
        </Badge>
      );
    }

    if (!isProf && status === 'sender_confirmed') {
      return (
        <Badge variant="outline" className="border-primary/30 text-primary bg-primary/5 h-8">
          <Clock className="h-3 w-3 mr-1" /> Aguardando Profissional
        </Badge>
      );
    }

    const needsMyConfirmation = (isProf && status === 'sender_confirmed') || (!isProf && status === 'professional_confirmed');
    
    return (
      <Button 
        variant={needsMyConfirmation ? "default" : "outline"}
        size="sm" 
        onClick={() => handleStatusUpdate(interactionId, status)} 
        disabled={isUpdatingStatus === interactionId}
        className={cn(
          "gap-1.5 h-8",
          needsMyConfirmation ? "bg-primary" : "border-success/30 text-success hover:bg-success/5"
        )}
      >
        {isUpdatingStatus === interactionId ? (
          <Loader2 className="h-3 w-3 animate-spin" />
        ) : needsMyConfirmation ? (
          <AlertCircle className="h-3 w-3" />
        ) : (
          <CheckCircle2 className="h-3 w-3" />
        )}
        <span className="text-xs">
          {needsMyConfirmation ? "Confirmar Atendimento" : "Atendimento Realizado"}
        </span>
      </Button>
    );
  };

  return (
    <>
      <Card className="shadow-card flex flex-col">
        <CardHeader className="flex-row items-center justify-between">
          <CardTitle>{title}</CardTitle>
          {totalItems > 0 && !loading && (
            <Button variant="ghost" size="sm" className="h-8 text-xs text-muted-foreground hover:text-destructive" onClick={onClear}>
              <Users className="h-3 w-3 mr-1" />
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
                  <div className="flex-1 space-y-2"><Skeleton className="h-4 w-3/4" /><Skeleton className="h-3 w-1/2" /></div>
                </div>
              ))
            ) : interactions.length > 0 ? (
              interactions.map((interaction) => (
                <div key={interaction.profile.id} className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 rounded-lg p-3 hover:bg-secondary/50 transition-colors border sm:border-0">
                  <div className="flex items-center gap-4 flex-1 min-w-0">
                    <Avatar className="h-12 w-12 shrink-0">
                      <AvatarImage src={interaction.profile.avatar_url} />
                      <AvatarFallback>{getInitials(interaction.profile.full_name)}</AvatarFallback>
                    </Avatar>
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="font-semibold text-foreground truncate max-w-[150px]">{interaction.profile.full_name}</p>
                        {interaction.profile.role && interaction.profile.role !== 'professional' && (
                          <Badge variant={interaction.profile.role === 'company' ? "secondary" : "outline"} className="capitalize flex items-center gap-1 text-xs whitespace-nowrap">
                            {interaction.profile.role === 'company' ? "Empresa" : "Família"}
                          </Badge>
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground">Contato em: {new Date(interaction.interacted_at).toLocaleDateString('pt-BR')}</p>
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-2 flex-wrap sm:flex-nowrap">
                    {renderStatusButton(interaction)}

                    <Button variant="ghost" size="sm" asChild className="h-8">
                      <Link to={viewerRole === 'professional' ? `/recruiter/${interaction.profile.id}` : `/profissional/${interaction.profile.id}`}>
                        <Eye className="h-4 w-4" /> <span className="hidden sm:inline">Perfil</span>
                      </Link>
                    </Button>
                    
                    <Button variant="default" size="sm" onClick={() => handleContactClick(interaction.profile)} className="gap-2 h-8 bg-green-600 hover:bg-green-700">
                      <span className="hidden sm:inline">WhatsApp</span> <WhatsAppIcon className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              ))
            ) : (
              <div className="py-10 text-center text-muted-foreground"><Users className="mx-auto h-8 w-8 mb-2" /><p className="text-sm">Nenhuma interação registrada ainda.</p></div>
            )}
          </div>
        </CardContent>
        {totalPages > 1 && (
          <CardFooter className="border-t pt-4">
            <Pagination>
              <PaginationContent>
                <PaginationItem>
                  <PaginationPrevious href="#" onClick={(e) => { e.preventDefault(); if (currentPage > 1) onPageChange(currentPage - 1); }} className={cn("cursor-pointer", currentPage === 1 && "pointer-events-none opacity-50")} />
                </PaginationItem>
                <PaginationItem><span className="text-sm font-medium text-muted-foreground">Página {currentPage} de {totalPages}</span></PaginationItem>
                <PaginationItem>
                  <PaginationNext href="#" onClick={(e) => { e.preventDefault(); if (currentPage < totalPages) onPageChange(currentPage + 1); }} className={cn("cursor-pointer", currentPage === totalPages && "pointer-events-none opacity-50")} />
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
            <DialogDescription>Entre em contato com {selectedContact?.full_name}.</DialogDescription>
          </DialogHeader>
          <div className="py-4 space-y-4">
            <div className="flex items-center gap-3 rounded-lg border p-4">
              <WhatsAppIcon className="h-6 w-6 text-green-600" />
              <div>
                <p className="text-sm text-muted-foreground">WhatsApp</p>
                <p className="font-semibold">{maskPhone(selectedContact?.phone)}</p>
              </div>
            </div>
            {selectedContact?.phone && (
              <Button asChild className="w-full gap-2 bg-green-600 hover:bg-green-700">
                <a href={`https://wa.me/${selectedContact.phone.replace(/\D/g, '')}?text=${encodeURIComponent(getWhatsappMessage(selectedContact))}`} target="_blank" rel="noopener noreferrer">
                  <WhatsAppIcon className="h-4 w-4" /> Iniciar Conversa
                </a>
              </Button>
            )}
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={reviewModalOpen} onOpenChange={setReviewModalOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader><DialogTitle>Avaliar Atendimento</DialogTitle><DialogDescription>Deixe sua opinião sobre o atendimento de <strong>{profileToReview?.full_name}</strong>.</DialogDescription></DialogHeader>
          {user && profileToReview && (
            <ReviewForm 
              reviewerId={user.id} 
              subjectId={profileToReview.id} 
              onSuccess={() => {
                setReviewModalOpen(false);
                setReviewedProfiles(prev => [...prev, profileToReview.id]);
              }} 
            />
          )}
        </DialogContent>
      </Dialog>
    </>
  );
};

export default InteractionHistory;