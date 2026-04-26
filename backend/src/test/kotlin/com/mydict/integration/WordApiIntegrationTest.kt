package com.mydict.integration

import com.fasterxml.jackson.databind.ObjectMapper
import com.mydict.dto.*
import com.mydict.entity.AuthType
import com.mydict.entity.User
import com.mydict.repository.ApiUsageRepository
import com.mydict.repository.UserRepository
import com.mydict.security.JwtTokenProvider
import com.mydict.service.ApiUsageService
import org.junit.jupiter.api.*
import org.junit.jupiter.api.Assertions.*
import org.springframework.beans.factory.annotation.Autowired
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc
import org.springframework.boot.test.context.SpringBootTest
import org.springframework.http.MediaType
import org.springframework.test.context.ActiveProfiles
import org.springframework.test.web.servlet.MockMvc
import org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*
import org.springframework.test.web.servlet.result.MockMvcResultMatchers.*

@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
@TestMethodOrder(MethodOrderer.OrderAnnotation::class)
@TestInstance(TestInstance.Lifecycle.PER_CLASS)
class WordApiIntegrationTest : BaseIntegrationTest() {

    @Autowired
    private lateinit var mockMvc: MockMvc

    @Autowired
    private lateinit var objectMapper: ObjectMapper

    @Autowired
    private lateinit var jwtTokenProvider: JwtTokenProvider

    @Autowired
    private lateinit var userRepository: UserRepository

    @Autowired
    private lateinit var apiUsageRepository: ApiUsageRepository

    @Autowired
    private lateinit var apiUsageService: ApiUsageService

    private lateinit var authToken: String

    @BeforeAll
    fun setupAuth() {
        val user = userRepository.save(
            User(
                fullName = "Test User",
                email = "wordtest@integration.com",
                passwordHash = "hashed",
                authType = AuthType.manual,
                isVerified = true,
            )
        )
        apiUsageService.initializeUsage(user.id!!)
        authToken = jwtTokenProvider.generateToken(user.id!!, user.email)
    }

    @AfterAll
    fun cleanupAuth() {
        apiUsageRepository.deleteAll()
        userRepository.deleteAll()
    }

    private fun authHeader() = "Bearer $authToken"

    @Test
    @Order(1)
    fun `health endpoint returns ok`() {
        mockMvc.perform(get("/api/health"))
            .andExpect(status().isOk)
            .andExpect(jsonPath("$.status").value("ok"))
    }

    @Test
    @Order(2)
    fun `create word returns 201`() {
        val request = mapOf(
            "slug" to "integration-test",
            "title" to "Integration Test",
            "phonetic" to "/ˌɪntɪˈɡreɪʃən tɛst/",
            "subtitle" to "A test that verifies system components work together",
            "sections" to listOf(
                mapOf(
                    "type" to "definition",
                    "items" to listOf(mapOf("text" to "A type of software testing"))
                )
            )
        )

        mockMvc.perform(
            post("/api/words")
                .header("Authorization", authHeader())
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(request))
        )
            .andExpect(status().isCreated)
            .andExpect(jsonPath("$.slug").value("integration-test"))
            .andExpect(jsonPath("$.title").value("Integration Test"))
            .andExpect(jsonPath("$.phonetic").value("/ˌɪntɪˈɡreɪʃən tɛst/"))
    }

    @Test
    @Order(3)
    fun `create duplicate word returns 409`() {
        val request = mapOf(
            "slug" to "integration-test",
            "title" to "Integration Test",
        )

        mockMvc.perform(
            post("/api/words")
                .header("Authorization", authHeader())
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(request))
        )
            .andExpect(status().isConflict)
            .andExpect(jsonPath("$.error").value("A word with this slug already exists"))
    }

    @Test
    @Order(4)
    fun `get word by slug returns the created word`() {
        mockMvc.perform(get("/api/words/integration-test")
                .header("Authorization", authHeader()))
            .andExpect(status().isOk)
            .andExpect(jsonPath("$.slug").value("integration-test"))
            .andExpect(jsonPath("$.title").value("Integration Test"))
            .andExpect(jsonPath("$.subtitle").value("A test that verifies system components work together"))
    }

    @Test
    @Order(5)
    fun `get nonexistent word returns 404`() {
        mockMvc.perform(get("/api/words/does-not-exist")
                .header("Authorization", authHeader()))
            .andExpect(status().isNotFound)
            .andExpect(jsonPath("$.error").value("Word not found"))
    }

    @Test
    @Order(6)
    fun `list words returns paginated results`() {
        // Create a second word
        val request = mapOf(
            "slug" to "unit-test",
            "title" to "Unit Test",
            "subtitle" to "A test for individual components",
        )
        mockMvc.perform(
            post("/api/words")
                .header("Authorization", authHeader())
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(request))
        ).andExpect(status().isCreated)

        mockMvc.perform(get("/api/words?page=1&limit=10")
                .header("Authorization", authHeader()))
            .andExpect(status().isOk)
            .andExpect(jsonPath("$.words").isArray)
            .andExpect(jsonPath("$.page").value(1))
            .andExpect(jsonPath("$.limit").value(10))
            .andExpect(jsonPath("$.total").isNumber)
    }

    @Test
    @Order(7)
    fun `search words returns matching results`() {
        mockMvc.perform(get("/api/words/search?q=test")
                .header("Authorization", authHeader()))
            .andExpect(status().isOk)
            .andExpect(jsonPath("$.words").isArray)
            .andExpect(jsonPath("$.words.length()").value(org.hamcrest.Matchers.greaterThanOrEqualTo(1)))
    }

    @Test
    @Order(8)
    fun `search rejects short query`() {
        mockMvc.perform(get("/api/words/search?q=a")
                .header("Authorization", authHeader()))
            .andExpect(status().isBadRequest)
            .andExpect(jsonPath("$.error").value("Query must be at least 2 characters"))
    }

    @Test
    @Order(9)
    fun `generate word rejects blank input`() {
        mockMvc.perform(
            post("/api/words/generate")
                .header("Authorization", authHeader())
                .contentType(MediaType.APPLICATION_JSON)
                .content("""{"word": ""}""")
        )
            .andExpect(status().isBadRequest)
            .andExpect(jsonPath("$.error").value("word is required"))
    }

    @Test
    @Order(10)
    fun `generate word rejects duplicate`() {
        mockMvc.perform(
            post("/api/words/generate")
                .header("Authorization", authHeader())
                .contentType(MediaType.APPLICATION_JSON)
                .content("""{"word": "integration test"}""")
        )
            .andExpect(status().isConflict)
    }

    @Test
    @Order(11)
    fun `generate word accepts new word`() {
        mockMvc.perform(
            post("/api/words/generate")
                .header("Authorization", authHeader())
                .contentType(MediaType.APPLICATION_JSON)
                .content("""{"word": "xyzzy-test-gen"}""")
        )
            .andExpect(status().isAccepted)
            .andExpect(jsonPath("$.message").value("Word queued for processing"))
            .andExpect(jsonPath("$.slug").value("xyzzy-test-gen"))
    }

    @Test
    @Order(12)
    fun `delete word returns success`() {
        mockMvc.perform(delete("/api/words/unit-test")
                .header("Authorization", authHeader()))
            .andExpect(status().isOk)
            .andExpect(jsonPath("$.message").value("Word deleted"))
    }

    @Test
    @Order(13)
    fun `delete nonexistent word returns 404`() {
        mockMvc.perform(delete("/api/words/unit-test")
                .header("Authorization", authHeader()))
            .andExpect(status().isNotFound)
            .andExpect(jsonPath("$.error").value("Word not found"))
    }

    @Test
    @Order(14)
    fun `create word rejects missing required fields`() {
        mockMvc.perform(
            post("/api/words")
                .header("Authorization", authHeader())
                .contentType(MediaType.APPLICATION_JSON)
                .content("""{"title": "No Slug"}""")
        )
            .andExpect(status().isBadRequest)
            .andExpect(jsonPath("$.error").value("slug and title are required"))
    }

    @Test
    @Order(15)
    fun `generate word increments usage count`() {
        val user = userRepository.findByEmail("wordtest@integration.com")!!
        val usageBefore = apiUsageRepository.findByUserId(user.id!!)!!.usageCount

        mockMvc.perform(
            post("/api/words/generate")
                .header("Authorization", authHeader())
                .contentType(MediaType.APPLICATION_JSON)
                .content("""{"word": "usage-counter-test"}""")
        )
            .andExpect(status().isAccepted)

        val usageAfter = apiUsageRepository.findByUserId(user.id!!)!!.usageCount
        assertEquals(usageBefore + 1, usageAfter)
    }

    @Test
    @Order(16)
    fun `generate word returns 429 when limit exhausted`() {
        val user = userRepository.findByEmail("wordtest@integration.com")!!
        val usage = apiUsageRepository.findByUserId(user.id!!)!!
        usage.usageCount = usage.usageLimit
        apiUsageRepository.save(usage)

        mockMvc.perform(
            post("/api/words/generate")
                .header("Authorization", authHeader())
                .contentType(MediaType.APPLICATION_JSON)
                .content("""{"word": "should-be-rejected"}""")
        )
            .andExpect(status().isTooManyRequests)
            .andExpect(jsonPath("$.error").value("Monthly API usage limit reached. Please try again next month."))

        // Restore usage for subsequent tests
        usage.usageCount = 0
        apiUsageRepository.save(usage)
    }

    @Test
    @Order(100)
    fun `cleanup - delete remaining test word`() {
        mockMvc.perform(delete("/api/words/integration-test")
                .header("Authorization", authHeader()))
            .andExpect(status().isOk)
    }

    @Test
    @Order(101)
    fun `cleanup - delete ephemeral test word`() {
        mockMvc.perform(delete("/api/words/xyzzy-test-gen")
                .header("Authorization", authHeader()))
        mockMvc.perform(delete("/api/words/usage-counter-test")
                .header("Authorization", authHeader()))
    }
}
