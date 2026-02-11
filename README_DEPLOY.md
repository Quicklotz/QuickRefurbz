# QuickRefurbz Deployment Guide

This document provides a 10-minute setup checklist for deploying QuickRefurbz to the Hetzner VPS.

## Prerequisites

- GitHub repository: `https://github.com/Quicklotz/QuickRefurbz`
- Hetzner VPS with SSH access
- Domain: `quickrefurbz.com` (DNS configured to point to VPS)

## GitHub Secrets Configuration

The following secrets must be configured in the GitHub repository settings (Settings → Secrets and variables → Actions):

### Required Secrets (Quicklotz Organization)

Since this is a Quicklotz repository, it uses the shared organization secrets:

- `HETZNER_QL_HOST` - Server IP or hostname
- `HETZNER_QL_USER` - SSH user (typically `deploy`)
- `HETZNER_QL_SSH_KEY` - Private SSH key for authentication
- `HETZNER_QL_PORT` - SSH port (optional, defaults to 22)

### Optional Repository-Specific Secrets

These can override defaults for this specific application:

- `APP_DIR` - Deployment directory (default: `/var/www/quickrefurbz`)
- `SERVICE_NAME` - systemd service name (default: `quickrefurbz`)
- `NODE_VERSION` - Node.js version (default: 20)

## VPS Bootstrap (One-Time Setup)

Run these commands on the Hetzner VPS as root or sudo user:

### 1. Create Deploy User

```bash
# Create deploy user with sudo access for systemctl
useradd -m -s /bin/bash deploy
usermod -aG sudo deploy

# Allow deploy user to restart services without password
echo "deploy ALL=(ALL) NOPASSWD: /bin/systemctl restart quickrefurbz, /bin/systemctl status quickrefurbz, /bin/systemctl stop quickrefurbz, /bin/systemctl start quickrefurbz" | sudo tee /etc/sudoers.d/quickrefurbz
chmod 0440 /etc/sudoers.d/quickrefurbz
```

### 2. Setup SSH Key Authentication

```bash
# Switch to deploy user
su - deploy

# Create .ssh directory
mkdir -p ~/.ssh
chmod 700 ~/.ssh

# Add your public key (the one matching HETZNER_QL_SSH_KEY)
nano ~/.ssh/authorized_keys
# Paste the public key, save and exit

chmod 600 ~/.ssh/authorized_keys
exit
```

### 3. Create Application Directory

```bash
# Create app directory with proper permissions
sudo mkdir -p /var/www/quickrefurbz
sudo chown -R deploy:deploy /var/www/quickrefurbz
```

### 4. Install Node.js

```bash
# Install Node.js 20 (LTS)
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt-get install -y nodejs

# Verify installation
node --version
npm --version
```

### 5. Install PostgreSQL

```bash
# Install PostgreSQL
sudo apt-get update
sudo apt-get install -y postgresql postgresql-contrib

# Start and enable PostgreSQL
sudo systemctl start postgresql
sudo systemctl enable postgresql

# Create database and user
sudo -u postgres psql <<EOF
CREATE DATABASE quickrefurbz;
CREATE USER quickrefurbz WITH ENCRYPTED PASSWORD 'your_secure_password_here';
GRANT ALL PRIVILEGES ON DATABASE quickrefurbz TO quickrefurbz;
\q
EOF
```

### 6. Configure Environment Variables

```bash
# Create .env file
sudo -u deploy nano /var/www/quickrefurbz/.env
```

Paste the following (update with actual values):

```env
# QuickRefurbz Production Configuration

# Database Configuration
DB_TYPE=postgres
PGHOST=localhost
PGPORT=5432
PGDATABASE=quickrefurbz
PGUSER=quickrefurbz
PGPASSWORD=your_secure_password_here

# Server Configuration
PORT=3001
NODE_ENV=production

# JWT Secret (generate with: openssl rand -base64 32)
JWT_SECRET=your_random_jwt_secret_here

# Data directory
DATA_DIR=/var/www/quickrefurbz/data

# SendGrid Email Configuration
SENDGRID_API_KEY=your_sendgrid_api_key_here
EMAIL_FROM=noreply@quicklotzwms.com
APP_URL=https://quickrefurbz.com
```

### 7. Setup systemd Service

```bash
# Copy the service template
sudo cp /var/www/quickrefurbz/deploy/systemd.service.template /etc/systemd/system/quickrefurbz.service

# Reload systemd
sudo systemctl daemon-reload

# Enable service to start on boot
sudo systemctl enable quickrefurbz
```

### 8. Configure Nginx

```bash
# Create Nginx configuration
sudo nano /etc/nginx/sites-available/quickrefurbz.com
```

Paste the following:

```nginx
server {
    listen 80;
    listen [::]:80;
    server_name quickrefurbz.com www.quickrefurbz.com;

    # Redirect HTTP to HTTPS
    return 301 https://$server_name$request_uri;
}

server {
    listen 443 ssl http2;
    listen [::]:443 ssl http2;
    server_name quickrefurbz.com www.quickrefurbz.com;

    # SSL certificates (managed by certbot)
    ssl_certificate /etc/letsencrypt/live/quickrefurbz.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/quickrefurbz.com/privkey.pem;
    include /etc/letsencrypt/options-ssl-nginx.conf;
    ssl_dhparam /etc/letsencrypt/ssl-dhparams.pem;

    # Security headers
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header X-XSS-Protection "1; mode=block" always;
    add_header Referrer-Policy "no-referrer-when-downgrade" always;

    # Logs
    access_log /var/log/nginx/quickrefurbz.access.log;
    error_log /var/log/nginx/quickrefurbz.error.log;

    # Serve static frontend files
    location / {
        root /var/www/quickrefurbz/frontend/dist;
        try_files $uri $uri/ /index.html;
    }

    # Proxy API requests to Node.js backend
    location /api/ {
        proxy_pass http://localhost:3001;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }

    # WebSocket support (if needed)
    location /ws {
        proxy_pass http://localhost:3001;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "Upgrade";
        proxy_set_header Host $host;
    }
}
```

Enable the site and obtain SSL certificate:

```bash
# Enable site
sudo ln -s /etc/nginx/sites-available/quickrefurbz.com /etc/nginx/sites-enabled/

# Test Nginx configuration
sudo nginx -t

# Restart Nginx
sudo systemctl restart nginx

# Obtain SSL certificate (if not already done)
sudo certbot --nginx -d quickrefurbz.com -d www.quickrefurbz.com
```

### 9. Configure Firewall

```bash
# Allow SSH, HTTP, and HTTPS
sudo ufw allow 22/tcp
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp

# Enable firewall
sudo ufw enable
```

## Deployment

Once the VPS is bootstrapped, deployment is automatic:

1. Push to the `main` branch on GitHub
2. GitHub Actions will automatically:
   - Build the application
   - Sync files to the VPS
   - Install dependencies
   - Restart the service

You can also manually trigger deployment from GitHub Actions UI.

## Verification

After deployment, verify the application is running:

```bash
# Check service status
sudo systemctl status quickrefurbz

# Check logs
sudo journalctl -u quickrefurbz -f

# Test the application
curl https://quickrefurbz.com
```

## Troubleshooting

### Service won't start

```bash
# Check logs
sudo journalctl -u quickrefurbz -n 50 --no-pager

# Check environment file
cat /var/www/quickrefurbz/.env

# Verify database connection
sudo -u deploy psql -h localhost -U quickrefurbz -d quickrefurbz -c "SELECT 1;"
```

### Build failures

```bash
# SSH to VPS
ssh deploy@your-vps-ip

# Navigate to app directory
cd /var/www/quickrefurbz

# Check Node.js version
node --version

# Try building manually
npm run build
npm run build:frontend
```

### Permission issues

```bash
# Ensure deploy user owns everything
sudo chown -R deploy:deploy /var/www/quickrefurbz

# Ensure data directory is writable
sudo chmod 755 /var/www/quickrefurbz/data
```

## Rollback Procedure

If a deployment fails, you can rollback:

```bash
# SSH to VPS
ssh deploy@your-vps-ip

# Navigate to app directory
cd /var/www/quickrefurbz

# View git history
git log --oneline -10

# Revert to previous commit
git checkout <previous-commit-hash>

# Restart service
sudo systemctl restart quickrefurbz
```

## Manual Deployment

If you need to deploy manually (without GitHub Actions):

```bash
# On your local machine
cd /Users/connorodea/Library/Mobile Documents/com~apple~CloudDocs/UPSCALED2026/QUICKLOTZ2026/QuickRefurbz

# Build locally
npm run build
npm run build:frontend

# Sync to VPS
rsync -avz --delete \
  --exclude='.git' \
  --exclude='node_modules' \
  --exclude='.env' \
  --exclude='data/*.db' \
  ./ \
  deploy@your-vps-ip:/var/www/quickrefurbz/

# SSH to VPS and restart
ssh deploy@your-vps-ip "cd /var/www/quickrefurbz && ./deploy/deploy.sh"
```

## Support

For issues or questions:
- Check service logs: `sudo journalctl -u quickrefurbz -f`
- Verify Nginx logs: `sudo tail -f /var/log/nginx/quickrefurbz.error.log`
- Review GitHub Actions logs for deployment issues

## Architecture

- **Frontend**: React + Vite (served by Nginx at `/`)
- **Backend**: Node.js + Express (proxied at `/api/`)
- **Database**: PostgreSQL
- **Process Manager**: systemd
- **Web Server**: Nginx
- **SSL**: Let's Encrypt (via certbot)
- **CI/CD**: GitHub Actions
