import { useEffect } from 'react';
import { Ambience } from './ambience';
import { Ball } from './Ball';
import { StaticBatch } from './env/batch';
import { Details } from './env/Details';
import { Playground } from './env/Playground';
import { Dust } from './env/Dust';
import { Scatter, Trees } from './env/Foliage';
import { Grass } from './env/Grass';
import { Ground } from './env/Ground';
import { Lights } from './env/Lights';
import { Paths } from './env/Paths';
import { Pond } from './env/Pond';
import { Sky } from './env/Sky';
import { Streams } from './env/Streams';
import { ZenGarden } from './env/ZenGarden';
import { Court } from './games/Court';
import { Field } from './games/Field';
import { Player } from './Player';
import { Landmarks } from './stations/Landmarks';
import { Markers } from './stations/Markers';
import { Stations } from './stations/Stations';
import { useWorld, world } from './store';

export function Scene() {
  // The grass and shadows rebuild lighter if quality drops.
  const quality = useWorld((s) => s.quality);
  useEffect(() => {
    world.set({ ready: true });
  }, []);

  return (
    <>
      <Sky />
      <Lights key={`lights-${quality}`} />
      <Ground />
      <Grass key={`grass-${quality}`} />
      <Paths />
      <Pond />
      <Streams />
      <StaticBatch>
        <ZenGarden />
      </StaticBatch>
      <StaticBatch>
        <Details />
      </StaticBatch>
      <Trees />
      <Scatter />
      <Dust />
      <Field />
      <Court />
      <Stations />
      <Landmarks />
      <Markers />
      <Player />
      <Ball />
      <Playground />
      <Ambience />
    </>
  );
}
