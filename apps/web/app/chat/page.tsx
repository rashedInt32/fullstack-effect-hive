"use client";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Hash,
  Send,
  Menu,
  Plus,
  MessageSquare,
  Wifi,
  WifiOff,
} from "lucide-react";
import { useEffect, useState, useRef } from "react";
import { useAtomSet, useAtomValue } from "@effect-atom/atom-react";
import { authAtom, initializeAuthAtom } from "@/lib/api/atoms/auth";
import {
  chatAtom,
  createRoomAtom,
  initializeChatAtom,
  selectRoomAtom,
  sendMessageAtom,
  sendTypingAtom,
} from "@/lib/api/atoms/chat";
import { useRouter } from "next/navigation";

export default function ChatPage() {
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [newChannelName, setNewChannelName] = useState("");
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [messageInput, setMessageInput] = useState("");
  const chatInitializedRef = useRef(false);
  const router = useRouter();

  const authState = useAtomValue(authAtom);
  const initializeAuth = useAtomSet(initializeAuthAtom);

  const chatState = useAtomValue(chatAtom);
  const initializeChat = useAtomSet(initializeChatAtom);
  const selectRoom = useAtomSet(selectRoomAtom);
  const sendMessage = useAtomSet(sendMessageAtom);
  const sendTyping = useAtomSet(sendTypingAtom);
  const createRoom = useAtomSet(createRoomAtom);

  useEffect(() => {
    initializeAuth();
  }, [initializeAuth]);

  useEffect(() => {
    if (
      authState.initialized &&
      !authState.loading &&
      !authState.isAuthenticated &&
      authState.user === null
    ) {
      router.push("/login");
    }
  }, [
    authState.loading,
    authState.isAuthenticated,
    authState.user,
    authState.initialized,
    router,
  ]);

  useEffect(() => {
    if (
      !chatInitializedRef.current &&
      authState.initialized &&
      authState.isAuthenticated &&
      authState.user
    ) {
      console.log("[ChatPage] Initializing chat (first time)");
      chatInitializedRef.current = true;
      initializeChat(undefined);
    }
  }, [
    initializeChat,
    authState.initialized,
    authState.isAuthenticated,
    authState.user,
  ]);

  console.log(chatState);

  const activeRoom = chatState.rooms.find(
    (r) => r.id === chatState.activeRoomId,
  );
  const activeMessages = chatState.activeRoomId
    ? chatState.messagesByRoom[chatState.activeRoomId] || []
    : [];

  const channels = chatState.rooms.filter((r) => r.type === "channel");
  const directMessages = chatState.rooms.filter((r) => r.type === "dm");

  const activeTypingUsers = chatState.activeRoomId
    ? Object.values(
        chatState.typingIndicators[chatState.activeRoomId] || {},
      ).filter((user) => user.expiresAt > Date.now())
    : [];

  const handleSendMessage = () => {
    if (!messageInput.trim()) return;

    console.log(
      "[handleSendMessage] Sending:",
      messageInput,
      "to room:",
      chatState.activeRoomId,
    );
    console.log("[handleSendMessage] WS Status:", chatState.wsStatus);

    sendMessage(messageInput);
    setMessageInput("");
    sendTyping(false);
  };

  const handleTyping = (value: string) => {
    setMessageInput(value);
    if (value.length > 0) {
      sendTyping(true);
    } else {
      sendTyping(false);
    }
  };

  const formatTime = (date: Date) => {
    return new Date(date).toLocaleTimeString("en-US", {
      hour: "numeric",
      minute: "2-digit",
    });
  };

  const getInitials = (username: string) => {
    return username
      .split(" ")
      .map((n) => n[0])
      .join("")
      .toUpperCase();
  };

  const getConnectionStatusColor = () => {
    switch (chatState.wsStatus) {
      case "authenticated":
        return "text-green-500";
      case "connecting":
      case "authenticating":
        return "text-yellow-500";
      case "error":
        return "text-red-500";
      case "disconnected":
      default:
        return "text-gray-500";
    }
  };

  const getConnectionStatusText = () => {
    switch (chatState.wsStatus) {
      case "authenticated":
        return "Connected";
      case "connecting":
        return "Connecting...";
      case "authenticating":
        return "Authenticating...";
      case "error":
        return "Connection error";
      case "disconnected":
      default:
        return "Disconnected";
    }
  };

  return (
    <div className="h-screen flex bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950">
      {sidebarOpen && (
        <div className="w-60 bg-slate-900/50 backdrop-blur-xl border-r border-slate-800 flex flex-col">
          <div className="h-14 flex items-center px-4 border-b border-slate-800">
            <h2 className="font-semibold text-lg">Workspace</h2>
          </div>

          <div className="flex-1 overflow-y-auto">
            <div className="p-2">
              <div className="flex items-center justify-between px-2 py-1 mb-1">
                <span className="text-sm font-semibold text-muted-foreground">
                  Channels
                </span>
                <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
                  <DialogTrigger asChild>
                    <Button variant="ghost" size="icon" className="h-6 w-6">
                      <Plus className="h-4 w-4" />
                    </Button>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>Create New Channel</DialogTitle>
                      <DialogDescription>
                        Add a new channel to your workspace.
                      </DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4 py-4">
                      <div className="space-y-2">
                        <Label htmlFor="channel-name">Channel Name</Label>
                        <Input
                          id="channel-name"
                          placeholder="e.g. marketing"
                          value={newChannelName}
                          onChange={(e) => setNewChannelName(e.target.value)}
                        />
                      </div>
                    </div>
                    <DialogFooter>
                      <Button
                        variant="outline"
                        onClick={() => setIsDialogOpen(false)}
                      >
                        Cancel
                      </Button>
                      <Button
                        onClick={() => {
                          if (newChannelName.trim()) {
                            createRoom(newChannelName.trim());
                          }
                          setIsDialogOpen(false);
                          setNewChannelName("");
                        }}
                      >
                        Create Channel
                      </Button>
                    </DialogFooter>
                  </DialogContent>
                </Dialog>
              </div>

              {channels.map((channel) => (
                <button
                  key={channel.id}
                  onClick={() => selectRoom(channel.id)}
                  className={`w-full flex items-center justify-between px-2 py-1.5 rounded hover:bg-accent/50 ${
                    chatState.activeRoomId === channel.id ? "bg-accent" : ""
                  }`}
                >
                  <div className="flex items-center gap-1.5">
                    <Hash className="h-4 w-4" />
                    <span className="text-sm">{channel.name}</span>
                  </div>
                </button>
              ))}
            </div>

            <Separator className="my-2" />

            <div className="p-2">
              <div className="px-2 py-1 mb-1">
                <span className="text-sm font-semibold text-muted-foreground">
                  Direct Messages
                </span>
              </div>

              {directMessages.map((dm) => (
                <button
                  key={dm.id}
                  onClick={() => selectRoom(dm.id)}
                  className={`w-full flex items-center gap-2 px-2 py-1.5 rounded hover:bg-accent/50 ${
                    chatState.activeRoomId === dm.id ? "bg-accent" : ""
                  }`}
                >
                  <Avatar className="h-6 w-6">
                    <AvatarFallback>{getInitials(dm.name)}</AvatarFallback>
                  </Avatar>
                  <span className="text-sm">{dm.name}</span>
                </button>
              ))}
            </div>
          </div>

          <div className="p-2 pt-3 border-t border-slate-800">
            <div className="flex items-center gap-2 px-2 py-1.5">
              <Avatar className="h-8 w-8">
                <AvatarImage src="/avatars/you.jpg" />
                <AvatarFallback>YO</AvatarFallback>
              </Avatar>
              <div className="flex-1 min-w-0">
                <div className="text-sm font-medium truncate">
                  {authState.user?.username}
                </div>
                <div className="text-xs text-muted-foreground">Online</div>
              </div>
            </div>
          </div>
        </div>
      )}

      <div className="flex-1 flex flex-col">
        <div className="h-14 border-b border-slate-800 flex items-center px-4 gap-2">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setSidebarOpen(!sidebarOpen)}
          >
            <Menu className="h-5 w-5" />
          </Button>
          {activeRoom && (
            <>
              <Hash className="h-5 w-5 text-muted-foreground" />
              <h1 className="font-semibold">{activeRoom.name}</h1>
            </>
          )}
          <div className="ml-auto flex items-center gap-2">
            <div
              className={`flex items-center gap-1.5 text-xs ${getConnectionStatusColor()}`}
            >
              <div className="w-2 h-2 rounded-full bg-current animate-pulse" />
              <span>{getConnectionStatusText()}</span>
            </div>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {activeMessages.length === 0 ? (
            <div className="flex items-center justify-center h-full text-muted-foreground">
              {activeRoom
                ? "No messages yet"
                : "Select a room to start chatting"}
            </div>
          ) : (
            activeMessages.map((message) => (
              <div
                key={message.id}
                className="flex gap-3 hover:bg-accent/50 -mx-2 px-2 py-1 rounded"
              >
                <Avatar className="h-10 w-10">
                  <AvatarFallback>
                    {getInitials(message.username)}
                  </AvatarFallback>
                </Avatar>
                <div className="flex-1">
                  <div className="flex items-baseline gap-2">
                    <span className="font-semibold text-sm">
                      {message.username}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      {formatTime(message.created_at)}
                    </span>
                  </div>
                  <p className="text-sm mt-1">{message.content}</p>
                </div>
              </div>
            ))
          )}
        </div>

        <div className="p-4 border-t border-slate-800">
          {activeTypingUsers.length > 0 && (
            <div className="mb-2 text-xs text-muted-foreground italic px-1">
              {activeTypingUsers.length === 1
                ? `${activeTypingUsers[0]?.username} is typing...`
                : activeTypingUsers.length === 2
                  ? `${activeTypingUsers[0]?.username} and ${activeTypingUsers[1]?.username} are typing...`
                  : `${activeTypingUsers.length} people are typing...`}
            </div>
          )}
          <div className="flex gap-2">
            <Input
              value={messageInput}
              onChange={(e) => handleTyping(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  handleSendMessage();
                }
              }}
              placeholder={
                activeRoom ? `Message #${activeRoom.name}` : "Select a room"
              }
              className="flex-1"
              disabled={!activeRoom}
            />
            <Button
              size="icon"
              onClick={handleSendMessage}
              disabled={!activeRoom}
            >
              <Send className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
