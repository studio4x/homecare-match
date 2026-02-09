"use client";

import React, { useMemo, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";
import { Loader2, Award } from "lucide-react";
import { Link } from "react-router-dom";

export interface CourseSummary {
  slug: string;
  title: string;
  hero?: string;
  progressPct: number;
  certificateId?: string | null;
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
        {totalPages > 1 && (
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={prevPage} disabled={page === 1}>Anterior</Button>
            <span className="text-xs text-muted-foreground">Página {page} de {totalPages}</span>
            <Button variant="outline" size="sm" onClick={nextPage} disabled={page === totalPages}>Próxima</Button>
          </div>
        )}
      </div>

      {loading ? (
        <div className="flex items-center gap-2 text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" /> Carregando...</div>
      ) : items.length === 0 ? (
        <p className="text-sm text-muted-foreground">Nenhum curso encontrado.</p>
      ) : (
        <div className="grid gap-3">
          {paginated.map((c) => (
            <Card key={c.slug} className="overflow-hidden">
              <CardContent className="p-3 flex items-center gap-3">
                <div className="hidden sm:block shrink-0">
                  {c.hero ? (
                    <img src={c.hero} alt={c.title} className="h-14 w-20 object-cover rounded-md border" />
                  ) : (
                    <div className="h-14 w-20 rounded-md border bg-secondary/50" />
                  )}
                </div>
                
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-2 mb-1">
                    <h5 className="font-medium truncate text-sm">{c.title}</h5>
                    <span className="text-[10px] font-semibold text-muted-foreground whitespace-nowrap">{c.progressPct}%</span>
                  </div>
                  <Progress value={c.progressPct} className="h-1.5" />
                </div>

                <div className="flex gap-2">
                  {c.certificateId && (
                    <Button asChild size="sm" variant="outline" className="h-8 text-xs border-yellow-600/30 text-yellow-700 hover:bg-yellow-50">
                      <Link to={`/certificado/${c.certificateId}`} target="_blank"><Award className="h-3 w-3 mr-1" /> Certificado</Link>
                    </Button>
                  )}
                  <Button asChild size="sm" className="h-8 text-xs">
                    <Link to={`/cursos/${c.slug}`}>{c.progressPct === 100 ? "Rever" : "Abrir"}</Link>
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
};

export default CourseSummaryList;