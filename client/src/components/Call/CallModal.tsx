import { useEffect, useRef } from 'react';
import { useCallStore } from '../../store/callStore';
import { useWebRTC } from '../../hooks/useWebRTC';
import Avatar from '../User/Avatar';
import { Phone, PhoneOff, Video, VideoOff, Mic, MicOff } from 'lucide-react';
import { useState } from 'react';

interface Props {
  userName: string;
  userAvatar?: string | null;
}

export default function CallModal({ userName, userAvatar }: Props) {
  const { status, callType, localStream, remoteStream } = useCallStore();
  const { acceptCall, rejectCall, hangUp } = useWebRTC();
  const localVideoRef = useRef<HTMLVideoElement>(null);
  const remoteVideoRef = useRef<HTMLVideoElement>(null);
  const [isMuted, setIsMuted] = useState(false);
  const [isVideoOff, setIsVideoOff] = useState(false);

  useEffect(() => {
    if (localVideoRef.current && localStream) {
      localVideoRef.current.srcObject = localStream;
    }
  }, [localStream]);

  useEffect(() => {
    if (remoteVideoRef.current && remoteStream) {
      remoteVideoRef.current.srcObject = remoteStream;
    }
  }, [remoteStream]);

  const toggleMute = () => {
    if (localStream) {
      localStream.getAudioTracks().forEach((t) => (t.enabled = !t.enabled));
      setIsMuted(!isMuted);
    }
  };

  const toggleVideo = () => {
    if (localStream) {
      localStream.getVideoTracks().forEach((t) => (t.enabled = !t.enabled));
      setIsVideoOff(!isVideoOff);
    }
  };

  if (status === 'idle') return null;

  return (
    <div className="fixed inset-0 bg-dark-950/90 z-50 flex items-center justify-center">
      <div className="bg-dark-800 rounded-2xl p-8 max-w-md w-full mx-4 text-center">
        {/* Incoming call */}
        {status === 'incoming' && (
          <>
            <div className="mb-6">
              <div className="call-pulse inline-block rounded-full">
                <Avatar src={userAvatar} name={userName} size="xl" />
              </div>
            </div>
            <h2 className="text-xl font-bold text-white mb-1">{userName}</h2>
            <p className="text-dark-400 mb-8">
              {callType === 'video' ? 'Видеозвонок...' : 'Голосовой звонок...'}
            </p>
            <div className="flex justify-center gap-6">
              <button onClick={rejectCall} className="w-14 h-14 bg-red-500 hover:bg-red-600 rounded-full flex items-center justify-center transition">
                <PhoneOff size={24} className="text-white" />
              </button>
              <button onClick={acceptCall} className="w-14 h-14 bg-green-500 hover:bg-green-600 rounded-full flex items-center justify-center transition">
                <Phone size={24} className="text-white" />
              </button>
            </div>
          </>
        )}

        {/* Calling */}
        {status === 'calling' && (
          <>
            <div className="mb-6">
              <div className="call-pulse inline-block rounded-full">
                <Avatar src={userAvatar} name={userName} size="xl" />
              </div>
            </div>
            <h2 className="text-xl font-bold text-white mb-1">{userName}</h2>
            <p className="text-dark-400 mb-8">Вызов...</p>
            <button onClick={hangUp} className="w-14 h-14 bg-red-500 hover:bg-red-600 rounded-full flex items-center justify-center mx-auto transition">
              <PhoneOff size={24} className="text-white" />
            </button>
          </>
        )}

        {/* Connected */}
        {status === 'connected' && (
          <>
            {callType === 'video' && (
              <div className="relative mb-6 rounded-xl overflow-hidden bg-dark-900 aspect-video">
                <video ref={remoteVideoRef} autoPlay playsInline className="w-full h-full object-cover" />
                <video
                  ref={localVideoRef}
                  autoPlay
                  playsInline
                  muted
                  className="absolute bottom-2 right-2 w-32 h-24 rounded-lg object-cover border-2 border-dark-600"
                />
              </div>
            )}
            {callType === 'voice' && (
              <div className="mb-6">
                <Avatar src={userAvatar} name={userName} size="xl" />
                <h2 className="text-xl font-bold text-white mt-4 mb-1">{userName}</h2>
                <p className="text-green-400 text-sm">Звонок...</p>
              </div>
            )}
            <div className="flex justify-center gap-4">
              <button onClick={toggleMute} className={`w-12 h-12 rounded-full flex items-center justify-center transition ${isMuted ? 'bg-red-500' : 'bg-dark-600 hover:bg-dark-500'}`}>
                {isMuted ? <MicOff size={20} /> : <Mic size={20} />}
              </button>
              {callType === 'video' && (
                <button onClick={toggleVideo} className={`w-12 h-12 rounded-full flex items-center justify-center transition ${isVideoOff ? 'bg-red-500' : 'bg-dark-600 hover:bg-dark-500'}`}>
                  {isVideoOff ? <VideoOff size={20} /> : <Video size={20} />}
                </button>
              )}
              <button onClick={hangUp} className="w-12 h-12 bg-red-500 hover:bg-red-600 rounded-full flex items-center justify-center transition">
                <PhoneOff size={20} />
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
