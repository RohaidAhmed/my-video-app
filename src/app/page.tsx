'use client';

import dynamic from 'next/dynamic';

// Dynamically import the VideoRecorder component and disable Server-Side Rendering (SSR)
// This is CRUCIAL because MediaRecorder and 'navigator' APIs only exist in the browser.
const VideoRecorder = dynamic(
  () => import('../components/VideoRecorder'),
  { ssr: false }
);

export default function Home() {
  return (

    <VideoRecorder />
  );
}
