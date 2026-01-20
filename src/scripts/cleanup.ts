import "@dotenvx/dotenvx/config";
import { runCleanupJob } from "@/lib/cleanup-job";

async function main() {
  console.log("🧹 Starting media cleanup job...");
  console.log(`📅 Started at: ${new Date().toISOString()}`);

  try {
    const summary = await runCleanupJob();

    console.log("\n📊 Cleanup Summary:");
    console.log(`   Instances processed: ${summary.results.length}`);
    console.log(`   Messages processed: ${summary.totalMessagesProcessed}`);
    console.log(`   Files deleted: ${summary.totalFilesDeleted}`);
    console.log(`   Bytes freed: ${formatBytes(summary.totalBytesFreed)}`);
    console.log(`   Duration: ${getDuration(summary.startedAt, summary.completedAt)}`);

    if (summary.errors.length > 0) {
      console.log("\n⚠️ Errors:");
      summary.errors.forEach((e) => console.log(`   - ${e}`));
    }

    // Log individual results
    if (summary.results.length > 0) {
      console.log("\n📋 Per-instance results:");
      for (const result of summary.results) {
        console.log(`   ${result.whatsappId}:`);
        console.log(`     Messages: ${result.messagesProcessed}`);
        console.log(`     Files: ${result.filesDeleted}`);
        console.log(`     Freed: ${formatBytes(result.bytesFreed)}`);
        if (result.errors.length > 0) {
          console.log(`     Errors: ${result.errors.length}`);
        }
      }
    }

    console.log("\n✅ Cleanup job completed successfully");
  } catch (error) {
    console.error("\n❌ Cleanup job failed:", error);
    process.exit(1);
  }
}

function formatBytes(bytes: number): string {
  if (bytes === 0) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB", "TB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(2))} ${sizes[i]}`;
}

function getDuration(start: Date, end: Date): string {
  const ms = end.getTime() - start.getTime();
  const seconds = Math.floor(ms / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);

  if (hours > 0) {
    return `${hours}h ${minutes % 60}m ${seconds % 60}s`;
  } else if (minutes > 0) {
    return `${minutes}m ${seconds % 60}s`;
  } else {
    return `${seconds}s`;
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
