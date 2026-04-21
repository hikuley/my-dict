output "public_ip" {
  description = "Public IP address of the EC2 instance"
  value       = aws_eip.app.public_ip
}

output "app_url" {
  description = "URL to access the application"
  value       = "http://${aws_eip.app.public_ip}:3000"
}

output "ssh_command" {
  description = "SSH command to connect to the instance"
  value       = "ssh -i ${path.module}/${var.app_name}-key.pem ec2-user@${aws_eip.app.public_ip}"
}
