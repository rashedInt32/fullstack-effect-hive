"use client";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import { Hash, Send, Menu, Plus } from "lucide-react";
import { useState } from "react";

const channels = [
  { id: 1, name: "general", unread: 0 },
  { id: 2, name: "random", unread: 3 },
  { id: 3, name: "development", unread: 0 },
  { id: 4, name: "design", unread: 1 },
];

const dummyMessages = [
  {
    id: 1,
    user: "Alice Johnson",
    avatar: "/avatars/alice.jpg",
    time: "10:30 AM",
    content: "Hey everyone! How's the project going?",
  },
  {
    id: 2,
    user: "Bob Smith",
    avatar: "/avatars/bob.jpg",
    time: "10:32 AM",
    content: "Pretty good! Just finished the authentication module.",
  },
  {
    id: 3,
    user: "Charlie Davis",
    avatar: "/avatars/charlie.jpg",
    time: "10:35 AM",
    content: "Nice work! I'm working on the UI components now.",
  },
  {
    id: 4,
    user: "Alice Johnson",
    avatar: "/avatars/alice.jpg",
    time: "10:38 AM",
    content: "Awesome! Let me know if you need any help with the design.",
  },
  {
    id: 5,
    user: "Diana Prince",
    avatar: "/avatars/diana.jpg",
    time: "10:45 AM",
    content: "I'll start working on the backend API integration today.",
  },
  {
    id: 6,
    user: "Bob Smith",
    avatar: "/avatars/bob.jpg",
    time: "10:50 AM",
    content: "Sounds great! We should have a standup meeting this afternoon.",
  },
];

export default function ChatPage() {
  const [selectedChannel, setSelectedChannel] = useState(channels[0]!);
  const [sidebarOpen, setSidebarOpen] = useState(true);

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
                <Button variant="ghost" size="icon" className="h-6 w-6">
                  <Plus className="h-4 w-4" />
                </Button>
              </div>

              {channels.map((channel) => (
                <button
                  key={channel.id}
                  onClick={() => setSelectedChannel(channel)}
                  className={`w-full flex items-center justify-between px-2 py-1.5 rounded hover:bg-accent/50 ${
                    selectedChannel.id === channel.id ? "bg-accent" : ""
                  }`}
                >
                  <div className="flex items-center gap-1.5">
                    <Hash className="h-4 w-4" />
                    <span className="text-sm">{channel.name}</span>
                  </div>
                  {channel.unread > 0 && (
                    <span className="bg-primary text-primary-foreground text-xs rounded-full px-1.5 py-0.5 min-w-5 text-center">
                      {channel.unread}
                    </span>
                  )}
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

              <button className="w-full flex items-center gap-2 px-2 py-1.5 rounded hover:bg-accent/50">
                <Avatar className="h-6 w-6">
                  <AvatarImage src="/avatars/alice.jpg" />
                  <AvatarFallback>AJ</AvatarFallback>
                </Avatar>
                <span className="text-sm">Alice Johnson</span>
              </button>

              <button className="w-full flex items-center gap-2 px-2 py-1.5 rounded hover:bg-accent/50">
                <Avatar className="h-6 w-6">
                  <AvatarImage src="/avatars/bob.jpg" />
                  <AvatarFallback>BS</AvatarFallback>
                </Avatar>
                <span className="text-sm">Bob Smith</span>
              </button>
            </div>
          </div>

          <div className="p-2 border-t border-slate-800">
            <div className="flex items-center gap-2 px-2 py-1.5">
              <Avatar className="h-8 w-8">
                <AvatarImage src="/avatars/you.jpg" />
                <AvatarFallback>YO</AvatarFallback>
              </Avatar>
              <div className="flex-1 min-w-0">
                <div className="text-sm font-medium truncate">Your Name</div>
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
          <Hash className="h-5 w-5 text-muted-foreground" />
          <h1 className="font-semibold">{selectedChannel.name}</h1>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {dummyMessages.map((message) => (
            <div
              key={message.id}
              className="flex gap-3 hover:bg-accent/50 -mx-2 px-2 py-1 rounded"
            >
              <Avatar className="h-10 w-10">
                <AvatarImage src={message.avatar} />
                <AvatarFallback>
                  {message.user
                    .split(" ")
                    .map((n) => n[0])
                    .join("")}
                </AvatarFallback>
              </Avatar>
              <div className="flex-1">
                <div className="flex items-baseline gap-2">
                  <span className="font-semibold text-sm">{message.user}</span>
                  <span className="text-xs text-muted-foreground">
                    {message.time}
                  </span>
                </div>
                <p className="text-sm mt-1">{message.content}</p>
              </div>
            </div>
          ))}
        </div>

        <div className="p-4 border-t border-slate-800">
          <div className="flex gap-2">
            <Input
              placeholder={`Message #${selectedChannel.name}`}
              className="flex-1"
            />
            <Button size="icon">
              <Send className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
