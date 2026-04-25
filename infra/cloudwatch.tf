# --- IAM Role for EC2 to write CloudWatch Logs ---

resource "aws_iam_role" "app" {
  name = "${var.app_name}-ec2-role"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Action = "sts:AssumeRole"
      Effect = "Allow"
      Principal = {
        Service = "ec2.amazonaws.com"
      }
    }]
  })

  tags = {
    Name = "${var.app_name}-ec2-role"
  }
}

resource "aws_iam_role_policy" "cloudwatch_logs" {
  name = "${var.app_name}-cloudwatch-logs"
  role = aws_iam_role.app.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Effect = "Allow"
      Action = [
        "logs:CreateLogStream",
        "logs:PutLogEvents",
        "logs:DescribeLogStreams"
      ]
      Resource = [for lg in aws_cloudwatch_log_group.app : "${lg.arn}:*"]
    }]
  })
}

resource "aws_iam_role_policy" "secrets_read" {
  name = "${var.app_name}-secrets-read"
  role = aws_iam_role.app.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Effect = "Allow"
      Action = [
        "secretsmanager:GetSecretValue"
      ]
      Resource = [for s in aws_secretsmanager_secret.app : s.arn]
    }]
  })
}

resource "aws_iam_instance_profile" "app" {
  name = "${var.app_name}-instance-profile"
  role = aws_iam_role.app.name
}

# --- CloudWatch Log Group ---

resource "aws_cloudwatch_log_group" "app" {
  for_each          = local.environments
  name              = "/${var.app_name}-${each.key}"
  retention_in_days = 14

  tags = {
    Name        = "${var.app_name}-${each.key}"
    Environment = each.key
  }
}
