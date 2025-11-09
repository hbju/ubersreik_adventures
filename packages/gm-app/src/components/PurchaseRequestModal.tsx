import React, { useState } from 'react';
import { Character, Currency, Armor, Weapon, Item, PurchaseResponseMessage } from '@wfrp/shared';
import styles from './PurchaseRequestModal.module.css';

interface PurchaseRequestModalProps {
  playerName: string;
  item: Armor | Weapon | Item;
  playerCurrency: Currency;
  userId: string;
  onClose: () => void;
  onApprove: (item: Armor | Weapon | Item) => void;
}

export const PurchaseRequestModal: React.FC<PurchaseRequestModalProps> = ({
  playerName,
  item,
  playerCurrency,
  userId,
  onClose,
  onApprove,
}) => {
  const [denyReason, setDenyReason] = useState('');
  const [showDenyInput, setShowDenyInput] = useState(false);

  const handleApprove = () => {
    const response: PurchaseResponseMessage = {
      type: 'PURCHASE_RESPONSE',
      payload: {
        success: true,
        item: item,
      },
    };

    window.ipcRenderer.sendToPlayer(userId, response);
    onApprove(item);
    onClose();
  };

  const handleDeny = () => {
    const response: PurchaseResponseMessage = {
      type: 'PURCHASE_RESPONSE',
      payload: {
        success: false,
        item: item,
        reason: denyReason.trim() || 'Purchase denied by GM',
      },
    };

    window.ipcRenderer.sendToPlayer(userId, response);
    onClose();
  };

  const handleDenyClick = () => {
    if (showDenyInput) {
      handleDeny();
    } else {
      setShowDenyInput(true);
    }
  };

  // Helper to format item details
  const getItemDetails = () => {
    const details: string[] = [];
    
    if ('type' in item) {
      // Armor
      details.push(`Type: ${item.type}`);
      details.push(`AP: ${item.ap}`);
      details.push(`Locations: ${item.locations.join(', ')}`);
    } else if ('group' in item) {
      // Weapon
      details.push(`Group: ${item.group}`);
      details.push(`Damage: ${item.damage}`);
      details.push(`Reach: ${item.reach}`);
      if (item.qualities.length > 0) {
        details.push(`Qualities: ${item.qualities.join(', ')}`);
      }
    }
    
    return details;
  };

  return (
    <div className={styles.modalBackdrop} onClick={onClose}>
      <div className={styles.modalContent} onClick={(e) => e.stopPropagation()}>
        <div className={styles.header}>
          <h2>Purchase Request</h2>
          <button className={styles.closeButton} onClick={onClose}>
            &times;
          </button>
        </div>

        <div className={styles.body}>
          <div className={styles.requestInfo}>
            <p className={styles.mainMessage}>
              <strong>{playerName}</strong> wants to purchase{' '}
              <strong className={styles.itemName}>{item.name}</strong> for{' '}
              <strong className={styles.price}>{item.price}</strong>.
            </p>

            <div className={styles.currencyDisplay}>
              <span className={styles.label}>They have:</span>
              <div className={styles.currency}>
                <span className={styles.gc}>{playerCurrency.gc} GC</span>
                <span className={styles.ss}>{playerCurrency.ss} SS</span>
                <span className={styles.bp}>{playerCurrency.bp} BP</span>
              </div>
            </div>
          </div>

          <div className={styles.itemDetails}>
            <h3>Item Details</h3>
            <div className={styles.detailsGrid}>
              <div className={styles.detailRow}>
                <span className={styles.detailLabel}>Price:</span>
                <span className={styles.detailValue}>{item.price}</span>
              </div>
              <div className={styles.detailRow}>
                <span className={styles.detailLabel}>Encumbrance:</span>
                <span className={styles.detailValue}>{item.enc}</span>
              </div>
              <div className={styles.detailRow}>
                <span className={styles.detailLabel}>Availability:</span>
                <span className={styles.detailValue}>{item.availability}</span>
              </div>
              {getItemDetails().map((detail, index) => (
                <div key={index} className={styles.detailRow}>
                  <span className={styles.detailValue}>{detail}</span>
                </div>
              ))}
            </div>
          </div>

          {showDenyInput && (
            <div className={styles.denyReasonSection}>
              <label htmlFor="denyReason">Reason for denial (optional):</label>
              <input
                id="denyReason"
                type="text"
                placeholder="e.g., Not enough money, Item not available..."
                value={denyReason}
                onChange={(e) => setDenyReason(e.target.value)}
                className={styles.denyInput}
                autoFocus
              />
            </div>
          )}
        </div>

        <div className={styles.footer}>
          <button onClick={handleApprove} className={styles.approveButton}>
            Approve
          </button>
          <button onClick={handleDenyClick} className={styles.denyButton}>
            {showDenyInput ? 'Confirm Deny' : 'Deny'}
          </button>
          {showDenyInput && (
            <button
              onClick={() => setShowDenyInput(false)}
              className={styles.cancelButton}
            >
              Cancel
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
