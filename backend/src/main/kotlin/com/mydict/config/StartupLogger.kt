package com.mydict.config

import org.slf4j.LoggerFactory
import org.springframework.boot.context.event.ApplicationReadyEvent
import org.springframework.context.event.EventListener
import org.springframework.core.env.Environment
import org.springframework.stereotype.Component

@Component
class StartupLogger(private val env: Environment) {

    private val log = LoggerFactory.getLogger(StartupLogger::class.java)

    @EventListener(ApplicationReadyEvent::class)
    fun logConfiguration() {
        val keys = listOf(
            "ANTHROPIC_API_KEY",
            "GOOGLE_CLIENT_ID",
            "MAIL_HOST",
            "MAIL_PORT",
            "MAIL_USERNAME",
            "MAIL_SMTP_AUTH",
            "MAIL_SMTP_STARTTLS",
        )

        log.info("=== Environment Variables ===")
        for (key in keys) {
            val value = env.getProperty(key)
            val display = when {
                value.isNullOrBlank() -> "<not set>"
                key.contains("KEY") || key.contains("PASSWORD") || key.contains("SECRET") -> "${value.take(8)}****"
                else -> value
            }
            log.info("  {} = {}", key, display)
        }

        // Resolved Spring Mail config
        log.info("  spring.mail.host = {}", env.getProperty("spring.mail.host"))
        log.info("  spring.mail.port = {}", env.getProperty("spring.mail.port"))
        log.info("  spring.mail.username = {}", env.getProperty("spring.mail.username"))
        log.info("=============================")
    }
}
