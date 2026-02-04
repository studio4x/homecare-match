"use client";

import { Link } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Users, ArrowRight } from "lucide-react";

interface Interaction {
  interacted_at: string;
  profile: {
    id: string;
    full_name: string;
    avatar_url: string;
    specialty?: string;
    role?: string;
  };
}

interface InteractionHistoryProps {
  title: string;
  interactions: Interaction[];
  loading: boolean;
}

const InteractionHistory = ({ title, interactions, loading }: InteractionHistoryProps) => {
  const getInitials = (name: string) =>
    name
      ?.split(" ")
      .map((n) => n[0])
      .join("")
      .slice(0, 2)
      .toUpperCase() || "??";

  return (
    <Card className="shadow-card">
      <CardHeader>
        <CardTitle>{title}</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {loading ? (
            Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="flex items-center gap-4">
                <Skeleton className="h-12 w-12 rounded-full" />
                <div className="flex-1 space-y-2">
                  <Skeleton className="h-4 w-3/4" />
                  <Skeleton className="h-3 w-1/2" />
                </div>
              </div>
            ))
          ) : interactions.length > 0 ? (
            interactions.map(({ interacted_at, profile }) => (
              <div key={profile.id} className="flex items-center justify-between gap-4 rounded-lg p-3 hover:bg-secondary/50 transition-colors">
                <div className="flex items-center gap-4">
                  <Avatar className="h-12 w-12">
                    <AvatarImage src={profile.avatar_url} />
                    <AvatarFallback>{getInitials(profile.full_name)}</AvatarFallback>
                  </Avatar>
                  <div>
                    <p className="font-semibold text-foreground">{profile.full_name}</p>
                    <p className="text-xs text-muted-foreground">
                      Contato em: {new Date(interacted_at).toLocaleDateString('pt-BR')}
                    </p>
                  </div>
                </div>
                <Button variant="ghost" size="sm" asChild>
                  <Link to={`/profissional/${profile.id}`}>
                    Ver Perfil <ArrowRight className="h-3 w-3 ml-2" />
                  </Link>
                </Button>
              </div>
            ))
          ) : (
            <div className="py-10 text-center text-muted-foreground">
              <Users className="mx-auto h-8 w-8 mb-2" />
              <p className="text-sm">Nenhuma interação registrada ainda.</p>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
};

export default InteractionHistory;