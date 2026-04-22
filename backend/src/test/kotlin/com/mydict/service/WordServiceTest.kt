package com.mydict.service

import com.fasterxml.jackson.databind.ObjectMapper
import com.fasterxml.jackson.module.kotlin.kotlinModule
import com.mydict.entity.Word
import com.mydict.repository.WordRepository
import org.junit.jupiter.api.Assertions.*
import org.junit.jupiter.api.BeforeEach
import org.junit.jupiter.api.Nested
import org.junit.jupiter.api.Test
import org.junit.jupiter.api.extension.ExtendWith
import org.mockito.ArgumentCaptor
import org.mockito.Captor
import org.mockito.Mock
import org.mockito.junit.jupiter.MockitoExtension
import org.mockito.kotlin.any
import org.mockito.kotlin.capture
import org.mockito.kotlin.doReturn
import org.mockito.kotlin.verify
import org.mockito.kotlin.whenever
import org.springframework.data.domain.PageImpl
import org.springframework.data.domain.PageRequest

@ExtendWith(MockitoExtension::class)
class WordServiceTest {

    @Mock
    private lateinit var wordRepository: WordRepository

    private val objectMapper = ObjectMapper().registerModule(kotlinModule())
    private lateinit var wordService: WordService

    @Captor
    private lateinit var wordCaptor: ArgumentCaptor<Word>

    @BeforeEach
    fun setUp() {
        wordService = WordService(wordRepository, objectMapper)
    }

    @Nested
    inner class GenerateSlugTests {
        @Test
        fun `generates slug from simple word`() {
            assertEquals("hello", WordService.generateSlug("Hello"))
        }

        @Test
        fun `replaces spaces with hyphens`() {
            assertEquals("hello-world", WordService.generateSlug("Hello World"))
        }

        @Test
        fun `removes special characters`() {
            assertEquals("caf", WordService.generateSlug("café!"))
        }

        @Test
        fun `trims whitespace`() {
            assertEquals("test", WordService.generateSlug("  test  "))
        }

        @Test
        fun `collapses multiple spaces into single hyphen`() {
            assertEquals("hello-world", WordService.generateSlug("hello   world"))
        }

        @Test
        fun `handles empty string`() {
            assertEquals("", WordService.generateSlug(""))
        }
    }

    @Nested
    inner class ListWordsTests {
        @Test
        fun `returns paginated word list`() {
            val words = listOf(
                Word(id = 1, slug = "hello", title = "Hello", subtitle = "A greeting"),
                Word(id = 2, slug = "world", title = "World", subtitle = "The earth"),
            )
            val page = PageImpl(words, PageRequest.of(0, 20), 2)
            whenever(wordRepository.findAllOrdered(any())).thenReturn(page)

            val result = wordService.listWords(1, 20)

            assertEquals(2, result.words.size)
            assertEquals("hello", result.words[0].slug)
            assertEquals(1, result.page)
            assertEquals(20, result.limit)
            assertEquals(2, result.total)
        }

        @Test
        fun `coerces page to minimum 1`() {
            val page = PageImpl(emptyList<Word>(), PageRequest.of(0, 20), 0)
            whenever(wordRepository.findAllOrdered(any())).thenReturn(page)

            val result = wordService.listWords(-5, 20)
            assertEquals(1, result.page)
        }

        @Test
        fun `coerces limit between 1 and 100`() {
            val page = PageImpl(emptyList<Word>(), PageRequest.of(0, 1), 0)
            whenever(wordRepository.findAllOrdered(any())).thenReturn(page)

            val result = wordService.listWords(1, -10)
            assertEquals(1, result.limit)
        }

        @Test
        fun `caps limit at 100`() {
            val page = PageImpl(emptyList<Word>(), PageRequest.of(0, 100), 0)
            whenever(wordRepository.findAllOrdered(any())).thenReturn(page)

            val result = wordService.listWords(1, 500)
            assertEquals(100, result.limit)
        }
    }

    @Nested
    inner class GetWordBySlugTests {
        @Test
        fun `returns word when found`() {
            val word = Word(id = 1, slug = "hello", title = "Hello", phonetic = "/həˈloʊ/", subtitle = "A greeting", sections = "[]")
            whenever(wordRepository.findBySlug("hello")).thenReturn(word)

            val result = wordService.getWordBySlug("hello")

            assertNotNull(result)
            assertEquals("hello", result!!.slug)
            assertEquals("Hello", result.title)
            assertEquals("/həˈloʊ/", result.phonetic)
        }

        @Test
        fun `returns null when not found`() {
            whenever(wordRepository.findBySlug("nonexistent")).thenReturn(null)

            val result = wordService.getWordBySlug("nonexistent")
            assertNull(result)
        }
    }

    @Nested
    inner class CreateWordTests {
        @Test
        fun `creates word with list sections`() {
            val sections = listOf(mapOf("type" to "definition", "content" to "test"))
            val savedWord = Word(id = 1, slug = "test", title = "Test", sections = """[{"type":"definition","content":"test"}]""")
            doReturn(savedWord).whenever(wordRepository).save(any())

            val result = wordService.createWord("test", "Test", null, null, sections)

            assertEquals("test", result.slug)
            verify(wordRepository).save(any())
        }

        @Test
        fun `creates word with string sections`() {
            val savedWord = Word(id = 1, slug = "test", title = "Test", sections = """[{"type":"definition"}]""")
            doReturn(savedWord).whenever(wordRepository).save(any())

            val result = wordService.createWord("test", "Test", null, null, """[{"type":"definition"}]""")
            assertEquals("test", result.slug)
        }

        @Test
        fun `creates word with null sections defaults to empty array`() {
            val savedWord = Word(id = 1, slug = "test", title = "Test", sections = "[]")
            doReturn(savedWord).whenever(wordRepository).save(any())

            wordService.createWord("test", "Test", null, null, null)
            verify(wordRepository).save(wordCaptor.capture())
            assertEquals("[]", wordCaptor.value.sections)
        }
    }

    @Nested
    inner class InsertWordFromClaudeTests {
        @Test
        fun `uses word data fields`() {
            val wordData = mapOf<String, Any?>(
                "slug" to "hello",
                "title" to "HELLO",
                "phonetic" to "/həˈloʊ/",
                "subtitle" to "A greeting",
                "sections" to listOf(mapOf("type" to "definition")),
            )
            val savedWord = Word(id = 1, slug = "hello", title = "HELLO")
            doReturn(savedWord).whenever(wordRepository).save(any())

            val result = wordService.insertWordFromClaude(wordData, "fallback-slug", "fallback")
            assertEquals("hello", result.slug)
        }

        @Test
        fun `uses fallbacks when data fields are missing`() {
            val wordData = emptyMap<String, Any?>()
            val savedWord = Word(id = 1, slug = "fallback-slug", title = "FALLBACK")
            doReturn(savedWord).whenever(wordRepository).save(any())

            wordService.insertWordFromClaude(wordData, "fallback-slug", "fallback")
            verify(wordRepository).save(wordCaptor.capture())
            assertEquals("fallback-slug", wordCaptor.value.slug)
            assertEquals("FALLBACK", wordCaptor.value.title)
        }
    }

    @Nested
    inner class DeleteWordTests {
        @Test
        fun `returns true when word deleted`() {
            whenever(wordRepository.deleteBySlug("hello")).thenReturn(1L)
            assertTrue(wordService.deleteWord("hello"))
        }

        @Test
        fun `returns false when word not found`() {
            whenever(wordRepository.deleteBySlug("nonexistent")).thenReturn(0L)
            assertFalse(wordService.deleteWord("nonexistent"))
        }
    }

    @Nested
    inner class SearchWordsTests {
        @Test
        fun `throws exception for short query`() {
            assertThrows(IllegalArgumentException::class.java) {
                wordService.searchWords("a")
            }
        }

        @Test
        fun `returns empty for blank prefix query`() {
            val result = wordService.searchWords("!!")
            assertTrue(result.words.isEmpty())
        }

        @Test
        fun `builds correct tsquery and returns results`() {
            val rows = listOf(
                arrayOf<Any?>("hello", "Hello", "A greeting", 0.5f),
            )
            whenever(wordRepository.fullTextSearch("hello:*")).thenReturn(rows)

            val result = wordService.searchWords("hello")

            assertEquals(1, result.words.size)
            assertEquals("hello", result.words[0].slug)
            assertEquals(0.5, result.words[0].rank)
        }

        @Test
        fun `builds multi-word tsquery`() {
            whenever(wordRepository.fullTextSearch("hello:* & world:*")).thenReturn(emptyList())

            val result = wordService.searchWords("hello world")
            assertTrue(result.words.isEmpty())
            verify(wordRepository).fullTextSearch("hello:* & world:*")
        }
    }
}
