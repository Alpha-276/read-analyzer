/** Google OAuth on Android via Play Services. No refresh/client secret is stored in JS. */

const DRIVE_SCOPE = 'https://www.googleapis.com/auth/drive';
let configured = false;

// Do not load the native module just by opening the app: other screens should
// remain usable in Expo Go even though RA-26 itself requires a development build.
async function sdk() {
  const library = await import('@react-native-google-signin/google-signin');
  if (!configured) {
    library.GoogleSignin.configure({
      scopes: [DRIVE_SCOPE],
      ...(process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID
        ? { webClientId: process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID }
        : {}),
    });
    configured = true;
  }
  return library;
}

export async function connectGoogle(): Promise<string | null> {
  const { GoogleSignin, isSuccessResponse } = await sdk();
  await GoogleSignin.hasPlayServices({ showPlayServicesUpdateDialog: true });
  const result = await GoogleSignin.signIn();
  if (!isSuccessResponse(result)) return null;
  // An account might have been signed in earlier without the Drive permission.
  if (!result.data.scopes.includes(DRIVE_SCOPE)) {
    const grant = await GoogleSignin.addScopes({ scopes: [DRIVE_SCOPE] });
    if (!grant || !isSuccessResponse(grant)) return null;
  }
  return result.data.user.email;
}

export async function activeGoogleAccount(): Promise<string | null> {
  const { GoogleSignin, isSuccessResponse } = await sdk();
  const current = GoogleSignin.getCurrentUser();
  if (current) return current.user.email;
  if (!GoogleSignin.hasPreviousSignIn()) return null;
  const restored = await GoogleSignin.signInSilently();
  return isSuccessResponse(restored) ? restored.data.user.email : null;
}

export async function googleAccessToken(expectedEmail: string): Promise<string> {
  const { GoogleSignin } = await sdk();
  const email = await activeGoogleAccount();
  if (!email || email.toLowerCase() !== expectedEmail.toLowerCase()) {
    throw new Error('Prihláste sa do Google účtu, pre ktorý je nastavená záloha.');
  }
  return (await GoogleSignin.getTokens()).accessToken;
}

export async function invalidateGoogleToken(token: string): Promise<void> {
  const { GoogleSignin } = await sdk();
  await GoogleSignin.clearCachedAccessToken(token);
}

export async function disconnectGoogle(): Promise<void> {
  const { GoogleSignin } = await sdk();
  await GoogleSignin.signOut();
}
