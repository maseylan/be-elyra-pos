module.exports = {
  apps: [{
    name: 'pos-api',
    script: './dist/server.js', // Harus menunjuk ke file hasil kompilasi tsc
    instances: process.env.PM2_INSTANCES || 'max', // Memaksimalkan seluruh Core CPU
    exec_mode: 'cluster',
    env: { 
      NODE_ENV: 'production' 
    },
    max_memory_restart: '500M', // Auto-restart worker jika ada kebocoran memori (memory leak)
    out_file: './logs/out.log',
    error_file: './logs/error.log',
    merge_logs: true,
    time: true,
  }],
};
