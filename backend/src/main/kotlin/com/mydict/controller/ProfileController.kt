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
@RequestMapping("/api/profile")
class ProfileController(
    private val authService: AuthService,
) {
    private val log = LoggerFactory.getLogger(javaClass)

    @GetMapping
    fun getProfile(@AuthenticationPrincipal user: User?): ResponseEntity<Any> {
        if (user == null) {
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED).body(ErrorResponse("Not authenticated"))
        }
        return try {
            ResponseEntity.ok(authService.getProfile(user.id!!))
        } catch (e: AuthException) {
            ResponseEntity.badRequest().body(ErrorResponse(e.message ?: "Failed to get profile"))
        }
    }

    @PutMapping
    fun updateProfile(
        @AuthenticationPrincipal user: User?,
        @RequestBody request: UpdateProfileRequest,
    ): ResponseEntity<Any> {
        if (user == null) {
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED).body(ErrorResponse("Not authenticated"))
        }
        return try {
            ResponseEntity.ok(authService.updateProfile(user.id!!, request))
        } catch (e: AuthException) {
            ResponseEntity.badRequest().body(ErrorResponse(e.message ?: "Failed to update profile"))
        }
    }

    @PutMapping("/password")
    fun updatePassword(
        @AuthenticationPrincipal user: User?,
        @RequestBody request: UpdatePasswordRequest,
    ): ResponseEntity<Any> {
        if (user == null) {
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED).body(ErrorResponse("Not authenticated"))
        }
        return try {
            authService.updatePassword(user.id!!, request)
            ResponseEntity.ok(VerificationResponse("Password updated successfully"))
        } catch (e: AuthException) {
            ResponseEntity.badRequest().body(ErrorResponse(e.message ?: "Failed to update password"))
        }
    }

    @PostMapping("/email")
    fun initiateEmailChange(
        @AuthenticationPrincipal user: User?,
        @RequestBody request: UpdateEmailRequest,
    ): ResponseEntity<Any> {
        if (user == null) {
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED).body(ErrorResponse("Not authenticated"))
        }
        return try {
            authService.initiateEmailChange(user.id!!, request)
            ResponseEntity.ok(VerificationResponse("Verification code sent to new email"))
        } catch (e: AuthException) {
            ResponseEntity.badRequest().body(ErrorResponse(e.message ?: "Failed to initiate email change"))
        }
    }

    @PostMapping("/email/verify")
    fun verifyEmailChange(
        @AuthenticationPrincipal user: User?,
        @RequestBody request: VerifyEmailChangeRequest,
    ): ResponseEntity<Any> {
        if (user == null) {
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED).body(ErrorResponse("Not authenticated"))
        }
        return try {
            ResponseEntity.ok(authService.verifyEmailChange(user.id!!, request))
        } catch (e: AuthException) {
            ResponseEntity.badRequest().body(ErrorResponse(e.message ?: "Failed to verify email change"))
        }
    }
}
