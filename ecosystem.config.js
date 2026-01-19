module.exports = {
  apps: [
    {
      name: 'everything-backend',
      script: './dist/app.js', // 프로덕션: 빌드된 파일
      // script: 'npm', // 개발: ts-node 사용
      // args: 'run start:dev', // 개발 모드 args
      instances: 1,
      exec_mode: 'cluster',
      watch: false, // 프로덕션에서는 watch 비활성화
      max_memory_restart: '1G',
      env: {
        NODE_ENV: 'production',
        PORT: 3001,
      },
      env_development: {
        NODE_ENV: 'development',
        PORT: 3001,
      },
      error_file: './logs/err.log',
      out_file: './logs/out.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
      merge_logs: true,
      autorestart: true,
      max_restarts: 10,
      min_uptime: '10s',
      listen_timeout: 3000,
      kill_timeout: 5000,
    },
  ],

  deploy: {
    production: {
      user: 'ubuntu', // EC2 사용자명
      host: 'YOUR_EC2_IP', // EC2 IP 주소
      ref: 'origin/main',
      repo: 'git@github.com:ModawnAI/everything_backend.git',
      path: '/home/ubuntu/everything_backend', // EC2 배포 경로
      'post-deploy': 'npm install && npm run build && pm2 reload ecosystem.config.js --env production',
      'pre-setup': 'mkdir -p logs',
    },
  },
};
