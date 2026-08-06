/* eslint-disable */
import { GraphQLResolveInfo, GraphQLScalarType, GraphQLScalarTypeConfig } from 'graphql';
import { GraphQLContext } from '../lib/auth/context.js';
export type Maybe<T> = T | null;
export type InputMaybe<T> = Maybe<T>;
export type Exact<T extends { [key: string]: unknown }> = { [K in keyof T]: T[K] };
export type MakeOptional<T, K extends keyof T> = Omit<T, K> & { [SubKey in K]?: Maybe<T[SubKey]> };
export type MakeMaybe<T, K extends keyof T> = Omit<T, K> & { [SubKey in K]: Maybe<T[SubKey]> };
export type MakeEmpty<T extends { [key: string]: unknown }, K extends keyof T> = { [_ in K]?: never };
export type Incremental<T> = T | { [P in keyof T]?: P extends ' $fragmentName' | '__typename' ? T[P] : never };
export type RequireFields<T, K extends keyof T> = Omit<T, K> & { [P in K]-?: NonNullable<T[P]> };
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
  toggleCalendarAddition: ToggleCalendarAdditionResult;
  toggleFavorite: ToggleFavoriteResult;
  updateUserLocation: UserLocation;
};


export type MutationCreateUserLocationArgs = {
  input: CreateUserLocationInput;
};


export type MutationDeleteUserLocationArgs = {
  action: SoftDeleteAction;
  id: Scalars['ID']['input'];
};


export type MutationToggleCalendarAdditionArgs = {
  eventId: Scalars['ID']['input'];
  scheduleId: Scalars['ID']['input'];
};


export type MutationToggleFavoriteArgs = {
  eventId: Scalars['ID']['input'];
};


export type MutationUpdateUserLocationArgs = {
  id: Scalars['ID']['input'];
  input: UpdateUserLocationInput;
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
  previewLocation: LocationDetails;
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
  latitude: Scalars['Float']['input'];
  longitude: Scalars['Float']['input'];
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

export type UserLocation = {
  __typename?: 'UserLocation';
  createdAt: Scalars['String']['output'];
  id: Scalars['ID']['output'];
  locationDetails: LocationDetails;
  name: Scalars['String']['output'];
  radius: Scalars['Int']['output'];
  updatedAt: Scalars['String']['output'];
};

export type WithIndex<TObject> = TObject & Record<string, any>;
export type ResolversObject<TObject> = WithIndex<TObject>;

export type ResolverTypeWrapper<T> = Promise<T> | T;


export type ResolverWithResolve<TResult, TParent, TContext, TArgs> = {
  resolve: ResolverFn<TResult, TParent, TContext, TArgs>;
};
export type Resolver<TResult, TParent = {}, TContext = {}, TArgs = {}> = ResolverFn<TResult, TParent, TContext, TArgs> | ResolverWithResolve<TResult, TParent, TContext, TArgs>;

export type ResolverFn<TResult, TParent, TContext, TArgs> = (
  parent: TParent,
  args: TArgs,
  context: TContext,
  info: GraphQLResolveInfo
) => Promise<TResult> | TResult;

export type SubscriptionSubscribeFn<TResult, TParent, TContext, TArgs> = (
  parent: TParent,
  args: TArgs,
  context: TContext,
  info: GraphQLResolveInfo
) => AsyncIterable<TResult> | Promise<AsyncIterable<TResult>>;

export type SubscriptionResolveFn<TResult, TParent, TContext, TArgs> = (
  parent: TParent,
  args: TArgs,
  context: TContext,
  info: GraphQLResolveInfo
) => TResult | Promise<TResult>;

export interface SubscriptionSubscriberObject<TResult, TKey extends string, TParent, TContext, TArgs> {
  subscribe: SubscriptionSubscribeFn<{ [key in TKey]: TResult }, TParent, TContext, TArgs>;
  resolve?: SubscriptionResolveFn<TResult, { [key in TKey]: TResult }, TContext, TArgs>;
}

export interface SubscriptionResolverObject<TResult, TParent, TContext, TArgs> {
  subscribe: SubscriptionSubscribeFn<any, TParent, TContext, TArgs>;
  resolve: SubscriptionResolveFn<TResult, any, TContext, TArgs>;
}

export type SubscriptionObject<TResult, TKey extends string, TParent, TContext, TArgs> =
  | SubscriptionSubscriberObject<TResult, TKey, TParent, TContext, TArgs>
  | SubscriptionResolverObject<TResult, TParent, TContext, TArgs>;

export type SubscriptionResolver<TResult, TKey extends string, TParent = {}, TContext = {}, TArgs = {}> =
  | ((...args: any[]) => SubscriptionObject<TResult, TKey, TParent, TContext, TArgs>)
  | SubscriptionObject<TResult, TKey, TParent, TContext, TArgs>;

export type TypeResolveFn<TTypes, TParent = {}, TContext = {}> = (
  parent: TParent,
  context: TContext,
  info: GraphQLResolveInfo
) => Maybe<TTypes> | Promise<Maybe<TTypes>>;

export type IsTypeOfResolverFn<T = {}, TContext = {}> = (obj: T, context: TContext, info: GraphQLResolveInfo) => boolean | Promise<boolean>;

export type NextResolverFn<T> = () => Promise<T>;

export type DirectiveResolverFn<TResult = {}, TParent = {}, TContext = {}, TArgs = {}> = (
  next: NextResolverFn<TResult>,
  parent: TParent,
  args: TArgs,
  context: TContext,
  info: GraphQLResolveInfo
) => TResult | Promise<TResult>;



/** Mapping between all available schema types and the resolvers types */
export type ResolversTypes = ResolversObject<{
  AddressSuggestion: ResolverTypeWrapper<AddressSuggestion>;
  Boolean: ResolverTypeWrapper<Scalars['Boolean']['output']>;
  Coordinates: ResolverTypeWrapper<Coordinates>;
  CreateUserLocationInput: CreateUserLocationInput;
  Event: ResolverTypeWrapper<Event>;
  EventCategory: EventCategory;
  EventConnection: ResolverTypeWrapper<EventConnection>;
  EventQueryConditionInput: EventQueryConditionInput;
  EventType: EventType;
  Float: ResolverTypeWrapper<Scalars['Float']['output']>;
  GeolocationProvider: GeolocationProvider;
  ID: ResolverTypeWrapper<Scalars['ID']['output']>;
  Int: ResolverTypeWrapper<Scalars['Int']['output']>;
  JSON: ResolverTypeWrapper<Scalars['JSON']['output']>;
  LocationDetails: ResolverTypeWrapper<LocationDetails>;
  Me: ResolverTypeWrapper<Me>;
  Mutation: ResolverTypeWrapper<{}>;
  Query: ResolverTypeWrapper<{}>;
  Schedule: ResolverTypeWrapper<Schedule>;
  SoftDeleteAction: SoftDeleteAction;
  String: ResolverTypeWrapper<Scalars['String']['output']>;
  ToggleCalendarAdditionResult: ResolverTypeWrapper<ToggleCalendarAdditionResult>;
  ToggleFavoriteResult: ResolverTypeWrapper<ToggleFavoriteResult>;
  UpdateUserLocationInput: UpdateUserLocationInput;
  UserLocation: ResolverTypeWrapper<UserLocation>;
}>;

/** Mapping between all available schema types and the resolvers parents */
export type ResolversParentTypes = ResolversObject<{
  AddressSuggestion: AddressSuggestion;
  Boolean: Scalars['Boolean']['output'];
  Coordinates: Coordinates;
  CreateUserLocationInput: CreateUserLocationInput;
  Event: Event;
  EventConnection: EventConnection;
  EventQueryConditionInput: EventQueryConditionInput;
  Float: Scalars['Float']['output'];
  ID: Scalars['ID']['output'];
  Int: Scalars['Int']['output'];
  JSON: Scalars['JSON']['output'];
  LocationDetails: LocationDetails;
  Me: Me;
  Mutation: {};
  Query: {};
  Schedule: Schedule;
  String: Scalars['String']['output'];
  ToggleCalendarAdditionResult: ToggleCalendarAdditionResult;
  ToggleFavoriteResult: ToggleFavoriteResult;
  UpdateUserLocationInput: UpdateUserLocationInput;
  UserLocation: UserLocation;
}>;

export type AddressSuggestionResolvers<ContextType = GraphQLContext, ParentType extends ResolversParentTypes['AddressSuggestion'] = ResolversParentTypes['AddressSuggestion']> = ResolversObject<{
  description?: Resolver<ResolversTypes['String'], ParentType, ContextType>;
  placeId?: Resolver<ResolversTypes['String'], ParentType, ContextType>;
  __isTypeOf?: IsTypeOfResolverFn<ParentType, ContextType>;
}>;

export type CoordinatesResolvers<ContextType = GraphQLContext, ParentType extends ResolversParentTypes['Coordinates'] = ResolversParentTypes['Coordinates']> = ResolversObject<{
  lat?: Resolver<ResolversTypes['Float'], ParentType, ContextType>;
  lng?: Resolver<ResolversTypes['Float'], ParentType, ContextType>;
  __isTypeOf?: IsTypeOfResolverFn<ParentType, ContextType>;
}>;

export type EventResolvers<ContextType = GraphQLContext, ParentType extends ResolversParentTypes['Event'] = ResolversParentTypes['Event']> = ResolversObject<{
  categories?: Resolver<Maybe<Array<ResolversTypes['EventCategory']>>, ParentType, ContextType>;
  createdAt?: Resolver<ResolversTypes['String'], ParentType, ContextType>;
  description?: Resolver<Maybe<ResolversTypes['String']>, ParentType, ContextType>;
  eventName?: Resolver<ResolversTypes['String'], ParentType, ContextType>;
  id?: Resolver<ResolversTypes['ID'], ParentType, ContextType>;
  imageUrl?: Resolver<Maybe<ResolversTypes['String']>, ParentType, ContextType>;
  isAddedToCalendar?: Resolver<ResolversTypes['Boolean'], ParentType, ContextType>;
  isFavorited?: Resolver<ResolversTypes['Boolean'], ParentType, ContextType>;
  location?: Resolver<Maybe<ResolversTypes['String']>, ParentType, ContextType>;
  originalPostUrl?: Resolver<Maybe<ResolversTypes['String']>, ParentType, ContextType>;
  postId?: Resolver<Maybe<ResolversTypes['ID']>, ParentType, ContextType>;
  schedules?: Resolver<Array<ResolversTypes['Schedule']>, ParentType, ContextType>;
  slug?: Resolver<ResolversTypes['String'], ParentType, ContextType>;
  sourcePostUrl?: Resolver<Maybe<ResolversTypes['String']>, ParentType, ContextType>;
  sourceSocialMediaAccountId?: Resolver<Maybe<ResolversTypes['ID']>, ParentType, ContextType>;
  types?: Resolver<Maybe<Array<ResolversTypes['EventType']>>, ParentType, ContextType>;
  updatedAt?: Resolver<ResolversTypes['String'], ParentType, ContextType>;
  __isTypeOf?: IsTypeOfResolverFn<ParentType, ContextType>;
}>;

export type EventConnectionResolvers<ContextType = GraphQLContext, ParentType extends ResolversParentTypes['EventConnection'] = ResolversParentTypes['EventConnection']> = ResolversObject<{
  hasMore?: Resolver<ResolversTypes['Boolean'], ParentType, ContextType>;
  items?: Resolver<Array<ResolversTypes['Event']>, ParentType, ContextType>;
  totalCount?: Resolver<ResolversTypes['Int'], ParentType, ContextType>;
  __isTypeOf?: IsTypeOfResolverFn<ParentType, ContextType>;
}>;

export interface JsonScalarConfig extends GraphQLScalarTypeConfig<ResolversTypes['JSON'], any> {
  name: 'JSON';
}

export type LocationDetailsResolvers<ContextType = GraphQLContext, ParentType extends ResolversParentTypes['LocationDetails'] = ResolversParentTypes['LocationDetails']> = ResolversObject<{
  coordinates?: Resolver<ResolversTypes['Coordinates'], ParentType, ContextType>;
  formattedAddress?: Resolver<Maybe<ResolversTypes['String']>, ParentType, ContextType>;
  placeId?: Resolver<Maybe<ResolversTypes['String']>, ParentType, ContextType>;
  placeName?: Resolver<Maybe<ResolversTypes['String']>, ParentType, ContextType>;
  provider?: Resolver<Maybe<ResolversTypes['GeolocationProvider']>, ParentType, ContextType>;
  timezone?: Resolver<Maybe<ResolversTypes['String']>, ParentType, ContextType>;
  __isTypeOf?: IsTypeOfResolverFn<ParentType, ContextType>;
}>;

export type MeResolvers<ContextType = GraphQLContext, ParentType extends ResolversParentTypes['Me'] = ResolversParentTypes['Me']> = ResolversObject<{
  email?: Resolver<ResolversTypes['String'], ParentType, ContextType>;
  id?: Resolver<ResolversTypes['ID'], ParentType, ContextType>;
  role?: Resolver<ResolversTypes['String'], ParentType, ContextType>;
  __isTypeOf?: IsTypeOfResolverFn<ParentType, ContextType>;
}>;

export type MutationResolvers<ContextType = GraphQLContext, ParentType extends ResolversParentTypes['Mutation'] = ResolversParentTypes['Mutation']> = ResolversObject<{
  createUserLocation?: Resolver<ResolversTypes['UserLocation'], ParentType, ContextType, RequireFields<MutationCreateUserLocationArgs, 'input'>>;
  deleteUserLocation?: Resolver<ResolversTypes['UserLocation'], ParentType, ContextType, RequireFields<MutationDeleteUserLocationArgs, 'action' | 'id'>>;
  toggleCalendarAddition?: Resolver<ResolversTypes['ToggleCalendarAdditionResult'], ParentType, ContextType, RequireFields<MutationToggleCalendarAdditionArgs, 'eventId' | 'scheduleId'>>;
  toggleFavorite?: Resolver<ResolversTypes['ToggleFavoriteResult'], ParentType, ContextType, RequireFields<MutationToggleFavoriteArgs, 'eventId'>>;
  updateUserLocation?: Resolver<ResolversTypes['UserLocation'], ParentType, ContextType, RequireFields<MutationUpdateUserLocationArgs, 'id' | 'input'>>;
}>;

export type QueryResolvers<ContextType = GraphQLContext, ParentType extends ResolversParentTypes['Query'] = ResolversParentTypes['Query']> = ResolversObject<{
  addressAutocomplete?: Resolver<Array<ResolversTypes['AddressSuggestion']>, ParentType, ContextType, RequireFields<QueryAddressAutocompleteArgs, 'input'>>;
  event?: Resolver<Maybe<ResolversTypes['Event']>, ParentType, ContextType, RequireFields<QueryEventArgs, 'id'>>;
  eventBySlug?: Resolver<Maybe<ResolversTypes['Event']>, ParentType, ContextType, RequireFields<QueryEventBySlugArgs, 'slug'>>;
  events?: Resolver<ResolversTypes['EventConnection'], ParentType, ContextType, Partial<QueryEventsArgs>>;
  health?: Resolver<ResolversTypes['Boolean'], ParentType, ContextType>;
  me?: Resolver<ResolversTypes['Me'], ParentType, ContextType>;
  myLocations?: Resolver<Array<ResolversTypes['UserLocation']>, ParentType, ContextType>;
  previewLocation?: Resolver<ResolversTypes['LocationDetails'], ParentType, ContextType, RequireFields<QueryPreviewLocationArgs, 'latitude' | 'longitude'>>;
}>;

export type ScheduleResolvers<ContextType = GraphQLContext, ParentType extends ResolversParentTypes['Schedule'] = ResolversParentTypes['Schedule']> = ResolversObject<{
  createdAt?: Resolver<ResolversTypes['String'], ParentType, ContextType>;
  eventEndDate?: Resolver<Maybe<ResolversTypes['String']>, ParentType, ContextType>;
  eventEndTime?: Resolver<Maybe<ResolversTypes['String']>, ParentType, ContextType>;
  eventId?: Resolver<ResolversTypes['ID'], ParentType, ContextType>;
  eventStartDate?: Resolver<ResolversTypes['String'], ParentType, ContextType>;
  eventStartTime?: Resolver<Maybe<ResolversTypes['String']>, ParentType, ContextType>;
  id?: Resolver<ResolversTypes['ID'], ParentType, ContextType>;
  isAddedToCalendar?: Resolver<ResolversTypes['Boolean'], ParentType, ContextType>;
  isMainSchedule?: Resolver<ResolversTypes['Boolean'], ParentType, ContextType>;
  location?: Resolver<Maybe<ResolversTypes['String']>, ParentType, ContextType>;
  locationDetails?: Resolver<Maybe<ResolversTypes['LocationDetails']>, ParentType, ContextType>;
  performers?: Resolver<Maybe<Array<ResolversTypes['String']>>, ParentType, ContextType>;
  registrationUrl?: Resolver<Maybe<ResolversTypes['String']>, ParentType, ContextType>;
  ticketPrice?: Resolver<Maybe<ResolversTypes['String']>, ParentType, ContextType>;
  ticketUrl?: Resolver<Maybe<ResolversTypes['String']>, ParentType, ContextType>;
  timezone?: Resolver<Maybe<ResolversTypes['String']>, ParentType, ContextType>;
  updatedAt?: Resolver<ResolversTypes['String'], ParentType, ContextType>;
  __isTypeOf?: IsTypeOfResolverFn<ParentType, ContextType>;
}>;

export type ToggleCalendarAdditionResultResolvers<ContextType = GraphQLContext, ParentType extends ResolversParentTypes['ToggleCalendarAdditionResult'] = ResolversParentTypes['ToggleCalendarAdditionResult']> = ResolversObject<{
  eventId?: Resolver<ResolversTypes['ID'], ParentType, ContextType>;
  isAddedToCalendar?: Resolver<ResolversTypes['Boolean'], ParentType, ContextType>;
  scheduleId?: Resolver<ResolversTypes['ID'], ParentType, ContextType>;
  __isTypeOf?: IsTypeOfResolverFn<ParentType, ContextType>;
}>;

export type ToggleFavoriteResultResolvers<ContextType = GraphQLContext, ParentType extends ResolversParentTypes['ToggleFavoriteResult'] = ResolversParentTypes['ToggleFavoriteResult']> = ResolversObject<{
  eventId?: Resolver<ResolversTypes['ID'], ParentType, ContextType>;
  isFavorited?: Resolver<ResolversTypes['Boolean'], ParentType, ContextType>;
  __isTypeOf?: IsTypeOfResolverFn<ParentType, ContextType>;
}>;

export type UserLocationResolvers<ContextType = GraphQLContext, ParentType extends ResolversParentTypes['UserLocation'] = ResolversParentTypes['UserLocation']> = ResolversObject<{
  createdAt?: Resolver<ResolversTypes['String'], ParentType, ContextType>;
  id?: Resolver<ResolversTypes['ID'], ParentType, ContextType>;
  locationDetails?: Resolver<ResolversTypes['LocationDetails'], ParentType, ContextType>;
  name?: Resolver<ResolversTypes['String'], ParentType, ContextType>;
  radius?: Resolver<ResolversTypes['Int'], ParentType, ContextType>;
  updatedAt?: Resolver<ResolversTypes['String'], ParentType, ContextType>;
  __isTypeOf?: IsTypeOfResolverFn<ParentType, ContextType>;
}>;

export type Resolvers<ContextType = GraphQLContext> = ResolversObject<{
  AddressSuggestion?: AddressSuggestionResolvers<ContextType>;
  Coordinates?: CoordinatesResolvers<ContextType>;
  Event?: EventResolvers<ContextType>;
  EventConnection?: EventConnectionResolvers<ContextType>;
  JSON?: GraphQLScalarType;
  LocationDetails?: LocationDetailsResolvers<ContextType>;
  Me?: MeResolvers<ContextType>;
  Mutation?: MutationResolvers<ContextType>;
  Query?: QueryResolvers<ContextType>;
  Schedule?: ScheduleResolvers<ContextType>;
  ToggleCalendarAdditionResult?: ToggleCalendarAdditionResultResolvers<ContextType>;
  ToggleFavoriteResult?: ToggleFavoriteResultResolvers<ContextType>;
  UserLocation?: UserLocationResolvers<ContextType>;
}>;

