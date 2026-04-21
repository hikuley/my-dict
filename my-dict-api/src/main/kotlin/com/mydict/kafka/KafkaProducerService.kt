package com.mydict.kafka

import com.fasterxml.jackson.databind.ObjectMapper
import org.slf4j.LoggerFactory
import org.springframework.beans.factory.annotation.Value
import org.springframework.kafka.core.KafkaTemplate
import org.springframework.stereotype.Service

@Service
class KafkaProducerService(
    private val kafkaTemplate: KafkaTemplate<String, String>,
    private val objectMapper: ObjectMapper,
    @Value("\${app.kafka-topic}") private val topic: String,
) {
    private val log = LoggerFactory.getLogger(javaClass)

    fun send(word: String, slug: String) {
        val message = objectMapper.writeValueAsString(mapOf("word" to word, "slug" to slug))
        kafkaTemplate.send(topic, message)
        log.info("[kafka-producer] Message sent to topic: $topic")
    }
}
