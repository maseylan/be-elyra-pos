module.exports = {
  apps: [{
    name: 'pos-api',
    script: process.env.NODE_ENV === 'production' ? './dist/server.js' : './src/server.ts',
    interpreter: process.env.NODE_ENV === 'production' ? 'node' : './node_modules/.bin/tsx',
    instances: process.env.NODE_ENV === 'production' ? (process.env.PM2_INSTANCES || 'max') : 1,
    exec_mode: process.env.NODE_ENV === 'production' ? 'cluster' : 'fork',
    watch: process.env.NODE_ENV === 'production' ? false : ['src'],
    ignore_watch: ['node_modules', 'logs', 'drizzle'],
    env: { 
      NODE_ENV: 'development' 
    },
    env_production: {
      NODE_ENV: 'production'
    },
    max_memory_restart: '500M',
    out_file: './logs/out.log',
    error_file: './logs/error.log',
    merge_logs: true,
    time: true,
  }],
};
