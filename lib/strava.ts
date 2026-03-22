import { doc, getDoc, updateDoc } from "firebase/firestore";
import { db } from "./firebase";

export interface StravaActivity {
  id: number;
  name: string;
  type: string;
  sport_type: string;
  start_date: string;             // ISO 8601
  distance: number;               // metres
  moving_time: number;            // seconds
  total_elevation_gain?: number;  // metres
  average_heartrate?: number;
  max_heartrate?: number;
  average_cadence?: number;       // steps/min
  suffer_score?: number;          // Strava relative effort 1–100
  workout_type?: number;          // 0=default, 1=race, 2=long_run, 3=workout
  achievement_count?: number;     // PRs set on this activity
  perceived_exertion?: number;    // 1–10 RPE
}

export interface StravaIntegration {
  athleteId: number;
  athleteName: string;
  accessToken: string;
  refreshToken: string;
  expiresAt: number;           // Unix timestamp (seconds)
  scope: string;
}

function stravaRef(uid: string) {
  return doc(db, "users", uid, "integrations", "strava");
}

// Returns a valid access token, refreshing automatically if expired.
export async function getValidAccessToken(uid: string): Promise<string> {
  const snap = await getDoc(stravaRef(uid));
  if (!snap.exists()) throw new Error("Strava not connected");

  const data = snap.data() as StravaIntegration;
  const nowSecs = Math.floor(Date.now() / 1000);

  if (data.expiresAt > nowSecs + 60) {
    return data.accessToken; // still valid (with 60s buffer)
  }

  // Refresh
  const res = await fetch("https://www.strava.com/oauth/token", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      client_id: process.env.STRAVA_CLIENT_ID,
      client_secret: process.env.STRAVA_CLIENT_SECRET,
      refresh_token: data.refreshToken,
      grant_type: "refresh_token",
    }),
  });

  if (!res.ok) throw new Error("Strava token refresh failed");

  const fresh = await res.json();

  await updateDoc(stravaRef(uid), {
    accessToken: fresh.access_token,
    refreshToken: fresh.refresh_token,
    expiresAt: fresh.expires_at,
  });

  return fresh.access_token;
}

// Fetches the Strava integration doc for a user (to check connected state + athlete name).
export async function getStravaIntegration(uid: string): Promise<StravaIntegration | null> {
  const snap = await getDoc(stravaRef(uid));
  return snap.exists() ? (snap.data() as StravaIntegration) : null;
}

// Converts Strava moving_time (secs) and distance (metres) into a "M:SS/km" pace string.
export function computePaceStr(movingTimeSecs: number, distanceMetres: number): string {
  if (distanceMetres === 0) return "";
  const secsPerKm = movingTimeSecs / (distanceMetres / 1000);
  const m = Math.floor(secsPerKm / 60);
  const s = Math.round(secsPerKm % 60);
  return `${m}:${s.toString().padStart(2, "0")}/km`;
}

// Maps Strava perceived_exertion (1–10) or heart rate zones to our effort scale.
export function inferEffort(
  perceivedExertion?: number,
  avgHeartrate?: number,
  maxHr = 190,
): "easy" | "moderate" | "hard" | null {
  if (perceivedExertion !== undefined) {
    if (perceivedExertion <= 4) return "easy";
    if (perceivedExertion <= 7) return "moderate";
    return "hard";
  }
  if (avgHeartrate !== undefined) {
    const pct = avgHeartrate / maxHr;
    if (pct < 0.7) return "easy";
    if (pct < 0.85) return "moderate";
    return "hard";
  }
  return null;
}
