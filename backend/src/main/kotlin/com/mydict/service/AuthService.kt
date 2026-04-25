package com.mydict.service

import com.mydict.dto.*
import com.mydict.entity.AuthType
import com.mydict.entity.User
import com.mydict.repository.UserRepository
import com.mydict.security.JwtTokenProvider
import org.slf4j.LoggerFactory
import org.springframework.security.crypto.password.PasswordEncoder
import org.springframework.stereotype.Service
import org.springframework.transaction.annotation.Transactional
import java.security.SecureRandom
import java.time.OffsetDateTime

@Service
class AuthService(
    private val userRepository: UserRepository,
    private val passwordEncoder: PasswordEncoder,
    private val jwtTokenProvider: JwtTokenProvider,
    private val emailService: EmailService,
    private val googleOAuthService: GoogleOAuthService,
) {
    private val log = LoggerFactory.getLogger(javaClass)
    private val secureRandom = SecureRandom()

    companion object {
        private val EMAIL_REGEX = Regex("^[A-Za-z0-9+_.-]+@[A-Za-z0-9.-]+\\.[A-Za-z]{2,}$")
        private const val MIN_PASSWORD_LENGTH = 8
        private const val VERIFICATION_CODE_EXPIRY_MINUTES = 15L
    }

    @Transactional
    fun signUp(request: SignUpRequest): AuthResponse {
        val name = request.name?.trim() ?: throw AuthException("Name is required")
        val email = request.email?.trim()?.lowercase() ?: throw AuthException("Email is required")
        val password = request.password ?: throw AuthException("Password is required")

        if (name.isBlank()) throw AuthException("Name is required")
        if (!EMAIL_REGEX.matches(email)) throw AuthException("Invalid email format")
        if (password.length < MIN_PASSWORD_LENGTH) throw AuthException("Password must be at least $MIN_PASSWORD_LENGTH characters")

        if (userRepository.existsByEmail(email)) {
            throw AuthException("An account with this email already exists")
        }

        val verificationCode = generateVerificationCode()
        val user = User(
            fullName = name,
            email = email,
            passwordHash = passwordEncoder.encode(password),
            authType = AuthType.manual,
            isVerified = false,
            verificationCode = verificationCode,
            verificationExpiry = OffsetDateTime.now().plusMinutes(VERIFICATION_CODE_EXPIRY_MINUTES),
        )

        val savedUser = userRepository.save(user)
        log.info("[auth] User signed up: ${savedUser.email}")

        try {
            emailService.sendVerificationCode(savedUser.email, verificationCode)
        } catch (e: Exception) {
            log.warn("[auth] Failed to send verification email to ${savedUser.email}: ${e.message}")
        }

        val token = jwtTokenProvider.generateToken(savedUser.id!!, savedUser.email)
        return AuthResponse(token, toUserResponse(savedUser))
    }

    fun login(request: LoginRequest): AuthResponse {
        val email = request.email?.trim()?.lowercase() ?: throw AuthException("Email is required")
        val password = request.password ?: throw AuthException("Password is required")

        val user = userRepository.findByEmail(email)
            ?: throw AuthException("Invalid email or password")

        if (user.authType != AuthType.manual) {
            throw AuthException("This account uses Google sign-in")
        }

        if (!passwordEncoder.matches(password, user.passwordHash)) {
            throw AuthException("Invalid email or password")
        }

        val token = jwtTokenProvider.generateToken(user.id!!, user.email)
        return AuthResponse(token, toUserResponse(user))
    }

    @Transactional
    fun verifyEmail(request: VerifyEmailRequest): VerificationResponse {
        val email = request.email?.trim()?.lowercase() ?: throw AuthException("Email is required")
        val code = request.code?.trim() ?: throw AuthException("Verification code is required")

        val user = userRepository.findByEmail(email)
            ?: throw AuthException("User not found")

        if (user.isVerified) {
            return VerificationResponse("Email already verified")
        }

        if (user.verificationCode != code) {
            throw AuthException("Invalid verification code")
        }

        if (user.verificationExpiry != null && OffsetDateTime.now().isAfter(user.verificationExpiry)) {
            throw AuthException("Verification code has expired")
        }

        user.isVerified = true
        user.verificationCode = null
        user.verificationExpiry = null
        userRepository.save(user)

        log.info("[auth] Email verified: ${user.email}")
        return VerificationResponse("Email verified successfully")
    }

    @Transactional
    fun resendVerification(request: ResendVerificationRequest): VerificationResponse {
        val email = request.email?.trim()?.lowercase() ?: throw AuthException("Email is required")

        val user = userRepository.findByEmail(email)
            ?: throw AuthException("User not found")

        if (user.isVerified) {
            return VerificationResponse("Email already verified")
        }

        val verificationCode = generateVerificationCode()
        user.verificationCode = verificationCode
        user.verificationExpiry = OffsetDateTime.now().plusMinutes(VERIFICATION_CODE_EXPIRY_MINUTES)
        userRepository.save(user)

        emailService.sendVerificationCode(user.email, verificationCode)

        log.info("[auth] Verification code resent: ${user.email}")
        return VerificationResponse("Verification code sent")
    }

    @Transactional
    fun googleAuth(request: GoogleAuthRequest): AuthResponse {
        val idToken = request.idToken ?: throw AuthException("Google ID token is required")

        val googleUserInfo = googleOAuthService.verifyIdToken(idToken)
            ?: throw AuthException("Invalid Google ID token")

        // Check if user already exists by Google ID
        var user = userRepository.findByGoogleId(googleUserInfo.googleId)

        if (user == null) {
            // Check if email is already registered with manual auth
            val existingUser = userRepository.findByEmail(googleUserInfo.email)
            if (existingUser != null) {
                throw AuthException("An account with this email already exists. Please log in with your password.")
            }

            // Create new user
            user = User(
                fullName = googleUserInfo.name,
                email = googleUserInfo.email,
                authType = AuthType.google,
                googleId = googleUserInfo.googleId,
                isVerified = true, // Google users are pre-verified
            )
            user = userRepository.save(user)
            log.info("[auth] Google user registered: ${user.email}")
        }

        val token = jwtTokenProvider.generateToken(user.id!!, user.email)
        return AuthResponse(token, toUserResponse(user))
    }

    fun getCurrentUser(userId: java.util.UUID): UserResponse {
        val user = userRepository.findById(userId).orElseThrow { AuthException("User not found") }
        return toUserResponse(user)
    }

    fun generateVerificationCode(): String {
        return String.format("%06d", secureRandom.nextInt(1_000_000))
    }

    private fun toUserResponse(user: User): UserResponse {
        return UserResponse(
            id = user.id!!,
            name = user.fullName,
            email = user.email,
            authType = user.authType.name,
            isVerified = user.isVerified,
        )
    }
}

class AuthException(message: String) : RuntimeException(message)
