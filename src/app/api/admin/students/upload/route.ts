import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { supabaseAdmin } from "@/lib/supabase/server";
import { getSessionFromToken, SESSION_COOKIE, generateStudentCode, hashSecret } from "@/lib/auth";
import * as XLSX from "xlsx";
import mammoth from "mammoth";

async function getAdminSession() {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE)?.value;
  const session = await getSessionFromToken(token);
  if (!session || session.role !== "admin") return null;
  return session;
}

function normalizeGrade(raw: string): string | null {
  const v = String(raw ?? "").trim().toLowerCase();
  if (!v) return null;
  if (v === "k" || v === "kinder" || v === "kindergarten" || v === "kg") return "Kinder";
  const m = v.match(/(?:g|grade)?\s*(\d{1,2})/);
  if (m) {
    const n = parseInt(m[1], 10);
    if (n >= 1 && n <= 12) return `G${n}`;
  }
  // Already like G7
  const m2 = v.match(/^g(\d{1,2})$/);
  if (m2) {
    const n = parseInt(m2[1], 10);
    if (n >= 1 && n <= 12) return `G${n}`;
  }
  return null;
}

function findColumn(headers: string[], candidates: string[]): number {
  const lower = headers.map((h) => String(h ?? "").trim().toLowerCase());
  for (const c of candidates) {
    const idx = lower.findIndex((h) => h === c || h.includes(c));
    if (idx !== -1) return idx;
  }
  return -1;
}

interface ParsedRow {
  full_name: string;
  student_number: string | null;
  grade_level: string;
}

function parseRowsFromObjects(rows: Record<string, unknown>[]): ParsedRow[] {
  if (rows.length === 0) return [];
  const headers = Object.keys(rows[0]);
  const nameIdx = findColumn(headers, ["full_name", "name", "student name", "student_name", "student"]);
  const gradeIdx = findColumn(headers, ["grade_level", "grade level", "grade", "level"]);
  const numberIdx = findColumn(headers, ["student_number", "student number", "student id", "student_id", "id", "number", "lrn"]);

  const nameKey = nameIdx >= 0 ? headers[nameIdx] : headers[0];
  const gradeKey = gradeIdx >= 0 ? headers[gradeIdx] : headers[1];
  const numberKey = numberIdx >= 0 ? headers[numberIdx] : null;

  const result: ParsedRow[] = [];
  for (const r of rows) {
    const name = String(r[nameKey] ?? "").trim();
    if (!name) continue;
    const grade = normalizeGrade(String(r[gradeKey] ?? ""));
    if (!grade) continue;
    const number = numberKey ? String(r[numberKey] ?? "").trim() : "";
    result.push({ full_name: name, student_number: number || null, grade_level: grade });
  }
  return result;
}

function parseDelimitedText(text: string): ParsedRow[] {
  const lines = text.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  if (lines.length === 0) return [];

  // Detect delimiter
  const firstLine = lines[0];
  let delimiter = "\t";
  if (firstLine.includes(",") && !firstLine.includes("\t")) delimiter = ",";
  else if (firstLine.includes(";")) delimiter = ";";
  else if (firstLine.includes("|")) delimiter = "|";

  const splitLine = (line: string) => line.split(delimiter).map((c) => c.trim().replace(/^"|"$/g, ""));

  const firstCells = splitLine(firstLine);
  // If first row looks like header
  const lower = firstCells.map((c) => c.toLowerCase());
  const hasHeader =
    lower.some((c) => c.includes("name") || c.includes("grade") || c.includes("number") || c.includes("id"));

  let headers: string[] = firstCells;
  let dataLines = lines;
  if (hasHeader) {
    dataLines = lines.slice(1);
  } else {
    // assume columns: name, grade, number (optional)
    headers = ["name", "grade", "number"];
  }

  const nameIdx = hasHeader ? findColumn(headers, ["full_name", "name", "student name", "student_name", "student"]) : 0;
  const gradeIdx = hasHeader ? findColumn(headers, ["grade_level", "grade level", "grade", "level"]) : 1;
  const numberIdx = hasHeader ? findColumn(headers, ["student_number", "student number", "student id", "student_id", "id", "number", "lrn"]) : 2;

  const result: ParsedRow[] = [];
  for (const line of dataLines) {
    const cells = splitLine(line);
    if (cells.length === 0) continue;
    const name = cells[nameIdx] ?? cells[0] ?? "";
    if (!name) continue;
    const gradeRaw = gradeIdx >= 0 && gradeIdx < cells.length ? cells[gradeIdx] : cells[1];
    const grade = normalizeGrade(gradeRaw ?? "");
    if (!grade) continue;
    const numberRaw = numberIdx >= 0 && numberIdx < cells.length ? cells[numberIdx] : "";
    result.push({ full_name: name, student_number: numberRaw || null, grade_level: grade });
  }
  return result;
}

export async function POST(req: NextRequest) {
  const session = await getAdminSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const formData = await req.formData();
    const file = formData.get("file");
    if (!file || !(file instanceof File)) {
      return NextResponse.json({ error: "No file uploaded." }, { status: 400 });
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const filename = file.name.toLowerCase();

    let rows: ParsedRow[] = [];

    if (filename.endsWith(".docx")) {
      const result = await mammoth.extractRawText({ buffer });
      rows = parseDelimitedText(result.value);
    } else {
      // xlsx, xls, csv, tsv
      const workbook = XLSX.read(buffer, { type: "buffer" });
      const sheetName = workbook.SheetNames[0];
      const sheet = workbook.Sheets[sheetName];
      const json = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: "" });
      if (json.length > 0 && typeof json[0] === "object") {
        rows = parseRowsFromObjects(json);
      } else {
        // fallback: convert to csv text
        const csv = XLSX.utils.sheet_to_csv(sheet);
        rows = parseDelimitedText(csv);
      }
    }

    if (rows.length === 0) {
      return NextResponse.json({ error: "No valid student rows found. Expected columns: name, grade, (optional) student number." }, { status: 400 });
    }

    // Deduplicate by student_number within batch
    const seen = new Set<string>();
    const uniqueRows: ParsedRow[] = [];
    for (const r of rows) {
      const key = r.student_number || r.full_name + r.grade_level;
      if (seen.has(key)) continue;
      seen.add(key);
      uniqueRows.push(r);
    }

    const created: { full_name: string; grade_level: string; code: string }[] = [];
    for (const r of uniqueRows) {
      const code = generateStudentCode();
      const codeHash = await hashSecret(code);
      const { error: insErr } = await supabaseAdmin.from("students").insert({
        full_name: r.full_name,
        student_number: r.student_number,
        grade_level: r.grade_level,
        code_hash: codeHash,
      });
      if (insErr) {
        console.error("Insert failed:", insErr);
        continue;
      }
      created.push({ full_name: r.full_name, grade_level: r.grade_level, code });
    }

    return NextResponse.json({ ok: true, created: created.length, total: uniqueRows.length, codes: created });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: "Upload failed. Check file format." }, { status: 500 });
  }
}
