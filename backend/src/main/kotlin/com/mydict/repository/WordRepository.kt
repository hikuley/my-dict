package com.mydict.repository

import com.mydict.entity.Word
import org.springframework.data.domain.Page
import org.springframework.data.domain.Pageable
import org.springframework.data.jpa.repository.JpaRepository
import org.springframework.data.jpa.repository.Query
import org.springframework.data.repository.query.Param
import org.springframework.stereotype.Repository

@Repository
interface WordRepository : JpaRepository<Word, Long> {

    fun findBySlug(slug: String): Word?

    fun existsBySlug(slug: String): Boolean

    fun deleteBySlug(slug: String): Long

    @Query("SELECT w FROM Word w ORDER BY w.createdAt DESC")
    fun findAllOrdered(pageable: Pageable): Page<Word>

    @Query(
        value = """
            SELECT slug, title, subtitle,
                   ts_rank(search_vector, to_tsquery('simple', :query)) AS rank
            FROM words
            WHERE search_vector @@ to_tsquery('simple', :query)
            ORDER BY rank DESC, title ASC
            LIMIT 50
        """,
        nativeQuery = true
    )
    fun fullTextSearch(@Param("query") query: String): List<Array<Any?>>
}
