export const dynamic = "force-dynamic";

export async function GET() {
  return Response.json({ ok: true, app: "chatsapp", version: "3.0.0" });
}
