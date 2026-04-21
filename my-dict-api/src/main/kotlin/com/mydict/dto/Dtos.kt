package com.mydict.dto

import com.fasterxml.jackson.annotation.JsonInclude
import com.fasterxml.jackson.annotation.JsonRawValue

// --- Responses ---

data class WordListResponse(
    val words: List<WordSummary>,
    val page: Int,
    val limit: Int,
    val total: Long,
    val totalPages: Int,
)

data class WordSummary(
    val slug: String,
    val title: String,
    val subtitle: String?,
)

data class WordDetailResponse(
    val slug: String,
    val title: String,
    val phonetic: String?,
    val subtitle: String?,
    @JsonRawValue
    val sections: String,
)

data class SearchResult(
    val slug: String,
    val title: String,
    val subtitle: String?,
    val rank: Double,
)

data class SearchResponse(
    val words: List<SearchResult>,
)

data class GenerateResponse(
    val message: String,
    val word: String,
    val slug: String,
)

@JsonInclude(JsonInclude.Include.NON_NULL)
data class ErrorResponse(
    val error: String,
)

data class MessageResponse(
    val message: String,
    val slug: String,
)

data class HealthResponse(
    val status: String = "ok",
)

// --- Requests ---

data class GenerateRequest(
    val word: String?,
)

data class CreateWordRequest(
    val slug: String?,
    val title: String?,
    val phonetic: String? = null,
    val subtitle: String? = null,
    val sections: Any? = null,
)

// --- WebSocket ---

data class WsMessage(
    val type: String,
    val data: Any,
)

data class ProcessingWordData(
    val word: String,
    val slug: String,
    val status: String = "processing",
    val startedAt: Long? = null,
)

data class WordReadyData(
    val word: String,
    val slug: String,
)

data class WordErrorData(
    val word: String,
    val slug: String,
    val error: String,
)
