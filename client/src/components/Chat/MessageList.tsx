import { useEffect, useRef } from 'react';
import { useChatStore } from '../../store/chatStore';
import { useAuthStore } from '../../store/authStore';
import { getSocket } from '../../api/socket';
import MessageItem from './MessageItem';
import type { Message } from '../../types';

interface Props {
  onReply: (msg: Message) => void;
}

export default function MessageList({ onReply }: Props) {
  const messages = useChatStore((s) => s.messages);
  const activeChat = useChatStore((s) => s.activeChat);
  const isLoading = useChatStore((s) => s.isLoading);
  const user = useAuthStore((s) => s.user);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages.length]);

  // Mark messages as read
  useEffect(() => {
    if (!activeChat || !messages.length) return;
    const socket = getSocket();
    if (!socket) return;

    const unread = messages.filter(
      (m) => m.senderId !== user?.id && !m.reads?.some((r) => r.userId === user?.id)
    );
    unread.forEach((m) => {
      socket.emit('chat:read', { chatId: activeChat.id, messageId: m.id });
    });
  }, [messages, activeChat?.id, user?.id]);

  if (isLoading) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="text-dark-400">Загрузка сообщений...</div>
      </div>
    );
  }

  if (!messages.length) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="text-center text-dark-400">
          <p className="text-lg mb-1">Нет сообщений</p>
          <p className="text-sm">Начните общение прямо сейчас!</p>
        </div>
      </div>
    );
  }

  // Group messages by date
  const grouped: { date: string; messages: Message[] }[] = [];
  let currentDate = '';
  messages.forEach((msg) => {
    const date = new Date(msg.createdAt).toLocaleDateString('ru-RU', {
      day: 'numeric', month: 'long', year: 'numeric',
    });
    if (date !== currentDate) {
      currentDate = date;
      grouped.push({ date, messages: [msg] });
    } else {
      grouped[grouped.length - 1].messages.push(msg);
    }
  });

  return (
    <div className="flex-1 overflow-y-auto py-2">
      {grouped.map((group) => (
        <div key={group.date}>
          <div className="flex items-center justify-center my-3">
            <span className="bg-dark-700/80 text-dark-300 text-xs px-3 py-1 rounded-full">
              {group.date}
            </span>
          </div>
          {group.messages.map((msg) => (
            <MessageItem key={msg.id} message={msg} onReply={onReply} />
          ))}
        </div>
      ))}
      <div ref={bottomRef} />
    </div>
  );
}
