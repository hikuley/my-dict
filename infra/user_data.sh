#!/bin/bash
set -euo pipefail

# --- Install Docker and AWS CLI ---
dnf update -y
dnf install -y docker git aws-cli
systemctl enable docker
systemctl start docker
usermod -aG docker ec2-user

# --- Install Docker Compose plugin ---
mkdir -p /usr/local/lib/docker/cli-plugins
ARCH=$(uname -m)
curl -SL "https://github.com/docker/compose/releases/latest/download/docker-compose-linux-$${ARCH}" \
  -o /usr/local/lib/docker/cli-plugins/docker-compose
chmod +x /usr/local/lib/docker/cli-plugins/docker-compose

# --- Install Docker Buildx plugin ---
curl -fSL -o /usr/local/lib/docker/cli-plugins/docker-buildx \
  https://github.com/docker/buildx/releases/download/v0.21.2/buildx-v0.21.2.linux-amd64
chmod +x /usr/local/lib/docker/cli-plugins/docker-buildx

# --- Format and mount persistent EBS volume for PostgreSQL data ---
# Wait for the EBS volume to be attached
for i in $(seq 1 30); do
  if [ -e /dev/xvdf ] || [ -e /dev/nvme1n1 ]; then
    break
  fi
  echo "Waiting for EBS volume to attach... ($${i}/30)"
  sleep 2
done

# Determine the actual device name (could be /dev/xvdf or /dev/nvme1n1)
DATA_DEV=""
if [ -e /dev/nvme1n1 ]; then
  DATA_DEV="/dev/nvme1n1"
elif [ -e /dev/xvdf ]; then
  DATA_DEV="/dev/xvdf"
fi

if [ -n "$${DATA_DEV}" ]; then
  # Only format if not already formatted (preserves existing data)
  if ! blkid "$${DATA_DEV}" | grep -q ext4; then
    echo "Formatting $${DATA_DEV} as ext4..."
    mkfs.ext4 "$${DATA_DEV}"
  else
    echo "$${DATA_DEV} already formatted, skipping mkfs."
  fi

  mkdir -p /data
  mount "$${DATA_DEV}" /data

  # Add to fstab for automatic mount on reboot
  if ! grep -q '/data' /etc/fstab; then
    echo "$${DATA_DEV} /data ext4 defaults,nofail 0 2" >> /etc/fstab
  fi

  # Create pgdata directory owned by ec2-user
  mkdir -p /data/pgdata
  chown -R 999:999 /data/pgdata  # UID 999 = postgres user in postgres:16-alpine
  echo "EBS volume mounted at /data"
else
  echo "WARNING: EBS volume not found, pgdata will use Docker named volume"
fi

# --- Create app directory ---
mkdir -p /opt/my-dict
chown ec2-user:ec2-user /opt/my-dict

# --- Fetch secrets from AWS Secrets Manager ---
echo "Fetching secrets from Secrets Manager: ${secret_name}"
SECRET_JSON=$(aws secretsmanager get-secret-value \
  --region "${aws_region}" \
  --secret-id "${secret_name}" \
  --query SecretString \
  --output text)

ANTHROPIC_API_KEY=$(echo "$${SECRET_JSON}" | python3 -c "import sys,json; print(json.load(sys.stdin)['ANTHROPIC_API_KEY'])")
GOOGLE_CLIENT_ID=$(echo "$${SECRET_JSON}" | python3 -c "import sys,json; print(json.load(sys.stdin)['GOOGLE_CLIENT_ID'])")

# --- Write environment file ---
cat > /opt/my-dict/.env <<ENVEOF
ANTHROPIC_API_KEY=$${ANTHROPIC_API_KEY}
GOOGLE_CLIENT_ID=$${GOOGLE_CLIENT_ID}
AWS_REGION=${aws_region}
CLOUDWATCH_LOG_GROUP=/${app_name}-${environment}
ENVEOF
chmod 600 /opt/my-dict/.env
chown ec2-user:ec2-user /opt/my-dict/.env

# --- Increase vm.max_map_count for Kafka ---
echo "vm.max_map_count=262144" >> /etc/sysctl.conf
sysctl -w vm.max_map_count=262144

# --- Create swap (helps t3.micro with 1GB RAM) ---
dd if=/dev/zero of=/swapfile bs=1M count=1024
chmod 600 /swapfile
mkswap /swapfile
swapon /swapfile
echo "/swapfile swap swap defaults 0 0" >> /etc/fstab

echo "Bootstrap complete. Upload app files to /opt/my-dict and run docker compose up -d"
