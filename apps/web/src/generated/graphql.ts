export type Exact<T extends { [key: string]: unknown }> = { [K in keyof T]: T[K] };
export type Incremental<T> = T | { [P in keyof T]?: P extends ' $fragmentName' | '__typename' ? T[P] : never };
/** Internal type. DO NOT USE DIRECTLY. */
import { GraphQLClient } from 'graphql-request';
type RequestInit = any;
import { DocumentTypeDecoration } from '@graphql-typed-document-node/core';
import { useQuery, UseQueryOptions } from '@tanstack/react-query';
export type Maybe<T> = T | null;
export type InputMaybe<T> = Maybe<T>;
export type MakeOptional<T, K extends keyof T> = Omit<T, K> & { [SubKey in K]?: Maybe<T[SubKey]> };
export type MakeMaybe<T, K extends keyof T> = Omit<T, K> & { [SubKey in K]: Maybe<T[SubKey]> };
export type MakeEmpty<T extends { [key: string]: unknown }, K extends keyof T> = { [_ in K]?: never };

function fetcher<TData, TVariables extends { [key: string]: any }>(client: GraphQLClient, query: TypedDocumentString<unknown, unknown>, variables?: TVariables, requestHeaders?: RequestInit['headers']) {
  return async (): Promise<TData> => client.request<TData>({
    document: query,
    variables,
    requestHeaders
  });
}
/** All built-in and custom scalars, mapped to their actual values */
export type Scalars = {
  ID: { input: string; output: string; }
  String: { input: string; output: string; }
  Boolean: { input: boolean; output: boolean; }
  Int: { input: number; output: number; }
  Float: { input: number; output: number; }
  JSON: { input: any; output: any; }
};

export type Coordinates = {
  __typename?: 'Coordinates';
  lat: Scalars['Float']['output'];
  lng: Scalars['Float']['output'];
};

export type Event = {
  __typename?: 'Event';
  categories?: Maybe<Array<EventCategory>>;
  createdAt: Scalars['String']['output'];
  description?: Maybe<Scalars['String']['output']>;
  eventName: Scalars['String']['output'];
  id: Scalars['ID']['output'];
  imageUrl?: Maybe<Scalars['String']['output']>;
  location?: Maybe<Scalars['String']['output']>;
  postId?: Maybe<Scalars['ID']['output']>;
  schedules: Array<Schedule>;
  sourceSocialMediaAccountId?: Maybe<Scalars['ID']['output']>;
  types?: Maybe<Array<EventType>>;
  updatedAt: Scalars['String']['output'];
};

export enum EventCategory {
  ArtsAndCulture = 'ARTS_AND_CULTURE',
  BusinessAndNetworking = 'BUSINESS_AND_NETWORKING',
  CharityAndCauses = 'CHARITY_AND_CAUSES',
  CivicAndCommunity = 'CIVIC_AND_COMMUNITY',
  FamilyAndKids = 'FAMILY_AND_KIDS',
  FoodAndDrink = 'FOOD_AND_DRINK',
  HealthAndWellness = 'HEALTH_AND_WELLNESS',
  HobbiesAndInterests = 'HOBBIES_AND_INTERESTS',
  Holiday = 'HOLIDAY',
  Music = 'MUSIC',
  Other = 'OTHER',
  SportsAndFitness = 'SPORTS_AND_FITNESS'
}

export type EventConnection = {
  __typename?: 'EventConnection';
  hasMore: Scalars['Boolean']['output'];
  items: Array<Event>;
  totalCount: Scalars['Int']['output'];
};

export type EventQueryConditionInput = {
  conditions?: InputMaybe<Array<EventQueryConditionInput>>;
  field?: InputMaybe<Scalars['String']['input']>;
  operator?: InputMaybe<Scalars['String']['input']>;
  value?: InputMaybe<Scalars['JSON']['input']>;
};

export enum EventType {
  Civic = 'CIVIC',
  Competition = 'COMPETITION',
  Exhibition = 'EXHIBITION',
  Festival = 'FESTIVAL',
  Fundraiser = 'FUNDRAISER',
  Gathering = 'GATHERING',
  Market = 'MARKET',
  Other = 'OTHER',
  Performance = 'PERFORMANCE',
  Promotion = 'PROMOTION',
  Seminar = 'SEMINAR',
  Workshop = 'WORKSHOP'
}

export type LocationDetails = {
  __typename?: 'LocationDetails';
  coordinates: Coordinates;
  formattedAddress?: Maybe<Scalars['String']['output']>;
  placeId?: Maybe<Scalars['String']['output']>;
  placeName?: Maybe<Scalars['String']['output']>;
  timezone?: Maybe<Scalars['String']['output']>;
};

export type Query = {
  __typename?: 'Query';
  event?: Maybe<Event>;
  events: EventConnection;
  health: Scalars['Boolean']['output'];
};


export type QueryEventArgs = {
  id: Scalars['ID']['input'];
};


export type QueryEventsArgs = {
  limit?: InputMaybe<Scalars['Int']['input']>;
  offset?: InputMaybe<Scalars['Int']['input']>;
  query?: InputMaybe<EventQueryConditionInput>;
};

export type Schedule = {
  __typename?: 'Schedule';
  createdAt: Scalars['String']['output'];
  eventEndDate?: Maybe<Scalars['String']['output']>;
  eventEndTime?: Maybe<Scalars['String']['output']>;
  eventId: Scalars['ID']['output'];
  eventStartDate: Scalars['String']['output'];
  eventStartTime?: Maybe<Scalars['String']['output']>;
  id: Scalars['ID']['output'];
  isMainSchedule: Scalars['Boolean']['output'];
  location?: Maybe<Scalars['String']['output']>;
  locationDetails?: Maybe<LocationDetails>;
  performers?: Maybe<Array<Scalars['String']['output']>>;
  registrationUrl?: Maybe<Scalars['String']['output']>;
  ticketPrice?: Maybe<Scalars['String']['output']>;
  ticketUrl?: Maybe<Scalars['String']['output']>;
  timezone?: Maybe<Scalars['String']['output']>;
  updatedAt: Scalars['String']['output'];
};



export type GetEventsQueryVariables = Exact<{
  limit?: number | null | undefined;
  offset?: number | null | undefined;
}>;


export type GetEventsQuery = { events: { hasMore: boolean, totalCount: number, items: Array<{ id: string, eventName: string, imageUrl: string | null, location: string | null, types: Array<EventType> | null, categories: Array<EventCategory> | null, schedules: Array<{ id: string, isMainSchedule: boolean, eventStartDate: string, ticketPrice: string | null }> }> } };


export class TypedDocumentString<TResult, TVariables>
  extends String
  implements DocumentTypeDecoration<TResult, TVariables>
{
  __apiType?: NonNullable<DocumentTypeDecoration<TResult, TVariables>['__apiType']>;
  private value: string;
  public __meta__?: Record<string, any> | undefined;

  constructor(value: string, __meta__?: Record<string, any> | undefined) {
    super(value);
    this.value = value;
    this.__meta__ = __meta__;
  }

  override toString(): string & DocumentTypeDecoration<TResult, TVariables> {
    return this.value;
  }
}

export const GetEventsDocument = new TypedDocumentString(`
    query getEvents($limit: Int, $offset: Int) {
  events(limit: $limit, offset: $offset) {
    items {
      id
      eventName
      imageUrl
      location
      types
      categories
      schedules {
        id
        isMainSchedule
        eventStartDate
        ticketPrice
      }
    }
    hasMore
    totalCount
  }
}
    `);

export const useGetEventsQuery = <
      TData = GetEventsQuery,
      TError = unknown
    >(
      client: GraphQLClient,
      variables?: GetEventsQueryVariables,
      options?: Omit<UseQueryOptions<GetEventsQuery, TError, TData>, 'queryKey'> & { queryKey?: UseQueryOptions<GetEventsQuery, TError, TData>['queryKey'] },
      headers?: RequestInit['headers']
    ) => {
    
    return useQuery<GetEventsQuery, TError, TData>(
      {
    queryKey: variables === undefined ? ['getEvents'] : ['getEvents', variables],
    queryFn: fetcher<GetEventsQuery, GetEventsQueryVariables>(client, GetEventsDocument, variables, headers),
    ...options
  }
    )};
