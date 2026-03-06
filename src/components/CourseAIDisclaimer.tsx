"use client";

import { AlertTriangle } from "lucide-react";
import { cn } from "@/lib/utils";

type CourseAIDisclaimerProps = {
  compact?: boolean;
  className?: string;
};

const CourseAIDisclaimer = ({ compact = false, className }: CourseAIDisclaimerProps) => {
  return (
    <div
      className={cn(
        "rounded-xl border border-amber-300 bg-amber-50 p-4 text-amber-900",
        compact ? "text-xs" : "text-sm",
        className,
      )}
    >
      <div className="flex items-start gap-2">
        <AlertTriangle className={cn("shrink-0 text-amber-700", compact ? "mt-0.5 h-4 w-4" : "mt-0.5 h-5 w-5")} />
        <p className="leading-relaxed">
          <strong>Disclaimer:</strong> os cursos da HomeCare Match foram desenvolvidos com apoio de IA e têm como
          objetivo principal fornecer informações introdutórias sobre cada tema. Recomendamos que o profissional
          também realize cursos elaborados por profissionais capacitados e habilitados para formação profissional.
        </p>
      </div>
    </div>
  );
};

export default CourseAIDisclaimer;
