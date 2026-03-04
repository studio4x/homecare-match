"use client";

import { Link } from "react-router-dom";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Badge } from "@/components/ui/badge";
import { CalendarDays, Clock3, UserRound } from "lucide-react";
import { BlogArticle, articleUrl, getExcerptFromHtml } from "@/lib/blog";

interface BlogArticleCardProps {
  article: BlogArticle;
}

const BlogArticleCard = ({ article }: BlogArticleCardProps) => {
  const publishedDate = article.published_at || article.created_at;
  const excerpt =
    article.excerpt || getExcerptFromHtml(article.content_html || "", 160) || "Leia mais sobre este conteúdo.";

  return (
    <article className="overflow-hidden rounded-2xl border border-border bg-card shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-lg">
      <Link to={articleUrl(article.slug)} className="block">
        <div className="aspect-[16/9] w-full bg-secondary/40">
          {article.cover_image_url ? (
            <img
              src={article.cover_image_url}
              alt={article.title}
              className="h-full w-full object-cover"
              loading="lazy"
            />
          ) : (
            <div className="flex h-full items-center justify-center bg-gradient-to-br from-primary/15 to-success/10 text-sm font-semibold text-muted-foreground">
              HomeCare Match Blog
            </div>
          )}
        </div>
      </Link>

      <div className="space-y-3 p-5">
        <div className="flex flex-wrap items-center gap-2">
          {article.category && (
            <Badge variant="secondary" className="text-[11px]">
              {article.category.name}
            </Badge>
          )}
          {article.featured && <Badge className="text-[11px]">Destaque</Badge>}
        </div>

        <h3 className="line-clamp-2 text-lg font-bold leading-tight">
          <Link to={articleUrl(article.slug)} className="hover:text-primary">
            {article.title}
          </Link>
        </h3>

        <p className="line-clamp-3 text-sm text-muted-foreground">{excerpt}</p>

        <div className="flex flex-wrap items-center gap-4 text-xs text-muted-foreground">
          <span className="inline-flex items-center gap-1">
            <UserRound className="h-3.5 w-3.5" />
            {article.author_name || "Equipe HomeCare Match"}
          </span>
          {publishedDate && (
            <span className="inline-flex items-center gap-1">
              <CalendarDays className="h-3.5 w-3.5" />
              {format(new Date(publishedDate), "dd MMM yyyy", { locale: ptBR })}
            </span>
          )}
          <span className="inline-flex items-center gap-1">
            <Clock3 className="h-3.5 w-3.5" />
            {article.reading_time_minutes || 1} min
          </span>
        </div>
      </div>
    </article>
  );
};

export default BlogArticleCard;
