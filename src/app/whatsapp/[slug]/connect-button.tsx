"use client";

import { useState, useEffect } from "react";
import { createPortal } from "react-dom";
import { connectWhatsappAction, disconnectWhatsappAction } from "./actions";
import { QRCodeSVG } from "qrcode.react";
import { useRouter } from "next/navigation";

export function ConnectButton({ id, isConnected }: { id: string, isConnected: boolean }) {
  const [loading, setLoading] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [qrCode, setQrCode] = useState<string | null>(null);
  const [status, setStatus] = useState<string>("idle");
  const [mounted, setMounted] = useState(false);
  const router = useRouter();

  useEffect(() => {
    setMounted(true);
  }, []);

  async function handleConnect() {
    setLoading(true);
    setShowModal(true);
    setStatus("initializing");
    try {
      await connectWhatsappAction(id);
    } catch (error) {
      console.error(error);
      alert("Error al iniciar conexión");
      setLoading(false);
      setShowModal(false);
    }
  }

  async function handleDisconnect() {
    if (!confirm("¿Estás seguro de que quieres desconectar?")) return;
    setLoading(true);
    try {
      await disconnectWhatsappAction(id);
      router.refresh();
    } catch (error) {
      console.error(error);
      alert("Error al desconectar");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (!showModal) return;

    const eventSource = new EventSource(`/api/whatsapp/${id}/qr`);

    eventSource.onmessage = (event) => {
      const data = JSON.parse(event.data);
      if (data.type === "qr") {
        setQrCode(data.qr);
        setStatus("scan_qr");
      } else if (data.type === "status") {
        if (data.status === "open") {
          setStatus("connected");
          eventSource.close();
          setTimeout(() => {
            setShowModal(false);
            router.refresh();
          }, 1000);
        } else if (data.status === "connecting") {
          setStatus("connecting");
        }
      }
    };

    eventSource.onerror = (err) => {
      console.error("SSE Error:", err);
    };

    return () => {
      eventSource.close();
    };
  }, [showModal, id, router]);

  const modalContent = showModal ? (
    <div className="fixed inset-0 z-9999 overflow-y-auto" aria-labelledby="modal-title" role="dialog" aria-modal="true">
      <div className="flex items-end justify-center min-h-screen pt-4 px-4 pb-20 text-center sm:block sm:p-0">
        <div className="fixed inset-0 bg-gray-500 bg-opacity-75 transition-opacity" aria-hidden="true" onClick={() => setShowModal(false)}></div>

        <span className="hidden sm:inline-block sm:align-middle sm:h-screen" aria-hidden="true">&#8203;</span>

        <div className="inline-block align-bottom bg-white rounded-lg px-4 pt-5 pb-4 text-left overflow-hidden shadow-xl transform transition-all sm:my-8 sm:align-middle sm:max-w-sm sm:w-full sm:p-6 relative">
          <button
            onClick={() => setShowModal(false)}
            className="absolute top-2 right-2 text-gray-400 hover:text-gray-500"
          >
            <span className="sr-only">Cerrar</span>
            <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
          
          <div>
            <div className="mx-auto flex items-center justify-center h-12 w-12 rounded-full bg-green-100">
              <svg className="h-6 w-6 text-green-600" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v1m6 11h2m-6 0h-2v4m0-11v3m0 0h.01M12 12h4.01M16 20h4M4 12h4m12 0h.01M5 8h2a1 1 0 001-1V5a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1zm12 0h2a1 1 0 001-1V5a1 1 0 00-1-1h-2a1 1 0 00-1 1v2a1 1 0 001 1zM5 20h2a1 1 0 001-1v-2a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1z" />
              </svg>
            </div>
            <div className="mt-3 text-center sm:mt-5">
              <h3 className="text-lg leading-6 font-medium text-gray-900" id="modal-title">
                Escanear código QR
              </h3>
              <div className="mt-4 flex justify-center min-h-[256px] items-center bg-gray-50 rounded-lg p-4 relative">
                {status === "initializing" && (
                  <div className="flex flex-col items-center">
                    <svg className="animate-spin h-8 w-8 text-green-600 mb-2" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    <p className="text-sm text-gray-500">Iniciando sesión...</p>
                  </div>
                )}
                {(status === "scan_qr" || status === "connecting") && qrCode && (
                  <div className={`p-2 bg-white shadow-sm rounded transition-opacity duration-300 ${status === "connecting" ? "opacity-20" : "opacity-100"}`}>
                    <QRCodeSVG value={qrCode} size={256} />
                  </div>
                )}
                {status === "connecting" && (
                  <div className="absolute inset-0 flex flex-col items-center justify-center">
                     <svg className="animate-spin h-10 w-10 text-green-600 mb-2" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    <p className="text-sm font-medium text-gray-700 bg-white/80 px-2 py-1 rounded">Conectando...</p>
                  </div>
                )}
                {status === "connected" && (
                  <div className="flex flex-col items-center text-green-600">
                    <svg className="h-16 w-16 mb-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                    <p className="font-medium">¡Conectado exitosamente!</p>
                  </div>
                )}
              </div>
              <p className="mt-2 text-sm text-gray-500">
                Abre WhatsApp en tu teléfono y escanea el código para conectar.
              </p>
            </div>
          </div>
          <div className="mt-5 sm:mt-6">
            <button
              type="button"
              className="inline-flex justify-center w-full rounded-md border border-transparent shadow-sm px-4 py-2 bg-gray-600 text-base font-medium text-white hover:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-gray-500 sm:text-sm"
              onClick={() => {
                setShowModal(false);
                setLoading(false);
              }}
            >
              Cerrar
            </button>
          </div>
        </div>
      </div>
    </div>
  ) : null;

  if (isConnected) {
    return (
      <button
        onClick={handleDisconnect}
        disabled={loading}
        className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-red-600 hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500 disabled:opacity-50"
      >
        {loading ? "Cargando..." : "Desconectar"}
      </button>
    );
  }

  return (
    <>
      <button
        onClick={handleConnect}
        disabled={loading}
        className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-green-600 hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500 disabled:opacity-50"
      >
        {loading ? "Conectando..." : "Conectar WhatsApp"}
      </button>

      {mounted && createPortal(modalContent, document.body)}
    </>
  );
}
