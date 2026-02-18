"use client";

import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import StarRating from "./StarRating";
import { Loader2, Send } from "lucide-react";
import { toast } from "sonner";

interface ReviewFormProps {
  reviewerId: string;
  subjectId: string;
  onSuccess?: () => void;
}

const ReviewForm = ({ reviewerId, subjectId, onSuccess }: ReviewFormProps) => {
  const [rating, setRating] = useState(5);
  const [comment, setComment] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!reviewerId || !subjectId) return;

    setLoading(true);
    try {
      const { error } = await supabase.from('reviews').insert({
        reviewer_id: reviewerId,
        subject_id: subjectId,
        rating,
        comment: comment.trim()
      });

      if (error) {
        if (error.code === '23505') {
          toast.error("Você já avaliou este usuário.");
        } else {
          throw error;
        }
      } else {
        const myName = (await supabase.from('profiles').select('full_name').eq('id', reviewerId).single()).data?.full_name || "Um usuário";
        
        await supabase.from('notifications').insert({
          user_id: subjectId,
          title: "⭐ Nova Avaliação Recebida!",
          content: `${myName} te deu ${rating} estrelas e deixou um comentário sobre seu atendimento.`,
          link: "/dashboard",
          type: 'success'
        });

        toast.success("Avaliação enviada com sucesso!");
        setComment("");
        if (onSuccess) onSuccess();
      }
    } catch (err) {
      console.error("Erro ao enviar avaliação:", err);
      toast.error("Erro ao enviar avaliação.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div className="space-y-3 text-center">
        <Label className="text-base font-semibold">Sua nota para o atendimento</Label>
        <StarRating 
          rating={rating} 
          interactive 
          onRatingChange={setRating} 
          size={32} 
          className="justify-center" 
        />
        <p className="text-xs text-muted-foreground">Clique nas estrelas para avaliar</p>
      </div>

      <div className="space-y-2">
        <Label htmlFor="comment">Seu feedback (opcional)</Label>
        <Textarea
          id="comment"
          placeholder="Conte como foi sua experiência..."
          value={comment}
          onChange={(e) => setComment(e.target.value)}
          rows={4}
          className="resize-none"
        />
      </div>

      <Button type="submit" className="w-full gap-2" disabled={loading}>
        {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
        Enviar Avaliação
      </Button>
    </form>
  );
};

export default ReviewForm;