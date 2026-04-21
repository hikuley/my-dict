package com.mydict.kafka

import com.fasterxml.jackson.databind.ObjectMapper
import com.mydict.dto.ProcessingWordData
import com.mydict.dto.WordErrorData
import com.mydict.dto.WordReadyData
import com.mydict.service.ClaudeService
import com.mydict.service.WordService
import com.mydict.websocket.WordWebSocketHandler
import org.slf4j.LoggerFactory
import org.springframework.kafka.annotation.KafkaListener
import org.springframework.stereotype.Component

@Component
class WordGenerationConsumer(
    private val objectMapper: ObjectMapper,
    private val wordService: WordService,
    private val claudeService: ClaudeService,
    private val webSocketHandler: WordWebSocketHandler,
) {
    private val log = LoggerFactory.getLogger(javaClass)

    @KafkaListener(topics = ["\${app.kafka-topic}"], groupId = "word-generator-group")
    fun consume(message: String) {
        val payload: Map<String, String>
        try {
            @Suppress("UNCHECKED_CAST")
            payload = objectMapper.readValue(message, Map::class.java) as Map<String, String>
        } catch (e: Exception) {
            log.error("[kafka-consumer] Invalid message format")
            return
        }

        val word = payload["word"] ?: return
        val slug = payload["slug"] ?: return
        log.info("[kafka-consumer] Processing word: $word")

        webSocketHandler.broadcastMessage(
            "word-processing",
            ProcessingWordData(word = word, slug = slug, status = "processing")
        )

        try {
            processWord(word, slug)
        } catch (e: Exception) {
            log.error("[kafka-consumer] Error processing word: ${e.message}")
            webSocketHandler.clearProcessing(slug)
            webSocketHandler.broadcastMessage(
                "word-error",
                WordErrorData(word = word, slug = slug, error = "Failed to generate word")
            )
        }
    }

    private fun processWord(word: String, slug: String) {
        if (wordService.slugExists(slug)) {
            log.info("[kafka-consumer] Word already exists: $slug")
            webSocketHandler.clearProcessing(slug)
            webSocketHandler.broadcastMessage(
                "word-error",
                WordErrorData(word = word, slug = slug, error = "This word already exists in the dictionary")
            )
            return
        }

        val wordData = claudeService.generateWordData(word, slug)
        val created = wordService.insertWordFromClaude(wordData, slug, word)

        log.info("[kafka-consumer] Word created: ${created.slug}")
        webSocketHandler.clearProcessing(slug)
        webSocketHandler.broadcastMessage(
            "word-ready",
            WordReadyData(word = created.title, slug = created.slug)
        )
    }
}
