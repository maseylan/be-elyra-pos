import { Request, Response } from 'express';
import net from 'net';

const FIXED_HOSTS = new Set(['127.0.0.1', 'localhost', 'host.docker.internal']);
const DEFAULT_PORT = 9100;
const CONNECT_TIMEOUT = 5000;

// Hanya izinkan host lokal/IP privat — blokir SSRF ke internet
function isAllowedHost(host: string): boolean {
  if (FIXED_HOSTS.has(host)) return true;
  const m = host.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/);
  if (!m) return false;
  const [a, b] = [Number(m[1]), Number(m[2])];
  return a === 127 || a === 10 || (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168);
}

export async function printRaw(req: Request, res: Response) {
  const { data, host = 'host.docker.internal', port = DEFAULT_PORT } = req.body || {};
  if (typeof data !== 'string' || !data) {
    return res.status(400).json({ error: 'data (base64 ESC/POS bytes) is required' });
  }
  if (typeof host !== 'string' || !isAllowedHost(host)) {
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
    setTimeout(() => {
      socket.end();
      clearTimeout(timeout);
      if (!res.headersSent) {
        res.json({ ok: true });
      }
    }, 200); // data sudah terkirim; jangan menunggu close (printer/emulator bisa menahan koneksi)
  });

  socket.on('error', (err) => {
    clearTimeout(timeout);
    if (!res.headersSent) {
      res.status(502).json({ error: `printer unreachable: ${err.message}` });
    }
  });

  socket.on('close', () => {
    clearTimeout(timeout);
  });
}
