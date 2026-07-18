"use client";

import { useState, useCallback, useRef } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Upload, FileSpreadsheet, CheckCircle2, XCircle, AlertCircle, Download, RefreshCw } from "lucide-react";
import { Player } from "@/lib/types";
import * as XLSX from "xlsx";

// ─── Types ────────────────────────────────────────────────────────
interface Props {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  onBulkImport: (players: Player[]) => Promise<void>;
  existingPlayers: Player[];
}

type DupReason = "roll_no" | "name_contact" | "within_file";

interface ParsedRow {
  raw: Record<string, string>;
  player: Partial<Player> | null;
  errors: string[];
  rowIndex: number;
  dupReason?: DupReason;
}

// ─── Column map: normalised header → Player field ─────────────────
// normaliseHeader strips ALL non-alphanumeric chars + lowercases.
// So "ISTU no. / PRN No." → "istunoprnnno", "E-mail" → "email", etc.
// Keys here must be lowercase alphanumeric only.
const COLUMN_MAP: Record<string, keyof Player | "_skip"> = {

  // ── Name ──────────────────────────────────────────────────────────
  name: "name",
  fullname: "name",
  playername: "name",
  studentname: "name",
  candidatename: "name",
  applicantname: "name",
  participantname: "name",
  membername: "name",

  // ── Roll No ───────────────────────────────────────────────────────
  rollno: "rollNo",
  rollnumber: "rollNo",
  roll: "rollNo",
  seatno: "rollNo",
  seatnumber: "rollNo",

  // ── Enrollment / PRN / ISTU / Reg / Admission ─────────────────────
  enrollment: "enrollmentNo",
  enrollmentno: "enrollmentNo",
  enrollmentnumber: "enrollmentNo",
  enrolno: "enrollmentNo",
  enrolment: "enrollmentNo",
  enrolmentno: "enrollmentNo",
  prn: "enrollmentNo",
  prnno: "enrollmentNo",
  prnnumber: "enrollmentNo",
  prncode: "enrollmentNo",
  // "ISTU no." alone
  istu: "enrollmentNo",
  istuno: "enrollmentNo",
  istunumber: "enrollmentNo",
  istucode: "enrollmentNo",
  // "ISTU no. / PRN No." combined (Google-Form style)
  istunoprnnno: "enrollmentNo",
  istucodeprnno: "enrollmentNo",
  istuprn: "enrollmentNo",
  prnnoistuno: "enrollmentNo",
  universityno: "enrollmentNo",
  universitynumber: "enrollmentNo",
  universityenrollmentno: "enrollmentNo",
  universityrollno: "enrollmentNo",
  admissionno: "enrollmentNo",
  admissionnumber: "enrollmentNo",
  admissionid: "enrollmentNo",
  regno: "enrollmentNo",
  registrationno: "enrollmentNo",
  registrationnumber: "enrollmentNo",
  studentid: "enrollmentNo",
  studentno: "enrollmentNo",
  studentcode: "enrollmentNo",
  studentnumber: "enrollmentNo",
  uid: "enrollmentNo",
  uniqueid: "enrollmentNo",

  // ── Branch / Department / Stream ──────────────────────────────────
  branch: "branch",
  dept: "branch",
  department: "branch",
  stream: "branch",
  faculty: "branch",
  engineering: "branch",
  specialization: "branch",
  specialisation: "branch",

  // ── Year / Class / Semester ───────────────────────────────────────
  year: "year",
  class: "year",
  sem: "year",
  semester: "year",
  academicyear: "year",
  studyyear: "year",
  currentyear: "year",

  // ── Division / Section / Batch ────────────────────────────────────
  division: "division",
  div: "division",
  section: "division",
  batch: "division",
  group: "division",

  // ── Program / Course / Degree ─────────────────────────────────────
  program: "program",
  programme: "program",
  course: "program",
  degree: "program",

  // ── Mobile / Phone / Contact ──────────────────────────────────────
  mobile: "mobileNo",
  mobileno: "mobileNo",
  mobilenumber: "mobileNo",
  phone: "mobileNo",
  phoneno: "mobileNo",
  phonenumber: "mobileNo",
  contact: "mobileNo",
  contactno: "mobileNo",
  contactnumber: "mobileNo",
  whatsapp: "mobileNo",
  whatsappno: "mobileNo",
  whatsappnumber: "mobileNo",
  cell: "mobileNo",
  cellno: "mobileNo",
  cellnumber: "mobileNo",

  // ── Email ─────────────────────────────────────────────────────────
  email: "email",
  emailid: "email",
  emailaddress: "email",
  mail: "email",
  mailid: "email",

  // ── Ratings / ELO ─────────────────────────────────────────────────
  // Generic "rating" / "elo" alone → officialElo (best single-column guess)
  elo: "officialElo",
  elorating: "officialElo",
  rating: "officialElo",
  chessrating: "officialElo",
  currentrating: "officialElo",
  officialelo: "officialElo",
  officialrating: "officialElo",
  clubrating: "officialElo",
  clubelo: "officialElo",
  acfrating: "officialElo",
  // Google-Form style: "If yes then what is your rating / elo ? ( chess.com / lichess / fide rating )"
  ifyesthenwhatisourratingelochesscomlicessfiderating: "officialElo",
  ifyesthenwhatisourratingelochesscomlicessfiderating2: "officialElo",
  // Other long variants containing "rating" and "elo" in one phrase
  fiderating: "fideRating",
  fide: "fideRating",
  fideelo: "fideRating",
  internationalrating: "fideRating",
  estimatedelo: "estimatedElo",
  estimatedrating: "estimatedElo",
  localrating: "estimatedElo",

  // ── Rated flag ────────────────────────────────────────────────────
  israted: "isRated",
  rated: "isRated",
};

// Normalise a header string for COLUMN_MAP lookup.
// Strips ALL non-alphanumeric characters (dots, dashes, #, spaces, /, ()…)
// Examples: "ISTU no. / PRN No." → "istunoprnnno"
//           "Phone no."         → "phoneno"
//           "E-mail"            → "email"
function normaliseHeader(h: string): string {
  return h.toLowerCase().replace(/[^a-z0-9]/g, "");
}

// ─── Smart column lookup: exact, then "contains" fallback ─────────
// If a header normalises to something not in COLUMN_MAP,
// we check if any known rating/elo keyword is contained in it.
function lookupField(normHeader: string): keyof Player | "_skip" | null {
  if (COLUMN_MAP[normHeader] !== undefined) return COLUMN_MAP[normHeader];
  // Fallback: if the header (after normalisation) contains "elo" or "rating"
  // AND also contains some qualifier that suggests it's a user-rating field,
  // map it to officialElo. This handles very long Google-Form column names.
  if (
    (normHeader.includes("rating") || normHeader.includes("elo")) &&
    (normHeader.includes("yes") || normHeader.includes("what") || normHeader.includes("chess") || normHeader.includes("fide"))
  ) {
    return "officialElo";
  }
  return null;
}

// ─── Proper full-document CSV parser ─────────────────────────────
// Handles multiline quoted fields correctly. Google Forms CSV exports
// often have a "Declaration" column whose value spans multiple lines.
function parseCSVFull(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let current = "";
  let inQuotes = false;

  for (let i = 0; i < text.length; i++) {
    const ch = text[i];

    if (ch === '"') {
      if (inQuotes && text[i + 1] === '"') {
        current += '"';   // escaped quote "" → single "
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (ch === ',' && !inQuotes) {
      row.push(current.trim());
      current = "";
    } else if ((ch === '\r' || ch === '\n') && !inQuotes) {
      // Row boundary — skip \r in \r\n
      if (ch === '\r' && i + 1 < text.length && text[i + 1] === '\n') i++;
      row.push(current.trim());
      current = "";
      if (row.some(v => v.trim() !== "")) rows.push(row);
      row = [];
    } else {
      // Inside quotes: normalise \r\n / \r to \n, else keep char
      if (inQuotes && ch === '\r') {
        current += '\n';
        if (i + 1 < text.length && text[i + 1] === '\n') i++;
      } else {
        current += ch;
      }
    }
  }

  // Last row (no trailing newline)
  row.push(current.trim());
  if (row.some(v => v.trim() !== "")) rows.push(row);

  return rows;
}

// ─── Extract numeric rating from messy user input ─────────────────
// Handles: "500", "NA", "na", "No", "Idk", ".", "580 chess.com",
//          "990 at chess.com", "0", "8", "", "Don't have..."
// Only returns a value for ratings >= 100 — anything below that is not
// a real chess rating and should be treated as "not rated".
function extractRating(raw: string): number | null {
  const v = raw.trim().toLowerCase();
  // Explicit non-ratings
  if (!v || ["na", "n/a", "no", "idk", "none", "nil", ".", "-", "dn", "don't know", "no rating"].includes(v)) return null;
  // Extract first integer from the value ("580 chess.com" → 580)
  const m = raw.match(/\d+/);
  if (!m) return null;
  const n = Number(m[0]);
  // Minimum real chess rating is ~100; values below that are junk/placeholders
  return n >= 100 ? n : null;
}

// ─── Parse all data rows into ParsedRow objects ───────────────────
function parseRows(
  headers: string[],
  dataRows: string[][],
  existingPlayers: Player[],
): ParsedRow[] {
  // Build col-index → Player field mapping
  const colToField: Array<keyof Player | "_skip" | null> = headers.map(h =>
    lookupField(normaliseHeader(h))
  );

  // Lookup sets for existing-player duplicate detection
  const existingRollNos = new Set(existingPlayers.map(p => (p.rollNo ?? "").toLowerCase().trim()).filter(Boolean));
  // Mobile and email alone are treated as unique identifiers (no name match required)
  const existingMobiles = new Set(existingPlayers.map(p => p.mobileNo?.trim()).filter(Boolean) as string[]);
  const existingEmails  = new Set(existingPlayers.map(p => p.email?.trim().toLowerCase()).filter(Boolean) as string[]);

  // Within-file duplicate tracking — same mobile or same email = same person
  const seenMobiles = new Set<string>();
  const seenEmails  = new Set<string>();

  return dataRows.map((cols, i) => {
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
          if (/^\d+(\.\d+)?$/.test(v))      errors.push(`Name "${v}" looks like a number — check column headers`);
          else if (v.length < 2)             errors.push("Name is too short");
          else if (v.length > 120)           errors.push("Name is too long (>120 chars)");
          else                               player.name = v;
          break;
        }

        case "rollNo":
          player.rollNo = val.trim();
          break;

        // Simple text fields — accept as-is
        case "branch":
        case "year":
        case "division":
        case "program":
        case "enrollmentNo":
          (player as any)[field] = val.trim();
          break;

        case "mobileNo": {
          // Accept if it looks phone-like; otherwise silently skip (don't block import)
          const clean = val.trim().replace(/[\s\-()]/g, "");
          if (/^\+?\d{6,15}$/.test(clean)) player.mobileNo = clean;
          // else: just ignore the field, not an error
          break;
        }

        case "email": {
          const e = val.trim().toLowerCase();
          if (e.includes("@") && e.length >= 5) player.email = e;
          // else: silently skip
          break;
        }

        case "officialElo":
        case "fideRating":
        case "estimatedElo": {
          const n = extractRating(val);
          if (n !== null) {
            (player as any)[field] = n;
            player.isRated = true;
          }
          // "NA", "Idk", etc. → silently skip, not an error
          break;
        }

        case "isRated":
          player.isRated = ["true", "yes", "1", "rated"].includes(val.toLowerCase().trim());
          break;
      }
    });

    // Name is the ONLY required field
    if (!player.name?.trim()) {
      // Skip rows that are clearly not player data (e.g. declaration text, empty rows)
      const isJunkRow = cols.filter(v => v.trim()).length <= 1;
      if (!isJunkRow) errors.push("Name is required");
      else return { raw, player: null, errors: [], rowIndex: i }; // silently skip junk rows
    }

    const row: ParsedRow = {
      raw,
      player: errors.length === 0 ? player : null,
      errors,
      rowIndex: i,
    };

    if (errors.length > 0) return row;

    const nameLower = player.name!.toLowerCase().trim();
    const mobile    = player.mobileNo?.trim() ?? "";
    const email     = player.email?.trim() ?? "";
    const rollNoLow = (player.rollNo ?? "").toLowerCase().trim();

    // 1. Roll-no duplicate vs existing DB
    if (rollNoLow && existingRollNos.has(rollNoLow)) {
      row.dupReason = "roll_no";
      return row;
    }

    // 2. Mobile or email duplicate vs existing DB (name-independent)
    if ((mobile && existingMobiles.has(mobile)) ||
        (email  && existingEmails.has(email))) {
      row.dupReason = "name_contact";
      return row;
    }

    // 3. Within-file duplicates — same mobile or same email already seen
    let withinDup = false;
    if (mobile) {
      if (seenMobiles.has(mobile)) withinDup = true; else seenMobiles.add(mobile);
    }
    if (email) {
      if (seenEmails.has(email)) withinDup = true; else seenEmails.add(email);
    }
    if (withinDup) { row.dupReason = "within_file"; return row; }

    return row;
  // Filter out silently-skipped junk rows
  }).filter((r): r is ParsedRow => r !== undefined);
}

// ─── Status helpers ───────────────────────────────────────────────
function rowStatus(row: ParsedRow): "ready" | "duplicate" | "error" {
  if (row.errors.length > 0) return "error";
  if (row.dupReason)          return "duplicate";
  return "ready";
}

const STATUS_ICONS = {
  ready:     <CheckCircle2 className="h-4 w-4 text-green-500" />,
  duplicate: <AlertCircle  className="h-4 w-4 text-amber-500" />,
  error:     <XCircle      className="h-4 w-4 text-red-500"   />,
};

const DUP_LABELS: Record<DupReason, string> = {
  roll_no:      "Roll No already exists",
  name_contact: "Duplicate name + contact in DB",
  within_file:  "Duplicate name + contact in file",
};

// ─── Template download ────────────────────────────────────────────
function downloadTemplate() {
  const headers = ["name", "rollNo", "program", "branch", "year", "division", "enrollmentNo", "mobileNo", "email", "officialElo", "fideRating"];
  const example = ["Rahul Sharma", "DW236", "B.Tech", "CE", "SY", "SA1", "24BCE001", "9876543210", "rahul@example.com", "", ""];
  const csv = [headers.join(","), example.join(",")].join("\n");
  const blob = new Blob([csv], { type: "text/csv" });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement("a"); a.href = url; a.download = "players_template.csv"; a.click();
  URL.revokeObjectURL(url);
}

// ─── Component ────────────────────────────────────────────────────
export function ImportPlayersDialog({ open, onOpenChange, onBulkImport, existingPlayers }: Props) {
  const [step, setStep]           = useState<"upload" | "preview" | "importing" | "done">("upload");
  const [parsedRows, setParsedRows] = useState<ParsedRow[]>([]);
  const [progress, setProgress]   = useState(0);
  const [importedCount, setImportedCount] = useState(0);
  const [dragging, setDragging]   = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const readFile = useCallback((file: File) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const data = e.target?.result;
      let headers: string[] = [];
      let dataRows: string[][] = [];

      if (file.name.toLowerCase().endsWith(".csv")) {
        // Use full-document parser — correctly handles multiline quoted fields
        const text = data as string;
        const allRows = parseCSVFull(text);
        if (allRows.length < 2) {
          alert("CSV appears to be empty or has only a header row.");
          return;
        }
        headers  = allRows[0];
        dataRows = allRows.slice(1);
      } else {
        // Excel: use xlsx library
        const wb   = XLSX.read(data, { type: "binary" });
        const ws   = wb.Sheets[wb.SheetNames[0]];
        const rows = XLSX.utils.sheet_to_json(ws, { header: 1, defval: "" }) as string[][];
        if (rows.length < 2) return;
        headers  = rows[0].map(String);
        dataRows = rows.slice(1).map(r => r.map(String));
      }

      // Drop rows where every cell is empty
      dataRows = dataRows.filter(r => r.some(v => v.trim() !== ""));

      const parsed = parseRows(headers, dataRows, existingPlayers);
      setParsedRows(parsed);
      setStep("preview");
    };

    if (file.name.toLowerCase().endsWith(".csv")) reader.readAsText(file);
    else reader.readAsBinaryString(file);
  }, [existingPlayers]);

  const onDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault(); setDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) readFile(file);
  }, [readFile]);

  const handleImport = async () => {
    const validRows = parsedRows.filter(r => rowStatus(r) === "ready");
    if (validRows.length === 0) return;
    setStep("importing"); setProgress(0);

    const batch: Player[] = validRows.map(r => ({
      ...r.player,
      id: crypto.randomUUID(),
      createdAt: Date.now(),
    } as Player));

    try {
      const CHUNK = 50; let done = 0;
      for (let i = 0; i < batch.length; i += CHUNK) {
        await onBulkImport(batch.slice(i, i + CHUNK));
        done += Math.min(CHUNK, batch.length - i);
        setProgress(Math.round((done / batch.length) * 100));
      }
      setImportedCount(batch.length);
      setStep("done");
    } catch {
      setStep("preview");
    }
  };

  const reset = () => { setStep("upload"); setParsedRows([]); setProgress(0); setImportedCount(0); };

  const ready  = parsedRows.filter(r => rowStatus(r) === "ready").length;
  const dups   = parsedRows.filter(r => rowStatus(r) === "duplicate").length;
  const errors = parsedRows.filter(r => rowStatus(r) === "error").length;

  return (
    <Dialog open={open} onOpenChange={v => { if (!v) reset(); onOpenChange(v); }}>
      <DialogContent className="max-w-2xl flex flex-col" style={{ maxHeight: "90vh" }}>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileSpreadsheet className="h-5 w-5 text-primary" />
            Import Players from CSV / Excel
          </DialogTitle>
          <DialogDescription>
            Upload a .csv, .xlsx or .xls file. Only recognised columns are imported; everything else is ignored.
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
              <p className="font-medium">Recognised column names (dots, dashes, spaces stripped — case-insensitive):</p>
              <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-muted-foreground">
                {([
                  ["Name",           "Name, Full Name, Student Name"],
                  ["Roll No",        "Roll No, Roll Number, Seat No"],
                  ["Enrollment No.", "PRN, PRN No., ISTU Code, ISTU No, Enrollment No, Reg No, Admission No, Student ID"],
                  ["Branch",         "Branch, Dept, Dept., Department, Stream, Faculty"],
                  ["Year",           "Year, Class, Sem, Semester"],
                  ["Division",       "Division, Section, Batch, Group"],
                  ["Program",        "Program, Programme, Course, Degree"],
                  ["Mobile No.",     "Mobile, Mobile No., Phone, Contact, WhatsApp No, Cell"],
                  ["Email",          "Email, Email ID, E-mail, Mail ID"],
                  ["Official Elo",   "ELO, Elo Rating, Rating, Chess Rating, Official Elo, Club Rating"],
                  ["FIDE Rating",    "FIDE, FIDE Rating, FIDE Elo, International Rating"],
                  ["Est. Elo",       "Estimated Elo, Estimated Rating, Local Rating"],
                ] as [string, string][]).map(([field, aliases]) => (
                  <div key={field}>
                    <span className="font-semibold text-foreground">{field}:</span>{" "}
                    <span>{aliases}</span>
                  </div>
                ))}
              </div>
              <p className="text-amber-600 dark:text-amber-400 mt-1">
                ⚠ Any other columns (Timestamp, Sr. No, Remarks, Declaration, etc.) are automatically ignored.
              </p>
              <p className="text-muted-foreground">
                ✓ Rating values like <span className="font-mono">NA</span>, <span className="font-mono">Idk</span>, <span className="font-mono">580 chess.com</span> are handled automatically.
              </p>
            </div>
          </div>
        )}

        {/* ── PREVIEW ── */}
        {step === "preview" && (
          <div className="flex flex-col gap-3 min-h-0 flex-1">
            <div className="flex items-center gap-3 flex-wrap">
              <Badge className="gap-1 bg-green-500/15 text-green-600 border-green-500/30">
                <CheckCircle2 className="h-3 w-3" /> {ready} ready
              </Badge>
              {dups > 0 && <Badge className="gap-1 bg-amber-500/15 text-amber-600 border-amber-500/30"><AlertCircle className="h-3 w-3" /> {dups} duplicate (skip)</Badge>}
              {errors > 0 && <Badge className="gap-1 bg-red-500/15 text-red-600 border-red-500/30"><XCircle className="h-3 w-3" /> {errors} error (skip)</Badge>}
            </div>

            <div className="overflow-auto flex-1 border rounded-lg">
              <table className="w-full text-xs">
                <thead className="bg-muted/60 sticky top-0">
                  <tr>
                    <th className="text-left px-3 py-2 font-medium">#</th>
                    <th className="text-left px-3 py-2 font-medium">Status</th>
                    <th className="text-left px-3 py-2 font-medium">Name</th>
                    <th className="text-left px-3 py-2 font-medium">Roll No</th>
                    <th className="text-left px-3 py-2 font-medium">Branch</th>
                    <th className="text-left px-3 py-2 font-medium">Program</th>
                    <th className="text-left px-3 py-2 font-medium">Mobile</th>
                    <th className="text-left px-3 py-2 font-medium">Email</th>
                    <th className="text-left px-3 py-2 font-medium">Elo</th>
                    <th className="text-left px-3 py-2 font-medium">Note</th>
                  </tr>
                </thead>
                <tbody>
                  {parsedRows.map((row, i) => {
                    const status = rowStatus(row);
                    const p = row.player ?? {};
                    return (
                      <tr key={i} className={`border-b last:border-0 ${status === "ready" ? "" : status === "duplicate" ? "bg-amber-500/5" : "bg-red-500/5"}`}>
                        <td className="px-3 py-2 text-muted-foreground">{row.rowIndex + 1}</td>
                        <td className="px-3 py-2">{STATUS_ICONS[status]}</td>
                        <td className="px-3 py-2 font-medium max-w-[110px] truncate">{(p as any).name ?? <span className="text-muted-foreground italic">—</span>}</td>
                        <td className="px-3 py-2 text-muted-foreground">{(p as any).rollNo ?? "—"}</td>
                        <td className="px-3 py-2 text-muted-foreground">{(p as any).branch ?? "—"}</td>
                        <td className="px-3 py-2 text-muted-foreground">{(p as any).program ?? "—"}</td>
                        <td className="px-3 py-2 text-muted-foreground">{(p as any).mobileNo ?? "—"}</td>
                        <td className="px-3 py-2 text-muted-foreground max-w-[100px] truncate">{(p as any).email ?? "—"}</td>
                        <td className="px-3 py-2 text-muted-foreground">{(p as any).officialElo ?? "—"}</td>
                        <td className="px-3 py-2 text-xs max-w-[140px]">
                          {status === "error"     && <span className="text-red-500">{row.errors.join("; ")}</span>}
                          {status === "duplicate" && row.dupReason && <span className="text-amber-600">{DUP_LABELS[row.dupReason]}</span>}
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
            <p className="font-medium">Importing players…</p>
            <Progress value={progress} className="max-w-sm mx-auto" />
            <p className="text-sm text-muted-foreground">{progress}% complete</p>
          </div>
        )}

        {/* ── DONE ── */}
        {step === "done" && (
          <div className="py-8 text-center space-y-3">
            <CheckCircle2 className="h-12 w-12 mx-auto text-green-500" />
            <p className="text-lg font-semibold">Import Complete!</p>
            <p className="text-muted-foreground">{importedCount} player{importedCount !== 1 ? "s" : ""} added successfully.</p>
            {dups > 0 && <p className="text-sm text-amber-600">{dups} duplicate{dups !== 1 ? "s" : ""} skipped.</p>}
            {errors > 0 && <p className="text-sm text-red-500">{errors} row{errors !== 1 ? "s" : ""} with errors skipped.</p>}
          </div>
        )}

        <DialogFooter className="border-t pt-3">
          {step === "upload"   && <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>}
          {step === "preview"  && (<><Button variant="outline" onClick={reset}>← Back</Button><Button onClick={handleImport} disabled={ready === 0}>Import {ready} Player{ready !== 1 ? "s" : ""}</Button></>)}
          {step === "done"     && (<><Button variant="outline" onClick={reset}>Import More</Button><Button onClick={() => { reset(); onOpenChange(false); }}>Done</Button></>)}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
