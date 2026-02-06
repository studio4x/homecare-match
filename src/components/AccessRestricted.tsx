"use client";

import React from "react";
import { ShieldAlert } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Link } from "react-router-dom";

interface Action {
  label: string;
  to: string;
}

interface AccessRestrictedProps {
  title?: string;
  description: string;
  primaryAction: Action;
  secondaryAction?: Action;
}

const AccessRestricted: React.FC<AccessRestrictedProps> = ({
  title = "Acesso Restrito",
  description,
  primaryAction,
  secondaryAction
}) => {
  return (
    <div className="container mx-auto px-4 py-20 text-center">
      <div className="mx-auto mb-6 flex h-20 w-20 items-center justify-center rounded-full bg-primary/10">
        <ShieldAlert className="h-10 w-10 text-primary" />
      </div>
      <h2 className="text-2xl font-bold">{title}</h2>
      <p className="mx-auto mt-4 max-w-md text-muted-foreground">
        {description}
      </p>
      <div className="mt-8 flex flex-col sm:flex-row items-center justify-center gap-4">
        <Button asChild className="gap-2 h-12 px-6">
          <Link to={primaryAction.to}>{primaryAction.label}</Link>
        </Button>
        {secondaryAction ? (
          <Button asChild variant="outline" className="gap-2 h-12 px-6">
            <Link to={secondaryAction.to}>{secondaryAction.label}</Link>
          </Button>
        ) : null}
      </div>
    </div>
  );
};

export default AccessRestricted;