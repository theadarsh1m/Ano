import { io, Socket } from 'socket.io-client';

const getSocketUrl = () => {
  if (process.env.NEXT_PUBLIC_SOCKET_URL) return process.env.NEXT_PUBLIC_SOCKET_URL;
  if (typeof window !== "undefined") return `http://${window.location.hostname}:3001`;
  return "http://localhost:3001";
};
const SOCKET_URL = getSocketUrl();

class SocketService {
  private socket: Socket | null = null;

  connect(customUrl?: string) {
    if (customUrl || !this.socket) {
      if (this.socket) {
        this.socket.disconnect();
      }
      const targetUrl = customUrl || SOCKET_URL;
      this.socket = io(targetUrl, {
        reconnection: true,
        reconnectionAttempts: Infinity,
        reconnectionDelay: 1000,
        reconnectionDelayMax: 5000,
      });

      this.socket.on('connect', () => {
        console.log('Socket connected:', this.socket?.id, 'to:', targetUrl);
      });

      this.socket.on('disconnect', (reason) => {
        console.log('Socket disconnected:', reason);
      });
    }
    return this.socket;
  }

  disconnect() {
    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
    }
  }

  getSocket() {
    // If not connected yet, connect automatically when getting the socket
    if (!this.socket) {
      return this.connect();
    }
    return this.socket;
  }
}

// Singleton instance
export const socketService = new SocketService();
