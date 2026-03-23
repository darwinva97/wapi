# API de Administración

## 🔒 Seguridad

Esta aplicación tiene el **registro público DESHABILITADO**. Solo los administradores pueden crear nuevos usuarios.

## Endpoints Disponibles

### POST /api/admin/users/create

Crea un nuevo usuario en el sistema. Solo accesible por usuarios con rol de `admin`.

**Autenticación requerida:** Sí (rol: admin)

**Request Body:**
```json
{
  "email": "usuario@ejemplo.com",
  "password": "PasswordSegura123!",
  "name": "Nombre del Usuario",
  "role": "user" // opcional, por defecto: "user"
}
```

**Response (201):**
```json
{
  "message": "Usuario creado exitosamente",
  "user": {
    "id": "user-id",
    "email": "usuario@ejemplo.com",
    "name": "Nombre del Usuario",
    "role": "user",
    "createdAt": "2025-11-17T..."
  }
}
```

**Errores posibles:**
- `401` - No autenticado
- `403` - No autorizado (no es admin)
- `400` - Datos inválidos
- `409` - Email ya registrado
- `500` - Error del servidor

## Ejemplo de uso desde el cliente

```typescript
async function crearUsuario(datos: {
  email: string;
  password: string;
  name: string;
  role?: string;
}) {
  const response = await fetch("/api/admin/users/create", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    credentials: "include", // Importante para enviar cookies de sesión
    body: JSON.stringify(datos),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || "Error al crear usuario");
  }

  return await response.json();
}

// Uso
try {
  const result = await crearUsuario({
    email: "nuevo@ejemplo.com",
    password: "Password123!",
    name: "Usuario Nuevo",
    role: "user",
  });
  console.log("Usuario creado:", result.user);
} catch (error) {
  console.error("Error:", error.message);
}
```

## Otros endpoints de admin de Better Auth

Better Auth proporciona endpoints adicionales que puedes usar:

### POST /api/admin/ban-user
Banear un usuario del sistema.

### POST /api/admin/unban-user
Desbanear un usuario.

### POST /api/admin/set-role
Cambiar el rol de un usuario.

### POST /api/admin/remove-user
Eliminar permanentemente un usuario.

### POST /api/admin/list-users
Listar todos los usuarios (con paginación).

### POST /api/admin/impersonate-user
Impersonar a un usuario (para debugging).

Para más información sobre estos endpoints, consulta la [documentación de Better Auth](https://www.better-auth.com/docs/plugins/admin).

## Protección de rutas

Recuerda proteger todas las rutas de administración en tu aplicación:

```typescript
// Ejemplo de middleware para proteger rutas
import { auth } from "@/lib/auth";
import { NextRequest, NextResponse } from "next/server";

export async function middleware(request: NextRequest) {
  const session = await auth.api.getSession({
    headers: request.headers,
  });

  // Verificar autenticación
  if (!session?.user) {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  // Verificar rol de admin para rutas de admin
  if (request.nextUrl.pathname.startsWith("/admin")) {
    if (session.user.role !== "admin") {
      return NextResponse.redirect(new URL("/unauthorized", request.url));
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/admin/:path*", "/api/admin/:path*"],
};
```
