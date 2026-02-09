"use client";

import { Star, StarHalf } from "lucide-react";
import { cn } from "@/lib/utils";

interface StarRatingProps {
  rating: number;
  max?: number;
  size?: number;
  className?: string;
  interactive?: boolean;
  onRatingChange?: (rating: number) => void;
}

const StarRating = ({ 
  rating, 
  max = 5, 
  size = 16, 
  className,
  interactive = false,
  onRatingChange 
}: StarRatingProps) => {
  const fullStars = Math.floor(rating);
  const hasHalfStar = rating % 1 >= 0.5;

  return (
    <div className={cn("flex items-center gap-0.5", className)}>
      {[...Array(max)].map((_, i) => {
        const starValue = i + 1;
        const isFull = starValue <= fullStars;
        const isHalf = !isFull && starValue === fullStars + 1 && hasHalfStar;

        return (
          <button
            key={i}
            type="button"
            disabled={!interactive}
            onClick={() => interactive && onRatingChange?.(starValue)}
            className={cn(
              "transition-transform",
              interactive ? "hover:scale-110 active:scale-95 cursor-pointer" : "cursor-default"
            )}
          >
            {isFull ? (
              <Star 
                size={size} 
                className="fill-yellow-400 text-yellow-400" 
              />
            ) : isHalf ? (
              <StarHalf 
                size={size} 
                className="fill-yellow-400 text-yellow-400" 
              />
            ) : (
              <Star 
                size={size} 
                className="text-muted-foreground/30" 
              />
            )}
          </button>
        );
      })}
    </div>
  );
};

export default StarRating;