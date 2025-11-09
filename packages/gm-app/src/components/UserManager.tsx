import React, { useState } from 'react';
import { User, Character } from '@wfrp/shared';
import styles from './UserManager.module.css';

interface UserManagerProps {
  users: User[];
  characters: Character[];
  onCreateUser: (username: string, password: string) => void;
  onDeleteUser: (userId: string) => void;
  onAssignCharacter: (userId: string, characterId: string | null) => void;
}

export const UserManager: React.FC<UserManagerProps> = ({
  users,
  characters,
  onCreateUser,
  onDeleteUser,
  onAssignCharacter,
}) => {
  const [newUsername, setNewUsername] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  const handleCreateUser = () => {
    if (!newUsername.trim()) {
      alert('Username cannot be empty');
      return;
    }
    if (!newPassword.trim()) {
      alert('Password cannot be empty');
      return;
    }
    if (users.some(u => u.username.toLowerCase() === newUsername.toLowerCase())) {
      alert('Username already exists');
      return;
    }

    onCreateUser(newUsername.trim(), newPassword);
    setNewUsername('');
    setNewPassword('');
    setShowPassword(false);
  };

  const handleDeleteUser = (userId: string) => {
    const user = users.find(u => u.id === userId);
    if (!user) return;

    if (confirm(`Are you sure you want to delete user "${user.username}"?`)) {
      onDeleteUser(userId);
    }
  };

  const getCharacterName = (characterId: string | null): string => {
    if (!characterId) return 'None';
    const character = characters.find(c => c.id === characterId);
    return character ? character.name : 'Unknown';
  };

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <h2 className={styles.title}>User Management</h2>
        <p className={styles.subtitle}>Create and manage player accounts</p>
      </div>

      {/* Create User Section */}
      <div className={styles.createSection}>
        <h3 className={styles.sectionTitle}>Create New User</h3>
        <div className={styles.createForm}>
          <div className={styles.inputGroup}>
            <label className={styles.label}>Username</label>
            <input
              type="text"
              className={styles.input}
              value={newUsername}
              onChange={(e) => setNewUsername(e.target.value)}
              placeholder="Enter username"
              onKeyDown={(e) => e.key === 'Enter' && handleCreateUser()}
            />
          </div>
          <div className={styles.inputGroup}>
            <label className={styles.label}>Password</label>
            <div className={styles.passwordContainer}>
              <input
                type={showPassword ? 'text' : 'password'}
                className={styles.input}
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="Enter password"
                onKeyDown={(e) => e.key === 'Enter' && handleCreateUser()}
              />
              <button
                className={styles.togglePassword}
                onClick={() => setShowPassword(!showPassword)}
                type="button"
              >
                {showPassword ? '👁️' : '🔒'}
              </button>
            </div>
          </div>
          <button className={styles.createButton} onClick={handleCreateUser}>
            ➕ Create User
          </button>
        </div>
      </div>

      {/* Users List Section */}
      <div className={styles.listSection}>
        <h3 className={styles.sectionTitle}>
          Existing Users ({users.length})
        </h3>
        {users.length === 0 ? (
          <p className={styles.emptyState}>No users created yet. Create your first user account above.</p>
        ) : (
          <div className={styles.userList}>
            {users.map((user) => (
              <div key={user.id} className={styles.userCard}>
                <div className={styles.userInfo}>
                  <div className={styles.userName}>👤 {user.username}</div>
                  <div className={styles.userMeta}>
                    <span className={styles.metaLabel}>Character:</span>
                    <span className={styles.metaValue}>
                      {getCharacterName(user.characterId)}
                    </span>
                  </div>
                  <div className={styles.userMeta}>
                    <span className={styles.metaLabel}>Created:</span>
                    <span className={styles.metaValue}>
                      {new Date(user.createdAt).toLocaleDateString()}
                    </span>
                  </div>
                </div>
                <div className={styles.userActions}>
                  <select
                    className={styles.characterSelect}
                    value={user.characterId || ''}
                    onChange={(e) => onAssignCharacter(user.id, e.target.value || null)}
                  >
                    <option value="">No Character</option>
                    {characters.map((char) => (
                      <option key={char.id} value={char.id}>
                        {char.name} ({char.career})
                      </option>
                    ))}
                  </select>
                  <button
                    className={styles.deleteButton}
                    onClick={() => handleDeleteUser(user.id)}
                  >
                    🗑️ Delete
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default UserManager;
