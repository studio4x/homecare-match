import { Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface PricingCardProps {
  id: string;
  name: string;
  price: string;
  period: string;
  description: string;
  features: string[];
  popular?: boolean;
  savings?: string;
  onSubscribe?: (id: string) => void;
  isLoading?: boolean;
}

const PricingCard = ({
  id,
  name,
  price,
  period,
  description,
  features,
  popular = false,
  savings,
  onSubscribe,
  isLoading
}: PricingCardProps) => {
  return (
    <div
      className={cn(
        "relative flex flex-col rounded-2xl border bg-card p-6 shadow-card transition-all duration-300 hover:shadow-card-hover",
        popular && "border-primary shadow-card-hover ring-2 ring-primary/20"
      )}
    >
      {popular && (
        <div className="mb-2 flex justify-center">
          <span className="rounded-full bg-primary px-4 py-1 text-xs font-semibold text-primary-foreground">
            Mais Popular
          </span>
        </div>
      )}

      <div className="mb-6">
        <h3 className="text-lg font-semibold text-foreground">{name}</h3>
        <p className="mt-1 text-sm text-muted-foreground">{description}</p>
      </div>

      <div className="mb-6">
        <div className="flex items-baseline">
          <span className="text-4xl font-bold text-foreground">{price}</span>
          <span className="ml-2 text-muted-foreground">/{period}</span>
        </div>
        {savings && (
          <span className="mt-1 inline-block rounded-full bg-success/10 px-2 py-0.5 text-xs font-medium text-success">
            {savings}
          </span>
        )}
      </div>

      <ul className="mb-8 flex-1 space-y-3">
        {features.map((feature, index) => (
          <li key={index} className="flex items-start gap-3">
            <Check className="mt-0.5 h-4 w-4 flex-shrink-0 text-success" />
            <span className="text-sm text-muted-foreground">{feature}</span>
          </li>
        ))}
      </ul>

      <Button
        className={cn("w-full", popular ? "" : "bg-secondary text-secondary-foreground hover:bg-secondary/80")}
        variant={popular ? "default" : "secondary"}
        onClick={() => onSubscribe?.(id)}
        disabled={isLoading}
      >
        {isLoading ? "Processando..." : "Assinar Agora"}
      </Button>
    </div>
  );
};

export default PricingCard;