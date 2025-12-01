# Debug Guide: Messages Not Showing

## Messages are sent via WebSocket, NOT HTTP

**Important**: When you send a message, you won't see an HTTP/API request in the Network tab. Messages use WebSocket protocol.

## How to Debug

### 1. Check WebSocket Connection

In Chrome/Firefox DevTools:

1. Open DevTools (F12)
2. Go to **Network** tab
3. Click **WS** filter (WebSocket)
4. Refresh the page
5. You should see a connection to `ws://localhost:3002/ws`
6. Click on it to see frames (messages) being sent/received

### 2. Check Browser Console

Open the Console tab and look for:

- `[ChatPage] Initializing chat`
- `[WebSocketClient] sendChatMessage:` - when you send a message
- `[WebSocketClient] Sending message via WS:` - when message goes over the wire
- `[handleRealtimeEvent] Received event:` - when events come back

### 3. Check Server Logs

In your server terminal, you should see:

- `WebSocket authenticated: <username> (<userId>)`
- `Subscribed to room: <roomId>`
- `Message sent to room <roomId>: ...`

### 4. Checklist Before Sending Message

- [ ] Are you logged in? (Can you see your username at bottom of sidebar?)
- [ ] Do you see channels in the sidebar?
- [ ] Is a channel **selected** (highlighted with blue background)?
- [ ] Does connection status show **"Connected"** in green in top-right?
- [ ] Is the input field enabled (not grayed out)?

### 5. Common Issues

#### Issue: Connection status shows "Disconnected"

- WebSocket isn't connecting
- Check server is running on port 3002
- Check browser console for WebSocket errors

#### Issue: No rooms/channels visible

- Rooms aren't loading from API
- Check Network tab for HTTP request to `/api/rooms`
- Check browser console for errors

#### Issue: Can type but message doesn't appear

- WebSocket might not be subscribed to room
- Check browser console for subscription messages
- Check server logs for "Subscribed to room" message

#### Issue: Message appears for sender but not other users

- RealTimeBus might not be broadcasting
- Check server logs for "Message sent to room" message
- Check if other user is subscribed to same room

### 6. Manual Test Steps

1. **Login** on two different browsers (or incognito window)
2. **Create a channel** (e.g., "test-room")
3. **Select the channel** in both browsers
4. **Check connection status** is "Connected" in both
5. **Type and send** a message from Browser 1
6. **Check Browser 1** - message should appear immediately
7. **Check Browser 2** - message should appear in real-time

### 7. WebSocket Frame Inspection

In the WS tab of DevTools, you should see frames like:

**Sent (Browser → Server)**:

```json
{"type": "auth", "token": "..."}
{"type": "subscribe", "roomId": "..."}
{"type": "message.send", "roomId": "...", "content": "Hello"}
```

**Received (Server → Browser)**:

```json
{"type": "authenticated", "userId": "...", "username": "..."}
{"type": "subscribed", "roomId": "..."}
{"type": "event", "event": {"type": "message.created", "message": {...}}}
```

## Next Steps

If messages still don't work after checking all above:

1. Share browser console logs
2. Share server logs
3. Share WebSocket frames from DevTools
