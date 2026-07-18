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
  existingPlayers: Player[];            // full list for duplicate checking
}

type DupReason = "roll_no" | "name_contact" | "within_file";

interface ParsedRow {
  raw: Record<string, string>;
  player: Partial<Player> | null;
  errors: string[];
  rowIndex: number;
  dupReason?: DupReason;
}

// ─── Column map: normalised header → Player field ───────────────
// Only these fields are imported — everything else is ignored silently.
// Keys must be lowercase alphanumeric only (see normaliseHeader below).
const COLUMN_MAP: Record<string, keyof Player | "_skip"> = {

  // ── Name ────────────────────────────────────────────────────────
  name: "name",
  fullname: "name",
  playername: "name",
  studentname: "name",
  candidatename: "name",
  applicantname: "name",
  participantname: "name",

  // ── Roll No ─────────────────────────────────────────────────────
  rollno: "rollNo",
  rollnumber: "rollNo",
  roll: "rollNo",
  seatno: "rollNo",
  seatnumber: "rollNo",

  // ── Enrollment / PRN / ISTU / Reg / Admission ───────────────────
  // Handles: "PRN No.", "PRN", "ISTU Code", "ISTU No",
  //          "Enrollment No", "Reg No", "Admission No", "Student ID" …
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
  istucode: "enrollmentNo",
  istuno: "enrollmentNo",
  istunumber: "enrollmentNo",
  istu: "enrollmentNo",
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

  // ── Branch / Department / Stream ────────────────────────────────
  // Handles: "Branch", "Dept", "Dept.", "Department", "Stream", "Faculty"
  branch: "branch",
  dept: "branch",
  department: "branch",
  stream: "branch",
  faculty: "branch",
  engineering: "branch",
  specialization: "branch",
  specialisation: "branch",

  // ── Year / Class / Semester ─────────────────────────────────────
  year: "year",
  class: "year",
  sem: "year",
  semester: "year",
  academicyear: "year",
  studyyear: "year",
  currentyear: "year",

  // ── Division / Section / Batch ──────────────────────────────────
  division: "division",
  div: "division",
  section: "division",
  batch: "division",
  group: "division",

  // ── Program / Course / Degree ───────────────────────────────────
  program: "program",
  programme: "program",
  course: "program",
  degree: "program",

  // ── Mobile / Phone / Contact ────────────────────────────────────
  // Handles: "Mobile No.", "Mobile No", "Phone", "Contact No", "WhatsApp No"
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

  // ── Email ───────────────────────────────────────────────────────
  // Handles: "Email", "E-mail", "Email ID", "Mail ID"
  email: "email",
  emailid: "email",
  emailaddress: "email",
  mail: "email",
  mailid: "email",
  emailid2: "email",

  // ── Ratings / ELO ───────────────────────────────────────────────
  // Handles: "ELO", "Rating", "Chess Rating", "Elo Rating", "Official Elo"
  // Generic "rating" / "elo" → officialElo (best single-column guess)
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
  fiderating: "fideRating",
  fide: "fideRating",
  fideelo: "fideRating",
  internationalrating: "fideRating",
  estimatedelo: "estimatedElo",
  estimatedrating: "estimatedElo",
  localrating: "estimatedElo",

  // ── Rated flag ──────────────────────────────────────────────────
  israted: "isRated",
  rated: "isRated",
};

// Normalise a header string for COLUMN_MAP lookup.
// Strips ALL non-alphanumeric characters (dots, dashes, #, spaces, slashes…)
// and lowercases, so "ISTU Code", "PRN No.", "E-mail", "Dept." all resolve.
function normaliseHeader(h: string): string {
  return h.toLowerCase().replace(/[^a-z0-9]/g, "");
}

// ─── Proper CSV line parser (handles quoted fields with commas) ────
function parseCSVLine(line: string): string[] {
  const result: string[] = [];
  let current = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') { current += '"'; i++; }  // escaped quote
      else inQuotes = !inQuotes;
    } else if (ch === "," && !inQuotes) {
      result.push(current.trim());
      current = "";
    } else {
      current += ch;
    }
  }
  result.push(current.trim());
  return result;
}

// ─── Parse every data row into a ParsedRow ────────────────────────
function parseRows(
  headers: string[],
  dataRows: string[][],
  existingPlayers: Player[],
): ParsedRow[] {
  // Build a mapping: col-index → Player field
  const colToField: Array<keyof Player | "_skip" | null> = headers.map(h => {
    const norm = normaliseHeader(h);
    return COLUMN_MAP[norm] ?? null;   // null = column not recognised → skip silently
  });

  // Lookup sets for existing-player duplicate detection
  const existingRollNos = new Set(existingPlayers.map(p => (p.rollNo ?? "").toLowerCase()));
  const existingNameMobile = new Set(
    existingPlayers
      .filter(p => p.mobileNo?.trim())
      .map(p => `${p.name.toLowerCase().trim()}|${p.mobileNo!.trim()}`)
  );
  const existingNameEmail = new Set(
    existingPlayers
      .filter(p => p.email?.trim())
      .map(p => `${p.name.toLowerCase().trim()}|${p.email!.trim().toLowerCase()}`)
  );

  // Within-file duplicate tracking (name+mobile / name+email)
  const seenNameMobile = new Set<string>();
  const seenNameEmail  = new Set<string>();

  return dataRows.map((cols, i) => {
    const raw: Record<string, string> = {};
    const player: Partial<Player> = {};
    const errors: string[] = [];

    cols.forEach((val, ci) => {
      const field = colToField[ci];
      if (!field || field === "_skip" || val === "") return;
      raw[headers[ci]] = val;

      switch (field) {
        case "name":
          // Validate: name must have at least one letter and not be purely numeric
          if (/^\d+(\.\d+)?$/.test(val)) {
            errors.push(`Name "${val}" looks like a number — check your column headers`);
          } else if (val.length < 2) {
            errors.push("Name is too short");
          } else if (val.length > 120) {
            errors.push("Name is too long (>120 chars)");
          } else {
            player.name = val;
          }
          break;

        case "rollNo":
          player.rollNo = val;
          break;

        case "branch":
        case "year":
        case "division":
        case "program":
        case "enrollmentNo":
          (player as any)[field] = val;
          break;

        case "mobileNo":
          // Validate: mobile should be mostly digits
          if (!/^\+?[\d\s\-()]{6,15}$/.test(val)) {
            errors.push(`Mobile "${val}" doesn't look like a phone number`);
          } else {
            player.mobileNo = val.replace(/[\s\-()]/g, "");
          }
          break;

        case "email":
          if (!val.includes("@") || val.length < 5) {
            errors.push(`Email "${val}" doesn't look valid`);
          } else {
            player.email = val.toLowerCase();
          }
          break;

        case "officialElo":
        case "fideRating":
        case "estimatedElo": {
          const n = Number(val);
          if (isNaN(n)) {
            errors.push(`${field} "${val}" is not a number — check column mapping`);
          } else {
            (player as any)[field] = n;
            player.isRated = true;
          }
          break;
        }

        case "isRated":
          player.isRated = ["true", "yes", "1", "rated"].includes(val.toLowerCase());
          break;
      }
    });

    // Name is required
    if (!player.name?.trim()) {
      errors.push("Name is required");
    }

    const row: ParsedRow = {
      raw,
      player: errors.length === 0 ? player : null,
      errors,
      rowIndex: i,
    };

    if (errors.length > 0) return row;

    const nameLower  = player.name!.toLowerCase().trim();
    const mobile     = player.mobileNo?.trim() ?? "";
    const email      = player.email?.trim() ?? "";
    const rollNoLow  = (player.rollNo ?? "").toLowerCase();

    // 1. Roll-no duplicate against existing DB
    if (rollNoLow && existingRollNos.has(rollNoLow)) {
      row.dupReason = "roll_no";
      return row;
    }

    // 2. Name + contact duplicate against existing DB
    const extDup =
      (mobile && existingNameMobile.has(`${nameLower}|${mobile}`)) ||
      (email  && existingNameEmail.has(`${nameLower}|${email}`));
    if (extDup) {
      row.dupReason = "name_contact";
      return row;
    }

    // 3. Within-file duplicate (same name + same contact)
    let withinDup = false;
    if (mobile) {
      const k = `${nameLower}|${mobile}`;
      if (seenNameMobile.has(k)) withinDup = true;
      else seenNameMobile.add(k);
    }
    if (email) {
      const k = `${nameLower}|${email}`;
      if (seenNameEmail.has(k)) withinDup = true;
      else seenNameEmail.add(k);
    }
    if (withinDup) {
      row.dupReason = "within_file";
      return row;
    }

    return row;
  });
}

// ─── Status badge helpers ──────────────────────────────────────────
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
  roll_no:     "Roll No already exists",
  name_contact:"Duplicate name + contact in DB",
  within_file: "Duplicate name + contact in file",
};

// ─── Generate template CSV download ───────────────────────────────
function downloadTemplate() {
  const headers = [
    "name", "rollNo", "program", "branch", "year", "division",
    "enrollmentNo", "mobileNo", "email",
    "officialElo", "fideRating", "estimatedElo",
  ];
  const example = [
    "Rahul Sharma", "DW236", "B.Tech", "CE", "SY", "SA1",
    "24BCE001", "9876543210", "rahul@example.com",
    "", "", "",
  ];
  const csv = [headers.join(","), example.join(",")].join("\n");
  const blob = new Blob([csv], { type: "text/csv" });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement("a");
  a.href = url; a.download = "players_template.csv"; a.click();
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

      if (file.name.endsWith(".csv")) {
        const text   = data as string;
        const lines  = text.split(/\r?\n/).filter(l => l.trim());
        headers  = parseCSVLine(lines[0]);
        dataRows = lines.slice(1).map(parseCSVLine);
      } else {
        const wb = XLSX.read(data, { type: "binary" });
        const ws = wb.Sheets[wb.SheetNames[0]];
        const rows: string[][] = XLSX.utils.sheet_to_json(ws, { header: 1, defval: "" }) as string[][];
        if (rows.length < 2) return;
        headers  = rows[0].map(String);
        dataRows = rows.slice(1).map(r => r.map(String));
      }

      // Filter out completely empty rows
      dataRows = dataRows.filter(r => r.some(v => v.trim() !== ""));

      const parsed = parseRows(headers, dataRows, existingPlayers);
      setParsedRows(parsed);
      setStep("preview");
    };

    if (file.name.endsWith(".csv")) reader.readAsText(file);
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

    setStep("importing");
    setProgress(0);

    const batch: Player[] = validRows.map(r => ({
      ...r.player,
      id: crypto.randomUUID(),
      createdAt: Date.now(),
    } as Player));

    try {
      // Import in chunks of 50 so progress bar has something to show
      const CHUNK = 50;
      let done = 0;
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

  const reset = () => {
    setStep("upload"); setParsedRows([]); setProgress(0); setImportedCount(0);
  };

  const ready     = parsedRows.filter(r => rowStatus(r) === "ready").length;
  const dups      = parsedRows.filter(r => rowStatus(r) === "duplicate").length;
  const errors    = parsedRows.filter(r => rowStatus(r) === "error").length;

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

        {/* ── UPLOAD step ── */}
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
              <input
                ref={fileRef}
                type="file"
                className="hidden"
                accept=".csv,.xlsx,.xls"
                onChange={e => { const f = e.target.files?.[0]; if (f) readFile(f); }}
              />
            </div>

            <div className="flex items-center justify-between text-sm text-muted-foreground bg-muted/40 rounded-lg p-3">
              <span>Not sure about the format?</span>
              <Button variant="ghost" size="sm" className="gap-1.5 h-7" onClick={downloadTemplate}>
                <Download className="h-3.5 w-3.5" /> Download Template
              </Button>
            </div>

            <div className="text-xs text-muted-foreground space-y-1 border rounded-lg p-3">
              <p className="font-medium mb-2">Recognised column names (any spelling, case-insensitive, dots/dashes ignored):</p>
              <div className="grid grid-cols-2 gap-x-4 gap-y-1">
                {([
                  ["Name",          "Name, Full Name, Student Name"],
                  ["Roll No",       "Roll No, Roll Number, Seat No"],
                  ["Enrollment No.","PRN, PRN No., ISTU Code, ISTU No, Enrollment No, Reg No, Admission No, Student ID"],
                  ["Branch",        "Branch, Dept, Department, Stream, Faculty"],
                  ["Year",          "Year, Class, Sem, Semester"],
                  ["Division",      "Division, Section, Batch, Group"],
                  ["Program",       "Program, Programme, Course, Degree"],
                  ["Mobile No.",    "Mobile, Mobile No., Phone, Contact, WhatsApp No, Cell"],
                  ["Email",         "Email, Email ID, E-mail, Mail ID"],
                  ["Official Elo",  "ELO, Elo Rating, Rating, Chess Rating, Official Elo, Club Rating"],
                  ["FIDE Rating",   "FIDE, FIDE Rating, FIDE Elo, International Rating"],
                  ["Est. Elo",      "Estimated Elo, Estimated Rating, Local Rating"],
                ] as [string, string][]).map(([field, aliases]) => (
                  <div key={field}>
                    <span className="font-semibold text-foreground">{field}:</span>{" "}
                    <span className="text-muted-foreground">{aliases}</span>
                  </div>
                ))}
              </div>
              <p className="mt-2 text-amber-600 dark:text-amber-400">
                ⚠ Any other columns (Sr. No, Remarks, etc.) are automatically ignored.
              </p>
            </div>
          </div>
        )}

        {/* ── PREVIEW step ── */}
        {step === "preview" && (
          <div className="flex flex-col gap-3 min-h-0 flex-1">
            {/* Summary badges */}
            <div className="flex items-center gap-3 flex-wrap">
              <Badge className="gap-1 bg-green-500/15 text-green-600 border-green-500/30">
                <CheckCircle2 className="h-3 w-3" /> {ready} ready
              </Badge>
              {dups > 0 && (
                <Badge className="gap-1 bg-amber-500/15 text-amber-600 border-amber-500/30">
                  <AlertCircle className="h-3 w-3" /> {dups} duplicate (skip)
                </Badge>
              )}
              {errors > 0 && (
                <Badge className="gap-1 bg-red-500/15 text-red-600 border-red-500/30">
                  <XCircle className="h-3 w-3" /> {errors} error (skip)
                </Badge>
              )}
            </div>

            {/* Preview table */}
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
                    <th className="text-left px-3 py-2 font-medium">Note</th>
                  </tr>
                </thead>
                <tbody>
                  {parsedRows.map((row, i) => {
                    const status = rowStatus(row);
                    const p = row.player ?? {};
                    return (
                      <tr
                        key={i}
                        className={`border-b last:border-0 ${
                          status === "ready"     ? ""
                          : status === "duplicate" ? "bg-amber-500/5"
                          : "bg-red-500/5"
                        }`}
                      >
                        <td className="px-3 py-2 text-muted-foreground">{row.rowIndex + 1}</td>
                        <td className="px-3 py-2">{STATUS_ICONS[status]}</td>
                        <td className="px-3 py-2 font-medium max-w-[120px] truncate">
                          {(p as any).name ?? <span className="text-muted-foreground italic">—</span>}
                        </td>
                        <td className="px-3 py-2 text-muted-foreground">{(p as any).rollNo ?? "—"}</td>
                        <td className="px-3 py-2 text-muted-foreground">{(p as any).branch ?? "—"}</td>
                        <td className="px-3 py-2 text-muted-foreground">{(p as any).program ?? "—"}</td>
                        <td className="px-3 py-2 text-muted-foreground">{(p as any).mobileNo ?? "—"}</td>
                        <td className="px-3 py-2 text-muted-foreground max-w-[120px] truncate">{(p as any).email ?? "—"}</td>
                        <td className="px-3 py-2 text-xs max-w-[160px]">
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

        {/* ── IMPORTING step ── */}
        {step === "importing" && (
          <div className="py-8 text-center space-y-4">
            <RefreshCw className="h-10 w-10 mx-auto animate-spin text-primary" />
            <p className="font-medium">Importing players…</p>
            <Progress value={progress} className="max-w-sm mx-auto" />
            <p className="text-sm text-muted-foreground">{progress}% complete</p>
          </div>
        )}

        {/* ── DONE step ── */}
        {step === "done" && (
          <div className="py-8 text-center space-y-3">
            <CheckCircle2 className="h-12 w-12 mx-auto text-green-500" />
            <p className="text-lg font-semibold">Import Complete!</p>
            <p className="text-muted-foreground">{importedCount} player{importedCount !== 1 ? "s" : ""} added successfully.</p>
            {dups > 0 && <p className="text-sm text-amber-600">{dups} duplicate{dups !== 1 ? "s" : ""} were skipped.</p>}
            {errors > 0 && <p className="text-sm text-red-500">{errors} row{errors !== 1 ? "s" : ""} with errors were skipped.</p>}
          </div>
        )}

        <DialogFooter className="border-t pt-3">
          {step === "upload" && (
            <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          )}
          {step === "preview" && (
            <>
              <Button variant="outline" onClick={reset}>← Back</Button>
              <Button onClick={handleImport} disabled={ready === 0}>
                Import {ready} Player{ready !== 1 ? "s" : ""}
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
