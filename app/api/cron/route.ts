import { NextResponse } from "next/server";
import { syncFromFootballData } from "@/lib/sync";
import { revalidatePath } from "next/cache";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const authHeader = request.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;

  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const result = await syncFromFootballData();

    revalidatePath("/");
    revalidatePath("/grupos");
    revalidatePath("/admin");

    return NextResponse.json({ ok: true, ...result, at: new Date().toISOString() });
  } catch (err) {
    console.error("[cron]", err);
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
