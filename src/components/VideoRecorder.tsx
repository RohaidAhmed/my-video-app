'use client';

import React, { useRef, useState, useCallback, useEffect } from 'react';
import { supabase } from '../utils/supabaseClient';
import { v4 as uuidv4 } from 'uuid'; // You may need to install this: npm install uuid @types/uuid

const VideoRecorder: React.FC = () => {
    const videoRef = useRef<HTMLVideoElement>(null);
    const mediaRecorderRef = useRef<MediaRecorder | null>(null);
    const recordedChunksRef = useRef<Blob[]>([]);

    const [isRecording, setIsRecording] = useState(false);
    const [videoBlob, setVideoBlob] = useState<Blob | null>(null);
    const [statusMessage, setStatusMessage] = useState<string>('Ready to start recording.');
    const [uploading, setUploading] = useState(false);

    // 1. Get Access to Camera and Microphone
    const startStream = useCallback(async () => {
        try {
            const stream = await navigator.mediaDevices.getUserMedia({
                video: { width: 1280, height: 720 },
                audio: true,
            });

            if (videoRef.current) {
                videoRef.current.srcObject = stream;
                videoRef.current.play();
                setStatusMessage('Camera stream active. Click Record.');
                return stream;
            }
        } catch (err) {
            console.error('Error accessing media devices:', err);
            setStatusMessage('Error: Could not access camera and microphone.');
            return null;
        }
    }, []);

    useEffect(() => {
        // Start the stream when the component mounts
        startStream();
    }, [startStream]);


    // 2. Start Recording
    const startRecording = useCallback(async () => {
        let stream = videoRef.current?.srcObject as MediaStream;
        if (!stream) {
            setStatusMessage('Stream not available. Retrying stream access...');
            const newStream = await startStream();
            if (!newStream) return;
            stream = newStream; // Use the newly acquired stream
        }

        try {
            // Use 'video/mp4' for better cross-browser compatibility, especially iOS Safari
            const options = { mimeType: 'video/webm; codecs=vp8' }; // webm is often safer for MediaRecorder
            const recorder = new MediaRecorder(stream, options);

            recordedChunksRef.current = [];
            recorder.ondataavailable = (event: BlobEvent) => {
                if (event.data.size > 0) {
                    recordedChunksRef.current.push(event.data);
                }
            };

            recorder.onstop = () => {
                const mimeType = recorder.mimeType.split(';')[0]; // Get base mime type
                const videoBlob = new Blob(recordedChunksRef.current, { type: mimeType });
                setVideoBlob(videoBlob);
                setIsRecording(false);
                setStatusMessage(`Recording finished. Size: ${(videoBlob.size / 1024 / 1024).toFixed(2)} MB. Ready to upload.`);

                // Stop the media stream tracks
                stream.getTracks().forEach(track => track.stop());
            };

            recorder.start(1000); // Start recording, saving data every 1 second
            mediaRecorderRef.current = recorder;
            setIsRecording(true);
            setVideoBlob(null);
            setStatusMessage('Recording...');

        } catch (error) {
            console.error("Error starting MediaRecorder:", error);
            setStatusMessage("Error starting recording. Try refreshing.");
        }

    }, [startStream]);


    // 3. Stop Recording
    const stopRecording = () => {
        if (mediaRecorderRef.current && isRecording) {
            mediaRecorderRef.current.stop();
            // mediaRecorderRef.current.onstop handles state updates
        }
    };


    // 4. Upload to Supabase Storage
    const handleUpload = useCallback(async () => {
        if (!videoBlob) {
            setStatusMessage('No video to upload.');
            return;
        }

        setUploading(true);
        setStatusMessage('Uploading to Supabase...');

        // Generate a unique file name
        const fileExt = videoBlob.type.includes('webm') ? 'webm' : 'mp4';
        const fileName = `${uuidv4()}.${fileExt}`;
        const filePath = `public_videos/${fileName}`; // Supabase Storage Path

        try {
            // Ensure you have a 'videos' bucket created in Supabase Storage
            const { data, error } = await supabase.storage
                .from('videos') // **IMPORTANT: Replace 'videos' with your actual bucket name**
                .upload(filePath, videoBlob, {
                    cacheControl: '3600',
                    upsert: false,
                });

            if (error) {
                throw error;
            }

            const publicURL = supabase.storage.from('videos').getPublicUrl(filePath).data.publicUrl;

            setStatusMessage(`Upload successful! File: ${fileName}. Public URL: ${publicURL}`);
            setVideoBlob(null); // Clear the video blob
            setUploading(false);
            startStream(); // Restart the camera stream for a new recording

        } catch (error: any) {
            setStatusMessage(`Upload failed: ${error.message}`);
            setUploading(false);
            console.error(error);
        }
    }, [videoBlob, startStream]);


    return (
        <div style={{ padding: '20px', maxWidth: '600px', margin: 'auto', textAlign: 'center' }}>
            <h1>Video Recorder & Uploader</h1>

            {/* Video Preview */}
            <video
                ref={videoRef}
                autoPlay
                muted
                style={{ width: '100%', maxHeight: '450px', backgroundColor: 'black', borderRadius: '8px' }}
            />

            <div style={{ margin: '20px 0' }}>
                {/* Recording Controls */}
                {!isRecording ? (
                    <button
                        onClick={startRecording}
                        disabled={uploading}
                        style={{ padding: '10px 20px', fontSize: '16px', background: 'green', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer' }}
                    >
                        Start Recording
                    </button>
                ) : (
                    <button
                        onClick={stopRecording}
                        style={{ padding: '10px 20px', fontSize: '16px', background: 'red', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer' }}
                    >
                        Stop Recording
                    </button>
                )}

                {/* Upload Control */}
                {videoBlob && !isRecording && (
                    <button
                        onClick={handleUpload}
                        disabled={uploading}
                        style={{
                            padding: '10px 20px',
                            fontSize: '16px',
                            marginLeft: '10px',
                            background: uploading ? 'gray' : 'blue',
                            color: 'white',
                            border: 'none',
                            borderRadius: '4px',
                            cursor: 'pointer'
                        }}
                    >
                        {uploading ? 'Uploading...' : 'Upload Video'}
                    </button>
                )}
            </div>

            {/* Status Message */}
            <p style={{ color: uploading ? 'orange' : videoBlob ? 'green' : 'black' }}>
                **Status:** {statusMessage}
            </p>

            {/* Display recorded video for review (optional) */}
            {videoBlob && !isRecording && (
                <div style={{ marginTop: '20px' }}>
                    <h3>Recorded Video Preview</h3>
                    <video
                        src={URL.createObjectURL(videoBlob)}
                        controls
                        style={{ width: '100%', maxHeight: '300px' }}
                    />
                </div>
            )}
        </div>
    );
};

export default VideoRecorder;