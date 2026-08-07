export type EventQueryConditionInput = { conditions?: InputMaybe<Array<EventQueryConditionInput>>; field?: InputMaybe<Scalars['String']['input']>; operator?: InputMaybe<Scalars['String']['input']>; value?: InputMaybe<Scalars['JSON']['input']>; };
export type Exact<T extends { [key: string]: unknown }> = { [K in keyof T]: T[K] };
export type Incremental<T> = T | { [P in keyof T]?: P extends ' $fragmentName' | '__typename' ? T[P] : never };
/** Internal type. DO NOT USE DIRECTLY. */
import { GraphQLClient } from 'graphql-request';
type RequestInit = any;
import { DocumentTypeDecoration } from '@graphql-typed-document-node/core';
import { useQuery, useMutation, UseQueryOptions, UseMutationOptions } from '@tanstack/react-query';
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

export type AddressSuggestion = {
  __typename?: 'AddressSuggestion';
  description: Scalars['String']['output'];
  placeId: Scalars['String']['output'];
};

export type Coordinates = {
  __typename?: 'Coordinates';
  lat: Scalars['Float']['output'];
  lng: Scalars['Float']['output'];
};

export type CreateUserLocationInput = {
  address?: InputMaybe<Scalars['String']['input']>;
  latitude?: InputMaybe<Scalars['Float']['input']>;
  longitude?: InputMaybe<Scalars['Float']['input']>;
  name: Scalars['String']['input'];
  placeId?: InputMaybe<Scalars['String']['input']>;
  radius: Scalars['Int']['input'];
};

export type Event = {
  __typename?: 'Event';
  categories?: Maybe<Array<EventCategory>>;
  createdAt: Scalars['String']['output'];
  description?: Maybe<Scalars['String']['output']>;
  eventName: Scalars['String']['output'];
  id: Scalars['ID']['output'];
  imageUrl?: Maybe<Scalars['String']['output']>;
  isAddedToCalendar: Scalars['Boolean']['output'];
  isFavorited: Scalars['Boolean']['output'];
  location?: Maybe<Scalars['String']['output']>;
  originalPostUrl?: Maybe<Scalars['String']['output']>;
  postId?: Maybe<Scalars['ID']['output']>;
  schedules: Array<Schedule>;
  slug: Scalars['String']['output'];
  sourcePostUrl?: Maybe<Scalars['String']['output']>;
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
  ReligionAndSpirituality = 'RELIGION_AND_SPIRITUALITY',
  SportsAndFitness = 'SPORTS_AND_FITNESS'
}

export type EventConnection = {
  __typename?: 'EventConnection';
  hasMore: Scalars['Boolean']['output'];
  items: Array<Event>;
  totalCount: Scalars['Int']['output'];
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

export enum GeolocationProvider {
  Geoapify = 'GEOAPIFY'
}

export type LocationDetails = {
  __typename?: 'LocationDetails';
  coordinates: Coordinates;
  formattedAddress?: Maybe<Scalars['String']['output']>;
  placeId?: Maybe<Scalars['String']['output']>;
  placeName?: Maybe<Scalars['String']['output']>;
  provider?: Maybe<GeolocationProvider>;
  timezone?: Maybe<Scalars['String']['output']>;
};

export type Me = {
  __typename?: 'Me';
  email: Scalars['String']['output'];
  id: Scalars['ID']['output'];
  role: Scalars['String']['output'];
};

export type Mutation = {
  __typename?: 'Mutation';
  createUserLocation: UserLocation;
  deleteUserLocation: UserLocation;
  registerFcmToken: Scalars['Boolean']['output'];
  toggleCalendarAddition: ToggleCalendarAdditionResult;
  toggleFavorite: ToggleFavoriteResult;
  unregisterFcmToken: Scalars['Boolean']['output'];
  updateUserLocation: UserLocation;
  updateUserSettings: UserSettings;
};


export type MutationCreateUserLocationArgs = {
  input: CreateUserLocationInput;
};


export type MutationDeleteUserLocationArgs = {
  action: SoftDeleteAction;
  id: Scalars['ID']['input'];
};


export type MutationRegisterFcmTokenArgs = {
  token: Scalars['String']['input'];
};


export type MutationToggleCalendarAdditionArgs = {
  eventId: Scalars['ID']['input'];
  scheduleId: Scalars['ID']['input'];
};


export type MutationToggleFavoriteArgs = {
  eventId: Scalars['ID']['input'];
};


export type MutationUnregisterFcmTokenArgs = {
  token: Scalars['String']['input'];
};


export type MutationUpdateUserLocationArgs = {
  id: Scalars['ID']['input'];
  input: UpdateUserLocationInput;
};


export type MutationUpdateUserSettingsArgs = {
  input: UpdateUserSettingsInput;
};

export type Query = {
  __typename?: 'Query';
  addressAutocomplete: Array<AddressSuggestion>;
  event?: Maybe<Event>;
  eventBySlug?: Maybe<Event>;
  events: EventConnection;
  health: Scalars['Boolean']['output'];
  me: Me;
  myLocations: Array<UserLocation>;
  mySettings: UserSettings;
  previewLocation: LocationDetails;
  socialMediaAccountProfileByAccountId?: Maybe<SocialMediaAccountProfile>;
};


export type QueryAddressAutocompleteArgs = {
  input: Scalars['String']['input'];
};


export type QueryEventArgs = {
  id: Scalars['ID']['input'];
};


export type QueryEventBySlugArgs = {
  slug: Scalars['String']['input'];
};


export type QueryEventsArgs = {
  limit?: InputMaybe<Scalars['Int']['input']>;
  offset?: InputMaybe<Scalars['Int']['input']>;
  query?: InputMaybe<EventQueryConditionInput>;
};


export type QueryPreviewLocationArgs = {
  latitude?: InputMaybe<Scalars['Float']['input']>;
  longitude?: InputMaybe<Scalars['Float']['input']>;
  placeId?: InputMaybe<Scalars['String']['input']>;
};


export type QuerySocialMediaAccountProfileByAccountIdArgs = {
  accountId: Scalars['String']['input'];
  platform: Scalars['String']['input'];
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
  isAddedToCalendar: Scalars['Boolean']['output'];
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

export type SocialMediaAccountProfile = {
  __typename?: 'SocialMediaAccountProfile';
  accountId: Scalars['String']['output'];
  defaultLocation?: Maybe<LocationDetails>;
  description?: Maybe<Scalars['String']['output']>;
  displayName: Scalars['String']['output'];
  id: Scalars['ID']['output'];
  lastPostDate?: Maybe<Scalars['String']['output']>;
  platform: Scalars['String']['output'];
  profileImageUrl?: Maybe<Scalars['String']['output']>;
  username: Scalars['String']['output'];
};

export enum SoftDeleteAction {
  Delete = 'DELETE',
  Restore = 'RESTORE'
}

export type ToggleCalendarAdditionResult = {
  __typename?: 'ToggleCalendarAdditionResult';
  eventId: Scalars['ID']['output'];
  isAddedToCalendar: Scalars['Boolean']['output'];
  scheduleId: Scalars['ID']['output'];
};

export type ToggleFavoriteResult = {
  __typename?: 'ToggleFavoriteResult';
  eventId: Scalars['ID']['output'];
  isFavorited: Scalars['Boolean']['output'];
};

export type UpdateUserLocationInput = {
  address?: InputMaybe<Scalars['String']['input']>;
  latitude?: InputMaybe<Scalars['Float']['input']>;
  longitude?: InputMaybe<Scalars['Float']['input']>;
  name?: InputMaybe<Scalars['String']['input']>;
  placeId?: InputMaybe<Scalars['String']['input']>;
  radius?: InputMaybe<Scalars['Int']['input']>;
};

export type UpdateUserSettingsInput = {
  hidePastEventsAfterDays?: InputMaybe<Scalars['Int']['input']>;
  pushNotificationsEnabled?: InputMaybe<Scalars['Boolean']['input']>;
};

export type UserLocation = {
  __typename?: 'UserLocation';
  createdAt: Scalars['String']['output'];
  id: Scalars['ID']['output'];
  locationDetails: LocationDetails;
  name: Scalars['String']['output'];
  radius: Scalars['Int']['output'];
  updatedAt: Scalars['String']['output'];
};

export type UserSettings = {
  __typename?: 'UserSettings';
  createdAt: Scalars['String']['output'];
  hidePastEventsAfterDays: Scalars['Int']['output'];
  id: Scalars['ID']['output'];
  pushNotificationsEnabled: Scalars['Boolean']['output'];
  updatedAt: Scalars['String']['output'];
};









export type MeQueryVariables = Exact<{ [key: string]: never; }>;


export type MeQuery = { me: { id: string, email: string, role: string } };

export type ToggleFavoriteMutationVariables = Exact<{
  eventId: string | number;
}>;


export type ToggleFavoriteMutation = { toggleFavorite: { eventId: string, isFavorited: boolean } };

export type ToggleCalendarAdditionMutationVariables = Exact<{
  eventId: string | number;
  scheduleId: string | number;
}>;


export type ToggleCalendarAdditionMutation = { toggleCalendarAddition: { eventId: string, scheduleId: string, isAddedToCalendar: boolean } };

export type GetEventsQueryVariables = Exact<{
  limit?: number | null | undefined;
  offset?: number | null | undefined;
  query?: EventQueryConditionInput | null | undefined;
}>;


export type GetEventsQuery = { events: { hasMore: boolean, totalCount: number, items: Array<{ id: string, eventName: string, slug: string, isFavorited: boolean, imageUrl: string | null, location: string | null, types: Array<EventType> | null, categories: Array<EventCategory> | null, schedules: Array<{ id: string, isMainSchedule: boolean, eventStartDate: string, ticketPrice: string | null }> }> } };

export type GetFavoritedEventIdsQueryVariables = Exact<{
  query?: EventQueryConditionInput | null | undefined;
}>;


export type GetFavoritedEventIdsQuery = { events: { totalCount: number, items: Array<{ id: string }> } };

export type GetEventBySlugQueryVariables = Exact<{
  slug: string;
}>;


export type GetEventBySlugQuery = { eventBySlug: { id: string, eventName: string, slug: string, description: string | null, location: string | null, types: Array<EventType> | null, categories: Array<EventCategory> | null, imageUrl: string | null, sourcePostUrl: string | null, originalPostUrl: string | null, isFavorited: boolean, schedules: Array<{ id: string, isMainSchedule: boolean, eventStartDate: string, isAddedToCalendar: boolean, eventEndDate: string | null, eventStartTime: string | null, eventEndTime: string | null, performers: Array<string> | null, location: string | null, ticketPrice: string | null, ticketUrl: string | null, registrationUrl: string | null, locationDetails: { placeName: string | null, placeId: string | null, formattedAddress: string | null, timezone: string | null, coordinates: { lat: number, lng: number } } | null }> } | null };

export type GetEventForIcsExportQueryVariables = Exact<{
  id: string | number;
}>;


export type GetEventForIcsExportQuery = { event: { id: string, eventName: string, slug: string, description: string | null, location: string | null, schedules: Array<{ id: string, eventStartDate: string, eventEndDate: string | null, eventStartTime: string | null, eventEndTime: string | null, timezone: string | null, location: string | null, locationDetails: { formattedAddress: string | null } | null }> } | null };

export type GetEventsForCalendarQueryVariables = Exact<{
  limit?: number | null | undefined;
  offset?: number | null | undefined;
  query?: EventQueryConditionInput | null | undefined;
}>;


export type GetEventsForCalendarQuery = { events: { hasMore: boolean, totalCount: number, items: Array<{ id: string, eventName: string, slug: string, imageUrl: string | null, location: string | null, types: Array<EventType> | null, categories: Array<EventCategory> | null, schedules: Array<{ id: string, isMainSchedule: boolean, eventStartDate: string, eventEndDate: string | null, eventStartTime: string | null, eventEndTime: string | null, ticketPrice: string | null }> }> } };

export type GetEventsForMyCalendarQueryVariables = Exact<{
  limit?: number | null | undefined;
  offset?: number | null | undefined;
  query?: EventQueryConditionInput | null | undefined;
}>;


export type GetEventsForMyCalendarQuery = { events: { hasMore: boolean, totalCount: number, items: Array<{ id: string, eventName: string, slug: string, imageUrl: string | null, location: string | null, types: Array<EventType> | null, categories: Array<EventCategory> | null, isFavorited: boolean, schedules: Array<{ id: string, isMainSchedule: boolean, eventStartDate: string, eventEndDate: string | null, eventStartTime: string | null, eventEndTime: string | null, ticketPrice: string | null, isAddedToCalendar: boolean }> }> } };

export type CreateUserLocationMutationVariables = Exact<{
  input: CreateUserLocationInput;
}>;


export type CreateUserLocationMutation = { createUserLocation: { id: string, name: string, radius: number, createdAt: string, updatedAt: string, locationDetails: { formattedAddress: string | null, placeName: string | null, coordinates: { lat: number, lng: number } } } };

export type UpdateUserLocationMutationVariables = Exact<{
  id: string | number;
  input: UpdateUserLocationInput;
}>;


export type UpdateUserLocationMutation = { updateUserLocation: { id: string, name: string, radius: number, createdAt: string, updatedAt: string, locationDetails: { formattedAddress: string | null, placeName: string | null, coordinates: { lat: number, lng: number } } } };

export type DeleteUserLocationMutationVariables = Exact<{
  id: string | number;
  action: SoftDeleteAction;
}>;


export type DeleteUserLocationMutation = { deleteUserLocation: { id: string } };

export type GetMyLocationsQueryVariables = Exact<{ [key: string]: never; }>;


export type GetMyLocationsQuery = { myLocations: Array<{ id: string, name: string, radius: number, createdAt: string, updatedAt: string, locationDetails: { formattedAddress: string | null, placeName: string | null, coordinates: { lat: number, lng: number } } }> };

export type AddressAutocompleteQueryVariables = Exact<{
  input: string;
}>;


export type AddressAutocompleteQuery = { addressAutocomplete: Array<{ placeId: string, description: string }> };

export type PreviewLocationQueryVariables = Exact<{
  latitude?: number | null | undefined;
  longitude?: number | null | undefined;
  placeId?: string | null | undefined;
}>;


export type PreviewLocationQuery = { previewLocation: { formattedAddress: string | null, placeName: string | null, provider: GeolocationProvider | null, coordinates: { lat: number, lng: number } } };

export type UpdateUserSettingsMutationVariables = Exact<{
  input: UpdateUserSettingsInput;
}>;


export type UpdateUserSettingsMutation = { updateUserSettings: { id: string, hidePastEventsAfterDays: number, pushNotificationsEnabled: boolean, updatedAt: string } };

export type RegisterFcmTokenMutationVariables = Exact<{
  token: string;
}>;


export type RegisterFcmTokenMutation = { registerFcmToken: boolean };

export type GetMySettingsQueryVariables = Exact<{ [key: string]: never; }>;


export type GetMySettingsQuery = { mySettings: { id: string, hidePastEventsAfterDays: number, pushNotificationsEnabled: boolean, createdAt: string, updatedAt: string } };


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

export const MeDocument = new TypedDocumentString(`
    query me {
  me {
    id
    email
    role
  }
}
    `);

export const useMeQuery = <
      TData = MeQuery,
      TError = unknown
    >(
      client: GraphQLClient,
      variables?: MeQueryVariables,
      options?: Omit<UseQueryOptions<MeQuery, TError, TData>, 'queryKey'> & { queryKey?: UseQueryOptions<MeQuery, TError, TData>['queryKey'] },
      headers?: RequestInit['headers']
    ) => {
    
    return useQuery<MeQuery, TError, TData>(
      {
    queryKey: variables === undefined ? ['me'] : ['me', variables],
    queryFn: fetcher<MeQuery, MeQueryVariables>(client, MeDocument, variables, headers),
    ...options
  }
    )};

export const ToggleFavoriteDocument = new TypedDocumentString(`
    mutation toggleFavorite($eventId: ID!) {
  toggleFavorite(eventId: $eventId) {
    eventId
    isFavorited
  }
}
    `);

export const useToggleFavoriteMutation = <
      TError = unknown,
      TContext = unknown
    >(
      client: GraphQLClient,
      options?: UseMutationOptions<ToggleFavoriteMutation, TError, ToggleFavoriteMutationVariables, TContext>,
      headers?: RequestInit['headers']
    ) => {
    
    return useMutation<ToggleFavoriteMutation, TError, ToggleFavoriteMutationVariables, TContext>(
      {
    mutationKey: ['toggleFavorite'],
    mutationFn: (variables?: ToggleFavoriteMutationVariables) => fetcher<ToggleFavoriteMutation, ToggleFavoriteMutationVariables>(client, ToggleFavoriteDocument, variables, headers)(),
    ...options
  }
    )};

export const ToggleCalendarAdditionDocument = new TypedDocumentString(`
    mutation toggleCalendarAddition($eventId: ID!, $scheduleId: ID!) {
  toggleCalendarAddition(eventId: $eventId, scheduleId: $scheduleId) {
    eventId
    scheduleId
    isAddedToCalendar
  }
}
    `);

export const useToggleCalendarAdditionMutation = <
      TError = unknown,
      TContext = unknown
    >(
      client: GraphQLClient,
      options?: UseMutationOptions<ToggleCalendarAdditionMutation, TError, ToggleCalendarAdditionMutationVariables, TContext>,
      headers?: RequestInit['headers']
    ) => {
    
    return useMutation<ToggleCalendarAdditionMutation, TError, ToggleCalendarAdditionMutationVariables, TContext>(
      {
    mutationKey: ['toggleCalendarAddition'],
    mutationFn: (variables?: ToggleCalendarAdditionMutationVariables) => fetcher<ToggleCalendarAdditionMutation, ToggleCalendarAdditionMutationVariables>(client, ToggleCalendarAdditionDocument, variables, headers)(),
    ...options
  }
    )};

export const GetEventsDocument = new TypedDocumentString(`
    query getEvents($limit: Int, $offset: Int, $query: EventQueryConditionInput) {
  events(limit: $limit, offset: $offset, query: $query) {
    items {
      id
      eventName
      slug
      isFavorited
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

export const GetFavoritedEventIdsDocument = new TypedDocumentString(`
    query getFavoritedEventIds($query: EventQueryConditionInput) {
  events(query: $query) {
    items {
      id
    }
    totalCount
  }
}
    `);

export const useGetFavoritedEventIdsQuery = <
      TData = GetFavoritedEventIdsQuery,
      TError = unknown
    >(
      client: GraphQLClient,
      variables?: GetFavoritedEventIdsQueryVariables,
      options?: Omit<UseQueryOptions<GetFavoritedEventIdsQuery, TError, TData>, 'queryKey'> & { queryKey?: UseQueryOptions<GetFavoritedEventIdsQuery, TError, TData>['queryKey'] },
      headers?: RequestInit['headers']
    ) => {
    
    return useQuery<GetFavoritedEventIdsQuery, TError, TData>(
      {
    queryKey: variables === undefined ? ['getFavoritedEventIds'] : ['getFavoritedEventIds', variables],
    queryFn: fetcher<GetFavoritedEventIdsQuery, GetFavoritedEventIdsQueryVariables>(client, GetFavoritedEventIdsDocument, variables, headers),
    ...options
  }
    )};

export const GetEventBySlugDocument = new TypedDocumentString(`
    query getEventBySlug($slug: String!) {
  eventBySlug(slug: $slug) {
    id
    eventName
    slug
    description
    location
    types
    categories
    imageUrl
    sourcePostUrl
    originalPostUrl
    isFavorited
    schedules {
      id
      isMainSchedule
      eventStartDate
      isAddedToCalendar
      eventEndDate
      eventStartTime
      eventEndTime
      performers
      location
      locationDetails {
        coordinates {
          lat
          lng
        }
        placeName
        placeId
        formattedAddress
        timezone
      }
      ticketPrice
      ticketUrl
      registrationUrl
    }
  }
}
    `);

export const useGetEventBySlugQuery = <
      TData = GetEventBySlugQuery,
      TError = unknown
    >(
      client: GraphQLClient,
      variables: GetEventBySlugQueryVariables,
      options?: Omit<UseQueryOptions<GetEventBySlugQuery, TError, TData>, 'queryKey'> & { queryKey?: UseQueryOptions<GetEventBySlugQuery, TError, TData>['queryKey'] },
      headers?: RequestInit['headers']
    ) => {
    
    return useQuery<GetEventBySlugQuery, TError, TData>(
      {
    queryKey: ['getEventBySlug', variables],
    queryFn: fetcher<GetEventBySlugQuery, GetEventBySlugQueryVariables>(client, GetEventBySlugDocument, variables, headers),
    ...options
  }
    )};

export const GetEventForIcsExportDocument = new TypedDocumentString(`
    query getEventForIcsExport($id: ID!) {
  event(id: $id) {
    id
    eventName
    slug
    description
    location
    schedules {
      id
      eventStartDate
      eventEndDate
      eventStartTime
      eventEndTime
      timezone
      location
      locationDetails {
        formattedAddress
      }
    }
  }
}
    `);

export const useGetEventForIcsExportQuery = <
      TData = GetEventForIcsExportQuery,
      TError = unknown
    >(
      client: GraphQLClient,
      variables: GetEventForIcsExportQueryVariables,
      options?: Omit<UseQueryOptions<GetEventForIcsExportQuery, TError, TData>, 'queryKey'> & { queryKey?: UseQueryOptions<GetEventForIcsExportQuery, TError, TData>['queryKey'] },
      headers?: RequestInit['headers']
    ) => {
    
    return useQuery<GetEventForIcsExportQuery, TError, TData>(
      {
    queryKey: ['getEventForIcsExport', variables],
    queryFn: fetcher<GetEventForIcsExportQuery, GetEventForIcsExportQueryVariables>(client, GetEventForIcsExportDocument, variables, headers),
    ...options
  }
    )};

export const GetEventsForCalendarDocument = new TypedDocumentString(`
    query getEventsForCalendar($limit: Int, $offset: Int, $query: EventQueryConditionInput) {
  events(limit: $limit, offset: $offset, query: $query) {
    items {
      id
      eventName
      slug
      imageUrl
      location
      types
      categories
      schedules {
        id
        isMainSchedule
        eventStartDate
        eventEndDate
        eventStartTime
        eventEndTime
        ticketPrice
      }
    }
    hasMore
    totalCount
  }
}
    `);

export const useGetEventsForCalendarQuery = <
      TData = GetEventsForCalendarQuery,
      TError = unknown
    >(
      client: GraphQLClient,
      variables?: GetEventsForCalendarQueryVariables,
      options?: Omit<UseQueryOptions<GetEventsForCalendarQuery, TError, TData>, 'queryKey'> & { queryKey?: UseQueryOptions<GetEventsForCalendarQuery, TError, TData>['queryKey'] },
      headers?: RequestInit['headers']
    ) => {
    
    return useQuery<GetEventsForCalendarQuery, TError, TData>(
      {
    queryKey: variables === undefined ? ['getEventsForCalendar'] : ['getEventsForCalendar', variables],
    queryFn: fetcher<GetEventsForCalendarQuery, GetEventsForCalendarQueryVariables>(client, GetEventsForCalendarDocument, variables, headers),
    ...options
  }
    )};

export const GetEventsForMyCalendarDocument = new TypedDocumentString(`
    query getEventsForMyCalendar($limit: Int, $offset: Int, $query: EventQueryConditionInput) {
  events(limit: $limit, offset: $offset, query: $query) {
    items {
      id
      eventName
      slug
      imageUrl
      location
      types
      categories
      isFavorited
      schedules {
        id
        isMainSchedule
        eventStartDate
        eventEndDate
        eventStartTime
        eventEndTime
        ticketPrice
        isAddedToCalendar
      }
    }
    hasMore
    totalCount
  }
}
    `);

export const useGetEventsForMyCalendarQuery = <
      TData = GetEventsForMyCalendarQuery,
      TError = unknown
    >(
      client: GraphQLClient,
      variables?: GetEventsForMyCalendarQueryVariables,
      options?: Omit<UseQueryOptions<GetEventsForMyCalendarQuery, TError, TData>, 'queryKey'> & { queryKey?: UseQueryOptions<GetEventsForMyCalendarQuery, TError, TData>['queryKey'] },
      headers?: RequestInit['headers']
    ) => {
    
    return useQuery<GetEventsForMyCalendarQuery, TError, TData>(
      {
    queryKey: variables === undefined ? ['getEventsForMyCalendar'] : ['getEventsForMyCalendar', variables],
    queryFn: fetcher<GetEventsForMyCalendarQuery, GetEventsForMyCalendarQueryVariables>(client, GetEventsForMyCalendarDocument, variables, headers),
    ...options
  }
    )};

export const CreateUserLocationDocument = new TypedDocumentString(`
    mutation createUserLocation($input: CreateUserLocationInput!) {
  createUserLocation(input: $input) {
    id
    name
    locationDetails {
      formattedAddress
      placeName
      coordinates {
        lat
        lng
      }
    }
    radius
    createdAt
    updatedAt
  }
}
    `);

export const useCreateUserLocationMutation = <
      TError = unknown,
      TContext = unknown
    >(
      client: GraphQLClient,
      options?: UseMutationOptions<CreateUserLocationMutation, TError, CreateUserLocationMutationVariables, TContext>,
      headers?: RequestInit['headers']
    ) => {
    
    return useMutation<CreateUserLocationMutation, TError, CreateUserLocationMutationVariables, TContext>(
      {
    mutationKey: ['createUserLocation'],
    mutationFn: (variables?: CreateUserLocationMutationVariables) => fetcher<CreateUserLocationMutation, CreateUserLocationMutationVariables>(client, CreateUserLocationDocument, variables, headers)(),
    ...options
  }
    )};

export const UpdateUserLocationDocument = new TypedDocumentString(`
    mutation updateUserLocation($id: ID!, $input: UpdateUserLocationInput!) {
  updateUserLocation(id: $id, input: $input) {
    id
    name
    locationDetails {
      formattedAddress
      placeName
      coordinates {
        lat
        lng
      }
    }
    radius
    createdAt
    updatedAt
  }
}
    `);

export const useUpdateUserLocationMutation = <
      TError = unknown,
      TContext = unknown
    >(
      client: GraphQLClient,
      options?: UseMutationOptions<UpdateUserLocationMutation, TError, UpdateUserLocationMutationVariables, TContext>,
      headers?: RequestInit['headers']
    ) => {
    
    return useMutation<UpdateUserLocationMutation, TError, UpdateUserLocationMutationVariables, TContext>(
      {
    mutationKey: ['updateUserLocation'],
    mutationFn: (variables?: UpdateUserLocationMutationVariables) => fetcher<UpdateUserLocationMutation, UpdateUserLocationMutationVariables>(client, UpdateUserLocationDocument, variables, headers)(),
    ...options
  }
    )};

export const DeleteUserLocationDocument = new TypedDocumentString(`
    mutation deleteUserLocation($id: ID!, $action: SoftDeleteAction!) {
  deleteUserLocation(id: $id, action: $action) {
    id
  }
}
    `);

export const useDeleteUserLocationMutation = <
      TError = unknown,
      TContext = unknown
    >(
      client: GraphQLClient,
      options?: UseMutationOptions<DeleteUserLocationMutation, TError, DeleteUserLocationMutationVariables, TContext>,
      headers?: RequestInit['headers']
    ) => {
    
    return useMutation<DeleteUserLocationMutation, TError, DeleteUserLocationMutationVariables, TContext>(
      {
    mutationKey: ['deleteUserLocation'],
    mutationFn: (variables?: DeleteUserLocationMutationVariables) => fetcher<DeleteUserLocationMutation, DeleteUserLocationMutationVariables>(client, DeleteUserLocationDocument, variables, headers)(),
    ...options
  }
    )};

export const GetMyLocationsDocument = new TypedDocumentString(`
    query getMyLocations {
  myLocations {
    id
    name
    locationDetails {
      formattedAddress
      placeName
      coordinates {
        lat
        lng
      }
    }
    radius
    createdAt
    updatedAt
  }
}
    `);

export const useGetMyLocationsQuery = <
      TData = GetMyLocationsQuery,
      TError = unknown
    >(
      client: GraphQLClient,
      variables?: GetMyLocationsQueryVariables,
      options?: Omit<UseQueryOptions<GetMyLocationsQuery, TError, TData>, 'queryKey'> & { queryKey?: UseQueryOptions<GetMyLocationsQuery, TError, TData>['queryKey'] },
      headers?: RequestInit['headers']
    ) => {
    
    return useQuery<GetMyLocationsQuery, TError, TData>(
      {
    queryKey: variables === undefined ? ['getMyLocations'] : ['getMyLocations', variables],
    queryFn: fetcher<GetMyLocationsQuery, GetMyLocationsQueryVariables>(client, GetMyLocationsDocument, variables, headers),
    ...options
  }
    )};

export const AddressAutocompleteDocument = new TypedDocumentString(`
    query addressAutocomplete($input: String!) {
  addressAutocomplete(input: $input) {
    placeId
    description
  }
}
    `);

export const useAddressAutocompleteQuery = <
      TData = AddressAutocompleteQuery,
      TError = unknown
    >(
      client: GraphQLClient,
      variables: AddressAutocompleteQueryVariables,
      options?: Omit<UseQueryOptions<AddressAutocompleteQuery, TError, TData>, 'queryKey'> & { queryKey?: UseQueryOptions<AddressAutocompleteQuery, TError, TData>['queryKey'] },
      headers?: RequestInit['headers']
    ) => {
    
    return useQuery<AddressAutocompleteQuery, TError, TData>(
      {
    queryKey: ['addressAutocomplete', variables],
    queryFn: fetcher<AddressAutocompleteQuery, AddressAutocompleteQueryVariables>(client, AddressAutocompleteDocument, variables, headers),
    ...options
  }
    )};

export const PreviewLocationDocument = new TypedDocumentString(`
    query previewLocation($latitude: Float, $longitude: Float, $placeId: String) {
  previewLocation(latitude: $latitude, longitude: $longitude, placeId: $placeId) {
    formattedAddress
    placeName
    coordinates {
      lat
      lng
    }
    provider
  }
}
    `);

export const usePreviewLocationQuery = <
      TData = PreviewLocationQuery,
      TError = unknown
    >(
      client: GraphQLClient,
      variables?: PreviewLocationQueryVariables,
      options?: Omit<UseQueryOptions<PreviewLocationQuery, TError, TData>, 'queryKey'> & { queryKey?: UseQueryOptions<PreviewLocationQuery, TError, TData>['queryKey'] },
      headers?: RequestInit['headers']
    ) => {
    
    return useQuery<PreviewLocationQuery, TError, TData>(
      {
    queryKey: variables === undefined ? ['previewLocation'] : ['previewLocation', variables],
    queryFn: fetcher<PreviewLocationQuery, PreviewLocationQueryVariables>(client, PreviewLocationDocument, variables, headers),
    ...options
  }
    )};

export const UpdateUserSettingsDocument = new TypedDocumentString(`
    mutation updateUserSettings($input: UpdateUserSettingsInput!) {
  updateUserSettings(input: $input) {
    id
    hidePastEventsAfterDays
    pushNotificationsEnabled
    updatedAt
  }
}
    `);

export const useUpdateUserSettingsMutation = <
      TError = unknown,
      TContext = unknown
    >(
      client: GraphQLClient,
      options?: UseMutationOptions<UpdateUserSettingsMutation, TError, UpdateUserSettingsMutationVariables, TContext>,
      headers?: RequestInit['headers']
    ) => {
    
    return useMutation<UpdateUserSettingsMutation, TError, UpdateUserSettingsMutationVariables, TContext>(
      {
    mutationKey: ['updateUserSettings'],
    mutationFn: (variables?: UpdateUserSettingsMutationVariables) => fetcher<UpdateUserSettingsMutation, UpdateUserSettingsMutationVariables>(client, UpdateUserSettingsDocument, variables, headers)(),
    ...options
  }
    )};

export const RegisterFcmTokenDocument = new TypedDocumentString(`
    mutation registerFcmToken($token: String!) {
  registerFcmToken(token: $token)
}
    `);

export const useRegisterFcmTokenMutation = <
      TError = unknown,
      TContext = unknown
    >(
      client: GraphQLClient,
      options?: UseMutationOptions<RegisterFcmTokenMutation, TError, RegisterFcmTokenMutationVariables, TContext>,
      headers?: RequestInit['headers']
    ) => {
    
    return useMutation<RegisterFcmTokenMutation, TError, RegisterFcmTokenMutationVariables, TContext>(
      {
    mutationKey: ['registerFcmToken'],
    mutationFn: (variables?: RegisterFcmTokenMutationVariables) => fetcher<RegisterFcmTokenMutation, RegisterFcmTokenMutationVariables>(client, RegisterFcmTokenDocument, variables, headers)(),
    ...options
  }
    )};

export const GetMySettingsDocument = new TypedDocumentString(`
    query getMySettings {
  mySettings {
    id
    hidePastEventsAfterDays
    pushNotificationsEnabled
    createdAt
    updatedAt
  }
}
    `);

export const useGetMySettingsQuery = <
      TData = GetMySettingsQuery,
      TError = unknown
    >(
      client: GraphQLClient,
      variables?: GetMySettingsQueryVariables,
      options?: Omit<UseQueryOptions<GetMySettingsQuery, TError, TData>, 'queryKey'> & { queryKey?: UseQueryOptions<GetMySettingsQuery, TError, TData>['queryKey'] },
      headers?: RequestInit['headers']
    ) => {
    
    return useQuery<GetMySettingsQuery, TError, TData>(
      {
    queryKey: variables === undefined ? ['getMySettings'] : ['getMySettings', variables],
    queryFn: fetcher<GetMySettingsQuery, GetMySettingsQueryVariables>(client, GetMySettingsDocument, variables, headers),
    ...options
  }
    )};
