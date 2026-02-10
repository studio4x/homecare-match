"use client";

import { useState, useEffect, useRef } from "react";
import { useParams, Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/components/auth/AuthProvider";
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { 
  Loader2, 
  ArrowLeft, 
  Send, 
  Clock, 
  CheckCircle2,
  AlertCircle
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

const TicketDetailPage = () => {
  const { id } = useParams();
  const { user } = useAuth();
  const [ticket, setTicket] = useState<any>(null);
  const [messages, setMessages] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [newMessage, setNewMessage] = useState("");
  const [isSending, setIsSending] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (id) {
      fetchTicket();
      fetchMessages();
      
      // Real-time subscription
      const channel = supabase
        .channel(`ticket-${id}`)
        .on('postgres_changes', { 
          event: 'INSERT', 
          schema: 'public', 
          table: 'support_messages',
          filter: `ticket_id=eq.${id}`
        }, (payload) => {
          setMessages(prev => [...prev, payload.new]);
        })
        .subscribe();

      return () => { supabase.removeChannel(channel); };
    }
  }, [id]);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const fetchTicket = async () => {
    try {
      const { data, error } = await supabase
        .from("support_tickets")
        .select("*, user:profiles!support_tickets_user_id_fkey(full_name, avatar_url)")
        .eq("id", id)
        .single();
      if (error) throw error;
      setTicket(data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const fetchMessages = async () => {
    try {
      const { data, error } = await supabase
        .from("support_messages")
        .select("*")
        .eq("ticket_id", id)
        .order("created_at", { ascending: true });
      if (error) throw error;
      setMessages(data || []);
    } catch (err) {
      console.error(err);
    }
  };

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMessage.trim() || isSending) return;

    setIsSending(true);
    try {
      const { error } = await supabase
        .from("support_messages")
        .insert({
          ticket_id: id,
          sender_id: user?.id,
          message: newMessage.trim()
        });

      if (error) throw error;
      setNewMessage("");
    } catch (err) {
      toast.error("Erro ao enviar mensagem.");
    } finally {
      setIsSending(false);
    }
  };

  if (loading) return <div className="flex justify-center p-12"><Loader2 className="animate-spin text-primary" /></div>;
  if (!ticket) return <div className="text-center p-12">Chamado não encontrado.</div>;

  const isClosed = ticket.status === 'closed';

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" asChild>
          <Link to="/dashboard/suporte"><ArrowLeft className="h-5 w-5" /></Link>
        </Button>
        <div className="flex-1">
          <h1 className="text-2xl font-bold truncate">{ticket.subject}</h1>
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <span>Ticket #{ticket.id.slice(0, 8)}</span>
            <span>•</span>
            <span>Aberto em {new Date(ticket.created_at).toLocaleDateString('pt-BR')}</span>
          </div>
        </div>
        <Badge className={cn(
          ticket.status === 'open' ? "bg-blue-500" : 
          ticket.status === 'in_progress' ? "bg-amber-500" : "bg-slate-500"
        )}>
          {ticket.status === 'open' ? 'Aberto' : ticket.status === 'in_progress' ? 'Em Atendimento' : 'Fechado'}
        </Badge>
      </div>

      <div className="grid gap-6 md:grid-cols-4">
        <div className="md:col-span-3 space-y-4">
          <Card className="flex flex-col h-[600px]">
            <CardHeader className="border-b py-3">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <Clock className="h-4 w-4 text-muted-foreground" /> Histórico de Mensagens
              </CardTitle>
            </CardHeader>
            <CardContent className="flex-1 overflow-y-auto p-4 space-y-4" ref={scrollRef}>
              {/* Descrição Inicial */}
              <div className="flex justify-start">
                <div className="max-w-[80%] rounded-2xl rounded-tl-none bg-secondary/30 p-4 border">
                  <p className="text-xs font-bold mb-1 text-primary uppercase tracking-wider">Descrição do Problema</p>
                  <p className="text-sm whitespace-pre-wrap">{ticket.description}</p>
                  <p className="text-[10px] text-muted-foreground mt-2 text-right">
                    {new Date(ticket.created_at).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                  </p>
                </div>
              </div>

              {messages.map((msg) => {
                const isMe = msg.sender_id === user?.id;
                return (
                  <div key={msg.id} className={cn("flex", isMe ? "justify-end" : "justify-start")}>
                    <div className={cn(
                      "max-w-[80%] rounded-2xl p-3 shadow-sm",
                      isMe ? "bg-primary text-primary-foreground rounded-tr-none" : "bg-card border rounded-tl-none"
                    )}>
                      <p className="text-sm whitespace-pre-wrap">{msg.message}</p>
                      <p className={cn("text-[10px] mt-1 text-right opacity-70")}>
                        {new Date(msg.created_at).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                      </p>
                    </div>
                  </div>
                );
              })}
            </CardContent>
            <CardFooter className="border-t p-4">
              {isClosed ? (
                <div className="w-full flex items-center justify-center gap-2 text-muted-foreground bg-secondary/20 p-3 rounded-lg">
                  <CheckCircle2 className="h-4 w-4" />
                  <span className="text-sm font-medium">Este chamado foi encerrado.</span>
                </div>
              ) : (
                <form onSubmit={handleSendMessage} className="flex w-full gap-2">
                  <Input 
                    placeholder="Digite sua mensagem..." 
                    value={newMessage}
                    onChange={(e) => setNewMessage(e.target.value)}
                    disabled={isSending}
                  />
                  <Button type="submit" size="icon" disabled={isSending || !newMessage.trim()}>
                    {isSending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                  </Button>
                </form>
              )}
            </CardFooter>
          </Card>
        </div>

        <div className="space-y-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">Informações</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-1">
                <p className="text-[10px] uppercase font-bold text-muted-foreground">Prioridade</p>
                <Badge variant="outline" className="capitalize">{ticket.priority}</Badge>
              </div>
              <div className="space-y-1">
                <p className="text-[10px] uppercase font-bold text-muted-foreground">Última Atualização</p>
                <p className="text-xs">{new Date(ticket.updated_at).toLocaleString('pt-BR')}</p>
              </div>
            </CardContent>
          </Card>

          <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 flex gap-3">
            <AlertCircle className="h-5 w-5 text-amber-600 shrink-0" />
            <p className="text-xs text-amber-800 leading-relaxed">
              Nossa equipe responde em média em até 24 horas úteis.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default TicketDetailPage;