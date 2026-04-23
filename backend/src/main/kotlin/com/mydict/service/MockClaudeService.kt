package com.mydict.service

import org.slf4j.LoggerFactory
import org.springframework.context.annotation.Profile
import org.springframework.stereotype.Service

@Service
@Profile("mock-claude")
class MockClaudeService : ClaudeService {
    private val log = LoggerFactory.getLogger(javaClass)

    override fun generateWordData(word: String, slug: String): Map<String, Any?> {
        log.info("[mock-claude] Generating mock data for: $word (slug: $slug)")

        return mapOf(
            "slug" to slug,
            "title" to word.uppercase(),
            "phonetic" to "/$word/",
            "subtitle" to "mock meaning 1 · mock meaning 2",
            "sections" to listOf(
                mapOf("icon" to "📖", "title" to "Definition / Tanım", "content" to "<p>Mock definition for <b>$word</b>.</p>"),
                mapOf("icon" to "📝", "title" to "Grammar and Usage / Dilbilgisi ve Kullanım", "content" to "<p>Mock grammar info.</p>"),
                mapOf("icon" to "⏱️", "title" to "Verb Tenses / Fiil Zamanları", "content" to "<p>Mock verb tenses.</p>"),
                mapOf("icon" to "🔗", "title" to "Common Prepositions & Collocations / Edatlar ve Eşdizimler", "content" to "<p>Mock collocations.</p>"),
                mapOf("icon" to "💬", "title" to "Example Sentences / Örnek Cümleler", "content" to "<p>Mock example: I use <b>$word</b> every day.</p>"),
                mapOf("icon" to "🏛️", "title" to "Word Root & History / Kelimenin Kökeni", "content" to "<p>Mock etymology.</p>"),
                mapOf("icon" to "⚖️", "title" to "Similar Words Comparison / Benzer Kelimeler", "content" to "<p>Mock comparison.</p>"),
                mapOf("icon" to "🌍", "title" to "Usage in Different Fields / Farklı Alanlarda Kullanım", "content" to "<p>Mock field usage.</p>"),
            )
        )
    }
}
