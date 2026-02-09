declare module "phoenix" {
  export class Socket {
    constructor(endPoint: string, opts?: Record<string, unknown>);
    connect(): void;
    disconnect(callback?: () => void, code?: number, reason?: string): void;
    channel(topic: string, chanParams?: Record<string, unknown>): Channel;
    connectionState(): string;
    isConnected(): boolean;
    conn: WebSocket | null;
  }

  export class Channel {
    state: string;
    join(timeout?: number): Push;
    leave(timeout?: number): Push;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    on(event: string, callback: (payload: any) => void): number;
    off(event: string, ref?: number): void;
    push(event: string, payload: Record<string, unknown>, timeout?: number): Push;
    onClose(callback: () => void): void;
    onError(callback: (reason?: string) => void): void;
  }

  export class Push {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    receive(status: string, callback: (response: any) => void): Push;
  }
}
