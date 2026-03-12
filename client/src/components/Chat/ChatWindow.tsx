import { useState } from 'react';
import { useChatStore } from '../../store/chatStore';
import { useAuthStore } from '../../store/authStore';
import { useWebRTC } from '../../hooks/useWebRTC';
import MessageList from './MessageList';
import AIChat from '../AI/AIChat';
import MessageInput from './MessageInput';
import Avatar from '../User/Avatar';
import type { Message } from '../../types';
import { Phone, Video, Search, MoreVertical, Users } from 'lucide-react';

export default function ChatWindow() {
  const activeChat = useChatStore((s) => s.activeChat);
  const typingUsers = useChatStore((s) => s.typingUsers);
  const user = useAuthStore((s) => s.user);
  const [replyTo, setReplyTo] = useState<Message | null>(null);
  const { initiateCall } = useWebRTC();

  if (!activeChat) {
    return (
      <div className="flex-1 flex items-center justify-center bg-dark-900">
        <div className="text-center text-dark-400">
          <div className="text-6xl mb-4">💬</div>
          <p className="text-xl font-medium">AI Messenger</p>
          <p className="text-sm mt-2">Выберите чат для начала общения</p>
        </div>
      </div>
    );
  }

  // AI Assistant special chat
  if (activeChat.id === 'ai-assistant') {
    return <AIChat />;
  }

  const isGroup = activeChat.type === 'GROUP';
  const otherMember = !isGroup ? activeChat.members?.find((m) => m.userId !== user?.id) : null;
  const chatName = isGroup ? activeChat.name : (otherMember?.user?.displayName || otherMember?.user?.name || 'Чат');
  const chatAvatar = isGroup ? activeChat.avatar : otherMember?.user?.avatar;
  const isOnline = otherMember?.user?.isOnline;

  const chatTyping = typingUsers.get(activeChat.id);
  const typingList = chatTyping ? Array.from(chatTyping) : [];

  return (
    <div className="flex-1 flex flex-col bg-dark-900 h-full">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-dark-700 bg-dark-800">
        <div className="flex items-center gap-3">
          <Avatar src={chatAvatar} name={chatName || ''} isOnline={!isGroup ? isOnline : undefined} />
          <div>
            <div className="font-medium text-white text-sm">{chatName}</div>
            <div className="text-xs text-dark-400">
              {typingList.length > 0 ? (
                <span className="text-primary-400">печатает...</span>
              ) : isGroup ? (
                `${activeChat.members?.length || 0} участников`
              ) : isOnline ? (
                <span className="text-green-400">в сети</span>
              ) : (
                'не в сети'
              )}
            </div>
          </div>
        </div>
        <div className="flex items-center gap-1">
          {!isGroup && otherMember && (
            <>
              <button
                onClick={() => initiateCall(otherMember.userId, 'voice')}
                className="p-2 hover:bg-dark-700 rounded-lg transition"
                title="Голосовой звонок"
              >
                <Phone size={18} className="text-dark-300" />
              </button>
              <button
                onClick={() => initiateCall(otherMember.userId, 'video')}
                className="p-2 hover:bg-dark-700 rounded-lg transition"
                title="Видеозвонок"
              >
                <Video size={18} className="text-dark-300" />
              </button>
            </>
          )}
          <button className="p-2 hover:bg-dark-700 rounded-lg transition">
            <Search size={18} className="text-dark-300" />
          </button>
        </div>
      </div>

      {/* Messages */}
      <MessageList onReply={setReplyTo} />

      {/* Input */}
      <MessageInput chatId={activeChat.id} replyTo={replyTo} onClearReply={() => setReplyTo(null)} />
    </div>
  );
}
