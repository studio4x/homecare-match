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
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { AlertCircle, Loader2, MessageCircle, RefreshCw, Trash2 } from "lucide-react";
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

const parseUrl = (value?: string | null) => {
  const raw = String(value || "").trim();
  if (!raw) return null;

  try {
    return new URL(raw);
  } catch {
    try {
      return new URL(`https://${raw}`);
    } catch {
      return null;
    }
  }
};

const getPagePathLabel = (item: WhatsAppCommercialClickRow) => {
  const parsed = parseUrl(item.page_url);
  if (parsed) return parsed.pathname || "/";
  if (item.page_path) return item.page_path;
  if (item.page_url) return item.page_url;
  return "-";
};

const getReferrerLabel = (value?: string | null) => {
  const parsed = parseUrl(value);
  if (!parsed) return value || "-";
  const path = parsed.pathname && parsed.pathname !== "/" ? parsed.pathname : "";
  return `${parsed.hostname}${path}`;
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
  const [isClearing, setIsClearing] = useState(false);
  const [clearDialogOpen, setClearDialogOpen] = useState(false);

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

  const handleClearAll = async () => {
    setIsClearing(true);
    setError(null);

    try {
      const { error: deleteError } = await supabase
        .from("whatsapp_commercial_clicks")
        .delete()
        .neq("id", "00000000-0000-0000-0000-000000000000");

      if (deleteError) throw deleteError;

      toast.success("Historico de cliques removido.");
      setItems([]);
      setClearDialogOpen(false);
    } catch (clearError: unknown) {
      const message = getErrorMessage(clearError, "Falha ao limpar o historico de cliques.");
      setError(message);
      toast.error(message);
    } finally {
      setIsClearing(false);
      await fetchData();
    }
  };

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

          <div className="flex justify-end gap-2">
            <Button
              variant="outline"
              className="text-destructive hover:bg-destructive/10"
              onClick={() => setClearDialogOpen(true)}
              disabled={loading || isClearing || items.length === 0}
            >
              {isClearing ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Trash2 className="mr-2 h-4 w-4" />}
              Excluir historico
            </Button>
            <Button onClick={fetchData} disabled={loading || isClearing}>
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
            <Table className="table-fixed w-full">
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[120px] px-2">Data/Hora</TableHead>
                  <TableHead className="w-[180px] px-2">Origem</TableHead>
                  <TableHead className="w-[260px] px-2">Pagina + Referencia</TableHead>
                  <TableHead className="w-[240px] px-2">UTM</TableHead>
                  <TableHead className="w-[140px] px-2">Botao</TableHead>
                  <TableHead className="w-[120px] px-2">Numero</TableHead>
                  <TableHead className="w-[100px] px-2">Usuario</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredItems.map((item) => {
                  const utmEntries = getUtmEntries(item.page_url);
                  const refHost = getHostname(item.referrer);
                  const pagePathLabel = getPagePathLabel(item);
                  const pageHost = getHostname(item.page_url);
                  const referrerLabel = getReferrerLabel(item.referrer);

                  return (
                    <TableRow key={item.id}>
                      <TableCell className="align-top whitespace-nowrap px-2 py-2 text-xs">
                        {new Date(item.created_at).toLocaleString("pt-BR")}
                      </TableCell>
                      <TableCell className="align-top px-2 py-2">
                        <p className="truncate text-xs font-medium" title={item.origin_tag}>
                          {item.origin_tag}
                        </p>
                        <p className="mt-1 truncate text-[10px] text-muted-foreground" title={item.placement_id}>
                          {item.placement_id}
                        </p>
                      </TableCell>
                      <TableCell className="align-top px-2 py-2">
                        {item.page_url ? (
                          <a
                            href={item.page_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="block truncate text-xs text-primary hover:underline"
                            title={item.page_url}
                          >
                            {pagePathLabel}
                          </a>
                        ) : (
                          <p className="truncate text-xs" title={item.page_path || "-"}>
                            {pagePathLabel}
                          </p>
                        )}
                        <p className="mt-1 truncate text-[10px] text-muted-foreground" title={pageHost || "-"}>
                          {pageHost || "-"}
                        </p>
                        {item.referrer ? (
                          <a
                            href={item.referrer}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="mt-2 block truncate text-xs text-primary hover:underline"
                            title={item.referrer}
                          >
                            {referrerLabel}
                          </a>
                        ) : (
                          <p className="mt-2 text-xs text-muted-foreground">-</p>
                        )}
                        <p className="mt-1 truncate text-[10px] text-muted-foreground" title={refHost || "-"}>
                          {refHost || "-"}
                        </p>
                      </TableCell>
                      <TableCell className="align-top px-2 py-2">
                        {utmEntries.length > 0 ? (
                          <div className="space-y-1">
                            {utmEntries.map((entry) => (
                              <div
                                key={`${item.id}-${entry.key}`}
                                className="rounded-md border border-border/80 bg-background px-2 py-1 text-[10px] leading-tight"
                                title={`${entry.key}: ${entry.value}`}
                              >
                                <span className="font-semibold">{entry.key.replace("utm_", "")}:</span>{" "}
                                <span className="break-all">{entry.value}</span>
                              </div>
                            ))}
                          </div>
                        ) : (
                          <p className="text-xs text-muted-foreground">-</p>
                        )}
                      </TableCell>
                      <TableCell className="align-top px-2 py-2">
                        <p className="truncate text-xs" title={item.button_label || "-"}>
                          {item.button_label || "-"}
                        </p>
                      </TableCell>
                      <TableCell className="align-top px-2 py-2 text-xs">
                        <span className="block truncate" title={item.whatsapp_number || "-"}>
                          {item.whatsapp_number || "-"}
                        </span>
                      </TableCell>
                      <TableCell className="align-top px-2 py-2 text-xs">
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

      <AlertDialog open={clearDialogOpen} onOpenChange={setClearDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir historico de cliques?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta acao remove todos os registros de cliques do WhatsApp comercial.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isClearing}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleClearAll}
              disabled={isClearing}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {isClearing ? (
                <span className="inline-flex items-center gap-2">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Excluindo...
                </span>
              ) : (
                "Sim, excluir tudo"
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default WhatsappCommercialClicksPage;
