package com.mydict.security

import org.junit.jupiter.api.Assertions.*
import org.junit.jupiter.api.Test
import java.util.UUID

class JwtTokenProviderTest {

    private val provider = JwtTokenProvider(
        jwtSecret = "test-jwt-secret-key-that-is-at-least-32-characters-long",
        jwtExpirationMs = 86400000L,
    )

    @Test
    fun `generates token and extracts user ID`() {
        val userId = UUID.randomUUID()
        val token = provider.generateToken(userId, "test@example.com")

        assertNotNull(token)
        assertEquals(userId, provider.getUserIdFromToken(token))
    }

    @Test
    fun `validates a valid token`() {
        val token = provider.generateToken(UUID.randomUUID(), "test@example.com")
        assertTrue(provider.validateToken(token))
    }

    @Test
    fun `rejects an invalid token`() {
        assertFalse(provider.validateToken("invalid.token.here"))
    }

    @Test
    fun `rejects a tampered token`() {
        val token = provider.generateToken(UUID.randomUUID(), "test@example.com")
        val tampered = token.dropLast(5) + "xxxxx"
        assertFalse(provider.validateToken(tampered))
    }

    @Test
    fun `rejects an expired token`() {
        val expiredProvider = JwtTokenProvider(
            jwtSecret = "test-jwt-secret-key-that-is-at-least-32-characters-long",
            jwtExpirationMs = -1000L, // Already expired
        )
        val token = expiredProvider.generateToken(UUID.randomUUID(), "test@example.com")
        assertFalse(provider.validateToken(token))
    }
}
