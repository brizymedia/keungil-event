package com.brizymedia.keungilalert

import android.Manifest
import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.app.role.RoleManager
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
 * 두 판이 있다 (build.gradle.kts 의 productFlavors).
 *   직접 설치판(direct)  통화기록을 읽어 상대 번호를 알고(READ_CALL_LOG), 문자를 앱이 직접 보낸다(SEND_SMS). 지금까지의 방식.
 *   스토어판(play)       구글이 그 두 권한을 기본 문자·전화앱에만 허락한다. 그래서
 *                         · 번호는 「전화 확인(스팸 차단) 앱」 역할(CallScreen)로 받고
 *                         · 문자는 문자앱을 번호 · 글이 채워진 채 열어 주어, 사용자가 「전송」을 한 번 누른다.
 * 코드는 「권한이 있느냐」로 갈린다 — 권한을 선언하지 않은 판에서는 checkSelfPermission 이 항상 「없음」이다.
 *
 * 통화 상태만으로는 상대 번호를 알 수 없다(안드로이드 9 부터 막혔다).
 * 직접 설치판은 통화가 끝난 뒤 통화기록의 맨 윗줄을 읽는다. 기록이 쓰이기까지 잠깐 걸리므로 조금 기다렸다 읽는다.
 * 스토어판은 CallScreen 이 전화가 올 때 · 걸 때 기억해 둔 번호를 쓴다.
 *
 * 문자는 통신사 요금이 붙고, 잘못 보내면 되돌릴 수 없다. 그래서 여러 겹으로 막는다.
 *   ① 기능을 켰는가 · 명함 주소가 있는가
 *   ② 걸려온 전화인가 (내가 건 전화 제외 — 켜져 있을 때)
 *   ③ 주소록에 있는 사람인가 (「모르는 번호에만」이 켜져 있을 때. 끄면 연락처 권한을 받아 주소록 번호에도 묻는다)
 *   ④ 최근 30일 안에 이미 보낸 번호인가 (「보낸 번호도 다시 묻기」를 켜면 물어보는 방식에서는 다시 묻는다)
 *   ⑤ 오늘 보낸 건수가 한도를 넘었는가
 *   ⑥ 「보내기 전에 물어보기」가 켜져 있으면(스토어판은 항상) 창 · 알림으로 확인받는다
 */
class CallWatcher : BroadcastReceiver() {

    override fun onReceive(context: Context, intent: Intent) {
        when (intent.action) {
            TelephonyManager.ACTION_PHONE_STATE_CHANGED -> {
                val state = intent.getStringExtra(TelephonyManager.EXTRA_STATE)
                val store = Store(context)
                when (state) {
                    // 울림 → 통화 → 끊김 순서를 기억해 둔다. 스토어판은 이것으로 「받은 전화인가」를 가린다.
                    TelephonyManager.EXTRA_STATE_RINGING -> { store.callRinging = true; store.callOffhook = false }
                    TelephonyManager.EXTRA_STATE_OFFHOOK -> { store.callOffhook = true }
                    TelephonyManager.EXTRA_STATE_IDLE -> {
                        /* 통화기록이 쓰일 때까지 잠깐 기다려야 하는데, onReceive 가 끝나면
                           안드로이드가 이 프로세스를 언제든 죽일 수 있다.
                           goAsync() 로 「아직 일하는 중」이라고 붙잡아 둔다. */
                        val 붙잡기 = goAsync()
                        Handler(Looper.getMainLooper()).postDelayed({
                            try { 통화끝(context) } catch (e: Exception) {} finally {
                                store.callRinging = false; store.callOffhook = false
                                붙잡기.finish()
                            }
                        }, WAIT_MS)
                    }
                }
            }
            ACTION_SKIP -> nm(context)?.cancel(ASK_ID)
        }
    }

    private fun 통화끝(context: Context) {
        val store = Store(context)
        if (!store.callbackOn) return
        if (store.cbMessage().isBlank()) return                      // 명함 주소가 없다

        val 직접 = 직접판(context)
        if (!직접 && !확인앱역할(context)) return                     // 스토어판인데 전화 확인 앱이 아니다 — 번호를 모른다

        val 마지막 = (if (직접) 마지막통화_기록(context) else 마지막통화_확인앱(store)) ?: return
        val (number, 걸려온것) = 마지막
        if (number.isBlank()) return                                  // 발신번호 표시제한
        if (store.cbIncomingOnly && !걸려온것) return
        // 스토어판은 문자앱을 열어야 하므로 반드시 물어본다 (뒤에서 몰래 열 수도 없고, 열어서도 안 된다)
        val 물어봄 = store.cbAsk || !직접
        // 30일 안에 보낸 번호는 건너뛴다 — 「보낸 번호도 다시 묻기」를 켰고 물어보는 방식이면 다시 묻는다(자동 발송은 절대 다시 안 보낸다)
        if (store.sentRecently(number) && !(물어봄 && store.cbReask)) return
        if (store.sentToday() >= store.cbDailyCap) return
        if (store.cbSkipKnown && 주소록에있나(context, number)) return

        if (물어봄) 물어보기(context, number) else 보내기(context, number)
    }

    /** 직접 설치판 — 문자 보내기와 통화기록 권한이 둘 다 있는 판 */
    private fun 직접판(context: Context) =
        has(context, Manifest.permission.SEND_SMS) && has(context, Manifest.permission.READ_CALL_LOG)

    /** 직접 설치판: 통화기록 맨 윗줄 → (번호, 걸려온 전화인가) */
    private fun 마지막통화_기록(context: Context): Pair<String, Boolean>? {
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

    /** 스토어판: CallScreen 이 기억해 둔 마지막 전화 → (번호, 걸려온 전화인가). 연결된 적이 없으면(안 받음) 없음 */
    private fun 마지막통화_확인앱(store: Store): Pair<String, Boolean>? {
        val c = store.lastCall() ?: return null
        store.clearLastCall()                                          // 한 통화에 한 번만
        if (System.currentTimeMillis() - c.at > 5 * 60_000L) return null   // 방금 통화가 아니다
        if (!store.callOffhook) return null                            // 울리기만 하고 끊겼다 — 안 받은 전화
        val 번호 = 정리(c.number)
        return if (번호.isBlank()) null else Pair(번호, c.incoming)
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

    /**
     * 「보내기 전에 물어보기」 — 누르면 그때 나간다.
     * 알림으로만 물으면 위에서 잠깐 스쳐 지나가 놓친다.
     * 「다른 앱 위에 표시」 권한이 있으면 화면 한가운데에 창(AskActivity)을 띄운다.
     * 없으면 알림으로 되돌아간다 — 못 물어보는 것보다는 낫다.
     */
    private fun 물어보기(context: Context, number: String) {
        if (화면위에띄울수있나(context)) {
            try {
                context.startActivity(
                    Intent(context, AskActivity::class.java)
                        .putExtra(EXTRA_NUMBER, number)
                        .addFlags(Intent.FLAG_ACTIVITY_NEW_TASK or
                                  Intent.FLAG_ACTIVITY_CLEAR_TOP or
                                  Intent.FLAG_ACTIVITY_NO_USER_ACTION))
                return
            } catch (e: Exception) { /* 못 띄우면 아래 알림으로 */ }
        }
        알림으로묻기(context, number)
    }

    private fun 화면위에띄울수있나(context: Context) =
        Build.VERSION.SDK_INT < Build.VERSION_CODES.M || android.provider.Settings.canDrawOverlays(context)

    private fun 알림으로묻기(context: Context, number: String) {
        ensureChannel(context)
        // 「보내기」는 창(AskActivity)을 거쳐 보낸다 — 알림에서 바로 문자앱을 열려면 화면에 있는 활동이 필요하다(안드로이드 10+)
        val 보내 = PendingIntent.getActivity(context, number.hashCode(),
            Intent(context, AskActivity::class.java).putExtra(EXTRA_NUMBER, number).putExtra(EXTRA_AUTO, true)
                .addFlags(Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TOP),
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE)
        val 말아 = PendingIntent.getBroadcast(context, number.hashCode() + 1,
            Intent(context, CallWatcher::class.java).setAction(ACTION_SKIP),
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE)

        // 눌렀을 때도 창이 뜨게 — 알림을 놓쳐도 나중에 열 수 있다
        val 열기 = PendingIntent.getActivity(context, number.hashCode() + 2,
            Intent(context, AskActivity::class.java).putExtra(EXTRA_NUMBER, number)
                .addFlags(Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TOP),
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE)

        val 전 = Store(context).sentDaysAgo(number)
        val 번호줄 = number + (if (전 < 0) "" else if (전 == 0) " · 오늘 이미 보낸 번호" else " · " + 전 + "일 전에 보낸 번호")
        val b = Notification.Builder(context, CH_ID)
            .setSmallIcon(android.R.drawable.ic_dialog_email)
            .setContentTitle("명함을 보낼까요?")
            .setContentText(번호줄)
            .setStyle(Notification.BigTextStyle().bigText(번호줄 + "\n\n" + Store(context).cbMessage()))
            .setAutoCancel(true)
            .setContentIntent(열기)
            .setCategory(Notification.CATEGORY_REMINDER)
            // null 을 그냥 넘기면 옛 생성자와 헷갈린다. 아이콘 자리임을 밝혀 준다.
            .addAction(Notification.Action.Builder(없는아이콘, "보내기", 보내).build())
            .addAction(Notification.Action.Builder(없는아이콘, "안 보냄", 말아).build())
        // 화면을 덮어 보려는 시도. 직접 설치판만 — 스토어판은 그 권한(전체 화면 알림)을 선언하지 않는다. 막히면 그냥 배너로 뜬다.
        if (!BuildConfig.PLAY) b.setFullScreenIntent(열기, true)
        nm(context)?.notify(ASK_ID, b.build())
    }

    private fun nm(context: Context) = context.getSystemService(NotificationManager::class.java)

    /** 하이픈·괄호·공백을 뗀다. 통화기록과 주소록의 표기가 다를 수 있다. */
    private fun 정리(s: String) = s.filter { it.isDigit() || it == '+' }

    companion object {
        const val CH_ID = "keungil-callback-v2"      // v1 은 중요도가 낮아 배너로만 스쳤다
        const val ACTION_SKIP = "com.brizymedia.keungilalert.CB_SKIP"
        const val EXTRA_NUMBER = "number"
        const val EXTRA_AUTO = "auto"                // 창을 거치지 않고 바로 보내기 (알림의 「보내기」)
        private const val ASK_ID = 9101
        private const val SENT_ID = 9102
        private const val WAIT_MS = 2500L    // 통화기록이 쓰일 때까지
        private val 없는아이콘: android.graphics.drawable.Icon? = null

        fun has(context: Context, p: String) =
            ContextCompat.checkSelfPermission(context, p) == PackageManager.PERMISSION_GRANTED

        /** 스토어판 — 이 앱이 「전화 확인(스팸 차단) 앱」으로 지정되어 있는가 (안드로이드 10 이상) */
        fun 확인앱역할(context: Context): Boolean {
            if (Build.VERSION.SDK_INT < Build.VERSION_CODES.Q) return false
            return try {
                context.getSystemService(RoleManager::class.java)?.isRoleHeld(RoleManager.ROLE_CALL_SCREENING) == true
            } catch (e: Exception) { false }
        }

        /**
         * 실제로 보내는 곳. AskActivity 의 「보내기」와 알림의 「보내기」가 여기로 온다.
         *   문자 보내기 권한이 있으면(직접 설치판) 앱이 바로 보낸다.
         *   없으면(스토어판) 문자앱을 번호 · 글이 채워진 채 연다. 「전송」은 사용자가 누른다 — 구글 정책이 허락하는 방식.
         */
        fun 보내기(context: Context, number: String) {
            val store = Store(context)
            val 글 = store.cbMessage()
            if (글.isBlank() || number.isBlank()) return
            context.getSystemService(NotificationManager::class.java)?.cancel(ASK_ID)

            if (has(context, Manifest.permission.SEND_SMS)) {
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
                return
            }

            try {
                val i = Intent(Intent.ACTION_SENDTO, Uri.parse("smsto:" + Uri.encode(number)))
                    .putExtra("sms_body", 글)
                    .addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
                context.startActivity(i)
                store.markSent(number)          // 문자앱을 열어 준 번호는 30일 안에 다시 묻지 않는다
                store.countSend()
                알림(context, SENT_ID, "문자앱을 열었습니다", number + " · 「전송」만 누르면 명함이 갑니다")
            } catch (e: Exception) {
                알림(context, SENT_ID, "문자앱을 열지 못했습니다", (e.message ?: "알 수 없는 이유"))
            }
        }

        private fun 알림(context: Context, id: Int, title: String, body: String) {
            ensureChannel(context)
            val n = Notification.Builder(context, CH_ID)
                .setSmallIcon(android.R.drawable.ic_dialog_email)
                .setContentTitle(title)
                .setContentText(body)
                .setAutoCancel(true)
                .build()
            context.getSystemService(NotificationManager::class.java)?.notify(id, n)
        }

        fun ensureChannel(context: Context) {
            val nm = context.getSystemService(NotificationManager::class.java) ?: return
            // 채널은 한 번 만들면 앱이 중요도를 못 바꾼다. 올리려면 ID 를 새로 붙이고 옛 것을 지운다.
            nm.deleteNotificationChannel("keungil-callback")
            if (nm.getNotificationChannel(CH_ID) != null) return
            nm.createNotificationChannel(NotificationChannel(
                CH_ID, "콜백 문자", NotificationManager.IMPORTANCE_HIGH
            ).apply {
                description = "통화 후 명함 문자를 보낼 때 물어봅니다"
                lockscreenVisibility = Notification.VISIBILITY_PUBLIC
            })
        }
    }
}
