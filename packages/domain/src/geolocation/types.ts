import { Coordinates } from '@festgrid/shared-types';

export type GeolocationQuery =
  | { kind: 'ADDRESS'; address: string; countryBias?: string; proximity?: Coordinates }
  | { kind: 'PLACE_ID'; placeId: string }
  | { kind: 'COORDINATES'; coordinates: Coordinates };

export type AddressPrediction = {
  placeId: string;
  description: string;
};
