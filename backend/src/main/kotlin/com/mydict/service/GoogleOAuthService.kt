package com.mydict.service

import com.google.api.client.googleapis.auth.oauth2.GoogleIdTokenVerifier
import com.google.api.client.http.javanet.NetHttpTransport
import com.google.api.client.json.gson.GsonFactory
import org.springframework.beans.factory.annotation.Value
import org.springframework.stereotype.Service

data class GoogleUserInfo(
    val googleId: String,
    val email: String,
    val name: String,
)

@Service
class GoogleOAuthService(
    @Value("\${spring.security.oauth2.client.registration.google.client-id:}") private val clientId: String,
) {
    private val verifier: GoogleIdTokenVerifier by lazy {
        GoogleIdTokenVerifier.Builder(NetHttpTransport(), GsonFactory.getDefaultInstance())
            .setAudience(listOf(clientId))
            .build()
    }

    fun verifyIdToken(idToken: String): GoogleUserInfo? {
        val googleIdToken = verifier.verify(idToken) ?: return null
        val payload = googleIdToken.payload
        return GoogleUserInfo(
            googleId = payload.subject,
            email = payload.email,
            name = payload["name"] as? String ?: payload.email,
        )
    }
}
