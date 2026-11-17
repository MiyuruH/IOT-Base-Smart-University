import { NextResponse } from "next/server";
import {
  getAlertSettings,
  saveAlertSettings,
} from "@/lib/services/alertSettings";
import { syncCampusAnomalies } from "@/lib/services/alerts";
import { requireAuth } from "@/lib/authGuard";

export async function GET(req: Request) {
  const auth = requireAuth(req);
  if (!auth.ok) return auth.response;

  try {
    const settings = await getAlertSettings(true);
    return NextResponse.json(settings);
  } catch {
    return NextResponse.json(
      { error: "Failed to load alert settings from database" },
      { status: 500 }
    );
  }
}

export async function PUT(req: Request) {
  const auth = requireAuth(req);
  if (!auth.ok) return auth.response;

  try {
    const body = await req.json();
    const saved = await saveAlertSettings(body);
    // Re-evaluate campus readings against the newly saved thresholds
    await syncCampusAnomalies();
    return NextResponse.json(saved);
  } catch {
    return NextResponse.json(
      { error: "Failed to save alert settings to database" },
      { status: 500 }
    );
  }
}
