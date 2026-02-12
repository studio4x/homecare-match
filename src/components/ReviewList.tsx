"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import StarRating from "./StarRating";
import { Loader2, MessageSquare, User } from "lucide-react";

interface Review {
  id: string;
  rating: number;
  comment: string;
  created_at: string;
  reviewer: {
    full_name: string;
    avatar_url: string;
  } | null;
}

interface ReviewListProps {
  subjectId: string;
}

const ReviewList = ({ subjectId }: ReviewListProps) => {
  const [reviews, setReviews] = useState<Review[]>([]);
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({ average: 0, total: 0 });

  useEffect(() => {
    const fetchReviews = async () => {
      setLoading(true);
      try {
        const { data, error } = await supabase
          .from('reviews')
          .select(`
            id, 
            rating, 
            comment, 
            created_at,
            reviewer:reviewer_id (full_name, avatar_url)
          `)
          .eq('subject_id', subjectId)
          .order('created_at', { ascending: false });

        if (error) throw error;

        const typedData = data as any[];
        setReviews(typedData);

        if (typedData.length > 0) {
          const sum = typedData.reduce((acc, curr) => acc + curr.rating, 0);
          setStats({
            average: Number((sum / typedData.length).toFixed(1)),
            total: typedData.length
          });
        }
      } catch (err) {
        console.error("Erro ao carregar avaliações:", err);
      } finally {
        setLoading(false);
      }
    };

    if (subjectId) fetchReviews();
  }, [subjectId]);

  if (loading) return <div className="flex justify-center p-4"><Loader2 className="animate-spin h-5 w-5 text-primary" /></div>;

  return (
    <div className="space-y-6">
      {stats.total > 0 && (
        <div className="flex items-center gap-4 bg-secondary/20 p-4 rounded-xl">
          <div className="text-center border-r pr-4">
            <div className="text-3xl font-bold text-foreground">{stats.average}</div>
            <StarRating rating={stats.average} size={14} className="justify-center" />
          </div>
          <div className="text-sm text-muted-foreground">
            Baseado em {stats.total} {stats.total === 1 ? 'avaliação' : 'avaliações'}
          </div>
        </div>
      )}

      <div className="space-y-4">
        {reviews.length > 0 ? (
          reviews.map((review) => (
            <div key={review.id} className="border-b pb-4 last:border-0 last:pb-0">
              <div className="flex items-start gap-3">
                <Avatar className="h-8 w-8">
                  <AvatarImage src={review.reviewer?.avatar_url} />
                  <AvatarFallback>
                    {review.reviewer?.full_name?.charAt(0) || <User className="h-4 w-4" />}
                  </AvatarFallback>
                </Avatar>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-medium text-sm truncate">
                      {review.reviewer?.full_name || "Usuário Removido"}
                    </span>
                    <span className="text-[10px] text-muted-foreground">
                      {new Date(review.created_at).toLocaleDateString('pt-BR')}
                    </span>
                  </div>
                  <StarRating rating={review.rating} size={12} className="mt-0.5" />
                  {review.comment && (
                    <p className="mt-2 text-sm text-muted-foreground leading-relaxed italic">
                      "{review.comment}"
                    </p>
                  )}
                </div>
              </div>
            </div>
          ))
        ) : (
          <div className="text-center py-8 text-muted-foreground">
            <MessageSquare className="h-8 w-8 mx-auto mb-2 opacity-20" />
            <p className="text-sm">Nenhuma avaliação ainda.</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default ReviewList;