# --- Default VPC and Subnet ---

data "aws_vpc" "default" {
  default = true
}

data "aws_subnets" "default" {
  filter {
    name   = "vpc-id"
    values = [data.aws_vpc.default.id]
  }
  filter {
    name   = "default-for-az"
    values = ["true"]
  }
}

# --- Latest Amazon Linux 2023 AMI ---

data "aws_ami" "al2023" {
  most_recent = true
  owners      = ["amazon"]

  filter {
    name   = "name"
    values = ["al2023-ami-*-x86_64"]
  }
  filter {
    name   = "virtualization-type"
    values = ["hvm"]
  }
  filter {
    name   = "architecture"
    values = ["x86_64"]
  }
}

# --- Auto-generated SSH Key Pair ---

resource "tls_private_key" "app" {
  algorithm = "ED25519"
}

resource "aws_key_pair" "app" {
  key_name   = "${var.app_name}-key"
  public_key = tls_private_key.app.public_key_openssh
}

resource "local_file" "private_key" {
  content         = tls_private_key.app.private_key_openssh
  filename        = "${path.module}/${var.app_name}-key.pem"
  file_permission = "0400"
}

# --- Security Group ---

resource "aws_security_group" "app" {
  name        = "${var.app_name}-sg"
  description = "Allow HTTP and SSH for ${var.app_name}"
  vpc_id      = data.aws_vpc.default.id

  ingress {
    description = "SSH"
    from_port   = 22
    to_port     = 22
    protocol    = "tcp"
    cidr_blocks = [var.ssh_allowed_cidr]
  }

  ingress {
    description = "HTTP - Web UI"
    from_port   = 3000
    to_port     = 3000
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
  }

  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }

  tags = {
    Name = "${var.app_name}-sg"
  }
}

# --- Resolve AZ for the chosen subnet ---

data "aws_subnet" "selected" {
  id = data.aws_subnets.default.ids[0]
}

# --- Environments ---

locals {
  environments = toset(["dev", "prod"])
}

# --- Persistent EBS Volume for PostgreSQL data ---

resource "aws_ebs_volume" "pgdata" {
  for_each          = local.environments
  availability_zone = data.aws_subnet.selected.availability_zone
  size              = 10
  type              = "gp3"

  tags = {
    Name        = "${var.app_name}-${each.key}-pgdata"
    Environment = each.key
  }

  lifecycle {
    prevent_destroy = true
  }
}

# --- EC2 Instance ---

resource "aws_instance" "app" {
  for_each               = local.environments
  ami                    = data.aws_ami.al2023.id
  instance_type          = var.instance_type
  key_name               = aws_key_pair.app.key_name
  vpc_security_group_ids = [aws_security_group.app.id]
  subnet_id              = data.aws_subnets.default.ids[0]
  iam_instance_profile   = aws_iam_instance_profile.app.name

  root_block_device {
    volume_size = 30
    volume_type = "gp3"
  }

  user_data = templatefile("${path.module}/user_data.sh", {
    anthropic_api_key = var.anthropic_api_key
    aws_region        = var.aws_region
    environment       = each.key
    app_name          = var.app_name
  })

  tags = {
    Name        = "${var.app_name}-${each.key}"
    Environment = each.key
  }
}

# --- Attach persistent EBS volume to EC2 ---

resource "aws_volume_attachment" "pgdata" {
  for_each    = local.environments
  device_name = "/dev/xvdf"
  volume_id   = aws_ebs_volume.pgdata[each.key].id
  instance_id = aws_instance.app[each.key].id
}

# --- Elastic IP ---

resource "aws_eip" "app" {
  for_each = local.environments
  instance = aws_instance.app[each.key].id
  domain   = "vpc"

  tags = {
    Name        = "${var.app_name}-${each.key}-eip"
    Environment = each.key
  }
}
