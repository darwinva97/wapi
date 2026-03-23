import "@dotenvx/dotenvx/config";
import { auth } from "@/lib/auth";

async function seed() {
  console.log("🌱 Starting database seeding...");

  try {
    // Crear usuario admin usando la API de admin de better-auth
    // Esta API permite crear usuarios incluso cuando signUp está deshabilitado
    const result = await auth.api.createUser({
      body: {
        email: "admin@example.com",
        password: "Admin123!",
        name: "Admin User",
        role: "admin", // Asignar rol de admin directamente en la creación
      },
    });

    if (!result || !result.user) {
      throw new Error("Failed to create admin user");
    }

    console.log("✅ Admin user created:", result.user);

    // Verificar el email del admin
    // Nota: Como creamos el usuario directamente, podemos marcar el email como verificado
    // actualizando el registro manualmente si es necesario
    console.log("✅ Admin created with role:", result.user.role);

    console.log("\n🎉 Database seeding completed successfully!");
    console.log("\n📧 Admin credentials:");
    console.log("   Email: admin@example.com");
    console.log("   Password: Admin123!");
  } catch (error) {
    console.error("❌ Error during seeding:", error);
    throw error;
  }
}

// Ejecutar el seed
seed()
  .then(() => {
    console.log("\n✨ Seed process finished");
    process.exit(0);
  })
  .catch((error) => {
    console.error("\n💥 Seed process failed:", error);
    process.exit(1);
  });
