import { useState } from 'react';
import { useAuthStore } from '../../store/authStore';
import Avatar from '../User/Avatar';
import type { Message } from '../../types';
import { Reply, Forward, Smile, MoreHorizontal, Check, CheckCheck, Play, Pause, FileText, Download } from 'lucide-react';
import { getSocket } from '../../api/socket';

interface Props {
  message: Message;
  onReply: (msg: Message) => void;
}

const EMOJIS = ['👍', '❤️', '😂', '😮', '😢', '🔥'];

export default function MessageItem({ message, onReply }: Props) {
  const user = useAuthStore((s) => s.user);
  const isMine = message.senderId === user?.id;
  const [showActions, setShowActions] = useState(false);
  const [showEmojis, setShowEmojis] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);

  function formatTime(dateStr: string) {
    return new Date(dateStr).toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' });
  }

  function handleReaction(emoji: string) {
    const socket = getSocket();
    if (socket) {
      socket.emit('chat:reaction', { chatId: message.chatId, messageId: message.id, emoji });
    }
    setShowEmojis(false);
  }

  function formatDuration(seconds: number) {
    const m = Math.floor(seconds / 60);
    const s = Math.floor(seconds % 60);
    return `${m}:${s.toString().padStart(2, '0')}`;
  }

  function formatFileSize(bytes: number) {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  }

  const isRead = message.reads?.length > 0;

  const renderContent = () => {
    if (message.isDeleted) {
      return <span className="italic text-dark-400">Сообщение удалено</span>;
    }

    switch (message.type) {
      case 'VOICE':
        return (
          <div className="flex items-center gap-3 min-w-[200px]">
            <button
              onClick={() => {
                const audio = document.getElementById(`audio-${message.id}`) as HTMLAudioElement;
                if (audio) {
                  if (isPlaying) { audio.pause(); setIsPlaying(false); }
                  else { audio.play(); setIsPlaying(true); audio.onended = () => setIsPlaying(false); }
                }
              }}
              className="w-10 h-10 rounded-full bg-primary-500 flex items-center justify-center shrink-0"
            >
              {isPlaying ? <Pause size={18} /> : <Play size={18} className="ml-0.5" />}
            </button>
            <div className="flex-1">
              <div className="voice-waveform">
                {Array.from({ length: 20 }).map((_, i) => (
                  <div key={i} className="voice-waveform-bar" style={{ height: `${Math.random() * 24 + 8}px`, opacity: isPlaying ? 1 : 0.5 }} />
                ))}
              </div>
              <span className="text-xs opacity-60">{message.duration ? formatDuration(message.duration) : ''}</span>
            </div>
            <audio id={`audio-${message.id}`} src={message.fileUrl || ''} preload="metadata" />
          </div>
        );

      case 'VIDEO_CIRCLE':
        return (
          <div className="video-circle cursor-pointer" onClick={() => {
            const video = document.getElementById(`video-${message.id}`) as HTMLVideoElement;
            if (video) { video.paused ? video.play() : video.pause(); }
          }}>
            <video id={`video-${message.id}`} src={message.fileUrl || ''} loop playsInline />
            {message.duration && <span className="absolute bottom-2 right-2 text-xs bg-black/50 px-1.5 py-0.5 rounded">{formatDuration(message.duration)}</span>}
          </div>
        );

      case 'IMAGE':
        return (
          <img src={message.fileUrl || ''} alt="" className="max-w-xs rounded-lg cursor-pointer hover:opacity-90 transition" onClick={() => window.open(message.fileUrl || '', '_blank')} />
        );

      case 'VIDEO':
        return (
          <video src={message.fileUrl || ''} controls className="max-w-xs rounded-lg" preload="metadata" />
        );

      case 'FILE':
        return (
          <a href={message.fileUrl || ''} download={message.fileName} className="flex items-center gap-3 bg-dark-600/50 rounded-lg p-3 hover:bg-dark-600 transition">
            <FileText size={32} className="text-primary-400 shrink-0" />
            <div className="min-w-0">
              <div className="text-sm font-medium truncate">{message.fileName}</div>
              <div className="text-xs opacity-60">{message.fileSize ? formatFileSize(message.fileSize) : ''}</div>
            </div>
            <Download size={18} className="text-dark-400 shrink-0" />
          </a>
        );

      default:
        return (
          <>
            {message.content}
            {message.isEdited && <span className="text-xs opacity-40 ml-1">(ред.)</span>}
          </>
        );
    }
  };

  return (
    <div
      className={`flex gap-2 px-4 py-1 message-enter group ${isMine ? 'flex-row-reverse' : ''}`}
      onMouseEnter={() => setShowActions(true)}
      onMouseLeave={() => { setShowActions(false); setShowEmojis(false); }}
    >
      {!isMine && <Avatar src={message.sender.avatar} name={message.sender.name} size="sm" />}

      <div className={`max-w-[70%] ${isMine ? 'items-end' : 'items-start'} flex flex-col`}>
        {/* Reply preview */}
        {message.replyTo && (
          <div className="text-xs bg-dark-600/50 border-l-2 border-primary-500 rounded px-2 py-1 mb-1 max-w-full truncate">
            <span className="font-medium text-primary-400">{message.replyTo.sender?.name}</span>
            <span className="text-dark-300 ml-1">{message.replyTo.content}</span>
          </div>
        )}

        <div className={`rounded-2xl px-3.5 py-2 text-sm break-words ${
          isMine ? 'bg-primary-600 text-white rounded-tr-sm' : 'bg-dark-700 text-dark-100 rounded-tl-sm'
        }`}>
          {!isMine && (
            <div className="text-xs font-medium text-primary-400 mb-0.5">{message.sender.displayName || message.sender.name}</div>
          )}
          {renderContent()}
          <div className={`flex items-center gap-1 mt-1 ${isMine ? 'justify-end' : ''}`}>
            <span className="text-[10px] opacity-50">{formatTime(message.createdAt)}</span>
            {isMine && (
              isRead ? <CheckCheck size={14} className="text-blue-300" /> : <Check size={14} className="opacity-50" />
            )}
          </div>
        </div>

        {/* Reactions */}
        {message.reactions.length > 0 && (
          <div className="flex gap-1 mt-0.5 flex-wrap">
            {Object.entries(
              message.reactions.reduce((acc: Record<string, number>, r) => {
                acc[r.emoji] = (acc[r.emoji] || 0) + 1;
                return acc;
              }, {})
            ).map(([emoji, count]) => (
              <button
                key={emoji}
                onClick={() => handleReaction(emoji)}
                className="bg-dark-700 hover:bg-dark-600 rounded-full px-1.5 py-0.5 text-xs flex items-center gap-1"
              >
                {emoji} <span className="text-dark-300">{count as number}</span>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Actions */}
      {showActions && (
        <div className={`flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition ${isMine ? 'flex-row-reverse' : ''}`}>
          <button onClick={() => onReply(message)} className="p-1 hover:bg-dark-700 rounded" title="Ответить">
            <Reply size={14} className="text-dark-400" />
          </button>
          <button onClick={() => setShowEmojis(!showEmojis)} className="p-1 hover:bg-dark-700 rounded relative" title="Реакция">
            <Smile size={14} className="text-dark-400" />
            {showEmojis && (
              <div className="absolute bottom-full mb-1 bg-dark-700 rounded-lg shadow-xl p-2 flex gap-1 z-10">
                {EMOJIS.map((e) => (
                  <button key={e} onClick={() => handleReaction(e)} className="text-lg hover:scale-125 transition">{e}</button>
                ))}
              </div>
            )}
          </button>
        </div>
      )}
    </div>
  );
}
