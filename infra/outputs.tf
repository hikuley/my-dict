output "public_ips" {
  description = "Public IP addresses of the EC2 instances"
  value       = { for env, eip in aws_eip.app : env => eip.public_ip }
}

output "app_urls" {
  description = "URLs to access the application"
  value       = { for env, eip in aws_eip.app : env => "http://${eip.public_ip}:3000" }
}

output "ssh_commands" {
  description = "SSH commands to connect to the instances"
  value       = { for env, eip in aws_eip.app : env => "ssh -i ${path.module}/${var.app_name}-key.pem ec2-user@${eip.public_ip}" }
}
