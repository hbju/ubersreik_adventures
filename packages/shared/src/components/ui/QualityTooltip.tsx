import React from 'react';
import { Tooltip } from './Tooltip';
import { getQualityInfo } from '../../utils/qualities';
import styles from './Tooltip.module.css';
import { useGameData } from '../../hooks/useGameData';

interface QualityTooltipProps {
    qualityString: string;
    className?: string;
}

/**
 * A specialized tooltip component for displaying weapon/armor quality information.
 * Automatically looks up the quality definition and formats the tooltip content.
 */
export const QualityTooltip: React.FC<QualityTooltipProps> = ({
    qualityString,
    className = '',
}) => {
    const { qualities } = useGameData();
    const qualityInfo = getQualityInfo(qualityString, qualities);

    const tooltipContent = qualityInfo.definition ? (
        <div>
            <div className={`${styles.qualityType} ${qualityInfo.definition.type === 'flaw' ? styles.flaw : styles.quality}`}>
                {qualityInfo.definition.type}
            </div>
            <h4>
                {qualityInfo.definition.name.charAt(0).toUpperCase() + qualityInfo.definition.name.slice(1)}
            </h4>
            <p>{qualityInfo.definition.description}</p>
        </div>
    ) : (
        <div>
            <h4>{qualityString}</h4>
            <p>No description available.</p>
        </div>
    );

    return (
        <Tooltip content={tooltipContent} position="top">
            <span className={className}>{qualityInfo.definition ? qualityInfo.definition?.name.charAt(0).toUpperCase() + qualityInfo.definition?.name.slice(1) : qualityString.charAt(0).toUpperCase() + qualityString.slice(1)}</span>
        </Tooltip>
    );
};

export default QualityTooltip;
