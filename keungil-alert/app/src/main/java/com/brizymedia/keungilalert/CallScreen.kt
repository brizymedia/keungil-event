package com.brizymedia.keungilalert

import android.os.Build
import android.telecom.Call
import android.telecom.CallScreeningService
import androidx.annotation.RequiresApi

/**
 * 스토어판의 번호 받기 — 「전화 확인(스팸 차단) 앱」 역할.
 *
 * 안드로이드 10 부터, 사용자가 이 역할을 준 앱에는 걸려온 전화와 건 전화의 번호를 알려 준다(통화기록 권한 없이).
 * 우리는 전화를 막거나 조용히 하지 않는다 — 번호와 방향만 기억해 두고, 통화가 끝나면 CallWatcher 가 쓴다.
 * 주소록에 있는 번호는 (연락처 권한이 없으므로) 아예 오지 않는다. 「모르는 번호에만」 과 같은 뜻이다.
 *
 * 걸려온 전화는 5초 안에 「그대로 울려라」고 답해야 한다. 답이 늦으면 그만큼 전화가 늦게 울린다.
 */
@RequiresApi(Build.VERSION_CODES.Q)
class CallScreen : CallScreeningService() {

    override fun onScreenCall(details: Call.Details) {
        val 걸려온것 = details.callDirection == Call.Details.DIRECTION_INCOMING
        try {
            val h = details.handle
            val 번호 = if (h != null && h.scheme == "tel") h.schemeSpecificPart.orEmpty() else ""
            if (번호.isNotBlank()) Store(this).rememberCall(번호, 걸려온것)
        } catch (e: Exception) { /* 번호를 못 읽으면 그냥 넘어간다 — 전화는 그대로 울린다 */ }

        if (걸려온것) {
            try { respondToCall(details, CallResponse.Builder().build()) } catch (e: Exception) {}
        }
    }
}
