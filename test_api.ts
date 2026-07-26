import jwt from 'jsonwebtoken';
import fetch from 'node-fetch'; // or use http
import http from 'http';

const token = jwt.sign(
  { 
    tenantId: 'tenant_1783939052669_wxjqk', 
    subdomain: 'test',
    role: 'owner' 
  }, 
  'secret-key-123', 
  { expiresIn: '24h' }
);

const options = {
  hostname: 'localhost',
  port: 3000,
  path: '/api/accounts',
  method: 'GET',
  headers: {
    'Authorization': `Bearer ${token}`
  }
};

const req = http.request(options, res => {
  let data = '';
  res.on('data', chunk => data += chunk);
  res.on('end', () => console.log('Response:', res.statusCode, data));
});

req.on('error', e => console.error(e));
req.end();
