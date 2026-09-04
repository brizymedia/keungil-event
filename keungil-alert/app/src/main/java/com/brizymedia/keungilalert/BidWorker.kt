package com.brizymedia.keungilalert

import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.content.Context
import android.content.Intent
import android.net.Uri
import androidx.core.app.NotificationCompat
import androidx.work.Constraints
import androidx.work.ExistingPeriodicWorkPolicy
import androidx.work.NetworkType
import androidx.work.OneTimeWorkRequestBuilder
import androidx.work.PeriodicWorkRequestBuilder
import androidx.work.WorkManager
import androidx.work.Worker
import androidx.work.WorkerParameters
import org.json.JSONObject
import java.io.BufferedReader
import java.io.InputStreamReader
import java.net.HttpURLConnection
import java.net.URL
import java.text.SimpleDateFormat
import java.util.Locale
import java.util.concurrent.TimeUnit

/**
 * 나라장터 행사 입찰 알림.
 *
 * 행사 고시 알림판(haengsa-board)이 매일 아침 만드는 공개 JSON 을 하루 한 번 읽어
 * 「새로 뜬 행사 입찰」과 「3일 안 마감」을 알림 하나로 알려준다. 누르면 이벤트 코리아 입찰판이 열린다.
 *
 * 카톡 내용과는 아무 상관이 없다. 이 앱이 인터넷을 쓰는 곳은 여기 하나뿐이고,
 * 하는 일은 공개 파일을 「달라」고 하는 것뿐이다. 폰에서 밖으로 나가는 정보는 없다.
 */
class BidWorker(ctx: Context, params: WorkerParameters) : Worker(ctx, params) {

    private data class Bid(val uid: String, val title: String, val org: String, val deadline: Long)

    override fun doWork(): Result {
        val store = Store(applicationContext)
        if (!store.bidOn) return Result.success()

        return try {
            val items = JSONObject(fetch(FEED)).getJSONArray("items")
            val now = System.currentTimeMillis()
            val first = store.bidLast == 0L          // 처음 도는 날
            val seen = store.bidSeen

            val fresh = ArrayList<Bid>()             // 지난번 이후 처음 보는 공고
            val soon = ArrayList<Bid>()              // 3일 안 마감
            val open = ArrayList<Bid>()              // 아직 안 지난 공고 전부
            val all = ArrayList<String>()

            for (i in 0 until items.length()) {
                val o = items.getJSONObject(i)
                if (o.optString("kind") != "bid") continue
                val uid = o.optString("uid")
                if (uid.isBlank()) continue
                all.add(uid)
                val deadline = parse(o.optString("deadline"))
                if (deadline > 0 && deadline < now) continue          // 이미 지난 것
                val b = Bid(uid, o.optString("title"), o.optString("org"), deadline)
                open.add(b)
                if (!first && uid !in seen) fresh.add(b)
                else if (deadline > 0 && deadline - now < SOON_MS) soon.add(b)
            }

            if (first) {
                // 처음엔 「새로 뜬 것」이 251건이 되어 버린다. 그날은 시작 인사 한 번 —
                // 마감 임박이 있으면 그것을, 없으면 마감 가까운 순으로 몇 건만 보여준다.
                val list = if (soon.isNotEmpty()) soon
                           else open.sortedBy { if (it.deadline > 0) it.deadline else Long.MAX_VALUE }.take(5)
                showNotification(applicationContext, emptyList(), list, open.size)
            } else if (fresh.isNotEmpty() || soon.isNotEmpty()) {
                showNotification(applicationContext, fresh, soon, -1)
            }

            // 본 것 기억 — 지금 판에 있는 것만 (사라진 공고는 같이 사라진다)
            store.bidSeen = all.toSet()
            store.bidLast = now
            store.bidLastCount = fresh.size
            Result.success()
        } catch (e: Exception) {
            Result.retry()
        }
    }

    private fun fetch(url: String): String {
        val c = URL(url).openConnection() as HttpURLConnection
        c.connectTimeout = 15_000
        c.readTimeout = 20_000
        c.setRequestProperty("Accept", "application/json")
        c.setRequestProperty("User-Agent", "keungil-alert/0.2")
        try {
            if (c.responseCode != 200) throw IllegalStateException("HTTP " + c.responseCode)
            return BufferedReader(InputStreamReader(c.inputStream, Charsets.UTF_8)).use { it.readText() }
        } finally { c.disconnect() }
    }

    /** openTotal 이 0 이상이면 「처음 시작」 알림이다 */
    private fun showNotification(ctx: Context, fresh: List<Bid>, soon: List<Bid>, openTotal: Int) {
        val nm = ctx.getSystemService(NotificationManager::class.java) ?: return
        ensureChannel(ctx)

        val first = openTotal >= 0
        val title = when {
            first -> "행사 입찰 알림 시작 — 진행 중 공고 " + openTotal + "건"
            fresh.isNotEmpty() && soon.isNotEmpty() -> "새 행사 입찰 " + fresh.size + "건 · 마감 임박 " + soon.size + "건"
            fresh.isNotEmpty() -> "새 행사 입찰 " + fresh.size + "건"
            else -> "마감 임박 행사 입찰 " + soon.size + "건"
        }
        val lines = (fresh + soon).distinctBy { it.uid }
            .sortedBy { if (it.deadline > 0) it.deadline else Long.MAX_VALUE }
            .take(5)
            .map { "· " + it.title.take(30) + (if (it.org.isNotBlank()) " — " + it.org.take(12) else "") + dday(it.deadline) }
        val big = NotificationCompat.InboxStyle().setSummaryText(
            if (first) "내일부터 새 공고·마감 임박만 하루 한 번" else "나라장터 · 눌러서 전체 보기")
        lines.forEach { big.addLine(it) }

        val open = Intent(Intent.ACTION_VIEW, Uri.parse(PORTAL))
        val pi = PendingIntent.getActivity(ctx, 7, open,
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE)

        val n = NotificationCompat.Builder(ctx, CHANNEL)
            .setSmallIcon(android.R.drawable.ic_dialog_info)
            .setContentTitle(title)
            .setContentText(lines.firstOrNull() ?: "이벤트 코리아 입찰판에서 확인하세요")
            .setStyle(big)
            .setContentIntent(pi)
            .setAutoCancel(true)
            .setPriority(NotificationCompat.PRIORITY_DEFAULT)
            .setCategory(NotificationCompat.CATEGORY_RECOMMENDATION)
            .build()
        nm.notify(NOTI_ID, n)
    }

    private fun dday(deadline: Long): String {
        if (deadline <= 0) return ""
        val d = ((deadline - System.currentTimeMillis()) / 86_400_000L).toInt()
        return when {
            d <= 0 -> " · 오늘 마감"
            d == 1 -> " · 내일 마감"
            else -> " · D-" + d
        }
    }

    private fun parse(s: String): Long {
        if (s.isBlank()) return 0L
        return try {
            val f = if (s.length > 10) SimpleDateFormat("yyyy-MM-dd HH:mm", Locale.KOREA)
                    else SimpleDateFormat("yyyy-MM-dd", Locale.KOREA)
            f.parse(s)?.time ?: 0L
        } catch (e: Exception) { 0L }
    }

    companion object {
        const val FEED = "https://brizymedia.github.io/haengsa-board/data/events.json"
        const val PORTAL = "https://www.event-korea.co.kr/#live"
        const val CHANNEL = "keungil-bid"
        const val WORK = "bid-daily"
        private const val NOTI_ID = 7001
        private const val SOON_MS = 3L * 86_400_000L

        /** 일감 알림과 다른 채널 — 소리는 기본 알림음, 알람처럼 크게 울리지 않는다 */
        fun ensureChannel(ctx: Context) {
            val nm = ctx.getSystemService(NotificationManager::class.java) ?: return
            if (nm.getNotificationChannel(CHANNEL) != null) return
            val ch = NotificationChannel(CHANNEL, "행사 입찰 알림", NotificationManager.IMPORTANCE_DEFAULT).apply {
                description = "나라장터에 새로 뜬 행사 입찰과 마감 임박 공고를 하루 한 번 알려줍니다"
                setShowBadge(true)
            }
            nm.createNotificationChannel(ch)
        }

        /** 하루 한 번. 정확한 시각은 안드로이드가 정한다 (배터리 사정에 따라 몇 시간 오차) */
        fun schedule(ctx: Context) {
            val req = PeriodicWorkRequestBuilder<BidWorker>(24, TimeUnit.HOURS)
                .setConstraints(Constraints.Builder().setRequiredNetworkType(NetworkType.CONNECTED).build())
                .build()
            WorkManager.getInstance(ctx).enqueueUniquePeriodicWork(WORK, ExistingPeriodicWorkPolicy.KEEP, req)
        }

        fun cancel(ctx: Context) { WorkManager.getInstance(ctx).cancelUniqueWork(WORK) }

        /** 설정 화면의 「지금 확인해 보기」 */
        fun runNow(ctx: Context) {
            WorkManager.getInstance(ctx).enqueue(
                OneTimeWorkRequestBuilder<BidWorker>()
                    .setConstraints(Constraints.Builder().setRequiredNetworkType(NetworkType.CONNECTED).build())
                    .build())
        }
    }
}
