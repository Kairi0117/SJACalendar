import { supabaseAdmin } from "./supabase/server";

export interface StudentRow {
  id: string;
  full_name: string;
  code_hash: string;
  student_number: string | null;
  grade_level: string;
}

export async function findStudent(nameOrId: string): Promise<StudentRow | null> {
  const q = nameOrId.trim();
  if (!q) return null;

  // 1. Exact student number
  const { data: byNumber } = await supabaseAdmin
    .from("students")
    .select("id, full_name, code_hash, student_number, grade_level")
    .eq("student_number", q)
    .limit(1);
  if (byNumber && byNumber.length > 0) return byNumber[0] as StudentRow;

  // 2. Exact full name (case-insensitive)
  const { data: byName } = await supabaseAdmin
    .from("students")
    .select("id, full_name, code_hash, student_number, grade_level")
    .ilike("full_name", q)
    .limit(1);
  if (byName && byName.length > 0) return byName[0] as StudentRow;

  // 3. Partial match
  const { data: byPartial } = await supabaseAdmin
    .from("students")
    .select("id, full_name, code_hash, student_number, grade_level")
    .ilike("full_name", `%${q}%`)
    .limit(1);
  if (byPartial && byPartial.length > 0) return byPartial[0] as StudentRow;

  return null;
}
