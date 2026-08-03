import { Request, Response } from 'express';
import net from 'net';
import * as printService from '../services/print.service';
import * as outletSettingsService from '../services/outlet-settings.service';

const DEFAULT_PORT = 9100;
const CONNECT_TIMEOUT = 5000;

export async function printRaw(req: Request, res: Response) {
  const { data } = req.body || {};
  if (typeof data !== 'string' || !data) {
    return res.status(400).json({ error: 'data (base64 ESC/POS bytes) is required' });
  }
  const settings = await outletSettingsService.resolveEffectiveSettings(req.outletId!);
  const host = settings.printerHost;
  const port = Number(settings.printerPort || DEFAULT_PORT);
  if (!host) return res.status(400).json({ error: 'Printer belum dikonfigurasi untuk outlet ini' });

  const buf = Buffer.from(data, 'base64');
  if (buf.length === 0) {
    return res.status(400).json({ error: 'empty payload' });
  }
  if (buf.length > 1024 * 1024) return res.status(413).json({ error: 'print payload too large' });

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

export async function getQzCertificate(req: Request, res: Response) {
  try {
    const cert = await printService.getQzCertificate();
    res.type('text/plain').send(cert);
  } catch (err: any) {
    res.status(500).json({ error: err?.message || 'Failed to get QZ certificate' });
  }
}

export async function signQzRequest(req: Request, res: Response) {
  try {
    const toSign = req.body?.request || req.query?.request;
    if (!toSign || typeof toSign !== 'string') {
      return res.status(400).json({ error: 'request parameter is required for QZ Tray signing' });
    }
    if (toSign.length > 51200) {
      return res.status(413).json({ error: 'request string payload too large for signing' });
    }
    const signature = await printService.signQzRequest(toSign);
    res.type('text/plain').send(signature);
  } catch (err: any) {
    res.status(500).json({ error: err?.message || 'Failed to sign QZ Tray request' });
  }
}
