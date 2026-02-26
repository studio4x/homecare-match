import { MapPin, Briefcase, Award, Star, ShieldCheck, Navigation } from "lucide-react";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Link } from "react-router-dom";
import { cn } from "@/lib/utils";

interface ProfessionalCardProps {
  id: string;
  name: string;
  photo?: string;
  specialty: string;
  registration?: string;
  location: string;
  experience: string;
  isVerified?: boolean;
  subscriptionTier?: string;
  distance?: number;
  completedCoursesCount?: number;
}

const ProfessionalCard = ({
  id,
  name,
  photo,
  specialty,
  registration,
  location,
  experience,
  isVerified = false,
  subscriptionTier = 'monthly',
  distance,
  completedCoursesCount = 0
}: ProfessionalCardProps) => {
  const initials = (name || "")
    .split(" ")
    .filter(Boolean)
    .map((n) => n[0])
    .join("")
    .slice(0, 2)
    .toUpperCase() || "??";

  const isPremium = subscriptionTier === 'yearly';
  const completedCoursesLabel = completedCoursesCount === 1
    ? "1 curso concluído na plataforma"
    : `${completedCoursesCount} cursos concluídos na plataforma`;

  return (
    <div className={cn(
      "group relative flex flex-col overflow-hidden rounded-3xl border bg-card/95 p-4 shadow-card transition-all duration-300 hover:-translate-y-0.5 hover:shadow-card-hover sm:p-6",
      isPremium ? "border-amber-400/50 ring-1 ring-amber-400/20" : "border-border"
    )}>
      <div className={cn(
        "absolute inset-x-0 top-0 h-1",
        isPremium
          ? "bg-gradient-to-r from-amber-300 via-amber-500 to-amber-300"
          : "bg-gradient-to-r from-primary/10 via-primary/25 to-success/15"
      )} />
      <div className="mb-4 flex items-start gap-4">
        <div className="relative">
          <Avatar className={cn(
            "h-14 w-14 ring-2 transition-all group-hover:ring-offset-2 sm:h-16 sm:w-16",
            isPremium ? "ring-gold" : "ring-border"
          )}>
            <AvatarImage src={photo} alt={name} />
            <AvatarFallback className="bg-primary/10 text-base font-semibold text-primary sm:text-lg">
              {initials}
            </AvatarFallback>
          </Avatar>
        </div>
        <div className="flex-1">
          <div className="flex items-center gap-1">
            <h3 className="font-semibold text-foreground line-clamp-1">{name || "Profissional"}</h3>
            {isPremium && <Star className="h-4 w-4 text-gold fill-gold" />}
            {isVerified && <ShieldCheck className="h-4 w-4 text-success" />}
          </div>
          <Badge variant="secondary" className="mt-1">
            {specialty}
          </Badge>
        </div>
      </div>

      <div className="flex-1 space-y-2">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Award className="h-4 w-4 text-primary shrink-0" />
          <span className="line-clamp-1">{completedCoursesLabel}</span>
        </div>
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <MapPin className="h-4 w-4 text-primary shrink-0" />
          <span className="line-clamp-1">{location}</span>
        </div>
        
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Briefcase className="h-4 w-4 text-primary shrink-0" />
          <span className="line-clamp-1">{experience || "Ver currículo"}</span>
        </div>

        {/* Exibição da Distância movida para o final */}
        {distance !== undefined && distance < 9999 && (
          <div className="flex items-center gap-2 text-xs font-semibold text-primary bg-primary/5 p-1.5 rounded-md w-fit mt-1">
            <Navigation className="h-3 w-3 fill-current" />
            <span>{distance} km de você</span>
          </div>
        )}
      </div>

      <Button variant={isPremium ? "default" : "outline"} className={cn("mt-5 h-11 w-full", isPremium && "border-none bg-gold hover:opacity-90")} asChild>
        <Link to={`/profissional/${id}`}>Ver Perfil Completo</Link>
      </Button>
    </div>
  );
};

export default ProfessionalCard;
