package com.mydict.service

import org.springframework.mail.SimpleMailMessage
import org.springframework.mail.javamail.JavaMailSender
import org.springframework.stereotype.Service

@Service
class EmailService(
    private val mailSender: JavaMailSender,
) {
    fun sendVerificationCode(toEmail: String, code: String) {
        val message = SimpleMailMessage().apply {
            setTo(toEmail)
            subject = "My Dictionary - Email Verification Code"
            text = "Your verification code is: $code\n\nThis code expires in 15 minutes."
        }
        mailSender.send(message)
    }
}
