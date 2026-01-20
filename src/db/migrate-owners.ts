import "@dotenvx/dotenvx/config";
import { db } from "@/db";
import { whatsappTable, whatsappMemberTable, platformConfigTable, storageConfigTable } from "@/db/schema";
import { randomUUID } from "crypto";

async function migrateOwners() {
  console.log("🔄 Starting owner migration...");

  try {
    // Get all existing WhatsApp instances
    const whatsappInstances = await db.query.whatsappTable.findMany();

    console.log(`📱 Found ${whatsappInstances.length} WhatsApp instance(s)`);

    // Check existing members to avoid duplicates
    const existingMembers = await db.query.whatsappMemberTable.findMany();
    const existingMemberKeys = new Set(
      existingMembers.map((m) => `${m.whatsappId}-${m.userId}`)
    );

    let created = 0;
    let skipped = 0;

    for (const wa of whatsappInstances) {
      const memberKey = `${wa.id}-${wa.userId}`;

      if (existingMemberKeys.has(memberKey)) {
        console.log(`⏭️  Skipping ${wa.name} (${wa.slug}) - owner already exists`);
        skipped++;
        continue;
      }

      // Create owner member record
      await db.insert(whatsappMemberTable).values({
        id: randomUUID(),
        whatsappId: wa.id,
        userId: wa.userId,
        role: "owner",
        createdBy: wa.userId, // Self-assigned as owner
      });

      console.log(`✅ Created owner for ${wa.name} (${wa.slug})`);
      created++;
    }

    console.log(`\n📊 Migration summary:`);
    console.log(`   Created: ${created}`);
    console.log(`   Skipped: ${skipped}`);

    // Initialize singleton configs if they don't exist
    console.log("\n🔧 Initializing default configurations...");

    // Check and create platform_config
    const existingPlatformConfig = await db.query.platformConfigTable.findFirst();
    if (!existingPlatformConfig) {
      await db.insert(platformConfigTable).values({
        id: "default",
        allowRegistration: false,
        allowUserCreateWhatsapp: true,
        defaultMaxWhatsappInstances: 0,
      });
      console.log("✅ Created default platform configuration");
    } else {
      console.log("⏭️  Platform configuration already exists");
    }

    // Check and create storage_config
    const existingStorageConfig = await db.query.storageConfigTable.findFirst();
    if (!existingStorageConfig) {
      await db.insert(storageConfigTable).values({
        id: "default",
        storageType: "local",
      });
      console.log("✅ Created default storage configuration");
    } else {
      console.log("⏭️  Storage configuration already exists");
    }

    console.log("\n🎉 Owner migration completed successfully!");
  } catch (error) {
    console.error("❌ Error during migration:", error);
    throw error;
  }
}

// Execute the migration
migrateOwners()
  .then(() => {
    console.log("\n✨ Migration process finished");
    process.exit(0);
  })
  .catch((error) => {
    console.error("\n💥 Migration process failed:", error);
    process.exit(1);
  });
