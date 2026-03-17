import React from 'react';
import { getInitials } from '../utils/format';

const AVATAR_COLORS = [
  '#e17076', '#eda86c', '#a695e7', '#7bc862',
  '#6ec9cb', '#65aadd', '#ee7aae', '#e0a060',
];

function getColorForId(id) {
  return AVATAR_COLORS[(id || 0) % AVATAR_COLORS.length];
}

export default function UserAvatar({ user, size = 42, className = '' }) {
  const sizeClass = size <= 26 ? 'tiny' : size <= 34 ? 'small' : size >= 80 ? 'large' : '';
  const style = { width: size, height: size, fontSize: Math.round(size * 0.36) };

  if (user?.avatar) {
    return (
      <div className={`user-avatar ${sizeClass} ${className}`} style={style}>
        <img src={user.avatar} alt="" />
        {user.status === 'online' && size >= 34 && <span className="online-dot" />}
      </div>
    );
  }

  const name = user?.full_name || user?.name || '?';
  const bg = getColorForId(user?.id);

  return (
    <div
      className={`user-avatar initials ${sizeClass} ${className}`}
      style={{ ...style, background: bg }}
    >
      {getInitials(name)}
      {user?.status === 'online' && size >= 34 && <span className="online-dot" />}
    </div>
  );
}

export function GroupAvatar({ size = 42, name, className = '' }) {
  const sizeClass = size <= 26 ? 'tiny' : size <= 34 ? 'small' : size >= 80 ? 'large' : '';
  const style = { width: size, height: size, fontSize: Math.round(size * 0.4) };

  return (
    <div className={`user-avatar group ${sizeClass} ${className}`} style={style}>
      <svg viewBox="0 0 24 24" fill="currentColor" width={Math.round(size * 0.55)} height={Math.round(size * 0.55)}>
        <path d="M16 11c1.66 0 2.99-1.34 2.99-3S17.66 5 16 5c-1.66 0-3 1.34-3 3s1.34 3 3 3zm-8 0c1.66 0 2.99-1.34 2.99-3S9.66 5 8 5C6.34 5 5 6.34 5 8s1.34 3 3 3zm0 2c-2.33 0-7 1.17-7 3.5V19h14v-2.5c0-2.33-4.67-3.5-7-3.5zm8 0c-.29 0-.62.02-.97.05 1.16.84 1.97 1.97 1.97 3.45V19h6v-2.5c0-2.33-4.67-3.5-7-3.5z"/>
      </svg>
    </div>
  );
}
