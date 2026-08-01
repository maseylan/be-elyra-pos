import { Request, Response } from 'express';
import net from 'net';

const ALLOWED_HOSTS = new Set(['127.0.0.1', 'localhost', 'host.docker.internal']);
const DEFAULT_PORT = 9100;
const CONNECT_TIMEOUT = 5000;

export async function printRaw(req: Request, res: Response) {
  const { data, host = 'host.docker.internal', port = DEFAULT_PORT } = req.body || {};
  if (typeof data !== 'string' || !data) {
    return res.status(400).json({ error: 'data (base64 ESC/POS bytes) is required' });
  }
  if (!ALLOWED_HOSTS.has(host)) {
    return res.status(400).json({ error: 'host not allowed' });
  }
  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    return res.status(400).json({ error: 'invalid port' });
  }

  const buf = Buffer.from(data, 'base64');
  if (buf.length === 0) {
    return res.status(400).json({ error: 'empty payload' });
  }

  const socket = net.connect({ host, port });
  const timeout = setTimeout(() => socket.destroy(new Error('connect timeout')), CONNECT_TIMEOUT);

  socket.on('connect', () => {
    socket.write(buf);
    setTimeout(() => socket.end(), 200); // beri waktu printer memproses sebelum close
  });

  socket.on('error', (err) => {
    clearTimeout(timeout);
    if (!res.headersSent) {
      res.status(502).json({ error: `printer unreachable: ${err.message}` });
    }
  });

  socket.on('close', () => {
    clearTimeout(timeout);
    if (!res.headersSent) {
      res.json({ ok: true });
    }
  });
}
