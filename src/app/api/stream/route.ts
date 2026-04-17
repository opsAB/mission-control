import { subscribe, type McEvent } from '@/lib/events';

export const dynamic = 'force-dynamic';

export async function GET() {
  const stream = new ReadableStream({
    start(controller) {
      const enc = new TextEncoder();
      const send = (event: McEvent) => {
        try {
          controller.enqueue(enc.encode(`event: ${event.type}\ndata: ${JSON.stringify(event)}\n\n`));
        } catch {
          // client gone
        }
      };
      // initial hello
      send({ type: 'heartbeat', ts: Date.now() });
      const unsub = subscribe(send);
      const closed = () => { unsub(); try { controller.close(); } catch {} };
      // close on abort
      return closed;
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      'Connection': 'keep-alive',
      'X-Accel-Buffering': 'no',
    },
  });
}
