package com.mydict.service

import com.mydict.dto.*
import com.mydict.entity.AuthType
import com.mydict.entity.User
import com.mydict.repository.UserRepository
import com.mydict.security.JwtTokenProvider
import org.junit.jupiter.api.Assertions.*
import org.junit.jupiter.api.BeforeEach
import org.junit.jupiter.api.Nested
import org.junit.jupiter.api.Test
import org.junit.jupiter.api.extension.ExtendWith
import org.mockito.ArgumentCaptor
import org.mockito.Captor
import org.mockito.Mock
import org.mockito.junit.jupiter.MockitoExtension
import org.mockito.kotlin.*
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder
import java.time.OffsetDateTime
import java.util.*

@ExtendWith(MockitoExtension::class)
class AuthServiceTest {

    @Mock
    private lateinit var userRepository: UserRepository

    @Mock
    private lateinit var jwtTokenProvider: JwtTokenProvider

    @Mock
    private lateinit var emailService: EmailService

    @Mock
    private lateinit var googleOAuthService: GoogleOAuthService

    @Mock
    private lateinit var apiUsageService: ApiUsageService

    @Captor
    private lateinit var userCaptor: ArgumentCaptor<User>

    private val passwordEncoder = BCryptPasswordEncoder()
    private lateinit var authService: AuthService

    @BeforeEach
    fun setUp() {
        authService = AuthService(
            userRepository, passwordEncoder, jwtTokenProvider,
            emailService, googleOAuthService, apiUsageService,
        )
    }

    @Nested
    inner class SignUpTests {
        @Test
        fun `successful sign-up with valid credentials`() {
            whenever(userRepository.existsByEmail("test@example.com")).thenReturn(false)
            whenever(userRepository.save(any<User>())).thenAnswer {
                val user = it.arguments[0] as User
                user.id = UUID.randomUUID()
                user
            }
            whenever(jwtTokenProvider.generateToken(any<UUID>(), any<String>())).thenReturn("test-token")

            val response = authService.signUp(SignUpRequest("Test User", "test@example.com", "password123"))

            assertNotNull(response.token)
            assertEquals("test@example.com", response.user.email)
            assertEquals("Test User", response.user.name)
            assertEquals("manual", response.user.authType)
            assertFalse(response.user.isVerified)

            verify(userRepository).save(userCaptor.capture())
            val savedUser = userCaptor.value
            assertEquals(AuthType.manual, savedUser.authType)
            assertNotNull(savedUser.passwordHash)
            assertNotNull(savedUser.verificationCode)
            assertEquals(6, savedUser.verificationCode!!.length)
            assertNotNull(savedUser.verificationExpiry)
        }

        @Test
        fun `sign-up stores verification code in DB`() {
            whenever(userRepository.existsByEmail(any())).thenReturn(false)
            whenever(userRepository.save(any<User>())).thenAnswer {
                val user = it.arguments[0] as User
                user.id = UUID.randomUUID()
                user
            }
            whenever(jwtTokenProvider.generateToken(any<UUID>(), any<String>())).thenReturn("token")

            authService.signUp(SignUpRequest("User", "user@test.com", "password123"))

            verify(userRepository).save(userCaptor.capture())
            assertNotNull(userCaptor.value.verificationCode)
            assertTrue(userCaptor.value.verificationCode!!.matches(Regex("\\d{6}")))
        }

        @Test
        fun `sign-up sends verification code to correct email`() {
            whenever(userRepository.existsByEmail(any())).thenReturn(false)
            whenever(userRepository.save(any<User>())).thenAnswer {
                val user = it.arguments[0] as User
                user.id = UUID.randomUUID()
                user
            }
            whenever(jwtTokenProvider.generateToken(any<UUID>(), any<String>())).thenReturn("token")

            authService.signUp(SignUpRequest("User", "user@test.com", "password123"))

            verify(emailService).sendVerificationCode(eq("user@test.com"), argThat { matches(Regex("\\d{6}")) })
        }

        @Test
        fun `sign-up rejects missing name`() {
            val exception = assertThrows(AuthException::class.java) {
                authService.signUp(SignUpRequest(null, "test@example.com", "password123"))
            }
            assertEquals("Name is required", exception.message)
        }

        @Test
        fun `sign-up rejects blank name`() {
            val exception = assertThrows(AuthException::class.java) {
                authService.signUp(SignUpRequest("  ", "test@example.com", "password123"))
            }
            assertEquals("Name is required", exception.message)
        }

        @Test
        fun `sign-up rejects invalid email format`() {
            val exception = assertThrows(AuthException::class.java) {
                authService.signUp(SignUpRequest("User", "not-an-email", "password123"))
            }
            assertEquals("Invalid email format", exception.message)
        }

        @Test
        fun `sign-up rejects missing email`() {
            val exception = assertThrows(AuthException::class.java) {
                authService.signUp(SignUpRequest("User", null, "password123"))
            }
            assertEquals("Email is required", exception.message)
        }

        @Test
        fun `sign-up rejects weak password`() {
            val exception = assertThrows(AuthException::class.java) {
                authService.signUp(SignUpRequest("User", "test@example.com", "short"))
            }
            assertEquals("Password must be at least 8 characters", exception.message)
        }

        @Test
        fun `sign-up rejects missing password`() {
            val exception = assertThrows(AuthException::class.java) {
                authService.signUp(SignUpRequest("User", "test@example.com", null))
            }
            assertEquals("Password is required", exception.message)
        }

        @Test
        fun `sign-up rejects duplicate email`() {
            whenever(userRepository.existsByEmail("test@example.com")).thenReturn(true)

            val exception = assertThrows(AuthException::class.java) {
                authService.signUp(SignUpRequest("User", "test@example.com", "password123"))
            }
            assertEquals("An account with this email already exists", exception.message)
        }
    }

    @Nested
    inner class LoginTests {
        @Test
        fun `successful login with existing credentials`() {
            val userId = UUID.randomUUID()
            val user = User(
                id = userId,
                fullName = "Test User",
                email = "test@example.com",
                passwordHash = passwordEncoder.encode("password123"),
                authType = AuthType.manual,
                isVerified = true,
            )
            whenever(userRepository.findByEmail("test@example.com")).thenReturn(user)
            whenever(jwtTokenProvider.generateToken(userId, "test@example.com")).thenReturn("login-token")
            val response = authService.login(LoginRequest("test@example.com", "password123"))

            assertEquals("login-token", response.token)
            assertEquals("test@example.com", response.user.email)
            assertEquals("manual", response.user.authType)
        }

        @Test
        fun `login rejects incorrect password`() {
            val user = User(
                id = UUID.randomUUID(),
                email = "test@example.com",
                passwordHash = passwordEncoder.encode("correct-password"),
                authType = AuthType.manual,
            )
            whenever(userRepository.findByEmail("test@example.com")).thenReturn(user)

            val exception = assertThrows(AuthException::class.java) {
                authService.login(LoginRequest("test@example.com", "wrong-password"))
            }
            assertEquals("Invalid email or password", exception.message)
        }

        @Test
        fun `login rejects non-existent email`() {
            whenever(userRepository.findByEmail("unknown@example.com")).thenReturn(null)

            val exception = assertThrows(AuthException::class.java) {
                authService.login(LoginRequest("unknown@example.com", "password123"))
            }
            assertEquals("Invalid email or password", exception.message)
        }

        @Test
        fun `login rejects Google auth user trying email login`() {
            val user = User(
                id = UUID.randomUUID(),
                email = "google@example.com",
                authType = AuthType.google,
                googleId = "google-123",
            )
            whenever(userRepository.findByEmail("google@example.com")).thenReturn(user)

            val exception = assertThrows(AuthException::class.java) {
                authService.login(LoginRequest("google@example.com", "password123"))
            }
            assertEquals("This account uses Google sign-in", exception.message)
        }

        @Test
        fun `login rejects missing email`() {
            val exception = assertThrows(AuthException::class.java) {
                authService.login(LoginRequest(null, "password123"))
            }
            assertEquals("Email is required", exception.message)
        }

        @Test
        fun `login rejects missing password`() {
            val exception = assertThrows(AuthException::class.java) {
                authService.login(LoginRequest("test@example.com", null))
            }
            assertEquals("Password is required", exception.message)
        }
    }

    @Nested
    inner class VerifyEmailTests {
        @Test
        fun `successful verification with valid non-expired code`() {
            val user = User(
                id = UUID.randomUUID(),
                email = "test@example.com",
                authType = AuthType.manual,
                isVerified = false,
                verificationCode = "123456",
                verificationExpiry = OffsetDateTime.now().plusMinutes(10),
            )
            whenever(userRepository.findByEmail("test@example.com")).thenReturn(user)
            whenever(userRepository.save(any<User>())).thenAnswer { it.arguments[0] }

            val response = authService.verifyEmail(VerifyEmailRequest("test@example.com", "123456"))

            assertEquals("Email verified successfully", response.message)
            verify(userRepository).save(userCaptor.capture())
            assertTrue(userCaptor.value.isVerified)
            assertNull(userCaptor.value.verificationCode)
            assertNull(userCaptor.value.verificationExpiry)
        }

        @Test
        fun `rejects invalid verification code`() {
            val user = User(
                id = UUID.randomUUID(),
                email = "test@example.com",
                verificationCode = "123456",
                verificationExpiry = OffsetDateTime.now().plusMinutes(10),
            )
            whenever(userRepository.findByEmail("test@example.com")).thenReturn(user)

            val exception = assertThrows(AuthException::class.java) {
                authService.verifyEmail(VerifyEmailRequest("test@example.com", "999999"))
            }
            assertEquals("Invalid verification code", exception.message)
        }

        @Test
        fun `rejects expired verification code`() {
            val user = User(
                id = UUID.randomUUID(),
                email = "test@example.com",
                verificationCode = "123456",
                verificationExpiry = OffsetDateTime.now().minusMinutes(5),
            )
            whenever(userRepository.findByEmail("test@example.com")).thenReturn(user)

            val exception = assertThrows(AuthException::class.java) {
                authService.verifyEmail(VerifyEmailRequest("test@example.com", "123456"))
            }
            assertEquals("Verification code has expired", exception.message)
        }

        @Test
        fun `already verified email returns success message`() {
            val user = User(
                id = UUID.randomUUID(),
                email = "test@example.com",
                isVerified = true,
            )
            whenever(userRepository.findByEmail("test@example.com")).thenReturn(user)

            val response = authService.verifyEmail(VerifyEmailRequest("test@example.com", "123456"))
            assertEquals("Email already verified", response.message)
        }

        @Test
        fun `rejects verification for non-existent user`() {
            whenever(userRepository.findByEmail("unknown@test.com")).thenReturn(null)

            val exception = assertThrows(AuthException::class.java) {
                authService.verifyEmail(VerifyEmailRequest("unknown@test.com", "123456"))
            }
            assertEquals("User not found", exception.message)
        }
    }

    @Nested
    inner class ResendVerificationTests {
        @Test
        fun `resend issues a new code replacing old one`() {
            val user = User(
                id = UUID.randomUUID(),
                email = "test@example.com",
                verificationCode = "111111",
                verificationExpiry = OffsetDateTime.now().minusMinutes(5),
            )
            whenever(userRepository.findByEmail("test@example.com")).thenReturn(user)
            whenever(userRepository.save(any<User>())).thenAnswer { it.arguments[0] }

            authService.resendVerification(ResendVerificationRequest("test@example.com"))

            verify(userRepository).save(userCaptor.capture())
            val savedUser = userCaptor.value
            assertNotNull(savedUser.verificationCode)
            assertNotEquals("111111", savedUser.verificationCode)
            assertNotNull(savedUser.verificationExpiry)
            assertTrue(savedUser.verificationExpiry!!.isAfter(OffsetDateTime.now()))

            verify(emailService).sendVerificationCode(eq("test@example.com"), any())
        }

        @Test
        fun `resend returns success for already verified user`() {
            val user = User(
                id = UUID.randomUUID(),
                email = "test@example.com",
                isVerified = true,
            )
            whenever(userRepository.findByEmail("test@example.com")).thenReturn(user)

            val response = authService.resendVerification(ResendVerificationRequest("test@example.com"))
            assertEquals("Email already verified", response.message)
            verify(emailService, never()).sendVerificationCode(any(), any())
        }
    }

    @Nested
    inner class GoogleAuthTests {
        @Test
        fun `successful Google sign-in with new user`() {
            val googleInfo = GoogleUserInfo("google-123", "google@test.com", "Google User")
            whenever(googleOAuthService.verifyIdToken("valid-token")).thenReturn(googleInfo)
            whenever(userRepository.findByGoogleId("google-123")).thenReturn(null)
            whenever(userRepository.findByEmail("google@test.com")).thenReturn(null)
            whenever(userRepository.save(any<User>())).thenAnswer {
                val user = it.arguments[0] as User
                user.id = UUID.randomUUID()
                user
            }
            whenever(jwtTokenProvider.generateToken(any<UUID>(), any<String>())).thenReturn("google-token")

            val response = authService.googleAuth(GoogleAuthRequest("valid-token"))

            assertEquals("google-token", response.token)
            assertEquals("google", response.user.authType)
            assertTrue(response.user.isVerified)
            assertEquals("Google User", response.user.name)

            verify(userRepository).save(userCaptor.capture())
            val savedUser = userCaptor.value
            assertEquals(AuthType.google, savedUser.authType)
            assertTrue(savedUser.isVerified)
            assertEquals("google-123", savedUser.googleId)
            assertNull(savedUser.passwordHash)
        }

        @Test
        fun `Google sign-in with existing Google user returns token`() {
            val existingUser = User(
                id = UUID.randomUUID(),
                fullName = "Google User",
                email = "google@test.com",
                authType = AuthType.google,
                googleId = "google-123",
                isVerified = true,
            )
            val googleInfo = GoogleUserInfo("google-123", "google@test.com", "Google User")
            whenever(googleOAuthService.verifyIdToken("valid-token")).thenReturn(googleInfo)
            whenever(userRepository.findByGoogleId("google-123")).thenReturn(existingUser)
            whenever(jwtTokenProvider.generateToken(existingUser.id!!, "google@test.com")).thenReturn("existing-token")

            val response = authService.googleAuth(GoogleAuthRequest("valid-token"))

            assertEquals("existing-token", response.token)
            verify(userRepository, never()).save(any())
        }

        @Test
        fun `Google auth rejects invalid ID token`() {
            whenever(googleOAuthService.verifyIdToken("invalid-token")).thenReturn(null)

            val exception = assertThrows(AuthException::class.java) {
                authService.googleAuth(GoogleAuthRequest("invalid-token"))
            }
            assertEquals("Invalid Google ID token", exception.message)
        }

        @Test
        fun `Google auth rejects when email already registered with manual auth`() {
            val googleInfo = GoogleUserInfo("google-456", "existing@test.com", "User")
            whenever(googleOAuthService.verifyIdToken("valid-token")).thenReturn(googleInfo)
            whenever(userRepository.findByGoogleId("google-456")).thenReturn(null)
            whenever(userRepository.findByEmail("existing@test.com")).thenReturn(
                User(id = UUID.randomUUID(), email = "existing@test.com", authType = AuthType.manual)
            )

            val exception = assertThrows(AuthException::class.java) {
                authService.googleAuth(GoogleAuthRequest("valid-token"))
            }
            assertTrue(exception.message!!.contains("already exists"))
        }

        @Test
        fun `Google auth rejects missing ID token`() {
            val exception = assertThrows(AuthException::class.java) {
                authService.googleAuth(GoogleAuthRequest(null))
            }
            assertEquals("Google ID token is required", exception.message)
        }
    }

    @Nested
    inner class VerificationCodeGenerationTests {
        @Test
        fun `generates 6-digit code`() {
            val code = authService.generateVerificationCode()
            assertEquals(6, code.length)
            assertTrue(code.all { it.isDigit() })
        }

        @Test
        fun `generates different codes`() {
            val codes = (1..10).map { authService.generateVerificationCode() }.toSet()
            assertTrue(codes.size > 1, "Should generate different codes")
        }
    }

    @Nested
    inner class SignUpUsageInitTests {
        @Test
        fun `sign-up initializes API usage for new user`() {
            whenever(userRepository.existsByEmail("test@example.com")).thenReturn(false)
            whenever(userRepository.save(any<User>())).thenAnswer {
                val user = it.arguments[0] as User
                user.id = UUID.randomUUID()
                user
            }
            whenever(jwtTokenProvider.generateToken(any<UUID>(), any<String>())).thenReturn("token")

            authService.signUp(SignUpRequest("User", "test@example.com", "password123"))

            verify(apiUsageService).initializeUsage(any<UUID>())
        }
    }

    @Nested
    inner class GoogleAuthUsageInitTests {
        @Test
        fun `Google auth initializes API usage for new user`() {
            val googleInfo = GoogleUserInfo("google-123", "google@test.com", "Google User")
            whenever(googleOAuthService.verifyIdToken("valid-token")).thenReturn(googleInfo)
            whenever(userRepository.findByGoogleId("google-123")).thenReturn(null)
            whenever(userRepository.findByEmail("google@test.com")).thenReturn(null)
            whenever(userRepository.save(any<User>())).thenAnswer {
                val user = it.arguments[0] as User
                user.id = UUID.randomUUID()
                user
            }
            whenever(jwtTokenProvider.generateToken(any<UUID>(), any<String>())).thenReturn("token")

            authService.googleAuth(GoogleAuthRequest("valid-token"))

            verify(apiUsageService).initializeUsage(any<UUID>())
        }

        @Test
        fun `Google auth does not initialize usage for existing user`() {
            val existingUser = User(
                id = UUID.randomUUID(),
                fullName = "Google User",
                email = "google@test.com",
                authType = AuthType.google,
                googleId = "google-123",
                isVerified = true,
            )
            whenever(googleOAuthService.verifyIdToken("valid-token")).thenReturn(
                GoogleUserInfo("google-123", "google@test.com", "Google User")
            )
            whenever(userRepository.findByGoogleId("google-123")).thenReturn(existingUser)
            whenever(jwtTokenProvider.generateToken(existingUser.id!!, "google@test.com")).thenReturn("token")

            authService.googleAuth(GoogleAuthRequest("valid-token"))

            verify(apiUsageService, never()).initializeUsage(any())
        }
    }

    @Nested
    inner class UpdateProfileTests {
        private val userId = UUID.randomUUID()
        private val existingUser = User(
            id = userId,
            fullName = "Old Name",
            surname = null,
            email = "test@example.com",
            authType = AuthType.manual,
            isVerified = true,
        )

        @Test
        fun `updates name and surname`() {
            whenever(userRepository.findById(userId)).thenReturn(Optional.of(existingUser))
            whenever(userRepository.save(any<User>())).thenAnswer { it.arguments[0] }
            whenever(apiUsageService.getUsage(userId)).thenReturn(
                ApiUsageResponse(5, 50, OffsetDateTime.now())
            )

            val result = authService.updateProfile(userId, UpdateProfileRequest("New Name", "New Surname"))

            assertEquals("New Name", result.name)
            assertEquals("New Surname", result.surname)
            verify(userRepository).save(userCaptor.capture())
            assertEquals("New Name", userCaptor.value.fullName)
            assertEquals("New Surname", userCaptor.value.surname)
        }

        @Test
        fun `rejects missing name`() {
            val exception = assertThrows(AuthException::class.java) {
                authService.updateProfile(userId, UpdateProfileRequest(null, null))
            }
            assertEquals("Name is required", exception.message)
        }

        @Test
        fun `rejects blank name`() {
            val exception = assertThrows(AuthException::class.java) {
                authService.updateProfile(userId, UpdateProfileRequest("  ", null))
            }
            assertEquals("Name is required", exception.message)
        }
    }

    @Nested
    inner class UpdatePasswordTests {
        private val userId = UUID.randomUUID()
        private val passwordEncoder2 = BCryptPasswordEncoder()

        @Test
        fun `updates password with correct current password`() {
            val user = User(
                id = userId,
                fullName = "User",
                email = "test@example.com",
                passwordHash = passwordEncoder2.encode("oldPassword123"),
                authType = AuthType.manual,
                isVerified = true,
            )
            whenever(userRepository.findById(userId)).thenReturn(Optional.of(user))
            whenever(userRepository.save(any<User>())).thenAnswer { it.arguments[0] }

            authService.updatePassword(userId, UpdatePasswordRequest("oldPassword123", "newPassword456"))

            verify(userRepository).save(userCaptor.capture())
            assertTrue(passwordEncoder2.matches("newPassword456", userCaptor.value.passwordHash))
        }

        @Test
        fun `rejects incorrect current password`() {
            val user = User(
                id = userId,
                fullName = "User",
                email = "test@example.com",
                passwordHash = passwordEncoder2.encode("correctPassword"),
                authType = AuthType.manual,
            )
            whenever(userRepository.findById(userId)).thenReturn(Optional.of(user))

            val exception = assertThrows(AuthException::class.java) {
                authService.updatePassword(userId, UpdatePasswordRequest("wrongPassword", "newPassword456"))
            }
            assertEquals("Current password is incorrect", exception.message)
        }

        @Test
        fun `rejects weak new password`() {
            val exception = assertThrows(AuthException::class.java) {
                authService.updatePassword(userId, UpdatePasswordRequest("currentPassword", "short"))
            }
            assertEquals("New password must be at least 8 characters", exception.message)
        }

        @Test
        fun `rejects password change for Google users`() {
            val user = User(
                id = userId,
                fullName = "Google User",
                email = "google@test.com",
                authType = AuthType.google,
                googleId = "g-123",
            )
            whenever(userRepository.findById(userId)).thenReturn(Optional.of(user))

            val exception = assertThrows(AuthException::class.java) {
                authService.updatePassword(userId, UpdatePasswordRequest("password", "newPassword456"))
            }
            assertEquals("Password change is not available for Google accounts", exception.message)
        }
    }

    @Nested
    inner class EmailChangeTests {
        private val userId = UUID.randomUUID()

        @Test
        fun `initiates email change successfully`() {
            val user = User(
                id = userId,
                fullName = "User",
                email = "old@test.com",
                authType = AuthType.manual,
                isVerified = true,
            )
            whenever(userRepository.findById(userId)).thenReturn(Optional.of(user))
            whenever(userRepository.existsByEmail("new@test.com")).thenReturn(false)
            whenever(userRepository.save(any<User>())).thenAnswer { it.arguments[0] }

            authService.initiateEmailChange(userId, UpdateEmailRequest("new@test.com"))

            verify(userRepository).save(userCaptor.capture())
            assertEquals("new@test.com", userCaptor.value.pendingEmail)
            assertNotNull(userCaptor.value.emailVerificationCode)
            assertNotNull(userCaptor.value.emailVerificationExpiry)
            verify(emailService).sendVerificationCode(eq("new@test.com"), any())
        }

        @Test
        fun `rejects same email`() {
            val user = User(
                id = userId,
                fullName = "User",
                email = "same@test.com",
                authType = AuthType.manual,
            )
            whenever(userRepository.findById(userId)).thenReturn(Optional.of(user))

            val exception = assertThrows(AuthException::class.java) {
                authService.initiateEmailChange(userId, UpdateEmailRequest("same@test.com"))
            }
            assertEquals("New email is the same as current email", exception.message)
        }

        @Test
        fun `rejects taken email`() {
            val user = User(
                id = userId,
                fullName = "User",
                email = "old@test.com",
                authType = AuthType.manual,
            )
            whenever(userRepository.findById(userId)).thenReturn(Optional.of(user))
            whenever(userRepository.existsByEmail("taken@test.com")).thenReturn(true)

            val exception = assertThrows(AuthException::class.java) {
                authService.initiateEmailChange(userId, UpdateEmailRequest("taken@test.com"))
            }
            assertEquals("An account with this email already exists", exception.message)
        }

        @Test
        fun `rejects invalid email format`() {
            val user = User(
                id = userId,
                fullName = "User",
                email = "old@test.com",
                authType = AuthType.manual,
            )
            // findById won't be called because validation fails first
            val exception = assertThrows(AuthException::class.java) {
                authService.initiateEmailChange(userId, UpdateEmailRequest("not-an-email"))
            }
            assertEquals("Invalid email format", exception.message)
        }

        @Test
        fun `verifies email change with correct code`() {
            val user = User(
                id = userId,
                fullName = "User",
                email = "old@test.com",
                pendingEmail = "new@test.com",
                emailVerificationCode = "123456",
                emailVerificationExpiry = OffsetDateTime.now().plusMinutes(10),
                authType = AuthType.manual,
                isVerified = true,
            )
            whenever(userRepository.findById(userId)).thenReturn(Optional.of(user))
            whenever(userRepository.existsByEmail("new@test.com")).thenReturn(false)
            whenever(userRepository.save(any<User>())).thenAnswer { it.arguments[0] }
            whenever(apiUsageService.getUsage(userId)).thenReturn(
                ApiUsageResponse(5, 50, OffsetDateTime.now())
            )

            val result = authService.verifyEmailChange(userId, VerifyEmailChangeRequest("123456"))

            assertEquals("new@test.com", result.email)
            verify(userRepository).save(userCaptor.capture())
            assertEquals("new@test.com", userCaptor.value.email)
            assertNull(userCaptor.value.pendingEmail)
            assertNull(userCaptor.value.emailVerificationCode)
            assertNull(userCaptor.value.emailVerificationExpiry)
        }

        @Test
        fun `rejects wrong verification code`() {
            val user = User(
                id = userId,
                fullName = "User",
                email = "old@test.com",
                pendingEmail = "new@test.com",
                emailVerificationCode = "123456",
                emailVerificationExpiry = OffsetDateTime.now().plusMinutes(10),
                authType = AuthType.manual,
            )
            whenever(userRepository.findById(userId)).thenReturn(Optional.of(user))

            val exception = assertThrows(AuthException::class.java) {
                authService.verifyEmailChange(userId, VerifyEmailChangeRequest("999999"))
            }
            assertEquals("Invalid verification code", exception.message)
        }

        @Test
        fun `rejects expired verification code`() {
            val user = User(
                id = userId,
                fullName = "User",
                email = "old@test.com",
                pendingEmail = "new@test.com",
                emailVerificationCode = "123456",
                emailVerificationExpiry = OffsetDateTime.now().minusMinutes(5),
                authType = AuthType.manual,
            )
            whenever(userRepository.findById(userId)).thenReturn(Optional.of(user))

            val exception = assertThrows(AuthException::class.java) {
                authService.verifyEmailChange(userId, VerifyEmailChangeRequest("123456"))
            }
            assertEquals("Verification code has expired", exception.message)
        }

        @Test
        fun `rejects when no pending email change`() {
            val user = User(
                id = userId,
                fullName = "User",
                email = "test@test.com",
                authType = AuthType.manual,
            )
            whenever(userRepository.findById(userId)).thenReturn(Optional.of(user))

            val exception = assertThrows(AuthException::class.java) {
                authService.verifyEmailChange(userId, VerifyEmailChangeRequest("123456"))
            }
            assertEquals("No pending email change", exception.message)
        }
    }
}
