import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { supabaseAdmin } from "@/lib/supabase/server";
import { getSessionFromToken, SESSION_COOKIE } from "@/lib/auth";

export async function GET(_req: NextRequest) {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE)?.value;
  const session = await getSessionFromToken(token);
  if (!session) {
    return NextResponse.json({ authenticated: false }, { status: 401 });
  }

  let name = "";
  if (session.role === "parent") {
    const { data } = await supabaseAdmin
      .from("parents")
      .select("first_name, last_name")
      .eq("id", session.userId)
      .maybeSingle();
    if (data) name = `${data.first_name} ${data.last_name}`.trim();
  } else {
    const { data } = await supabaseAdmin
      .from("admins")
      .select("email")
      .eq("id", session.userId)
      .maybeSingle();
    if (data) name = data.email;
  }

  return NextResponse.json({ authenticated: true, role: session.role, userId: session.userId, name });
}
