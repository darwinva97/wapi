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
      <header className="border-b bg-card/50 backdrop-blur-sm">
        <div className="mx-auto flex max-w-7xl items-center px-4 py-4 sm:px-6 lg:px-8">
          <Button variant="ghost" size="sm" asChild>
            <Link href="/" className="gap-2">
              <ArrowLeft className="h-4 w-4" />
              Volver
            </Link>
          </Button>
        </div>
      </header>

      <div className="mx-auto flex max-w-2xl items-center justify-center px-4 py-12 sm:px-6 lg:px-8">
        <div className="w-full space-y-8">
          {/* Header Section */}
          <div className="flex flex-col items-center text-center space-y-2">
            <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-primary/10 text-primary">
              <MessageCircle className="h-8 w-8" strokeWidth={2} />
            </div>
            <div>
              <h1 className="text-2xl font-bold tracking-tight">Conectar nuevo WhatsApp</h1>
              <p className="text-muted-foreground">
                Ingresa los detalles de la cuenta que deseas conectar
              </p>
            </div>
          </div>

          {/* Form Card */}
          <Card>
            <CardHeader>
              <CardTitle>Información de la cuenta</CardTitle>
              <CardDescription>
                Configura los datos básicos de tu cuenta de WhatsApp
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form action={formAction} className="space-y-5">
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
                    Slug <span className="text-muted-foreground">(Identificador único)</span>
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
                    Identificador único para la API (solo letras minúsculas, números y guiones)
                  </p>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="phoneNumber">Número de teléfono</Label>
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
                    Descripción <span className="text-muted-foreground">(Opcional)</span>
                  </Label>
                  <Textarea
                    id="description"
                    name="description"
                    rows={3}
                    placeholder="Para qué se usará esta cuenta..."
                    disabled={isPending}
                  />
                </div>

                {state.error && (
                  <Alert variant="destructive" className="py-3">
                    <AlertCircle className="h-4 w-4" />
                    <AlertDescription className="text-sm">{state.error}</AlertDescription>
                  </Alert>
                )}

                <div className="flex items-center justify-between gap-4 pt-2">
                  <Button
                    type="button"
                    variant="outline"
                    className="flex-1"
                    asChild
                    disabled={isPending}
                  >
                    <Link href="/">Cancelar</Link>
                  </Button>
                  <Button type="submit" className="flex-1" disabled={isPending}>
                    {isPending ? (
                      <>
                        <SpinnerComponent className="mr-2" />
                        Guardando...
                      </>
                    ) : (
                      "Guardar y Conectar"
                    )}
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
