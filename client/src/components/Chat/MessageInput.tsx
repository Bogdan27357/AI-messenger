import { useState, useRef, useCallback } from 'react';
import { getSocket } from '../../api/socket';
import { useMediaRecorder } from '../../hooks/useMediaRecorder';
import api from '../../api/axios';
import type { Message, MessageType } from '../../types';
import {
  Send, Mic, Video, Paperclip, X, Image, FileText, StopCircle, Circle,
} from 'lucide-react';

interface Props {
  chatId: string;
  replyTo: Message | null;
  onClearReply: () => void;
}

export default function MessageInput({ chatId, replyTo, onClearReply }: Props) {
  const [text, setText] = useState('');
  const [showAttachMenu, setShowAttachMenu] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const typingTimeoutRef = useRef<ReturnType<typeof setTimeout>>();

  const voiceRecorder = useMediaRecorder({ type: 'voice' });
  const videoRecorder = useMediaRecorder({ type: 'video_circle' });

  const isRecording = voiceRecorder.isRecording || videoRecorder.isRecording;

  const sendMessage = useCallback((type: MessageType, content?: string, fileUrl?: string, fileName?: string, fileSize?: number, duration?: number) => {
    const socket = getSocket();
    if (!socket) return;
    socket.emit('chat:message', {
      chatId,
      type,
      content,
      fileUrl,
      fileName,
      fileSize,
      duration,
      replyToId: replyTo?.id,
    });
    onClearReply();
  }, [chatId, replyTo]);

  const handleSend = () => {
    if (!text.trim()) return;
    sendMessage('TEXT', text.trim());
    setText('');
    const socket = getSocket();
    socket?.emit('chat:typing:stop', { chatId });
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleTyping = () => {
    const socket = getSocket();
    if (!socket) return;
    socket.emit('chat:typing', { chatId });
    if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
    typingTimeoutRef.current = setTimeout(() => {
      socket.emit('chat:typing:stop', { chatId });
    }, 2000);
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const formData = new FormData();
    formData.append('file', file);

    let uploadType = 'attachments';
    let msgType: MessageType = 'FILE';

    if (file.type.startsWith('image/')) {
      uploadType = 'attachments';
      msgType = 'IMAGE';
    } else if (file.type.startsWith('video/')) {
      uploadType = 'video';
      msgType = 'VIDEO';
    }

    try {
      const { data } = await api.post(`/messages/upload?type=${uploadType}`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      sendMessage(msgType, undefined, data.fileUrl, data.fileName, data.fileSize);
    } catch (error) {
      console.error('Upload error:', error);
    }

    setShowAttachMenu(false);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleVoiceRecord = async () => {
    if (voiceRecorder.isRecording) {
      const result = await voiceRecorder.stopRecording();
      if (result) {
        sendMessage('VOICE', undefined, result.fileUrl, undefined, undefined, result.duration);
      }
    } else {
      voiceRecorder.startRecording();
    }
  };

  const handleVideoCircle = async () => {
    if (videoRecorder.isRecording) {
      const result = await videoRecorder.stopRecording();
      if (result) {
        sendMessage('VIDEO_CIRCLE', undefined, result.fileUrl, undefined, undefined, result.duration);
      }
    } else {
      videoRecorder.startRecording();
    }
  };

  function formatDuration(sec: number) {
    const m = Math.floor(sec / 60);
    const s = sec % 60;
    return `${m}:${s.toString().padStart(2, '0')}`;
  }

  if (voiceRecorder.isRecording) {
    return (
      <div className="p-4 border-t border-dark-700 bg-dark-800">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2 flex-1">
            <div className="w-3 h-3 bg-red-500 rounded-full animate-pulse" />
            <span className="text-red-400 text-sm font-medium">Запись голоса</span>
            <span className="text-dark-400 text-sm">{formatDuration(voiceRecorder.duration)}</span>
          </div>
          <button onClick={voiceRecorder.cancelRecording} className="p-2 hover:bg-dark-700 rounded-lg">
            <X size={20} className="text-dark-400" />
          </button>
          <button onClick={handleVoiceRecord} className="p-2 bg-red-500 hover:bg-red-600 rounded-lg">
            <StopCircle size={20} className="text-white" />
          </button>
        </div>
      </div>
    );
  }

  if (videoRecorder.isRecording) {
    return (
      <div className="p-4 border-t border-dark-700 bg-dark-800">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2 flex-1">
            <Circle size={12} className="text-red-500 fill-red-500 animate-pulse" />
            <span className="text-primary-400 text-sm font-medium">Запись видеокружка</span>
            <span className="text-dark-400 text-sm">{formatDuration(videoRecorder.duration)}</span>
          </div>
          <button onClick={videoRecorder.cancelRecording} className="p-2 hover:bg-dark-700 rounded-lg">
            <X size={20} className="text-dark-400" />
          </button>
          <button onClick={handleVideoCircle} className="p-2 bg-primary-500 hover:bg-primary-600 rounded-lg">
            <StopCircle size={20} className="text-white" />
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="border-t border-dark-700 bg-dark-800">
      {/* Reply preview */}
      {replyTo && (
        <div className="flex items-center gap-2 px-4 pt-3 pb-0">
          <div className="flex-1 bg-dark-700/50 border-l-2 border-primary-500 rounded px-3 py-1.5">
            <div className="text-xs text-primary-400 font-medium">{replyTo.sender.name}</div>
            <div className="text-xs text-dark-300 truncate">{replyTo.content || 'Медиа'}</div>
          </div>
          <button onClick={onClearReply} className="p-1 hover:bg-dark-700 rounded">
            <X size={16} className="text-dark-400" />
          </button>
        </div>
      )}

      <div className="flex items-end gap-2 p-3">
        {/* Attach button */}
        <div className="relative">
          <button onClick={() => setShowAttachMenu(!showAttachMenu)} className="p-2 hover:bg-dark-700 rounded-lg transition">
            <Paperclip size={20} className="text-dark-400" />
          </button>
          {showAttachMenu && (
            <div className="absolute bottom-full mb-2 left-0 bg-dark-700 rounded-lg shadow-xl py-1 w-44 z-10">
              <label className="flex items-center gap-2 px-4 py-2 text-sm text-dark-200 hover:bg-dark-600 cursor-pointer">
                <Image size={16} /> Фото/Видео
                <input type="file" accept="image/*,video/*" className="hidden" ref={fileInputRef} onChange={handleFileUpload} />
              </label>
              <label className="flex items-center gap-2 px-4 py-2 text-sm text-dark-200 hover:bg-dark-600 cursor-pointer">
                <FileText size={16} /> Документ
                <input type="file" className="hidden" onChange={handleFileUpload} />
              </label>
            </div>
          )}
        </div>

        {/* Text input */}
        <textarea
          value={text}
          onChange={(e) => { setText(e.target.value); handleTyping(); }}
          onKeyDown={handleKeyDown}
          placeholder="Сообщение..."
          rows={1}
          className="flex-1 bg-dark-700 border border-dark-600 rounded-xl px-4 py-2.5 text-sm text-white resize-none focus:outline-none focus:border-primary-500 transition max-h-32"
          style={{ minHeight: '42px' }}
        />

        {/* Action buttons */}
        {text.trim() ? (
          <button onClick={handleSend} className="p-2 bg-primary-600 hover:bg-primary-700 rounded-lg transition">
            <Send size={20} className="text-white" />
          </button>
        ) : (
          <div className="flex gap-1">
            <button onClick={handleVoiceRecord} className="p-2 hover:bg-dark-700 rounded-lg transition" title="Голосовое сообщение">
              <Mic size={20} className="text-dark-400" />
            </button>
            <button onClick={handleVideoCircle} className="p-2 hover:bg-dark-700 rounded-lg transition" title="Видеокружок">
              <Video size={20} className="text-primary-400" />
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
