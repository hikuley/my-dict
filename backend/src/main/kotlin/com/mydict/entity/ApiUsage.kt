package com.mydict.entity

import jakarta.persistence.*
import java.time.OffsetDateTime
import java.util.UUID

@Entity
@Table(name = "api_usage")
class ApiUsage(
    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    @Column(columnDefinition = "uuid")
    var id: UUID? = null,

    @Column(name = "user_id", nullable = false, unique = true)
    var userId: UUID = UUID.randomUUID(),

    @Column(name = "usage_count", nullable = false)
    var usageCount: Int = 0,

    @Column(name = "usage_limit", nullable = false)
    var usageLimit: Int = 50,

    @Column(name = "period_start", nullable = false)
    var periodStart: OffsetDateTime = OffsetDateTime.now(),

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
