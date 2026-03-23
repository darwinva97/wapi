"use client";

import { useState, useEffect } from "react";
import { testSenderAction, testReceiverAction } from "./test-actions";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Copy, Check } from "lucide-react";

interface Connection {
  id: string;
  senderEnabled: boolean;
  senderToken: string | null;
  receiverEnabled: boolean;
}

interface TestConnectionProps {
  connection: Connection;
  whatsappSlug: string;
  connectionSlug: string;
}

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    await navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <Button variant="ghost" size="icon" className="h-6 w-6" onClick={handleCopy}>
      {copied ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
    </Button>
  );
}

export function TestConnection({ connection, whatsappSlug, connectionSlug }: TestConnectionProps) {
  const [senderTo, setSenderTo] = useState("");
  const [senderMsg, setSenderMsg] = useState("Hola desde WAPI!");
  const [senderLoading, setSenderLoading] = useState(false);
  const [senderResult, setSenderResult] = useState<{ success: boolean; message?: string; error?: string } | null>(null);

  const [receiverLoading, setReceiverLoading] = useState(false);
  const [receiverResult, setReceiverResult] = useState<{ success: boolean; status?: number; response?: string; error?: string } | null>(null);

  const [baseUrl, setBaseUrl] = useState('');

  useEffect(() => {
    setBaseUrl(window.location.origin);
  }, []);

  const senderEndpoint = `${baseUrl}/api/${whatsappSlug}/${connectionSlug}/sender`;

  const curlExample = `curl -X POST "${senderEndpoint}" \\
  -H "Content-Type: application/json" \\
  -H "Authorization: Bearer ${connection.senderToken || 'TU_TOKEN'}" \\
  -d '{
    "to": "51999999999",
    "message": { "text": "Hola desde WAPI!" }
  }'`;

  const fetchExample = `fetch("${senderEndpoint}", {
  method: "POST",
  headers: {
    "Content-Type": "application/json",
    "Authorization": "Bearer ${connection.senderToken || 'TU_TOKEN'}"
  },
  body: JSON.stringify({
    to: "51999999999",
    message: { text: "Hola desde WAPI!" }
  })
});`;

  const axiosExample = `axios.post("${senderEndpoint}", {
  to: "51999999999",
  message: { text: "Hola desde WAPI!" }
}, {
  headers: {
    "Content-Type": "application/json",
    "Authorization": "Bearer ${connection.senderToken || 'TU_TOKEN'}"
  }
});`;

  async function handleTestSender(e: React.FormEvent) {
    e.preventDefault();
    setSenderLoading(true);
    setSenderResult(null);
    try {
      const result = await testSenderAction(connection.id, senderTo, senderMsg);
      setSenderResult(result);
    } catch {
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
    } catch {
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

            <Separator className="my-6" />

            <div className="space-y-3">
              <h4 className="text-sm font-medium">Ejemplo de Petición HTTP</h4>
              <p className="text-sm text-muted-foreground">
                Usa esta petición desde tu aplicación para enviar mensajes vía WhatsApp.
              </p>
              
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-medium">Endpoint:</span>
                  <code className="text-xs bg-muted px-2 py-1 rounded flex-1 break-all">{senderEndpoint}</code>
                  <CopyButton text={senderEndpoint} />
                </div>
              </div>

              <Tabs defaultValue="curl" className="w-full">
                <TabsList className="grid w-full grid-cols-3">
                  <TabsTrigger value="curl">cURL</TabsTrigger>
                  <TabsTrigger value="fetch">Fetch</TabsTrigger>
                  <TabsTrigger value="axios">Axios</TabsTrigger>
                </TabsList>
                <TabsContent value="curl" className="relative">
                  <pre className="text-xs font-mono bg-muted p-4 rounded overflow-x-auto whitespace-pre-wrap">{curlExample}</pre>
                  <div className="absolute top-2 right-2">
                    <CopyButton text={curlExample} />
                  </div>
                </TabsContent>
                <TabsContent value="fetch" className="relative">
                  <pre className="text-xs font-mono bg-muted p-4 rounded overflow-x-auto whitespace-pre-wrap">{fetchExample}</pre>
                  <div className="absolute top-2 right-2">
                    <CopyButton text={fetchExample} />
                  </div>
                </TabsContent>
                <TabsContent value="axios" className="relative">
                  <pre className="text-xs font-mono bg-muted p-4 rounded overflow-x-auto whitespace-pre-wrap">{axiosExample}</pre>
                  <div className="absolute top-2 right-2">
                    <CopyButton text={axiosExample} />
                  </div>
                </TabsContent>
              </Tabs>

              <Alert>
                <AlertTitle>Formato del mensaje</AlertTitle>
                <AlertDescription className="space-y-2">
                  <p>El campo <code className="text-xs bg-muted px-1 rounded">message</code> acepta el formato de Baileys. Ejemplos:</p>
                  <ul className="list-disc list-inside text-xs space-y-1 mt-2">
                    <li><code className="bg-muted px-1 rounded">{`{ "text": "Hola mundo" }`}</code> - Texto simple</li>
                    <li><code className="bg-muted px-1 rounded">{`{ "image": { "url": "https://..." }, "caption": "Mi imagen" }`}</code> - Imagen</li>
                    <li><code className="bg-muted px-1 rounded">{`{ "document": { "url": "https://..." }, "fileName": "doc.pdf" }`}</code> - Documento</li>
                  </ul>
                </AlertDescription>
              </Alert>
            </div>
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
