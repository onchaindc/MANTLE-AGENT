import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { createSupabaseServerClient, isSupabaseConfigured } from "@/lib/supabase-server";

export const dynamic = "force-dynamic";

type ConversationPayload = {
  id: string;
  title: string;
  messages: unknown;
  createdAt?: string;
};

export async function GET() {
  const session = await getServerSession(authOptions);

  if (!session?.user?.id || !isSupabaseConfigured()) {
    return NextResponse.json({ conversations: [] }, { headers: { "Cache-Control": "no-store" } });
  }

  const supabase = createSupabaseServerClient();

  if (!supabase) {
    return NextResponse.json({ conversations: [] }, { headers: { "Cache-Control": "no-store" } });
  }

  const { data, error } = await supabase
    .from("conversations")
    .select("id, user_id, title, messages, created_at")
    .eq("user_id", session.user.id)
    .order("created_at", { ascending: false });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const conversations = (data ?? []).map((conversation) => ({
    id: conversation.id,
    userId: conversation.user_id,
    title: conversation.title,
    messages: conversation.messages,
    createdAt: conversation.created_at,
  }));

  return NextResponse.json({ conversations }, { headers: { "Cache-Control": "no-store" } });
}

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);

  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!isSupabaseConfigured()) {
    return NextResponse.json({ saved: false, reason: "Supabase is not configured." });
  }

  const supabase = createSupabaseServerClient();

  if (!supabase) {
    return NextResponse.json({ saved: false, reason: "Supabase is not configured." });
  }

  const body = (await req.json()) as ConversationPayload;

  const { error } = await supabase.from("conversations").upsert(
    {
      id: body.id,
      user_id: session.user.id,
      title: body.title,
      messages: body.messages,
      created_at: body.createdAt ?? new Date().toISOString(),
    },
    { onConflict: "id" }
  );

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ saved: true });
}
