"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { ChevronUp } from "lucide-react";
import { cn } from "@/lib/utils";

interface ScrollToTopButtonProps {
  hideOnMobile?: boolean;
  className?: string;
}

const ScrollToTopButton = ({ hideOnMobile = false, className }: ScrollToTopButtonProps) => {
  const [isVisible, setIsVisible] = useState(false);

  // Monitora a rolagem da página
  useEffect(() => {
    const toggleVisibility = () => {
      if (window.scrollY > 300) {
        setIsVisible(true);
      } else {
        setIsVisible(false);
      }
    };

    window.addEventListener("scroll", toggleVisibility);
    return () => window.removeEventListener("scroll", toggleVisibility);
  }, []);

  const scrollToTop = () => {
    window.scrollTo({
      top: 0,
      behavior: "smooth",
    });
  };

  return (
    <div
      className={cn(
        "fixed bottom-24 right-4 z-50 transition-all duration-300 transform md:bottom-6 md:right-6",
        hideOnMobile && "hidden md:block",
        isVisible ? "translate-y-0 opacity-100" : "translate-y-10 opacity-0 pointer-events-none",
        className
      )}
    >
      <Button
        variant="default"
        size="icon"
        onClick={scrollToTop}
        className="h-12 w-12 rounded-full shadow-xl hover:scale-110 active:scale-95 transition-transform border border-white/20"
        title="Voltar ao topo"
      >
        <ChevronUp className="h-6 w-6" />
      </Button>
    </div>
  );
};

export default ScrollToTopButton;
