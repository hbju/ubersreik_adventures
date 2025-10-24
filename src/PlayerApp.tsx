import React, { useState, useEffect } from 'react';
import { socket } from './utils/socket';
import './PlayerApp.css'; // Create some simple styles for this view

interface DisplayContent {
    type: 'location';
    image: string;
    name: string;
    description: string;
}

const PlayerApp: React.FC = () => {

    console.log("Welcome player")
    
    const [content, setContent] = useState<DisplayContent | null>(null);

    useEffect(() => {
        socket.connect();

        socket.on('player-event', (data) => {
            if (data.type === 'SHOW_LOCATION') {
                setContent(data.payload);
            }
            // Add more event types here later (e.g., 'INITIATIVE_UPDATE')
        });

        return () => {
            socket.off('player-event');
            socket.disconnect();
        };
    }, []);

    if (!content) {
        return <div className="player-app-container waiting"><h1>Waiting for GM...</h1></div>;
    }

    return (
        <div className="player-app-container">
            <img src={content.image} alt={content.name} className="player-image" />
            <div className="player-text">
                <h2>{content.name}</h2>
                <p>{content.description}</p>
            </div>
        </div>
    );
};

export default PlayerApp;