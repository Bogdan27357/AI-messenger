"use client";

import { Bot, User } from "lucide-react";
import { SourceBadge } from "./SourceBadge";

interface MessageBubbleProps {
  message: {
    role: "user" | "assistant";
    content: string;
    sources?: { text: string; score: number }[];
  };
}

export function MessageBubble({ message }: MessageBubbleProps) {
  const isUser = message.role === "user";

  return (
    <div className={`flex gap-3 ${isUser ? "justify-end" : "justify-start"}`}>
      {!isUser && (
        <div className="w-8 h-8 bg-accent-purple/20 rounded-full flex items-center justify-center flex-shrink-0">
          <Bot className="w-4 h-4 text-accent-purple" />
        </div>
      )}
      <div
        className={`max-w-[75%] ${
          isUser
            ? "bg-accent-blue/20 border-accent-blue/30"
            : "bg-bg-card border-bg-card"
        } border rounded-xl px-4 py-3`}
      >
        <p className="text-sm text-text-primary whitespace-pre-wrap">
          {message.content}
        </p>
        {message.sources && message.sources.length > 0 && (
          <div className="mt-2 flex flex-wrap gap-1">
            {message.sources.map((s, i) => (
              <SourceBadge key={i} text={s.text} score={s.score} />
            ))}
          </div>
        )}
      </div>
      {isUser && (
        <div className="w-8 h-8 bg-accent-blue/20 rounded-full flex items-center justify-center flex-shrink-0">
          <User className="w-4 h-4 text-accent-blue" />
        </div>
      )}
    </div>
  );
}
