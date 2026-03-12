import { create } from 'zustand';
import api from '../api/axios';
import type { Chat, Message } from '../types';

interface ChatState {
  chats: Chat[];
  activeChat: Chat | null;
  messages: Message[];
  isLoading: boolean;
  typingUsers: Map<string, Set<string>>;
  loadChats: () => Promise<void>;
  setActiveChat: (chat: Chat | null) => Promise<void>;
  loadMessages: (chatId: string) => Promise<void>;
  addMessage: (message: Message) => void;
  updateTyping: (chatId: string, userId: string, isTyping: boolean) => void;
  updateMessageRead: (chatId: string, messageId: string, userId: string) => void;
  updateMessageReaction: (messageId: string, userId: string, emoji: string, removed: boolean) => void;
  createChat: (type: string, memberIds: string[], name?: string) => Promise<Chat>;
  updateUserOnline: (userId: string, isOnline: boolean) => void;
  updateUnreadCount: (chatId: string) => void;
}

export const useChatStore = create<ChatState>((set, get) => ({
  chats: [],
  activeChat: null,
  messages: [],
  isLoading: false,
  typingUsers: new Map(),

  loadChats: async () => {
    try {
      const { data } = await api.get('/chats');
      set({ chats: data });
    } catch (error) {
      console.error('Load chats error:', error);
    }
  },

  setActiveChat: async (chat) => {
    set({ activeChat: chat, messages: [] });
    if (chat) {
      await get().loadMessages(chat.id);
    }
  },

  loadMessages: async (chatId) => {
    set({ isLoading: true });
    try {
      const { data } = await api.get(`/chats/${chatId}/messages`);
      set({ messages: data, isLoading: false });
    } catch (error) {
      console.error('Load messages error:', error);
      set({ isLoading: false });
    }
  },

  addMessage: (message) => {
    const { activeChat, messages, chats } = get();
    if (activeChat && message.chatId === activeChat.id) {
      set({ messages: [...messages, message] });
    }
    // Update last message in chat list
    set({
      chats: chats.map((c) =>
        c.id === message.chatId
          ? { ...c, messages: [message], updatedAt: message.createdAt }
          : c
      ).sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()),
    });
  },

  updateTyping: (chatId, userId, isTyping) => {
    const typingUsers = new Map(get().typingUsers);
    const chatTyping = typingUsers.get(chatId) || new Set();
    if (isTyping) {
      chatTyping.add(userId);
    } else {
      chatTyping.delete(userId);
    }
    typingUsers.set(chatId, chatTyping);
    set({ typingUsers });
  },

  updateMessageRead: (chatId, messageId, userId) => {
    const { messages, activeChat } = get();
    if (activeChat?.id !== chatId) return;
    set({
      messages: messages.map((m) =>
        m.id === messageId
          ? { ...m, reads: [...m.reads, { userId, readAt: new Date().toISOString() }] }
          : m
      ),
    });
  },

  updateMessageReaction: (messageId, userId, emoji, removed) => {
    set({
      messages: get().messages.map((m) => {
        if (m.id !== messageId) return m;
        if (removed) {
          return {
            ...m,
            reactions: m.reactions.filter(
              (r) => !(r.userId === userId && r.emoji === emoji)
            ),
          };
        }
        return {
          ...m,
          reactions: [
            ...m.reactions,
            { id: '', messageId, userId, emoji, user: { id: userId, name: '' } },
          ],
        };
      }),
    });
  },

  createChat: async (type, memberIds, name) => {
    const { data } = await api.post('/chats', { type, memberIds, name });
    const { chats } = get();
    set({ chats: [data, ...chats] });
    return data;
  },

  updateUserOnline: (userId, isOnline) => {
    set({
      chats: get().chats.map((c) => ({
        ...c,
        members: c.members.map((m) =>
          m.userId === userId ? { ...m, user: { ...m.user, isOnline } } : m
        ),
      })),
    });
  },

  updateUnreadCount: (chatId) => {
    set({
      chats: get().chats.map((c) =>
        c.id === chatId ? { ...c, unreadCount: 0 } : c
      ),
    });
  },
}));
