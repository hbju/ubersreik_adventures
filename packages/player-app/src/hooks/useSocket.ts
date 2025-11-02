import { useState, useEffect, useCallback } from 'react';
import { io, Socket } from 'socket.io-client';
import { ServerToClientMessage, ClientToServerMessage, Character } from '@wfrp/shared';


// import { ServerToClientMessage } from '@wfrp/shared';

export const useSocket = () => {
  const [socket, setSocket] = useState<Socket | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [character, setCharacter] = useState<Character | null>(null);
  const [shopItems, setShopItems] = useState<string[]>([]);


  const connect = useCallback((ipAddress: string) => {
    if (socket?.connected) return;

    console.log(`[CLIENT] Attempting to connect to ws://${ipAddress}:3003`);
    const newSocket = io(`ws://${ipAddress}:3003`);

    newSocket.on('connect', () => {
      console.log(`[CLIENT] Connected successfully with ID: ${newSocket.id}`);
      setIsConnected(true);
    });

    newSocket.on('disconnect', () => {
      console.log('[CLIENT] Disconnected from server.');
      setIsConnected(false);
    });

    newSocket.on('gm-message', (message: ServerToClientMessage ) => {
      console.log('[CLIENT] Received message from GM:', message);
      if (message.type === 'ASSIGN_CHARACTER') {
        setCharacter(message.payload.character);
      }

      if (message.type === 'AWARD_XP') {
        console.log('[CLIENT] Awarding XP:', message.payload.amount);
        setCharacter(prevChar => {
          if (!prevChar) return prevChar;
          const newChar = { ...prevChar };
          const newXp = {...newChar.xp };
          newXp.current += message.payload.amount;
          newChar.xp = newXp;
          return newChar;
        });
      }

      if (message.type === 'AWARD_CURRENCY') {
        console.log('[CLIENT] Awarding Currency:', message.payload);
        setCharacter(prevChar => {
          if (!prevChar) return prevChar;
          const newChar = { ...prevChar, currency: { ...message.payload.currency } };
          return newChar;
        });
      }

      if (message.type === 'UPDATE_SHOP_INVENTORY') {
        console.log('[CLIENT] Shop inventory updated:', message.payload);
        const itemIds = Object.keys(message.payload.items);
        setShopItems(itemIds);
      }

      if (message.type === 'PURCHASE_RESPONSE') {
        console.log('[CLIENT] Purchase response:', message.payload);
        if (message.payload.success) {
          alert(`Purchase successful! You received ${message.payload.item.name}`);
        } else {
          alert(`Purchase denied${message.payload.reason ? ': ' + message.payload.reason : ''}`);
        }
      }
    });

    setSocket(newSocket);
  }, [socket]);

  const sendMessage = useCallback((message: ClientToServerMessage) => {
    if (socket) {
      console.log('[CLIENT] Sending message to GM:', message);
      socket.emit('player-message', message);
    }
  }, [socket]);

  const disconnect = useCallback(() => {
    socket?.disconnect();
  }, [socket]);

  useEffect(() => {
    return () => {
      socket?.disconnect();
    };
  }, [socket]);

  return { isConnected, character, shopItems, connect, disconnect, sendMessage };
};