package expo.modules.wavrecorder

import java.io.Closeable
import java.io.File
import java.io.RandomAccessFile
import java.nio.ByteBuffer
import java.nio.ByteOrder

/** Canonical RIFF/WAVE: PCM format 1, mono, signed 16-bit little-endian samples. */
internal class PcmWavWriter(file: File, private val sampleRate: Int) : Closeable {
  private val output = RandomAccessFile(file, "rw")
  var dataBytes = 0L
    private set
  private var bytes = ByteArray(0)

  init {
    try {
      require(output.length() == 0L) { "Refusing to overwrite a non-empty file." }
      output.write(header(0))
    } catch (error: Exception) {
      output.close()
      throw error
    }
  }

  fun write(samples: ShortArray, count: Int) {
    require(count in 0..samples.size)
    val length = count * 2
    require(dataBytes + length <= 0xffffffffL - 36) { "WAV recording exceeds the RIFF size limit." }
    if (bytes.size < length) bytes = ByteArray(length)
    for (index in 0 until count) {
      val sample = samples[index].toInt()
      bytes[index * 2] = (sample and 0xff).toByte()
      bytes[index * 2 + 1] = ((sample shr 8) and 0xff).toByte()
    }
    output.write(bytes, 0, length)
    dataBytes += length
  }

  private fun header(size: Long): ByteArray = ByteBuffer.allocate(44)
    .order(ByteOrder.LITTLE_ENDIAN)
    .put("RIFF".toByteArray(Charsets.US_ASCII)).putInt((size + 36).toInt())
    .put("WAVE".toByteArray(Charsets.US_ASCII))
    .put("fmt ".toByteArray(Charsets.US_ASCII)).putInt(16)
    .putShort(1.toShort()).putShort(1.toShort())
    .putInt(sampleRate).putInt(sampleRate * 2)
    .putShort(2.toShort()).putShort(16.toShort())
    .put("data".toByteArray(Charsets.US_ASCII)).putInt(size.toInt())
    .array()

  override fun close() {
    try {
      output.seek(0)
      output.write(header(dataBytes))
      output.fd.sync()
    } finally {
      output.close()
    }
  }
}
