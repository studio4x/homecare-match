import { MapPin, Briefcase, Award } from "lucide-react";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

interface ProfessionalCardProps {
  name: string;
  photo?: string;
  specialty: string;
  registration: string;
  location: string;
  experience: string;
}

const ProfessionalCard = ({
  name,
  photo,
  specialty,
  registration,
  location,
  experience,
}: ProfessionalCardProps) => {
  const initials = name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  return (
    <div className="group flex flex-col rounded-2xl border border-border bg-card p-6 shadow-card transition-all duration-300 hover:shadow-card-hover">
      <div className="mb-4 flex items-start gap-4">
        <Avatar className="h-16 w-16 ring-2 ring-border transition-all group-hover:ring-primary/30">
          <AvatarImage src={photo} alt={name} />
          <AvatarFallback className="bg-primary/10 text-lg font-semibold text-primary">
            {initials}
          </AvatarFallback>
        </Avatar>
        <div className="flex-1">
          <h3 className="font-semibold text-foreground">{name}</h3>
          <Badge variant="secondary" className="mt-1">
            {specialty}
          </Badge>
        </div>
      </div>

      <div className="flex-1 space-y-2">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Award className="h-4 w-4 text-primary" />
          <span>{registration}</span>
        </div>
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <MapPin className="h-4 w-4 text-primary" />
          <span>{location}</span>
        </div>
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Briefcase className="h-4 w-4 text-primary" />
          <span>{experience}</span>
        </div>
      </div>

      <Button variant="outline" className="mt-6 w-full">
        Ver Perfil Completo
      </Button>
    </div>
  );
};

export default ProfessionalCard;
