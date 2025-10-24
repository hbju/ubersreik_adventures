import React, { useEffect, useState } from 'react';

export const ServerStatus: React.FC = () => {
    const [serverInfo, setServerInfo] = useState({ ip: 'Loading...', port: 0 });
    const [connectedPlayers, setConnectedPlayers] = useState<string[]>([]);

    useEffect(() => {
        window.ipcRenderer.invoke('get-server-status').then((info) => {
            setServerInfo(info);
        });

        const onPlayerConnect = (event: any, playerId: string) => {
            setConnectedPlayers((prev) => [...prev, playerId]);
        };
        window.ipcRenderer.on('player-connected', onPlayerConnect);

        const onPlayerDisconnect = (event: any, playerId: string) => {
            setConnectedPlayers((prev) => prev.filter((id) => id !== playerId));
        };
        window.ipcRenderer.on('player-disconnected', onPlayerDisconnect);

        return () => {
            window.ipcRenderer.off('player-connected', onPlayerConnect);
            window.ipcRenderer.off('player-disconnected', onPlayerDisconnect);
        };
    }, []);

    return (
        <div className="p-4 bg-gray-800 text-white rounded-lg shadow-md">
            <h3 className="font-bold text-lg mb-2">Server Status</h3>
            <p>
                Tell your players to connect to: <strong>{serverInfo.ip}:{serverInfo.port}</strong>
            </p>
            <div className="mt-4">
                <h4 className="font-semibold">Connected Players ({connectedPlayers.length}):</h4>
                {connectedPlayers.length > 0 ? (
                    <ul>
                        {connectedPlayers.map(id => <li key={id} className="text-sm font-mono">{id}</li>)}
                    </ul>
                ) : (
                    <p className="text-sm text-gray-400">No players connected.</p>
                )}
            </div>
        </div>
    );
};

export default ServerStatus;