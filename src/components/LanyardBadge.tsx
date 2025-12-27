import { useState } from 'react';
import './LanyardBadge.css';

interface LanyardBadgeProps {
  photoUrl?: string;
  name: string;
  role: string;
  school: string;
}

export default function LanyardBadge({
  photoUrl = '/lanyard/lanyard.png',
  name,
  role,
  school
}: LanyardBadgeProps) {
  const [isHovered, setIsHovered] = useState(false);

  return (
    <div className="lanyard-wrapper-new">
      {/* String/Chain from top */}
      <svg className="lanyard-string" width="100%" height="200" style={{ position: 'absolute', top: 0, left: '50%', transform: 'translateX(-50%)' }}>
        <line
          x1="50%"
          y1="0"
          x2="50%"
          y2="200"
          stroke="#d0d0d0"
          strokeWidth="3"
        />
      </svg>

      {/* Badge */}
      <div
        className={`lanyard-badge ${isHovered ? 'hovered' : ''}`}
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
      >
        {/* Metal Clip */}
        <div className="badge-clip"></div>

        {/* Photo Area */}
        <div className="badge-photo">
          <img src={photoUrl} alt={name} />
        </div>

        {/* Info */}
        <div className="badge-info">
          <div className="badge-name">{name}</div>
          <div className="badge-role">{role}</div>
          <div className="badge-school">{school}</div>
        </div>
      </div>
    </div>
  );
}
