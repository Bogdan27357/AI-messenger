import Sidebar from '../components/Layout/Sidebar';
import ChatWindow from '../components/Chat/ChatWindow';
import CallModal from '../components/Call/CallModal';
import { useSocket } from '../hooks/useSocket';
import { useCallStore } from '../store/callStore';

export default function ChatPage() {
  useSocket();
  const callStatus = useCallStore((s) => s.status);

  return (
    <div className="h-screen flex bg-dark-900">
      <Sidebar />
      <ChatWindow />
      {callStatus !== 'idle' && (
        <CallModal userName="Собеседник" />
      )}
    </div>
  );
}
