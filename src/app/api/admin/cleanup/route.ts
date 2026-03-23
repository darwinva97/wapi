import { NextRequest, NextResponse } from "next/server";
import { runCleanupJob, type CleanupSummary } from "@/lib/cleanup-job";
import { auth } from "@/lib/auth";
import { headers } from "next/headers";

/**
 * POST /api/admin/cleanup
 *
 * Run the media cleanup job.
 *
 * Authentication:
 * - Admin session required, OR
 * - X-Cleanup-Token header with CLEANUP_SECRET env var
 *
 * This allows running the job from:
 * - Admin UI
 * - External cron services (e.g., GitHub Actions, Kubernetes CronJob)
 */
export async function POST(req: NextRequest) {
  try {
    // Check authentication
    const isAuthorized = await checkAuthorization(req);
    if (!isAuthorized) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    console.log("[Cleanup API] Starting cleanup job...");
    const summary = await runCleanupJob();

    return NextResponse.json({
      success: true,
      summary: {
        startedAt: summary.startedAt.toISOString(),
        completedAt: summary.completedAt.toISOString(),
        totalMessagesProcessed: summary.totalMessagesProcessed,
        totalFilesDeleted: summary.totalFilesDeleted,
        totalBytesFreed: summary.totalBytesFreed,
        instancesProcessed: summary.results.length,
        errorCount: summary.errors.length,
      },
    });
  } catch (error) {
    console.error("[Cleanup API] Error:", error);
    return NextResponse.json(
      { error: "Cleanup job failed", details: String(error) },
      { status: 500 }
    );
  }
}

/**
 * GET /api/admin/cleanup
 *
 * Check if cleanup is available and get current config
 */
export async function GET(req: NextRequest) {
  try {
    const isAuthorized = await checkAuthorization(req);
    if (!isAuthorized) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    return NextResponse.json({
      available: true,
      message: "Send POST request to run cleanup job",
    });
  } catch (error) {
    return NextResponse.json(
      { error: "Error checking cleanup status" },
      { status: 500 }
    );
  }
}

async function checkAuthorization(req: NextRequest): Promise<boolean> {
  // Check for cleanup token (for external cron services)
  const cleanupToken = req.headers.get("X-Cleanup-Token");
  const expectedToken = process.env.CLEANUP_SECRET;

  if (cleanupToken && expectedToken && cleanupToken === expectedToken) {
    return true;
  }

  // Check for admin session
  try {
    const session = await auth.api.getSession({
      headers: await headers(),
    });

    if (session?.user?.role === "admin") {
      return true;
    }
  } catch {
    // Session check failed
  }

  return false;
}
