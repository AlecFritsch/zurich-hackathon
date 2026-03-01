const BACKEND = process.env.NEXT_PUBLIC_HAVOC_URL ?? "http://localhost:8000";

export async function GET() {
  const res = await fetch(`${BACKEND}/camera/snapshot`, { cache: "no-store" });
  const data = await res.json().catch(() => ({}));
  return Response.json(data, { status: res.status });
}
