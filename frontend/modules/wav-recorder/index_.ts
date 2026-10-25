import { requireOptionalNativeModule } from 'expo';

interface WavRecorderModule {
  start(outputUri: string, sampleRate: number): Promise<void>;
  stop(): Promise<void>;
}

// Load on use, so unrelated screens still open in Expo Go or on the web.
export function getWavRecorder(): WavRecorderModule | null {
  return requireOptionalNativeModule<WavRecorderModule>('WavRecorder');
}
