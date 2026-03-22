import { NextRequest, NextResponse } from "next/server";
import { StravaActivity } from "../../../../lib/strava";

export async function POST(req: NextRequest) {
  const { accessToken, after, before } = await req.json();

  if (!accessToken || !after || !before) {
    return NextResponse.json({ error: "Missing accessToken, after, or before" }, { status: 400 });
  }

  // Convert ISO date strings to Unix timestamps
  const afterTs = Math.floor(new Date(after).getTime() / 1000);
  const beforeTs = Math.floor(new Date(before + "T23:59:59").getTime() / 1000);

  const res = await fetch(
    `https://www.strava.com/api/v3/athlete/activities?after=${afterTs}&before=${beforeTs}&per_page=10`,
    { headers: { Authorization: `Bearer ${accessToken}` } }
  );

  if (!res.ok) {
    return NextResponse.json({ error: "Strava API error" }, { status: 502 });
  }

  const activities: StravaActivity[] = await res.json();

  const runs = activities.filter(
    a => a.type === "Run" || a.sport_type === "Run"
  );

  return NextResponse.json({ activities: runs });
}
