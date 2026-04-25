variable "aws_region" {
  description = "AWS region to deploy into"
  type        = string
  default     = "eu-west-1"
}

variable "instance_type" {
  description = "EC2 instance type (t3.micro = free tier, t3.small = 2GB RAM recommended)"
  type        = string
  default     = "t3.micro"
}

variable "anthropic_api_key" {
  description = "Anthropic API key for Claude word generation"
  type        = string
  sensitive   = true
}

variable "google_client_id" {
  description = "Google OAuth Client ID for Sign in with Google"
  type        = string
  sensitive   = true
}

variable "mail_username" {
  description = "SMTP username (Gmail address) for sending emails"
  type        = string
  sensitive   = true
}

variable "mail_password" {
  description = "SMTP password (Google App Password) for sending emails"
  type        = string
  sensitive   = true
}

variable "ssh_allowed_cidr" {
  description = "CIDR block allowed to SSH (default: open, restrict to your IP for security)"
  type        = string
  default     = "0.0.0.0/0"
}

variable "app_name" {
  description = "Application name used for tagging"
  type        = string
  default     = "my-dict"
}

variable "github_owner" {
  description = "GitHub username or organization"
  type        = string
}

variable "github_repo" {
  description = "GitHub repository name"
  type        = string
  default     = "my-dict"
}

variable "github_token" {
  description = "GitHub personal access token with repo scope"
  type        = string
  sensitive   = true
}
