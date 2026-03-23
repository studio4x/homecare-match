"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/components/auth/AuthProvider";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { MessageSquare, ArrowRight, X } from "lucide-react";
import { Link } from "react-router-dom";

export const AdminMessageAlert = () => {
  const { user } = useAuth();
  const [latestTicket, setLatestTicket] = useState<any>(null);
  const [isVisible, setIsVisible] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;

    const fetchLatestAdminMessage = async () => {
      try {
        // Busca o ticket mais recente que está em andamento
        const { data: tickets, error: ticketError } = await supabase
          .from("support_tickets")
          .select("id, subject, status, created_at")
          .eq("user_id", user.id)
          .neq("status", "closed")
          .order("created_at", { ascending: false })
          .limit(1);

        if (ticketError) throw ticketError;

        if (tickets && tickets.length > 0) {
          const ticket = tickets[0];
          
          // Verifica se a última mensagem desse ticket NÃO é do usuário logado
          const { data: messages, error: msgError } = await supabase
            .from("support_messages")
            .select("sender_id, message, created_at")
            .eq("ticket_id", ticket.id)
            .order("created_at", { ascending: false })
            .limit(1);

          if (msgError) throw msgError;

          if (messages && messages.length > 0 && messages[0].sender_id !== user.id) {
            setLatestTicket(ticket);
            setIsVisible(true);
          }
        }
      } catch (err) {
        console.error("[AdminMessageAlert] Erro:", err);
      } finally {
        setLoading(false);
      }
    };

    fetchLatestAdminMessage();

    // Inscrição em tempo real para novas mensagens
    const channel = supabase
      .channel("admin-messages-alerts")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "support_messages" },
        (payload) => {
          if (payload.new.sender_id !== user.id) {
             fetchLatestAdminMessage();
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user]);

  if (loading || !isVisible || !latestTicket) return null;

  return (
    <Card className="border-primary/20 bg-primary/5 shadow-md mb-6 animate-in fade-in slide-in-from-top duration-500">
      <CardContent className="p-4 flex flex-col sm:flex-row items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="bg-primary/20 p-2 rounded-full">
            <MessageSquare className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-primary leading-tight">Você tem uma mensagem do suporte!</h3>
            <p className="text-xs text-muted-foreground mt-0.5">Assunto: {latestTicket.subject}</p>
          </div>
        </div>
        <div className="flex items-center gap-2 w-full sm:w-auto">
          <Button variant="ghost" size="sm" className="h-8 text-xs shrink-0" onClick={() => setIsVisible(false)}>
            <X className="h-4 w-4 mr-1" /> Ignorar
          </Button>
          <Button asChild size="sm" className="h-8 text-xs gap-1 shrink-0">
            <Link to={`/dashboard/suporte/${latestTicket.id}`}>
              Responder agora <ArrowRight className="h-3 w-3" />
            </Link>
          </Button>
        </div>
      </CardContent>
    </Card>
  );
};
