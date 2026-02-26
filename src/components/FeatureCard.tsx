import { LucideIcon } from "lucide-react";

interface FeatureCardProps {
  icon: LucideIcon;
  title: string;
  description: string;
}

const FeatureCard = ({ icon: Icon, title, description }: FeatureCardProps) => {
  return (
    <div className="group relative overflow-hidden rounded-3xl border border-border/80 bg-card/90 p-5 shadow-card transition-all duration-300 hover:-translate-y-0.5 hover:shadow-card-hover sm:p-6">
      <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-primary/10 via-primary/30 to-success/20" />
      <div className="mb-4 flex h-11 w-11 items-center justify-center rounded-2xl bg-primary/10 transition-colors group-hover:bg-primary/20 sm:h-12 sm:w-12">
        <Icon className="h-5 w-5 text-primary sm:h-6 sm:w-6" />
      </div>
      <h3 className="mb-2 text-base font-semibold leading-snug text-foreground">{title}</h3>
      <p className="text-sm leading-relaxed text-muted-foreground">{description}</p>
    </div>
  );
};

export default FeatureCard;
