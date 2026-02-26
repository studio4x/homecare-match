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
  buttonText?: string;
  isDisabled?: boolean;
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
  isLoading,
  buttonText = "Assinar Agora",
  isDisabled = false
}: PricingCardProps) => {
  return (
    <div
      className={cn(
        "relative flex h-full flex-col overflow-hidden rounded-3xl border bg-card/95 p-5 shadow-card transition-all duration-300 hover:-translate-y-0.5 hover:shadow-card-hover sm:p-6",
        popular && "border-primary shadow-card-hover ring-2 ring-primary/20",
        isDisabled && "opacity-80 grayscale-[0.5]"
      )}
    >
      <div className={cn(
        "absolute inset-x-0 top-0 h-1",
        popular
          ? "bg-gradient-to-r from-primary via-primary/70 to-success/40"
          : "bg-gradient-to-r from-primary/10 via-primary/30 to-success/20"
      )} />
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
        className={cn(
          "h-11 w-full",
          popular && !isDisabled ? "" : "bg-secondary text-secondary-foreground hover:bg-secondary/80",
          isDisabled && "bg-muted text-muted-foreground cursor-default hover:bg-muted"
        )}
        variant={popular && !isDisabled ? "default" : "secondary"}
        onClick={() => !isDisabled && onSubscribe?.(id)}
        disabled={isLoading || isDisabled}
      >
        {isLoading ? "Processando..." : buttonText}
      </Button>
    </div>
  );
};

export default PricingCard;
