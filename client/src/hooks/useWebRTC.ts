import { useCallback } from 'react';
import { getSocket } from '../api/socket';
import { useCallStore } from '../store/callStore';
import type { CallType } from '../store/callStore';

const ICE_SERVERS = [{ urls: 'stun:stun.l.google.com:19302' }];

export function useWebRTC() {
  const { startCall, setConnected, endCall, remoteUserId, callType } = useCallStore();

  const initiateCall = useCallback(async (targetUserId: string, type: CallType) => {
    const socket = getSocket();
    if (!socket) return;

    startCall(targetUserId, type);
    socket.emit('call:initiate', { targetUserId, type });

    const pc = new RTCPeerConnection({ iceServers: ICE_SERVERS });
    const localStream = await navigator.mediaDevices.getUserMedia({
      audio: true,
      video: type === 'video',
    });

    localStream.getTracks().forEach((track) => pc.addTrack(track, localStream));

    const remoteStream = new MediaStream();
    pc.ontrack = (event) => {
      event.streams[0].getTracks().forEach((track) => remoteStream.addTrack(track));
    };

    pc.onicecandidate = (event) => {
      if (event.candidate) {
        socket.emit('call:ice-candidate', { targetUserId, candidate: event.candidate });
      }
    };

    socket.on('call:accepted', async () => {
      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);
      socket.emit('call:offer', { targetUserId, offer });
      setConnected(localStream, remoteStream, pc);
    });

    socket.on('call:answer', async ({ answer }: any) => {
      await pc.setRemoteDescription(new RTCSessionDescription(answer));
    });

    socket.on('call:ice-candidate', async ({ candidate }: any) => {
      await pc.addIceCandidate(new RTCIceCandidate(candidate));
    });

    socket.on('call:rejected', () => {
      endCall();
    });

    socket.on('call:ended', () => {
      endCall();
    });
  }, []);

  const acceptCall = useCallback(async () => {
    const socket = getSocket();
    const { remoteUserId, callType } = useCallStore.getState();
    if (!socket || !remoteUserId || !callType) return;

    socket.emit('call:accept', { callerId: remoteUserId });

    const pc = new RTCPeerConnection({ iceServers: ICE_SERVERS });
    const localStream = await navigator.mediaDevices.getUserMedia({
      audio: true,
      video: callType === 'video',
    });

    localStream.getTracks().forEach((track) => pc.addTrack(track, localStream));

    const remoteStream = new MediaStream();
    pc.ontrack = (event) => {
      event.streams[0].getTracks().forEach((track) => remoteStream.addTrack(track));
    };

    pc.onicecandidate = (event) => {
      if (event.candidate) {
        socket.emit('call:ice-candidate', { targetUserId: remoteUserId, candidate: event.candidate });
      }
    };

    socket.on('call:offer', async ({ offer }: any) => {
      await pc.setRemoteDescription(new RTCSessionDescription(offer));
      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);
      socket.emit('call:answer', { targetUserId: remoteUserId, answer });
    });

    socket.on('call:ice-candidate', async ({ candidate }: any) => {
      await pc.addIceCandidate(new RTCIceCandidate(candidate));
    });

    socket.on('call:ended', () => {
      endCall();
    });

    setConnected(localStream, remoteStream, pc);
  }, []);

  const rejectCall = useCallback(() => {
    const socket = getSocket();
    const { remoteUserId } = useCallStore.getState();
    if (socket && remoteUserId) {
      socket.emit('call:reject', { callerId: remoteUserId });
    }
    endCall();
  }, []);

  const hangUp = useCallback(() => {
    const socket = getSocket();
    const { remoteUserId } = useCallStore.getState();
    if (socket && remoteUserId) {
      socket.emit('call:end', { targetUserId: remoteUserId });
    }
    endCall();
  }, []);

  return { initiateCall, acceptCall, rejectCall, hangUp };
}
