import { StaticBatch } from '../env/batch';
import { Capture } from './Capture';
import { Desk } from './Desk';
import { Fair } from './Fair';
import { PhotoCamera, Psp } from './Gadgets';
import { Globe } from './Globe';
import { Room } from './Room';

export function Stations() {
  return (
    <>
      <StaticBatch>
        <Desk />
      </StaticBatch>
      <StaticBatch>
        <Psp />
      </StaticBatch>
      <StaticBatch>
        <PhotoCamera />
      </StaticBatch>
      <StaticBatch>
        <Globe />
      </StaticBatch>
      <StaticBatch>
        <Fair />
      </StaticBatch>
      <Room />
      <Capture />
    </>
  );
}
