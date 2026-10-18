package expo.modules.wavrecorder

import android.annotation.SuppressLint
import android.media.AudioFormat
import android.media.AudioRecord
import android.media.MediaRecorder
import android.os.Process
import java.io.File

internal class RecordingSession(private val file: File, private val sampleRate: Int) {
  @Volatile private var running = false
  @Volatile private var failure: Exception? = null
  private lateinit var worker: Thread

  @SuppressLint("MissingPermission") // Checked in both TypeScript and WavRecorderModule.
  fun start() {
    val minimum = AudioRecord.getMinBufferSize(
      sampleRate, AudioFormat.CHANNEL_IN_MONO, AudioFormat.ENCODING_PCM_16BIT,
    )
    check(minimum > 0) { "The device does not support $sampleRate Hz PCM recording." }
    val bufferBytes = maxOf(minimum * 2, sampleRate / 5 * 2)
    val audio = AudioRecord(
      MediaRecorder.AudioSource.VOICE_RECOGNITION, sampleRate,
      AudioFormat.CHANNEL_IN_MONO, AudioFormat.ENCODING_PCM_16BIT, bufferBytes,
    )
    var writer: PcmWavWriter? = null
    try {
      check(audio.state == AudioRecord.STATE_INITIALIZED) { "AudioRecord could not initialize." }
      check(audio.sampleRate == sampleRate && audio.channelCount == 1 &&
        audio.audioFormat == AudioFormat.ENCODING_PCM_16BIT) { "The requested PCM format is unavailable." }
      val output = PcmWavWriter(file, sampleRate)
      writer = output
      audio.startRecording()
      check(audio.recordingState == AudioRecord.RECORDSTATE_RECORDING) { "The microphone could not start." }
      running = true
      worker = Thread({ capture(audio, output, bufferBytes / 2) }, "ra-wav-recorder")
      worker.start()
    } catch (error: Exception) {
      running = false
      runCatching { audio.release() }
      runCatching { writer?.close() }
      throw error
    }
  }

  private fun capture(audio: AudioRecord, output: PcmWavWriter, bufferSamples: Int) {
    try {
      Process.setThreadPriority(Process.THREAD_PRIORITY_AUDIO)
      val samples = ShortArray(bufferSamples)
      while (running) {
        // Nonblocking reads let lifecycle callbacks stop without blocking the UI thread.
        val count = audio.read(samples, 0, samples.size, AudioRecord.READ_NON_BLOCKING)
        check(count >= 0) { "AudioRecord read failed (code $count)." }
        if (count == 0) Thread.sleep(10) else output.write(samples, count)
      }
      check(output.dataBytes > 0) { "No audio was captured. Record for longer before stopping." }
    } catch (error: Exception) {
      failure = error
    } finally {
      running = false
      try { audio.stop() } catch (error: Exception) { if (failure == null) failure = error }
      try { audio.release() } catch (error: Exception) { if (failure == null) failure = error }
      try { output.close() } catch (error: Exception) { if (failure == null) failure = error }
    }
  }

  fun requestStop() { running = false }

  fun finish() {
    requestStop()
    // Called from Expo's async worker, never from the activity's UI thread.
    worker.join()
    failure?.let { throw it }
  }
}
