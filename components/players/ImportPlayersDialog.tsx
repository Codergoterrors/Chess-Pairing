"use client";

import { useState, useCallback, useRef } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Upload, FileSpreadsheet, CheckCircle2, XCircle, AlertCircle, Download, RefreshCw, FilePen } from "lucide-react";
import { Player } from "@/lib/types";
import * as XLSX from "xlsx";

// ─── Types ────────────────────────────────────────────────────────
interface Props {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  onBulkImport: (players: Player[]) => Promise<void>;
  /** Called for each existing player that has new fields to fill in. */
  onUpdatePlayer: (id: string, patch: Partial<Player>) => Promise<void>;
  existingPlayers: Player[];
}

type RowStatus = "ready" | "update" | "duplicate" | "error";

interface ParsedRow {
  raw: Record<string, string>;
  player: Partial<Player> | null;
  errors: string[];
  rowIndex: number;
  status: RowStatus;
  /** ID of existing player to patch (status === "update") */
  updateTarget?: string;
  /** Fields that will be written to the existing player */
  updateFields?: Partial<Player>;
  /** Human-readable list of field names being updated */
  updateSummary?: string;
  dupReason?: "roll_no" | "name_contact" | "within_file" | "no_new_data";
}

// ─── Column map ───────────────────────────────────────────────────
const COLUMN_MAP: Record<string, keyof Player | "_skip"> = {
  // Name
  name: "name", fullname: "name", playername: "name", studentname: "name",
  candidatename: "name", applicantname: "name", participantname: "name",
  // Roll No
  rollno: "rollNo", rollnumber: "rollNo", roll: "rollNo",
  seatno: "rollNo", seatnumber: "rollNo",
  // Enrollment / PRN / ISTU
  enrollment: "enrollmentNo", enrollmentno: "enrollmentNo", enrollmentnumber: "enrollmentNo",
  enrolno: "enrollmentNo", enrolmentno: "enrollmentNo",
  prn: "enrollmentNo", prnno: "enrollmentNo", prnnumber: "enrollmentNo",
  istu: "enrollmentNo", istuno: "enrollmentNo", istunumber: "enrollmentNo", istucode: "enrollmentNo",
  // "ISTU no. / PRN No. " → istunoprnno (double-n, 11 chars)
  istunoprnno: "enrollmentNo", istucodeprnno: "enrollmentNo",
  istuprn: "enrollmentNo", prnnoistuno: "enrollmentNo",
  universityno: "enrollmentNo", regno: "enrollmentNo",
  registrationno: "enrollmentNo", admissionno: "enrollmentNo",
  studentid: "enrollmentNo", studentno: "enrollmentNo", uid: "enrollmentNo",
  // Branch / Dept
  branch: "branch", dept: "branch", department: "branch",
  stream: "branch", faculty: "branch", specialization: "branch",
  // Year
  year: "year", class: "year", sem: "year", semester: "year",
  academicyear: "year", studyyear: "year",
  // Division
  division: "division", div: "division", section: "division",
  batch: "division", group: "division",
  // Program
  program: "program", programme: "program", course: "program", degree: "program",
  // Mobile
  mobile: "mobileNo", mobileno: "mobileNo", mobilenumber: "mobileNo",
  phone: "mobileNo", phoneno: "mobileNo", phonenumber: "mobileNo",
  contact: "mobileNo", contactno: "mobileNo",
  whatsapp: "mobileNo", whatsappno: "mobileNo",
  cell: "mobileNo", cellno: "mobileNo",
  // Email
  email: "email", emailid: "email", emailaddress: "email",
  mail: "email", mailid: "email",
  // ELO / Rating
  elo: "officialElo", elorating: "officialElo", rating: "officialElo",
  chessrating: "officialElo", officialelo: "officialElo",
  officialrating: "officialElo", clubrating: "officialElo",
  // Google-Form long header: "If yes then what is your rating / elo ? ..."
  ifyesthenwhatisourratingelochesscomlicessfiderating: "officialElo",
  fiderating: "fideRating", fide: "fideRating", fideelo: "fideRating",
  estimatedelo: "estimatedElo", estimatedrating: "estimatedElo",
  // Rated flag
  israted: "isRated", rated: "isRated",
};

// Friendly display names for fields shown in the "Will update" summary
const FIELD_LABELS: Partial<Record<keyof Player, string>> = {
  enrollmentNo: "Enrollment No.", rollNo: "Roll No", branch: "Branch",
  year: "Year", division: "Division", program: "Program",
  mobileNo: "Mobile No.", email: "Email",
  officialElo: "Official Elo", fideRating: "FIDE Rating", estimatedElo: "Est. Elo",
};

// Fields that are candidates for auto-fill from CSV → DB
const FILLABLE_FIELDS: Array<keyof Player> = [
  "enrollmentNo", "rollNo", "branch", "year", "division", "program",
  "mobileNo", "email", "officialElo", "fideRating", "estimatedElo",
];

function normaliseHeader(h: string): string {
  return h.toLowerCase().replace(/[^a-z0-9]/g, "");
}

function lookupField(normHeader: string): keyof Player | "_skip" | null {
  if (COLUMN_MAP[normHeader] !== undefined) return COLUMN_MAP[normHeader];
  // Fallback: long rating column names from Google Forms
  if (
    (normHeader.includes("rating") || normHeader.includes("elo")) &&
    (normHeader.includes("yes") || normHeader.includes("what") ||
     normHeader.includes("chess") || normHeader.includes("fide"))
  ) return "officialElo";
  return null;
}

// ─── Proper full-document CSV parser (handles multiline quoted fields) ──
function parseCSVFull(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let current = "";
  let inQuotes = false;

  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (ch === '"') {
      if (inQuotes && text[i + 1] === '"') { current += '"'; i++; }
      else inQuotes = !inQuotes;
    } else if (ch === ',' && !inQuotes) {
      row.push(current.trim()); current = "";
    } else if ((ch === '\r' || ch === '\n') && !inQuotes) {
      if (ch === '\r' && i + 1 < text.length && text[i + 1] === '\n') i++;
      row.push(current.trim()); current = "";
      if (row.some(v => v.trim() !== "")) rows.push(row);
      row = [];
    } else {
      if (inQuotes && ch === '\r') {
        current += '\n';
        if (i + 1 < text.length && text[i + 1] === '\n') i++;
      } else {
        current += ch;
      }
    }
  }
  row.push(current.trim());
  if (row.some(v => v.trim() !== "")) rows.push(row);
  return rows;
}

// ─── Extract numeric rating (>= 100 only; lower values = not a real rating) ──
function extractRating(raw: string): number | null {
  const v = raw.trim().toLowerCase();
  if (!v || ["na","n/a","no","idk","none","nil",".","dn","-"].includes(v)) return null;
  const m = raw.match(/\d+/);
  if (!m) return null;
  const n = Number(m[0]);
  return n >= 100 ? n : null;
}

// ─── Parse rows ───────────────────────────────────────────────────
function parseRows(
  headers: string[],
  dataRows: string[][],
  existingPlayers: Player[],
): ParsedRow[] {
  const colToField = headers.map(h => lookupField(normaliseHeader(h)));

  // Build lookup maps from existing players
  const playerByRollNo = new Map<string, Player>();
  const playerByMobile = new Map<string, Player>();
  const playerByEmail  = new Map<string, Player>();
  existingPlayers.forEach(p => {
    if (p.rollNo?.trim())   playerByRollNo.set(p.rollNo.toLowerCase().trim(), p);
    if (p.mobileNo?.trim()) playerByMobile.set(p.mobileNo.trim(), p);
    if (p.email?.trim())    playerByEmail.set(p.email.trim().toLowerCase(), p);
  });

  // Within-file dedup
  const seenMobiles = new Set<string>();
  const seenEmails  = new Set<string>();

  const results: ParsedRow[] = [];

  for (let i = 0; i < dataRows.length; i++) {
    const cols = dataRows[i];
    const raw: Record<string, string> = {};
    const player: Partial<Player> = {};
    const errors: string[] = [];

    cols.forEach((val, ci) => {
      const field = colToField[ci];
      if (!field || field === "_skip" || val === "") return;
      raw[headers[ci]] = val;

      switch (field) {
        case "name": {
          const v = val.trim();
          if (/^\d+(\.\d+)?$/.test(v))  errors.push(`Name "${v}" looks like a number`);
          else if (v.length < 2)         errors.push("Name too short");
          else if (v.length > 120)       errors.push("Name too long");
          else                           player.name = v;
          break;
        }
        case "rollNo":
          player.rollNo = val.trim();
          break;
        case "branch":
        case "year":
        case "division":
        case "program":
        case "enrollmentNo":
          (player as any)[field] = val.trim();
          break;
        case "mobileNo": {
          const c = val.trim().replace(/[\s\-()]/g, "");
          if (/^\+?\d{6,15}$/.test(c)) player.mobileNo = c;
          break;
        }
        case "email": {
          const e = val.trim().toLowerCase();
          if (e.includes("@") && e.length >= 5) player.email = e;
          break;
        }
        case "officialElo":
        case "fideRating":
        case "estimatedElo": {
          const n = extractRating(val);
          if (n !== null) { (player as any)[field] = n; player.isRated = true; }
          break;
        }
        case "isRated":
          player.isRated = ["true","yes","1","rated"].includes(val.toLowerCase().trim());
          break;
      }
    });

    // Skip pure junk rows (e.g. declaration text from Google Forms header)
    if (!player.name?.trim()) {
      const isJunk = cols.filter(v => v.trim()).length <= 1;
      if (!isJunk) errors.push("Name is required");
      else { results.push({ raw, player: null, errors: [], rowIndex: i, status: "error" }); continue; }
    }

    if (errors.length > 0) {
      results.push({ raw, player: null, errors, rowIndex: i, status: "error" });
      continue;
    }

    const rollNoLow = (player.rollNo ?? "").toLowerCase().trim();
    const mobile    = player.mobileNo?.trim() ?? "";
    const email     = player.email?.trim() ?? "";

    // ── Check for existing player in DB ──────────────────────────
    const existing =
      (rollNoLow && playerByRollNo.get(rollNoLow)) ||
      (mobile    && playerByMobile.get(mobile))    ||
      (email     && playerByEmail.get(email))      ||
      null;

    if (existing) {
      // Build a patch of fields the CSV has but the DB is missing
      const patch: Partial<Player> = {};
      for (const field of FILLABLE_FIELDS) {
        const csvVal = (player as any)[field];
        const dbVal  = (existing as any)[field];
        const isEmpty = (v: unknown) => v === undefined || v === null || v === "" || v === 0;
        if (!isEmpty(csvVal) && isEmpty(dbVal)) {
          (patch as any)[field] = csvVal;
        }
      }

      if (Object.keys(patch).length > 0) {
        // Can fill in missing fields → "update" row
        const summary = Object.keys(patch)
          .map(k => FIELD_LABELS[k as keyof Player] ?? k)
          .join(", ");
        results.push({
          raw, player: patch, errors: [], rowIndex: i,
          status: "update",
          updateTarget: existing.id,
          updateFields: patch,
          updateSummary: summary,
        });
      } else {
        // Duplicate, nothing new to add
        results.push({
          raw, player: null, errors: [], rowIndex: i,
          status: "duplicate", dupReason: "no_new_data",
        });
      }
      // Register in seen sets so within-file dupes are caught
      if (mobile) seenMobiles.add(mobile);
      if (email)  seenEmails.add(email);
      continue;
    }

    // ── Within-file duplicate check ───────────────────────────────
    let withinDup = false;
    if (mobile && seenMobiles.has(mobile)) withinDup = true;
    if (email  && seenEmails.has(email))   withinDup = true;
    if (withinDup) {
      results.push({ raw, player: null, errors: [], rowIndex: i, status: "duplicate", dupReason: "within_file" });
      continue;
    }
    if (mobile) seenMobiles.add(mobile);
    if (email)  seenEmails.add(email);

    results.push({ raw, player, errors: [], rowIndex: i, status: "ready" });
  }

  return results;
}

// ─── Template download ────────────────────────────────────────────
function downloadTemplate() {
  const headers = ["name","rollNo","program","branch","year","division","enrollmentNo","mobileNo","email","officialElo","fideRating"];
  const example = ["Rahul Sharma","DW236","B.Tech","CE","SY","SA1","24BCE001","9876543210","rahul@example.com","",""];
  const csv = [headers.join(","), example.join(",")].join("\n");
  const blob = new Blob([csv], { type: "text/csv" });
  const url  = URL.createObjectURL(blob);
  const a = document.createElement("a"); a.href = url; a.download = "players_template.csv"; a.click();
  URL.revokeObjectURL(url);
}

const STATUS_ICONS: Record<RowStatus, React.ReactNode> = {
  ready:     <CheckCircle2 className="h-4 w-4 text-green-500" />,
  update:    <FilePen      className="h-4 w-4 text-blue-500"  />,
  duplicate: <AlertCircle  className="h-4 w-4 text-amber-500" />,
  error:     <XCircle      className="h-4 w-4 text-red-500"   />,
};

// ─── Component ────────────────────────────────────────────────────
export function ImportPlayersDialog({ open, onOpenChange, onBulkImport, onUpdatePlayer, existingPlayers }: Props) {
  const [step, setStep]           = useState<"upload" | "preview" | "importing" | "done">("upload");
  const [parsedRows, setParsedRows] = useState<ParsedRow[]>([]);
  const [progress, setProgress]   = useState(0);
  const [importedCount, setImportedCount] = useState(0);
  const [updatedCount, setUpdatedCount]   = useState(0);
  const [dragging, setDragging]   = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const readFile = useCallback((file: File) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const data = e.target?.result;
      let headers: string[] = [];
      let dataRows: string[][] = [];

      if (file.name.toLowerCase().endsWith(".csv")) {
        const allRows = parseCSVFull(data as string);
        if (allRows.length < 2) { alert("CSV appears empty."); return; }
        headers  = allRows[0];
        dataRows = allRows.slice(1);
      } else {
        const wb   = XLSX.read(data, { type: "binary" });
        const ws   = wb.Sheets[wb.SheetNames[0]];
        const rows = XLSX.utils.sheet_to_json(ws, { header: 1, defval: "" }) as string[][];
        if (rows.length < 2) return;
        headers  = rows[0].map(String);
        dataRows = rows.slice(1).map(r => r.map(String));
      }

      dataRows = dataRows.filter(r => r.some(v => v.trim() !== ""));
      setParsedRows(parseRows(headers, dataRows, existingPlayers));
      setStep("preview");
    };

    if (file.name.toLowerCase().endsWith(".csv")) reader.readAsText(file);
    else reader.readAsBinaryString(file);
  }, [existingPlayers]);

  const onDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault(); setDragging(false);
    const f = e.dataTransfer.files[0]; if (f) readFile(f);
  }, [readFile]);

  const handleImport = async () => {
    const readyRows  = parsedRows.filter(r => r.status === "ready");
    const updateRows = parsedRows.filter(r => r.status === "update");
    if (readyRows.length === 0 && updateRows.length === 0) return;

    setStep("importing"); setProgress(0);
    const total = readyRows.length + updateRows.length;
    let done = 0;

    try {
      // 1. Add new players in chunks
      const CHUNK = 50;
      const batch: Player[] = readyRows.map(r => ({
        ...r.player, id: crypto.randomUUID(), createdAt: Date.now(),
      } as Player));
      for (let i = 0; i < batch.length; i += CHUNK) {
        await onBulkImport(batch.slice(i, i + CHUNK));
        done += Math.min(CHUNK, batch.length - i);
        setProgress(Math.round((done / total) * 100));
      }

      // 2. Patch existing players one by one
      for (const row of updateRows) {
        await onUpdatePlayer(row.updateTarget!, row.updateFields!);
        done++;
        setProgress(Math.round((done / total) * 100));
      }

      setImportedCount(readyRows.length);
      setUpdatedCount(updateRows.length);
      setStep("done");
    } catch (e) {
      console.error(e);
      setStep("preview");
    }
  };

  const reset = () => { setStep("upload"); setParsedRows([]); setProgress(0); setImportedCount(0); setUpdatedCount(0); };

  const counts = {
    ready:     parsedRows.filter(r => r.status === "ready").length,
    update:    parsedRows.filter(r => r.status === "update").length,
    duplicate: parsedRows.filter(r => r.status === "duplicate").length,
    error:     parsedRows.filter(r => r.status === "error").length,
  };
  const actionable = counts.ready + counts.update;

  return (
    <Dialog open={open} onOpenChange={v => { if (!v) reset(); onOpenChange(v); }}>
      <DialogContent className="max-w-3xl flex flex-col" style={{ maxHeight: "90vh" }}>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileSpreadsheet className="h-5 w-5 text-primary" />
            Import Players from CSV / Excel
          </DialogTitle>
          <DialogDescription>
            Recognised columns are imported; everything else is ignored.
            Already-existing players get their missing fields filled in automatically.
          </DialogDescription>
        </DialogHeader>

        {/* ── UPLOAD ── */}
        {step === "upload" && (
          <div className="space-y-4 py-2">
            <div
              className={`border-2 border-dashed rounded-xl p-10 text-center transition-colors cursor-pointer
                ${dragging ? "border-primary bg-primary/5" : "border-muted-foreground/30 hover:border-primary/50"}`}
              onDragOver={e => { e.preventDefault(); setDragging(true); }}
              onDragLeave={() => setDragging(false)}
              onDrop={onDrop}
              onClick={() => fileRef.current?.click()}
            >
              <Upload className="h-10 w-10 mx-auto mb-3 text-muted-foreground" />
              <p className="font-medium">Drop your file here or click to browse</p>
              <p className="text-sm text-muted-foreground mt-1">Supports .csv, .xlsx, .xls</p>
              <input ref={fileRef} type="file" className="hidden" accept=".csv,.xlsx,.xls"
                onChange={e => { const f = e.target.files?.[0]; if (f) readFile(f); }} />
            </div>

            <div className="flex items-center justify-between text-sm text-muted-foreground bg-muted/40 rounded-lg p-3">
              <span>Not sure about the format?</span>
              <Button variant="ghost" size="sm" className="gap-1.5 h-7" onClick={downloadTemplate}>
                <Download className="h-3.5 w-3.5" /> Download Template
              </Button>
            </div>

            <div className="text-xs border rounded-lg p-3 space-y-2">
              <p className="font-medium">Recognised column names (case-insensitive, dots/spaces ignored):</p>
              <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-muted-foreground">
                {([
                  ["Name",           "Name, Full Name, Student Name"],
                  ["Roll No",        "Roll No, Roll Number, Seat No"],
                  ["Enrollment No.", "PRN, PRN No., ISTU Code, ISTU No, ISTU no./PRN No., Reg No, Admission No"],
                  ["Branch",         "Branch, Dept, Dept., Department, Stream, Faculty"],
                  ["Year",           "Year, Class, Sem, Semester"],
                  ["Division",       "Division, Section, Batch, Group"],
                  ["Program",        "Program, Programme, Course, Degree"],
                  ["Mobile No.",     "Mobile, Mobile No., Phone, Contact, WhatsApp No"],
                  ["Email",          "Email, Email ID, E-mail, Mail ID"],
                  ["Official Elo",   "ELO, Rating, Chess Rating, Elo Rating, Official Elo"],
                  ["FIDE Rating",    "FIDE, FIDE Rating, FIDE Elo"],
                ] as [string, string][]).map(([f, a]) => (
                  <div key={f}>
                    <span className="font-semibold text-foreground">{f}:</span>{" "}
                    <span>{a}</span>
                  </div>
                ))}
              </div>
              <p className="text-blue-500 mt-1">
                ✦ Re-importing a file will automatically fill in any missing fields for existing players.
              </p>
              <p className="text-amber-600 dark:text-amber-400">
                ⚠ Rating values like <span className="font-mono">NA</span>, <span className="font-mono">Idk</span>, <span className="font-mono">580 chess.com</span> are handled automatically.
              </p>
            </div>
          </div>
        )}

        {/* ── PREVIEW ── */}
        {step === "preview" && (
          <div className="flex flex-col gap-3 min-h-0 flex-1">
            <div className="flex items-center gap-2 flex-wrap">
              {counts.ready > 0 && (
                <span className="inline-flex items-center gap-1 text-xs px-2 py-1 rounded-full bg-green-500/15 text-green-600 border border-green-500/30">
                  <CheckCircle2 className="h-3 w-3" /> {counts.ready} new
                </span>
              )}
              {counts.update > 0 && (
                <span className="inline-flex items-center gap-1 text-xs px-2 py-1 rounded-full bg-blue-500/15 text-blue-600 border border-blue-500/30">
                  <FilePen className="h-3 w-3" /> {counts.update} will update (fill missing fields)
                </span>
              )}
              {counts.duplicate > 0 && (
                <span className="inline-flex items-center gap-1 text-xs px-2 py-1 rounded-full bg-amber-500/15 text-amber-600 border border-amber-500/30">
                  <AlertCircle className="h-3 w-3" /> {counts.duplicate} skip (already up-to-date)
                </span>
              )}
              {counts.error > 0 && (
                <span className="inline-flex items-center gap-1 text-xs px-2 py-1 rounded-full bg-red-500/15 text-red-600 border border-red-500/30">
                  <XCircle className="h-3 w-3" /> {counts.error} error (skip)
                </span>
              )}
            </div>

            <div className="overflow-auto flex-1 border rounded-lg">
              <table className="w-full text-xs">
                <thead className="bg-muted/60 sticky top-0">
                  <tr>
                    {["#","","Name","Roll No","Branch","Program","Mobile","Email","Elo","Note"].map(h => (
                      <th key={h} className="text-left px-3 py-2 font-medium whitespace-nowrap">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {parsedRows.map((row, i) => {
                    const p = row.player ?? {};
                    const rowBg =
                      row.status === "update"    ? "bg-blue-500/5"   :
                      row.status === "duplicate" ? "bg-amber-500/5"  :
                      row.status === "error"     ? "bg-red-500/5"    : "";
                    return (
                      <tr key={i} className={`border-b last:border-0 ${rowBg}`}>
                        <td className="px-3 py-2 text-muted-foreground">{row.rowIndex + 1}</td>
                        <td className="px-3 py-2">{STATUS_ICONS[row.status]}</td>
                        <td className="px-3 py-2 font-medium max-w-[110px] truncate">
                          {(p as any).name ?? <span className="text-muted-foreground italic">—</span>}
                        </td>
                        <td className="px-3 py-2 text-muted-foreground">{(p as any).rollNo ?? "—"}</td>
                        <td className="px-3 py-2 text-muted-foreground">{(p as any).branch ?? "—"}</td>
                        <td className="px-3 py-2 text-muted-foreground">{(p as any).program ?? "—"}</td>
                        <td className="px-3 py-2 text-muted-foreground">{(p as any).mobileNo ?? "—"}</td>
                        <td className="px-3 py-2 text-muted-foreground max-w-[100px] truncate">{(p as any).email ?? "—"}</td>
                        <td className="px-3 py-2 text-muted-foreground">{(p as any).officialElo ?? "—"}</td>
                        <td className="px-3 py-2 max-w-[160px]">
                          {row.status === "error" &&
                            <span className="text-red-500">{row.errors.join("; ")}</span>}
                          {row.status === "update" && row.updateSummary &&
                            <span className="text-blue-500">Will add: {row.updateSummary}</span>}
                          {row.status === "duplicate" && row.dupReason === "within_file" &&
                            <span className="text-amber-600">Duplicate in file</span>}
                          {row.status === "duplicate" && row.dupReason === "no_new_data" &&
                            <span className="text-amber-600">Already up-to-date</span>}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* ── IMPORTING ── */}
        {step === "importing" && (
          <div className="py-8 text-center space-y-4">
            <RefreshCw className="h-10 w-10 mx-auto animate-spin text-primary" />
            <p className="font-medium">Importing…</p>
            <Progress value={progress} className="max-w-sm mx-auto" />
            <p className="text-sm text-muted-foreground">{progress}% complete</p>
          </div>
        )}

        {/* ── DONE ── */}
        {step === "done" && (
          <div className="py-8 text-center space-y-3">
            <CheckCircle2 className="h-12 w-12 mx-auto text-green-500" />
            <p className="text-lg font-semibold">Done!</p>
            {importedCount > 0 && <p className="text-muted-foreground">{importedCount} new player{importedCount !== 1 ? "s" : ""} added.</p>}
            {updatedCount  > 0 && <p className="text-blue-500">{updatedCount} existing player{updatedCount !== 1 ? "s" : ""} updated with missing fields.</p>}
            {counts.duplicate > 0 && <p className="text-sm text-muted-foreground">{counts.duplicate} already up-to-date (skipped).</p>}
            {counts.error > 0 && <p className="text-sm text-red-500">{counts.error} row{counts.error !== 1 ? "s" : ""} with errors skipped.</p>}
          </div>
        )}

        <DialogFooter className="border-t pt-3">
          {step === "upload"  && <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>}
          {step === "preview" && (
            <>
              <Button variant="outline" onClick={reset}>← Back</Button>
              <Button onClick={handleImport} disabled={actionable === 0}>
                {counts.ready > 0 && counts.update > 0
                  ? `Add ${counts.ready} + Update ${counts.update} Players`
                  : counts.ready > 0
                  ? `Add ${counts.ready} Player${counts.ready !== 1 ? "s" : ""}`
                  : `Update ${counts.update} Player${counts.update !== 1 ? "s" : ""}`}
              </Button>
            </>
          )}
          {step === "done" && (
            <>
              <Button variant="outline" onClick={reset}>Import More</Button>
              <Button onClick={() => { reset(); onOpenChange(false); }}>Done</Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
