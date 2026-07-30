const net = require('net');
const s = net.connect(587, 'smtp.titan.email', () => {
  console.log('connected');
  let b = '';
  s.on('data', (d) => {
    const t = d.toString();
    console.log('data:', JSON.stringify(t));
    b += t;
    if (b.includes('\n')) {
      const L = b.split('\n');
      b = L.pop() || '';
      for (const l of L) {
        const c = l.trim();
        console.log('S:', c);
        if (/^220/.test(c)) { s.write('EHLO test\r\n'); }
      }
    }
  });
});
s.on('error', (e) => console.log('error:', e.message));
setTimeout(() => { console.log('timeout'); s.destroy(); process.exit(); }, 8000);
