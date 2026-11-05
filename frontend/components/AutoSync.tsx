/** Foreground/offline-first retry when connectivity returns. No background execution. */
import { useEffect } from 'react';
import { AppState } from 'react-native';
import * as Network from 'expo-network';
import { getServerToken } from '../services/serverAuth';
import { getSchoolSyncSummary, synchronizeSchool } from '../services/schoolSync';
import { onSchoolDataChanged } from '../services/syncEvents';
import { autoBackupIfEnabled } from '../services/driveBackup';

export default function AutoSync() {
  useEffect(() => {
    let alive = true;
    let connected = false;
    let busy = false;
    let timer: ReturnType<typeof setTimeout> | undefined;

    const trySync = async (pullRemote: boolean) => {
      if (!alive || busy || !connected || AppState.currentState !== 'active') return;
      busy = true;
      try {
        if (!(await getServerToken())) return;
        const summary = await getSchoolSyncSummary();
        if (summary.pending > 0 || pullRemote) await synchronizeSchool();
      } catch (error) {
        // Local edits remain dirty; next connectivity change/foreground/retry will retry.
        console.warn('Auto-sync unavailable:', error instanceof Error ? error.message : String(error));
      } finally {
        busy = false;
      }
    };

    // Drive and FastAPI synchronization are independent; lack of server token
    // must not suppress an opted-in Google backup.
    let driveBusy = false;
    const tryDriveBackup = async () => {
      if (!alive || !connected || driveBusy || AppState.currentState !== 'active') return;
      driveBusy = true;
      try { await autoBackupIfEnabled(); }
      catch (error) { console.warn('Drive backup unavailable:', error instanceof Error ? error.message : String(error)); }
      finally { driveBusy = false; }
    };

    const schedule = (pullRemote: boolean) => {
      if (timer) clearTimeout(timer);
      timer = setTimeout(() => { void trySync(pullRemote); void tryDriveBackup(); }, 600);
    };
    const onNetwork = (state: Network.NetworkState) => {
      const next = state.isConnected !== false; // LAN can work even without external internet.
      const restored = !connected && next;
      connected = next;
      if (restored) schedule(true);
    };
    const netSub = Network.addNetworkStateListener(onNetwork);
    void Network.getNetworkStateAsync().then(onNetwork).catch(() => {});
    const appSub = AppState.addEventListener('change', state => {
      if (state === 'active') {
        void Network.getNetworkStateAsync().then(net => {
          if (!alive) return;
          connected = net.isConnected !== false;
          if (connected) schedule(true);
        }).catch(() => {});
      }
    });
    const changesSub = onSchoolDataChanged(() => {
      if (connected) schedule(false);
    });
    // The Wi-Fi may stay connected while a test backend was temporarily stopped.
    const retry = setInterval(() => { void trySync(false); void tryDriveBackup(); }, 60000);
    return () => {
      alive = false;
      if (timer) clearTimeout(timer);
      clearInterval(retry);
      netSub.remove();
      appSub.remove();
      changesSub();
    };
  }, []);
  return null;
}
