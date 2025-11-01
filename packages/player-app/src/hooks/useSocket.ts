import { useState, useEffect, useCallback } from 'react';
import { io, Socket } from 'socket.io-client';
import { ServerToClientMessage, ClientToServerMessage, Character } from '@wfrp/shared';


// import { ServerToClientMessage } from '@wfrp/shared';

export const useSocket = () => {
  const [socket, setSocket] = useState<Socket | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [character, setCharacter] = useState<Character | null>(null);


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

  return { isConnected, character, connect, disconnect, sendMessage };
};