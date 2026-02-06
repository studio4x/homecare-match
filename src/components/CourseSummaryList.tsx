"use client";

import React, { useMemo, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";
import { Loader2 } from "lucide-react";
import { Link } from "react-router-dom";

export interface CourseSummary {
  slug: string;
  title: string;
  hero?: string;
  progressPct: number;
}

interface CourseSummaryListProps {
  title: string;
  items: CourseSummary[];
  perPage?: number;
  loading?: boolean;
}

const CourseSummaryList: React.FC<CourseSummaryListProps> = ({ title, items, perPage = 3, loading = false }) => {
  const [page, setPage] = useState(1);

  const totalPages = Math.max(1, Math.ceil((items?.length || 0) / perPage));
  const paginated = useMemo(() => {
    const start = (page - 1) * perPage;
    return items.slice(start, start + perPage);
  }, [items, page, perPage]);

  const nextPage = () => setPage((p) => Math.min(totalPages, p + 1));
  const prevPage = () => setPage((p) => Math.max(1, p - 1));

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h4 className="font-semibold">{title}</h4>
        {totalPages > 1 ? (
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={prevPage} disabled={page === 1}>
              Anterior
            </Button>
            <span className="text-xs text-muted-foreground">
              Página {page} de {totalPages}
            </span>
            <Button variant="outline" size="sm" onClick={nextPage} disabled={page === totalPages}>
              Próxima
            </Button>
          </div>
        ) : null}
      </div>

      {loading ? (
        <div className="flex items-center gap-2 text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" /> Carregando cursos...</div>
      ) : items.length === 0 ? (
        <p className="text-sm text-muted-foreground">Nenhum curso encontrado.</p>
      ) : (
        <div className="grid gap-3">
          {paginated.map((c) => (
            <Card key={c.slug} className="overflow-hidden">
              <CardContent className="p-3 flex items-center gap-3">
                {c.hero ? (
                  <img src={c.hero} alt={c.title} className="h-14 w-20 object-cover rounded-md border" />
                ) : (
                  <div className="h-14 w-20 rounded-md border bg-secondary/50" />
                )}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between">
                    <h5 className="font-medium truncate">{c.title}</h5>
                    <span className="text-xs text-muted-foreground">{c.progressPct}%</span>
                  </div>
                  <Progress value={c.progressPct} />
                </div>
                <Button asChild size="sm">
                  <Link to={`/cursos/${c.slug}`}>Abrir</Link>
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
};

export default CourseSummaryList;