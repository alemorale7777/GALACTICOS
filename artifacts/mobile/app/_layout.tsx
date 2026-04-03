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
    // Try Screen Orientation API (Chrome/Edge)
    try {
      const screen = (window as any).screen;
      if (screen?.orientation?.lock) {
        screen.orientation.lock('landscape').catch(() => {});
      }
    } catch {}
    // Add CSS to force landscape hint
    const style = document.createElement('style');
    style.textContent = `
      @media (orientation: portrait) {
        #rotate-hint:not(.dismissed) {
          display: flex !important;
        }
      }
      @media (orientation: landscape) {
        #rotate-hint {
          display: none !important;
        }
      }
    `;
    document.head.appendChild(style);
    // Add rotate hint overlay
    const hint = document.createElement('div');
    hint.id = 'rotate-hint';
    hint.style.cssText = 'display:none;position:fixed;inset:0;z-index:99999;background:rgba(0,0,0,0.95);align-items:center;justify-content:center;flex-direction:column;gap:16px;';
    hint.innerHTML = '<div style="font-size:48px;">📱↔️</div><div style="color:#FFD700;font-size:18px;font-weight:bold;letter-spacing:4px;">ROTATE YOUR DEVICE</div><div style="color:rgba(255,255,255,0.5);font-size:12px;">THRAXON plays best in landscape</div><div id="rotate-dismiss" style="margin-top:24px;padding:12px 32px;border:1px solid rgba(255,215,0,0.3);border-radius:12px;color:rgba(255,255,255,0.7);font-size:14px;cursor:pointer;">CONTINUE ANYWAY</div>';
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
