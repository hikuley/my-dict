package com.mydict.util

import org.slf4j.LoggerFactory

object JsonParser {
    private val log = LoggerFactory.getLogger(javaClass)

    private fun sanitizeJson(text: String): String =
        text.replace(Regex("""\\(?!["\\/bfnrtu])"""), """\\\\""")

    private fun extractJsonByBracketCounting(text: String): String? {
        val start = text.indexOf('{')
        if (start == -1) return null

        var depth = 0
        for (i in start until text.length) {
            when (text[i]) {
                '{' -> depth++
                '}' -> depth--
            }
            if (depth == 0) return text.substring(start, i + 1)
        }
        return null
    }

    private fun tryParse(text: String): Map<String, Any?>? {
        return try {
            @Suppress("UNCHECKED_CAST")
            com.fasterxml.jackson.databind.ObjectMapper()
                .registerModule(com.fasterxml.jackson.module.kotlin.kotlinModule())
                .readValue(text, Map::class.java) as Map<String, Any?>
        } catch (_: Exception) {
            null
        }
    }

    fun parseClaudeResponse(rawText: String): Map<String, Any?>? {
        // Strip markdown code fences
        val cleaned = rawText
            .replace(Regex("^```(?:json)?\\s*\\n?", RegexOption.MULTILINE), "")
            .replace(Regex("\\n?```\\s*$", RegexOption.MULTILINE), "")
            .trim()

        // Stage 1: Direct parse
        tryParse(cleaned)?.let { return it }

        // Stage 2: Sanitize invalid escapes, then parse
        tryParse(sanitizeJson(cleaned))?.let { return it }

        // Stage 3: Extract JSON by bracket counting
        val extracted = extractJsonByBracketCounting(cleaned)
        if (extracted != null) {
            tryParse(extracted)?.let { return it }

            // Stage 4: Sanitize extracted JSON
            tryParse(sanitizeJson(extracted))?.let { return it }
            log.error("[json-parser] Failed to parse extracted JSON")
        }

        return null
    }
}
