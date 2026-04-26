package com.mydict.service

import com.mydict.entity.ApiUsage
import com.mydict.repository.ApiUsageRepository
import org.junit.jupiter.api.Assertions.*
import org.junit.jupiter.api.BeforeEach
import org.junit.jupiter.api.Nested
import org.junit.jupiter.api.Test
import org.junit.jupiter.api.extension.ExtendWith
import org.mockito.ArgumentCaptor
import org.mockito.Captor
import org.mockito.Mock
import org.mockito.junit.jupiter.MockitoExtension
import org.mockito.kotlin.*
import java.time.OffsetDateTime
import java.time.ZoneOffset
import java.util.*

@ExtendWith(MockitoExtension::class)
class ApiUsageServiceTest {

    @Mock
    private lateinit var apiUsageRepository: ApiUsageRepository

    @Captor
    private lateinit var usageCaptor: ArgumentCaptor<ApiUsage>

    private lateinit var apiUsageService: ApiUsageService

    @BeforeEach
    fun setUp() {
        apiUsageService = ApiUsageService(apiUsageRepository)
    }

    private fun currentPeriodStart(): OffsetDateTime {
        val now = OffsetDateTime.now(ZoneOffset.UTC)
        return now.withDayOfMonth(1).withHour(0).withMinute(0).withSecond(0).withNano(0)
    }

    @Nested
    inner class InitializeUsageTests {
        @Test
        fun `creates usage record for new user`() {
            val userId = UUID.randomUUID()
            whenever(apiUsageRepository.findByUserId(userId)).thenReturn(null)
            whenever(apiUsageRepository.save(any<ApiUsage>())).thenAnswer { it.arguments[0] }

            apiUsageService.initializeUsage(userId)

            verify(apiUsageRepository).save(usageCaptor.capture())
            val saved = usageCaptor.value
            assertEquals(userId, saved.userId)
            assertEquals(0, saved.usageCount)
            assertEquals(50, saved.usageLimit)
        }

        @Test
        fun `does not create duplicate for existing user`() {
            val userId = UUID.randomUUID()
            val existing = ApiUsage(userId = userId, usageCount = 5, usageLimit = 50, periodStart = currentPeriodStart())
            whenever(apiUsageRepository.findByUserId(userId)).thenReturn(existing)

            apiUsageService.initializeUsage(userId)

            verify(apiUsageRepository, never()).save(any())
        }
    }

    @Nested
    inner class CheckAndIncrementTests {
        @Test
        fun `returns true and increments when under limit`() {
            val userId = UUID.randomUUID()
            val usage = ApiUsage(userId = userId, usageCount = 10, usageLimit = 50, periodStart = currentPeriodStart())
            whenever(apiUsageRepository.findByUserId(userId)).thenReturn(usage)
            whenever(apiUsageRepository.save(any<ApiUsage>())).thenAnswer { it.arguments[0] }

            val result = apiUsageService.checkAndIncrement(userId)

            assertTrue(result)
            assertEquals(11, usage.usageCount)
            verify(apiUsageRepository).save(usage)
        }

        @Test
        fun `returns false when at limit`() {
            val userId = UUID.randomUUID()
            val usage = ApiUsage(userId = userId, usageCount = 50, usageLimit = 50, periodStart = currentPeriodStart())
            whenever(apiUsageRepository.findByUserId(userId)).thenReturn(usage)

            val result = apiUsageService.checkAndIncrement(userId)

            assertFalse(result)
            assertEquals(50, usage.usageCount)
        }

        @Test
        fun `returns false when over limit`() {
            val userId = UUID.randomUUID()
            val usage = ApiUsage(userId = userId, usageCount = 55, usageLimit = 50, periodStart = currentPeriodStart())
            whenever(apiUsageRepository.findByUserId(userId)).thenReturn(usage)

            val result = apiUsageService.checkAndIncrement(userId)

            assertFalse(result)
        }

        @Test
        fun `resets and allows when new month`() {
            val userId = UUID.randomUUID()
            val lastMonth = currentPeriodStart().minusMonths(1)
            val usage = ApiUsage(userId = userId, usageCount = 50, usageLimit = 50, periodStart = lastMonth)
            whenever(apiUsageRepository.findByUserId(userId)).thenReturn(usage)
            whenever(apiUsageRepository.save(any<ApiUsage>())).thenAnswer { it.arguments[0] }

            val result = apiUsageService.checkAndIncrement(userId)

            assertTrue(result)
            assertEquals(1, usage.usageCount)
            assertEquals(currentPeriodStart(), usage.periodStart)
        }

        @Test
        fun `throws when no usage record exists`() {
            val userId = UUID.randomUUID()
            whenever(apiUsageRepository.findByUserId(userId)).thenReturn(null)

            assertThrows(IllegalStateException::class.java) {
                apiUsageService.checkAndIncrement(userId)
            }
        }
    }

    @Nested
    inner class GetUsageTests {
        @Test
        fun `returns current usage`() {
            val userId = UUID.randomUUID()
            val periodStart = currentPeriodStart()
            val usage = ApiUsage(userId = userId, usageCount = 25, usageLimit = 50, periodStart = periodStart)
            whenever(apiUsageRepository.findByUserId(userId)).thenReturn(usage)

            val result = apiUsageService.getUsage(userId)

            assertEquals(25, result.usageCount)
            assertEquals(50, result.usageLimit)
            assertEquals(periodStart, result.periodStart)
        }

        @Test
        fun `resets count for new period on get`() {
            val userId = UUID.randomUUID()
            val lastMonth = currentPeriodStart().minusMonths(1)
            val usage = ApiUsage(userId = userId, usageCount = 30, usageLimit = 50, periodStart = lastMonth)
            whenever(apiUsageRepository.findByUserId(userId)).thenReturn(usage)
            whenever(apiUsageRepository.save(any<ApiUsage>())).thenAnswer { it.arguments[0] }

            val result = apiUsageService.getUsage(userId)

            assertEquals(0, result.usageCount)
            assertEquals(50, result.usageLimit)
        }

        @Test
        fun `throws when no usage record exists`() {
            val userId = UUID.randomUUID()
            whenever(apiUsageRepository.findByUserId(userId)).thenReturn(null)

            assertThrows(IllegalStateException::class.java) {
                apiUsageService.getUsage(userId)
            }
        }
    }
}
