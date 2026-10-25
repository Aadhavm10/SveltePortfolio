import { useEffect } from 'react';
import { Ambience } from './ambience';
import { Ball } from './Ball';
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
import { world } from './store';

export function Scene() {
  useEffect(() => {
    world.set({ ready: true });
  }, []);

  return (
    <>
      <Sky />
      <Lights />
      <Ground />
      <Grass />
      <Paths />
      <Pond />
      <Streams />
      <ZenGarden />
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
      <Ambience />
    </>
  );
}
