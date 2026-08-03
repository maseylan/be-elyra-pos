const tls = require('tls');
const { SMTP_USER, SMTP_PASS } = process.env;
if (!SMTP_USER || !SMTP_PASS) throw new Error('SMTP_USER and SMTP_PASS are required');
const s = tls.connect(465, 'smtp.titan.email', () => {
  console.log('tls connected');
  let b = '';
  const w = (x) => s.write(x + '\r\n');
  s.on('data', (d) => {
    b += d.toString();
    const L = b.split('\n');
    b = L.pop() || '';
    for (const l of L) {
      const c = l.trim();
      console.log('S:', c);
      if (/^220/.test(c)) w('EHLO test');
      else if (c.includes('AUTH')) {
        const a = Buffer.concat([Buffer.from([0]), Buffer.from(SMTP_USER), Buffer.from([0]), Buffer.from(SMTP_PASS)]).toString('base64');
        w('AUTH PLAIN ' + a);
      } else if (/^235/.test(c)) { console.log('OK'); process.exit(); }
      else if (/^535/.test(c)) { console.log('ERR:', c); process.exit(); }
    }
  });
});
setTimeout(() => { console.log('timeout'); process.exit(1); }, 20000);
