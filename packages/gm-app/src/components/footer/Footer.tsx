import React, { useState, useRef, useEffect } from 'react';
import styles from './Footer.module.css';
import { LanguageSwitcher, useCodex } from '@wfrp/shared';
import { useTranslation } from 'react-i18next';
import { is } from '@electron-toolkit/utils';

interface FooterProps {
    ip: string,
    port: number,
    clients: string[],
    onShowUserManager: () => void,
    onBackup: () => void,
    onStartSession: () => void,
    onShowJournal: () => void,
    onShowQuestJournal: () => void,
    onShowCalendar: () => void,
    onShowShop: () => void,
    onShowShopConfigurator: () => void,
    onShowDiceTray: () => void,
    onShowAtmospherePanel: () => void,
    onShowFactionManager: () => void,
    onShowReputationPanel: () => void,
    onShowTemplateManager: () => void,
    onShowDramatisPersonae: () => void,
    onShowChat: () => void,
    onShowGameLog: () => void,
    onShowFightLab: () => void,
}

interface DropUpMenuProps {
    label: string;
    icon: string;
    items: { icon: string; label: string; onClick: () => void }[];
    variant?: 'green' | 'brown' | 'blue';
    shortcutKey?: string;
}

const DropUpMenu: React.FC<DropUpMenuProps> = ({ label, icon, items, variant = 'green', shortcutKey }) => {
    const [isOpen, setIsOpen] = useState(false);
    const menuRef = useRef<HTMLDivElement>(null);

    const variantStyles = {
        green: {
            background: '#2d5016',
            border: '2px solid #3d6f1f',
        },
        brown: {
            background: '#2c1810',
            border: '2px solid #8b6914',
        },
        blue: {
            background: '#1a3a5c',
            border: '2px solid #4a7ba7',
        },
    };

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
                setIsOpen(false);
            }
        };

        const handleKeyDown = (event: KeyboardEvent) => {
            if (event.key === shortcutKey) {
                console.log('Shortcut key pressed:', shortcutKey, isOpen);
                setIsOpen(!isOpen);
            }
            else {
                setIsOpen(false);
            }
        };

        document.addEventListener('mousedown', handleClickOutside);
        document.addEventListener('keydown', handleKeyDown);
        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
            document.removeEventListener('keydown', handleKeyDown);
        };
    }, [isOpen, shortcutKey]);

    const handleItemClick = (onClick: () => void) => {
        onClick();
        setIsOpen(false);
    };

    return (
        <div className={styles.dropUpContainer} ref={menuRef}>
            {isOpen && (
                <div className={styles.dropUpMenu}>
                    {items.map((item, index) => (
                        <button
                            key={index}
                            className={styles.dropUpMenuItem}
                            onClick={() => handleItemClick(item.onClick)}
                        >
                            {item.icon} {item.label}
                        </button>
                    ))}
                </div>
            )}
            <button
                className={styles.categoryButton}
                style={{
                    ...variantStyles[variant],
                    color: '#d4af37',
                    borderRadius: '6px',
                    cursor: 'pointer',
                    fontWeight: 'bold',
                    fontSize: '14px',
                    padding: '10px 16px',
                }}
                onClick={() => setIsOpen(!isOpen)}
            >
                {icon} {label} {isOpen ? '▲' : '▼'}
            </button>
        </div>
    );
};

export const Footer: React.FC<FooterProps> = ({
    ip,
    port,
    clients,
    onShowUserManager,
    onBackup,
    onStartSession,
    onShowJournal,
    onShowQuestJournal,
    onShowCalendar,
    onShowShop,
    onShowShopConfigurator,
    onShowDiceTray,
    onShowAtmospherePanel,
    onShowFactionManager,
    onShowReputationPanel,
    onShowTemplateManager,
    onShowDramatisPersonae,
    onShowChat,
    onShowGameLog,
    onShowFightLab,
}) => {
    const { t } = useTranslation();
    const { openViewer } = useCodex();
    const connectionCount = clients.length;
    const connectionStatusClass = connectionCount > 0 ? 'connected' : 'disconnected';

    const sessionItems = [
        { icon: '👤', label: t('menu.users'), onClick: onShowUserManager },
        { icon: '💾', label: t('menu.backup'), onClick: onBackup },
        { icon: '🌅', label: t('menu.startSession'), onClick: onStartSession },
    ];

    const journalItems = [
        { icon: '📜', label: t('menu.journal'), onClick: onShowJournal },
        { icon: '📋', label: t('menu.quests', 'Quests'), onClick: onShowQuestJournal },
        { icon: '📅', label: t('menu.calendar', 'Calendar'), onClick: onShowCalendar },
    ];

    const commerceItems = [
        { icon: '🏪', label: t('menu.shop'), onClick: onShowShop },
        { icon: '⚙️', label: t('menu.shopConfig', 'Shop Config'), onClick: onShowShopConfigurator },
    ];

    const toolsItems = [
        { icon: '🎲', label: t('menu.dice'), onClick: onShowDiceTray },
        { icon: '🌅', label: t('menu.atmosphere'), onClick: onShowAtmospherePanel },
        { icon: '💬', label: t('menu.chat', 'Chat'), onClick: onShowChat },
        { icon: '📜', label: t('menu.gameLog', 'Game Log'), onClick: onShowGameLog },
        { icon: '📚', label: t('menu.codex', 'Rules Codex'), onClick: () => openViewer('md:general/welcome') },
    ];

    const worldItems = [
        { icon: '🏰', label: t('menu.factions'), onClick: onShowFactionManager },
        { icon: '⚖️', label: t('menu.reputation'), onClick: onShowReputationPanel },
        { icon: '👥', label: t('menu.templates', 'NPC Templates'), onClick: onShowTemplateManager },
        { icon: '🎭', label: t('menu.dramatisPersonae', 'Dramatis Personae'), onClick: onShowDramatisPersonae },
    ];

    return (
        <div className={styles.serverStatus}>
            <div className={styles.statusIndicatorContainer}>
                <span className={`${styles.statusIndicator} ${connectionStatusClass}`}></span>
                <span>Server Listening on: <strong>{ip}:{port}</strong></span>
            </div>

            <DropUpMenu
                label={t('menu.session', 'Session')}
                icon="📅"
                items={sessionItems}
                variant="green"
                shortcutKey="1"
            />

            <DropUpMenu
                label={t('menu.journals', 'Journals')}
                icon="📚"
                items={journalItems}
                variant="green"
                shortcutKey="2"
            />

            <DropUpMenu
                label={t('menu.commerce', 'Commerce')}
                icon="💰"
                items={commerceItems}
                variant="brown"
                shortcutKey='3'
            />

            <DropUpMenu
                label={t('menu.tools', 'Tools')}
                icon="🛠️"
                items={toolsItems}
                variant="brown"
                shortcutKey='4'
            />

            <DropUpMenu
                label={t('menu.world', 'World')}
                icon="🌍"
                items={worldItems}
                variant="brown"
                shortcutKey='5'
            />

            <button
                className={styles.categoryButton}
                onClick={onShowFightLab}
                title={t('menu.fightLab', 'Fight Lab')}
            >
                <span className={styles.fightLabMark} aria-hidden="true">FL</span>
                {t('menu.fightLab', 'Fight Lab')}
            </button>

            <LanguageSwitcher />
            <span>Players Connected: <strong>{connectionCount}</strong></span>
        </div>
    );
};

export default Footer;
