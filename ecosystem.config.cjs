module.exports = {
  apps: [{
    name: 'quickrefurbz',
    script: 'dist/server.js',
    cwd: '/var/www/quickwms/QuickRefurbz',
    node_args: '--experimental-specifier-resolution=node',
    instances: 1,
    autorestart: true,
    watch: false,
    max_memory_restart: '500M',
    env: {
      NODE_ENV: 'production',
      PORT: 3004,
      DB_TYPE: 'postgres',
      PGHOST: 'localhost',
      PGPORT: 5432,
      PGDATABASE: 'quickwms',
      PGUSER: 'postgres',
      PGPASSWORD: 'your_password_here', // Update with actual password
      JWT_SECRET: 'quickrefurbz-production-secret-change-me'
    },
    env_development: {
      NODE_ENV: 'development',
      DB_TYPE: 'sqlite',
      PORT: 3004
    }
  }]
};
