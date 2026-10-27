export const dynamic = "force-dynamic";

export function GET() {
    return Response.json({ estado: "ok" }, {
        headers: { "Cache-Control": "no-store" },
    });
}
