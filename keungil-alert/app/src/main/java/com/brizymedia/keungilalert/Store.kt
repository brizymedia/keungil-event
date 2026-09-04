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

    // ── 콜백 문자 ──────────────────────────────────
    // 전화를 받고 끊으면 내 명함 링크를 문자로 보낸다.
    // 문자는 통신사 요금이 붙으므로 안전장치를 여럿 둔다.

    var callbackOn: Boolean
        get() = sp.getBoolean(KEY_CB_ON, false)
        set(v) = sp.edit().putBoolean(KEY_CB_ON, v).apply()

    /** 내 전자명함 주소. 문자에 이 링크가 실린다. */
    var cardUrl: String
        get() = sp.getString(KEY_CB_URL, "") ?: ""
        set(v) = sp.edit().putString(KEY_CB_URL, v.trim()).apply()

    var cbText: String
        get() = sp.getString(KEY_CB_TEXT, DEFAULT_CB_TEXT) ?: DEFAULT_CB_TEXT
        set(v) = sp.edit().putString(KEY_CB_TEXT, v).apply()

    /** 켜면 바로 보내지 않고 알림으로 물어본다 (요금·오발송이 걱정될 때) */
    var cbAsk: Boolean
        get() = sp.getBoolean(KEY_CB_ASK, true)
        set(v) = sp.edit().putBoolean(KEY_CB_ASK, v).apply()

    /** 주소록에 있는 사람에게는 안 보낸다 — 아는 사이엔 명함이 필요 없다 */
    var cbSkipKnown: Boolean
        get() = sp.getBoolean(KEY_CB_SKIP, true)
        set(v) = sp.edit().putBoolean(KEY_CB_SKIP, v).apply()

    /** 걸려온 전화만 (내가 건 전화는 제외) */
    var cbIncomingOnly: Boolean
        get() = sp.getBoolean(KEY_CB_IN, true)
        set(v) = sp.edit().putBoolean(KEY_CB_IN, v).apply()

    var cbDailyCap: Int
        get() = sp.getInt(KEY_CB_CAP, 30)
        set(v) = sp.edit().putInt(KEY_CB_CAP, v).apply()

    /** 오늘 보낸 건수. 날이 바뀌면 0 부터 다시 센다. */
    fun sentToday(): Int {
        val 오늘 = 날짜도장()
        return if (sp.getString(KEY_CB_DAY, "") == 오늘) sp.getInt(KEY_CB_COUNT, 0) else 0
    }
    fun countSend() {
        val 오늘 = 날짜도장()
        val n = if (sp.getString(KEY_CB_DAY, "") == 오늘) sp.getInt(KEY_CB_COUNT, 0) else 0
        sp.edit().putString(KEY_CB_DAY, 오늘).putInt(KEY_CB_COUNT, n + 1).apply()
    }

    /** 같은 번호에 며칠 안에 또 보내지 않는다 */
    fun sentRecently(number: String, days: Int = 30): Boolean {
        val at = sp.getLong(KEY_CB_SENT + number, 0L)
        return at > 0 && System.currentTimeMillis() - at < days * 86_400_000L
    }
    fun markSent(number: String) =
        sp.edit().putLong(KEY_CB_SENT + number, System.currentTimeMillis()).apply()

    private fun 날짜도장(): String {
        val c = java.util.Calendar.getInstance()
        return "%04d-%02d-%02d".format(c.get(java.util.Calendar.YEAR),
            c.get(java.util.Calendar.MONTH) + 1, c.get(java.util.Calendar.DAY_OF_MONTH))
    }

    /** 문자에 실제로 나갈 글. 링크가 없으면 빈 문자열 — 그러면 보내지 않는다. */
    fun cbMessage(): String {
        val url = cardUrl
        if (url.isBlank()) return ""
        return cbText.trim() + "\n" + url
    }

    // ── 최근 걸린 목록 ─────────────────────────────
    // 줄바꿈으로 구분해 통째로 저장한다. 건수가 적어 이 정도면 충분하다.

    // ── 행사 입찰 알림 ─────────────────────────────
    // 알림판 공개 JSON 을 하루 한 번 읽는다. 본 공고 번호를 기억해 새것만 알린다.

    var bidOn: Boolean
        get() = sp.getBoolean("bid_on", true)
        set(v) = sp.edit().putBoolean("bid_on", v).apply()

    /** 마지막으로 확인한 시각. 0 이면 아직 한 번도 안 돈 것 */
    var bidLast: Long
        get() = sp.getLong("bid_last", 0L)
        set(v) = sp.edit().putLong("bid_last", v).apply()

    /** 마지막 확인에서 새로 뜬 공고 수 (설정 화면 표시용) */
    var bidLastCount: Int
        get() = sp.getInt("bid_last_count", 0)
        set(v) = sp.edit().putInt("bid_last_count", v).apply()

    /** 이미 본 공고 번호들 — 지금 판에 있는 것만 유지되므로 무한히 커지지 않는다 */
    var bidSeen: Set<String>
        get() = sp.getStringSet("bid_seen", emptySet()) ?: emptySet()
        set(v) = sp.edit().putStringSet("bid_seen", v).apply()

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

        private const val KEY_CB_ON = "cb_on"
        private const val KEY_CB_URL = "cb_url"
        private const val KEY_CB_TEXT = "cb_text"
        private const val KEY_CB_ASK = "cb_ask"
        private const val KEY_CB_SKIP = "cb_skip"
        private const val KEY_CB_IN = "cb_in"
        private const val KEY_CB_CAP = "cb_cap"
        private const val KEY_CB_DAY = "cb_day"
        private const val KEY_CB_COUNT = "cb_count"
        private const val KEY_CB_SENT = "cb_sent_"

        /** 짧게 둔다. 한글 45자가 넘으면 문자가 쪼개져 요금이 배로 든다. */
        const val DEFAULT_CB_TEXT = "통화 감사합니다. 명함 보내드립니다."

        /** 처음 깔면 장비팀 기준으로 시작한다 — 큰길이벤트기획이 그 일을 한다 */
        private val DEFAULT_JOBS = setOf("sound", "led", "light")
    }
}
