package com.mydict.controller

import com.mydict.dto.*
import com.mydict.kafka.KafkaProducerService
import com.mydict.service.WordService
import com.mydict.websocket.WordWebSocketHandler
import org.junit.jupiter.api.Nested
import org.junit.jupiter.api.Test
import org.mockito.kotlin.any
import org.mockito.kotlin.anyOrNull
import org.mockito.kotlin.doReturn
import org.mockito.kotlin.doThrow
import org.mockito.kotlin.verify
import org.mockito.kotlin.whenever
import org.springframework.beans.factory.annotation.Autowired
import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest
import org.springframework.boot.test.mock.mockito.MockBean
import org.springframework.dao.DataIntegrityViolationException
import org.springframework.http.MediaType
import org.springframework.test.web.servlet.MockMvc
import org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*
import org.springframework.test.web.servlet.result.MockMvcResultMatchers.*

@WebMvcTest(WordController::class)
class WordControllerTest {

    @Autowired
    private lateinit var mockMvc: MockMvc

    @MockBean
    private lateinit var wordService: WordService

    @MockBean
    private lateinit var kafkaProducerService: KafkaProducerService

    @MockBean
    private lateinit var webSocketHandler: WordWebSocketHandler

    @Nested
    inner class ListWordsTests {
        @Test
        fun `returns paginated word list`() {
            val response = WordListResponse(
                words = listOf(WordSummary("hello", "Hello", "A greeting")),
                page = 1, limit = 20, total = 1, totalPages = 1,
            )
            whenever(wordService.listWords(1, 20)).thenReturn(response)

            mockMvc.perform(get("/api/words"))
                .andExpect(status().isOk)
                .andExpect(jsonPath("$.words[0].slug").value("hello"))
                .andExpect(jsonPath("$.total").value(1))
        }

        @Test
        fun `accepts custom page and limit`() {
            val response = WordListResponse(
                words = emptyList(), page = 2, limit = 10, total = 0, totalPages = 0,
            )
            whenever(wordService.listWords(2, 10)).thenReturn(response)

            mockMvc.perform(get("/api/words?page=2&limit=10"))
                .andExpect(status().isOk)
                .andExpect(jsonPath("$.page").value(2))
        }
    }

    @Nested
    inner class SearchWordsTests {
        @Test
        fun `returns search results`() {
            val response = SearchResponse(listOf(
                SearchResult("hello", "Hello", "A greeting", 0.5),
            ))
            whenever(wordService.searchWords("hello")).thenReturn(response)

            mockMvc.perform(get("/api/words/search?q=hello"))
                .andExpect(status().isOk)
                .andExpect(jsonPath("$.words[0].slug").value("hello"))
        }

        @Test
        fun `rejects short query`() {
            mockMvc.perform(get("/api/words/search?q=a"))
                .andExpect(status().isBadRequest)
                .andExpect(jsonPath("$.error").value("Query must be at least 2 characters"))
        }

        @Test
        fun `rejects missing query`() {
            mockMvc.perform(get("/api/words/search"))
                .andExpect(status().isBadRequest)
        }
    }

    @Nested
    inner class GetWordTests {
        @Test
        fun `returns word by slug`() {
            val response = WordDetailResponse("hello", "Hello", "/həˈloʊ/", "A greeting", "[]")
            whenever(wordService.getWordBySlug("hello")).thenReturn(response)

            mockMvc.perform(get("/api/words/hello"))
                .andExpect(status().isOk)
                .andExpect(jsonPath("$.slug").value("hello"))
                .andExpect(jsonPath("$.title").value("Hello"))
        }

        @Test
        fun `returns 404 for missing word`() {
            whenever(wordService.getWordBySlug("nonexistent")).thenReturn(null)

            mockMvc.perform(get("/api/words/nonexistent"))
                .andExpect(status().isNotFound)
                .andExpect(jsonPath("$.error").value("Word not found"))
        }
    }

    @Nested
    inner class GenerateWordTests {
        @Test
        fun `queues word for generation`() {
            whenever(wordService.slugExists("hello")).thenReturn(false)

            mockMvc.perform(
                post("/api/words/generate")
                    .contentType(MediaType.APPLICATION_JSON)
                    .content("""{"word": "hello"}""")
            )
                .andExpect(status().isAccepted)
                .andExpect(jsonPath("$.message").value("Word queued for processing"))
                .andExpect(jsonPath("$.slug").value("hello"))

            verify(kafkaProducerService).send("hello", "hello")
            verify(webSocketHandler).trackProcessing("hello", "hello")
        }

        @Test
        fun `rejects blank word`() {
            mockMvc.perform(
                post("/api/words/generate")
                    .contentType(MediaType.APPLICATION_JSON)
                    .content("""{"word": "  "}""")
            )
                .andExpect(status().isBadRequest)
                .andExpect(jsonPath("$.error").value("word is required"))
        }

        @Test
        fun `rejects null word`() {
            mockMvc.perform(
                post("/api/words/generate")
                    .contentType(MediaType.APPLICATION_JSON)
                    .content("""{}""")
            )
                .andExpect(status().isBadRequest)
                .andExpect(jsonPath("$.error").value("word is required"))
        }

        @Test
        fun `rejects duplicate word`() {
            whenever(wordService.slugExists("hello")).thenReturn(true)

            mockMvc.perform(
                post("/api/words/generate")
                    .contentType(MediaType.APPLICATION_JSON)
                    .content("""{"word": "hello"}""")
            )
                .andExpect(status().isConflict)
                .andExpect(jsonPath("$.error").value("This word already exists in the dictionary"))
        }

        @Test
        fun `truncates word to 100 characters`() {
            val longWord = "a".repeat(200)
            val expectedSlug = "a".repeat(100)
            whenever(wordService.slugExists(expectedSlug)).thenReturn(false)

            mockMvc.perform(
                post("/api/words/generate")
                    .contentType(MediaType.APPLICATION_JSON)
                    .content("""{"word": "$longWord"}""")
            )
                .andExpect(status().isAccepted)

            verify(kafkaProducerService).send("a".repeat(100), expectedSlug)
        }
    }

    @Nested
    inner class CreateWordTests {
        @Test
        fun `creates word successfully`() {
            val response = WordDetailResponse("hello", "Hello", null, null, "[]")
            doReturn(response).whenever(wordService).createWord(any(), any(), anyOrNull(), anyOrNull(), anyOrNull())

            mockMvc.perform(
                post("/api/words")
                    .contentType(MediaType.APPLICATION_JSON)
                    .content("""{"slug": "hello", "title": "Hello"}""")
            )
                .andExpect(status().isCreated)
                .andExpect(jsonPath("$.slug").value("hello"))
        }

        @Test
        fun `rejects missing slug`() {
            mockMvc.perform(
                post("/api/words")
                    .contentType(MediaType.APPLICATION_JSON)
                    .content("""{"title": "Hello"}""")
            )
                .andExpect(status().isBadRequest)
                .andExpect(jsonPath("$.error").value("slug and title are required"))
        }

        @Test
        fun `rejects missing title`() {
            mockMvc.perform(
                post("/api/words")
                    .contentType(MediaType.APPLICATION_JSON)
                    .content("""{"slug": "hello"}""")
            )
                .andExpect(status().isBadRequest)
                .andExpect(jsonPath("$.error").value("slug and title are required"))
        }

        @Test
        fun `returns conflict for duplicate slug`() {
            doThrow(DataIntegrityViolationException("duplicate")).whenever(wordService).createWord(any(), any(), anyOrNull(), anyOrNull(), anyOrNull())

            mockMvc.perform(
                post("/api/words")
                    .contentType(MediaType.APPLICATION_JSON)
                    .content("""{"slug": "hello", "title": "Hello"}""")
            )
                .andExpect(status().isConflict)
                .andExpect(jsonPath("$.error").value("A word with this slug already exists"))
        }
    }

    @Nested
    inner class DeleteWordTests {
        @Test
        fun `deletes word successfully`() {
            whenever(wordService.deleteWord("hello")).thenReturn(true)

            mockMvc.perform(delete("/api/words/hello"))
                .andExpect(status().isOk)
                .andExpect(jsonPath("$.message").value("Word deleted"))
        }

        @Test
        fun `returns 404 for missing word`() {
            whenever(wordService.deleteWord("nonexistent")).thenReturn(false)

            mockMvc.perform(delete("/api/words/nonexistent"))
                .andExpect(status().isNotFound)
                .andExpect(jsonPath("$.error").value("Word not found"))
        }
    }

    @Nested
    inner class HealthTests {
        @Test
        fun `returns health status`() {
            mockMvc.perform(get("/api/health"))
                .andExpect(status().isOk)
                .andExpect(jsonPath("$.status").value("ok"))
        }
    }
}
