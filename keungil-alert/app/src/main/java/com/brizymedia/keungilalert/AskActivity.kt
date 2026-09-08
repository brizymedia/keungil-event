package com.brizymedia.keungilalert

import android.app.NotificationManager
import android.content.Intent
import android.graphics.Color
import android.graphics.drawable.GradientDrawable
import android.os.Build
import android.os.Bundle
import android.util.TypedValue
import android.view.Gravity
import android.view.View
import android.view.WindowManager
import android.widget.Button
import android.widget.LinearLayout
import android.widget.TextView
import androidx.appcompat.app.AppCompatActivity

/**
 * 통화가 끝나면 화면 한가운데에 떠서 「명함을 보낼까요?」 하고 묻는 창.
 *
 * 알림으로만 물어보면 위에서 잠깐 스쳐 지나가고 놓친다. 통화 직후는 화면을
 * 보고 있는 순간이라 여기서 물어야 답을 받는다.
 *
 * 배경에서 화면을 띄우는 건 안드로이드 10 부터 막혀 있다. 「다른 앱 위에 표시」
 * 권한이 있으면 풀린다. 없으면 CallWatcher 가 알림으로 되돌아간다.
 */
class AskActivity : AppCompatActivity() {

    private var number = ""

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)

        // 잠겨 있어도 켜지고, 화면이 꺼져 있으면 켠다
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O_MR1) {
            setShowWhenLocked(true); setTurnScreenOn(true)
        } else {
            @Suppress("DEPRECATION")
            window.addFlags(
                WindowManager.LayoutParams.FLAG_SHOW_WHEN_LOCKED or
                    WindowManager.LayoutParams.FLAG_TURN_SCREEN_ON or
                    WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON
            )
        }

        number = intent?.getStringExtra(CallWatcher.EXTRA_NUMBER).orEmpty()
        // 알림으로도 띄웠으면 같이 치운다 — 둘이 남아 있으면 헷갈린다
        getSystemService(NotificationManager::class.java)?.cancel(ASK_ID)

        if (number.isBlank()) { finish(); return }
        setContentView(화면())
    }

    override fun onNewIntent(intent: Intent?) {
        super.onNewIntent(intent)
        intent?.getStringExtra(CallWatcher.EXTRA_NUMBER)?.let { if (it.isNotBlank()) number = it }
    }

    private fun 화면(): View {
        val store = Store(this)

        val 카드 = LinearLayout(this).apply {
            orientation = LinearLayout.VERTICAL
            setPadding(dp(22), dp(24), dp(22), dp(18))
            background = GradientDrawable().apply {
                setColor(Color.parseColor("#1C1913"))
                cornerRadius = dp(18).toFloat()
                setStroke(dp(1), Color.parseColor("#3A342A"))
            }
        }

        카드.addView(글("통화 끝났습니다", 13f, "#F5A524", bold = true))
        카드.addView(글("명함을 보낼까요?", 23f, "#F6F1E7", bold = true, top = 6))
        카드.addView(글(보기좋은번호(number), 17f, "#F6F1E7", bold = true, top = 14))

        카드.addView(글("보낼 내용", 11f, "#8A8171", bold = true, top = 18))
        카드.addView(TextView(this).apply {
            text = store.cbMessage()
            setTextSize(TypedValue.COMPLEX_UNIT_SP, 13f)
            setTextColor(Color.parseColor("#B8AF9E"))
            setLineSpacing(dp(3).toFloat(), 1f)
            setPadding(dp(12), dp(10), dp(12), dp(10))
            background = GradientDrawable().apply {
                setColor(Color.parseColor("#12100C"))
                cornerRadius = dp(10).toFloat()
            }
            (layoutParams as? LinearLayout.LayoutParams ?: LinearLayout.LayoutParams(
                LinearLayout.LayoutParams.MATCH_PARENT, LinearLayout.LayoutParams.WRAP_CONTENT
            ).also { layoutParams = it }).topMargin = dp(6)
        })

        카드.addView(Button(this).apply {
            text = "보내기"
            setTextColor(Color.parseColor("#12100C"))
            setTextSize(TypedValue.COMPLEX_UNIT_SP, 16f)
            background = GradientDrawable().apply {
                setColor(Color.parseColor("#F5A524")); cornerRadius = dp(10).toFloat()
            }
            layoutParams = LinearLayout.LayoutParams(
                LinearLayout.LayoutParams.MATCH_PARENT, dp(52)
            ).apply { topMargin = dp(20) }
            setOnClickListener { 보내고닫기() }
        })

        카드.addView(Button(this).apply {
            text = "안 보냄"
            setTextColor(Color.parseColor("#8A8171"))
            setTextSize(TypedValue.COMPLEX_UNIT_SP, 15f)
            background = null
            layoutParams = LinearLayout.LayoutParams(
                LinearLayout.LayoutParams.MATCH_PARENT, dp(46)
            ).apply { topMargin = dp(4) }
            setOnClickListener { finish() }
        })

        return LinearLayout(this).apply {
            orientation = LinearLayout.VERTICAL
            gravity = Gravity.CENTER
            setPadding(dp(18), dp(18), dp(18), dp(18))
            setBackgroundColor(Color.parseColor("#CC000000"))   // 뒤를 어둡게
            addView(카드, LinearLayout.LayoutParams(
                LinearLayout.LayoutParams.MATCH_PARENT, LinearLayout.LayoutParams.WRAP_CONTENT))
            // 바깥을 눌러도 닫히게
            setOnClickListener { finish() }
        }
    }

    private fun 보내고닫기() {
        sendBroadcast(Intent(this, CallWatcher::class.java)
            .setAction(CallWatcher.ACTION_SEND)
            .putExtra(CallWatcher.EXTRA_NUMBER, number)
            .setPackage(packageName))
        finish()
    }

    /** 010-1234-5678 처럼 끊어 보여준다. 숫자만 붙어 있으면 잘 안 읽힌다. */
    private fun 보기좋은번호(s: String): String {
        val d = s.filter { it.isDigit() }
        return when {
            d.length == 11 -> d.substring(0, 3) + "-" + d.substring(3, 7) + "-" + d.substring(7)
            d.length == 10 && d.startsWith("02") -> d.substring(0, 2) + "-" + d.substring(2, 6) + "-" + d.substring(6)
            d.length == 10 -> d.substring(0, 3) + "-" + d.substring(3, 6) + "-" + d.substring(6)
            else -> s
        }
    }

    private fun 글(s: String, size: Float, color: String, bold: Boolean = false, top: Int = 0): TextView =
        TextView(this).apply {
            text = s
            setTextSize(TypedValue.COMPLEX_UNIT_SP, size)
            setTextColor(Color.parseColor(color))
            if (bold) setTypeface(typeface, android.graphics.Typeface.BOLD)
            if (top > 0) setPadding(0, dp(top), 0, 0)
        }

    private fun dp(v: Int): Int = TypedValue.applyDimension(
        TypedValue.COMPLEX_UNIT_DIP, v.toFloat(), resources.displayMetrics).toInt()

    companion object {
        private const val ASK_ID = 9101      // CallWatcher 가 쓰는 것과 같은 번호
    }
}
