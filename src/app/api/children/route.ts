import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { supabaseAdmin } from "@/lib/supabase/server";
import { getSessionFromToken, SESSION_COOKIE } from "@/lib/auth";
import { findStudent } from "@/lib/students";
import bcrypt from "bcryptjs";

async function getParentSession() {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE)?.value;
  const session = await getSessionFromToken(token);
  if (!session || session.role !== "parent") return null;
  return session;
}

export async function GET(_req: NextRequest) {
  const session = await getParentSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: links } = await supabaseAdmin
    .from("parent_students")
    .select("student_id")
    .eq("parent_id", session.userId);

  const ids = (links ?? []).map((l) => l.student_id);
  if (ids.length === 0) return NextResponse.json({ students: [] });

  const { data: students } = await supabaseAdmin
    .from("students")
    .select("id, full_name, grade_level, student_number, archived")
    .in("id", ids)
    .eq("archived", false);

  return NextResponse.json({ students: students ?? [] });
}

export async function POST(req: NextRequest) {
  const session = await getParentSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const body = await req.json();
    const studentNameOrId = String(body.studentNameOrId ?? "").trim();
    const studentCode = String(body.studentCode ?? "").trim().toUpperCase();

    if (!studentNameOrId || !studentCode) {
      return NextResponse.json({ error: "Please provide student name/ID and code." }, { status: 400 });
    }

    const student = await findStudent(studentNameOrId);
    if (!student) {
      return NextResponse.json({ error: "Student verification failed. Please check your details." }, { status: 400 });
    }

    const codeOk = await bcrypt.compare(studentCode, student.code_hash);
    if (!codeOk) {
      return NextResponse.json({ error: "Student verification failed. Please check your details." }, { status: 400 });
    }

    await supabaseAdmin
      .from("parent_students")
      .upsert({ parent_id: session.userId, student_id: student.id }, { onConflict: "parent_id,student_id" });

    return NextResponse.json({ ok: true, student: { id: student.id, full_name: student.full_name, grade_level: student.grade_level } });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: "Something went wrong." }, { status: 500 });
  }
}
