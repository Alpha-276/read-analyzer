package expo.modules.wavrecorder

import android.Manifest
import android.content.pm.PackageManager
import android.net.Uri
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition
import java.io.File

class WavRecorderModule : Module() {
  private val lock = Any()
  private var session: RecordingSession? = null
  private var foreground = true

  override fun definition() = ModuleDefinition {
    Name("WavRecorder")

    AsyncFunction("start") { outputUri: String, sampleRate: Int ->
      synchronized(lock) {
        check(foreground) { "Recording must start while the application is in the foreground." }
        check(session == null) { "A recording is already active." }
        require(sampleRate in setOf(16000, 22050, 32000, 44100)) { "Unsupported sample rate." }
        val context = requireNotNull(appContext.reactContext) { "Android context is unavailable." }
        check(context.checkSelfPermission(Manifest.permission.RECORD_AUDIO) == PackageManager.PERMISSION_GRANTED) {
          "Microphone permission is required."
        }
        val uri = Uri.parse(outputUri)
        require(uri.scheme == "file") { "A local file URI is required." }
        val file = File(requireNotNull(uri.path)).canonicalFile
        val root = File(appContext.persistentFilesDirectory, "deti").canonicalFile
        require(file.path.startsWith(root.path + File.separator) && file.name.endsWith(".wav.part")) {
          "Recording must be written to a temporary file inside the application's deti directory."
        }
        require(file.isFile && file.length() == 0L) { "The temporary file must exist and be empty." }
        val next = RecordingSession(file, sampleRate)
        next.start()
        session = next
      }
    }

    AsyncFunction("stop") {
      val current = synchronized(lock) { checkNotNull(session) { "No active recording." } }
      try {
        current.finish()
      } finally {
        synchronized(lock) { if (session === current) session = null }
      }
    }

    OnActivityEntersForeground { synchronized(lock) { foreground = true } }

    OnActivityEntersBackground {
      synchronized(lock) {
        foreground = false
        // No background service: finish audio even if JavaScript is suspended.
        // The screen still calls stopRecording() to collect and save the result.
        session?.requestStop()
      }
    }

    OnDestroy {
      synchronized(lock) {
        foreground = false
        session?.requestStop()
        session = null
      }
    }
  }
}
