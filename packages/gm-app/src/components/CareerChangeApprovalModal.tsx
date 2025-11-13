import React, { useState } from 'react';
import { Career } from '@wfrp/shared';
import { careersData } from '@wfrp/shared';
import styles from './CareerChangeApprovalModal.module.css';

interface CareerChangeRequest {
  characterId: string;
  characterName: string;
  newCareerId: string;
  newCareerLevelId: string;
  newCareerName: string;
  newCareerLevelName: string;
  xpCost: number;
}

interface CareerChangeApprovalModalProps {
  request: CareerChangeRequest | null;
  onApprove: () => void;
  onReject: (reason: string) => void;
  onClose: () => void;
}

const CareerChangeApprovalModal: React.FC<CareerChangeApprovalModalProps> = ({
  request,
  onApprove,
  onReject,
  onClose
}) => {
  const [rejectReason, setRejectReason] = useState('');
  const [showRejectInput, setShowRejectInput] = useState(false);

  if (!request) return null;

  const careers = careersData as Career[];
  const newCareer = careers.find(c => c.id === request.newCareerId);
  const newLevel = newCareer?.career_level.find(lvl => lvl.id === request.newCareerLevelId);

  const handleApprove = () => {
    onApprove();
    setShowRejectInput(false);
    setRejectReason('');
  };

  const handleReject = () => {
    if (showRejectInput) {
      onReject(rejectReason || 'Request rejected by GM');
      setShowRejectInput(false);
      setRejectReason('');
    } else {
      setShowRejectInput(true);
    }
  };

  const handleCancel = () => {
    setShowRejectInput(false);
    setRejectReason('');
    onClose();
  };

  return (
    <div className={styles.overlay} onClick={handleCancel}>
      <div className={styles.modal} onClick={e => e.stopPropagation()}>
        <div className={styles.header}>
          <h2>Career Change Request</h2>
          <button className={styles.closeButton} onClick={handleCancel}>×</button>
        </div>

        <div className={styles.content}>
          <div className={styles.section}>
            <h3>Character</h3>
            <p className={styles.characterName}>{request.characterName}</p>
          </div>

          <div className={styles.section}>
            <h3>Requested Career Change</h3>
            <div className={styles.careerDetails}>
              <div className={styles.detailRow}>
                <span className={styles.label}>New Career:</span>
                <span className={styles.value}>{request.newCareerName}</span>
              </div>
              <div className={styles.detailRow}>
                <span className={styles.label}>Career Level:</span>
                <span className={styles.value}>{request.newCareerLevelName}</span>
              </div>
              <div className={styles.detailRow}>
                <span className={styles.label}>Class:</span>
                <span className={styles.value}>{newCareer?.class || 'Unknown'}</span>
              </div>
              <div className={styles.detailRow}>
                <span className={styles.label}>XP Cost:</span>
                <span className={styles.xpCost}>{request.xpCost} XP</span>
              </div>
            </div>
          </div>

          {newLevel && (
            <div className={styles.section}>
              <h3>Career Level Details</h3>
              <div className={styles.levelInfo}>
                <div className={styles.levelSection}>
                  <h4>Characteristics</h4>
                  <ul>
                    {newLevel.characteristic_advances.map(char => (
                      <li key={char}>{char}</li>
                    ))}
                  </ul>
                </div>
                <div className={styles.levelSection}>
                  <h4>Skills ({newLevel.skills_ids.length})</h4>
                  <p className={styles.skillCount}>
                    {newLevel.skills_ids.length} skills available
                  </p>
                </div>
                <div className={styles.levelSection}>
                  <h4>Talents ({newLevel.talent_ids.length})</h4>
                  <p className={styles.talentCount}>
                    {newLevel.talent_ids.length} talents available
                  </p>
                </div>
              </div>
            </div>
          )}

          {showRejectInput && (
            <div className={styles.section}>
              <h3>Rejection Reason</h3>
              <textarea
                className={styles.textarea}
                value={rejectReason}
                onChange={e => setRejectReason(e.target.value)}
                placeholder="Optionally provide a reason for rejection..."
                rows={3}
              />
            </div>
          )}
        </div>

        <div className={styles.actions}>
          {!showRejectInput ? (
            <>
              <button className={styles.approveButton} onClick={handleApprove}>
                Approve Change
              </button>
              <button className={styles.rejectButton} onClick={handleReject}>
                Reject Request
              </button>
              <button className={styles.cancelButton} onClick={handleCancel}>
                Cancel
              </button>
            </>
          ) : (
            <>
              <button className={styles.confirmRejectButton} onClick={handleReject}>
                Confirm Rejection
              </button>
              <button className={styles.cancelButton} onClick={() => setShowRejectInput(false)}>
                Back
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default CareerChangeApprovalModal;
