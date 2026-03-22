import { NextRequest, NextResponse } from "next/server";
import { getStravaIntegration } from "../../../../lib/strava";

export async function GET(req: NextRequest) {
  const uid = req.nextUrl.searchParams.get("uid");
  if (!uid) return NextResponse.json({ connected: false });

  try {
    const integration = await getStravaIntegration(uid);
    if (!integration) return NextResponse.json({ connected: false });
    return NextResponse.json({ connected: true, athleteName: integration.athleteName });
  } catch {
    return NextResponse.json({ connected: false });
  }
}
