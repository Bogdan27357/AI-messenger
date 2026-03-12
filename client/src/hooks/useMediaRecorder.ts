import { useState, useRef, useCallback } from 'react';
import api from '../api/axios';

interface UseMediaRecorderOptions {
  type: 'voice' | 'video_circle';
}

export function useMediaRecorder({ type }: UseMediaRecorderOptions) {
  const [isRecording, setIsRecording] = useState(false);
  const [duration, setDuration] = useState(0);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const startRecording = useCallback(async () => {
    try {
      const constraints = type === 'voice'
        ? { audio: true }
        : { audio: true, video: { width: 240, height: 240, facingMode: 'user' } };

      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      streamRef.current = stream;

      const mimeType = type === 'voice' ? 'audio/webm;codecs=opus' : 'video/webm;codecs=vp9,opus';
      const recorder = new MediaRecorder(stream, {
        mimeType: MediaRecorder.isTypeSupported(mimeType) ? mimeType : undefined,
      });

      chunksRef.current = [];
      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };

      mediaRecorderRef.current = recorder;
      recorder.start(100);
      setIsRecording(true);
      setDuration(0);

      timerRef.current = setInterval(() => {
        setDuration((d) => d + 1);
      }, 1000);
    } catch (error) {
      console.error('Start recording error:', error);
    }
  }, [type]);

  const stopRecording = useCallback(async (): Promise<{ fileUrl: string; duration: number } | null> => {
    return new Promise((resolve) => {
      const recorder = mediaRecorderRef.current;
      if (!recorder || recorder.state === 'inactive') {
        resolve(null);
        return;
      }

      recorder.onstop = async () => {
        if (timerRef.current) clearInterval(timerRef.current);
        streamRef.current?.getTracks().forEach((t) => t.stop());

        const blob = new Blob(chunksRef.current, {
          type: type === 'voice' ? 'audio/webm' : 'video/webm',
        });

        const formData = new FormData();
        const ext = type === 'voice' ? 'webm' : 'webm';
        formData.append('file', blob, `recording.${ext}`);

        try {
          const uploadType = type === 'voice' ? 'voice' : 'video';
          const { data } = await api.post(`/messages/upload?type=${uploadType}`, formData, {
            headers: { 'Content-Type': 'multipart/form-data' },
          });
          resolve({ fileUrl: data.fileUrl, duration: duration });
        } catch (error) {
          console.error('Upload error:', error);
          resolve(null);
        }

        setIsRecording(false);
        setDuration(0);
      };

      recorder.stop();
    });
  }, [type, duration]);

  const cancelRecording = useCallback(() => {
    const recorder = mediaRecorderRef.current;
    if (recorder && recorder.state !== 'inactive') {
      recorder.stop();
    }
    if (timerRef.current) clearInterval(timerRef.current);
    streamRef.current?.getTracks().forEach((t) => t.stop());
    setIsRecording(false);
    setDuration(0);
  }, []);

  return { isRecording, duration, startRecording, stopRecording, cancelRecording, stream: streamRef.current };
}
