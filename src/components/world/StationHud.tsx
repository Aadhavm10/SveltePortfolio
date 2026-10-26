import { useEffect, useState, type CSSProperties, type ReactNode } from 'react';
import { ArrowDown, ArrowLeft, ArrowRight, ArrowUp, Camera, Download, ExternalLink, Images, RotateCcw } from 'lucide-react';
import { experience, places, projects } from '../../data/portfolio';
import { arrow, back, closeStation, interact, moveStall, openGallery, stallIndex, stepGallery, turnPage } from './actions';
import { arcade, arcadeEnter, arcadePress, GAMES } from './games/arcade';
import { stationById, type StationId } from './layout';
import { takePhoto } from './stations/Capture';
import { stepPlace } from './stations/Globe';
import { PSP_MENU } from './stations/pspMenu';
import { useWorld, world } from './store';

const BackButton = () => (
  <button type="button" className="world-btn" onClick={back}>
    Back <kbd>Esc</kbd>
  </button>
);

function Bar({ station, title, sub, children }: { station: StationId; title: ReactNode; sub?: ReactNode; children: ReactNode }) {
  return (
    <div className="world-station-bar" style={{ '--accent': stationById[station].color } as CSSProperties}>
      <span className="world-station-title">
        {title}
        {sub && <small>{sub}</small>}
      </span>
      <div className="world-station-actions">{children}</div>
    </div>
  );
}

const IconButton = ({ label, onClick, children }: { label: string; onClick: () => void; children: ReactNode }) => (
  <button type="button" className="world-btn world-btn-icon" onClick={onClick} aria-label={label}>
    {children}
  </button>
);

/** The station UI for whatever is open. */
export function StationHud() {
  const station = useWorld((s) => s.station);
  if (!station) return null;
  if (station === 'arcade') return <ArcadeBar />;
  if (station === 'globe') return <GlobePanel />;
  if (station === 'photo') return <PhotoHud />;
  if (station === 'room') return <RoomHud />;
  if (stallIndex(station) >= 0) return <StallBar index={stallIndex(station)} />;
  return <PagedBar station={station} />;
}

/** Experience pages and the PSP menu. */
function PagedBar({ station }: { station: StationId }) {
  const page = useWorld((s) => s.page);
  const psp = useWorld((s) => s.psp);
  if (station === 'experience') {
    return (
      <Bar station={station} title="Experience" sub={`${page + 1} / ${experience.length}`}>
        <IconButton label="Previous" onClick={() => turnPage(-1)}>
          <ArrowLeft size={18} />
        </IconButton>
        <button type="button" className="world-btn" onClick={() => turnPage(1)}>
          Next <kbd>Enter</kbd>
        </button>
        <BackButton />
      </Bar>
    );
  }
  const item = PSP_MENU[psp.col].items[psp.row];
  return (
    <Bar station={station} title="Favorites">
      <IconButton label="Previous category" onClick={() => arrow(-1, 0)}>
        <ArrowLeft size={18} />
      </IconButton>
      <IconButton label="Next item" onClick={() => arrow(0, 1)}>
        <ArrowDown size={18} />
      </IconButton>
      <IconButton label="Next category" onClick={() => arrow(1, 0)}>
        <ArrowRight size={18} />
      </IconButton>
      {item?.href && (
        <a className="world-btn world-btn-primary" href={item.href} target="_blank" rel="noopener noreferrer">
          Open {item.title} <ExternalLink size={16} aria-hidden="true" />
        </a>
      )}
      <BackButton />
    </Bar>
  );
}

function StallBar({ index }: { index: number }) {
  const project = projects[index];
  return (
    <Bar station={`stall-${index}`} title={project.title} sub={`Stall ${index + 1} of ${projects.length}`}>
      <IconButton label="Previous stall" onClick={() => moveStall(-1)}>
        <ArrowLeft size={18} />
      </IconButton>
      <IconButton label="Next stall" onClick={() => moveStall(1)}>
        <ArrowRight size={18} />
      </IconButton>
      <a className="world-btn world-btn-primary" href={project.projectUrl} target="_blank" rel="noopener noreferrer">
        Open site <ExternalLink size={16} aria-hidden="true" /> <kbd>O</kbd>
      </a>
      <BackButton />
    </Bar>
  );
}

/** Arcade: on-screen buttons for phones (Brick breaker's paddle follows a held arrow). */
function ArcadeBar() {
  const touch = useWorld((s) => s.touch);
  const [, force] = useState(0);
  useEffect(() => {
    const id = setInterval(() => force((n) => n + 1), 250);
    return () => clearInterval(id);
  }, []);
  const game = arcade.screen === 'menu' ? null : GAMES.find((g) => g.id === arcade.screen);
  const hold = (dir: number) => ({
    onPointerDown: () => {
      arcade.touchX = dir;
      arcadePress(dir, 0);
    },
    onPointerUp: () => (arcade.touchX = 0),
    onPointerLeave: () => (arcade.touchX = 0)
  });
  return (
    <Bar station="arcade" title="Arcade" sub={game ? game.title : 'Pick a game'}>
      {touch && (
        <div className="world-dpad">
          <button type="button" className="world-btn world-btn-icon" aria-label="Up" onPointerDown={() => arcadePress(0, -1)}>
            <ArrowUp size={18} />
          </button>
          <button type="button" className="world-btn world-btn-icon" aria-label="Left" {...hold(-1)}>
            <ArrowLeft size={18} />
          </button>
          <button type="button" className="world-btn world-btn-icon" aria-label="Down" onPointerDown={() => arcadePress(0, 1)}>
            <ArrowDown size={18} />
          </button>
          <button type="button" className="world-btn world-btn-icon" aria-label="Right" {...hold(1)}>
            <ArrowRight size={18} />
          </button>
        </div>
      )}
      <button type="button" className="world-btn world-btn-primary" onClick={arcadeEnter}>
        {game ? 'Go' : 'Play'} <kbd>Enter</kbd>
      </button>
      <BackButton />
    </Bar>
  );
}

/** Globe: a card about the selected place, and a full-screen gallery of its photos. */
function GlobePanel() {
  const index = useWorld((s) => s.place);
  const gallery = useWorld((s) => s.gallery);
  const place = places[index];
  if (!place) return null;
  return (
    <>
      <aside className="world-place" style={{ '--accent': stationById.globe.color } as CSSProperties} aria-live="polite">
        <p className="world-place-eyebrow">
          {place.country}
          {place.placeholder && <span className="world-tag">Sample</span>}
        </p>
        <h2 className="world-place-name">{place.name}</h2>
        <p className="world-place-when">{place.when}</p>
        <p className="world-place-story">{place.story}</p>
        {place.photos.length > 0 && (
          <div className="world-place-thumbs">
            {place.photos.slice(0, 4).map((src, i) => (
              <button key={src} type="button" onClick={() => openGallery(i)} aria-label={`Open photo ${i + 1}`}>
                <img src={src} alt="" loading="lazy" />
              </button>
            ))}
          </div>
        )}
        <div className="world-place-actions">
          <IconButton label="Previous place" onClick={() => stepPlace(-1)}>
            <ArrowLeft size={18} />
          </IconButton>
          <IconButton label="Next place" onClick={() => stepPlace(1)}>
            <ArrowRight size={18} />
          </IconButton>
          {place.photos.length > 0 && (
            <button type="button" className="world-btn world-btn-primary" onClick={() => openGallery()}>
              <Images size={16} aria-hidden="true" /> Photos <kbd>Enter</kbd>
            </button>
          )}
          <BackButton />
        </div>
        <p className="world-place-hint">Drag the globe to spin it, or tap a pin.</p>
      </aside>
      {gallery >= 0 && (
        <div className="world-gallery" role="dialog" aria-label={`${place.name} photos`} onClick={back}>
          <figure onClick={(e) => e.stopPropagation()}>
            <img key={gallery} src={place.photos[gallery]} alt={`${place.name}, photo ${gallery + 1}`} />
            <figcaption>
              <strong>{place.name}</strong> {`${gallery + 1} / ${place.photos.length}`}
            </figcaption>
          </figure>
          <div className="world-gallery-nav" onClick={(e) => e.stopPropagation()}>
            <IconButton label="Previous photo" onClick={() => stepGallery(-1)}>
              <ArrowLeft size={18} />
            </IconButton>
            <IconButton label="Next photo" onClick={() => stepGallery(1)}>
              <ArrowRight size={18} />
            </IconButton>
            <button type="button" className="world-btn" onClick={back}>
              Close <kbd>Esc</kbd>
            </button>
          </div>
        </div>
      )}
    </>
  );
}

/** Photo booth: a viewfinder while posing, then the polaroid to keep. */
function PhotoHud() {
  const polaroid = useWorld((s) => s.polaroid);
  const touch = useWorld((s) => s.touch);
  return (
    <>
      <div className="world-booth-frame" aria-hidden="true">
        <span className="world-viewfinder-corner tl" />
        <span className="world-viewfinder-corner tr" />
        <span className="world-viewfinder-corner bl" />
        <span className="world-viewfinder-corner br" />
      </div>
      {polaroid && (
        <div className="world-polaroid" role="dialog" aria-label="Your photo">
          <span className="world-viewfinder-flash" />
          <img src={polaroid} alt="Your photo from the park" />
          <div className="world-polaroid-actions">
            <a className="world-btn world-btn-primary" href={polaroid} download="aadhav-park-photo.jpg">
              <Download size={16} aria-hidden="true" /> Save photo
            </a>
            <button type="button" className="world-btn" onClick={interact}>
              <RotateCcw size={16} aria-hidden="true" /> Take another
            </button>
          </div>
        </div>
      )}
      {!polaroid && (
        <Bar station="photo" title="Photo booth" sub={touch ? 'Move to pose' : 'Walk around to pose'}>
          <button type="button" className="world-btn world-btn-primary" onClick={takePhoto}>
            <Camera size={16} aria-hidden="true" /> Snap <kbd>Enter</kbd>
          </button>
          <button type="button" className="world-btn" onClick={closeStation}>
            Done <kbd>Esc</kbd>
          </button>
        </Bar>
      )}
    </>
  );
}

function RoomHud() {
  const fadeAt = useWorld((s) => s.roomFadeAt);
  return (
    <>
      <div key={fadeAt} className="world-room-fade" aria-hidden="true" />
      <Bar station="room" title="My room" sub="Drag to spin it around">
        <IconButton label="Look left" onClick={() => arrow(-1, 0)}>
          <ArrowLeft size={18} />
        </IconButton>
        <IconButton label="Look right" onClick={() => arrow(1, 0)}>
          <ArrowRight size={18} />
        </IconButton>
        <button type="button" className="world-btn" onClick={() => world.get().station === 'room' && closeStation()}>
          Head outside <kbd>Esc</kbd>
        </button>
      </Bar>
    </>
  );
}
