const tls = require('tls');
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
        const a = Buffer.concat([Buffer.from([0]), Buffer.from('info@elyrapos.my.id'), Buffer.from([0]), Buffer.from('@Rafli578')]).toString('base64');
        console.log('C:', a);
        w('AUTH PLAIN ' + a);
      } else if (/^235/.test(c)) { console.log('OK'); process.exit(); }
      else if (/^535/.test(c)) { console.log('ERR:', c); process.exit(); }
    }
  });
});
setTimeout(() => { console.log('timeout'); process.exit(1); }, 20000);
