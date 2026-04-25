package com.mydict.repository

import com.mydict.entity.User
import org.springframework.data.jpa.repository.JpaRepository
import java.util.UUID

interface UserRepository : JpaRepository<User, UUID> {
    fun findByEmail(email: String): User?
    fun findByGoogleId(googleId: String): User?
    fun existsByEmail(email: String): Boolean
}
