"use client";
import { useState, useEffect } from "react";
import { signUp } from "@/lib/auth-client";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Spinner } from "@/components/ui/spinner";
import { AlertCircle } from "lucide-react";
import { checkRegistrationAllowed } from "./actions";

export default function SignupPage() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [checking, setChecking] = useState(true);
  const [allowed, setAllowed] = useState(false);
  const router = useRouter();

  useEffect(() => {
    let mounted = true;
    checkRegistrationAllowed().then((result) => {
      if (!mounted) return;
      console.log("[signup] checkRegistrationAllowed result:", result);
      setAllowed(result);
      setChecking(false);
    });
    return () => { mounted = false; };
  }, []);

  async function handleSignup(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");

    if (password !== confirmPassword) {
      setError("Las contraseñas no coinciden");
      setLoading(false);
      return;
    }

    if (password.length < 8) {
      setError("La contraseña debe tener al menos 8 caracteres");
      setLoading(false);
      return;
    }

    try {
      const result = await signUp.email({ email, password, name });
      if (result.error) {
        setError(result.error.message || "Error al crear la cuenta");
      } else {
        router.replace("/");
      }
    } catch (err: unknown) {
      setError((err as Error)?.message || "Error al crear la cuenta");
    } finally {
      setLoading(false);
    }
  }

  if (checking) {
    return (
      <main className="flex min-h-screen items-center justify-center">
        <Spinner className="h-8 w-8" />
      </main>
    );
  }

  if (!allowed) {
    router.replace("/login");
    return null;
  }

  return (
    <main className="flex min-h-screen">
      {/* Left Panel - Orange Gradient */}
      <div className="hidden lg:flex w-[45%] bg-gradient-to-b from-[#FF8400] to-[#CC6A00] flex-col items-center justify-center px-12">
        <div className="flex flex-col items-center space-y-4">
          <div className="flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-white">
              <span className="text-xl font-bold text-[#FF8400]">W</span>
            </div>
            <span className="text-3xl font-mono font-bold text-white">WAPI</span>
          </div>
          <p className="text-white/80 text-sm">WhatsApp API Gateway</p>
          <p className="text-white/60 text-sm text-center max-w-[280px] mt-2">
            Crea tu cuenta y empieza a conectar tus WhatsApps en minutos.
          </p>
        </div>
      </div>

      {/* Right Panel - Form */}
      <div className="flex-1 flex items-center justify-center bg-background px-6 py-12">
        <div className="w-full max-w-[400px] space-y-6">
          {/* Mobile Logo (visible only on small screens) */}
          <div className="flex lg:hidden flex-col items-center space-y-2 mb-8">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-[#FF8400]">
                <span className="text-lg font-bold text-white">W</span>
              </div>
              <span className="text-2xl font-mono font-bold">WAPI</span>
            </div>
          </div>

          <div className="space-y-2">
            <h1 className="font-mono text-2xl font-semibold">Crear cuenta</h1>
            <p className="text-sm text-muted-foreground">
              Ingresa tus datos para registrarte
            </p>
          </div>

          <form className="space-y-4" onSubmit={handleSignup}>
            <div className="space-y-2">
              <Label htmlFor="name" className="text-sm font-medium">
                Nombre
              </Label>
              <Input
                id="name"
                name="name"
                type="text"
                autoComplete="name"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Tu nombre"
                disabled={loading}
                className="h-10"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="email" className="text-sm font-medium">
                Email
              </Label>
              <Input
                id="email"
                name="email"
                type="email"
                autoComplete="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="tu@email.com"
                disabled={loading}
                className="h-10"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password" className="text-sm font-medium">
                Contraseña
              </Label>
              <Input
                id="password"
                name="password"
                type="password"
                autoComplete="new-password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                disabled={loading}
                className="h-10"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="confirmPassword" className="text-sm font-medium">
                Confirmar contraseña
              </Label>
              <Input
                id="confirmPassword"
                name="confirmPassword"
                type="password"
                autoComplete="new-password"
                required
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="••••••••"
                disabled={loading}
                className="h-10"
              />
            </div>

            {error && (
              <Alert variant="destructive" className="py-3">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription className="text-sm">{error}</AlertDescription>
              </Alert>
            )}

            <Button
              type="submit"
              className="w-full h-10 mt-2 rounded-full"
              disabled={loading}
            >
              {loading ? (
                <>
                  <Spinner className="mr-2" />
                  Creando cuenta...
                </>
              ) : (
                "Crear cuenta"
              )}
            </Button>
          </form>

          <div className="text-center text-sm">
            <span className="text-muted-foreground">¿Ya tienes cuenta? </span>
            <Link href="/login" className="text-primary hover:underline">
              Iniciar sesión
            </Link>
          </div>
        </div>
      </div>
    </main>
  );
}
