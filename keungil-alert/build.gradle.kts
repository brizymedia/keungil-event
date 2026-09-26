plugins {
    // 8.13 부터 compileSdk 36(안드로이드 16)을 제대로 지원한다. 그레이들은 8.13 이상 (워크플로에서 8.14.3 으로 고정).
    id("com.android.application") version "8.13.0" apply false
    id("org.jetbrains.kotlin.android") version "1.9.24" apply false
}
