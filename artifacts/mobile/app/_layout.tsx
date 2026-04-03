import {
  Inter_400Regular,
  Inter_500Medium,
  Inter_600SemiBold,
  Inter_700Bold,
  useFonts,
} from '@expo-google-fonts/inter';
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import React, { useEffect } from 'react';
import { Platform } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { ErrorBoundary } from '@/components/ErrorBoundary';

SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  const [fontsLoaded, fontError] = useFonts({
    Inter_400Regular,
    Inter_500Medium,
    Inter_600SemiBold,
    Inter_700Bold,
  });

  useEffect(() => {
    if (fontsLoaded || fontError) {
      SplashScreen.hideAsync();
    }
  }, [fontsLoaded, fontError]);

  // Force landscape orientation on web
  useEffect(() => {
    if (Platform.OS !== 'web') return;
    // Add CSS for rotate hint
    const style = document.createElement('style');
    style.textContent = `
      @media (orientation: portrait) {
        #rotate-hint:not(.dismissed) { display: flex !important; }
      }
      @media (orientation: landscape) {
        #rotate-hint { display: none !important; }
      }
    `;
    document.head.appendChild(style);
    // Add rotate hint overlay
    const hint = document.createElement('div');
    hint.id = 'rotate-hint';
    hint.style.cssText = 'display:none;position:fixed;inset:0;z-index:99999;background:rgba(0,0,0,0.95);align-items:center;justify-content:center;flex-direction:column;gap:16px;';
    hint.innerHTML = '<div style="font-size:48px;">📱↔️</div><div style="color:#FFD700;font-size:18px;font-weight:bold;letter-spacing:4px;">ROTATE YOUR DEVICE</div><div style="color:rgba(255,255,255,0.5);font-size:12px;text-align:center;">Rotate your phone sideways for<br/>the best experience</div><div id="rotate-fullscreen" style="margin-top:20px;padding:14px 36px;background:rgba(255,215,0,0.15);border:1.5px solid rgba(255,215,0,0.5);border-radius:14px;color:#FFD700;font-size:15px;font-weight:bold;letter-spacing:2px;cursor:pointer;">GO FULLSCREEN</div><div id="rotate-dismiss" style="margin-top:12px;padding:8px 24px;color:rgba(255,255,255,0.4);font-size:12px;cursor:pointer;">or continue in portrait</div>';

    // Fullscreen button — enters fullscreen then locks landscape
    const fsBtn = hint.querySelector('#rotate-fullscreen');
    if (fsBtn) {
      fsBtn.addEventListener('click', async (e) => {
        e.stopPropagation();
        try {
          const el = document.documentElement as any;
          const requestFS = el.requestFullscreen || el.webkitRequestFullscreen || el.mozRequestFullScreen || el.msRequestFullscreen;
          if (requestFS) {
            await requestFS.call(el);
            // Now try to lock orientation (only works in fullscreen)
            try {
              await (screen as any).orientation.lock('landscape');
            } catch {}
          }
        } catch {}
        hint.classList.add('dismissed');
        hint.style.display = 'none';
      });
    }

    // Skip button — just dismiss
    const dismissBtn = hint.querySelector('#rotate-dismiss');
    if (dismissBtn) {
      dismissBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        hint.classList.add('dismissed');
        hint.style.display = 'none';
      });
    }
    document.body.appendChild(hint);
    return () => { style.remove(); hint.remove(); };
  }, []);

  if (!fontsLoaded && !fontError) return null;

  return (
    <SafeAreaProvider>
      <ErrorBoundary>
        <GestureHandlerRootView style={{ flex: 1 }}>
          <Stack screenOptions={{ headerShown: false }}>
            <Stack.Screen name="index" />
          </Stack>
        </GestureHandlerRootView>
      </ErrorBoundary>
    </SafeAreaProvider>
  );
}
