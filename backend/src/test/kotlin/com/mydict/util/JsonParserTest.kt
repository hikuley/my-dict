package com.mydict.util

import org.junit.jupiter.api.Assertions.*
import org.junit.jupiter.api.Test

class JsonParserTest {

    @Test
    fun `parses clean JSON directly`() {
        val json = """{"slug": "hello", "title": "Hello"}"""
        val result = JsonParser.parseClaudeResponse(json)

        assertNotNull(result)
        assertEquals("hello", result!!["slug"])
        assertEquals("Hello", result["title"])
    }

    @Test
    fun `parses JSON wrapped in markdown code fences`() {
        val json = """
            ```json
            {"slug": "hello", "title": "Hello"}
            ```
        """.trimIndent()
        val result = JsonParser.parseClaudeResponse(json)

        assertNotNull(result)
        assertEquals("hello", result!!["slug"])
    }

    @Test
    fun `parses JSON with generic code fences`() {
        val json = """
            ```
            {"slug": "test", "title": "Test"}
            ```
        """.trimIndent()
        val result = JsonParser.parseClaudeResponse(json)

        assertNotNull(result)
        assertEquals("test", result!!["slug"])
    }

    @Test
    fun `handles invalid escape sequences`() {
        val json = """{"slug": "hello", "title": "Hello \World"}"""
        val result = JsonParser.parseClaudeResponse(json)

        assertNotNull(result)
        assertEquals("hello", result!!["slug"])
    }

    @Test
    fun `extracts JSON from surrounding text`() {
        val text = """
            Here is the word data:
            {"slug": "hello", "title": "Hello", "phonetic": "/həˈloʊ/"}
            I hope this helps!
        """.trimIndent()
        val result = JsonParser.parseClaudeResponse(text)

        assertNotNull(result)
        assertEquals("hello", result!!["slug"])
        assertEquals("/həˈloʊ/", result["phonetic"])
    }

    @Test
    fun `handles nested JSON objects`() {
        val json = """{"slug": "hello", "sections": [{"type": "definition", "items": [{"text": "greeting"}]}]}"""
        val result = JsonParser.parseClaudeResponse(json)

        assertNotNull(result)
        assertEquals("hello", result!!["slug"])
        assertTrue(result["sections"] is List<*>)
    }

    @Test
    fun `returns null for non-JSON text`() {
        val result = JsonParser.parseClaudeResponse("This is just plain text with no JSON")
        assertNull(result)
    }

    @Test
    fun `returns null for empty input`() {
        val result = JsonParser.parseClaudeResponse("")
        assertNull(result)
    }

    @Test
    fun `handles JSON with null values`() {
        val json = """{"slug": "hello", "phonetic": null, "subtitle": null}"""
        val result = JsonParser.parseClaudeResponse(json)

        assertNotNull(result)
        assertEquals("hello", result!!["slug"])
        assertNull(result["phonetic"])
    }

    @Test
    fun `extracts JSON with invalid escapes in surrounding text`() {
        val text = """Sure! Here's the data \n for you:
            {"slug": "test", "title": "Test \Word"}
            Done!"""
        val result = JsonParser.parseClaudeResponse(text)

        assertNotNull(result)
        assertEquals("test", result!!["slug"])
    }

    @Test
    fun `handles complex real-world Claude response`() {
        val json = """
            ```json
            {
                "slug": "ephemeral",
                "title": "EPHEMERAL",
                "phonetic": "/ɪˈfɛmərəl/",
                "subtitle": "Lasting for a very short time",
                "sections": [
                    {
                        "type": "definition",
                        "items": [
                            {"text": "Lasting for a very short time; transitory."}
                        ]
                    }
                ]
            }
            ```
        """.trimIndent()
        val result = JsonParser.parseClaudeResponse(json)

        assertNotNull(result)
        assertEquals("ephemeral", result!!["slug"])
        assertEquals("EPHEMERAL", result["title"])
        assertEquals("/ɪˈfɛmərəl/", result["phonetic"])
    }
}
