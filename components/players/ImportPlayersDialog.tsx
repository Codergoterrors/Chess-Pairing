"use client";

import { useState, useCallback, useRef } from "react";
import * as XLSX from "xlsx";
import { Player } from "@/lib/types";
import { Button } from "@/components/ui/button";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
  DialogFooter, DialogDescription,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useToast } from "@/hooks/use-toast";
import {
  Upload, FileSpreadsheet, Download, CheckCircle,
  XCircle, AlertCircle, Loader2, ArrowRight, ArrowLeft,
} from "lucide-react";

// ── Column aliases (lowercase header → Player field) ────────────────────────
const COLUMN_MAP: Record<string, string> = {
  name: "name", "full name": "name", "player name": "name",
  rollno: "rollNo", "roll no": "rollNo", "roll number": "rollNo",
  branch: "branch",
  year: "year",
  division: "division", div: "division",
  israted: "isRated", "is rated": "isRated", rated: "isRated",
  officialelo: "officialElo", "official elo": "officialElo", "club rating": "officialElo",
  fiderating: "fideRating", "fide rating": "fideRating", fide: "fideRating",
  estimatedelo: "estimatedElo", "estimated elo": "estimatedElo", "estimated rating": "estimatedElo",
};

interface ParsedRow {
  raw: Record<string, string>;
  player: Partial<Player & { year?: string; division?: string }> | null;
  errors: string[];
  rowIndex: number;
}

interface Props {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  onBulkImport: (players: Player[]) => Promise<void>;
  existingRollNos: Set<string>;
}

// ── Parse raw rows from file into typed ParsedRow objects ───────────────────
function parseRows(data: Record<string, string>[]): ParsedRow[] {
  return data.map((raw, i) => {
    const norm: Record<string, string> = {};
    for (const [k, v] of Object.entries(raw)) {
      norm[k.toLowerCase().trim()] = String(v ?? "").trim();
    }

    const errors: string[] = [];
    const player: Partial<Player> & { year?: string; division?: string } = {};

    for (const [header, field] of Object.entries(COLUMN_MAP)) {
      const val = norm[header];
      if (val === undefined) continue;
      if (field === "name")         player.name = val;
      else if (field === "rollNo")  player.rollNo = val;
      else if (field === "branch")  player.branch = val;
      else if (field === "year")    player.year = val;
      else if (field === "division") player.division = val;
      else if (field === "isRated") player.isRated = ["true","yes","1","y"].includes(val.toLowerCase());
      else if (field === "officialElo")  player.officialElo  = val ? Number(val) || undefined : undefined;
      else if (field === "fideRating")   player.fideRating   = val ? Number(val) || undefined : undefined;
      else if (field === "estimatedElo") player.estimatedElo = val ? Number(val) || undefined : undefined;
    }

    if (!player.name?.trim())   errors.push("Name is required");
    if (!player.rollNo?.trim()) errors.push("Roll No is required");
    if (player.officialElo  !== undefined && isNaN(player.officialElo))  errors.push("Official Elo must be a number");
    if (player.fideRating   !== undefined && isNaN(player.fideRating))   errors.push("FIDE Rating must be a number");
    if (player.estimatedElo !== undefined && isNaN(player.estimatedElo)) errors.push("Estimated Elo must be a number");

    return { raw, player: errors.length === 0 ? player : null, errors, rowIndex: i + 2 };
  });
}

// ── Generate & download a template CSV ──────────────────────────────────────
function downloadTemplate() {
  const headers = ["name","rollNo","branch","year","division","isRated","officialElo","fideRating","estimatedElo"];
  const example = ["Rahul Sharma","DW236","CE","SY","SA1","false","","",""];
  const csv = [headers.join(","), example.join(",")].join("\n");
  const blob = new Blob([csv], { type: "text/csv" });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement("a");
  a.href = url; a.download = "chess_players_template.csv"; a.click();
  URL.revokeObjectURL(url);
}

// ── Main component ───────────────────────────────────────────────────────────
export function ImportPlayersDialog({ open, onOpenChange, onBulkImport, existingRollNos }: Props) {
  const { toast } = useToast();
  const fileRef = useRef<HTMLInputElement>(null);
  const [step, setStep] = useState<"upload" | "preview" | "importing" | "done">("upload");
  const [parsedRows, setParsedRows] = useState<ParsedRow[]>([]);
  const [fileName, setFileName] = useState("");
  const [progress, setProgress] = useState(0);
  const [result, setResult] = useState({ success: 0, failed: 0 });
  const [isDragging, setIsDragging] = useState(false);

  const reset = () => {
    setStep("upload"); setParsedRows([]); setFileName("");
    setProgress(0); setResult({ success: 0, failed: 0 });
    if (fileRef.current) fileRef.current.value = "";
  };

  const processFile = async (file: File) => {
    setFileName(file.name);
    const isExcel = file.name.endsWith(".xlsx") || file.name.endsWith(".xls");
    try {
      let data: Record<string, string>[];
      if (isExcel) {
        const buffer = await file.arrayBuffer();
        const wb = XLSX.read(buffer, { type: "array" });
        const ws = wb.Sheets[wb.SheetNames[0]];
        data = XLSX.utils.sheet_to_json(ws, { defval: "" }) as Record<string, string>[];
      } else {
        const text = await file.text();
        const lines = text.split("\n").map(l => l.trim()).filter(Boolean);
        if (lines.length < 2) { toast({ title: "File has no data rows", variant: "destructive" }); return; }
        const headers = lines[0].split(",").map(h => h.replace(/^"|"$/g, "").trim());
        data = lines.slice(1).map(line => {
          const vals = line.split(",").map(v => v.replace(/^"|"$/g, "").trim());
          return Object.fromEntries(headers.map((h, i) => [h, vals[i] ?? ""]));
        });
      }
      if (!data.length) { toast({ title: "No data found", variant: "destructive" }); return; }
      setParsedRows(parseRows(data));
      setStep("preview");
    } catch (err) {
      toast({ title: "Failed to parse file", description: String(err), variant: "destructive" });
    }
  };

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault(); setIsDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) processFile(file);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) processFile(file);
  };

  const validRows = parsedRows.filter(r => r.player !== null && !existingRollNos.has(r.player?.rollNo ?? ""));
  const errorCount = parsedRows.filter(r => r.errors.length > 0).length;
  const dupCount   = parsedRows.filter(r => r.player !== null && existingRollNos.has(r.player?.rollNo ?? "")).length;

  const handleImport = async () => {
    if (!validRows.length) { toast({ title: "No valid rows to import", variant: "destructive" }); return; }
    setStep("importing");

    const players: Player[] = validRows.map(r => ({
      ...(r.player as Partial<Player>),
      id: crypto.randomUUID(),
      createdAt: Date.now(),
      gamesPlayed: 0, wins: 0, losses: 0, draws: 0,
      isRated: r.player?.isRated ?? false,
    } as Player));

    // Batch insert in groups of 10 to show progress
    const BATCH = 10;
    let success = 0, failed = 0;
    for (let i = 0; i < players.length; i += BATCH) {
      const batch = players.slice(i, i + BATCH);
      try {
        await onBulkImport(batch);
        success += batch.length;
      } catch { failed += batch.length; }
      setProgress(Math.round(((i + batch.length) / players.length) * 100));
    }

    setResult({ success, failed });
    setStep("done");
  };

  return (
    <Dialog open={open} onOpenChange={o => { if (!o) reset(); onOpenChange(o); }}>
      <DialogContent className="max-w-2xl flex flex-col" style={{ maxHeight: "90vh" }}>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileSpreadsheet className="h-5 w-5 text-primary" />
            Import Players — CSV / Excel
          </DialogTitle>
          <DialogDescription>
            {step === "upload"    && "Upload a CSV or Excel file to add multiple players at once"}
            {step === "preview"   && `${parsedRows.length} rows detected from "${fileName}"`}
            {step === "importing" && "Saving players to the database…"}
            {step === "done"      && "Import complete!"}
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-hidden py-2">
          {/* ── STEP 1 : UPLOAD ── */}
          {step === "upload" && (
            <div className="space-y-4">
              {/* Drop zone */}
              <div
                className={`border-2 border-dashed rounded-xl p-12 text-center cursor-pointer transition-all duration-200 ${
                  isDragging
                    ? "border-primary bg-primary/5 scale-[1.01]"
                    : "border-muted-foreground/25 hover:border-primary/60 hover:bg-muted/20"
                }`}
                onDragOver={e => { e.preventDefault(); setIsDragging(true); }}
                onDragLeave={() => setIsDragging(false)}
                onDrop={handleDrop}
                onClick={() => fileRef.current?.click()}
              >
                <input ref={fileRef} type="file" accept=".csv,.xlsx,.xls" className="hidden" onChange={handleFileChange} />
                <Upload className="h-10 w-10 mx-auto mb-3 text-muted-foreground" />
                <p className="font-semibold">Drag & drop your file here, or click to browse</p>
                <p className="text-xs text-muted-foreground mt-1">Supports .CSV · .XLSX · .XLS</p>
              </div>

              {/* Info box */}
              <div className="flex items-start gap-3 p-4 bg-amber-500/5 border border-amber-500/20 rounded-lg">
                <AlertCircle className="h-4 w-4 text-amber-500 mt-0.5 shrink-0" />
                <div className="text-sm space-y-1">
                  <p className="font-medium">
                    Required columns:{" "}
                    <code className="text-xs bg-muted px-1 rounded">name</code>{" "}
                    <code className="text-xs bg-muted px-1 rounded">rollNo</code>
                  </p>
                  <p className="text-muted-foreground text-xs">
                    Optional: branch · year · division · isRated (true/false) · officialElo · fideRating · estimatedElo
                  </p>
                </div>
              </div>

              {/* Template download */}
              <Button variant="outline" className="w-full gap-2" onClick={downloadTemplate}>
                <Download className="h-4 w-4" />
                Download Template CSV
              </Button>
            </div>
          )}

          {/* ── STEP 2 : PREVIEW ── */}
          {step === "preview" && (
            <div className="space-y-3">
              {/* Summary badges */}
              <div className="flex items-center gap-2 flex-wrap">
                <Badge className="gap-1 bg-green-500/10 text-green-600 border border-green-500/30 hover:bg-green-500/10">
                  <CheckCircle className="h-3 w-3" /> {validRows.length} ready to import
                </Badge>
                {dupCount > 0 && (
                  <Badge className="gap-1 bg-amber-500/10 text-amber-600 border border-amber-500/30 hover:bg-amber-500/10">
                    <AlertCircle className="h-3 w-3" /> {dupCount} duplicate (will be skipped)
                  </Badge>
                )}
                {errorCount > 0 && (
                  <Badge className="gap-1 bg-red-500/10 text-red-600 border border-red-500/30 hover:bg-red-500/10">
                    <XCircle className="h-3 w-3" /> {errorCount} invalid (will be skipped)
                  </Badge>
                )}
              </div>

              {/* Preview table */}
              <ScrollArea className="h-[340px] border rounded-lg">
                <table className="w-full text-xs">
                  <thead className="sticky top-0 bg-background border-b z-10">
                    <tr>
                      <th className="text-left px-3 py-2.5 font-medium text-muted-foreground w-12">#</th>
                      <th className="text-left px-3 py-2.5 font-medium text-muted-foreground">Name</th>
                      <th className="text-left px-3 py-2.5 font-medium text-muted-foreground">Roll No</th>
                      <th className="text-left px-3 py-2.5 font-medium text-muted-foreground">Branch</th>
                      <th className="text-left px-3 py-2.5 font-medium text-muted-foreground">Year</th>
                      <th className="text-left px-3 py-2.5 font-medium text-muted-foreground">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {parsedRows.map(row => {
                      const isDup = row.player !== null && existingRollNos.has(row.player?.rollNo ?? "");
                      const hasErr = row.errors.length > 0;
                      return (
                        <tr
                          key={row.rowIndex}
                          className={`border-b transition-colors ${
                            hasErr ? "bg-red-500/5"
                            : isDup ? "bg-amber-500/5"
                            : "hover:bg-muted/30"
                          }`}
                        >
                          <td className="px-3 py-2 text-muted-foreground">{row.rowIndex}</td>
                          <td className="px-3 py-2 font-medium">{row.player?.name || <span className="text-red-500 italic">missing</span>}</td>
                          <td className="px-3 py-2 text-muted-foreground">{row.player?.rollNo || <span className="text-red-500 italic">missing</span>}</td>
                          <td className="px-3 py-2">{row.player?.branch || "—"}</td>
                          <td className="px-3 py-2">{(row.player as any)?.year || "—"}</td>
                          <td className="px-3 py-2">
                            {hasErr ? (
                              <span className="text-red-500 flex items-center gap-1">
                                <XCircle className="h-3 w-3 shrink-0" /> {row.errors[0]}
                              </span>
                            ) : isDup ? (
                              <span className="text-amber-500 flex items-center gap-1">
                                <AlertCircle className="h-3 w-3 shrink-0" /> Already exists
                              </span>
                            ) : (
                              <span className="text-green-500 flex items-center gap-1">
                                <CheckCircle className="h-3 w-3 shrink-0" /> Ready
                              </span>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </ScrollArea>
            </div>
          )}

          {/* ── STEP 3 : IMPORTING ── */}
          {step === "importing" && (
            <div className="flex flex-col items-center justify-center py-14 gap-5">
              <Loader2 className="h-12 w-12 animate-spin text-primary" />
              <p className="font-semibold text-lg">Importing {validRows.length} players…</p>
              <div className="w-full max-w-xs space-y-2">
                <Progress value={progress} className="h-2" />
                <p className="text-xs text-center text-muted-foreground">{progress}% complete</p>
              </div>
            </div>
          )}

          {/* ── STEP 4 : DONE ── */}
          {step === "done" && (
            <div className="flex flex-col items-center justify-center py-14 gap-4">
              <div className="h-20 w-20 rounded-full bg-green-500/10 flex items-center justify-center">
                <CheckCircle className="h-11 w-11 text-green-500" />
              </div>
              <div className="text-center space-y-1">
                <p className="text-2xl font-bold">{result.success} Players Imported!</p>
                {result.failed > 0 && (
                  <p className="text-sm text-destructive">{result.failed} players failed to save</p>
                )}
                <p className="text-sm text-muted-foreground mt-2">
                  They are now available to add to any tournament.
                </p>
              </div>
            </div>
          )}
        </div>

        <DialogFooter className="border-t pt-4">
          {step === "upload" && (
            <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          )}
          {step === "preview" && (
            <>
              <Button variant="outline" className="gap-1" onClick={reset}>
                <ArrowLeft className="h-4 w-4" /> Back
              </Button>
              <Button onClick={handleImport} disabled={validRows.length === 0} className="gap-1">
                Import {validRows.length} Players <ArrowRight className="h-4 w-4" />
              </Button>
            </>
          )}
          {step === "done" && (
            <Button onClick={() => { reset(); onOpenChange(false); }}>Close</Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
