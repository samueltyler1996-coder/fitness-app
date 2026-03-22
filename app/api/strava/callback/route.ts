import { NextRequest, NextResponse } from "next/server";

export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl;
  const code = searchParams.get("code");
  const uid = searchParams.get("state");
  const error = searchParams.get("error");

  const appUrl = process.env.NEXT_PUBLIC_APP_URL!;

  if (error || !code || !uid) {
    return NextResponse.redirect(`${appUrl}?strava=denied`);
  }

  // Exchange code for tokens (server-side — client secret never hits browser)
  const tokenRes = await fetch("https://www.strava.com/oauth/token", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      client_id: process.env.STRAVA_CLIENT_ID,
      client_secret: process.env.STRAVA_CLIENT_SECRET,
      code,
      grant_type: "authorization_code",
    }),
  });

  if (!tokenRes.ok) {
    return NextResponse.redirect(`${appUrl}?strava=error`);
  }

  const data = await tokenRes.json();

  // Redirect to app with token data as URL params.
  // The client is already authenticated and will write these to Firestore,
  // then immediately clean the URL via window.history.replaceState.
  const params = new URLSearchParams({
    strava: "connected",
    uid,
    at: data.access_token,
    rt: data.refresh_token,
    ea: String(data.expires_at),
    aid: String(data.athlete.id),
    an: `${data.athlete.firstname} ${data.athlete.lastname}`,
  });

  return NextResponse.redirect(`${appUrl}/?${params.toString()}`);
}
