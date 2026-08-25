package com.brizymedia.keungilalert

import android.content.Context

/**
 * 고른 직군·지역과 최근 걸린 목록을 폰에 저장한다.
 * 카톡 내용은 서버로 보내지 않으므로 저장도 이 폰 안에서만 한다.
 */
class Store(context: Context) {

    private val sp = context.getSharedPreferences("keungil-alert", Context.MODE_PRIVATE)

    var jobIds: Set<String>
        get() = sp.getStringSet(KEY_JOBS, DEFAULT_JOBS) ?: DEFAULT_JOBS
        set(v) = sp.edit().putStringSet(KEY_JOBS, v).apply()

    var regionIds: Set<String>
        get() = sp.getStringSet(KEY_REGIONS, emptySet()) ?: emptySet()
        set(v) = sp.edit().putStringSet(KEY_REGIONS, v).apply()

    /** 고른 직군의 단어를 합친 것 (중복 제거) */
    fun jobWords(): List<String> {
        val ids = jobIds
        return Rules.JOBS.filter { it.id in ids }
            .flatMap { it.words }
            .distinctBy { it.lowercase() }
    }

    /** 고른 권역의 도시. 비어 있으면 전국. */
    fun cities(): List<String> {
        val ids = regionIds
        if (ids.isEmpty()) return emptyList()
        return Rules.REGIONS.filter { it.id in ids }.flatMap { it.cities }.distinct()
    }

    // ── 최근 걸린 목록 ─────────────────────────────
    // 줄바꿈으로 구분해 통째로 저장한다. 건수가 적어 이 정도면 충분하다.

    data class Hit(val at: Long, val room: String, val text: String)

    fun addHit(room: String, text: String) {
        val line = listOf(
            System.currentTimeMillis().toString(),
            room.replace(SEP, " ").replace("\n", " "),
            text.replace(SEP, " ").replace("\n", "  ")
        ).joinToString(SEP)

        val kept = (listOf(line) + hitLines()).take(MAX_HITS)
        sp.edit().putString(KEY_HITS, kept.joinToString("\n")).apply()
    }

    fun hits(): List<Hit> = hitLines().mapNotNull { line ->
        val p = line.split(SEP)
        if (p.size < 3) null else Hit(p[0].toLongOrNull() ?: 0L, p[1], p[2])
    }

    fun clearHits() = sp.edit().remove(KEY_HITS).apply()

    private fun hitLines(): List<String> =
        (sp.getString(KEY_HITS, "") ?: "").split("\n").filter { it.isNotBlank() }

    companion object {
        private const val KEY_JOBS = "jobs"
        private const val KEY_REGIONS = "regions"
        private const val KEY_HITS = "hits"
        private const val SEP = ""      // 본문에 나올 일 없는 글자
        private const val MAX_HITS = 200

        /** 처음 깔면 장비팀 기준으로 시작한다 — 큰길이벤트기획이 그 일을 한다 */
        private val DEFAULT_JOBS = setOf("sound", "led", "light")
    }
}
