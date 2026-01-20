import "@dotenvx/dotenvx/config";
import { db } from "@/db";
import { auth } from "@/lib/auth";
import {
  whatsappTable,
  whatsappMemberTable,
  platformConfigTable,
  storageConfigTable,
} from "@/db/schema";
import { randomUUID } from "crypto";

async function setup() {
  console.log("🚀 Starting database setup...\n");

  // Step 1: Create admin user
  console.log("👤 Step 1: Creating admin user...");
  try {
    const result = await auth.api.createUser({
      body: {
        email: "admin@example.com",
        password: "Admin123!",
        name: "Admin User",
        role: "admin",
      },
    });

    if (result?.user) {
      console.log("✅ Admin user created");
    }
  } catch (error: unknown) {
    const message = (error as Error).message || String(error);
    if (message.includes("already exists") || message.includes("UNIQUE constraint")) {
      console.log("⏭️  Admin user already exists, skipping");
    } else {
      console.error("❌ Error creating admin:", message);
    }
  }

  // Step 2: Initialize platform config
  console.log("\n⚙️  Step 2: Initializing platform configuration...");
  const existingPlatformConfig = await db.query.platformConfigTable.findFirst();
  if (!existingPlatformConfig) {
    await db.insert(platformConfigTable).values({
      id: "default",
      allowRegistration: false,
      allowUserCreateWhatsapp: true,
      defaultMaxWhatsappInstances: 0,
    });
    console.log("✅ Platform configuration created");
  } else {
    console.log("⏭️  Platform configuration already exists");
  }

  // Step 3: Initialize storage config
  console.log("\n💾 Step 3: Initializing storage configuration...");
  const existingStorageConfig = await db.query.storageConfigTable.findFirst();
  if (!existingStorageConfig) {
    await db.insert(storageConfigTable).values({
      id: "default",
      storageType: "local",
    });
    console.log("✅ Storage configuration created (local)");
  } else {
    console.log("⏭️  Storage configuration already exists");
  }

  // Step 4: Migrate existing WhatsApp owners
  console.log("\n👑 Step 4: Migrating WhatsApp instance owners...");
  const whatsappInstances = await db.query.whatsappTable.findMany();

  if (whatsappInstances.length === 0) {
    console.log("⏭️  No WhatsApp instances to migrate");
  } else {
    const existingMembers = await db.query.whatsappMemberTable.findMany();
    const existingMemberKeys = new Set(
      existingMembers.map((m) => `${m.whatsappId}-${m.userId}`)
    );

    let created = 0;
    let skipped = 0;

    for (const wa of whatsappInstances) {
      const memberKey = `${wa.id}-${wa.userId}`;

      if (existingMemberKeys.has(memberKey)) {
        skipped++;
        continue;
      }

      await db.insert(whatsappMemberTable).values({
        id: randomUUID(),
        whatsappId: wa.id,
        userId: wa.userId,
        role: "owner",
        createdBy: wa.userId,
      });
      created++;
    }

    console.log(`✅ Owners migrated: ${created} created, ${skipped} skipped`);
  }

  // Summary
  console.log("\n" + "=".repeat(50));
  console.log("🎉 Database setup completed!");
  console.log("=".repeat(50));
  console.log("\n📧 Admin credentials:");
  console.log("   Email:    admin@example.com");
  console.log("   Password: Admin123!");
  console.log("");
}

setup()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("\n💥 Setup failed:", error);
    process.exit(1);
  });
