import React from 'react';
import { 
  UserPlus, 
  UserCheck, 
  MessageSquare, 
  MessageCircle, 
  Heart, 
  AtSign, 
  Gamepad2, 
  Megaphone, 
  Bell 
} from 'lucide-react';
import { AppNotification } from '@/store/useNotificationStore';

export interface NotificationDetails {
  destination: string;
  title: string;
  description: string;
  iconName: string;
  icon: React.ComponentType<{ className?: string }>;
  sender?: {
    id: string;
    nickname: string;
    avatar: string | null;
  };
}

/**
 * Maps gameType and gameId/lobbyId to the exact destination URL.
 */
export function resolveGameRoute(gameType?: string, gameId?: string): string {
  if (!gameType) {
    return gameId ? `/dashboard/games?gameId=${gameId}` : '/dashboard/games';
  }

  const normalized = gameType.toLowerCase().replace(/_/g, '-');
  const gameMap: Record<string, string> = {
    'flappy-bird': 'flappy-bird',
    'flappybird': 'flappy-bird',
    'bluff': 'bluff',
    'memory-match': 'memory-match',
    'memorymatch': 'memory-match',
    'dots-and-boxes': 'dots-and-boxes',
    'dotsandboxes': 'dots-and-boxes',
    'color-wars': 'color-wars',
    'colorwars': 'color-wars',
    'scribble': 'scribble',
    'ink-deception': 'ink-deception',
    'inkdeception': 'ink-deception',
    'chamber-clash': 'chamber-clash',
    'chamberclash': 'chamber-clash',
    'car-racing': 'car-racing',
    'carracing': 'car-racing',
    'brainrot-stack': 'brainrot-stack',
    'brainrotstack': 'brainrot-stack',
    'number-hunt': 'number-hunt',
    'numberhunt': 'number-hunt',
    '2048': '2048',
    'minesweeper': 'minesweeper',
  };

  const slug = gameMap[normalized] || normalized;
  return gameId ? `/dashboard/games/${slug}?gameId=${gameId}` : `/dashboard/games/${slug}`;
}

/**
 * Resolves destination URL, icon, title, and formatted description from an AppNotification object.
 */
export function getNotificationDetails(notification: AppNotification): NotificationDetails {
  let { type, title, message, sender, metadata } = notification;

  // If metadata is a string, it may have arrived stringified over websocket
  if (typeof metadata === 'string') {
    try {
      metadata = JSON.parse(metadata);
    } catch (e) {
      metadata = {};
    }
  }

  const senderName = sender?.nickname || (metadata?.senderName as string) || 'Someone';
  const metaPostId = metadata?.postId as string | undefined;
  const metaConvId = (metadata?.conversationId as string) || (metadata?.conversation_id as string) || (metadata?.convId as string) || (metadata?.id as string) || undefined;
  const metaGameId = (metadata?.gameId as string) || (metadata?.lobbyId as string) || undefined;
  const metaGameType = (metadata?.gameType as string) || (metadata?.game as string) || undefined;

  switch (type?.toUpperCase()) {
    case 'FRIEND_REQUEST':
    case 'FRIEND_REQUEST_SENT':
      return {
        destination: '/dashboard/notifications',
        title: title || 'Friend Request',
        description: message || `${senderName} sent you a friend request`,
        iconName: 'UserPlus',
        icon: UserPlus,
        sender,
      };

    case 'FRIEND_ACCEPTED':
    case 'FRIEND_ACCEPT':
      return {
        destination: '/dashboard/notifications',
        title: title || 'Friend Request Accepted',
        description: message || `${senderName} accepted your friend request`,
        iconName: 'UserCheck',
        icon: UserCheck,
        sender,
      };

    case 'DM':
    case 'DM_MESSAGE':
    case 'DM_NOTIFICATION':
    case 'DIRECT_MESSAGE':
    case 'DIRECTMESSAGE':
    case 'MESSAGE':
    case 'CHAT':
      return {
        destination: metaConvId ? `/dm/${metaConvId}` : '/dashboard',
        title: title || senderName,
        description: message || 'sent you a private message',
        iconName: 'MessageSquare',
        icon: MessageSquare,
        sender,
      };

    case 'COMMENT_REPLY':
    case 'REPLY':
      return {
        destination: metaPostId ? `/feed/${metaPostId}` : '/dashboard',
        title: title || 'New Reply',
        description: message || `${senderName} replied to your comment`,
        iconName: 'MessageCircle',
        icon: MessageCircle,
        sender,
      };

    case 'POST_LIKE':
    case 'LIKE':
      return {
        destination: metaPostId ? `/feed/${metaPostId}` : '/dashboard',
        title: title || 'New Like',
        description: message || `${senderName} liked your post`,
        iconName: 'Heart',
        icon: Heart,
        sender,
      };

    case 'COMMENT_LIKE':
      return {
        destination: metaPostId ? `/feed/${metaPostId}` : '/dashboard',
        title: title || 'Comment Liked',
        description: message || `${senderName} liked your comment`,
        iconName: 'Heart',
        icon: Heart,
        sender,
      };

    case 'MENTION':
      return {
        destination: metaPostId ? `/feed/${metaPostId}` : (metadata?.roomId ? `/room/${metadata.roomId}` : '/dashboard'),
        title: title || 'You were mentioned',
        description: message || `${senderName} mentioned you`,
        iconName: 'AtSign',
        icon: AtSign,
        sender,
      };

    case 'ROOM_INVITE':
    case 'GAME_INVITE':
    case 'LOBBY_INVITE':
      return {
        destination: metaGameType || metaGameId 
          ? resolveGameRoute(metaGameType, metaGameId)
          : (metadata?.roomId ? `/room/${metadata.roomId}` : '/dashboard/games'),
        title: title || 'Game Invite',
        description: message || `${senderName} invited you to play!`,
        iconName: 'Gamepad2',
        icon: Gamepad2,
        sender,
      };

    case 'MATCH_STARTED':
      return {
        destination: resolveGameRoute(metaGameType, metaGameId),
        title: title || 'Match Started',
        description: message || 'Your game match has started!',
        iconName: 'Gamepad2',
        icon: Gamepad2,
        sender,
      };

    case 'SYSTEM_ANNOUNCEMENT':
    case 'SYSTEM':
      return {
        destination: (metadata?.link as string) || '/dashboard/notifications',
        title: title || 'System Announcement',
        description: message || 'You have a system announcement',
        iconName: 'Megaphone',
        icon: Megaphone,
        sender,
      };

    default:
      return {
        destination: (metadata?.link as string) || (metaGameType ? resolveGameRoute(metaGameType, metaGameId) : '/dashboard/notifications'),
        title: title || 'New Notification',
        description: message || 'You have a new update.',
        iconName: 'Bell',
        icon: Bell,
        sender,
      };
  }
}
