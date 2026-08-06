import React from 'react';
import { useRouter } from 'expo-router';

import { MindSweepModalContent } from '../components/mind-sweep-modal-content';
import { ThemedAlertHost } from '../components/themed-alert';

export default function MindSweepModalScreen() {
  const router = useRouter();
  return (
    <>
      <MindSweepModalContent onClose={() => router.back()} />
      {/* This route is presented modally, so a root-level alert never reaches
          the screen on iOS (#940). */}
      <ThemedAlertHost />
    </>
  );
}
