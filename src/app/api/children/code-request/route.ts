import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { supabaseAdmin } from "@/lib/supabase/server";
import { getSessionFromToken, SESSION_COOKIE } from "@/lib/auth";

export async function POST(req: NextRequest) {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE)?.value;
  const session = await getSessionFromToken(token);
  if (!session || session.role !== "parent") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await req.json();
    const studentId = body.studentId ? String(body.studentId) : null;

    const { data: parent } = await supabaseAdmin
      .from("parents")
      .select("email")
      .eq("id", session.userId)
      .maybeSingle();

    if (!parent) {
      return NextResponse.json({ error: "Parent not found." }, { status: 404 });
    }

    await supabaseAdmin.from("code_requests").insert({
      parent_email: parent.email,
      student_id: studentId,
      status: "open",
    });

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: "Something went wrong." }, { status: 500 });
  }
}
