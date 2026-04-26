package com.mydict.repository

import com.mydict.entity.ApiUsage
import org.springframework.data.jpa.repository.JpaRepository
import java.util.UUID

interface ApiUsageRepository : JpaRepository<ApiUsage, UUID> {
    fun findByUserId(userId: UUID): ApiUsage?
}
