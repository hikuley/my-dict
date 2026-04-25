package com.mydict.integration

import com.fasterxml.jackson.databind.ObjectMapper
import com.mydict.entity.AuthType
import com.mydict.entity.User
import com.mydict.repository.UserRepository
import com.mydict.service.EmailService
import com.mydict.service.GoogleOAuthService
import com.mydict.service.GoogleUserInfo
import org.junit.jupiter.api.*
import org.junit.jupiter.api.Assertions.*
import org.mockito.kotlin.*
import org.springframework.beans.factory.annotation.Autowired
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc
import org.springframework.boot.test.context.SpringBootTest
import org.springframework.boot.test.mock.mockito.MockBean
import org.springframework.http.MediaType
import org.springframework.security.crypto.password.PasswordEncoder
import org.springframework.test.web.servlet.MockMvc
import org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*
import org.springframework.test.web.servlet.result.MockMvcResultMatchers.*
import java.time.OffsetDateTime

@SpringBootTest
@AutoConfigureMockMvc
@TestMethodOrder(MethodOrderer.OrderAnnotation::class)
class AuthIntegrationTest : BaseIntegrationTest() {

    @Autowired
    private lateinit var mockMvc: MockMvc

    @Autowired
    private lateinit var objectMapper: ObjectMapper

    @Autowired
    private lateinit var userRepository: UserRepository

    @Autowired
    private lateinit var passwordEncoder: PasswordEncoder

    @MockBean
    private lateinit var emailService: EmailService

    @MockBean
    private lateinit var googleOAuthService: GoogleOAuthService

    @BeforeEach
    fun cleanUp() {
        userRepository.deleteAll()
    }

    @Nested
    inner class SignUpFlowTests {
        @Test
        fun `sign up creates user with manual auth type`() {
            val body = mapOf("name" to "Test User", "email" to "test@example.com", "password" to "password123")

            mockMvc.perform(
                post("/api/auth/signup")
                    .contentType(MediaType.APPLICATION_JSON)
                    .content(objectMapper.writeValueAsString(body))
            )
                .andExpect(status().isCreated)
                .andExpect(jsonPath("$.token").isNotEmpty)
                .andExpect(jsonPath("$.user.authType").value("manual"))
                .andExpect(jsonPath("$.user.isVerified").value(false))

            val user = userRepository.findByEmail("test@example.com")
            assertNotNull(user)
            assertEquals(AuthType.manual, user!!.authType)
            assertNotNull(user.passwordHash)
            assertFalse(user.isVerified)
        }

        @Test
        fun `sign up stores verification code in DB`() {
            val body = mapOf("name" to "User", "email" to "verify@test.com", "password" to "password123")

            mockMvc.perform(
                post("/api/auth/signup")
                    .contentType(MediaType.APPLICATION_JSON)
                    .content(objectMapper.writeValueAsString(body))
            )
                .andExpect(status().isCreated)

            val user = userRepository.findByEmail("verify@test.com")
            assertNotNull(user)
            assertNotNull(user!!.verificationCode)
            assertTrue(user.verificationCode!!.matches(Regex("\\d{6}")))
            assertNotNull(user.verificationExpiry)
            assertTrue(user.verificationExpiry!!.isAfter(OffsetDateTime.now()))
        }

        @Test
        fun `sign up sends verification email`() {
            val body = mapOf("name" to "User", "email" to "email-test@test.com", "password" to "password123")

            mockMvc.perform(
                post("/api/auth/signup")
                    .contentType(MediaType.APPLICATION_JSON)
                    .content(objectMapper.writeValueAsString(body))
            )
                .andExpect(status().isCreated)

            verify(emailService).sendVerificationCode(eq("email-test@test.com"), argThat { matches(Regex("\\d{6}")) })
        }

        @Test
        fun `sign up rejects duplicate email`() {
            val body = mapOf("name" to "User", "email" to "dup@test.com", "password" to "password123")

            mockMvc.perform(
                post("/api/auth/signup")
                    .contentType(MediaType.APPLICATION_JSON)
                    .content(objectMapper.writeValueAsString(body))
            ).andExpect(status().isCreated)

            mockMvc.perform(
                post("/api/auth/signup")
                    .contentType(MediaType.APPLICATION_JSON)
                    .content(objectMapper.writeValueAsString(body))
            )
                .andExpect(status().isBadRequest)
                .andExpect(jsonPath("$.error").value("An account with this email already exists"))
        }
    }

    @Nested
    inner class LoginFlowTests {
        @Test
        fun `login with correct credentials returns token`() {
            // Create user first
            val signUpBody = mapOf("name" to "User", "email" to "login@test.com", "password" to "password123")
            mockMvc.perform(
                post("/api/auth/signup")
                    .contentType(MediaType.APPLICATION_JSON)
                    .content(objectMapper.writeValueAsString(signUpBody))
            ).andExpect(status().isCreated)

            // Login
            val loginBody = mapOf("email" to "login@test.com", "password" to "password123")
            mockMvc.perform(
                post("/api/auth/login")
                    .contentType(MediaType.APPLICATION_JSON)
                    .content(objectMapper.writeValueAsString(loginBody))
            )
                .andExpect(status().isOk)
                .andExpect(jsonPath("$.token").isNotEmpty)
                .andExpect(jsonPath("$.user.email").value("login@test.com"))
        }

        @Test
        fun `login with wrong password returns 401`() {
            val signUpBody = mapOf("name" to "User", "email" to "wrongpw@test.com", "password" to "password123")
            mockMvc.perform(
                post("/api/auth/signup")
                    .contentType(MediaType.APPLICATION_JSON)
                    .content(objectMapper.writeValueAsString(signUpBody))
            ).andExpect(status().isCreated)

            val loginBody = mapOf("email" to "wrongpw@test.com", "password" to "wrongpassword")
            mockMvc.perform(
                post("/api/auth/login")
                    .contentType(MediaType.APPLICATION_JSON)
                    .content(objectMapper.writeValueAsString(loginBody))
            )
                .andExpect(status().isUnauthorized)
                .andExpect(jsonPath("$.error").value("Invalid email or password"))
        }
    }

    @Nested
    inner class VerificationFlowTests {
        @Test
        fun `valid code verifies user successfully`() {
            // Sign up
            val body = mapOf("name" to "User", "email" to "code@test.com", "password" to "password123")
            mockMvc.perform(
                post("/api/auth/signup")
                    .contentType(MediaType.APPLICATION_JSON)
                    .content(objectMapper.writeValueAsString(body))
            ).andExpect(status().isCreated)

            // Extract code from mock
            val codeCaptor = argumentCaptor<String>()
            verify(emailService).sendVerificationCode(eq("code@test.com"), codeCaptor.capture())
            val code = codeCaptor.firstValue

            // Verify
            val verifyBody = mapOf("email" to "code@test.com", "code" to code)
            mockMvc.perform(
                post("/api/auth/verify")
                    .contentType(MediaType.APPLICATION_JSON)
                    .content(objectMapper.writeValueAsString(verifyBody))
            )
                .andExpect(status().isOk)
                .andExpect(jsonPath("$.message").value("Email verified successfully"))

            val user = userRepository.findByEmail("code@test.com")
            assertTrue(user!!.isVerified)
            assertNull(user.verificationCode)
            assertNull(user.verificationExpiry)
        }

        @Test
        fun `invalid code is rejected`() {
            val body = mapOf("name" to "User", "email" to "badcode@test.com", "password" to "password123")
            mockMvc.perform(
                post("/api/auth/signup")
                    .contentType(MediaType.APPLICATION_JSON)
                    .content(objectMapper.writeValueAsString(body))
            ).andExpect(status().isCreated)

            val verifyBody = mapOf("email" to "badcode@test.com", "code" to "000000")
            mockMvc.perform(
                post("/api/auth/verify")
                    .contentType(MediaType.APPLICATION_JSON)
                    .content(objectMapper.writeValueAsString(verifyBody))
            )
                .andExpect(status().isBadRequest)
                .andExpect(jsonPath("$.error").value("Invalid verification code"))
        }

        @Test
        fun `expired code is rejected`() {
            val body = mapOf("name" to "User", "email" to "expired@test.com", "password" to "password123")
            mockMvc.perform(
                post("/api/auth/signup")
                    .contentType(MediaType.APPLICATION_JSON)
                    .content(objectMapper.writeValueAsString(body))
            ).andExpect(status().isCreated)

            // Manually expire the code
            val user = userRepository.findByEmail("expired@test.com")!!
            user.verificationExpiry = OffsetDateTime.now().minusMinutes(30)
            userRepository.save(user)

            val verifyBody = mapOf("email" to "expired@test.com", "code" to user.verificationCode)
            mockMvc.perform(
                post("/api/auth/verify")
                    .contentType(MediaType.APPLICATION_JSON)
                    .content(objectMapper.writeValueAsString(verifyBody))
            )
                .andExpect(status().isBadRequest)
                .andExpect(jsonPath("$.error").value("Verification code has expired"))
        }

        @Test
        fun `resend generates new code`() {
            val body = mapOf("name" to "User", "email" to "resend@test.com", "password" to "password123")
            mockMvc.perform(
                post("/api/auth/signup")
                    .contentType(MediaType.APPLICATION_JSON)
                    .content(objectMapper.writeValueAsString(body))
            ).andExpect(status().isCreated)

            val oldCode = userRepository.findByEmail("resend@test.com")!!.verificationCode

            mockMvc.perform(
                post("/api/auth/resend-verification")
                    .contentType(MediaType.APPLICATION_JSON)
                    .content("""{"email": "resend@test.com"}""")
            )
                .andExpect(status().isOk)

            val newCode = userRepository.findByEmail("resend@test.com")!!.verificationCode
            assertNotNull(newCode)
            // The new code should (almost certainly) differ from the old
            // In rare cases they could be the same, but 1 in 1,000,000 chance
        }

        @Test
        fun `unverified user is blocked from protected routes`() {
            // Sign up (user is unverified)
            val body = mapOf("name" to "User", "email" to "unverified@test.com", "password" to "password123")
            val signUpResult = mockMvc.perform(
                post("/api/auth/signup")
                    .contentType(MediaType.APPLICATION_JSON)
                    .content(objectMapper.writeValueAsString(body))
            )
                .andExpect(status().isCreated)
                .andReturn()

            val token = objectMapper.readTree(signUpResult.response.contentAsString)["token"].asText()

            // Try to access /api/auth/me - should show as unverified
            mockMvc.perform(
                get("/api/auth/me")
                    .header("Authorization", "Bearer $token")
            )
                .andExpect(status().isForbidden)
                .andExpect(jsonPath("$.error").value("Email not verified"))
        }
    }

    @Nested
    inner class GoogleAuthFlowTests {
        @Test
        fun `Google sign-in creates verified user`() {
            whenever(googleOAuthService.verifyIdToken("google-id-token")).thenReturn(
                GoogleUserInfo("g-123", "google@test.com", "Google User")
            )

            mockMvc.perform(
                post("/api/auth/google")
                    .contentType(MediaType.APPLICATION_JSON)
                    .content("""{"idToken": "google-id-token"}""")
            )
                .andExpect(status().isOk)
                .andExpect(jsonPath("$.token").isNotEmpty)
                .andExpect(jsonPath("$.user.authType").value("google"))
                .andExpect(jsonPath("$.user.isVerified").value(true))

            val user = userRepository.findByEmail("google@test.com")
            assertNotNull(user)
            assertEquals(AuthType.google, user!!.authType)
            assertTrue(user.isVerified)
            assertEquals("g-123", user.googleId)
            assertNull(user.passwordHash)
        }

        @Test
        fun `Google users skip verification - is_verified is true on creation`() {
            whenever(googleOAuthService.verifyIdToken("token")).thenReturn(
                GoogleUserInfo("g-456", "gskip@test.com", "Skip User")
            )

            mockMvc.perform(
                post("/api/auth/google")
                    .contentType(MediaType.APPLICATION_JSON)
                    .content("""{"idToken": "token"}""")
            ).andExpect(status().isOk)

            val user = userRepository.findByEmail("gskip@test.com")
            assertTrue(user!!.isVerified)
            assertNull(user.verificationCode)
        }

        @Test
        fun `failed Google OAuth returns error`() {
            whenever(googleOAuthService.verifyIdToken("bad-token")).thenReturn(null)

            mockMvc.perform(
                post("/api/auth/google")
                    .contentType(MediaType.APPLICATION_JSON)
                    .content("""{"idToken": "bad-token"}""")
            )
                .andExpect(status().isBadRequest)
                .andExpect(jsonPath("$.error").value("Invalid Google ID token"))
        }

        @Test
        fun `Google auth returns correct session after success`() {
            whenever(googleOAuthService.verifyIdToken("session-token")).thenReturn(
                GoogleUserInfo("g-789", "session@test.com", "Session User")
            )

            val result = mockMvc.perform(
                post("/api/auth/google")
                    .contentType(MediaType.APPLICATION_JSON)
                    .content("""{"idToken": "session-token"}""")
            )
                .andExpect(status().isOk)
                .andReturn()

            val token = objectMapper.readTree(result.response.contentAsString)["token"].asText()

            // Use token to access /api/auth/me
            mockMvc.perform(
                get("/api/auth/me")
                    .header("Authorization", "Bearer $token")
            )
                .andExpect(status().isOk)
                .andExpect(jsonPath("$.email").value("session@test.com"))
                .andExpect(jsonPath("$.isVerified").value(true))
        }
    }
}
