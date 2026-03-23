"use client";
import { useState, useEffect } from "react";
import { signIn } from "@/lib/auth-client";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Spinner } from "@/components/ui/spinner";
import { AlertCircle } from "lucide-react";
import { checkRegistrationAllowed } from "./actions";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [registrationAllowed, setRegistrationAllowed] = useState(false);
  const router = useRouter();

  useEffect(() => {
    checkRegistrationAllowed().then(setRegistrationAllowed);
  }, []);

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");
    try {
      await signIn.email({ email, password });
      router.replace("/");
    } catch (err: unknown) {
      setError((err as Error)?.message || "Error al iniciar sesión");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="flex min-h-screen">
      {/* Left Panel - Brand */}
      <div className="hidden w-[45%] bg-gradient-to-b from-[#FF8400] to-[#CC6A00] lg:flex lg:flex-col lg:items-center lg:justify-center px-12">
        <div className="max-w-sm space-y-6">
          <div className="flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-white">
              <span className="text-xl font-bold text-[#FF8400]">W</span>
            </div>
            <span className="text-3xl font-mono font-bold text-white tracking-tight">
              WAPI
            </span>
          </div>
          <p className="text-lg font-medium text-white/80">
            WhatsApp API Gateway
          </p>
          <p className="text-sm leading-relaxed text-white/60">
            Conecta, automatiza y gestiona tus cuentas de WhatsApp desde un solo
            lugar.
          </p>
        </div>
      </div>

      {/* Right Panel - Login Form */}
      <div className="flex flex-1 flex-col items-center justify-center bg-background px-6 py-12">
        <div className="w-full max-w-[400px] space-y-8">
          {/* Mobile-only brand (visible below lg) */}
          <div className="flex flex-col items-center gap-3 lg:hidden">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-[#FF8400]">
                <span className="text-lg font-bold text-white">W</span>
              </div>
              <span className="text-2xl font-mono font-bold tracking-tight">
                WAPI
              </span>
            </div>
          </div>

          {/* Header */}
          <div className="space-y-2">
            <h1 className="text-2xl font-mono font-semibold tracking-tight">
              Bienvenido de nuevo
            </h1>
            <p className="text-sm text-muted-foreground">
              Ingresa tus credenciales para acceder
            </p>
          </div>

          {/* Form */}
          <form className="space-y-5" onSubmit={handleLogin}>
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
                autoComplete="current-password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                disabled={loading}
                className="h-10"
              />
            </div>

            {error && (
              <Alert variant="destructive" className="py-3">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription className="text-sm">
                  {error}
                </AlertDescription>
              </Alert>
            )}

            <Button
              type="submit"
              className="w-full h-10 mt-2 rounded-full shadow-sm"
              disabled={loading}
            >
              {loading ? (
                <>
                  <Spinner className="mr-2" />
                  Iniciando sesión...
                </>
              ) : (
                "Iniciar sesión"
              )}
            </Button>
          </form>

          {registrationAllowed && (
            <p className="text-center text-sm text-muted-foreground">
              ¿No tienes cuenta?{" "}
              <Link
                href="/signup"
                className="text-foreground font-medium hover:underline"
              >
                Registrarse
              </Link>
            </p>
          )}
        </div>
      </div>
    </main>
  );
}
