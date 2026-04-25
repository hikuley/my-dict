package com.mydict.dto

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

// --- Auth Responses ---

data class AuthResponse(
    val token: String,
    val user: UserResponse,
)

data class UserResponse(
    val id: UUID,
    val name: String,
    val email: String,
    val authType: String,
    val isVerified: Boolean,
)

data class VerificationResponse(
    val message: String,
)
