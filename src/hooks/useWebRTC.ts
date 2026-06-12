import { useEffect, useRef, useState, useCallback } from 'react';
import { socketService } from '@/lib/socket';
import { useUserStore } from '@/store/useUserStore';
import { useVoiceStore } from '@/store/useVoiceStore';

interface WebRTCUser {
  userId: string;
  nickname: string;
}

export function useWebRTC() {
  const { id: myUserId, nickname: myNickname } = useUserStore();
  const { connectedChannelId, isMuted, disconnect } = useVoiceStore();

  const [connectedUsers, setConnectedUsers] = useState<WebRTCUser[]>([]);
  const [globalVoiceUsers, setGlobalVoiceUsers] = useState<WebRTCUser[]>([]);
  const [activeSpeakers, setActiveSpeakers] = useState<string[]>([]);
  const [streams, setStreams] = useState<Record<string, MediaStream>>({});

  const localStreamRef = useRef<MediaStream | null>(null);
  const peersRef = useRef<Record<string, RTCPeerConnection>>({});
  const audioContextsRef = useRef<Record<string, AudioContext>>({});
  const analyzersRef = useRef<Record<string, AnalyserNode>>({});
  const rafRefs = useRef<Record<string, number>>({});

  const ICE_SERVERS = {
    iceServers: [
      { urls: 'stun:stun.l.google.com:19302' },
      { urls: 'stun:stun1.l.google.com:19302' }
    ]
  };

  const getSocket = () => socketService.getSocket();

  // Handle Mute/Unmute
  useEffect(() => {
    if (localStreamRef.current) {
      localStreamRef.current.getAudioTracks().forEach(track => {
        track.enabled = !isMuted;
      });
    }
  }, [isMuted]);

  // Speaking Detection
  const setupSpeakingDetection = (userId: string, stream: MediaStream) => {
    try {
      const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
      const analyser = audioCtx.createAnalyser();
      analyser.fftSize = 512;
      analyser.smoothingTimeConstant = 0.4;
      
      const source = audioCtx.createMediaStreamSource(stream);
      source.connect(analyser);

      audioContextsRef.current[userId] = audioCtx;
      analyzersRef.current[userId] = analyser;

      const dataArray = new Uint8Array(analyser.frequencyBinCount);

      const checkVolume = () => {
        analyser.getByteFrequencyData(dataArray);
        let sum = 0;
        for (let i = 0; i < dataArray.length; i++) {
          sum += dataArray[i];
        }
        const average = sum / dataArray.length;

        setActiveSpeakers(prev => {
          const isSpeaking = average > 15; // Threshold
          if (isSpeaking && !prev.includes(userId)) {
            return [...prev, userId];
          } else if (!isSpeaking && prev.includes(userId)) {
            return prev.filter(id => id !== userId);
          }
          return prev;
        });

        rafRefs.current[userId] = requestAnimationFrame(checkVolume);
      };

      checkVolume();
    } catch (err) {
      console.warn("AudioContext error", err);
    }
  };

  const cleanupPeer = (userId: string) => {
    if (peersRef.current[userId]) {
      peersRef.current[userId].close();
      delete peersRef.current[userId];
    }
    if (rafRefs.current[userId]) {
      cancelAnimationFrame(rafRefs.current[userId]);
      delete rafRefs.current[userId];
    }
    if (audioContextsRef.current[userId]) {
      audioContextsRef.current[userId].close();
      delete audioContextsRef.current[userId];
      delete analyzersRef.current[userId];
    }

    setConnectedUsers(prev => prev.filter(u => u.userId !== userId));
    setActiveSpeakers(prev => prev.filter(id => id !== userId));
    setStreams(prev => {
      const newStreams = { ...prev };
      delete newStreams[userId];
      return newStreams;
    });
  };

  const createPeerConnection = (targetUserId: string, targetSocketId: string, channelId: string) => {
    const pc = new RTCPeerConnection(ICE_SERVERS);
    peersRef.current[targetUserId] = pc;

    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach(track => {
        pc.addTrack(track, localStreamRef.current!);
      });
    }

    pc.onicecandidate = (event) => {
      if (event.candidate) {
        getSocket()?.emit('webrtc_signal', {
          targetSocketId,
          channelId,
          senderId: myUserId,
          signal: { type: 'ice-candidate', candidate: event.candidate }
        });
      }
    };

    pc.ontrack = (event) => {
      if (event.streams && event.streams[0]) {
        const stream = event.streams[0];
        setStreams(prev => ({ ...prev, [targetUserId]: stream }));
        setupSpeakingDetection(targetUserId, stream);
      }
    };

    return pc;
  };

  const connectToVoice = useCallback(async (channelId: string) => {
    if (!myUserId || !myNickname) return;

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
      localStreamRef.current = stream;
      
      // Mute state
      stream.getAudioTracks().forEach(track => {
        track.enabled = !isMuted;
      });

      setupSpeakingDetection(myUserId, stream);

      const socket = getSocket();
      if (!socket) return;

      socket.emit('join_voice', { channelId, userId: myUserId, nickname: myNickname });

    } catch (err: any) {
      console.error("Failed to get local audio", err);
      let errorMsg = "Microphone access denied or not found.";
      if (err.name === 'NotAllowedError') errorMsg = "Microphone permission denied.";
      else if (err.name === 'NotFoundError') errorMsg = "No microphone found.";
      
      const { setVoiceError, disconnect } = useVoiceStore.getState();
      setVoiceError(errorMsg);
      disconnect();
    }
  }, [myUserId, myNickname, isMuted]);

  const disconnectFromVoice = useCallback((channelId: string) => {
    const socket = getSocket();
    if (socket && myUserId) {
      socket.emit('leave_voice', { channelId, userId: myUserId });
    }

    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach(t => t.stop());
      localStreamRef.current = null;
    }

    Object.keys(peersRef.current).forEach(userId => cleanupPeer(userId));
    setConnectedUsers([]);
    setActiveSpeakers([]);
    setStreams({});
  }, [myUserId]);

  useEffect(() => {
    const socket = getSocket();
    if (!socket || !connectedChannelId || !myUserId) return;

    const handleUserJoined = async ({ userId, nickname, socketId }: any) => {
      if (userId === myUserId) return;

      setConnectedUsers(prev => [...prev.filter(u => u.userId !== userId), { userId, nickname }]);

      const pc = createPeerConnection(userId, socketId, connectedChannelId);
      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);

      socket.emit('webrtc_signal', {
        targetSocketId: socketId,
        channelId: connectedChannelId,
        senderId: myUserId,
        signal: { type: 'offer', offer }
      });
    };

    const handleUserLeft = ({ userId }: any) => {
      cleanupPeer(userId);
    };

    const handleWebRTCSignal = async ({ senderSocketId, senderId, signal }: any) => {
      if (senderId === myUserId) return;

      let pc = peersRef.current[senderId];

      if (signal.type === 'offer') {
        if (!pc) {
          pc = createPeerConnection(senderId, senderSocketId, connectedChannelId);
          setConnectedUsers(prev => {
            if (!prev.find(u => u.userId === senderId)) {
              return [...prev, { userId: senderId, nickname: "User" }]; // We'll need a way to get nickname.
            }
            return prev;
          });
        }
        await pc.setRemoteDescription(new RTCSessionDescription(signal.offer));
        const answer = await pc.createAnswer();
        await pc.setLocalDescription(answer);

        socket.emit('webrtc_signal', {
          targetSocketId: senderSocketId,
          channelId: connectedChannelId,
          senderId: myUserId,
          signal: { type: 'answer', answer }
        });
      } else if (signal.type === 'answer') {
        if (pc) {
          await pc.setRemoteDescription(new RTCSessionDescription(signal.answer));
        }
      } else if (signal.type === 'ice-candidate') {
        if (pc && signal.candidate) {
          try {
            await pc.addIceCandidate(new RTCIceCandidate(signal.candidate));
          } catch (e) {
            console.error('Error adding received ice candidate', e);
          }
        }
      }
    };

    socket.on('user_joined_voice', handleUserJoined);
    socket.on('user_left_voice', handleUserLeft);
    socket.on('webrtc_signal', handleWebRTCSignal);

    return () => {
      socket.off('user_joined_voice', handleUserJoined);
      socket.off('user_left_voice', handleUserLeft);
      socket.off('webrtc_signal', handleWebRTCSignal);
    };
  }, [connectedChannelId, myUserId, connectToVoice, disconnectFromVoice]);

  // Handle global connect/disconnect via Store changes
  useEffect(() => {
    if (connectedChannelId) {
      connectToVoice(connectedChannelId);
    } else {
      // If we don't have a channel ID, we might need to leave the previous one.
      // Store doesn't pass prevChannelId cleanly here, so disconnectFromVoice might need the exact ID,
      // but since it clears everything, it's fine.
    }
    
    return () => {
      if (connectedChannelId) disconnectFromVoice(connectedChannelId);
    };
  }, [connectedChannelId, connectToVoice, disconnectFromVoice]);

  // Global listener for lobby participants
  useEffect(() => {
    const socket = getSocket();
    if (!socket) return;

    const handleParticipants = ({ channelId, users }: any) => {
      // Users is an array of { userId, nickname, socketId }
      setGlobalVoiceUsers(users);
    };

    socket.on('voice_channel_participants', handleParticipants);

    return () => {
      socket.off('voice_channel_participants', handleParticipants);
    };
  }, []);

  return {
    connectedUsers,
    globalVoiceUsers,
    activeSpeakers,
    streams,
    localStream: localStreamRef.current
  };
}
