package com.mydict.controller

import com.mydict.dto.*
import com.mydict.entity.User
import com.mydict.kafka.KafkaProducerService
import com.mydict.service.ApiUsageService
import com.mydict.service.WordService
import com.mydict.websocket.WordWebSocketHandler
import org.slf4j.LoggerFactory
import org.springframework.dao.DataIntegrityViolationException
import org.springframework.http.HttpStatus
import org.springframework.http.ResponseEntity
import org.springframework.security.core.annotation.AuthenticationPrincipal
import org.springframework.web.bind.annotation.*

@RestController
@RequestMapping("/api")
class WordController(
    private val wordService: WordService,
    private val kafkaProducerService: KafkaProducerService,
    private val webSocketHandler: WordWebSocketHandler,
    private val apiUsageService: ApiUsageService,
) {
    private val log = LoggerFactory.getLogger(javaClass)

    @GetMapping("/words")
    fun listWords(
        @RequestParam(defaultValue = "1") page: Int,
        @RequestParam(defaultValue = "20") limit: Int,
    ): ResponseEntity<WordListResponse> {
        return ResponseEntity.ok(wordService.listWords(page, limit))
    }

    @GetMapping("/words/search")
    fun searchWords(@RequestParam q: String?): ResponseEntity<Any> {
        val query = q?.trim() ?: ""
        if (query.length < 2) {
            return ResponseEntity.badRequest().body(ErrorResponse("Query must be at least 2 characters"))
        }
        return ResponseEntity.ok(wordService.searchWords(query))
    }

    @GetMapping("/words/{slug}")
    fun getWord(@PathVariable slug: String): ResponseEntity<Any> {
        val word = wordService.getWordBySlug(slug)
            ?: return ResponseEntity.status(HttpStatus.NOT_FOUND).body(ErrorResponse("Word not found"))
        return ResponseEntity.ok(word)
    }

    @PostMapping("/words/generate")
    fun generateWord(
        @RequestBody request: GenerateRequest,
        @AuthenticationPrincipal user: User,
    ): ResponseEntity<Any> {
        val word = request.word?.trim()
        log.info("[generate] Request received: word=$word, user=${user.id}")

        if (word.isNullOrBlank()) {
            return ResponseEntity.badRequest().body(ErrorResponse("word is required"))
        }

        if (!apiUsageService.checkAndIncrement(user.id!!)) {
            return ResponseEntity.status(HttpStatus.TOO_MANY_REQUESTS)
                .body(ErrorResponse("Monthly API usage limit reached. Please try again next month."))
        }

        val sanitized = word.take(100)
        val slug = WordService.generateSlug(sanitized)

        if (wordService.slugExists(slug)) {
            return ResponseEntity.status(HttpStatus.CONFLICT)
                .body(ErrorResponse("This word already exists in the dictionary"))
        }

        kafkaProducerService.send(sanitized, slug)
        webSocketHandler.trackProcessing(slug, sanitized)
        log.info("[generate] Word queued for processing: $slug")

        return ResponseEntity.status(HttpStatus.ACCEPTED)
            .body(GenerateResponse("Word queued for processing", sanitized, slug))
    }

    @PostMapping("/words")
    fun createWord(@RequestBody request: CreateWordRequest): ResponseEntity<Any> {
        if (request.slug.isNullOrBlank() || request.title.isNullOrBlank()) {
            return ResponseEntity.badRequest().body(ErrorResponse("slug and title are required"))
        }

        if (request.sections != null && request.sections !is List<*>) {
            return ResponseEntity.badRequest().body(ErrorResponse("sections must be an array"))
        }

        return try {
            val created = wordService.createWord(
                slug = request.slug,
                title = request.title,
                phonetic = request.phonetic,
                subtitle = request.subtitle,
                sections = request.sections,
            )
            ResponseEntity.status(HttpStatus.CREATED).body(created)
        } catch (e: DataIntegrityViolationException) {
            log.info("[create] Duplicate slug: ${request.slug}")
            ResponseEntity.status(HttpStatus.CONFLICT)
                .body(ErrorResponse("A word with this slug already exists"))
        }
    }

    @DeleteMapping("/words/{slug}")
    fun deleteWord(@PathVariable slug: String): ResponseEntity<Any> {
        return if (wordService.deleteWord(slug)) {
            ResponseEntity.ok(MessageResponse("Word deleted", slug))
        } else {
            ResponseEntity.status(HttpStatus.NOT_FOUND).body(ErrorResponse("Word not found"))
        }
    }

    @GetMapping("/health")
    fun health(): ResponseEntity<HealthResponse> {
        return ResponseEntity.ok(HealthResponse())
    }
}
