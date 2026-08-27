package com.brizymedia.keungilalert

import android.app.NotificationManager
import android.content.Context
import android.content.Intent
import android.content.pm.PackageManager
import android.graphics.Color
import android.net.Uri
import android.os.Build
import android.os.Bundle
import android.provider.Settings
import android.text.format.DateUtils
import android.util.TypedValue
import android.view.Gravity
import android.view.View
import android.widget.Button
import android.widget.GridLayout
import android.widget.LinearLayout
import android.widget.TextView
import androidx.appcompat.app.AppCompatActivity
import androidx.core.content.ContextCompat

/**
 * 설정 화면 하나로 끝낸다 — 직군 고르기, 지역 고르기, 권한 확인, 최근 걸린 목록.
 * 화면을 XML 로 짜지 않고 코드로 만든다. 버튼 개수가 자료에서 나오기 때문이다.
 */
class MainActivity : AppCompatActivity() {

    private lateinit var store: Store
    private lateinit var root: LinearLayout
    private lateinit var statusText: TextView
    private lateinit var statusBtn: Button
    private lateinit var notifyBtn: Button
    private lateinit var hitBox: LinearLayout
    private lateinit var countText: TextView

    private val ink = Color.parseColor("#F6F1E7")
    private val ink2 = Color.parseColor("#B8AF9E")
    private val ink3 = Color.parseColor("#8A8171")
    private val bg = Color.parseColor("#12100C")
    private val surface = Color.parseColor("#1C1913")
    private val amber = Color.parseColor("#F5A524")
    private val good = Color.parseColor("#5BC98D")
    private val bad = Color.parseColor("#F08A72")

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        store = Store(this)

        val scroll = android.widget.ScrollView(this).apply { setBackgroundColor(bg) }
        root = LinearLayout(this).apply {
            orientation = LinearLayout.VERTICAL
            setPadding(dp(18), dp(22), dp(18), dp(40))
        }
        scroll.addView(root)
        setContentView(scroll)

        // 서비스가 아직 안 켜졌어도 채널이 있어야 설정 화면이 제대로 열린다
        AlertListenerService.ensureChannel(this)

        header()
        statusCard()
        jobSection()
        regionSection()
        hitSection()

        askNotificationPermission()
    }

    /**
     * 안드로이드 13부터는 앱이 알림을 띄우는 데도 허락이 필요하다.
     * 이걸 안 받으면 카톡 알림은 잘 읽으면서 정작 우리 알림만 안 뜬다.
     */
    private fun askNotificationPermission() {
        if (Build.VERSION.SDK_INT < 33) return
        val granted = ContextCompat.checkSelfPermission(this, "android.permission.POST_NOTIFICATIONS") ==
            PackageManager.PERMISSION_GRANTED
        if (!granted) requestPermissions(arrayOf("android.permission.POST_NOTIFICATIONS"), 100)
    }

    override fun onRequestPermissionsResult(code: Int, perms: Array<out String>, results: IntArray) {
        super.onRequestPermissionsResult(code, perms, results)
        refreshStatus()
    }

    override fun onResume() {
        super.onResume()
        refreshStatus()
        refreshHits()
    }

    // ── 화면 조각 ──────────────────────────────────

    private fun header() {
        root.addView(text("큰길행사알림", 24f, ink, bold = true))
        root.addView(text(
            "카톡방에 올라오는 구인 글 중 내 직군만 골라 알려드립니다. " +
                "알림을 누르면 그 카톡방이 바로 열립니다.",
            14f, ink2, top = 6
        ))
        root.addView(text(
            "카톡 내용은 이 폰 안에서만 확인하고 어디로도 보내지 않습니다.",
            12f, ink3, top = 8
        ))
    }

    private fun statusCard() {
        val card = card()
        statusText = text("확인 중…", 15f, ink, bold = true)
        card.addView(statusText)

        statusBtn = Button(this).apply {
            text = "알림 접근 권한 켜기"
            setOnClickListener { openListenerSettings() }
        }
        card.addView(statusBtn)

        val battery = Button(this).apply {
            text = "배터리 최적화에서 빼기"
            setOnClickListener { openBatterySettings() }
        }
        card.addView(battery)

        card.addView(text(
            "이 둘을 안 하면 며칠 뒤 조용히 멈춥니다. 안드로이드가 백그라운드 앱을 정리하기 때문입니다.",
            12f, ink3, top = 8
        ))

        notifyBtn = Button(this).apply {
            text = "알림 띄우기 켜기"
            setOnClickListener { openChannelSettings() }
        }
        card.addView(notifyBtn)
        card.addView(text(
            "일감이 걸리면 알람 소리로 울리고 잠금화면에도 내용이 보입니다. " +
                "소리가 부담스러우면 위에서 바꾸세요.",
            12f, ink3, top = 8
        ))

        card.addView(Button(this).apply {
            text = "시험 알림 보내기"
            setOnClickListener { testNotify() }
        })
        card.addView(text(
            "눌러서 알림이 뜨면 띄우기 쪽은 정상입니다. 안 뜨면 위 ②를 켜주세요.",
            12f, ink3, top = 6
        ))
        root.addView(card)
    }

    private fun jobSection() {
        root.addView(sectionTitle("내 직군"))
        root.addView(text("여러 개 고를 수 있습니다. 길게 누르면 그 직군의 단어가 보입니다.", 13f, ink2, top = 2))

        val card = card()
        var lastGroup = ""
        var grid: GridLayout? = null

        Rules.JOBS.forEach { job ->
            if (job.group != lastGroup) {
                lastGroup = job.group
                card.addView(text(job.group, 11f, ink3, bold = true, top = 12))
                grid = GridLayout(this).apply { columnCount = 2 }
                card.addView(grid)
            }
            val btn = toggle(job.label, job.id in store.jobIds) { on ->
                store.jobIds = store.jobIds.toMutableSet().apply { if (on) add(job.id) else remove(job.id) }
                refreshCount()
            }
            btn.setOnLongClickListener { 단어보기(job); true }
            grid?.addView(btn)
        }

        countText = text("", 12f, ink3, top = 12).apply { gravity = Gravity.CENTER }
        card.addView(countText)
        root.addView(card)
        refreshCount()
    }

    /** 직군을 길게 누르면 그 안에 무슨 단어가 들어있는지 보여준다.
     *  「우리 장비 이름이 없네」 를 사장님이 직접 확인할 수 있어야 한다. */
    private fun 단어보기(job: Rules.Job) {
        androidx.appcompat.app.AlertDialog.Builder(this)
            .setTitle(job.label + " — 단어 " + job.words.size + "개")
            .setMessage(
                job.words.joinToString("   ") +
                    "\n\n이 중 하나라도 글에 있고 구인 신호어(구합니다 · 섭외 · 가능하신…)가 " +
                    "함께 있어야 울립니다.\n\n빠진 단어가 있으면 알려주세요."
            )
            .setPositiveButton("닫기", null)
            .show()
    }

    private fun regionSection() {
        root.addView(sectionTitle("다니는 지역"))
        root.addView(text(
            "안 고르면 전국이 다 울립니다. 너무 자주 울리면 그때 좁히세요.",
            13f, ink2, top = 2
        ))

        val card = card()
        val grid = GridLayout(this).apply { columnCount = 2 }
        Rules.REGIONS.forEach { r ->
            grid.addView(toggle(r.label, r.id in store.regionIds) { on ->
                store.regionIds = store.regionIds.toMutableSet().apply { if (on) add(r.id) else remove(r.id) }
                refreshCount()
            })
        }
        card.addView(grid)
        card.addView(text(
            "지역을 안 쓴 구인 글도 있어서, 좁히면 몇 건은 놓칩니다.",
            12f, ink3, top = 10
        ))
        root.addView(card)
    }

    private fun hitSection() {
        root.addView(sectionTitle("최근 울린 것"))
        val card = card()
        hitBox = LinearLayout(this).apply { orientation = LinearLayout.VERTICAL }
        card.addView(hitBox)
        card.addView(Button(this).apply {
            text = "목록 비우기"
            setOnClickListener { store.clearHits(); refreshHits() }
        })
        root.addView(card)
    }

    // ── 갱신 ───────────────────────────────────────

    /**
     * 막히는 곳이 둘이라 따로 보여준다.
     *   읽기 — 알림 접근 권한. 없으면 카톡 알림을 아예 못 본다.
     *   띄우기 — 알림 표시 허용 + 채널이 꺼졌는지. 없으면 읽어도 못 울린다.
     */
    private fun refreshStatus() {
        val 읽기 = isListenerEnabled()
        val 띄우기 = canPostNotifications()
        val 채널 = channelOn()

        val 줄 = StringBuilder()
        줄.append(if (읽기) "● 카톡 알림 읽기 — 켜짐\n" else "● 카톡 알림 읽기 — 꺼짐\n")
        줄.append(if (띄우기) "● 알림 띄우기 — 켜짐\n" else "● 알림 띄우기 — 꺼짐\n")
        줄.append(if (채널) "● 일감 알림 채널 — 켜짐" else "● 일감 알림 채널 — 차단됨")

        val 다됨 = 읽기 && 띄우기 && 채널
        statusText.text = 줄.toString()
        statusText.setTextColor(if (다됨) good else bad)

        statusBtn.text = if (읽기) "알림 접근 설정 열기" else "① 카톡 알림 읽기 켜기"
        notifyBtn.text = if (띄우기 && 채널) "알림 소리 바꾸기" else "② 알림 띄우기 켜기"
    }

    private fun canPostNotifications(): Boolean {
        if (Build.VERSION.SDK_INT < 33) {
            val nm = getSystemService(NotificationManager::class.java)
            return nm?.areNotificationsEnabled() ?: true
        }
        return ContextCompat.checkSelfPermission(this, "android.permission.POST_NOTIFICATIONS") ==
            PackageManager.PERMISSION_GRANTED
    }

    private fun channelOn(): Boolean {
        val nm = getSystemService(NotificationManager::class.java) ?: return true
        if (!nm.areNotificationsEnabled()) return false
        val ch = nm.getNotificationChannel(AlertListenerService.CHANNEL) ?: return true
        return ch.importance != NotificationManager.IMPORTANCE_NONE
    }

    private fun refreshCount() {
        val jobs = store.jobIds.size
        val words = store.jobWords().size
        val regions = store.regionIds.size
        countText.text = if (jobs == 0) "직군을 하나 이상 골라주세요"
        else "직군 ${jobs}개 · 단어 ${words}개 · " + if (regions == 0) "전국" else "${regions}개 권역"
    }

    private fun refreshHits() {
        hitBox.removeAllViews()
        val hits = store.hits()
        if (hits.isEmpty()) {
            hitBox.addView(text("아직 없습니다.", 13f, ink3, top = 6))
            return
        }
        hits.take(30).forEach { h ->
            val row = LinearLayout(this).apply {
                orientation = LinearLayout.VERTICAL
                setPadding(0, dp(8), 0, dp(8))
            }
            val ago = DateUtils.getRelativeTimeSpanString(h.at, System.currentTimeMillis(), 0)
            row.addView(text("$ago · ${h.room}", 11f, ink3))
            row.addView(text(h.text, 13f, ink2, top = 2))
            hitBox.addView(row)
        }
    }

    /** 카톡과 상관없이 알림이 뜨는지만 확인한다. 어디서 막혔는지 가리는 데 쓴다. */
    private fun testNotify() {
        AlertListenerService.ensureChannel(this)
        val nm = getSystemService(NotificationManager::class.java) ?: return
        val n = androidx.core.app.NotificationCompat.Builder(this, AlertListenerService.CHANNEL)
            .setSmallIcon(android.R.drawable.ic_dialog_info)
            .setContentTitle("일감 — 순천 · 음향")
            .setContentText("10월 21일 순천 축제 음향 오퍼레이터 급구합니다 (시험)")
            .setStyle(androidx.core.app.NotificationCompat.BigTextStyle()
                .bigText("10월 21일 순천 축제 음향 오퍼레이터 급구합니다 — 이건 시험 알림입니다. 이게 보이면 알림 띄우기는 정상입니다."))
            .setPriority(androidx.core.app.NotificationCompat.PRIORITY_HIGH)
            .setVisibility(androidx.core.app.NotificationCompat.VISIBILITY_PUBLIC)
            .setAutoCancel(true)
            .build()
        nm.notify(999, n)
        refreshStatus()
    }

    // ── 설정 화면으로 보내기 ────────────────────────

    private fun isListenerEnabled(): Boolean {
        val flat = Settings.Secure.getString(contentResolver, "enabled_notification_listeners") ?: return false
        return flat.contains(packageName)
    }

    private fun openListenerSettings() {
        val action = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.LOLLIPOP)
            Settings.ACTION_NOTIFICATION_LISTENER_SETTINGS else "android.settings.ACTION_NOTIFICATION_LISTENER_SETTINGS"
        try {
            startActivity(Intent(action))
        } catch (e: Exception) {
            startActivity(Intent(Settings.ACTION_SETTINGS))
        }
    }

    /** 알림 소리·진동은 안드로이드 설정에서만 바꿀 수 있다. 그 화면으로 바로 보내준다. */
    private fun openChannelSettings() {
        try {
            val i = Intent(Settings.ACTION_CHANNEL_NOTIFICATION_SETTINGS)
                .putExtra(Settings.EXTRA_APP_PACKAGE, packageName)
                .putExtra(Settings.EXTRA_CHANNEL_ID, AlertListenerService.CHANNEL)
            startActivity(i)
        } catch (e: Exception) {
            try {
                startActivity(Intent(Settings.ACTION_APP_NOTIFICATION_SETTINGS)
                    .putExtra(Settings.EXTRA_APP_PACKAGE, packageName))
            } catch (e2: Exception) {
                startActivity(Intent(Settings.ACTION_SETTINGS))
            }
        }
    }

    private fun openBatterySettings() {
        try {
            startActivity(Intent(Settings.ACTION_IGNORE_BATTERY_OPTIMIZATION_SETTINGS))
        } catch (e: Exception) {
            try {
                startActivity(Intent(
                    Settings.ACTION_APPLICATION_DETAILS_SETTINGS,
                    Uri.parse("package:$packageName")
                ))
            } catch (e2: Exception) {
                startActivity(Intent(Settings.ACTION_SETTINGS))
            }
        }
    }

    // ── 작은 도구들 ────────────────────────────────

    private fun dp(v: Int): Int = TypedValue.applyDimension(
        TypedValue.COMPLEX_UNIT_DIP, v.toFloat(), resources.displayMetrics
    ).toInt()

    private fun text(s: String, size: Float, color: Int, bold: Boolean = false, top: Int = 0): TextView =
        TextView(this).apply {
            text = s
            setTextSize(TypedValue.COMPLEX_UNIT_SP, size)
            setTextColor(color)
            setLineSpacing(dp(3).toFloat(), 1f)
            if (bold) setTypeface(typeface, android.graphics.Typeface.BOLD)
            if (top > 0) setPadding(0, dp(top), 0, 0)
        }

    private fun sectionTitle(s: String): TextView =
        text(s, 17f, ink, bold = true, top = 26)

    private fun card(): LinearLayout = LinearLayout(this).apply {
        orientation = LinearLayout.VERTICAL
        setPadding(dp(14), dp(14), dp(14), dp(14))
        setBackgroundColor(surface)
        val lp = LinearLayout.LayoutParams(
            LinearLayout.LayoutParams.MATCH_PARENT, LinearLayout.LayoutParams.WRAP_CONTENT
        )
        lp.topMargin = dp(10)
        layoutParams = lp
    }

    private fun toggle(label: String, initial: Boolean, onChange: (Boolean) -> Unit): Button {
        var on = initial
        return Button(this).apply {
            fun paint() {
                text = (if (on) "✓ " else "") + label
                setTextColor(if (on) ink else ink2)
                setBackgroundColor(if (on) Color.parseColor("#3A2E14") else Color.parseColor("#252017"))
            }
            paint()
            setOnClickListener { on = !on; paint(); onChange(on) }

            val lp = GridLayout.LayoutParams().apply {
                width = 0
                columnSpec = GridLayout.spec(GridLayout.UNDEFINED, 1f)
                setMargins(dp(3), dp(3), dp(3), dp(3))
            }
            layoutParams = lp
            setTextSize(TypedValue.COMPLEX_UNIT_SP, 13f)
        }
    }
}
