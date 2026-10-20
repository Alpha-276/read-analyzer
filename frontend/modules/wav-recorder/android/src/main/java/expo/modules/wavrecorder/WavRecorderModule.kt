package expo.modules.wavrecorder

import android.Manifest
import android.content.ContentValues
import android.content.pm.PackageManager
import android.net.Uri
import android.os.Build
import android.os.Environment
import android.provider.MediaStore
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition
import java.io.File
import java.io.FileInputStream

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

    // Export only AFTER confirmation in the UI. The preview stays private until then.
    // MediaStore.Downloads makes finished files visible in the Android file manager.
    AsyncFunction("exportToDownloads") { sourceUri: String, studentFolder: String, stem: String ->
      check(Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
        "Saving to Downloads requires Android 10 (API 29) or newer."
      }
      require(Regex("[A-Za-z0-9_-]+").matches(studentFolder)) { "Invalid student folder." }
      require(Regex("\\d{4}-\\d{2}-\\d{2}_[A-Za-z0-9_-]+").matches(stem)) { "Invalid WAV filename." }

      val context = requireNotNull(appContext.reactContext) { "Android context is unavailable." }
      val uri = Uri.parse(sourceUri)
      require(uri.scheme == "file") { "A local temporary WAV is required." }
      val source = File(requireNotNull(uri.path)).canonicalFile
      val privateRoot = File(appContext.persistentFilesDirectory, "deti").canonicalFile
      val folder = File(privateRoot, studentFolder).canonicalFile
      require(folder.parentFile == privateRoot && source.parentFile == folder && source.name.endsWith(".wav.part")) {
        "WAV must come from the student's private temporary folder."
      }
      check(source.isFile && source.length() > 44) { "Temporary WAV is missing or empty." }

      val resolver = context.contentResolver
      val downloads = MediaStore.Downloads.EXTERNAL_CONTENT_URI
      val relativePath = "${Environment.DIRECTORY_DOWNLOADS}/CitamDobre/deti/$studentFolder/"
      val existingNames = mutableSetOf<String>()
      resolver.query(
        downloads,
        arrayOf(MediaStore.MediaColumns.DISPLAY_NAME),
        "${MediaStore.MediaColumns.RELATIVE_PATH} = ?",
        arrayOf(relativePath),
        null,
      )?.use { cursor ->
        val column = cursor.getColumnIndexOrThrow(MediaStore.MediaColumns.DISPLAY_NAME)
        while (cursor.moveToNext()) existingNames.add(cursor.getString(column))
      }
      var name = "$stem.wav"
      var suffix = 2
      while (name in existingNames) name = "${stem}_${suffix++}.wav"

      val values = ContentValues().apply {
        put(MediaStore.MediaColumns.DISPLAY_NAME, name)
        put(MediaStore.MediaColumns.MIME_TYPE, "audio/wav")
        put(MediaStore.MediaColumns.RELATIVE_PATH, relativePath)
        put(MediaStore.MediaColumns.IS_PENDING, 1)
      }
      val destination = checkNotNull(resolver.insert(downloads, values)) {
        "Cannot create a WAV entry in Downloads."
      }
      try {
        FileInputStream(source).use { input ->
          val output = checkNotNull(resolver.openOutputStream(destination, "w")) {
            "Cannot write the WAV to Downloads."
          }
          output.use {
            val bytesCopied = input.copyTo(it, bufferSize = 64 * 1024)
            check(bytesCopied == source.length()) { "Incomplete WAV export." }
          }
        }
        val publish = ContentValues().apply { put(MediaStore.MediaColumns.IS_PENDING, 0) }
        check(resolver.update(destination, publish, null, null) == 1) { "Cannot publish the WAV in Downloads." }
      } catch (error: Exception) {
        // Never leave a corrupt shared WAV; the private preview is kept for retry.
        runCatching { resolver.delete(destination, null, null) }
        throw error
      }
      destination.toString() // content:// URI, not a private file:// URI.
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