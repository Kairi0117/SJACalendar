import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { supabaseAdmin } from "@/lib/supabase/server";
import { getSessionFromToken, SESSION_COOKIE, generateStudentCode, hashSecret } from "@/lib/auth";

async function getAdminSession() {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE)?.value;
  const session = await getSessionFromToken(token);
  if (!session || session.role !== "admin") return null;
  return session;
}

export async function GET(req: NextRequest) {
  const session = await getAdminSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const archived = req.nextUrl.searchParams.get("archived") === "true";

  const { data: students } = await supabaseAdmin
    .from("students")
    .select("id, full_name, student_number, grade_level, code_created_at, created_at, archived")
    .eq("archived", archived)
    .order("created_at", { ascending: false });

  // parent emails per student
  const ids = (students ?? []).map((s) => s.id);
  const { data: links } = ids.length
    ? await supabaseAdmin
        .from("parent_students")
        .select("student_id, parent_id")
        .in("student_id", ids)
    : { data: [] };

  const parentIds = Array.from(new Set((links ?? []).map((l) => l.parent_id)));
  const { data: parents } = parentIds.length
    ? await supabaseAdmin.from("parents").select("id, email").in("id", parentIds)
    : { data: [] };

  const parentEmailById = new Map((parents ?? []).map((p) => [p.id, p.email]));
  const parentsByStudent = new Map<string, string[]>();
  for (const l of links ?? []) {
    if (!parentsByStudent.has(l.student_id)) parentsByStudent.set(l.student_id, []);
    const email = parentEmailById.get(l.parent_id);
    if (email) parentsByStudent.get(l.student_id)!.push(email);
  }

  const result = (students ?? []).map((s) => ({
    ...s,
    parent_emails: parentsByStudent.get(s.id) ?? [],
  }));

  return NextResponse.json({ students: result });
}

export async function POST(req: NextRequest) {
  const session = await getAdminSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const body = await req.json();
    const fullName = String(body.full_name ?? "").trim();
    const studentNumber = body.student_number ? String(body.student_number).trim() : null;
    const gradeLevel = String(body.grade_level ?? "").trim();

    if (!fullName || !gradeLevel) {
      return NextResponse.json({ error: "Name and grade level are required." }, { status: 400 });
    }

    const code = generateStudentCode();
    const codeHash = await hashSecret(code);

    const { data: inserted, error: insErr } = await supabaseAdmin
      .from("students")
      .insert({
        full_name: fullName,
        student_number: studentNumber,
        grade_level: gradeLevel,
        code_hash: codeHash,
      })
      .select("id")
      .single();

    if (insErr || !inserted) {
      return NextResponse.json({ error: "Could not create student." }, { status: 500 });
    }

    return NextResponse.json({ ok: true, id: inserted.id, code });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: "Something went wrong." }, { status: 500 });
  }
}
