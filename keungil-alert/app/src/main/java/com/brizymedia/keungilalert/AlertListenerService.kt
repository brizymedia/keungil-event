package com.brizymedia.keungilalert

import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.media.AudioAttributes
import android.media.RingtoneManager
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
            .setVisibility(NotificationCompat.VISIBILITY_PUBLIC)   // 잠금화면에서도 본문 보이게
            .setAutoCancel(true)
            .setOnlyAlertOnce(false)

        // 누르면 그 카톡방이 바로 열리게 — 카톡 알림이 가진 실행 정보를 그대로 쓴다.
        // 이 앱의 값어치가 여기 있다. 띵 → 누름 → 그 방 → 답장이 10초 안에 끝난다.
        sbn.notification?.contentIntent?.let { builder.setContentIntent(it) }

        nm.notify(body.hashCode(), builder.build())
    }

    /**
     * 알림 채널은 한 번 만들어지면 앱이 설정을 못 바꾼다 — 안드로이드가 막아뒀다.
     * 그래서 소리나 잠금화면 설정을 바꿀 때는 채널 이름(ID)을 새로 붙이고 옛 것을 지운다.
     * 그래야 이미 깔아 쓰던 폰에도 새 설정이 먹는다.
     */
    private fun makeChannel() {
        val nm = getSystemService(NotificationManager::class.java) ?: return
        nm.deleteNotificationChannel(OLD_CHANNEL)
        if (nm.getNotificationChannel(CHANNEL) != null) return

        // 알람 소리로 울린다. 알람은 소리 크기도 알림음과 따로 놀아서,
        // 알림 볼륨을 줄여둔 폰에서도 제대로 들린다.
        val sound = RingtoneManager.getDefaultUri(RingtoneManager.TYPE_ALARM)
            ?: RingtoneManager.getDefaultUri(RingtoneManager.TYPE_NOTIFICATION)
        val attrs = AudioAttributes.Builder()
            .setUsage(AudioAttributes.USAGE_ALARM)
            .setContentType(AudioAttributes.CONTENT_TYPE_SONIFICATION)
            .build()

        val ch = NotificationChannel(CHANNEL, "일감 알림", NotificationManager.IMPORTANCE_HIGH).apply {
            description = "카톡방에 올라온 구인 글 중 내 직군만 골라 알려줍니다"
            enableVibration(true)
            vibrationPattern = longArrayOf(0, 300, 150, 300)
            setShowBadge(true)
            setSound(sound, attrs)
            // 잠금화면에서도 본문이 보이게 — 폰을 안 열고 판단할 수 있어야 빠르다
            lockscreenVisibility = Notification.VISIBILITY_PUBLIC
        }
        nm.createNotificationChannel(ch)
    }

    companion object {
        const val KAKAO = "com.kakao.talk"
        const val CHANNEL = "keungil-job-v2"
        /** 소리·잠금화면 설정을 바꾸기 전에 쓰던 채널 */
        private const val OLD_CHANNEL = "keungil-job"
        private const val DEDUPE_MS = 60_000L
    }
}
