package com.mydict.controller

import com.mydict.dto.*
import com.mydict.entity.AuthType
import com.mydict.entity.User
import com.mydict.repository.UserRepository
import com.mydict.security.JwtTokenProvider
import com.mydict.service.AuthException
import com.mydict.service.AuthService
import org.junit.jupiter.api.Nested
import org.junit.jupiter.api.Test
import org.mockito.kotlin.any
import org.mockito.kotlin.whenever
import org.springframework.beans.factory.annotation.Autowired
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc
import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest
import org.springframework.boot.test.mock.mockito.MockBean
import org.springframework.http.MediaType
import org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.csrf
import org.springframework.test.web.servlet.MockMvc
import org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*
import org.springframework.test.web.servlet.result.MockMvcResultMatchers.*
import java.util.*

@WebMvcTest(AuthController::class)
@AutoConfigureMockMvc(addFilters = false)
class AuthControllerTest {

    @Autowired
    private lateinit var mockMvc: MockMvc

    @MockBean
    private lateinit var authService: AuthService

    @MockBean
    private lateinit var jwtTokenProvider: JwtTokenProvider

    @MockBean
    private lateinit var userRepository: UserRepository

    private val testUserId = UUID.randomUUID()

    @Nested
    inner class SignUpTests {
        @Test
        fun `successful sign-up returns 201`() {
            val response = AuthResponse(
                token = "jwt-token",
                user = UserResponse(testUserId, "Test User", "test@example.com", "manual", false),
            )
            whenever(authService.signUp(any())).thenReturn(response)

            mockMvc.perform(
                post("/api/auth/signup")
                    .contentType(MediaType.APPLICATION_JSON)
                    .content("""{"name": "Test User", "email": "test@example.com", "password": "password123"}""")
            )
                .andExpect(status().isCreated)
                .andExpect(jsonPath("$.token").value("jwt-token"))
                .andExpect(jsonPath("$.user.email").value("test@example.com"))
                .andExpect(jsonPath("$.user.authType").value("manual"))
                .andExpect(jsonPath("$.user.isVerified").value(false))
        }

        @Test
        fun `sign-up with validation error returns 400`() {
            whenever(authService.signUp(any())).thenThrow(AuthException("Invalid email format"))

            mockMvc.perform(
                post("/api/auth/signup")
                    .contentType(MediaType.APPLICATION_JSON)
                    .content("""{"name": "User", "email": "bad-email", "password": "password123"}""")
            )
                .andExpect(status().isBadRequest)
                .andExpect(jsonPath("$.error").value("Invalid email format"))
        }

        @Test
        fun `sign-up with duplicate email returns 400`() {
            whenever(authService.signUp(any())).thenThrow(AuthException("An account with this email already exists"))

            mockMvc.perform(
                post("/api/auth/signup")
                    .contentType(MediaType.APPLICATION_JSON)
                    .content("""{"name": "User", "email": "dup@test.com", "password": "password123"}""")
            )
                .andExpect(status().isBadRequest)
                .andExpect(jsonPath("$.error").value("An account with this email already exists"))
        }

        @Test
        fun `sign-up with weak password returns 400`() {
            whenever(authService.signUp(any())).thenThrow(AuthException("Password must be at least 8 characters"))

            mockMvc.perform(
                post("/api/auth/signup")
                    .contentType(MediaType.APPLICATION_JSON)
                    .content("""{"name": "User", "email": "test@test.com", "password": "short"}""")
            )
                .andExpect(status().isBadRequest)
                .andExpect(jsonPath("$.error").value("Password must be at least 8 characters"))
        }

        @Test
        fun `sign-up with missing fields returns 400`() {
            whenever(authService.signUp(any())).thenThrow(AuthException("Email is required"))

            mockMvc.perform(
                post("/api/auth/signup")
                    .contentType(MediaType.APPLICATION_JSON)
                    .content("""{"name": "User"}""")
            )
                .andExpect(status().isBadRequest)
                .andExpect(jsonPath("$.error").value("Email is required"))
        }
    }

    @Nested
    inner class LoginTests {
        @Test
        fun `successful login returns 200`() {
            val response = AuthResponse(
                token = "login-token",
                user = UserResponse(testUserId, "Test User", "test@example.com", "manual", true),
            )
            whenever(authService.login(any())).thenReturn(response)

            mockMvc.perform(
                post("/api/auth/login")
                    .contentType(MediaType.APPLICATION_JSON)
                    .content("""{"email": "test@example.com", "password": "password123"}""")
            )
                .andExpect(status().isOk)
                .andExpect(jsonPath("$.token").value("login-token"))
                .andExpect(jsonPath("$.user.isVerified").value(true))
        }

        @Test
        fun `login with wrong credentials returns 401`() {
            whenever(authService.login(any())).thenThrow(AuthException("Invalid email or password"))

            mockMvc.perform(
                post("/api/auth/login")
                    .contentType(MediaType.APPLICATION_JSON)
                    .content("""{"email": "test@example.com", "password": "wrong"}""")
            )
                .andExpect(status().isUnauthorized)
                .andExpect(jsonPath("$.error").value("Invalid email or password"))
        }
    }

    @Nested
    inner class VerifyEmailTests {
        @Test
        fun `successful verification returns 200`() {
            whenever(authService.verifyEmail(any())).thenReturn(VerificationResponse("Email verified successfully"))

            mockMvc.perform(
                post("/api/auth/verify")
                    .contentType(MediaType.APPLICATION_JSON)
                    .content("""{"email": "test@example.com", "code": "123456"}""")
            )
                .andExpect(status().isOk)
                .andExpect(jsonPath("$.message").value("Email verified successfully"))
        }

        @Test
        fun `invalid code returns 400`() {
            whenever(authService.verifyEmail(any())).thenThrow(AuthException("Invalid verification code"))

            mockMvc.perform(
                post("/api/auth/verify")
                    .contentType(MediaType.APPLICATION_JSON)
                    .content("""{"email": "test@example.com", "code": "999999"}""")
            )
                .andExpect(status().isBadRequest)
                .andExpect(jsonPath("$.error").value("Invalid verification code"))
        }

        @Test
        fun `expired code returns 400`() {
            whenever(authService.verifyEmail(any())).thenThrow(AuthException("Verification code has expired"))

            mockMvc.perform(
                post("/api/auth/verify")
                    .contentType(MediaType.APPLICATION_JSON)
                    .content("""{"email": "test@example.com", "code": "123456"}""")
            )
                .andExpect(status().isBadRequest)
                .andExpect(jsonPath("$.error").value("Verification code has expired"))
        }
    }

    @Nested
    inner class ResendVerificationTests {
        @Test
        fun `resend returns 200`() {
            whenever(authService.resendVerification(any())).thenReturn(VerificationResponse("Verification code sent"))

            mockMvc.perform(
                post("/api/auth/resend-verification")
                    .contentType(MediaType.APPLICATION_JSON)
                    .content("""{"email": "test@example.com"}""")
            )
                .andExpect(status().isOk)
                .andExpect(jsonPath("$.message").value("Verification code sent"))
        }
    }

    @Nested
    inner class GoogleAuthTests {
        @Test
        fun `successful Google auth returns 200`() {
            val response = AuthResponse(
                token = "google-token",
                user = UserResponse(testUserId, "Google User", "google@test.com", "google", true),
            )
            whenever(authService.googleAuth(any())).thenReturn(response)

            mockMvc.perform(
                post("/api/auth/google")
                    .contentType(MediaType.APPLICATION_JSON)
                    .content("""{"idToken": "valid-google-token"}""")
            )
                .andExpect(status().isOk)
                .andExpect(jsonPath("$.token").value("google-token"))
                .andExpect(jsonPath("$.user.authType").value("google"))
                .andExpect(jsonPath("$.user.isVerified").value(true))
        }

        @Test
        fun `failed Google auth returns 400`() {
            whenever(authService.googleAuth(any())).thenThrow(AuthException("Invalid Google ID token"))

            mockMvc.perform(
                post("/api/auth/google")
                    .contentType(MediaType.APPLICATION_JSON)
                    .content("""{"idToken": "invalid-token"}""")
            )
                .andExpect(status().isBadRequest)
                .andExpect(jsonPath("$.error").value("Invalid Google ID token"))
        }
    }

    @Nested
    inner class MeEndpointTests {
        @Test
        fun `unauthenticated request to me returns 401`() {
            mockMvc.perform(get("/api/auth/me"))
                .andExpect(status().isUnauthorized)
        }
    }
}
