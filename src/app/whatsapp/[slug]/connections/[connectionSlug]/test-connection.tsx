"use client";

import { useState } from "react";
import { testSenderAction, testReceiverAction } from "./test-actions";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Separator } from "@/components/ui/separator";

interface Connection {
  id: string;
  senderEnabled: boolean;
  receiverEnabled: boolean;
}

export function TestConnection({ connection }: { connection: Connection }) {
  const [senderTo, setSenderTo] = useState("");
  const [senderMsg, setSenderMsg] = useState("Hola desde WAPI!");
  const [senderLoading, setSenderLoading] = useState(false);
  const [senderResult, setSenderResult] = useState<any>(null);

  const [receiverLoading, setReceiverLoading] = useState(false);
  const [receiverResult, setReceiverResult] = useState<any>(null);

  async function handleTestSender(e: React.FormEvent) {
    e.preventDefault();
    setSenderLoading(true);
    setSenderResult(null);
    try {
      const result = await testSenderAction(connection.id, senderTo, senderMsg);
      setSenderResult(result);
    } catch (err) {
      setSenderResult({ success: false, error: "Unexpected error" });
    } finally {
      setSenderLoading(false);
    }
  }

  async function handleTestReceiver() {
    setReceiverLoading(true);
    setReceiverResult(null);
    try {
      const result = await testReceiverAction(connection.id);
      setReceiverResult(result);
    } catch (err) {
      setReceiverResult({ success: false, error: "Unexpected error" });
    } finally {
      setReceiverLoading(false);
    }
  }

  if (!connection.senderEnabled && !connection.receiverEnabled) {
    return null;
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Pruebas de Conexión</CardTitle>
        <CardDescription>
          Verifica que tu configuración funcione correctamente.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-8">
        
        {connection.senderEnabled && (
          <div className="space-y-4">
            <h4 className="text-sm font-medium">Probar Sender</h4>
            <form onSubmit={handleTestSender} className="space-y-4 max-w-lg">
              <div className="grid w-full max-w-sm items-center gap-1.5">
                <Label htmlFor="to">Número de destino</Label>
                <Input
                  type="text"
                  id="to"
                  value={senderTo}
                  onChange={(e) => setSenderTo(e.target.value)}
                  placeholder="Ej: 51999999999"
                  required
                />
              </div>
              <div className="grid w-full gap-1.5">
                <Label htmlFor="message">Mensaje</Label>
                <Textarea
                  id="message"
                  value={senderMsg}
                  onChange={(e) => setSenderMsg(e.target.value)}
                  required
                  rows={2}
                />
              </div>
              <Button
                type="submit"
                disabled={senderLoading}
              >
                {senderLoading ? "Enviando..." : "Enviar Mensaje de Prueba"}
              </Button>
              
              {senderResult && (
                <Alert variant={senderResult.success ? "default" : "destructive"}>
                  <AlertTitle>{senderResult.success ? "Éxito" : "Error"}</AlertTitle>
                  <AlertDescription>
                    {senderResult.success ? senderResult.message : `Error: ${senderResult.error}`}
                  </AlertDescription>
                </Alert>
              )}
            </form>
          </div>
        )}

        {connection.senderEnabled && connection.receiverEnabled && <Separator />}

        {connection.receiverEnabled && (
          <div className="space-y-4">
            <h4 className="text-sm font-medium">Probar Receiver</h4>
            <p className="text-sm">
              Se enviará un evento simulado (mock) a la URL configurada para verificar que responde correctamente.
            </p>
            <Button
              onClick={handleTestReceiver}
              disabled={receiverLoading}
              variant="secondary"
            >
              {receiverLoading ? "Probando..." : "Simular Evento Webhook"}
            </Button>

            {receiverResult && (
              <Alert variant={receiverResult.success ? "default" : "destructive"}>
                <AlertTitle>Status: {receiverResult.status}</AlertTitle>
                <AlertDescription className="font-mono text-xs mt-2 max-h-40 overflow-auto">
                  {receiverResult.response || receiverResult.error}
                </AlertDescription>
              </Alert>
            )}
          </div>
        )}

      </CardContent>
    </Card>
  );
}
