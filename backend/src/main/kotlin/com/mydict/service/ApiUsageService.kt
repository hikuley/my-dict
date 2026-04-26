package com.mydict.service

import com.mydict.dto.ApiUsageResponse
import com.mydict.entity.ApiUsage
import com.mydict.repository.ApiUsageRepository
import org.slf4j.LoggerFactory
import org.springframework.stereotype.Service
import org.springframework.transaction.annotation.Transactional
import java.time.OffsetDateTime
import java.time.ZoneOffset
import java.util.UUID

@Service
class ApiUsageService(
    private val apiUsageRepository: ApiUsageRepository,
) {
    private val log = LoggerFactory.getLogger(javaClass)

    companion object {
        const val DEFAULT_LIMIT = 50
    }

    @Transactional
    fun initializeUsage(userId: UUID) {
        val existing = apiUsageRepository.findByUserId(userId)
        if (existing != null) return

        val usage = ApiUsage(
            userId = userId,
            usageCount = 0,
            usageLimit = DEFAULT_LIMIT,
            periodStart = currentPeriodStart(),
        )
        apiUsageRepository.save(usage)
        log.info("[api-usage] Initialized usage for user: $userId")
    }

    @Transactional
    fun checkAndIncrement(userId: UUID): Boolean {
        val usage = apiUsageRepository.findByUserId(userId)
            ?: throw IllegalStateException("No API usage record for user: $userId")

        resetIfNewPeriod(usage)

        if (usage.usageCount >= usage.usageLimit) {
            log.info("[api-usage] User $userId has reached their limit: ${usage.usageCount}/${usage.usageLimit}")
            return false
        }

        usage.usageCount += 1
        apiUsageRepository.save(usage)
        log.info("[api-usage] User $userId usage: ${usage.usageCount}/${usage.usageLimit}")
        return true
    }

    fun getUsage(userId: UUID): ApiUsageResponse {
        val usage = apiUsageRepository.findByUserId(userId)
            ?: throw IllegalStateException("No API usage record for user: $userId")

        resetIfNewPeriod(usage)

        return ApiUsageResponse(
            usageCount = usage.usageCount,
            usageLimit = usage.usageLimit,
            periodStart = usage.periodStart,
        )
    }

    private fun resetIfNewPeriod(usage: ApiUsage) {
        val currentStart = currentPeriodStart()
        if (usage.periodStart.isBefore(currentStart)) {
            usage.usageCount = 0
            usage.periodStart = currentStart
            apiUsageRepository.save(usage)
            log.info("[api-usage] Reset usage for user: ${usage.userId} (new period)")
        }
    }

    private fun currentPeriodStart(): OffsetDateTime {
        val now = OffsetDateTime.now(ZoneOffset.UTC)
        return now.withDayOfMonth(1).withHour(0).withMinute(0).withSecond(0).withNano(0)
    }
}
