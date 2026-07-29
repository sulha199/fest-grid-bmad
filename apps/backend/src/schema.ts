import {
  GraphQLBoolean,
  GraphQLInt,
  GraphQLList,
  GraphQLObjectType,
  GraphQLInputObjectType,
  GraphQLScalarType,
  GraphQLSchema,
  GraphQLString,
  Kind,
  graphql,
  type ValueNode,
} from 'graphql';
import { getEventsForQuery, type EventQueryDsl } from './events/query';

function parseJsonLiteral(ast: ValueNode): unknown {
  switch (ast.kind) {
    case Kind.STRING:
    case Kind.BOOLEAN:
      return ast.value;
    case Kind.INT:
    case Kind.FLOAT:
      return Number(ast.value);
    case Kind.LIST:
      return ast.values.map(parseJsonLiteral);
    case Kind.OBJECT:
    default:
      return null;
  }
}

const JsonValueScalar = new GraphQLScalarType({
  name: 'JsonValue',
  description: 'An arbitrary JSON value, used for EventQueryInput condition values.',
  serialize(value: unknown) {
    return value;
  },
  parseValue(value: unknown) {
    return value;
  },
  parseLiteral: parseJsonLiteral,
});

const EventScheduleType = new GraphQLObjectType({
  name: 'EventSchedule',
  fields: {
    id: { type: GraphQLString },
    slug: { type: GraphQLString },
    isMainSchedule: { type: GraphQLBoolean },
    eventStartDate: { type: GraphQLString },
    eventEndDate: { type: GraphQLString },
    eventStartTime: { type: GraphQLString },
    eventEndTime: { type: GraphQLString },
    title: { type: GraphQLString },
    performers: { type: new GraphQLList(GraphQLString) },
    location: { type: GraphQLString },
    ticketPrice: { type: GraphQLString },
  },
});

const EventType = new GraphQLObjectType({
  name: 'Event',
  fields: {
    id: { type: GraphQLString },
    slug: { type: GraphQLString },
    isEvent: { type: GraphQLBoolean },
    eventName: { type: GraphQLString },
    types: { type: new GraphQLList(GraphQLString) },
    categories: { type: new GraphQLList(GraphQLString) },
    location: { type: GraphQLString },
    organizerName: { type: GraphQLString },
    description: { type: GraphQLString },
    schedules: { type: new GraphQLList(EventScheduleType) },
  },
});

const EventConnectionType = new GraphQLObjectType({
  name: 'EventConnection',
  fields: {
    items: { type: new GraphQLList(EventType) },
    hasMore: { type: GraphQLBoolean },
  },
});

// `fields` uses a thunk so `EventConditionInputType` can reference itself for
// the recursive `conditions` list required by the Unified Query DSL (AD-1).
const EventConditionInputType: GraphQLInputObjectType = new GraphQLInputObjectType({
  name: 'EventConditionInput',
  fields: () => ({
    field: { type: GraphQLString },
    operator: { type: GraphQLString },
    value: { type: JsonValueScalar },
    conditions: { type: new GraphQLList(EventConditionInputType) },
  }),
});

const EventQueryInputType = new GraphQLInputObjectType({
  name: 'EventQueryInput',
  fields: {
    operator: { type: GraphQLString },
    conditions: { type: new GraphQLList(EventConditionInputType) },
  },
});

interface EventsQueryArgs {
  query?: EventQueryDsl;
  page?: number;
  pageSize?: number;
}

const QueryType = new GraphQLObjectType({
  name: 'Query',
  fields: {
    events: {
      type: EventConnectionType,
      args: {
        query: { type: EventQueryInputType },
        page: { type: GraphQLInt },
        pageSize: { type: GraphQLInt },
      },
      async resolve(_root: unknown, args: EventsQueryArgs) {
        return getEventsForQuery(args.query, args.page ?? 1, args.pageSize ?? 6);
      },
    },
  },
});

export const eventGraphQLSchema = new GraphQLSchema({ query: QueryType });

export async function executeEventQuery(source: string, variableValues?: Record<string, unknown>) {
  return graphql({ schema: eventGraphQLSchema, source, variableValues });
}
