import type { CodegenConfig } from '@graphql-codegen/cli';

const config: CodegenConfig = {
  schema: 'src/schema/*.graphql',
  generates: {
    'src/generated/resolvers-types.ts': {
      plugins: [
        { add: { content: '/* eslint-disable */' } },
        'typescript',
        'typescript-resolvers',
      ],
      config: {
        useIndexSignature: true,
        contextType: '../lib/auth/context.js#GraphQLContext',
        enumsAsTypes: true,
        // GraphQL object types whose resolvers handle database rows; see src/lib/graphql-mappers.ts.
        mappers: {
          SocialMediaAccountProfile: '../lib/graphql-mappers.js#SocialMediaAccountProfileParent',
          Subscription: '../lib/graphql-mappers.js#SubscriptionParent',
          Event: '../lib/graphql-mappers.js#EventParent',
          Report: '../lib/graphql-mappers.js#ReportParent',
          Widget: '../lib/graphql-mappers.js#WidgetParent',
          AIEventFilter: '../lib/graphql-mappers.js#AIEventFilterParent',
          AccountVote: '../lib/graphql-mappers.js#AccountVoteParent',
          EmbedDomain: '../lib/graphql-mappers.js#EmbedDomainParent',
          RankedAccountVote: '../lib/graphql-mappers.js#RankedAccountVoteParent',
          Coordinates: '../lib/graphql-mappers.js#CoordinatesParent',
          Schedule: '../lib/graphql-mappers.js#ScheduleParent',
          UnprocessedScraperPayload: '../lib/graphql-mappers.js#UnprocessedScraperPayloadParent',
          PayloadContext: '../lib/graphql-mappers.js#PayloadContextParent',
        },
      },
    },
  },
};

export default config;
