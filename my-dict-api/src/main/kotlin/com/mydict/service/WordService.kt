package com.mydict.service

import com.fasterxml.jackson.databind.ObjectMapper
import com.mydict.dto.*
import com.mydict.entity.Word
import com.mydict.repository.WordRepository
import org.slf4j.LoggerFactory
import org.springframework.data.domain.PageRequest
import org.springframework.stereotype.Service
import org.springframework.transaction.annotation.Transactional

@Service
class WordService(
    private val wordRepository: WordRepository,
    private val objectMapper: ObjectMapper,
) {
    private val log = LoggerFactory.getLogger(javaClass)

    fun listWords(page: Int, limit: Int): WordListResponse {
        val safePage = page.coerceAtLeast(1)
        val safeLimit = limit.coerceIn(1, 100)
        val offset = safePage - 1
        log.info("[list] Request received: page=$safePage, limit=$safeLimit")

        val result = wordRepository.findAllOrdered(PageRequest.of(offset, safeLimit))
        log.info("[list] Returned ${result.numberOfElements} words (total: ${result.totalElements})")

        return WordListResponse(
            words = result.content.map { WordSummary(it.slug, it.title, it.subtitle) },
            page = safePage,
            limit = safeLimit,
            total = result.totalElements,
            totalPages = result.totalPages,
        )
    }

    fun searchWords(q: String): SearchResponse {
        val trimmed = q.trim()
        if (trimmed.length < 2) {
            throw IllegalArgumentException("Query must be at least 2 characters")
        }

        val prefixQuery = trimmed
            .split(Regex("\\s+"))
            .filter { it.isNotBlank() }
            .map { it.replace(Regex("[^a-zA-ZğüşıöçĞÜŞİÖÇ0-9]"), "") }
            .filter { it.isNotEmpty() }
            .joinToString(" & ") { "$it:*" }

        if (prefixQuery.isBlank()) {
            return SearchResponse(emptyList())
        }

        log.info("[search] Query: \"$trimmed\" -> tsquery: $prefixQuery")
        val rows = wordRepository.fullTextSearch(prefixQuery)
        log.info("[search] Found ${rows.size} results")

        return SearchResponse(
            words = rows.map { row ->
                SearchResult(
                    slug = row[0] as String,
                    title = row[1] as String,
                    subtitle = row[2] as? String,
                    rank = (row[3] as Number).toDouble(),
                )
            }
        )
    }

    fun getWordBySlug(slug: String): WordDetailResponse? {
        log.info("[detail] Request received: $slug")
        val word = wordRepository.findBySlug(slug)
        if (word == null) {
            log.info("[detail] Word not found: $slug")
            return null
        }
        log.info("[detail] Returned: $slug")
        return WordDetailResponse(
            slug = word.slug,
            title = word.title,
            phonetic = word.phonetic,
            subtitle = word.subtitle,
            sections = word.sections,
        )
    }

    fun slugExists(slug: String): Boolean = wordRepository.existsBySlug(slug)

    @Transactional
    fun createWord(slug: String, title: String, phonetic: String?, subtitle: String?, sections: Any?): WordDetailResponse {
        log.info("[create] Request received: slug=$slug, title=$title")

        val sectionsJson = when (sections) {
            is List<*> -> objectMapper.writeValueAsString(sections)
            is String -> sections
            else -> "[]"
        }

        val word = Word(
            slug = slug,
            title = title,
            phonetic = phonetic ?: "",
            subtitle = subtitle ?: "",
            sections = sectionsJson,
        )

        val saved = wordRepository.save(word)
        log.info("[create] Word created: ${saved.slug}")
        return WordDetailResponse(
            slug = saved.slug,
            title = saved.title,
            phonetic = saved.phonetic,
            subtitle = saved.subtitle,
            sections = saved.sections,
        )
    }

    @Transactional
    fun insertWordFromClaude(wordData: Map<String, Any?>, fallbackSlug: String, fallbackWord: String): Word {
        val slug = wordData["slug"] as? String ?: fallbackSlug
        val title = wordData["title"] as? String ?: fallbackWord.uppercase()
        val phonetic = wordData["phonetic"] as? String ?: ""
        val subtitle = wordData["subtitle"] as? String ?: ""
        val sections = when (val s = wordData["sections"]) {
            is List<*> -> objectMapper.writeValueAsString(s)
            is String -> s
            else -> "[]"
        }

        val word = Word(
            slug = slug,
            title = title,
            phonetic = phonetic,
            subtitle = subtitle,
            sections = sections,
        )

        val saved = wordRepository.save(word)
        log.info("[create] Word created from Claude: ${saved.slug}")
        return saved
    }

    @Transactional
    fun deleteWord(slug: String): Boolean {
        log.info("[delete] Request received: $slug")
        val deleted = wordRepository.deleteBySlug(slug)
        if (deleted == 0L) {
            log.info("[delete] Word not found: $slug")
            return false
        }
        log.info("[delete] Word deleted: $slug")
        return true
    }

    companion object {
        fun generateSlug(word: String): String =
            word.lowercase().trim()
                .replace(Regex("\\s+"), "-")
                .replace(Regex("[^a-z0-9-]"), "")
    }
}
