"use client";

import { useEffect, useState, useActionState } from "react";
import {
  getStorageConfigAction,
  updateStorageConfigAction,
  testS3ConnectionAction,
} from "./actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Spinner } from "@/components/ui/spinner";
import {
  Database,
  HardDrive,
  Cloud,
  CheckCircle2,
  AlertCircle,
  TestTube,
} from "lucide-react";

const initialState = {
  success: false,
  error: "",
};

type StorageConfig = {
  storageType: "local" | "s3";
  s3Endpoint: string;
  s3Bucket: string;
  s3Region: string;
  s3AccessKey: string;
  s3SecretKey: string;
  s3PublicUrl: string;
  hasCredentials: boolean;
};

export default function StoragePage() {
  const [config, setConfig] = useState<StorageConfig | null>(null);
  const [storageType, setStorageType] = useState<"local" | "s3">("local");
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<{
    success: boolean;
    error?: string;
  } | null>(null);

  const [state, formAction, isPending] = useActionState(
    updateStorageConfigAction,
    initialState
  );

  useEffect(() => {
    getStorageConfigAction().then((data) => {
      setConfig(data);
      setStorageType(data.storageType);
    });
  }, []);

  const handleTestConnection = async () => {
    setTesting(true);
    setTestResult(null);
    const result = await testS3ConnectionAction();
    setTestResult(result);
    setTesting(false);
  };

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
        <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-green-500/10 text-green-500">
          <Database className="h-6 w-6" />
        </div>
        <div>
          <h1 className="text-2xl font-bold">Configuración de Almacenamiento</h1>
          <p className="text-muted-foreground">
            Gestiona dónde se almacenan los archivos multimedia
          </p>
        </div>
      </div>

      <form action={formAction}>
        <Card>
          <CardHeader>
            <CardTitle>Tipo de Almacenamiento</CardTitle>
            <CardDescription>
              Selecciona dónde se guardarán los archivos multimedia
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="space-y-2">
              <Label htmlFor="storageType">Tipo</Label>
              <Select
                name="storageType"
                value={storageType}
                onValueChange={(v) => setStorageType(v as "local" | "s3")}
                disabled={isPending}
              >
                <SelectTrigger className="max-w-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="local">
                    <div className="flex items-center gap-2">
                      <HardDrive className="h-4 w-4" />
                      <span>Almacenamiento Local</span>
                    </div>
                  </SelectItem>
                  <SelectItem value="s3">
                    <div className="flex items-center gap-2">
                      <Cloud className="h-4 w-4" />
                      <span>S3 Compatible</span>
                    </div>
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>

            {storageType === "local" && (
              <Alert>
                <HardDrive className="h-4 w-4" />
                <AlertDescription>
                  Los archivos se guardarán en{" "}
                  <code className="rounded bg-muted px-1.5 py-0.5 text-xs">
                    public/media/
                  </code>{" "}
                  en el servidor local.
                </AlertDescription>
              </Alert>
            )}

            {storageType === "s3" && (
              <div className="space-y-4 rounded-lg border p-4">
                <div className="flex items-center gap-2 text-sm font-medium">
                  <Cloud className="h-4 w-4" />
                  Configuración S3 Compatible
                </div>

                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="s3Endpoint">Endpoint URL *</Label>
                    <Input
                      id="s3Endpoint"
                      name="s3Endpoint"
                      placeholder="https://s3.us-west-001.backblazeb2.com"
                      defaultValue={config.s3Endpoint}
                      disabled={isPending}
                    />
                    <p className="text-xs text-muted-foreground">
                      URL del servicio S3 compatible
                    </p>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="s3Bucket">Bucket *</Label>
                    <Input
                      id="s3Bucket"
                      name="s3Bucket"
                      placeholder="mi-bucket"
                      defaultValue={config.s3Bucket}
                      disabled={isPending}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="s3Region">Región</Label>
                    <Input
                      id="s3Region"
                      name="s3Region"
                      placeholder="us-west-001"
                      defaultValue={config.s3Region}
                      disabled={isPending}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="s3PublicUrl">URL Pública (CDN)</Label>
                    <Input
                      id="s3PublicUrl"
                      name="s3PublicUrl"
                      placeholder="https://cdn.ejemplo.com"
                      defaultValue={config.s3PublicUrl}
                      disabled={isPending}
                    />
                    <p className="text-xs text-muted-foreground">
                      URL para servir archivos públicamente
                    </p>
                  </div>
                </div>

                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="s3AccessKey">Access Key ID</Label>
                    <Input
                      id="s3AccessKey"
                      name="s3AccessKey"
                      type="password"
                      placeholder={config.hasCredentials ? "********" : "Ingresa Access Key"}
                      defaultValue={config.hasCredentials ? "********" : ""}
                      disabled={isPending}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="s3SecretKey">Secret Access Key</Label>
                    <Input
                      id="s3SecretKey"
                      name="s3SecretKey"
                      type="password"
                      placeholder={config.hasCredentials ? "********" : "Ingresa Secret Key"}
                      defaultValue={config.hasCredentials ? "********" : ""}
                      disabled={isPending}
                    />
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={handleTestConnection}
                    disabled={testing || isPending}
                  >
                    {testing ? (
                      <>
                        <Spinner className="mr-2 h-4 w-4" />
                        Probando...
                      </>
                    ) : (
                      <>
                        <TestTube className="mr-2 h-4 w-4" />
                        Probar conexión
                      </>
                    )}
                  </Button>
                  {testResult && (
                    <span
                      className={`text-sm ${
                        testResult.success ? "text-green-600" : "text-red-600"
                      }`}
                    >
                      {testResult.success
                        ? "Conexión exitosa"
                        : testResult.error || "Error de conexión"}
                    </span>
                  )}
                </div>

                <Alert>
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription className="text-xs">
                    Compatible con: AWS S3, Backblaze B2, MinIO, DigitalOcean
                    Spaces, Cloudflare R2, Wasabi, etc.
                  </AlertDescription>
                </Alert>
              </div>
            )}

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
