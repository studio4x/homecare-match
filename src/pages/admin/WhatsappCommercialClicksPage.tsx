"use client";

import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { AlertCircle, Loader2, MessageCircle, RefreshCw } from "lucide-react";
import { toast } from "sonner";

type WhatsAppCommercialClickRow = {
  id: string;
  created_at: string;
  user_id: string | null;
  placement_id: string;
  origin_tag: string;
  button_label: string | null;
  page_path: string | null;
  page_url: string | null;
  referrer: string | null;
  user_agent: string | null;
  whatsapp_number: string | null;
};

const UTM_KEYS = ["utm_source", "utm_medium", "utm_campaign", "utm_term", "utm_content"] as const;

const formatDateInput = (date: Date) => {
  const pad = (value: number) => String(value).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
};

const startOfDayIso = (dateInput: string) => new Date(`${dateInput}T00:00:00`).toISOString();
const endOfDayIso = (dateInput: string) => new Date(`${dateInput}T23:59:59.999`).toISOString();

const getErrorMessage = (error: unknown, fallback: string) => {
  if (error && typeof error === "object" && "message" in error) {
    const candidate = (error as { message?: unknown }).message;
    if (typeof candidate === "string" && candidate.length > 0) {
      return candidate;
    }
  }
  return fallback;
};

const getHostname = (value?: string | null) => {
  const raw = String(value || "").trim();
  if (!raw) return "";

  try {
    return new URL(raw).hostname;
  } catch {
    try {
      return new URL(`https://${raw}`).hostname;
    } catch {
      return "";
    }
  }
};

const getUtmEntries = (value?: string | null) => {
  const raw = String(value || "").trim();
  if (!raw) return [] as Array<{ key: string; value: string }>;

  try {
    const url = new URL(raw);
    const entries: Array<{ key: string; value: string }> = [];
    UTM_KEYS.forEach((key) => {
      const candidate = url.searchParams.get(key);
      if (candidate) entries.push({ key, value: candidate });
    });
    return entries;
  } catch {
    return [] as Array<{ key: string; value: string }>;
  }
};

const WhatsappCommercialClicksPage = () => {
  const defaultTo = formatDateInput(new Date());
  const defaultFromDate = new Date();
  defaultFromDate.setDate(defaultFromDate.getDate() - 30);
  const defaultFrom = formatDateInput(defaultFromDate);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [items, setItems] = useState<WhatsAppCommercialClickRow[]>([]);
  const [fromDate, setFromDate] = useState(defaultFrom);
  const [toDate, setToDate] = useState(defaultTo);
  const [placementFilter, setPlacementFilter] = useState<string>("all");
  const [referrerDomainFilter, setReferrerDomainFilter] = useState<string>("all");
  const [searchTerm, setSearchTerm] = useState("");

  const fetchData = async () => {
    setLoading(true);
    setError(null);

    try {
      const fromIso = startOfDayIso(fromDate);
      const toIso = endOfDayIso(toDate);

      const { data, error: queryError } = await supabase
        .from("whatsapp_commercial_clicks")
        .select(
          "id,created_at,user_id,placement_id,origin_tag,button_label,page_path,page_url,referrer,user_agent,whatsapp_number",
        )
        .gte("created_at", fromIso)
        .lte("created_at", toIso)
        .order("created_at", { ascending: false })
        .limit(5000);

      if (queryError) throw queryError;
      setItems((data || []) as WhatsAppCommercialClickRow[]);
    } catch (fetchError: unknown) {
      const message = getErrorMessage(fetchError, "Falha ao carregar cliques do WhatsApp.");
      setError(message);
      toast.error(message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const placementOptions = useMemo(() => {
    const values = new Set<string>();
    items.forEach((item) => values.add(item.placement_id));
    return Array.from(values).sort();
  }, [items]);

  const referrerDomainOptions = useMemo(() => {
    const values = new Set<string>();
    items.forEach((item) => {
      const host = getHostname(item.referrer);
      if (host) values.add(host);
    });
    return Array.from(values).sort();
  }, [items]);

  const filteredItems = useMemo(() => {
    return items.filter((item) => {
      const matchesPlacement = placementFilter === "all" || item.placement_id === placementFilter;
      const referrerHost = getHostname(item.referrer);
      const matchesReferrer = referrerDomainFilter === "all" || referrerHost === referrerDomainFilter;

      const combinedText = [
        item.origin_tag,
        item.placement_id,
        item.button_label || "",
        item.page_path || "",
        item.page_url || "",
        item.referrer || "",
        item.whatsapp_number || "",
      ]
        .join(" ")
        .toLowerCase();
      const matchesSearch = !searchTerm || combinedText.includes(searchTerm.toLowerCase());

      return matchesPlacement && matchesReferrer && matchesSearch;
    });
  }, [items, placementFilter, referrerDomainFilter, searchTerm]);

  const summary = useMemo(() => {
    const tags = new Set<string>();
    const placements = new Set<string>();
    const pages = new Set<string>();

    filteredItems.forEach((item) => {
      tags.add(item.origin_tag);
      placements.add(item.placement_id);
      if (item.page_path) pages.add(item.page_path);
    });

    return {
      total: filteredItems.length,
      tags: tags.size,
      placements: placements.size,
      pages: pages.size,
    };
  }, [filteredItems]);

  const topTags = useMemo(() => {
    const map = new Map<string, number>();
    filteredItems.forEach((item) => {
      map.set(item.origin_tag, (map.get(item.origin_tag) || 0) + 1);
    });
    return Array.from(map.entries())
      .map(([tag, count]) => ({ tag, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 8);
  }, [filteredItems]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Cliques WhatsApp Comercial</h1>
        <p className="text-muted-foreground">
          Registro de todos os cliques dos botoes com tag de origem.
        </p>
      </div>

      <div className="grid gap-3 md:grid-cols-4">
        <Card>
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground">Total de cliques</p>
            <p className="text-2xl font-bold">{summary.total}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground">Tags unicas</p>
            <p className="text-2xl font-bold">{summary.tags}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground">Posicoes (placement)</p>
            <p className="text-2xl font-bold">{summary.placements}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground">Paginas de origem</p>
            <p className="text-2xl font-bold">{summary.pages}</p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardContent className="space-y-4 p-4">
          <div className="grid gap-3 lg:grid-cols-6">
            <div>
              <label className="text-xs text-muted-foreground">Data inicial</label>
              <Input type="date" value={fromDate} onChange={(event) => setFromDate(event.target.value)} />
            </div>
            <div>
              <label className="text-xs text-muted-foreground">Data final</label>
              <Input type="date" value={toDate} onChange={(event) => setToDate(event.target.value)} />
            </div>
            <div>
              <label className="text-xs text-muted-foreground">Placement</label>
              <Select value={placementFilter} onValueChange={setPlacementFilter}>
                <SelectTrigger>
                  <SelectValue placeholder="Todos" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos</SelectItem>
                  {placementOptions.map((placement) => (
                    <SelectItem key={placement} value={placement}>
                      {placement}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-xs text-muted-foreground">Dominio de referencia</label>
              <Select value={referrerDomainFilter} onValueChange={setReferrerDomainFilter}>
                <SelectTrigger>
                  <SelectValue placeholder="Todos" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos</SelectItem>
                  {referrerDomainOptions.map((domain) => (
                    <SelectItem key={domain} value={domain}>
                      {domain}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="lg:col-span-2">
              <label className="text-xs text-muted-foreground">Busca</label>
              <Input
                placeholder="Tag, placement, pagina, referencia ou numero"
                value={searchTerm}
                onChange={(event) => setSearchTerm(event.target.value)}
              />
            </div>
          </div>

          <div className="flex justify-end">
            <Button onClick={fetchData} disabled={loading}>
              <RefreshCw className="mr-2 h-4 w-4" />
              Atualizar
            </Button>
          </div>
        </CardContent>
      </Card>

      {topTags.length > 0 ? (
        <Card>
          <CardContent className="p-4">
            <p className="mb-3 text-sm font-semibold">Top tags</p>
            <div className="flex flex-wrap gap-2">
              {topTags.map((item) => (
                <Badge key={item.tag} variant="secondary" className="gap-2">
                  <MessageCircle className="h-3 w-3" />
                  {item.tag}
                  <span className="font-semibold">{item.count}</span>
                </Badge>
              ))}
            </div>
          </CardContent>
        </Card>
      ) : null}

      {error ? (
        <div className="flex items-center gap-3 rounded-lg border border-destructive/20 bg-destructive/10 p-4 text-destructive">
          <AlertCircle className="h-5 w-5" />
          <p className="text-sm">{error}</p>
        </div>
      ) : null}

      <Card>
        <CardContent className="p-0">
          {loading ? (
            <div className="flex justify-center py-12">
              <Loader2 className="h-5 w-5 animate-spin text-primary" />
            </div>
          ) : filteredItems.length === 0 ? (
            <div className="py-12 text-center text-muted-foreground">
              Nenhum clique encontrado para os filtros selecionados.
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Data/Hora</TableHead>
                  <TableHead>Tag</TableHead>
                  <TableHead>Placement</TableHead>
                  <TableHead>Pagina</TableHead>
                  <TableHead>Referencia</TableHead>
                  <TableHead>UTM</TableHead>
                  <TableHead>Botao</TableHead>
                  <TableHead>Numero</TableHead>
                  <TableHead>Usuario</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredItems.map((item) => {
                  const utmEntries = getUtmEntries(item.page_url);
                  const refHost = getHostname(item.referrer);

                  return (
                    <TableRow key={item.id}>
                      <TableCell className="whitespace-nowrap text-xs">
                        {new Date(item.created_at).toLocaleString("pt-BR")}
                      </TableCell>
                      <TableCell className="max-w-[220px]">
                        <p className="truncate text-xs font-medium">{item.origin_tag}</p>
                      </TableCell>
                      <TableCell className="text-xs">{item.placement_id}</TableCell>
                      <TableCell className="max-w-[240px]">
                        {item.page_url ? (
                          <a
                            href={item.page_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="truncate text-xs text-primary hover:underline"
                          >
                            {item.page_path || item.page_url}
                          </a>
                        ) : (
                          <p className="truncate text-xs">{item.page_path || "-"}</p>
                        )}
                      </TableCell>
                      <TableCell className="max-w-[220px]">
                        {item.referrer ? (
                          <a
                            href={item.referrer}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="truncate text-xs text-primary hover:underline"
                          >
                            {refHost || item.referrer}
                          </a>
                        ) : (
                          <p className="text-xs text-muted-foreground">-</p>
                        )}
                      </TableCell>
                      <TableCell className="max-w-[260px]">
                        {utmEntries.length > 0 ? (
                          <div className="flex flex-wrap gap-1">
                            {utmEntries.map((entry) => (
                              <Badge key={`${item.id}-${entry.key}`} variant="outline" className="max-w-[240px] truncate text-[10px]">
                                {entry.key.replace("utm_", "")}: {entry.value}
                              </Badge>
                            ))}
                          </div>
                        ) : (
                          <p className="text-xs text-muted-foreground">-</p>
                        )}
                      </TableCell>
                      <TableCell className="max-w-[180px]">
                        <p className="truncate text-xs">{item.button_label || "-"}</p>
                      </TableCell>
                      <TableCell className="text-xs">{item.whatsapp_number || "-"}</TableCell>
                      <TableCell className="text-xs">
                        {item.user_id ? `${item.user_id.slice(0, 8)}...` : "anon"}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default WhatsappCommercialClicksPage;
