import { AndroidCodeFile } from '../types/assistant';

export const ANDROID_FILES: AndroidCodeFile[] = [
  {
    name: 'MayraVoiceService.kt',
    path: 'app/src/main/java/com/gemini/mayra/service/MayraVoiceService.kt',
    language: 'kotlin',
    category: 'Service',
    description: 'Background Foreground Service holding wake lock, continuous 16kHz mic capture, and 24kHz AudioTrack playback.',
    content: `package com.gemini.mayra.service

import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.app.Service
import android.content.Intent
import android.content.pm.ServiceInfo
import android.os.Binder
import android.os.Build
import android.os.IBinder
import android.os.PowerManager
import androidx.core.app.NotificationCompat
import com.gemini.mayra.MainActivity
import com.gemini.mayra.R
import com.gemini.mayra.audio.AudioRecordStreamer
import com.gemini.mayra.audio.AudioTrackPlayer
import com.gemini.mayra.network.GeminiLiveClient
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.cancel
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch

/**
 * Foreground Service for Mayra Voice Assistant.
 * Runs in the background with continuous bi-directional voice streaming.
 * Handles audio recording at 16kHz, playback at 24kHz, and instant interruptions.
 */
class MayraVoiceService : Service() {

    private val binder = LocalBinder()
    private val serviceScope = CoroutineScope(Dispatchers.Main + SupervisorJob())

    private var wakeLock: PowerManager.WakeLock? = null
    private lateinit var audioRecorder: AudioRecordStreamer
    private lateinit var audioPlayer: AudioTrackPlayer
    private lateinit var liveClient: GeminiLiveClient

    private val _isAssistantSpeaking = MutableStateFlow(false)
    val isAssistantSpeaking: StateFlow<Boolean> = _isAssistantSpeaking.asStateFlow()

    private val _inputVolume = MutableStateFlow(0f)
    val inputVolume: StateFlow<Float> = _inputVolume.asStateFlow()

    private val _outputVolume = MutableStateFlow(0f)
    val outputVolume: StateFlow<Float> = _outputVolume.asStateFlow()

    inner class LocalBinder : Binder() {
        fun getService(): MayraVoiceService = this@MayraVoiceService
    }

    override fun onBind(intent: Intent?): IBinder = binder

    override fun onCreate() {
        super.onCreate()
        acquireWakeLock()
        startForegroundWithNotification()

        audioPlayer = AudioTrackPlayer()
        audioPlayer.init()

        liveClient = GeminiLiveClient(
            onAudioReceived = { pcmChunk ->
                _isAssistantSpeaking.value = true
                audioPlayer.playChunk(pcmChunk)
            },
            onInterrupted = {
                // Gemini detected interruption -> instantly flush audio
                handleInterruption()
            },
            onTurnCompleted = {
                _isAssistantSpeaking.value = false
            }
        )

        audioRecorder = AudioRecordStreamer(
            onAudioChunk = { base64Pcm, rmsEnergy ->
                _inputVolume.value = (rmsEnergy * 5f).coerceIn(0f, 1f)
                
                // Real-time local interruption:
                // If user speaks (rms > threshold) while Mayra is speaking, flush instantly!
                if (_isAssistantSpeaking.value && rmsEnergy > 0.05f) {
                    handleInterruption()
                    liveClient.sendInterruptionSignal()
                }

                liveClient.sendAudioChunk(base64Pcm)
            }
        )

        serviceScope.launch(Dispatchers.IO) {
            liveClient.connect()
            audioRecorder.startRecording()
        }
    }

    private fun handleInterruption() {
        _isAssistantSpeaking.value = false
        audioPlayer.flushAndStop()
    }

    private fun acquireWakeLock() {
        val powerManager = getSystemService(POWER_SERVICE) as PowerManager
        wakeLock = powerManager.newWakeLock(
            PowerManager.PARTIAL_WAKE_LOCK,
            "Mayra::VoiceAssistantWakeLock"
        ).apply {
            acquire(24 * 60 * 60 * 1000L) // 24 hours keep-alive
        }
    }

    private fun startForegroundWithNotification() {
        val channelId = "mayra_voice_service_channel"
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            val channel = NotificationChannel(
                channelId,
                "Mayra Voice Assistant",
                NotificationManager.IMPORTANCE_LOW
            ).apply {
                description = "Active voice session with Mayra"
            }
            val manager = getSystemService(NotificationManager::class.java)
            manager.createNotificationChannel(channel)
        }

        val pendingIntent = PendingIntent.getActivity(
            this,
            0,
            Intent(this, MainActivity::class.java),
            PendingIntent.FLAG_IMMUTABLE
        )

        val notification: Notification = NotificationCompat.Builder(this, channelId)
            .setContentTitle("Mayra is Listening")
            .setContentText("Zero-touch voice assistant running in background")
            .setSmallIcon(android.R.drawable.ic_btn_speak_now)
            .setContentIntent(pendingIntent)
            .setOngoing(true)
            .build()

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
            startForeground(
                1001,
                notification,
                ServiceInfo.FOREGROUND_SERVICE_TYPE_MICROPHONE
            )
        } else {
            startForeground(1001, notification)
        }
    }

    override fun onDestroy() {
        audioRecorder.stopRecording()
        audioPlayer.release()
        liveClient.disconnect()
        wakeLock?.let { if (it.isHeld) it.release() }
        serviceScope.cancel()
        super.onDestroy()
    }
}`
  },
  {
    name: 'MayraScreen.kt',
    path: 'app/src/main/java/com/gemini/mayra/ui/MayraScreen.kt',
    language: 'kotlin',
    category: 'UI',
    description: 'Jetpack Compose zero-touch voice interface with fluid pulsating orb, dynamic shaders, and audio reactive ripples.',
    content: `package com.gemini.mayra.ui

import androidx.compose.animation.core.*
import androidx.compose.foundation.Canvas
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import kotlin.math.cos
import kotlin.math.sin

/**
 * Zero-Touch, Purely Voice-Driven UI for Mayra.
 * Strictly no text chat box; features fluid reactive animated voice orb.
 */
@Composable
fun MayraScreen(
    isSpeaking: Boolean,
    inputVolume: Float,
    outputVolume: Float,
    onToggleService: () -> Unit,
    modifier: Modifier = Modifier
) {
    val infiniteTransition = rememberInfiniteTransition(label = "orb_pulse")
    val pulseScale by infiniteTransition.animateFloat(
        initialValue = 0.95f,
        targetValue = 1.05f,
        animationSpec = infiniteRepeatable(
            animation = tween(1200, easing = FastOutSlowInEasing),
            repeatMode = RepeatMode.Reverse
        ),
        label = "scale"
    )

    Box(
        modifier = modifier
            .fillMaxSize()
            .background(Color(0xFF090D16)),
        contentAlignment = Alignment.Center
    ) {
        Column(
            horizontalAlignment = Alignment.CenterHorizontally,
            verticalArrangement = Arrangement.SpaceBetween,
            modifier = Modifier
                .fillMaxSize()
                .padding(vertical = 48.dp, horizontal = 24.dp)
        ) {
            // Top Status Pill
            Surface(
                color = Color(0xFF1E293B).copy(alpha = 0.8f),
                shape = RoundedCornerShape(24.dp),
                border = androidx.compose.foundation.BorderStroke(1.dp, Color(0xFF334155))
            ) {
                Row(
                    verticalAlignment = Alignment.CenterVertically,
                    modifier = Modifier.padding(horizontal = 16.dp, vertical = 8.dp)
                ) {
                    Box(
                        modifier = Modifier
                            .size(8.dp)
                            .clip(CircleShape)
                            .background(if (isSpeaking) Color(0xFFF43F5E) else Color(0xFF10B981))
                    )
                    Spacer(modifier = Modifier.width(8.dp))
                    Text(
                        text = if (isSpeaking) "Mayra is speaking" else "Listening actively (Zero-touch)",
                        color = Color.White,
                        fontSize = 13.sp
                    )
                }
            }

            // Central Fluid Voice Orb (Jetpack Compose Canvas)
            Box(
                contentAlignment = Alignment.Center,
                modifier = Modifier
                    .size(320.dp)
                    .clickable { onToggleService() }
            ) {
                Canvas(modifier = Modifier.fillMaxSize()) {
                    val center = Offset(size.width / 2, size.height / 2)
                    val baseRadius = 110.dp.toPx()
                    val dynamicRadius = if (isSpeaking) {
                        baseRadius * pulseScale + outputVolume * 60.dp.toPx()
                    } else {
                        baseRadius + inputVolume * 40.dp.toPx()
                    }

                    // Outer Radiant Aura
                    drawCircle(
                        brush = Brush.radialGradient(
                            colors = listOf(
                                if (isSpeaking) Color(0xFFF43F5E).copy(alpha = 0.45f)
                                else Color(0xFF6366F1).copy(alpha = 0.35f),
                                Color.Transparent
                            ),
                            center = center,
                            radius = dynamicRadius * 1.8f
                        ),
                        radius = dynamicRadius * 1.8f,
                        center = center
                    )

                    // Secondary Harmonic Ring
                    drawCircle(
                        color = if (isSpeaking) Color(0xFFFB7185).copy(alpha = 0.3f)
                        else Color(0xFF38BDF8).copy(alpha = 0.25f),
                        radius = dynamicRadius * 1.25f,
                        center = center,
                        style = androidx.compose.ui.graphics.drawscope.Stroke(width = 2.dp.toPx())
                    )

                    // Core Fluid Energy Gradient
                    drawCircle(
                        brush = Brush.linearGradient(
                            colors = if (isSpeaking) listOf(
                                Color(0xFFF43F5E), // Rose 500
                                Color(0xFFEC4899), // Pink 500
                                Color(0xFFA855F7)  // Purple 500
                            ) else listOf(
                                Color(0xFF6366F1), // Indigo 500
                                Color(0xFF38BDF8), // Sky 400
                                Color(0xFFA855F7)  // Purple 500
                            ),
                            start = Offset(center.x - dynamicRadius, center.y - dynamicRadius),
                            end = Offset(center.x + dynamicRadius, center.y + dynamicRadius)
                        ),
                        radius = dynamicRadius,
                        center = center
                    )
                }
            }

            // Bottom Personality Tagline
            Column(horizontalAlignment = Alignment.CenterHorizontally) {
                Text(
                    text = "MAYRA",
                    color = Color.White,
                    fontSize = 20.sp,
                    letterSpacing = 4.sp,
                    fontWeight = androidx.compose.ui.text.font.FontWeight.Bold
                )
                Spacer(modifier = Modifier.height(4.dp))
                Text(
                    text = "Sassy • Witty • Zero-Touch",
                    color = Color(0xFF94A3B8),
                    fontSize = 12.sp
                )
            }
        }
    }
}`
  },
  {
    name: 'GeminiLiveClient.kt',
    path: 'app/src/main/java/com/gemini/mayra/network/GeminiLiveClient.kt',
    language: 'kotlin',
    category: 'Network',
    description: 'OkHttp WebSocket bi-directional streaming client connecting directly to Gemini Live API bidiGenerateContent endpoint.',
    content: `package com.gemini.mayra.network

import android.util.Base64
import android.util.Log
import okhttp3.*
import org.json.JSONArray
import org.json.JSONObject
import java.util.concurrent.TimeUnit

/**
 * WebSocket client communicating with Gemini Live API (BidiGenerateContent)
 * using standard 16kHz PCM audio input and receiving 24kHz PCM audio output.
 */
class GeminiLiveClient(
    private val onAudioReceived: (ByteArray) -> Unit,
    private val onInterrupted: () -> Unit,
    private val onTurnCompleted: () -> Unit
) {
    private val client = OkHttpClient.Builder()
        .readTimeout(0, TimeUnit.MILLISECONDS)
        .writeTimeout(0, TimeUnit.MILLISECONDS)
        .build()

    private var webSocket: WebSocket? = null
    private val TAG = "GeminiLiveClient"

    fun connect(apiKey: String = "YOUR_GEMINI_API_KEY") {
        // Direct Gemini Live endpoint or server proxy
        val url = "wss://generativelanguage.googleapis.com/ws/google.ai.generativelanguage.v1beta.GenerativeService.BidiGenerateContent?key=\$apiKey"

        val request = Request.Builder()
            .url(url)
            .addHeader("User-Agent", "aistudio-build")
            .build()

        webSocket = client.newWebSocket(request, object : WebSocketListener() {
            override fun onOpen(ws: WebSocket, response: Response) {
                Log.d(TAG, "Gemini Live WebSocket opened. Sending setup config...")
                sendSetupMessage()
            }

            override fun onMessage(ws: WebSocket, text: String) {
                handleServerMessage(text)
            }

            override fun onFailure(ws: WebSocket, t: Throwable, response: Response?) {
                Log.e(TAG, "Gemini Live WebSocket failure: \${t.message}", t)
            }

            override fun onClosed(ws: WebSocket, code: Int, reason: String) {
                Log.d(TAG, "Gemini Live WebSocket closed: \$code / \$reason")
            }
        })
    }

    private fun sendSetupMessage() {
        val setupJson = JSONObject().apply {
            put("setup", JSONObject().apply {
                put("model", "models/gemini-3.1-flash-live-preview")
                put("generationConfig", JSONObject().apply {
                    put("responseModalities", JSONArray().put("AUDIO"))
                    put("speechConfig", JSONObject().apply {
                        put("voiceConfig", JSONObject().apply {
                            put("prebuiltVoiceConfig", JSONObject().apply {
                                put("voiceName", "Aoede")
                            })
                        })
                    })
                })
                put("systemInstruction", JSONObject().apply {
                    put("parts", JSONArray().put(JSONObject().apply {
                        put("text", "You are Mayra, a young, confident, witty, and sassy female personal assistant. Flirty, playful, teasing tone. Smart, emotionally responsive, never robotic. Spoken conversational voice format only.")
                    }))
                })
            })
        }
        webSocket?.send(setupJson.toString())
    }

    private fun handleServerMessage(jsonStr: String) {
        try {
            val json = JSONObject(jsonStr)
            val serverContent = json.optJSONObject("serverContent") ?: return

            // Handle server-side user interruption
            if (serverContent.optBoolean("interrupted", false)) {
                Log.d(TAG, "Interruption signal received from Gemini Live")
                onInterrupted()
                return
            }

            // Extract 24kHz audio chunks
            val modelTurn = serverContent.optJSONObject("modelTurn")
            val parts = modelTurn?.optJSONArray("parts")
            if (parts != null) {
                for (i in 0 until parts.length()) {
                    val part = parts.getJSONObject(i)
                    val inlineData = part.optJSONObject("inlineData")
                    val base64Data = inlineData?.optString("data")
                    if (!base64Data.isNullOrEmpty()) {
                        val pcmBytes = Base64.decode(base64Data, Base64.DEFAULT)
                        onAudioReceived(pcmBytes)
                    }
                }
            }

            if (serverContent.optBoolean("turnComplete", false)) {
                onTurnCompleted()
            }
        } catch (e: Exception) {
            Log.e(TAG, "Error parsing server message: \${e.message}")
        }
    }

    fun sendAudioChunk(base64Pcm: String) {
        val realtimeInput = JSONObject().apply {
            put("realtimeInput", JSONObject().apply {
                put("mediaChunks", JSONArray().put(JSONObject().apply {
                    put("mimeType", "audio/pcm;rate=16000")
                    put("data", base64Pcm)
                }))
            })
        }
        webSocket?.send(realtimeInput.toString())
    }

    fun sendInterruptionSignal() {
        // Can notify backend of client-side interrupt
        Log.d(TAG, "Client triggered interruption")
    }

    fun disconnect() {
        webSocket?.close(1000, "App closed")
        webSocket = null
    }
}`
  },
  {
    name: 'AudioTrackPlayer.kt',
    path: 'app/src/main/java/com/gemini/mayra/audio/AudioTrackPlayer.kt',
    language: 'kotlin',
    category: 'Audio',
    description: 'Low-latency 24kHz PCM AudioTrack player with instant buffer flush for seamless user interruptions.',
    content: `package com.gemini.mayra.audio

import android.media.AudioAttributes
import android.media.AudioFormat
import android.media.AudioTrack
import android.util.Log

/**
 * Manages streaming 24kHz, 16-bit Mono PCM audio playback.
 * Supports instant flush and stop upon interruption.
 */
class AudioTrackPlayer {

    private var audioTrack: AudioTrack? = null
    private val sampleRate = 24000
    private val TAG = "AudioTrackPlayer"

    fun init() {
        val minBufferSize = AudioTrack.getMinBufferSize(
            sampleRate,
            AudioFormat.CHANNEL_OUT_MONO,
            AudioFormat.ENCODING_PCM_16BIT
        )

        audioTrack = AudioTrack.Builder()
            .setAudioAttributes(
                AudioAttributes.Builder()
                    .setUsage(AudioAttributes.USAGE_ASSISTANCE_NAVIGATION_GUIDANCE)
                    .setContentType(AudioAttributes.CONTENT_TYPE_SPEECH)
                    .build()
            )
            .setAudioFormat(
                AudioFormat.Builder()
                    .setEncoding(AudioFormat.ENCODING_PCM_16BIT)
                    .setSampleRate(sampleRate)
                    .setChannelMask(AudioFormat.CHANNEL_OUT_MONO)
                    .build()
            )
            .setBufferSizeInBytes(minBufferSize * 4)
            .setTransferMode(AudioTrack.MODE_STREAM)
            .build()

        audioTrack?.play()
    }

    fun playChunk(pcmBytes: ByteArray) {
        audioTrack?.let {
            if (it.playState != AudioTrack.PLAYSTATE_PLAYING) {
                it.play()
            }
            it.write(pcmBytes, 0, pcmBytes.size)
        }
    }

    /**
     * Instantly flushes internal buffers and clears queued audio.
     * Crucial for zero-latency response when the user interrupts Mayra.
     */
    fun flushAndStop() {
        try {
            audioTrack?.let {
                it.pause()
                it.flush()
                it.play()
            }
            Log.d(TAG, "AudioTrack flushed cleanly for interruption")
        } catch (e: Exception) {
            Log.e(TAG, "Error flushing AudioTrack: \${e.message}")
        }
    }

    fun release() {
        try {
            audioTrack?.stop()
            audioTrack?.release()
            audioTrack = null
        } catch (e: Exception) {
            Log.e(TAG, "Error releasing AudioTrack: \${e.message}")
        }
    }
}`
  },
  {
    name: 'AudioRecordStreamer.kt',
    path: 'app/src/main/java/com/gemini/mayra/audio/AudioRecordStreamer.kt',
    language: 'kotlin',
    category: 'Audio',
    description: 'Background thread recording 16kHz PCM audio, calculating real-time RMS for voice activity and interruption detection.',
    content: `package com.gemini.mayra.audio

import android.annotation.SuppressLint
import android.media.AudioFormat
import android.media.AudioRecord
import android.media.MediaRecorder
import android.util.Base64
import android.util.Log
import kotlin.math.sqrt

/**
 * Continuous 16kHz PCM audio recorder running on a background thread.
 * Encodes audio chunks to Base64 and computes RMS energy for local VAD.
 */
class AudioRecordStreamer(
    private val onAudioChunk: (base64Pcm: String, rms: Float) -> Unit
) {
    private var isRecording = false
    private var recordThread: Thread? = null
    private val sampleRate = 16000
    private val TAG = "AudioRecordStreamer"

    @SuppressLint("MissingPermission")
    fun startRecording() {
        if (isRecording) return
        isRecording = true

        val minBufferSize = AudioRecord.getMinBufferSize(
            sampleRate,
            AudioFormat.CHANNEL_IN_MONO,
            AudioFormat.ENCODING_PCM_16BIT
        )

        val bufferSize = (minBufferSize * 2).coerceAtLeast(2048)
        val audioRecord = AudioRecord(
            MediaRecorder.AudioSource.VOICE_RECOGNITION,
            sampleRate,
            AudioFormat.CHANNEL_IN_MONO,
            AudioFormat.ENCODING_PCM_16BIT,
            bufferSize
        )

        recordThread = Thread {
            android.os.Process.setThreadPriority(android.os.Process.THREAD_PRIORITY_URGENT_AUDIO)
            audioRecord.startRecording()
            val audioBuffer = ShortArray(1024)

            while (isRecording) {
                val read = audioRecord.read(audioBuffer, 0, audioBuffer.size)
                if (read > 0) {
                    // Calculate RMS energy for VAD / Interruption
                    var sum = 0.0
                    for (i in 0 until read) {
                        val norm = audioBuffer[i] / 32768.0
                        sum += norm * norm
                    }
                    val rms = sqrt(sum / read).toFloat()

                    // Convert ShortArray to ByteArray (Little-Endian)
                    val byteBuffer = ByteArray(read * 2)
                    for (i in 0 until read) {
                        val s = audioBuffer[i].toInt()
                        byteBuffer[i * 2] = (s and 0xFF).toByte()
                        byteBuffer[i * 2 + 1] = ((s shr 8) and 0xFF).toByte()
                    }

                    val base64 = Base64.encodeToString(byteBuffer, Base64.NO_WRAP)
                    onAudioChunk(base64, rms)
                }
            }

            audioRecord.stop()
            audioRecord.release()
        }.apply { start() }
    }

    fun stopRecording() {
        isRecording = false
        recordThread?.interrupt()
        recordThread = null
    }
}`
  },
  {
    name: 'AndroidManifest.xml',
    path: 'app/src/main/AndroidManifest.xml',
    language: 'xml',
    category: 'Config',
    description: 'Android Manifest declaring RECORD_AUDIO, FOREGROUND_SERVICE_MICROPHONE, and background wake lock.',
    content: `<?xml version="1.0" encoding="utf-8"?>
<manifest xmlns:android="http://schemas.android.com/apk/res/android"
    xmlns:tools="http://schemas.android.com/tools"
    package="com.gemini.mayra">

    <!-- Essential Voice Assistant Permissions -->
    <uses-permission android:name="android.permission.RECORD_AUDIO" />
    <uses-permission android:name="android.permission.INTERNET" />
    <uses-permission android:name="android.permission.WAKE_LOCK" />
    <uses-permission android:name="android.permission.POST_NOTIFICATIONS" />
    
    <!-- Android 14+ Foreground Service Microphone -->
    <uses-permission android:name="android.permission.FOREGROUND_SERVICE" />
    <uses-permission android:name="android.permission.FOREGROUND_SERVICE_MICROPHONE" />

    <application
        android:allowBackup="true"
        android:icon="@mipmap/ic_launcher"
        android:label="Mayra Voice"
        android:roundIcon="@mipmap/ic_launcher_round"
        android:supportsRtl="true"
        android:theme="@style/Theme.Mayra"
        tools:targetApi="34">

        <activity
            android:name=".MainActivity"
            android:exported="true"
            android:theme="@style/Theme.Mayra">
            <intent-filter>
                <action android:name="android.intent.action.MAIN" />
                <category android:name="android.intent.category.LAUNCHER" />
            </intent-filter>
        </activity>

        <!-- Persistent Background Voice Foreground Service -->
        <service
            android:name=".service.MayraVoiceService"
            android:enabled="true"
            android:exported="false"
            android:foregroundServiceType="microphone" />

    </application>
</manifest>`
  },
  {
    name: 'build.gradle.kts',
    path: 'app/build.gradle.kts',
    language: 'kotlin',
    category: 'Config',
    description: 'Gradle build file with Jetpack Compose BOM, Material3, Coroutines, and OkHttp WebSocket client.',
    content: `plugins {
    alias(libs.plugins.android.application)
    alias(libs.plugins.kotlin.android)
    alias(libs.plugins.kotlin.compose)
}

android {
    namespace = "com.gemini.mayra"
    compileSdk = 35

    defaultConfig {
        applicationId = "com.gemini.mayra"
        minSdk = 26
        targetSdk = 35
        versionCode = 1
        versionName = "1.0.0"

        testInstrumentationRunner = "androidx.test.runner.AndroidJUnitRunner"
    }

    buildFeatures {
        compose = true
    }

    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
    }

    kotlinOptions {
        jvmTarget = "17"
    }
}

dependencies {
    // Jetpack Compose BOM & Core
    val composeBom = platform("androidx.compose:compose-bom:2024.10.01")
    implementation(composeBom)
    implementation("androidx.compose.ui:ui")
    implementation("androidx.compose.material3:material3")
    implementation("androidx.compose.ui:ui-tooling-preview")
    implementation("androidx.activity:activity-compose:1.9.3")
    implementation("androidx.lifecycle:lifecycle-viewmodel-compose:2.8.7")

    // OkHttp for Gemini Live WebSocket Bidi streaming
    implementation("com.squareup.okhttp3:okhttp:4.12.0")

    // Coroutines & Lifecycle
    implementation("org.jetbrains.kotlinx:kotlinx-coroutines-android:1.9.0")
    implementation("androidx.core:core-ktx:1.15.0")
    implementation("androidx.lifecycle:lifecycle-runtime-ktx:2.8.7")
}`
  }
];
