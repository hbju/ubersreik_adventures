import React, { useEffect, useState } from 'react';
import styles from './ServerStatus.module.css';

interface ServerStatusProps {
    ip: string, 
    port: number,
    clients: string[]
}

export const ServerStatus: React.FC<ServerStatusProps> = ({ ip, port, clients }) => {

    const connectionCount = clients.length;
    const connectionStatusClass = connectionCount > 0 ? 'connected' : 'disconnected';

    return (
        <div className={styles.serverStatus}>
            <div className={styles.statusIndicatorContainer}>
                <span className={`${styles.statusIndicator} ${connectionStatusClass}`}></span>
                <span>Server Listening on: <strong>{ip}:{port}</strong></span>
            </div>
            <span>Players Connected: <strong>{connectionCount}</strong></span>
        </div>
    );
};

export default ServerStatus;