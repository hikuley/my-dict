package com.mydict.dto

import java.time.OffsetDateTime
import java.util.UUID

// --- Auth Requests ---

data class SignUpRequest(
    val name: String?,
    val email: String?,
    val password: String?,
)

data class LoginRequest(
    val email: String?,
    val password: String?,
)

data class VerifyEmailRequest(
    val email: String?,
    val code: String?,
)

data class ResendVerificationRequest(
    val email: String?,
)

data class GoogleAuthRequest(
    val idToken: String?,
)

data class AppleAuthRequest(
    val idToken: String?,
    val name: String?,
)

// --- Auth Responses ---

data class AuthResponse(
    val token: String,
    val user: UserResponse,
)

data class UserResponse(
    val id: UUID,
    val name: String,
    val surname: String?,
    val email: String,
    val authType: String,
    val isVerified: Boolean,
)

data class VerificationResponse(
    val message: String,
)

// --- Profile Requests ---

data class UpdateProfileRequest(
    val name: String?,
    val surname: String?,
)

data class UpdatePasswordRequest(
    val currentPassword: String?,
    val newPassword: String?,
)

data class UpdateEmailRequest(
    val newEmail: String?,
)

data class VerifyEmailChangeRequest(
    val code: String?,
)

// --- Profile Responses ---

data class ProfileResponse(
    val id: UUID,
    val name: String,
    val surname: String?,
    val email: String,
    val authType: String,
    val isVerified: Boolean,
    val usageCount: Int,
    val usageLimit: Int,
    val periodStart: OffsetDateTime,
)

data class ApiUsageResponse(
    val usageCount: Int,
    val usageLimit: Int,
    val periodStart: OffsetDateTime,
)
