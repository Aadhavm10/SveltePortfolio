import { StaticBatch } from '../env/batch';
import { Capture } from './Capture';
import { Cottage, RoomViewer } from './Cottage';
import { Desk } from './Desk';
import { Fair } from './Fair';
import { PhotoCamera, Psp } from './Gadgets';
import { Globe } from './Globe';

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
      <StaticBatch>
        <Cottage />
      </StaticBatch>
      <RoomViewer />
      <Capture />
    </>
  );
}
