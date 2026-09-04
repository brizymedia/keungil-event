package com.brizymedia.keungilalert

import android.Manifest
import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.content.pm.PackageManager
import android.database.Cursor
import android.net.Uri
import android.os.Build
import android.os.Handler
import android.os.Looper
import android.provider.CallLog
import android.provider.ContactsContract
import android.telephony.SmsManager
import android.telephony.TelephonyManager
import androidx.core.content.ContextCompat

/**
 * 전화가 끝나면 내 전자명함 링크를 문자로 보낸다.
 *
 * 통화 상태만으로는 상대 번호를 알 수 없다(안드로이드 9 부터 막혔다).
 * 그래서 통화가 끝난 뒤 통화기록의 맨 윗줄을 읽어 번호를 얻는다.
 * 기록이 쓰이기까지 잠깐 걸리므로 조금 기다렸다 읽는다.
 *
 * 문자는 통신사 요금이 붙고, 잘못 보내면 되돌릴 수 없다. 그래서 여러 겹으로 막는다.
 *   ① 기능을 켰는가 · 명함 주소가 있는가
 *   ② 걸려온 전화인가 (내가 건 전화 제외 — 켜져 있을 때)
 *   ③ 주소록에 있는 사람인가 (아는 사이엔 안 보냄 — 켜져 있을 때)
 *   ④ 최근 30일 안에 이미 보낸 번호인가
 *   ⑤ 오늘 보낸 건수가 한도를 넘었는가
 *   ⑥ 「보내기 전에 물어보기」가 켜져 있으면 알림으로 확인받는다
 */
class CallWatcher : BroadcastReceiver() {

    override fun onReceive(context: Context, intent: Intent) {
        when (intent.action) {
            TelephonyManager.ACTION_PHONE_STATE_CHANGED -> {
                val state = intent.getStringExtra(TelephonyManager.EXTRA_STATE)
                if (state == TelephonyManager.EXTRA_STATE_IDLE) {
                    /* 통화기록이 쓰일 때까지 잠깐 기다려야 하는데, onReceive 가 끝나면
                       안드로이드가 이 프로세스를 언제든 죽일 수 있다.
                       goAsync() 로 「아직 일하는 중」이라고 붙잡아 둔다. */
                    val 붙잡기 = goAsync()
                    Handler(Looper.getMainLooper()).postDelayed({
                        try { 통화끝(context) } catch (e: Exception) {} finally { 붙잡기.finish() }
                    }, WAIT_MS)
                }
            }
            ACTION_SEND -> {
                val number = intent.getStringExtra(EXTRA_NUMBER).orEmpty()
                nm(context)?.cancel(ASK_ID)
                if (number.isNotBlank()) 보내기(context, number)
            }
            ACTION_SKIP -> nm(context)?.cancel(ASK_ID)
        }
    }

    private fun 통화끝(context: Context) {
        val store = Store(context)
        if (!store.callbackOn) return
        if (store.cbMessage().isBlank()) return                      // 명함 주소가 없다
        if (!has(context, Manifest.permission.SEND_SMS)) return
        if (!has(context, Manifest.permission.READ_CALL_LOG)) return

        val 마지막 = 마지막통화(context) ?: return
        val (number, 걸려온것) = 마지막
        if (number.isBlank()) return                                  // 발신번호 표시제한
        if (store.cbIncomingOnly && !걸려온것) return
        if (store.sentRecently(number)) return
        if (store.sentToday() >= store.cbDailyCap) return
        if (store.cbSkipKnown && 주소록에있나(context, number)) return

        if (store.cbAsk) 물어보기(context, number) else 보내기(context, number)
    }

    /** 통화기록 맨 윗줄 → (번호, 걸려온 전화인가) */
    private fun 마지막통화(context: Context): Pair<String, Boolean>? {
        var c: Cursor? = null
        return try {
            c = context.contentResolver.query(
                CallLog.Calls.CONTENT_URI,
                arrayOf(CallLog.Calls.NUMBER, CallLog.Calls.TYPE, CallLog.Calls.DATE, CallLog.Calls.DURATION),
                null, null, CallLog.Calls.DATE + " DESC"
            )
            if (c == null || !c.moveToFirst()) return null

            val 언제 = c.getLong(c.getColumnIndexOrThrow(CallLog.Calls.DATE))
            if (System.currentTimeMillis() - 언제 > 5 * 60_000L) return null   // 방금 통화가 아니다

            val 길이 = c.getLong(c.getColumnIndexOrThrow(CallLog.Calls.DURATION))
            if (길이 <= 0L) return null                                        // 안 받은 전화는 제외

            val 종류 = c.getInt(c.getColumnIndexOrThrow(CallLog.Calls.TYPE))
            val 번호 = c.getString(c.getColumnIndexOrThrow(CallLog.Calls.NUMBER)).orEmpty()
            Pair(정리(번호), 종류 == CallLog.Calls.INCOMING_TYPE)
        } catch (e: Exception) {
            null
        } finally {
            try { c?.close() } catch (e: Exception) {}
        }
    }

    private fun 주소록에있나(context: Context, number: String): Boolean {
        if (!has(context, Manifest.permission.READ_CONTACTS)) return false
        var c: Cursor? = null
        return try {
            val uri = Uri.withAppendedPath(
                ContactsContract.PhoneLookup.CONTENT_FILTER_URI, Uri.encode(number))
            c = context.contentResolver.query(uri, arrayOf(ContactsContract.PhoneLookup._ID), null, null, null)
            c != null && c.count > 0
        } catch (e: Exception) {
            false
        } finally {
            try { c?.close() } catch (e: Exception) {}
        }
    }

    private fun 보내기(context: Context, number: String) {
        val store = Store(context)
        val 글 = store.cbMessage()
        if (글.isBlank()) return
        try {
            val sms = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S)
                context.getSystemService(SmsManager::class.java)
            else
                @Suppress("DEPRECATION") SmsManager.getDefault()

            // 길면 통신사가 여러 통으로 쪼갠다. 쪼개도 순서가 맞게 보낸다.
            val 조각 = sms.divideMessage(글)
            if (조각.size > 1) sms.sendMultipartTextMessage(number, null, 조각, null, null)
            else sms.sendTextMessage(number, null, 글, null, null)

            store.markSent(number)
            store.countSend()
            알림(context, SENT_ID, "명함을 보냈습니다", number + " · 오늘 " + store.sentToday() + "건")
        } catch (e: Exception) {
            알림(context, SENT_ID, "문자를 보내지 못했습니다", (e.message ?: "알 수 없는 이유"))
        }
    }

    /** 「보내기 전에 물어보기」가 켜져 있을 때 — 누르면 그때 나간다 */
    private fun 물어보기(context: Context, number: String) {
        ensureChannel(context)
        val 보내 = PendingIntent.getBroadcast(context, number.hashCode(),
            Intent(context, CallWatcher::class.java).setAction(ACTION_SEND).putExtra(EXTRA_NUMBER, number),
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE)
        val 말아 = PendingIntent.getBroadcast(context, number.hashCode() + 1,
            Intent(context, CallWatcher::class.java).setAction(ACTION_SKIP),
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE)

        val n = Notification.Builder(context, CH_ID)
            .setSmallIcon(android.R.drawable.ic_dialog_email)
            .setContentTitle("명함을 보낼까요?")
            .setContentText(number)
            .setStyle(Notification.BigTextStyle().bigText(number + "\n\n" + Store(context).cbMessage()))
            .setAutoCancel(true)
            // null 을 그냥 넘기면 옛 생성자와 헷갈린다. 아이콘 자리임을 밝혀 준다.
            .addAction(Notification.Action.Builder(없는아이콘, "보내기", 보내).build())
            .addAction(Notification.Action.Builder(없는아이콘, "안 보냄", 말아).build())
            .build()
        nm(context)?.notify(ASK_ID, n)
    }

    private fun 알림(context: Context, id: Int, title: String, body: String) {
        ensureChannel(context)
        val n = Notification.Builder(context, CH_ID)
            .setSmallIcon(android.R.drawable.ic_dialog_email)
            .setContentTitle(title)
            .setContentText(body)
            .setAutoCancel(true)
            .build()
        nm(context)?.notify(id, n)
    }

    private fun nm(context: Context) = context.getSystemService(NotificationManager::class.java)

    private fun has(context: Context, p: String) =
        ContextCompat.checkSelfPermission(context, p) == PackageManager.PERMISSION_GRANTED

    /** 하이픈·괄호·공백을 뗀다. 통화기록과 주소록의 표기가 다를 수 있다. */
    private fun 정리(s: String) = s.filter { it.isDigit() || it == '+' }

    companion object {
        const val CH_ID = "keungil-callback"
        const val ACTION_SEND = "com.brizymedia.keungilalert.CB_SEND"
        const val ACTION_SKIP = "com.brizymedia.keungilalert.CB_SKIP"
        const val EXTRA_NUMBER = "number"
        private const val ASK_ID = 9101
        private const val SENT_ID = 9102
        private const val WAIT_MS = 2500L    // 통화기록이 쓰일 때까지
        private val 없는아이콘: android.graphics.drawable.Icon? = null

        fun ensureChannel(context: Context) {
            val nm = context.getSystemService(NotificationManager::class.java) ?: return
            if (nm.getNotificationChannel(CH_ID) != null) return
            nm.createNotificationChannel(NotificationChannel(
                CH_ID, "콜백 문자", NotificationManager.IMPORTANCE_DEFAULT
            ).apply { description = "통화 후 명함 문자를 보낼 때 알려줍니다" })
        }
    }
}
