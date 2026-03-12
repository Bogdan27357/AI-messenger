export interface User {
  id: string;
  email: string;
  name: string;
  displayName?: string | null;
  avatar?: string | null;
  role: 'ADMIN' | 'USER';
  isOnline: boolean;
  lastSeen?: string;
  createdAt?: string;
}

export interface Chat {
  id: string;
  type: 'DIRECT' | 'GROUP';
  name?: string | null;
  avatar?: string | null;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
  members: ChatMember[];
  messages?: Message[];
  unreadCount?: number;
}

export interface ChatMember {
  id: string;
  chatId: string;
  userId: string;
  role: 'OWNER' | 'ADMIN' | 'MEMBER';
  user: User;
}

export interface Message {
  id: string;
  chatId: string;
  senderId: string;
  type: MessageType;
  content?: string | null;
  fileUrl?: string | null;
  fileName?: string | null;
  fileSize?: number | null;
  duration?: number | null;
  replyToId?: string | null;
  replyTo?: Message | null;
  isForwarded: boolean;
  isEdited: boolean;
  isDeleted: boolean;
  createdAt: string;
  sender: User;
  reactions: Reaction[];
  reads: MessageRead[];
}

export type MessageType = 'TEXT' | 'IMAGE' | 'VIDEO' | 'VOICE' | 'VIDEO_CIRCLE' | 'FILE' | 'SYSTEM';

export interface Reaction {
  id: string;
  messageId: string;
  userId: string;
  emoji: string;
  user: { id: string; name: string };
}

export interface MessageRead {
  userId: string;
  readAt: string;
}

export interface KnowledgeDoc {
  id: string;
  title: string;
  content?: string | null;
  fileUrl?: string | null;
  fileName?: string | null;
  uploadedBy: string;
  uploader?: { id: string; name: string };
  createdAt: string;
}
