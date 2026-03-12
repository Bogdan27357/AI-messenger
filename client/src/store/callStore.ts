import { create } from 'zustand';

export type CallStatus = 'idle' | 'calling' | 'incoming' | 'connected';
export type CallType = 'voice' | 'video';

interface CallState {
  status: CallStatus;
  callType: CallType | null;
  remoteUserId: string | null;
  localStream: MediaStream | null;
  remoteStream: MediaStream | null;
  peerConnection: RTCPeerConnection | null;
  setStatus: (status: CallStatus) => void;
  startCall: (userId: string, type: CallType) => void;
  setIncoming: (callerId: string, type: CallType) => void;
  setConnected: (localStream: MediaStream, remoteStream: MediaStream, pc: RTCPeerConnection) => void;
  endCall: () => void;
}

export const useCallStore = create<CallState>((set, get) => ({
  status: 'idle',
  callType: null,
  remoteUserId: null,
  localStream: null,
  remoteStream: null,
  peerConnection: null,

  setStatus: (status) => set({ status }),

  startCall: (userId, type) =>
    set({ status: 'calling', callType: type, remoteUserId: userId }),

  setIncoming: (callerId, type) =>
    set({ status: 'incoming', callType: type, remoteUserId: callerId }),

  setConnected: (localStream, remoteStream, pc) =>
    set({ status: 'connected', localStream, remoteStream, peerConnection: pc }),

  endCall: () => {
    const { localStream, remoteStream, peerConnection } = get();
    localStream?.getTracks().forEach((t) => t.stop());
    remoteStream?.getTracks().forEach((t) => t.stop());
    peerConnection?.close();
    set({
      status: 'idle',
      callType: null,
      remoteUserId: null,
      localStream: null,
      remoteStream: null,
      peerConnection: null,
    });
  },
}));
