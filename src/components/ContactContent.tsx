import './ContactContent.css';
import SocialCard from './SocialCard';
import Lanyard from './lanyard/Lanyard';

export default function ContactContent() {
  return (
    <div className="contact-container-new">
      {/* Header */}
      <div className="contact-header">
        <h1>Connect</h1>
      </div>

      {/* 2-Column Grid */}
      <div className="contact-grid">
        {/* Left Side - Social Cards (60%) */}
        <div className="social-cards-section">
          <SocialCard
            platform="github"
            username={import.meta.env.PUBLIC_GITHUB_USERNAME || 'username'}
            href={`https://github.com/${import.meta.env.PUBLIC_GITHUB_USERNAME || 'username'}`}
            stats={[
              { label: 'Repos', value: '42' },
              { label: 'Followers', value: '120' },
              { label: 'Following', value: '89' }
            ]}
          />

          <SocialCard
            platform="linkedin"
            username={import.meta.env.PUBLIC_LINKEDIN_USERNAME || 'username'}
            href={`https://linkedin.com/in/${import.meta.env.PUBLIC_LINKEDIN_USERNAME || 'username'}`}
            stats={[
              { label: 'Connections', value: '500+' },
              { label: 'Posts', value: '24' },
              { label: 'Articles', value: '8' }
            ]}
          />
        </div>

        {/* Right Side - Original 3D Lanyard */}
        <div className="lanyard-section-3d">
          <Lanyard position={[0, 0, 30]} gravity={[0, -40, 0]} />
        </div>
      </div>
    </div>
  );
}
