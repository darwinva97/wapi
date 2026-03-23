# Database Seeding

Este proyecto incluye un seeder para crear un usuario administrador usando la API de better-auth.

## ⚠️ IMPORTANTE: Registro Público Deshabilitado

El registro público está **DESHABILITADO** en esta aplicación. Los usuarios **SOLO** pueden ser creados por un administrador usando la API de admin (`/admin/create-user`).

Esto garantiza que:
- No hay registro público abierto
- Solo los admins pueden crear nuevos usuarios
- Control total sobre quién tiene acceso al sistema

## Variables de entorno requeridas

Asegúrate de tener configuradas estas variables en tu archivo `.env`:

```env
DATABASE_URL=<tu-url-de-base-de-datos>
DATABASE_AUTH_TOKEN=<tu-token-de-autenticacion>
BETTER_AUTH_SECRET=<secret-aleatorio-para-auth>
BETTER_AUTH_URL=http://localhost:3000
```

## Ejecutar el seeder

```bash
pnpm db:seed
```

## Credenciales del admin

Después de ejecutar el seeder, podrás iniciar sesión con:

- **Email:** admin@example.com
- **Password:** Admin123!
- **Role:** admin

## Características del usuario admin

El usuario admin creado tendrá:

- ✅ Rol de administrador
- ✅ Acceso completo a las funcionalidades de administración
- ✅ Capacidad de crear nuevos usuarios vía `/admin/create-user`

## Crear usuarios adicionales

Una vez que tengas un admin, puedes crear usuarios adicionales usando la API de admin:

```typescript
// En tu código backend con autenticación de admin
await auth.api.createUser({
  body: {
    email: "nuevo-usuario@ejemplo.com",
    password: "PasswordSegura123!",
    name: "Nombre del Usuario",
    role: "user", // o "admin" para otro administrador
  },
});
```

## Personalización

Puedes modificar las credenciales del admin editando el archivo `src/db/seed.ts`:

```typescript
const result = await auth.api.createUser({
  body: {
    email: "tu-email@ejemplo.com",
    password: "TuPasswordSegura123!",
    name: "Tu Nombre",
    role: "admin",
  },
});
```

## Seguridad

✅ **Registro público DESHABILITADO** - Solo admins pueden crear usuarios
⚠️ **IMPORTANTE:** Cambia las credenciales del admin después del primer inicio de sesión en producción
🔒 **Control de acceso:** Todos los endpoints de creación de usuarios requieren autenticación de admin
