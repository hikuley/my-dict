package com.mydict.service

import com.nimbusds.jose.JWSAlgorithm
import com.nimbusds.jose.jwk.source.JWKSourceBuilder
import com.nimbusds.jose.proc.DefaultJOSEObjectTypeVerifier
import com.nimbusds.jose.proc.JWSVerificationKeySelector
import com.nimbusds.jose.proc.SecurityContext
import com.nimbusds.jwt.JWTClaimsSet
import com.nimbusds.jwt.proc.DefaultJWTClaimsVerifier
import com.nimbusds.jwt.proc.DefaultJWTProcessor
import org.slf4j.LoggerFactory
import org.springframework.beans.factory.annotation.Value
import org.springframework.stereotype.Service
import java.net.URL
import java.util.HashSet

data class AppleUserInfo(
    val appleId: String,
    val email: String,
    val name: String?,
)

@Service
class AppleOAuthService(
    @Value("\${app.apple-client-id:}") private val clientId: String,
) {
    private val log = LoggerFactory.getLogger(javaClass)

    companion object {
        private const val APPLE_JWKS_URL = "https://appleid.apple.com/auth/keys"
        private const val APPLE_ISSUER = "https://appleid.apple.com"
    }

    private val jwtProcessor by lazy {
        val jwkSource = JWKSourceBuilder.create<SecurityContext>(URL(APPLE_JWKS_URL))
            .retrying(true)
            .build()
        val keySelector = JWSVerificationKeySelector<SecurityContext>(
            JWSAlgorithm.RS256,
            jwkSource,
        )
        DefaultJWTProcessor<SecurityContext>().apply {
            jwsTypeVerifier = DefaultJOSEObjectTypeVerifier.JWT
            jwsKeySelector = keySelector
            jwtClaimsSetVerifier = DefaultJWTClaimsVerifier<SecurityContext>(
                JWTClaimsSet.Builder()
                    .issuer(APPLE_ISSUER)
                    .build(),
                HashSet(listOf("sub", "iat", "exp", "aud", "email")),
            )
        }
    }

    fun verifyIdToken(idToken: String): AppleUserInfo? {
        return try {
            val claims = jwtProcessor.process(idToken, null)

            val audience = claims.audience
            if (clientId.isNotBlank() && !audience.contains(clientId)) {
                log.warn("[apple-auth] Token audience mismatch: expected=$clientId, got=$audience")
                return null
            }

            AppleUserInfo(
                appleId = claims.subject,
                email = claims.getStringClaim("email"),
                name = null, // Apple sends name only on first auth, passed separately
            )
        } catch (e: Exception) {
            log.warn("[apple-auth] Failed to verify Apple ID token: ${e.message}")
            null
        }
    }
}
