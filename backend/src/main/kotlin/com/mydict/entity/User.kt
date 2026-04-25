package com.mydict.entity

import jakarta.persistence.*
import java.time.OffsetDateTime
import java.util.UUID

enum class AuthType {
    manual, google
}

@Entity
@Table(name = "users")
class User(
    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    @Column(columnDefinition = "uuid")
    var id: UUID? = null,

    @Column(name = "full_name", nullable = false, length = 255)
    var fullName: String = "",

    @Column(unique = true, nullable = false, length = 255)
    var email: String = "",

    @Column(name = "password_hash", length = 255)
    var passwordHash: String? = null,

    @Enumerated(EnumType.STRING)
    @Column(name = "auth_type", nullable = false, columnDefinition = "auth_type")
    var authType: AuthType = AuthType.manual,

    @Column(name = "google_id", unique = true, length = 255)
    var googleId: String? = null,

    @Column(name = "is_verified", nullable = false)
    var isVerified: Boolean = false,

    @Column(name = "verification_code", length = 6)
    var verificationCode: String? = null,

    @Column(name = "verification_expiry")
    var verificationExpiry: OffsetDateTime? = null,

    @Column(name = "created_at", updatable = false)
    var createdAt: OffsetDateTime? = null,

    @Column(name = "updated_at")
    var updatedAt: OffsetDateTime? = null,
) {
    @PrePersist
    fun prePersist() {
        createdAt = OffsetDateTime.now()
        updatedAt = OffsetDateTime.now()
    }

    @PreUpdate
    fun preUpdate() {
        updatedAt = OffsetDateTime.now()
    }
}
