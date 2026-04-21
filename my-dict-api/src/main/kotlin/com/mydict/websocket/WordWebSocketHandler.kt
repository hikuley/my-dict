package com.mydict.websocket

import com.fasterxml.jackson.databind.ObjectMapper
import com.mydict.dto.ProcessingWordData
import com.mydict.dto.WsMessage
import org.slf4j.LoggerFactory
import org.springframework.stereotype.Component
import org.springframework.web.socket.CloseStatus
import org.springframework.web.socket.TextMessage
import org.springframework.web.socket.WebSocketSession
import org.springframework.web.socket.handler.TextWebSocketHandler
import java.util.concurrent.ConcurrentHashMap

@Component
class WordWebSocketHandler(
    private val objectMapper: ObjectMapper,
) : TextWebSocketHandler() {

    private val log = LoggerFactory.getLogger(javaClass)
    private val sessions = ConcurrentHashMap<String, WebSocketSession>()
    private val processingWords = ConcurrentHashMap<String, ProcessingWordData>()

    override fun afterConnectionEstablished(session: WebSocketSession) {
        log.info("[ws] Client connected")
        sessions[session.id] = session

        // Send current processing state to newly connected client
        processingWords.forEach { (_, data) ->
            val msg = objectMapper.writeValueAsString(WsMessage("word-processing", data))
            session.sendMessage(TextMessage(msg))
        }
    }

    override fun afterConnectionClosed(session: WebSocketSession, status: CloseStatus) {
        log.info("[ws] Client disconnected")
        sessions.remove(session.id)
    }

    fun trackProcessing(slug: String, word: String) {
        processingWords[slug] = ProcessingWordData(
            word = word,
            slug = slug,
            status = "processing",
            startedAt = System.currentTimeMillis(),
        )
    }

    fun clearProcessing(slug: String) {
        processingWords.remove(slug)
    }

    fun broadcastMessage(type: String, data: Any) {
        val msg = objectMapper.writeValueAsString(WsMessage(type, data))
        val textMessage = TextMessage(msg)
        sessions.values.forEach { session ->
            try {
                if (session.isOpen) {
                    session.sendMessage(textMessage)
                }
            } catch (e: Exception) {
                log.warn("[ws] Failed to send message to session ${session.id}: ${e.message}")
            }
        }
    }
}
