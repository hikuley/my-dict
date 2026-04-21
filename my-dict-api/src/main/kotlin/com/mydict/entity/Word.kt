package com.mydict.entity

import jakarta.persistence.*
import java.time.OffsetDateTime

@Entity
@Table(name = "words")
class Word(
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    var id: Long? = null,

    @Column(unique = true, nullable = false, length = 255)
    var slug: String = "",

    @Column(nullable = false, length = 255)
    var title: String = "",

    @Column(length = 255)
    var phonetic: String? = null,

    @Column(columnDefinition = "TEXT")
    var subtitle: String? = null,

    @Column(columnDefinition = "JSONB", nullable = false)
    var sections: String = "[]",

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
