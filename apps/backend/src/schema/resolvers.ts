import { Resolvers } from '../generated/resolvers-types';

export const resolvers: Resolvers = {
  Query: {
    health: () => true,
  },
};
