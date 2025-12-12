import React, { useEffect, useState } from 'react';
import styles from './Footer.module.css';
import { LanguageSwitcher } from '@wfrp/shared';
import { useTranslation } from 'react-i18next';
import { on } from 'events';

interface FooterProps {
    ip: string,
    port: number,
    clients: string[],
    onShowUserManager: () => void,
    onBackup: () => void,
    onStartSession: () => void,
    onShowJournal: () => void,
    onShowQuestJournal: () => void,
    onShowShop: () => void,
    onShowShopConfigurator: () => void,
    onShowDiceTray: () => void,
    onShowAtmospherePanel: () => void,
    onShowFactionManager: () => void,
    onShowReputationPanel: () => void,
    onShowTemplateManager: () => void,
    onShowChat: () => void,
}

export const Footer: React.FC<FooterProps> = ({
    ip,
    port,
    clients,
    onShowUserManager,
    onBackup,
    onStartSession,
    onShowJournal,
    onShowQuestJournal,
    onShowShop,
    onShowShopConfigurator,
    onShowDiceTray,
    onShowAtmospherePanel,
    onShowFactionManager,
    onShowReputationPanel,
    onShowTemplateManager,
    onShowChat,
}) => {
    const { t } = useTranslation();
    const connectionCount = clients.length;
    const connectionStatusClass = connectionCount > 0 ? 'connected' : 'disconnected';

    return (
        <div className={styles.serverStatus}>
            <div className={styles.statusIndicatorContainer}>
                <span className={`${styles.statusIndicator} ${connectionStatusClass}`}></span>
                <span>Server Listening on: <strong>{ip}:{port}</strong></span>
            </div>

            <button
                onClick={onShowUserManager}
                style={{
                    padding: '10px 5px',
                    background: '#2d5016',
                    color: '#d4af37',
                    border: '2px solid #3d6f1f',
                    borderRadius: '6px',
                    cursor: 'pointer',
                    fontWeight: 'bold',
                    fontSize: '14px'
                }}
            >
                👤 {t('menu.users')}
            </button>


            <button
                onClick={onBackup}
                style={{
                    padding: '10px 20px',
                    background: '#2d5016',
                    color: '#d4af37',
                    border: '2px solid #3d6f1f',
                    borderRadius: '6px',
                    cursor: 'pointer',
                    fontWeight: 'bold',
                    fontSize: '14px'
                }}
            >
                💾 {t('menu.backup')}
            </button>

            <button
                onClick={onStartSession}
                style={{
                    padding: '10px 20px',
                    background: '#2d5016',
                    color: '#d4af37',
                    border: '2px solid #3d6f1f',
                    borderRadius: '6px',
                    cursor: 'pointer',
                    fontWeight: 'bold',
                    fontSize: '14px'
                }}
            >
                🌅 {t('menu.startSession')}
            </button>
            <button
                onClick={onShowJournal}
                style={{
                    padding: '10px 20px',
                    background: '#2d5016',
                    color: '#d4af37',
                    border: '2px solid #3d6f1f',
                    borderRadius: '6px',
                    cursor: 'pointer',
                    fontWeight: 'bold',
                    fontSize: '14px'
                }}
            >
                📜 {t('menu.journal')}
            </button>
            <button
                onClick={onShowQuestJournal}
                style={{
                    padding: '10px 20px',
                    background: '#2d5016',
                    color: '#d4af37',
                    border: '2px solid #3d6f1f',
                    borderRadius: '6px',
                    cursor: 'pointer',
                    fontWeight: 'bold',
                    fontSize: '14px'
                }}
            >
                📋 {t('menu.quests', 'Quests')}
            </button>
            <button
                onClick={onShowShop}
                style={{
                    padding: '10px 20px',
                    background:'#2c1810',
                    color: '#d4af37',
                    border: '2px solid #8b6914',
                    borderRadius: '6px',
                    cursor: 'pointer',
                    fontWeight: 'bold',
                    fontSize: '14px'
                }}
            >
                🏪 {t('menu.shop')}
            </button>
            <button
                onClick={onShowShopConfigurator}
                style={{
                    padding: '10px 20px',
                    background: '#2d5016',
                    color: '#d4af37',
                    border: '2px solid #3d6f1f',
                    borderRadius: '6px',
                    cursor: 'pointer',
                    fontWeight: 'bold',
                    fontSize: '14px'
                }}
            >
                ⚙️ {t('menu.shopConfig', 'Shop Config')}
            </button>
            <button
                onClick={onShowDiceTray}
                style={{
                    padding: '10px 20px',
                    background: '#2c1810',
                    color: '#d4af37',
                    border: '2px solid #8b6914',
                    borderRadius: '6px',
                    cursor: 'pointer',
                    fontWeight: 'bold',
                    fontSize: '14px'
                }}
            >
                🎲 {t('menu.dice')}
            </button>
            <button
                onClick={onShowAtmospherePanel}
                style={{
                    padding: '10px 20px',
                    background: '#2c1810',
                    color: '#d4af37',
                    border: '2px solid #8b6914',
                    borderRadius: '6px',
                    cursor: 'pointer',
                    fontWeight: 'bold',
                    fontSize: '14px'
                }}
            >
                🌅 {t('menu.atmosphere')}
            </button>
            <button
                onClick={onShowFactionManager}
                style={{
                    padding: '10px 20px',
                    background: '#2c1810',
                    color: '#d4af37',
                    border: '2px solid #8b6914',
                    borderRadius: '6px',
                    cursor: 'pointer',
                    fontWeight: 'bold',
                    fontSize: '14px'
                }}
            >
                🏰 {t('menu.factions')}
            </button>
            <button
                onClick={onShowReputationPanel}
                style={{
                    padding: '10px 20px',
                    background: '#2c1810',
                    color: '#d4af37',
                    border: '2px solid #8b6914',
                    borderRadius: '6px',
                    cursor: 'pointer',
                    fontWeight: 'bold',
                    fontSize: '14px'
                }}
            >
                ⚖️ {t('menu.reputation')}
            </button>
            <button
                onClick={onShowTemplateManager}
                style={{
                    padding: '10px 20px',
                    background: '#2c1810',
                    color: '#d4af37',
                    border: '2px solid #8b6914',
                    borderRadius: '6px',
                    cursor: 'pointer',
                    fontWeight: 'bold',
                    fontSize: '14px'
                }}
            >
                👥 {t('menu.templates', 'NPC Templates')}
            </button>
            <button
                onClick={onShowChat}
                style={{
                    padding: '10px 20px',
                    background: '#1a3a5c',
                    color: '#d4af37',
                    border: '2px solid #4a7ba7',
                    borderRadius: '6px',
                    cursor: 'pointer',
                    fontWeight: 'bold',
                    fontSize: '14px'
                }}
            >
                💬 {t('menu.chat', 'Chat')}
            </button>

            <LanguageSwitcher />
            <span>Players Connected: <strong>{connectionCount}</strong></span>
        </div>
    );
};

export default Footer;