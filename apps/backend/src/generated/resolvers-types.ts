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

export type ApiKey = {
  __typename?: 'ApiKey';
  createdAt: Scalars['String']['output'];
  id: Scalars['ID']['output'];
  isValid: Scalars['Boolean']['output'];
  maskedKey: Scalars['String']['output'];
  provider: Scalars['String']['output'];
  updatedAt: Scalars['String']['output'];
};

export type Coordinates = {
  __typename?: 'Coordinates';
  lat: Scalars['Float']['output'];
  lng: Scalars['Float']['output'];
};

export type Correction = {
  __typename?: 'Correction';
  createdAt: Scalars['String']['output'];
  eventId: Scalars['ID']['output'];
  id: Scalars['ID']['output'];
  proposedData: Scalars['JSON']['output'];
  resolvedAt?: Maybe<Scalars['String']['output']>;
  source: CorrectionSource;
  status: CorrectionStatus;
  submittedByUserId: Scalars['ID']['output'];
  validationErrors?: Maybe<Array<ValidationError>>;
};

export enum CorrectionSource {
  AiAssisted = 'ai_assisted',
  Manual = 'manual'
}

export enum CorrectionStatus {
  Applied = 'applied',
  Pending = 'pending',
  Rejected = 'rejected'
}

export type CreateApiKeyInput = {
  key: Scalars['String']['input'];
  provider: Scalars['String']['input'];
};

export type CreateUserLocationInput = {
  address?: InputMaybe<Scalars['String']['input']>;
  latitude?: InputMaybe<Scalars['Float']['input']>;
  longitude?: InputMaybe<Scalars['Float']['input']>;
  name: Scalars['String']['input'];
  placeId?: InputMaybe<Scalars['String']['input']>;
  radius: Scalars['Int']['input'];
};

export enum DefaultLocationChangeAction {
  Accept = 'ACCEPT',
  Revert = 'REVERT'
}

export type DefaultLocationChangeRequest = {
  __typename?: 'DefaultLocationChangeRequest';
  account: SocialMediaAccountProfile;
  accountId: Scalars['ID']['output'];
  changedByUserId: Scalars['ID']['output'];
  createdAt: Scalars['String']['output'];
  id: Scalars['ID']['output'];
  newLocation: LocationDetails;
  previousLocation?: Maybe<LocationDetails>;
  reviewedAt?: Maybe<Scalars['String']['output']>;
  reviewedByModeratorId?: Maybe<Scalars['ID']['output']>;
  status: DefaultLocationChangeRequestStatus;
};

export enum DefaultLocationChangeRequestStatus {
  Accepted = 'ACCEPTED',
  PendingReview = 'PENDING_REVIEW',
  Reverted = 'REVERTED'
}

export type Event = {
  __typename?: 'Event';
  categories?: Maybe<Array<EventCategory>>;
  contactInfo?: Maybe<Scalars['String']['output']>;
  createdAt: Scalars['String']['output'];
  deletedAt?: Maybe<Scalars['String']['output']>;
  description?: Maybe<Scalars['String']['output']>;
  eventName: Scalars['String']['output'];
  id: Scalars['ID']['output'];
  imageUrl?: Maybe<Scalars['String']['output']>;
  isAddedToCalendar: Scalars['Boolean']['output'];
  isExpiredForCurrentUser: Scalars['Boolean']['output'];
  isFavorited: Scalars['Boolean']['output'];
  isHiddenForCurrentUser: Scalars['Boolean']['output'];
  location?: Maybe<Scalars['String']['output']>;
  organizerName?: Maybe<Scalars['String']['output']>;
  originalPostUrl?: Maybe<Scalars['String']['output']>;
  postId?: Maybe<Scalars['ID']['output']>;
  schedules: Array<Schedule>;
  slug: Scalars['String']['output'];
  sourcePostUrl?: Maybe<Scalars['String']['output']>;
  sourceSocialMediaAccountId?: Maybe<Scalars['ID']['output']>;
  sourceSocialMediaAccountProfile?: Maybe<SocialMediaAccountProfile>;
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

export type ExtractEventDataFromUrlResult = {
  __typename?: 'ExtractEventDataFromUrlResult';
  data?: Maybe<ProposedEventCorrectionData>;
  errorCode?: Maybe<ExtractionErrorCode>;
  errorMessage?: Maybe<Scalars['String']['output']>;
};

export enum ExtractionErrorCode {
  ExtractionFailed = 'EXTRACTION_FAILED',
  NotFound = 'NOT_FOUND',
  NoApiKey = 'NO_API_KEY',
  QuotaExhausted = 'QUOTA_EXHAUSTED',
  ScrapeFailed = 'SCRAPE_FAILED',
  UnsupportedPlatform = 'UNSUPPORTED_PLATFORM'
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
  createApiKey: ApiKey;
  createUserLocation: UserLocation;
  deleteApiKey: ApiKey;
  deleteEventPermanently: Scalars['Boolean']['output'];
  deleteUserLocation: UserLocation;
  editAccountDefaultLocation: SocialMediaAccountProfile;
  extractEventDataFromUrl: ExtractEventDataFromUrlResult;
  ignoreSubsequentReports: Report;
  registerFcmToken: Scalars['Boolean']['output'];
  removeSubscription: Subscription;
  reportSystemError: Scalars['Boolean']['output'];
  resolveDefaultLocationChange: DefaultLocationChangeRequest;
  resolveReport: Report;
  resolveReportsForEvent: Array<Report>;
  restoreEvent: Event;
  setAccountDefaultLocation: SocialMediaAccountProfile;
  submitCorrection: Correction;
  submitReport: Report;
  subscribeToAccount: SubscribeToAccountResult;
  toggleCalendarAddition: ToggleCalendarAdditionResult;
  toggleFavorite: ToggleFavoriteResult;
  unregisterFcmToken: Scalars['Boolean']['output'];
  updateUserLocation: UserLocation;
  updateUserSettings: UserSettings;
};


export type MutationCreateApiKeyArgs = {
  input: CreateApiKeyInput;
};


export type MutationCreateUserLocationArgs = {
  input: CreateUserLocationInput;
};


export type MutationDeleteApiKeyArgs = {
  action: SoftDeleteAction;
  id: Scalars['ID']['input'];
};


export type MutationDeleteEventPermanentlyArgs = {
  id: Scalars['ID']['input'];
};


export type MutationDeleteUserLocationArgs = {
  action: SoftDeleteAction;
  id: Scalars['ID']['input'];
};


export type MutationEditAccountDefaultLocationArgs = {
  accountId: Scalars['ID']['input'];
  input: SetAccountDefaultLocationInput;
};


export type MutationExtractEventDataFromUrlArgs = {
  url: Scalars['String']['input'];
};


export type MutationIgnoreSubsequentReportsArgs = {
  reportId: Scalars['ID']['input'];
};


export type MutationRegisterFcmTokenArgs = {
  token: Scalars['String']['input'];
};


export type MutationRemoveSubscriptionArgs = {
  action: SoftDeleteAction;
  id: Scalars['ID']['input'];
};


export type MutationReportSystemErrorArgs = {
  input: ReportSystemErrorInput;
};


export type MutationResolveDefaultLocationChangeArgs = {
  action: DefaultLocationChangeAction;
  id: Scalars['ID']['input'];
};


export type MutationResolveReportArgs = {
  id: Scalars['ID']['input'];
  outcome: ReportOutcome;
};


export type MutationResolveReportsForEventArgs = {
  eventId: Scalars['ID']['input'];
};


export type MutationRestoreEventArgs = {
  action: SoftDeleteAction;
  id: Scalars['ID']['input'];
};


export type MutationSetAccountDefaultLocationArgs = {
  accountId: Scalars['ID']['input'];
  input: SetAccountDefaultLocationInput;
};


export type MutationSubmitCorrectionArgs = {
  eventId: Scalars['ID']['input'];
  proposedData: ProposedEventCorrectionInput;
  source: CorrectionSource;
};


export type MutationSubmitReportArgs = {
  details?: InputMaybe<Scalars['String']['input']>;
  eventId: Scalars['ID']['input'];
  reason: ReportReason;
};


export type MutationSubscribeToAccountArgs = {
  input: SubscribeToAccountInput;
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

export type ProposedEventCorrectionData = {
  __typename?: 'ProposedEventCorrectionData';
  categories: Array<EventCategory>;
  contactInfo?: Maybe<Scalars['String']['output']>;
  description?: Maybe<Scalars['String']['output']>;
  eventName: Scalars['String']['output'];
  location: Scalars['String']['output'];
  organizerName?: Maybe<Scalars['String']['output']>;
  schedules: Array<ProposedScheduleCorrectionData>;
  types: Array<EventType>;
};

export type ProposedEventCorrectionInput = {
  categories: Array<EventCategory>;
  contactInfo?: InputMaybe<Scalars['String']['input']>;
  description?: InputMaybe<Scalars['String']['input']>;
  eventName: Scalars['String']['input'];
  location: Scalars['String']['input'];
  organizerName?: InputMaybe<Scalars['String']['input']>;
  schedules: Array<ProposedScheduleCorrectionInput>;
  types: Array<EventType>;
};

export type ProposedScheduleCorrectionData = {
  __typename?: 'ProposedScheduleCorrectionData';
  eventEndDate?: Maybe<Scalars['String']['output']>;
  eventEndTime?: Maybe<Scalars['String']['output']>;
  eventStartDate: Scalars['String']['output'];
  eventStartTime?: Maybe<Scalars['String']['output']>;
  id?: Maybe<Scalars['ID']['output']>;
  isMainSchedule: Scalars['Boolean']['output'];
  location?: Maybe<Scalars['String']['output']>;
  performers?: Maybe<Array<Scalars['String']['output']>>;
  ticketPrice?: Maybe<Scalars['String']['output']>;
  title?: Maybe<Scalars['String']['output']>;
};

export type ProposedScheduleCorrectionInput = {
  eventEndDate?: InputMaybe<Scalars['String']['input']>;
  eventEndTime?: InputMaybe<Scalars['String']['input']>;
  eventStartDate: Scalars['String']['input'];
  eventStartTime?: InputMaybe<Scalars['String']['input']>;
  id?: InputMaybe<Scalars['ID']['input']>;
  isMainSchedule: Scalars['Boolean']['input'];
  location?: InputMaybe<Scalars['String']['input']>;
  performers?: InputMaybe<Array<Scalars['String']['input']>>;
  ticketPrice?: InputMaybe<Scalars['String']['input']>;
  title?: InputMaybe<Scalars['String']['input']>;
};

export type Query = {
  __typename?: 'Query';
  addressAutocomplete: Array<AddressSuggestion>;
  event?: Maybe<Event>;
  eventBySlug?: Maybe<Event>;
  events: EventConnection;
  health: Scalars['Boolean']['output'];
  me: Me;
  myApiKeys: Array<ApiKey>;
  myLocations: Array<UserLocation>;
  myReports: Array<Report>;
  mySettings: UserSettings;
  mySubscriptions: Array<Subscription>;
  pendingDefaultLocationChanges: Array<DefaultLocationChangeRequest>;
  previewLocation: LocationDetails;
  reportedEvents: Array<Report>;
  socialMediaAccountProfileByAccountId?: Maybe<SocialMediaAccountProfile>;
};


export type QueryAddressAutocompleteArgs = {
  input: Scalars['String']['input'];
};


export type QueryEventArgs = {
  id: Scalars['ID']['input'];
  includeMyArchived?: InputMaybe<Scalars['Boolean']['input']>;
};


export type QueryEventBySlugArgs = {
  includeMyArchived?: InputMaybe<Scalars['Boolean']['input']>;
  slug: Scalars['String']['input'];
};


export type QueryEventsArgs = {
  includeMyArchived?: InputMaybe<Scalars['Boolean']['input']>;
  includeSoftDeleted?: InputMaybe<Scalars['Boolean']['input']>;
  limit?: InputMaybe<Scalars['Int']['input']>;
  offset?: InputMaybe<Scalars['Int']['input']>;
  query?: InputMaybe<EventQueryConditionInput>;
};


export type QueryPreviewLocationArgs = {
  latitude?: InputMaybe<Scalars['Float']['input']>;
  longitude?: InputMaybe<Scalars['Float']['input']>;
  placeId?: InputMaybe<Scalars['String']['input']>;
};


export type QueryReportedEventsArgs = {
  reason?: InputMaybe<ReportReason>;
  status?: InputMaybe<ReportStatus>;
};


export type QuerySocialMediaAccountProfileByAccountIdArgs = {
  accountId: Scalars['String']['input'];
  platform: Scalars['String']['input'];
};

export type Report = {
  __typename?: 'Report';
  createdAt: Scalars['String']['output'];
  details?: Maybe<Scalars['String']['output']>;
  event: Event;
  eventId: Scalars['ID']['output'];
  id: Scalars['ID']['output'];
  moderatorIgnored: Scalars['Boolean']['output'];
  reason: ReportReason;
  reporterUserId: Scalars['ID']['output'];
  resolvedAt?: Maybe<Scalars['String']['output']>;
  resolvedByModeratorId?: Maybe<Scalars['ID']['output']>;
  status: ReportStatus;
};

export enum ReportOutcome {
  Dismissed = 'dismissed',
  Upheld = 'upheld'
}

export enum ReportReason {
  Cancelled = 'cancelled',
  Dangerous = 'dangerous',
  Personal = 'personal'
}

export enum ReportStatus {
  Dismissed = 'dismissed',
  Pending = 'pending',
  Upheld = 'upheld'
}

export type ReportSystemErrorInput = {
  context?: InputMaybe<Scalars['String']['input']>;
  message: Scalars['String']['input'];
  source: Scalars['String']['input'];
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

export type SetAccountDefaultLocationInput = {
  latitude?: InputMaybe<Scalars['Float']['input']>;
  longitude?: InputMaybe<Scalars['Float']['input']>;
  placeId?: InputMaybe<Scalars['String']['input']>;
};

export type SocialMediaAccountProfile = {
  __typename?: 'SocialMediaAccountProfile';
  accountId: Scalars['String']['output'];
  defaultLocation?: Maybe<LocationDetails>;
  description?: Maybe<Scalars['String']['output']>;
  displayName: Scalars['String']['output'];
  hasPendingDefaultLocationReview: Scalars['Boolean']['output'];
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

export type SubscribeToAccountInput = {
  accountId: Scalars['String']['input'];
  displayName: Scalars['String']['input'];
  platform: Scalars['String']['input'];
  username: Scalars['String']['input'];
};

export type SubscribeToAccountResult = {
  __typename?: 'SubscribeToAccountResult';
  alreadySubscribed: Scalars['Boolean']['output'];
  subscription: Subscription;
};

export type Subscription = {
  __typename?: 'Subscription';
  account: SocialMediaAccountProfile;
  accountId: Scalars['ID']['output'];
  createdAt: Scalars['String']['output'];
  id: Scalars['ID']['output'];
  isNewlyAdded: Scalars['Boolean']['output'];
  pendingExtractionCount: Scalars['Int']['output'];
};

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

export type ValidationError = {
  __typename?: 'ValidationError';
  field: Scalars['String']['output'];
  message: Scalars['String']['output'];
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
  ApiKey: ResolverTypeWrapper<ApiKey>;
  Boolean: ResolverTypeWrapper<Scalars['Boolean']['output']>;
  Coordinates: ResolverTypeWrapper<Coordinates>;
  Correction: ResolverTypeWrapper<Correction>;
  CorrectionSource: CorrectionSource;
  CorrectionStatus: CorrectionStatus;
  CreateApiKeyInput: CreateApiKeyInput;
  CreateUserLocationInput: CreateUserLocationInput;
  DefaultLocationChangeAction: DefaultLocationChangeAction;
  DefaultLocationChangeRequest: ResolverTypeWrapper<DefaultLocationChangeRequest>;
  DefaultLocationChangeRequestStatus: DefaultLocationChangeRequestStatus;
  Event: ResolverTypeWrapper<Event>;
  EventCategory: EventCategory;
  EventConnection: ResolverTypeWrapper<EventConnection>;
  EventQueryConditionInput: EventQueryConditionInput;
  EventType: EventType;
  ExtractEventDataFromUrlResult: ResolverTypeWrapper<ExtractEventDataFromUrlResult>;
  ExtractionErrorCode: ExtractionErrorCode;
  Float: ResolverTypeWrapper<Scalars['Float']['output']>;
  GeolocationProvider: GeolocationProvider;
  ID: ResolverTypeWrapper<Scalars['ID']['output']>;
  Int: ResolverTypeWrapper<Scalars['Int']['output']>;
  JSON: ResolverTypeWrapper<Scalars['JSON']['output']>;
  LocationDetails: ResolverTypeWrapper<LocationDetails>;
  Me: ResolverTypeWrapper<Me>;
  Mutation: ResolverTypeWrapper<{}>;
  ProposedEventCorrectionData: ResolverTypeWrapper<ProposedEventCorrectionData>;
  ProposedEventCorrectionInput: ProposedEventCorrectionInput;
  ProposedScheduleCorrectionData: ResolverTypeWrapper<ProposedScheduleCorrectionData>;
  ProposedScheduleCorrectionInput: ProposedScheduleCorrectionInput;
  Query: ResolverTypeWrapper<{}>;
  Report: ResolverTypeWrapper<Report>;
  ReportOutcome: ReportOutcome;
  ReportReason: ReportReason;
  ReportStatus: ReportStatus;
  ReportSystemErrorInput: ReportSystemErrorInput;
  Schedule: ResolverTypeWrapper<Schedule>;
  SetAccountDefaultLocationInput: SetAccountDefaultLocationInput;
  SocialMediaAccountProfile: ResolverTypeWrapper<SocialMediaAccountProfile>;
  SoftDeleteAction: SoftDeleteAction;
  String: ResolverTypeWrapper<Scalars['String']['output']>;
  SubscribeToAccountInput: SubscribeToAccountInput;
  SubscribeToAccountResult: ResolverTypeWrapper<SubscribeToAccountResult>;
  Subscription: ResolverTypeWrapper<{}>;
  ToggleCalendarAdditionResult: ResolverTypeWrapper<ToggleCalendarAdditionResult>;
  ToggleFavoriteResult: ResolverTypeWrapper<ToggleFavoriteResult>;
  UpdateUserLocationInput: UpdateUserLocationInput;
  UpdateUserSettingsInput: UpdateUserSettingsInput;
  UserLocation: ResolverTypeWrapper<UserLocation>;
  UserSettings: ResolverTypeWrapper<UserSettings>;
  ValidationError: ResolverTypeWrapper<ValidationError>;
}>;

/** Mapping between all available schema types and the resolvers parents */
export type ResolversParentTypes = ResolversObject<{
  AddressSuggestion: AddressSuggestion;
  ApiKey: ApiKey;
  Boolean: Scalars['Boolean']['output'];
  Coordinates: Coordinates;
  Correction: Correction;
  CreateApiKeyInput: CreateApiKeyInput;
  CreateUserLocationInput: CreateUserLocationInput;
  DefaultLocationChangeRequest: DefaultLocationChangeRequest;
  Event: Event;
  EventConnection: EventConnection;
  EventQueryConditionInput: EventQueryConditionInput;
  ExtractEventDataFromUrlResult: ExtractEventDataFromUrlResult;
  Float: Scalars['Float']['output'];
  ID: Scalars['ID']['output'];
  Int: Scalars['Int']['output'];
  JSON: Scalars['JSON']['output'];
  LocationDetails: LocationDetails;
  Me: Me;
  Mutation: {};
  ProposedEventCorrectionData: ProposedEventCorrectionData;
  ProposedEventCorrectionInput: ProposedEventCorrectionInput;
  ProposedScheduleCorrectionData: ProposedScheduleCorrectionData;
  ProposedScheduleCorrectionInput: ProposedScheduleCorrectionInput;
  Query: {};
  Report: Report;
  ReportSystemErrorInput: ReportSystemErrorInput;
  Schedule: Schedule;
  SetAccountDefaultLocationInput: SetAccountDefaultLocationInput;
  SocialMediaAccountProfile: SocialMediaAccountProfile;
  String: Scalars['String']['output'];
  SubscribeToAccountInput: SubscribeToAccountInput;
  SubscribeToAccountResult: SubscribeToAccountResult;
  Subscription: {};
  ToggleCalendarAdditionResult: ToggleCalendarAdditionResult;
  ToggleFavoriteResult: ToggleFavoriteResult;
  UpdateUserLocationInput: UpdateUserLocationInput;
  UpdateUserSettingsInput: UpdateUserSettingsInput;
  UserLocation: UserLocation;
  UserSettings: UserSettings;
  ValidationError: ValidationError;
}>;

export type AddressSuggestionResolvers<ContextType = GraphQLContext, ParentType extends ResolversParentTypes['AddressSuggestion'] = ResolversParentTypes['AddressSuggestion']> = ResolversObject<{
  description?: Resolver<ResolversTypes['String'], ParentType, ContextType>;
  placeId?: Resolver<ResolversTypes['String'], ParentType, ContextType>;
  __isTypeOf?: IsTypeOfResolverFn<ParentType, ContextType>;
}>;

export type ApiKeyResolvers<ContextType = GraphQLContext, ParentType extends ResolversParentTypes['ApiKey'] = ResolversParentTypes['ApiKey']> = ResolversObject<{
  createdAt?: Resolver<ResolversTypes['String'], ParentType, ContextType>;
  id?: Resolver<ResolversTypes['ID'], ParentType, ContextType>;
  isValid?: Resolver<ResolversTypes['Boolean'], ParentType, ContextType>;
  maskedKey?: Resolver<ResolversTypes['String'], ParentType, ContextType>;
  provider?: Resolver<ResolversTypes['String'], ParentType, ContextType>;
  updatedAt?: Resolver<ResolversTypes['String'], ParentType, ContextType>;
  __isTypeOf?: IsTypeOfResolverFn<ParentType, ContextType>;
}>;

export type CoordinatesResolvers<ContextType = GraphQLContext, ParentType extends ResolversParentTypes['Coordinates'] = ResolversParentTypes['Coordinates']> = ResolversObject<{
  lat?: Resolver<ResolversTypes['Float'], ParentType, ContextType>;
  lng?: Resolver<ResolversTypes['Float'], ParentType, ContextType>;
  __isTypeOf?: IsTypeOfResolverFn<ParentType, ContextType>;
}>;

export type CorrectionResolvers<ContextType = GraphQLContext, ParentType extends ResolversParentTypes['Correction'] = ResolversParentTypes['Correction']> = ResolversObject<{
  createdAt?: Resolver<ResolversTypes['String'], ParentType, ContextType>;
  eventId?: Resolver<ResolversTypes['ID'], ParentType, ContextType>;
  id?: Resolver<ResolversTypes['ID'], ParentType, ContextType>;
  proposedData?: Resolver<ResolversTypes['JSON'], ParentType, ContextType>;
  resolvedAt?: Resolver<Maybe<ResolversTypes['String']>, ParentType, ContextType>;
  source?: Resolver<ResolversTypes['CorrectionSource'], ParentType, ContextType>;
  status?: Resolver<ResolversTypes['CorrectionStatus'], ParentType, ContextType>;
  submittedByUserId?: Resolver<ResolversTypes['ID'], ParentType, ContextType>;
  validationErrors?: Resolver<Maybe<Array<ResolversTypes['ValidationError']>>, ParentType, ContextType>;
  __isTypeOf?: IsTypeOfResolverFn<ParentType, ContextType>;
}>;

export type DefaultLocationChangeRequestResolvers<ContextType = GraphQLContext, ParentType extends ResolversParentTypes['DefaultLocationChangeRequest'] = ResolversParentTypes['DefaultLocationChangeRequest']> = ResolversObject<{
  account?: Resolver<ResolversTypes['SocialMediaAccountProfile'], ParentType, ContextType>;
  accountId?: Resolver<ResolversTypes['ID'], ParentType, ContextType>;
  changedByUserId?: Resolver<ResolversTypes['ID'], ParentType, ContextType>;
  createdAt?: Resolver<ResolversTypes['String'], ParentType, ContextType>;
  id?: Resolver<ResolversTypes['ID'], ParentType, ContextType>;
  newLocation?: Resolver<ResolversTypes['LocationDetails'], ParentType, ContextType>;
  previousLocation?: Resolver<Maybe<ResolversTypes['LocationDetails']>, ParentType, ContextType>;
  reviewedAt?: Resolver<Maybe<ResolversTypes['String']>, ParentType, ContextType>;
  reviewedByModeratorId?: Resolver<Maybe<ResolversTypes['ID']>, ParentType, ContextType>;
  status?: Resolver<ResolversTypes['DefaultLocationChangeRequestStatus'], ParentType, ContextType>;
  __isTypeOf?: IsTypeOfResolverFn<ParentType, ContextType>;
}>;

export type EventResolvers<ContextType = GraphQLContext, ParentType extends ResolversParentTypes['Event'] = ResolversParentTypes['Event']> = ResolversObject<{
  categories?: Resolver<Maybe<Array<ResolversTypes['EventCategory']>>, ParentType, ContextType>;
  contactInfo?: Resolver<Maybe<ResolversTypes['String']>, ParentType, ContextType>;
  createdAt?: Resolver<ResolversTypes['String'], ParentType, ContextType>;
  deletedAt?: Resolver<Maybe<ResolversTypes['String']>, ParentType, ContextType>;
  description?: Resolver<Maybe<ResolversTypes['String']>, ParentType, ContextType>;
  eventName?: Resolver<ResolversTypes['String'], ParentType, ContextType>;
  id?: Resolver<ResolversTypes['ID'], ParentType, ContextType>;
  imageUrl?: Resolver<Maybe<ResolversTypes['String']>, ParentType, ContextType>;
  isAddedToCalendar?: Resolver<ResolversTypes['Boolean'], ParentType, ContextType>;
  isExpiredForCurrentUser?: Resolver<ResolversTypes['Boolean'], ParentType, ContextType>;
  isFavorited?: Resolver<ResolversTypes['Boolean'], ParentType, ContextType>;
  isHiddenForCurrentUser?: Resolver<ResolversTypes['Boolean'], ParentType, ContextType>;
  location?: Resolver<Maybe<ResolversTypes['String']>, ParentType, ContextType>;
  organizerName?: Resolver<Maybe<ResolversTypes['String']>, ParentType, ContextType>;
  originalPostUrl?: Resolver<Maybe<ResolversTypes['String']>, ParentType, ContextType>;
  postId?: Resolver<Maybe<ResolversTypes['ID']>, ParentType, ContextType>;
  schedules?: Resolver<Array<ResolversTypes['Schedule']>, ParentType, ContextType>;
  slug?: Resolver<ResolversTypes['String'], ParentType, ContextType>;
  sourcePostUrl?: Resolver<Maybe<ResolversTypes['String']>, ParentType, ContextType>;
  sourceSocialMediaAccountId?: Resolver<Maybe<ResolversTypes['ID']>, ParentType, ContextType>;
  sourceSocialMediaAccountProfile?: Resolver<Maybe<ResolversTypes['SocialMediaAccountProfile']>, ParentType, ContextType>;
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

export type ExtractEventDataFromUrlResultResolvers<ContextType = GraphQLContext, ParentType extends ResolversParentTypes['ExtractEventDataFromUrlResult'] = ResolversParentTypes['ExtractEventDataFromUrlResult']> = ResolversObject<{
  data?: Resolver<Maybe<ResolversTypes['ProposedEventCorrectionData']>, ParentType, ContextType>;
  errorCode?: Resolver<Maybe<ResolversTypes['ExtractionErrorCode']>, ParentType, ContextType>;
  errorMessage?: Resolver<Maybe<ResolversTypes['String']>, ParentType, ContextType>;
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
  createApiKey?: Resolver<ResolversTypes['ApiKey'], ParentType, ContextType, RequireFields<MutationCreateApiKeyArgs, 'input'>>;
  createUserLocation?: Resolver<ResolversTypes['UserLocation'], ParentType, ContextType, RequireFields<MutationCreateUserLocationArgs, 'input'>>;
  deleteApiKey?: Resolver<ResolversTypes['ApiKey'], ParentType, ContextType, RequireFields<MutationDeleteApiKeyArgs, 'action' | 'id'>>;
  deleteEventPermanently?: Resolver<ResolversTypes['Boolean'], ParentType, ContextType, RequireFields<MutationDeleteEventPermanentlyArgs, 'id'>>;
  deleteUserLocation?: Resolver<ResolversTypes['UserLocation'], ParentType, ContextType, RequireFields<MutationDeleteUserLocationArgs, 'action' | 'id'>>;
  editAccountDefaultLocation?: Resolver<ResolversTypes['SocialMediaAccountProfile'], ParentType, ContextType, RequireFields<MutationEditAccountDefaultLocationArgs, 'accountId' | 'input'>>;
  extractEventDataFromUrl?: Resolver<ResolversTypes['ExtractEventDataFromUrlResult'], ParentType, ContextType, RequireFields<MutationExtractEventDataFromUrlArgs, 'url'>>;
  ignoreSubsequentReports?: Resolver<ResolversTypes['Report'], ParentType, ContextType, RequireFields<MutationIgnoreSubsequentReportsArgs, 'reportId'>>;
  registerFcmToken?: Resolver<ResolversTypes['Boolean'], ParentType, ContextType, RequireFields<MutationRegisterFcmTokenArgs, 'token'>>;
  removeSubscription?: Resolver<ResolversTypes['Subscription'], ParentType, ContextType, RequireFields<MutationRemoveSubscriptionArgs, 'action' | 'id'>>;
  reportSystemError?: Resolver<ResolversTypes['Boolean'], ParentType, ContextType, RequireFields<MutationReportSystemErrorArgs, 'input'>>;
  resolveDefaultLocationChange?: Resolver<ResolversTypes['DefaultLocationChangeRequest'], ParentType, ContextType, RequireFields<MutationResolveDefaultLocationChangeArgs, 'action' | 'id'>>;
  resolveReport?: Resolver<ResolversTypes['Report'], ParentType, ContextType, RequireFields<MutationResolveReportArgs, 'id' | 'outcome'>>;
  resolveReportsForEvent?: Resolver<Array<ResolversTypes['Report']>, ParentType, ContextType, RequireFields<MutationResolveReportsForEventArgs, 'eventId'>>;
  restoreEvent?: Resolver<ResolversTypes['Event'], ParentType, ContextType, RequireFields<MutationRestoreEventArgs, 'action' | 'id'>>;
  setAccountDefaultLocation?: Resolver<ResolversTypes['SocialMediaAccountProfile'], ParentType, ContextType, RequireFields<MutationSetAccountDefaultLocationArgs, 'accountId' | 'input'>>;
  submitCorrection?: Resolver<ResolversTypes['Correction'], ParentType, ContextType, RequireFields<MutationSubmitCorrectionArgs, 'eventId' | 'proposedData' | 'source'>>;
  submitReport?: Resolver<ResolversTypes['Report'], ParentType, ContextType, RequireFields<MutationSubmitReportArgs, 'eventId' | 'reason'>>;
  subscribeToAccount?: Resolver<ResolversTypes['SubscribeToAccountResult'], ParentType, ContextType, RequireFields<MutationSubscribeToAccountArgs, 'input'>>;
  toggleCalendarAddition?: Resolver<ResolversTypes['ToggleCalendarAdditionResult'], ParentType, ContextType, RequireFields<MutationToggleCalendarAdditionArgs, 'eventId' | 'scheduleId'>>;
  toggleFavorite?: Resolver<ResolversTypes['ToggleFavoriteResult'], ParentType, ContextType, RequireFields<MutationToggleFavoriteArgs, 'eventId'>>;
  unregisterFcmToken?: Resolver<ResolversTypes['Boolean'], ParentType, ContextType, RequireFields<MutationUnregisterFcmTokenArgs, 'token'>>;
  updateUserLocation?: Resolver<ResolversTypes['UserLocation'], ParentType, ContextType, RequireFields<MutationUpdateUserLocationArgs, 'id' | 'input'>>;
  updateUserSettings?: Resolver<ResolversTypes['UserSettings'], ParentType, ContextType, RequireFields<MutationUpdateUserSettingsArgs, 'input'>>;
}>;

export type ProposedEventCorrectionDataResolvers<ContextType = GraphQLContext, ParentType extends ResolversParentTypes['ProposedEventCorrectionData'] = ResolversParentTypes['ProposedEventCorrectionData']> = ResolversObject<{
  categories?: Resolver<Array<ResolversTypes['EventCategory']>, ParentType, ContextType>;
  contactInfo?: Resolver<Maybe<ResolversTypes['String']>, ParentType, ContextType>;
  description?: Resolver<Maybe<ResolversTypes['String']>, ParentType, ContextType>;
  eventName?: Resolver<ResolversTypes['String'], ParentType, ContextType>;
  location?: Resolver<ResolversTypes['String'], ParentType, ContextType>;
  organizerName?: Resolver<Maybe<ResolversTypes['String']>, ParentType, ContextType>;
  schedules?: Resolver<Array<ResolversTypes['ProposedScheduleCorrectionData']>, ParentType, ContextType>;
  types?: Resolver<Array<ResolversTypes['EventType']>, ParentType, ContextType>;
  __isTypeOf?: IsTypeOfResolverFn<ParentType, ContextType>;
}>;

export type ProposedScheduleCorrectionDataResolvers<ContextType = GraphQLContext, ParentType extends ResolversParentTypes['ProposedScheduleCorrectionData'] = ResolversParentTypes['ProposedScheduleCorrectionData']> = ResolversObject<{
  eventEndDate?: Resolver<Maybe<ResolversTypes['String']>, ParentType, ContextType>;
  eventEndTime?: Resolver<Maybe<ResolversTypes['String']>, ParentType, ContextType>;
  eventStartDate?: Resolver<ResolversTypes['String'], ParentType, ContextType>;
  eventStartTime?: Resolver<Maybe<ResolversTypes['String']>, ParentType, ContextType>;
  id?: Resolver<Maybe<ResolversTypes['ID']>, ParentType, ContextType>;
  isMainSchedule?: Resolver<ResolversTypes['Boolean'], ParentType, ContextType>;
  location?: Resolver<Maybe<ResolversTypes['String']>, ParentType, ContextType>;
  performers?: Resolver<Maybe<Array<ResolversTypes['String']>>, ParentType, ContextType>;
  ticketPrice?: Resolver<Maybe<ResolversTypes['String']>, ParentType, ContextType>;
  title?: Resolver<Maybe<ResolversTypes['String']>, ParentType, ContextType>;
  __isTypeOf?: IsTypeOfResolverFn<ParentType, ContextType>;
}>;

export type QueryResolvers<ContextType = GraphQLContext, ParentType extends ResolversParentTypes['Query'] = ResolversParentTypes['Query']> = ResolversObject<{
  addressAutocomplete?: Resolver<Array<ResolversTypes['AddressSuggestion']>, ParentType, ContextType, RequireFields<QueryAddressAutocompleteArgs, 'input'>>;
  event?: Resolver<Maybe<ResolversTypes['Event']>, ParentType, ContextType, RequireFields<QueryEventArgs, 'id'>>;
  eventBySlug?: Resolver<Maybe<ResolversTypes['Event']>, ParentType, ContextType, RequireFields<QueryEventBySlugArgs, 'slug'>>;
  events?: Resolver<ResolversTypes['EventConnection'], ParentType, ContextType, Partial<QueryEventsArgs>>;
  health?: Resolver<ResolversTypes['Boolean'], ParentType, ContextType>;
  me?: Resolver<ResolversTypes['Me'], ParentType, ContextType>;
  myApiKeys?: Resolver<Array<ResolversTypes['ApiKey']>, ParentType, ContextType>;
  myLocations?: Resolver<Array<ResolversTypes['UserLocation']>, ParentType, ContextType>;
  myReports?: Resolver<Array<ResolversTypes['Report']>, ParentType, ContextType>;
  mySettings?: Resolver<ResolversTypes['UserSettings'], ParentType, ContextType>;
  mySubscriptions?: Resolver<Array<ResolversTypes['Subscription']>, ParentType, ContextType>;
  pendingDefaultLocationChanges?: Resolver<Array<ResolversTypes['DefaultLocationChangeRequest']>, ParentType, ContextType>;
  previewLocation?: Resolver<ResolversTypes['LocationDetails'], ParentType, ContextType, Partial<QueryPreviewLocationArgs>>;
  reportedEvents?: Resolver<Array<ResolversTypes['Report']>, ParentType, ContextType, Partial<QueryReportedEventsArgs>>;
  socialMediaAccountProfileByAccountId?: Resolver<Maybe<ResolversTypes['SocialMediaAccountProfile']>, ParentType, ContextType, RequireFields<QuerySocialMediaAccountProfileByAccountIdArgs, 'accountId' | 'platform'>>;
}>;

export type ReportResolvers<ContextType = GraphQLContext, ParentType extends ResolversParentTypes['Report'] = ResolversParentTypes['Report']> = ResolversObject<{
  createdAt?: Resolver<ResolversTypes['String'], ParentType, ContextType>;
  details?: Resolver<Maybe<ResolversTypes['String']>, ParentType, ContextType>;
  event?: Resolver<ResolversTypes['Event'], ParentType, ContextType>;
  eventId?: Resolver<ResolversTypes['ID'], ParentType, ContextType>;
  id?: Resolver<ResolversTypes['ID'], ParentType, ContextType>;
  moderatorIgnored?: Resolver<ResolversTypes['Boolean'], ParentType, ContextType>;
  reason?: Resolver<ResolversTypes['ReportReason'], ParentType, ContextType>;
  reporterUserId?: Resolver<ResolversTypes['ID'], ParentType, ContextType>;
  resolvedAt?: Resolver<Maybe<ResolversTypes['String']>, ParentType, ContextType>;
  resolvedByModeratorId?: Resolver<Maybe<ResolversTypes['ID']>, ParentType, ContextType>;
  status?: Resolver<ResolversTypes['ReportStatus'], ParentType, ContextType>;
  __isTypeOf?: IsTypeOfResolverFn<ParentType, ContextType>;
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

export type SocialMediaAccountProfileResolvers<ContextType = GraphQLContext, ParentType extends ResolversParentTypes['SocialMediaAccountProfile'] = ResolversParentTypes['SocialMediaAccountProfile']> = ResolversObject<{
  accountId?: Resolver<ResolversTypes['String'], ParentType, ContextType>;
  defaultLocation?: Resolver<Maybe<ResolversTypes['LocationDetails']>, ParentType, ContextType>;
  description?: Resolver<Maybe<ResolversTypes['String']>, ParentType, ContextType>;
  displayName?: Resolver<ResolversTypes['String'], ParentType, ContextType>;
  hasPendingDefaultLocationReview?: Resolver<ResolversTypes['Boolean'], ParentType, ContextType>;
  id?: Resolver<ResolversTypes['ID'], ParentType, ContextType>;
  lastPostDate?: Resolver<Maybe<ResolversTypes['String']>, ParentType, ContextType>;
  platform?: Resolver<ResolversTypes['String'], ParentType, ContextType>;
  profileImageUrl?: Resolver<Maybe<ResolversTypes['String']>, ParentType, ContextType>;
  username?: Resolver<ResolversTypes['String'], ParentType, ContextType>;
  __isTypeOf?: IsTypeOfResolverFn<ParentType, ContextType>;
}>;

export type SubscribeToAccountResultResolvers<ContextType = GraphQLContext, ParentType extends ResolversParentTypes['SubscribeToAccountResult'] = ResolversParentTypes['SubscribeToAccountResult']> = ResolversObject<{
  alreadySubscribed?: Resolver<ResolversTypes['Boolean'], ParentType, ContextType>;
  subscription?: Resolver<ResolversTypes['Subscription'], ParentType, ContextType>;
  __isTypeOf?: IsTypeOfResolverFn<ParentType, ContextType>;
}>;

export type SubscriptionResolvers<ContextType = GraphQLContext, ParentType extends ResolversParentTypes['Subscription'] = ResolversParentTypes['Subscription']> = ResolversObject<{
  account?: SubscriptionResolver<ResolversTypes['SocialMediaAccountProfile'], "account", ParentType, ContextType>;
  accountId?: SubscriptionResolver<ResolversTypes['ID'], "accountId", ParentType, ContextType>;
  createdAt?: SubscriptionResolver<ResolversTypes['String'], "createdAt", ParentType, ContextType>;
  id?: SubscriptionResolver<ResolversTypes['ID'], "id", ParentType, ContextType>;
  isNewlyAdded?: SubscriptionResolver<ResolversTypes['Boolean'], "isNewlyAdded", ParentType, ContextType>;
  pendingExtractionCount?: SubscriptionResolver<ResolversTypes['Int'], "pendingExtractionCount", ParentType, ContextType>;
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

export type UserSettingsResolvers<ContextType = GraphQLContext, ParentType extends ResolversParentTypes['UserSettings'] = ResolversParentTypes['UserSettings']> = ResolversObject<{
  createdAt?: Resolver<ResolversTypes['String'], ParentType, ContextType>;
  hidePastEventsAfterDays?: Resolver<ResolversTypes['Int'], ParentType, ContextType>;
  id?: Resolver<ResolversTypes['ID'], ParentType, ContextType>;
  pushNotificationsEnabled?: Resolver<ResolversTypes['Boolean'], ParentType, ContextType>;
  updatedAt?: Resolver<ResolversTypes['String'], ParentType, ContextType>;
  __isTypeOf?: IsTypeOfResolverFn<ParentType, ContextType>;
}>;

export type ValidationErrorResolvers<ContextType = GraphQLContext, ParentType extends ResolversParentTypes['ValidationError'] = ResolversParentTypes['ValidationError']> = ResolversObject<{
  field?: Resolver<ResolversTypes['String'], ParentType, ContextType>;
  message?: Resolver<ResolversTypes['String'], ParentType, ContextType>;
  __isTypeOf?: IsTypeOfResolverFn<ParentType, ContextType>;
}>;

export type Resolvers<ContextType = GraphQLContext> = ResolversObject<{
  AddressSuggestion?: AddressSuggestionResolvers<ContextType>;
  ApiKey?: ApiKeyResolvers<ContextType>;
  Coordinates?: CoordinatesResolvers<ContextType>;
  Correction?: CorrectionResolvers<ContextType>;
  DefaultLocationChangeRequest?: DefaultLocationChangeRequestResolvers<ContextType>;
  Event?: EventResolvers<ContextType>;
  EventConnection?: EventConnectionResolvers<ContextType>;
  ExtractEventDataFromUrlResult?: ExtractEventDataFromUrlResultResolvers<ContextType>;
  JSON?: GraphQLScalarType;
  LocationDetails?: LocationDetailsResolvers<ContextType>;
  Me?: MeResolvers<ContextType>;
  Mutation?: MutationResolvers<ContextType>;
  ProposedEventCorrectionData?: ProposedEventCorrectionDataResolvers<ContextType>;
  ProposedScheduleCorrectionData?: ProposedScheduleCorrectionDataResolvers<ContextType>;
  Query?: QueryResolvers<ContextType>;
  Report?: ReportResolvers<ContextType>;
  Schedule?: ScheduleResolvers<ContextType>;
  SocialMediaAccountProfile?: SocialMediaAccountProfileResolvers<ContextType>;
  SubscribeToAccountResult?: SubscribeToAccountResultResolvers<ContextType>;
  Subscription?: SubscriptionResolvers<ContextType>;
  ToggleCalendarAdditionResult?: ToggleCalendarAdditionResultResolvers<ContextType>;
  ToggleFavoriteResult?: ToggleFavoriteResultResolvers<ContextType>;
  UserLocation?: UserLocationResolvers<ContextType>;
  UserSettings?: UserSettingsResolvers<ContextType>;
  ValidationError?: ValidationErrorResolvers<ContextType>;
}>;

