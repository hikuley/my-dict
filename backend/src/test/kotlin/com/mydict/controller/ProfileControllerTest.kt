package com.mydict.controller

import com.mydict.dto.*
import com.mydict.entity.AuthType
import com.mydict.entity.User
import com.mydict.repository.UserRepository
import com.mydict.security.JwtTokenProvider
import com.mydict.service.AuthException
import com.mydict.service.AuthService
import org.junit.jupiter.api.AfterEach
import org.junit.jupiter.api.BeforeEach
import org.junit.jupiter.api.Nested
import org.junit.jupiter.api.Test
import org.mockito.kotlin.any
import org.mockito.kotlin.eq
import org.mockito.kotlin.whenever
import org.springframework.beans.factory.annotation.Autowired
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc
import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest
import org.springframework.boot.test.mock.mockito.MockBean
import org.springframework.http.MediaType
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken
import org.springframework.security.core.context.SecurityContextHolder
import org.springframework.test.web.servlet.MockMvc
import org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*
import org.springframework.test.web.servlet.result.MockMvcResultMatchers.*
import java.time.OffsetDateTime
import java.util.*

@WebMvcTest(ProfileController::class)
@AutoConfigureMockMvc(addFilters = false)
class ProfileControllerTest {

    @Autowired
    private lateinit var mockMvc: MockMvc

    @MockBean
    private lateinit var authService: AuthService

    @MockBean
    private lateinit var jwtTokenProvider: JwtTokenProvider

    @MockBean
    private lateinit var userRepository: UserRepository

    private val testUserId = UUID.randomUUID()
    private val testUser = User(
        id = testUserId,
        fullName = "Test User",
        surname = "Surname",
        email = "test@example.com",
        authType = AuthType.manual,
        isVerified = true,
    )

    @BeforeEach
    fun setUpSecurityContext() {
        val auth = UsernamePasswordAuthenticationToken(testUser, null, emptyList())
        SecurityContextHolder.getContext().authentication = auth
    }

    @AfterEach
    fun clearSecurityContext() {
        SecurityContextHolder.clearContext()
    }

    @Nested
    inner class GetProfileTests {
        @Test
        fun `returns profile for authenticated user`() {
            val profile = ProfileResponse(
                id = testUserId,
                name = "Test User",
                surname = "Surname",
                email = "test@example.com",
                authType = "manual",
                isVerified = true,
                usageCount = 10,
                usageLimit = 50,
                periodStart = OffsetDateTime.now(),
            )
            whenever(authService.getProfile(testUserId)).thenReturn(profile)

            mockMvc.perform(get("/api/profile"))
                .andExpect(status().isOk)
                .andExpect(jsonPath("$.name").value("Test User"))
                .andExpect(jsonPath("$.surname").value("Surname"))
                .andExpect(jsonPath("$.usageCount").value(10))
                .andExpect(jsonPath("$.usageLimit").value(50))
        }

        @Test
        fun `returns 401 for unauthenticated request`() {
            SecurityContextHolder.clearContext()
            mockMvc.perform(get("/api/profile"))
                .andExpect(status().isUnauthorized)
        }
    }

    @Nested
    inner class UpdateProfileTests {
        @Test
        fun `updates profile successfully`() {
            val profile = ProfileResponse(
                id = testUserId,
                name = "New Name",
                surname = "New Surname",
                email = "test@example.com",
                authType = "manual",
                isVerified = true,
                usageCount = 10,
                usageLimit = 50,
                periodStart = OffsetDateTime.now(),
            )
            whenever(authService.updateProfile(eq(testUserId), any())).thenReturn(profile)

            mockMvc.perform(
                put("/api/profile")
                    .contentType(MediaType.APPLICATION_JSON)
                    .content("""{"name": "New Name", "surname": "New Surname"}""")
            )
                .andExpect(status().isOk)
                .andExpect(jsonPath("$.name").value("New Name"))
                .andExpect(jsonPath("$.surname").value("New Surname"))
        }

        @Test
        fun `returns 400 for validation error`() {
            whenever(authService.updateProfile(eq(testUserId), any())).thenThrow(AuthException("Name is required"))

            mockMvc.perform(
                put("/api/profile")
                    .contentType(MediaType.APPLICATION_JSON)
                    .content("""{"name": ""}""")
            )
                .andExpect(status().isBadRequest)
                .andExpect(jsonPath("$.error").value("Name is required"))
        }
    }

    @Nested
    inner class UpdatePasswordTests {
        @Test
        fun `updates password successfully`() {
            mockMvc.perform(
                put("/api/profile/password")
                    .contentType(MediaType.APPLICATION_JSON)
                    .content("""{"currentPassword": "oldPass123", "newPassword": "newPass456"}""")
            )
                .andExpect(status().isOk)
                .andExpect(jsonPath("$.message").value("Password updated successfully"))
        }

        @Test
        fun `returns 400 for wrong current password`() {
            whenever(authService.updatePassword(eq(testUserId), any())).thenThrow(AuthException("Current password is incorrect"))

            mockMvc.perform(
                put("/api/profile/password")
                    .contentType(MediaType.APPLICATION_JSON)
                    .content("""{"currentPassword": "wrong", "newPassword": "newPass456"}""")
            )
                .andExpect(status().isBadRequest)
                .andExpect(jsonPath("$.error").value("Current password is incorrect"))
        }
    }

    @Nested
    inner class EmailChangeTests {
        @Test
        fun `initiates email change successfully`() {
            mockMvc.perform(
                post("/api/profile/email")
                    .contentType(MediaType.APPLICATION_JSON)
                    .content("""{"newEmail": "new@example.com"}""")
            )
                .andExpect(status().isOk)
                .andExpect(jsonPath("$.message").value("Verification code sent to new email"))
        }

        @Test
        fun `returns 400 for duplicate email`() {
            whenever(authService.initiateEmailChange(eq(testUserId), any())).thenThrow(AuthException("An account with this email already exists"))

            mockMvc.perform(
                post("/api/profile/email")
                    .contentType(MediaType.APPLICATION_JSON)
                    .content("""{"newEmail": "taken@example.com"}""")
            )
                .andExpect(status().isBadRequest)
                .andExpect(jsonPath("$.error").value("An account with this email already exists"))
        }

        @Test
        fun `verifies email change successfully`() {
            val profile = ProfileResponse(
                id = testUserId,
                name = "Test User",
                surname = "Surname",
                email = "new@example.com",
                authType = "manual",
                isVerified = true,
                usageCount = 10,
                usageLimit = 50,
                periodStart = OffsetDateTime.now(),
            )
            whenever(authService.verifyEmailChange(eq(testUserId), any())).thenReturn(profile)

            mockMvc.perform(
                post("/api/profile/email/verify")
                    .contentType(MediaType.APPLICATION_JSON)
                    .content("""{"code": "123456"}""")
            )
                .andExpect(status().isOk)
                .andExpect(jsonPath("$.email").value("new@example.com"))
        }

        @Test
        fun `returns 400 for wrong verification code`() {
            whenever(authService.verifyEmailChange(eq(testUserId), any())).thenThrow(AuthException("Invalid verification code"))

            mockMvc.perform(
                post("/api/profile/email/verify")
                    .contentType(MediaType.APPLICATION_JSON)
                    .content("""{"code": "999999"}""")
            )
                .andExpect(status().isBadRequest)
                .andExpect(jsonPath("$.error").value("Invalid verification code"))
        }
    }
}
