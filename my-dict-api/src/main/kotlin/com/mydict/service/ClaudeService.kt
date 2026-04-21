package com.mydict.service

import com.mydict.util.JsonParser
import okhttp3.MediaType.Companion.toMediaType
import okhttp3.OkHttpClient
import okhttp3.Request
import okhttp3.RequestBody.Companion.toRequestBody
import org.slf4j.LoggerFactory
import org.springframework.beans.factory.annotation.Value
import org.springframework.stereotype.Service
import java.util.concurrent.TimeUnit

@Service
class ClaudeService(
    @Value("\${app.anthropic-api-key}") private val apiKey: String,
) {
    private val log = LoggerFactory.getLogger(javaClass)
    private val jsonMediaType = "application/json".toMediaType()

    private val client = OkHttpClient.Builder()
        .connectTimeout(30, TimeUnit.SECONDS)
        .readTimeout(120, TimeUnit.SECONDS)
        .writeTimeout(30, TimeUnit.SECONDS)
        .build()

    private val promptTemplate: String = javaClass.classLoader
        .getResource("prompts/generate-word.md")!!
        .readText()

    fun generateWordData(word: String, slug: String): Map<String, Any?> {
        val prompt = promptTemplate
            .replace("{{word}}", word)
            .replace("{{slug}}", slug)

        log.info("[claude] Calling Claude API for: $word")
        val startTime = System.currentTimeMillis()

        val requestBody = """
            {
                "model": "claude-sonnet-4-6",
                "max_tokens": 16000,
                "messages": [{"role": "user", "content": ${escapeJsonString(prompt)}}]
            }
        """.trimIndent()

        val request = Request.Builder()
            .url("https://api.anthropic.com/v1/messages")
            .addHeader("x-api-key", apiKey)
            .addHeader("anthropic-version", "2023-06-01")
            .addHeader("content-type", "application/json")
            .post(requestBody.toRequestBody(jsonMediaType))
            .build()

        val response = client.newCall(request).execute()
        val body = response.body?.string() ?: throw RuntimeException("Empty response from Claude API")

        if (!response.isSuccessful) {
            throw RuntimeException("Claude API returned ${response.code}: $body")
        }

        val elapsed = (System.currentTimeMillis() - startTime) / 1000.0
        log.info("[claude] Response received in ${String.format("%.1f", elapsed)}s")

        // Extract text from response
        val responseMap = com.fasterxml.jackson.databind.ObjectMapper()
            .registerModule(com.fasterxml.jackson.module.kotlin.kotlinModule())
            .readValue(body, Map::class.java)

        @Suppress("UNCHECKED_CAST")
        val content = responseMap["content"] as? List<Map<String, Any>>
            ?: throw RuntimeException("Unexpected Claude API response format")

        val rawText = content.firstOrNull()?.get("text") as? String
            ?: throw RuntimeException("No text in Claude API response")

        return JsonParser.parseClaudeResponse(rawText)
            ?: throw RuntimeException("Failed to parse Claude API response")
    }

    private fun escapeJsonString(text: String): String {
        val sb = StringBuilder("\"")
        for (c in text) {
            when (c) {
                '"' -> sb.append("\\\"")
                '\\' -> sb.append("\\\\")
                '\n' -> sb.append("\\n")
                '\r' -> sb.append("\\r")
                '\t' -> sb.append("\\t")
                '\b' -> sb.append("\\b")
                '\u000C' -> sb.append("\\f")
                else -> {
                    if (c < ' ') {
                        sb.append(String.format("\\u%04x", c.code))
                    } else {
                        sb.append(c)
                    }
                }
            }
        }
        sb.append("\"")
        return sb.toString()
    }
}
