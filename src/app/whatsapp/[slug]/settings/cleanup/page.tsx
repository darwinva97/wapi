"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { getCleanupConfigAction, updateCleanupConfigAction } from "./actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
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
import { Trash2, CheckCircle2, AlertCircle, AlertTriangle } from "lucide-react";

type CleanupConfig = {
  cleanupEnabled: boolean;
  cleanupDays: number;
  excludeChats: string[];
  includeOnlyChats: string[];
  forceCleanup: boolean;
  maxAgentRetentionDays: number;
};

export default function CleanupConfigPage() {
  const params = useParams();
  const slug = params.slug as string;

  const [config, setConfig] = useState<CleanupConfig | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [result, setResult] = useState<{
    success: boolean;
    error?: string;
  } | null>(null);

  useEffect(() => {
    getCleanupConfigAction(slug)
      .then(setConfig)
      .finally(() => setLoading(false));
  }, [slug]);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setSaving(true);
    setResult(null);

    const formData = new FormData(e.currentTarget);
    const res = await updateCleanupConfigAction(slug, formData);
    setResult(res);
    setSaving(false);
  };

  if (loading || !config) {
    return (
      <div className="flex items-center justify-center p-12">
        <Spinner className="h-8 w-8" />
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center gap-4">
        <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-red-500/10 text-red-500">
          <Trash2 className="h-6 w-6" />
        </div>
        <div>
          <h1 className="text-2xl font-bold">Limpieza de Archivos</h1>
          <p className="text-muted-foreground">
            Configura la eliminación automática de archivos multimedia
          </p>
        </div>
      </div>

      <form onSubmit={handleSubmit}>
        <div className="space-y-6">
          {/* Enable/Disable */}
          <Card>
            <CardHeader>
              <CardTitle>Limpieza Automática</CardTitle>
              <CardDescription>
                Elimina automáticamente los archivos multimedia antiguos
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between rounded-lg border p-4">
                <div className="space-y-0.5">
                  <Label htmlFor="cleanupEnabled" className="text-base">
                    Habilitar limpieza automática
                  </Label>
                  <p className="text-sm text-muted-foreground">
                    Los archivos se eliminarán según la configuración
                  </p>
                </div>
                <Switch
                  id="cleanupEnabled"
                  name="cleanupEnabled"
                  defaultChecked={config.cleanupEnabled}
                  disabled={saving}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="cleanupDays">
                  Eliminar archivos más antiguos de (días)
                </Label>
                <Input
                  id="cleanupDays"
                  name="cleanupDays"
                  type="number"
                  min="1"
                  max="365"
                  defaultValue={config.cleanupDays}
                  disabled={saving}
                  className="max-w-xs"
                />
              </div>
            </CardContent>
          </Card>

          {/* Force Cleanup */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <AlertTriangle className="h-5 w-5 text-orange-500" />
                Limpieza Forzada
              </CardTitle>
              <CardDescription>
                Ignora las retenciones individuales configuradas por usuarios
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex items-center justify-between rounded-lg border border-orange-200 bg-orange-50 p-4">
                <div className="space-y-0.5">
                  <Label htmlFor="forceCleanup" className="text-base">
                    Forzar limpieza
                  </Label>
                  <p className="text-sm text-muted-foreground">
                    Elimina archivos aunque tengan retención configurada
                  </p>
                </div>
                <Switch
                  id="forceCleanup"
                  name="forceCleanup"
                  defaultChecked={config.forceCleanup}
                  disabled={saving}
                />
              </div>
            </CardContent>
          </Card>

          {/* Agent Retention Limit */}
          <Card>
            <CardHeader>
              <CardTitle>Límite de Retención para Agentes</CardTitle>
              <CardDescription>
                Máximo de días que un agente puede configurar retención en un
                mensaje
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                <Label htmlFor="maxAgentRetentionDays">Días máximos</Label>
                <Input
                  id="maxAgentRetentionDays"
                  name="maxAgentRetentionDays"
                  type="number"
                  min="1"
                  max="365"
                  defaultValue={config.maxAgentRetentionDays}
                  disabled={saving}
                  className="max-w-xs"
                />
                <p className="text-sm text-muted-foreground">
                  Managers y owners no tienen este límite
                </p>
              </div>
            </CardContent>
          </Card>

          {/* Chat Filters */}
          <Card>
            <CardHeader>
              <CardTitle>Filtros de Chats</CardTitle>
              <CardDescription>
                Define qué chats incluir o excluir de la limpieza
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="excludeChats">
                  Excluir chats (uno por línea)
                </Label>
                <Textarea
                  id="excludeChats"
                  name="excludeChats"
                  rows={3}
                  placeholder="123456789@s.whatsapp.net&#10;grupo123@g.us"
                  defaultValue={config.excludeChats.join("\n")}
                  disabled={saving}
                />
                <p className="text-sm text-muted-foreground">
                  IDs de chats que NO serán limpiados
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="includeOnlyChats">
                  Incluir SOLO estos chats (uno por línea)
                </Label>
                <Textarea
                  id="includeOnlyChats"
                  name="includeOnlyChats"
                  rows={3}
                  placeholder="Dejar vacío para limpiar todos los chats"
                  defaultValue={config.includeOnlyChats.join("\n")}
                  disabled={saving}
                />
                <p className="text-sm text-muted-foreground">
                  Si no está vacío, SOLO estos chats serán limpiados
                </p>
              </div>
            </CardContent>
          </Card>

          {/* Success/Error messages */}
          {result?.success && (
            <Alert className="border-green-500 bg-green-50 text-green-700">
              <CheckCircle2 className="h-4 w-4" />
              <AlertDescription>
                Configuración guardada correctamente
              </AlertDescription>
            </Alert>
          )}

          {result?.error && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>{result.error}</AlertDescription>
            </Alert>
          )}

          <div className="flex justify-end">
            <Button type="submit" disabled={saving}>
              {saving ? (
                <>
                  <Spinner className="mr-2 h-4 w-4" />
                  Guardando...
                </>
              ) : (
                "Guardar configuración"
              )}
            </Button>
          </div>
        </div>
      </form>
    </div>
  );
}
