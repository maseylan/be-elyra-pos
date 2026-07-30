require('dotenv').config();
const nodemailer = require('nodemailer');

async function main() {
  const configs = [
    { host: 'smtp.titan.email', port: 465, secure: true },
    { host: 'smtp.titan.email', port: 587, secure: false, requireTLS: true },
  ];
  for (const cfg of configs) {
    try {
      const t = nodemailer.createTransport({ ...cfg, auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS }, timeout: 10000 });
      await t.verify();
      console.log('OK:', cfg.host, cfg.port);
    } catch (e) {
      console.log('FAIL:', cfg.host, cfg.port, '-', e.message, e.response || '');
    }
  }
}
main();
