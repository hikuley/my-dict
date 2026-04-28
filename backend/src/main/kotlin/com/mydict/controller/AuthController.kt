package com.mydict.controller

import com.mydict.dto.*
import com.mydict.entity.User
import com.mydict.service.AuthException
import com.mydict.service.AuthService
import org.slf4j.LoggerFactory
import org.springframework.http.HttpStatus
import org.springframework.http.ResponseEntity
import org.springframework.security.core.annotation.AuthenticationPrincipal
import org.springframework.web.bind.annotation.*

@RestController
@RequestMapping("/api/auth")
class AuthController(
    private val authService: AuthService,
) {
    private val log = LoggerFactory.getLogger(javaClass)

    @PostMapping("/signup")
    fun signUp(@RequestBody request: SignUpRequest): ResponseEntity<Any> {
        return try {
            val response = authService.signUp(request)
            ResponseEntity.status(HttpStatus.CREATED).body(response)
        } catch (e: AuthException) {
            ResponseEntity.badRequest().body(ErrorResponse(e.message ?: "Sign up failed"))
        }
    }

    @PostMapping("/login")
    fun login(@RequestBody request: LoginRequest): ResponseEntity<Any> {
        return try {
            ResponseEntity.ok(authService.login(request))
        } catch (e: AuthException) {
            ResponseEntity.status(HttpStatus.UNAUTHORIZED).body(ErrorResponse(e.message ?: "Login failed"))
        }
    }

    @PostMapping("/verify")
    fun verifyEmail(@RequestBody request: VerifyEmailRequest): ResponseEntity<Any> {
        return try {
            ResponseEntity.ok(authService.verifyEmail(request))
        } catch (e: AuthException) {
            ResponseEntity.badRequest().body(ErrorResponse(e.message ?: "Verification failed"))
        }
    }

    @PostMapping("/resend-verification")
    fun resendVerification(@RequestBody request: ResendVerificationRequest): ResponseEntity<Any> {
        return try {
            ResponseEntity.ok(authService.resendVerification(request))
        } catch (e: AuthException) {
            ResponseEntity.badRequest().body(ErrorResponse(e.message ?: "Failed to resend"))
        }
    }

    @PostMapping("/google")
    fun googleAuth(@RequestBody request: GoogleAuthRequest): ResponseEntity<Any> {
        return try {
            ResponseEntity.ok(authService.googleAuth(request))
        } catch (e: AuthException) {
            ResponseEntity.badRequest().body(ErrorResponse(e.message ?: "Google auth failed"))
        }
    }

    @PostMapping("/apple")
    fun appleAuth(@RequestBody request: AppleAuthRequest): ResponseEntity<Any> {
        return try {
            ResponseEntity.ok(authService.appleAuth(request))
        } catch (e: AuthException) {
            ResponseEntity.badRequest().body(ErrorResponse(e.message ?: "Apple auth failed"))
        }
    }

    @GetMapping("/me")
    fun getCurrentUser(@AuthenticationPrincipal user: User?): ResponseEntity<Any> {
        if (user == null) {
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED).body(ErrorResponse("Not authenticated"))
        }
        if (!user.isVerified) {
            return ResponseEntity.status(HttpStatus.FORBIDDEN)
                .body(ErrorResponse("Email not verified"))
        }
        return ResponseEntity.ok(authService.getCurrentUser(user.id!!))
    }
}
