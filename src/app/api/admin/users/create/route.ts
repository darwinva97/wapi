import { auth } from "@/lib/auth";
import { NextRequest, NextResponse } from "next/server";

/**
 * Endpoint para que los admins creen nuevos usuarios
 * Solo accesible por usuarios autenticados con rol de admin
 */
export async function POST(request: NextRequest) {
  try {
    // Obtener la sesión actual
    const session = await auth.api.getSession({
      headers: request.headers,
    });

    // Verificar que el usuario esté autenticado
    if (!session?.user) {
      return NextResponse.json(
        { error: "No autenticado" },
        { status: 401 }
      );
    }

    // Verificar que el usuario tenga rol de admin
    if (session.user.role !== "admin") {
      return NextResponse.json(
        { error: "No autorizado. Se requiere rol de admin." },
        { status: 403 }
      );
    }

    // Obtener datos del body
    const body = await request.json();
    const { email, password, name, role = "user" } = body;

    // Validar campos requeridos
    if (!email || !password || !name) {
      return NextResponse.json(
        { error: "Email, password y name son requeridos" },
        { status: 400 }
      );
    }

    // Crear el nuevo usuario usando la API de admin
    const result = await auth.api.createUser({
      body: {
        email,
        password,
        name,
        role,
      },
    });

    if (!result || !result.user) {
      throw new Error("Error al crear usuario");
    }

    // No retornar información sensible
    const { ...userWithoutSensitiveData } = result.user;

    return NextResponse.json(
      {
        message: "Usuario creado exitosamente",
        user: userWithoutSensitiveData,
      },
      { status: 201 }
    );
  } catch (error: unknown) {
    console.error("Error creating user:", error);

    // Manejar errores específicos
    if ((error as Error).message?.includes("UNIQUE constraint")) {
      return NextResponse.json(
        { error: "El email ya está registrado" },
        { status: 409 }
      );
    }

    return NextResponse.json(
      { error: "Error al crear el usuario", details: (error as Error).message },
      { status: 500 }
    );
  }
}
