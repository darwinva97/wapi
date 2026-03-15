"use client";

import { createWhatsappAction } from "./actions";
import { useActionState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { ArrowLeft, MessageCircle, AlertCircle } from "lucide-react";
import { Spinner as SpinnerComponent } from "@/components/ui/spinner";
import { Alert, AlertDescription } from "@/components/ui/alert";

const initialState = {
  success: false,
  error: "",
};

export default function CreateWhatsappPage() {
  const [state, formAction, isPending] = useActionState(
    createWhatsappAction,
    initialState
  );

  return (
    <div className="min-h-screen">
      {/* Header */}
      <header className="sticky top-0 z-50 h-16 border-b bg-card">
        <div className="mx-auto flex h-full max-w-7xl items-center px-4 sm:px-6 lg:px-8">
          <Button variant="ghost" size="sm" className="rounded-full" asChild>
            <Link href="/" className="gap-2">
              <ArrowLeft className="h-4 w-4" />
              Volver
            </Link>
          </Button>
        </div>
      </header>

      {/* Main Content */}
      <main className="mx-auto max-w-xl px-4 py-12">
        <div className="space-y-8">
          {/* Icon Header */}
          <div className="flex flex-col items-center text-center space-y-4">
            <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-orange-500/15 text-orange-500">
              <MessageCircle className="h-8 w-8" strokeWidth={2} />
            </div>
            <div className="space-y-2">
              <h1 className="font-mono text-2xl font-semibold text-center">
                Conectar nuevo WhatsApp
              </h1>
              <p className="text-muted-foreground text-center">
                Ingresa los detalles de la cuenta que deseas conectar
              </p>
            </div>
          </div>

          {/* Form Card */}
          <Card>
            <CardHeader>
              <CardTitle>Informacion de la cuenta</CardTitle>
              <CardDescription>
                Configura los datos basicos de tu cuenta de WhatsApp
              </CardDescription>
            </CardHeader>
            <form action={formAction}>
              <CardContent className="space-y-5">
                <div className="space-y-2">
                  <Label htmlFor="name">Nombre de la cuenta</Label>
                  <Input
                    id="name"
                    name="name"
                    type="text"
                    required
                    placeholder="Ej: Ventas Principal"
                    disabled={isPending}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="slug">
                    Slug{" "}
                    <span className="text-muted-foreground">
                      (Identificador unico)
                    </span>
                  </Label>
                  <Input
                    id="slug"
                    name="slug"
                    type="text"
                    required
                    placeholder="Ej: ventas-principal"
                    disabled={isPending}
                  />
                  <p className="text-xs text-muted-foreground">
                    Identificador unico para la API (solo letras minusculas,
                    numeros y guiones)
                  </p>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="phoneNumber">Numero de telefono</Label>
                  <Input
                    id="phoneNumber"
                    name="phoneNumber"
                    type="tel"
                    required
                    placeholder="Ej: +51 999 999 999"
                    disabled={isPending}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="description">
                    Descripcion{" "}
                    <span className="text-muted-foreground">(Opcional)</span>
                  </Label>
                  <Textarea
                    id="description"
                    name="description"
                    rows={3}
                    placeholder="Para que se usara esta cuenta..."
                    disabled={isPending}
                  />
                </div>

                {state.error && (
                  <Alert variant="destructive" className="py-3">
                    <AlertCircle className="h-4 w-4" />
                    <AlertDescription className="text-sm">
                      {state.error}
                    </AlertDescription>
                  </Alert>
                )}
              </CardContent>
              <CardFooter className="flex items-center justify-between gap-4 pt-4">
                <Button
                  type="button"
                  variant="outline"
                  className="flex-1 rounded-full"
                  asChild
                  disabled={isPending}
                >
                  <Link href="/">Cancelar</Link>
                </Button>
                <Button
                  type="submit"
                  className="flex-1 rounded-full"
                  disabled={isPending}
                >
                  {isPending ? (
                    <>
                      <SpinnerComponent className="mr-2" />
                      Guardando...
                    </>
                  ) : (
                    "Guardar y Conectar"
                  )}
                </Button>
              </CardFooter>
            </form>
          </Card>
        </div>
      </main>
    </div>
  );
}
