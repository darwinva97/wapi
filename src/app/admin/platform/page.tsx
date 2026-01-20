"use client";

import { useEffect, useState, useActionState } from "react";
import {
  getPlatformConfigAction,
  updatePlatformConfigAction,
} from "./actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Spinner } from "@/components/ui/spinner";
import { Settings, CheckCircle2, AlertCircle } from "lucide-react";

const initialState = {
  success: false,
  error: "",
};

export default function PlatformConfigPage() {
  const [config, setConfig] = useState<{
    allowRegistration: boolean;
    allowUserCreateWhatsapp: boolean;
    defaultMaxWhatsappInstances: number;
  } | null>(null);

  const [state, formAction, isPending] = useActionState(
    updatePlatformConfigAction,
    initialState
  );

  useEffect(() => {
    getPlatformConfigAction().then(setConfig);
  }, []);

  if (!config) {
    return (
      <div className="flex items-center justify-center py-12">
        <Spinner className="h-8 w-8" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-primary/10 text-primary">
          <Settings className="h-6 w-6" />
        </div>
        <div>
          <h1 className="text-2xl font-bold">Configuración de Plataforma</h1>
          <p className="text-muted-foreground">
            Ajustes globales que afectan a todos los usuarios
          </p>
        </div>
      </div>

      <form action={formAction}>
        <Card>
          <CardHeader>
            <CardTitle>Registro y Permisos</CardTitle>
            <CardDescription>
              Configura quién puede registrarse y qué pueden hacer los usuarios
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Allow Registration */}
            <div className="flex items-center justify-between rounded-lg border p-4">
              <div className="space-y-0.5">
                <Label htmlFor="allowRegistration" className="text-base">
                  Permitir registro público
                </Label>
                <p className="text-sm text-muted-foreground">
                  Los nuevos usuarios pueden crear cuentas por sí mismos
                </p>
              </div>
              <Switch
                id="allowRegistration"
                name="allowRegistration"
                defaultChecked={config.allowRegistration}
                disabled={isPending}
              />
            </div>

            {/* Allow User Create WhatsApp */}
            <div className="flex items-center justify-between rounded-lg border p-4">
              <div className="space-y-0.5">
                <Label htmlFor="allowUserCreateWhatsapp" className="text-base">
                  Usuarios pueden crear instancias
                </Label>
                <p className="text-sm text-muted-foreground">
                  Los usuarios pueden crear sus propias instancias de WhatsApp
                </p>
              </div>
              <Switch
                id="allowUserCreateWhatsapp"
                name="allowUserCreateWhatsapp"
                defaultChecked={config.allowUserCreateWhatsapp}
                disabled={isPending}
              />
            </div>

            {/* Default Max WhatsApp Instances */}
            <div className="space-y-2">
              <Label htmlFor="defaultMaxWhatsappInstances">
                Límite de instancias por usuario
              </Label>
              <Input
                id="defaultMaxWhatsappInstances"
                name="defaultMaxWhatsappInstances"
                type="number"
                min="0"
                defaultValue={config.defaultMaxWhatsappInstances}
                disabled={isPending}
                className="max-w-xs"
              />
              <p className="text-sm text-muted-foreground">
                Número máximo de instancias de WhatsApp por usuario. 0 =
                ilimitado.
              </p>
            </div>

            {/* Success message */}
            {state.success && (
              <Alert className="border-green-500 bg-green-50 text-green-700">
                <CheckCircle2 className="h-4 w-4" />
                <AlertDescription>
                  Configuración actualizada correctamente
                </AlertDescription>
              </Alert>
            )}

            {/* Error message */}
            {state.error && (
              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>{state.error}</AlertDescription>
              </Alert>
            )}

            <div className="flex justify-end pt-4">
              <Button type="submit" disabled={isPending}>
                {isPending ? (
                  <>
                    <Spinner className="mr-2 h-4 w-4" />
                    Guardando...
                  </>
                ) : (
                  "Guardar cambios"
                )}
              </Button>
            </div>
          </CardContent>
        </Card>
      </form>
    </div>
  );
}
