import { useEffect } from 'react';
import { getSocket } from '../api/socket';
import { useChatStore } from '../store/chatStore';
import { useCallStore } from '../store/callStore';
import { useAuthStore } from '../store/authStore';

export function useSocket() {
  const addMessage = useChatStore((s) => s.addMessage);
  const updateTyping = useChatStore((s) => s.updateTyping);
  const updateMessageRead = useChatStore((s) => s.updateMessageRead);
  const updateMessageReaction = useChatStore((s) => s.updateMessageReaction);
  const updateUserOnline = useChatStore((s) => s.updateUserOnline);
  const setIncoming = useCallStore((s) => s.setIncoming);
  const user = useAuthStore((s) => s.user);

  useEffect(() => {
    const socket = getSocket();
    if (!socket) return;

    const onMessage = (message: any) => {
      addMessage(message);
    };

    const onTyping = ({ chatId, userId }: any) => {
      if (userId !== user?.id) updateTyping(chatId, userId, true);
    };

    const onTypingStop = ({ chatId, userId }: any) => {
      updateTyping(chatId, userId, false);
    };

    const onRead = ({ chatId, messageId, userId }: any) => {
      updateMessageRead(chatId, messageId, userId);
    };

    const onReaction = ({ chatId, messageId, userId, emoji, removed }: any) => {
      updateMessageReaction(messageId, userId, emoji, removed);
    };

    const onUserOnline = ({ userId }: any) => {
      updateUserOnline(userId, true);
    };

    const onUserOffline = ({ userId }: any) => {
      updateUserOnline(userId, false);
    };

    const onCallIncoming = ({ callerId, type }: any) => {
      setIncoming(callerId, type);
    };

    socket.on('chat:message', onMessage);
    socket.on('chat:typing', onTyping);
    socket.on('chat:typing:stop', onTypingStop);
    socket.on('chat:read', onRead);
    socket.on('chat:reaction', onReaction);
    socket.on('user:online', onUserOnline);
    socket.on('user:offline', onUserOffline);
    socket.on('call:incoming', onCallIncoming);

    return () => {
      socket.off('chat:message', onMessage);
      socket.off('chat:typing', onTyping);
      socket.off('chat:typing:stop', onTypingStop);
      socket.off('chat:read', onRead);
      socket.off('chat:reaction', onReaction);
      socket.off('user:online', onUserOnline);
      socket.off('user:offline', onUserOffline);
      socket.off('call:incoming', onCallIncoming);
    };
  }, [user?.id]);
}
