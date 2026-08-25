package com.brizymedia.keungilalert

import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.os.Build
import android.service.notification.NotificationListenerService
import android.service.notification.StatusBarNotification
import androidx.core.app.NotificationCompat

/**
 * 카톡 알림을 읽어 일감만 골라 다시 울려주는 부분.
 *
 * 안드로이드가 「알림 접근」 권한을 준 앱에만 다른 앱의 알림을 보여준다.
 * 사용자가 설정에서 직접 켜야 하고, 우리는 그 내용을 폰 밖으로 보내지 않는다.
 */
class AlertListenerService : NotificationListenerService() {

    private lateinit var store: Store
    private val recent = LinkedHashMap<String, Long>()   // 같은 글 두 번 울리지 않게

    override fun onCreate() {
        super.onCreate()
        store = Store(this)
        makeChannel()
    }

    override fun onNotificationPosted(sbn: StatusBarNotification) {
        if (sbn.packageName != KAKAO) return

        val extras = sbn.notification?.extras ?: return

        // 방 이름은 제목에, 내용은 본문에 온다. 긴 글은 BIG_TEXT 로 온다.
        val room = extras.getCharSequence(Notification.EXTRA_TITLE)?.toString().orEmpty()
        val body = (extras.getCharSequence(Notification.EXTRA_BIG_TEXT)
            ?: extras.getCharSequence(Notification.EXTRA_TEXT))?.toString().orEmpty()

        if (body.isBlank()) return
        if (isSystemLine(body)) return

        // 카톡은 같은 방 알림을 계속 새로 쏜다. 같은 글이면 넘긴다.
        val key = room + "" + body
        val now = System.currentTimeMillis()
        recent.entries.removeAll { now - it.value > DEDUPE_MS }
        if (recent.put(key, now) != null) return
        if (recent.size > 200) recent.remove(recent.keys.first())

        val verdict = Rules.judge(body, store.jobWords(), store.cities())
        if (!verdict.hit) return

        store.addHit(room, body)
        fire(sbn, room, body, verdict)
    }

    /** 카톡이 스스로 남기는 줄은 대화가 아니다 */
    private fun isSystemLine(text: String): Boolean {
        val t = text.trim()
        return t.endsWith("님이 들어왔습니다") || t.endsWith("님이 나갔습니다") ||
            t.contains("님을 초대했습니다") || t == "사진" || t == "동영상" ||
            t == "이모티콘" || t == "음성메시지" || t == "삭제된 메시지입니다."
    }

    private fun fire(sbn: StatusBarNotification, room: String, body: String, v: Rules.Verdict) {
        val nm = getSystemService(NotificationManager::class.java) ?: return

        val builder = NotificationCompat.Builder(this, CHANNEL)
            .setSmallIcon(android.R.drawable.ic_dialog_info)
            .setContentTitle("일감 — " + Rules.summary(v))
            .setContentText(body.take(80))
            .setStyle(NotificationCompat.BigTextStyle().bigText(body).setSummaryText(room))
            .setSubText(room)
            .setPriority(NotificationCompat.PRIORITY_HIGH)
            .setCategory(NotificationCompat.CATEGORY_MESSAGE)
            .setAutoCancel(true)
            .setOnlyAlertOnce(false)

        // 누르면 그 카톡방이 바로 열리게 — 카톡 알림이 가진 실행 정보를 그대로 쓴다.
        // 이 앱의 값어치가 여기 있다. 띵 → 누름 → 그 방 → 답장이 10초 안에 끝난다.
        sbn.notification?.contentIntent?.let { builder.setContentIntent(it) }

        nm.notify(body.hashCode(), builder.build())
    }

    private fun makeChannel() {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) return
        val nm = getSystemService(NotificationManager::class.java) ?: return
        if (nm.getNotificationChannel(CHANNEL) != null) return

        val ch = NotificationChannel(CHANNEL, "일감 알림", NotificationManager.IMPORTANCE_HIGH).apply {
            description = "카톡방에 올라온 구인 글 중 내 직군만 골라 알려줍니다"
            enableVibration(true)
            vibrationPattern = longArrayOf(0, 300, 150, 300)
            setShowBadge(true)
        }
        nm.createNotificationChannel(ch)
    }

    companion object {
        const val KAKAO = "com.kakao.talk"
        const val CHANNEL = "keungil-job"
        private const val DEDUPE_MS = 60_000L
    }
}
