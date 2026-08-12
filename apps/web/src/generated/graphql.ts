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

export type ExtractionQuota = {
  __typename?: 'ExtractionQuota';
  limit: Scalars['Int']['output'];
  remaining: Scalars['Int']['output'];
  used: Scalars['Int']['output'];
};

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
  markSubscriptionViewed: Subscription;
  registerFcmToken: Scalars['Boolean']['output'];
  removeSubscription: Subscription;
  reportSystemError: Scalars['Boolean']['output'];
  resolveDefaultLocationChange: DefaultLocationChangeRequest;
  resolveReport: Report;
  resolveReportsForEvent: Array<Report>;
  restoreEvent: Event;
  selectPostsForExtraction: Array<Post>;
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


export type MutationMarkSubscriptionViewedArgs = {
  subscriptionId: Scalars['ID']['input'];
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


export type MutationSelectPostsForExtractionArgs = {
  postIds: Array<Scalars['ID']['input']>;
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

export type Post = {
  __typename?: 'Post';
  accountId: Scalars['ID']['output'];
  content: Scalars['String']['output'];
  id: Scalars['ID']['output'];
  imageUrl?: Maybe<Scalars['String']['output']>;
  isExtracted: Scalars['Boolean']['output'];
  originalPostUrl?: Maybe<Scalars['String']['output']>;
  postUrl: Scalars['String']['output'];
  publishedAt: Scalars['String']['output'];
};

export type PostConnection = {
  __typename?: 'PostConnection';
  hasMore: Scalars['Boolean']['output'];
  items: Array<Post>;
  nextCursor?: Maybe<Scalars['String']['output']>;
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
  myExtractionQuota: ExtractionQuota;
  myLocations: Array<UserLocation>;
  myReports: Array<Report>;
  mySettings: UserSettings;
  mySubscriptions: Array<Subscription>;
  pendingDefaultLocationChanges: Array<DefaultLocationChangeRequest>;
  postsByAccount: PostConnection;
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


export type QueryPostsByAccountArgs = {
  accountId: Scalars['ID']['input'];
  cursor?: InputMaybe<Scalars['String']['input']>;
  limit?: InputMaybe<Scalars['Int']['input']>;
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
  isInactive: Scalars['Boolean']['output'];
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






















export type GetSocialMediaAccountProfileByAccountIdQueryVariables = Exact<{
  platform: string;
  accountId: string;
}>;


export type GetSocialMediaAccountProfileByAccountIdQuery = { socialMediaAccountProfileByAccountId: { id: string, accountId: string, platform: string, displayName: string, username: string, profileImageUrl: string | null, description: string | null } | null };

export type MeQueryVariables = Exact<{ [key: string]: never; }>;


export type MeQuery = { me: { id: string, email: string, role: string } };

export type SubmitCorrectionMutationVariables = Exact<{
  eventId: string | number;
  proposedData: ProposedEventCorrectionInput;
  source: CorrectionSource;
}>;


export type SubmitCorrectionMutation = { submitCorrection: { id: string, status: CorrectionStatus, validationErrors: Array<{ field: string, message: string }> | null } };

export type ExtractEventDataFromUrlMutationVariables = Exact<{
  url: string;
}>;


export type ExtractEventDataFromUrlMutation = { extractEventDataFromUrl: { errorCode: ExtractionErrorCode | null, errorMessage: string | null, data: { eventName: string, types: Array<EventType>, categories: Array<EventCategory>, location: string, organizerName: string | null, contactInfo: string | null, description: string | null, schedules: Array<{ isMainSchedule: boolean, eventStartDate: string, eventEndDate: string | null, eventStartTime: string | null, eventEndTime: string | null, title: string | null, performers: Array<string> | null, location: string | null, ticketPrice: string | null }> } | null } };

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


export type GetEventBySlugQuery = { eventBySlug: { id: string, eventName: string, slug: string, description: string | null, location: string | null, types: Array<EventType> | null, categories: Array<EventCategory> | null, imageUrl: string | null, sourcePostUrl: string | null, originalPostUrl: string | null, organizerName: string | null, contactInfo: string | null, isFavorited: boolean, isHiddenForCurrentUser: boolean, sourceSocialMediaAccountProfile: { accountId: string, platform: string, displayName: string, profileImageUrl: string | null } | null, schedules: Array<{ id: string, isMainSchedule: boolean, eventStartDate: string, isAddedToCalendar: boolean, eventEndDate: string | null, eventStartTime: string | null, eventEndTime: string | null, performers: Array<string> | null, location: string | null, ticketPrice: string | null, ticketUrl: string | null, registrationUrl: string | null, locationDetails: { placeName: string | null, placeId: string | null, formattedAddress: string | null, timezone: string | null, coordinates: { lat: number, lng: number } } | null }> } | null };

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

export type GetArchivedEventsQueryVariables = Exact<{
  limit?: number | null | undefined;
  offset?: number | null | undefined;
}>;


export type GetArchivedEventsQuery = { events: { hasMore: boolean, totalCount: number, items: Array<{ id: string, slug: string, eventName: string, imageUrl: string | null, location: string | null, categories: Array<EventCategory> | null, types: Array<EventType> | null, deletedAt: string | null, isHiddenForCurrentUser: boolean, isExpiredForCurrentUser: boolean, schedules: Array<{ isMainSchedule: boolean, eventStartDate: string, ticketPrice: string | null }> }> } };

export type SubmitReportMutationVariables = Exact<{
  eventId: string | number;
  reason: ReportReason;
  details?: string | null | undefined;
}>;


export type SubmitReportMutation = { submitReport: { id: string, reason: ReportReason, status: ReportStatus, createdAt: string } };

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

export type GetReportedEventsQueryVariables = Exact<{
  status?: ReportStatus | null | undefined;
  reason?: ReportReason | null | undefined;
}>;


export type GetReportedEventsQuery = { reportedEvents: Array<{ id: string, eventId: string, reporterUserId: string, reason: ReportReason, details: string | null, status: ReportStatus, createdAt: string, moderatorIgnored: boolean, event: { id: string, slug: string, eventName: string, imageUrl: string | null, deletedAt: string | null } }> };

export type ResolveReportsForEventMutationVariables = Exact<{
  eventId: string | number;
}>;


export type ResolveReportsForEventMutation = { resolveReportsForEvent: Array<{ id: string, status: ReportStatus, resolvedAt: string | null }> };

export type DeleteEventPermanentlyMutationVariables = Exact<{
  id: string | number;
}>;


export type DeleteEventPermanentlyMutation = { deleteEventPermanently: boolean };

export type IgnoreSubsequentReportsMutationVariables = Exact<{
  reportId: string | number;
}>;


export type IgnoreSubsequentReportsMutation = { ignoreSubsequentReports: { id: string, moderatorIgnored: boolean } };

export type GetPendingDefaultLocationChangesQueryVariables = Exact<{ [key: string]: never; }>;


export type GetPendingDefaultLocationChangesQuery = { pendingDefaultLocationChanges: Array<{ id: string, accountId: string, status: DefaultLocationChangeRequestStatus, createdAt: string, account: { id: string, displayName: string, platform: string, username: string, profileImageUrl: string | null }, previousLocation: { placeName: string | null, formattedAddress: string | null, coordinates: { lat: number, lng: number } } | null, newLocation: { placeName: string | null, formattedAddress: string | null, coordinates: { lat: number, lng: number } } }> };

export type ResolveDefaultLocationChangeMutationVariables = Exact<{
  id: string | number;
  action: DefaultLocationChangeAction;
}>;


export type ResolveDefaultLocationChangeMutation = { resolveDefaultLocationChange: { id: string, status: DefaultLocationChangeRequestStatus } };

export type CreateApiKeyMutationVariables = Exact<{
  input: CreateApiKeyInput;
}>;


export type CreateApiKeyMutation = { createApiKey: { id: string, provider: string, maskedKey: string, isValid: boolean, createdAt: string, updatedAt: string } };

export type SubscribeToAccountMutationVariables = Exact<{
  input: SubscribeToAccountInput;
}>;


export type SubscribeToAccountMutation = { subscribeToAccount: { alreadySubscribed: boolean, subscription: { id: string, accountId: string, isNewlyAdded: boolean, createdAt: string } } };

export type GetMyApiKeysQueryVariables = Exact<{ [key: string]: never; }>;


export type GetMyApiKeysQuery = { myApiKeys: Array<{ id: string, provider: string, maskedKey: string, isValid: boolean, createdAt: string, updatedAt: string }> };

export type MarkSubscriptionViewedMutationVariables = Exact<{
  subscriptionId: string | number;
}>;


export type MarkSubscriptionViewedMutation = { markSubscriptionViewed: { id: string, isNewlyAdded: boolean } };

export type GetPostsByAccountQueryVariables = Exact<{
  accountId: string | number;
  cursor?: string | null | undefined;
  limit?: number | null | undefined;
}>;


export type GetPostsByAccountQuery = { postsByAccount: { nextCursor: string | null, hasMore: boolean, items: Array<{ id: string, accountId: string, content: string, imageUrl: string | null, postUrl: string, originalPostUrl: string | null, isExtracted: boolean, publishedAt: string }> } };

export type MyReportsQueryVariables = Exact<{ [key: string]: never; }>;


export type MyReportsQuery = { myReports: Array<{ id: string, reason: ReportReason, status: ReportStatus, createdAt: string, event: { id: string, slug: string, eventName: string, imageUrl: string | null } }> };

export type DeleteApiKeyMutationVariables = Exact<{
  id: string | number;
  action: SoftDeleteAction;
}>;


export type DeleteApiKeyMutation = { deleteApiKey: { id: string, provider: string, maskedKey: string, isValid: boolean, createdAt: string, updatedAt: string } };

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

export type RemoveSubscriptionMutationVariables = Exact<{
  id: string | number;
  action: SoftDeleteAction;
}>;


export type RemoveSubscriptionMutation = { removeSubscription: { id: string } };

export type SetAccountDefaultLocationMutationVariables = Exact<{
  accountId: string | number;
  input: SetAccountDefaultLocationInput;
}>;


export type SetAccountDefaultLocationMutation = { setAccountDefaultLocation: { id: string, defaultLocation: { formattedAddress: string | null, placeName: string | null, coordinates: { lat: number, lng: number } } | null } };

export type EditAccountDefaultLocationMutationVariables = Exact<{
  accountId: string | number;
  input: SetAccountDefaultLocationInput;
}>;


export type EditAccountDefaultLocationMutation = { editAccountDefaultLocation: { id: string, hasPendingDefaultLocationReview: boolean, defaultLocation: { formattedAddress: string | null, placeName: string | null, coordinates: { lat: number, lng: number } } | null } };

export type GetMySubscriptionsQueryVariables = Exact<{ [key: string]: never; }>;


export type GetMySubscriptionsQuery = { mySubscriptions: Array<{ id: string, accountId: string, isNewlyAdded: boolean, isInactive: boolean, createdAt: string, pendingExtractionCount: number, account: { id: string, platform: string, displayName: string, username: string, profileImageUrl: string | null, hasPendingDefaultLocationReview: boolean, defaultLocation: { formattedAddress: string | null, placeName: string | null, coordinates: { lat: number, lng: number } } | null } }> };

export type ReportSystemErrorMutationVariables = Exact<{
  input: ReportSystemErrorInput;
}>;


export type ReportSystemErrorMutation = { reportSystemError: boolean };


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

export const GetSocialMediaAccountProfileByAccountIdDocument = new TypedDocumentString(`
    query getSocialMediaAccountProfileByAccountId($platform: String!, $accountId: String!) {
  socialMediaAccountProfileByAccountId(platform: $platform, accountId: $accountId) {
    id
    accountId
    platform
    displayName
    username
    profileImageUrl
    description
  }
}
    `);

export const useGetSocialMediaAccountProfileByAccountIdQuery = <
      TData = GetSocialMediaAccountProfileByAccountIdQuery,
      TError = unknown
    >(
      client: GraphQLClient,
      variables: GetSocialMediaAccountProfileByAccountIdQueryVariables,
      options?: Omit<UseQueryOptions<GetSocialMediaAccountProfileByAccountIdQuery, TError, TData>, 'queryKey'> & { queryKey?: UseQueryOptions<GetSocialMediaAccountProfileByAccountIdQuery, TError, TData>['queryKey'] },
      headers?: RequestInit['headers']
    ) => {
    
    return useQuery<GetSocialMediaAccountProfileByAccountIdQuery, TError, TData>(
      {
    queryKey: ['getSocialMediaAccountProfileByAccountId', variables],
    queryFn: fetcher<GetSocialMediaAccountProfileByAccountIdQuery, GetSocialMediaAccountProfileByAccountIdQueryVariables>(client, GetSocialMediaAccountProfileByAccountIdDocument, variables, headers),
    ...options
  }
    )};

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

export const SubmitCorrectionDocument = new TypedDocumentString(`
    mutation submitCorrection($eventId: ID!, $proposedData: ProposedEventCorrectionInput!, $source: CorrectionSource!) {
  submitCorrection(
    eventId: $eventId
    proposedData: $proposedData
    source: $source
  ) {
    id
    status
    validationErrors {
      field
      message
    }
  }
}
    `);

export const useSubmitCorrectionMutation = <
      TError = unknown,
      TContext = unknown
    >(
      client: GraphQLClient,
      options?: UseMutationOptions<SubmitCorrectionMutation, TError, SubmitCorrectionMutationVariables, TContext>,
      headers?: RequestInit['headers']
    ) => {
    
    return useMutation<SubmitCorrectionMutation, TError, SubmitCorrectionMutationVariables, TContext>(
      {
    mutationKey: ['submitCorrection'],
    mutationFn: (variables?: SubmitCorrectionMutationVariables) => fetcher<SubmitCorrectionMutation, SubmitCorrectionMutationVariables>(client, SubmitCorrectionDocument, variables, headers)(),
    ...options
  }
    )};

export const ExtractEventDataFromUrlDocument = new TypedDocumentString(`
    mutation extractEventDataFromUrl($url: String!) {
  extractEventDataFromUrl(url: $url) {
    data {
      eventName
      types
      categories
      location
      organizerName
      contactInfo
      description
      schedules {
        isMainSchedule
        eventStartDate
        eventEndDate
        eventStartTime
        eventEndTime
        title
        performers
        location
        ticketPrice
      }
    }
    errorCode
    errorMessage
  }
}
    `);

export const useExtractEventDataFromUrlMutation = <
      TError = unknown,
      TContext = unknown
    >(
      client: GraphQLClient,
      options?: UseMutationOptions<ExtractEventDataFromUrlMutation, TError, ExtractEventDataFromUrlMutationVariables, TContext>,
      headers?: RequestInit['headers']
    ) => {
    
    return useMutation<ExtractEventDataFromUrlMutation, TError, ExtractEventDataFromUrlMutationVariables, TContext>(
      {
    mutationKey: ['extractEventDataFromUrl'],
    mutationFn: (variables?: ExtractEventDataFromUrlMutationVariables) => fetcher<ExtractEventDataFromUrlMutation, ExtractEventDataFromUrlMutationVariables>(client, ExtractEventDataFromUrlDocument, variables, headers)(),
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
    organizerName
    contactInfo
    isFavorited
    isHiddenForCurrentUser
    sourceSocialMediaAccountProfile {
      accountId
      platform
      displayName
      profileImageUrl
    }
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

export const GetArchivedEventsDocument = new TypedDocumentString(`
    query getArchivedEvents($limit: Int, $offset: Int) {
  events(limit: $limit, offset: $offset, includeMyArchived: true) {
    items {
      id
      slug
      eventName
      imageUrl
      location
      categories
      types
      schedules {
        isMainSchedule
        eventStartDate
        ticketPrice
      }
      deletedAt
      isHiddenForCurrentUser
      isExpiredForCurrentUser
    }
    hasMore
    totalCount
  }
}
    `);

export const useGetArchivedEventsQuery = <
      TData = GetArchivedEventsQuery,
      TError = unknown
    >(
      client: GraphQLClient,
      variables?: GetArchivedEventsQueryVariables,
      options?: Omit<UseQueryOptions<GetArchivedEventsQuery, TError, TData>, 'queryKey'> & { queryKey?: UseQueryOptions<GetArchivedEventsQuery, TError, TData>['queryKey'] },
      headers?: RequestInit['headers']
    ) => {
    
    return useQuery<GetArchivedEventsQuery, TError, TData>(
      {
    queryKey: variables === undefined ? ['getArchivedEvents'] : ['getArchivedEvents', variables],
    queryFn: fetcher<GetArchivedEventsQuery, GetArchivedEventsQueryVariables>(client, GetArchivedEventsDocument, variables, headers),
    ...options
  }
    )};

export const SubmitReportDocument = new TypedDocumentString(`
    mutation submitReport($eventId: ID!, $reason: ReportReason!, $details: String) {
  submitReport(eventId: $eventId, reason: $reason, details: $details) {
    id
    reason
    status
    createdAt
  }
}
    `);

export const useSubmitReportMutation = <
      TError = unknown,
      TContext = unknown
    >(
      client: GraphQLClient,
      options?: UseMutationOptions<SubmitReportMutation, TError, SubmitReportMutationVariables, TContext>,
      headers?: RequestInit['headers']
    ) => {
    
    return useMutation<SubmitReportMutation, TError, SubmitReportMutationVariables, TContext>(
      {
    mutationKey: ['submitReport'],
    mutationFn: (variables?: SubmitReportMutationVariables) => fetcher<SubmitReportMutation, SubmitReportMutationVariables>(client, SubmitReportDocument, variables, headers)(),
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

export const GetReportedEventsDocument = new TypedDocumentString(`
    query getReportedEvents($status: ReportStatus, $reason: ReportReason) {
  reportedEvents(status: $status, reason: $reason) {
    id
    eventId
    reporterUserId
    reason
    details
    status
    createdAt
    moderatorIgnored
    event {
      id
      slug
      eventName
      imageUrl
      deletedAt
    }
  }
}
    `);

export const useGetReportedEventsQuery = <
      TData = GetReportedEventsQuery,
      TError = unknown
    >(
      client: GraphQLClient,
      variables?: GetReportedEventsQueryVariables,
      options?: Omit<UseQueryOptions<GetReportedEventsQuery, TError, TData>, 'queryKey'> & { queryKey?: UseQueryOptions<GetReportedEventsQuery, TError, TData>['queryKey'] },
      headers?: RequestInit['headers']
    ) => {
    
    return useQuery<GetReportedEventsQuery, TError, TData>(
      {
    queryKey: variables === undefined ? ['getReportedEvents'] : ['getReportedEvents', variables],
    queryFn: fetcher<GetReportedEventsQuery, GetReportedEventsQueryVariables>(client, GetReportedEventsDocument, variables, headers),
    ...options
  }
    )};

export const ResolveReportsForEventDocument = new TypedDocumentString(`
    mutation resolveReportsForEvent($eventId: ID!) {
  resolveReportsForEvent(eventId: $eventId) {
    id
    status
    resolvedAt
  }
}
    `);

export const useResolveReportsForEventMutation = <
      TError = unknown,
      TContext = unknown
    >(
      client: GraphQLClient,
      options?: UseMutationOptions<ResolveReportsForEventMutation, TError, ResolveReportsForEventMutationVariables, TContext>,
      headers?: RequestInit['headers']
    ) => {
    
    return useMutation<ResolveReportsForEventMutation, TError, ResolveReportsForEventMutationVariables, TContext>(
      {
    mutationKey: ['resolveReportsForEvent'],
    mutationFn: (variables?: ResolveReportsForEventMutationVariables) => fetcher<ResolveReportsForEventMutation, ResolveReportsForEventMutationVariables>(client, ResolveReportsForEventDocument, variables, headers)(),
    ...options
  }
    )};

export const DeleteEventPermanentlyDocument = new TypedDocumentString(`
    mutation deleteEventPermanently($id: ID!) {
  deleteEventPermanently(id: $id)
}
    `);

export const useDeleteEventPermanentlyMutation = <
      TError = unknown,
      TContext = unknown
    >(
      client: GraphQLClient,
      options?: UseMutationOptions<DeleteEventPermanentlyMutation, TError, DeleteEventPermanentlyMutationVariables, TContext>,
      headers?: RequestInit['headers']
    ) => {
    
    return useMutation<DeleteEventPermanentlyMutation, TError, DeleteEventPermanentlyMutationVariables, TContext>(
      {
    mutationKey: ['deleteEventPermanently'],
    mutationFn: (variables?: DeleteEventPermanentlyMutationVariables) => fetcher<DeleteEventPermanentlyMutation, DeleteEventPermanentlyMutationVariables>(client, DeleteEventPermanentlyDocument, variables, headers)(),
    ...options
  }
    )};

export const IgnoreSubsequentReportsDocument = new TypedDocumentString(`
    mutation ignoreSubsequentReports($reportId: ID!) {
  ignoreSubsequentReports(reportId: $reportId) {
    id
    moderatorIgnored
  }
}
    `);

export const useIgnoreSubsequentReportsMutation = <
      TError = unknown,
      TContext = unknown
    >(
      client: GraphQLClient,
      options?: UseMutationOptions<IgnoreSubsequentReportsMutation, TError, IgnoreSubsequentReportsMutationVariables, TContext>,
      headers?: RequestInit['headers']
    ) => {
    
    return useMutation<IgnoreSubsequentReportsMutation, TError, IgnoreSubsequentReportsMutationVariables, TContext>(
      {
    mutationKey: ['ignoreSubsequentReports'],
    mutationFn: (variables?: IgnoreSubsequentReportsMutationVariables) => fetcher<IgnoreSubsequentReportsMutation, IgnoreSubsequentReportsMutationVariables>(client, IgnoreSubsequentReportsDocument, variables, headers)(),
    ...options
  }
    )};

export const GetPendingDefaultLocationChangesDocument = new TypedDocumentString(`
    query getPendingDefaultLocationChanges {
  pendingDefaultLocationChanges {
    id
    accountId
    status
    createdAt
    account {
      id
      displayName
      platform
      username
      profileImageUrl
    }
    previousLocation {
      placeName
      formattedAddress
      coordinates {
        lat
        lng
      }
    }
    newLocation {
      placeName
      formattedAddress
      coordinates {
        lat
        lng
      }
    }
  }
}
    `);

export const useGetPendingDefaultLocationChangesQuery = <
      TData = GetPendingDefaultLocationChangesQuery,
      TError = unknown
    >(
      client: GraphQLClient,
      variables?: GetPendingDefaultLocationChangesQueryVariables,
      options?: Omit<UseQueryOptions<GetPendingDefaultLocationChangesQuery, TError, TData>, 'queryKey'> & { queryKey?: UseQueryOptions<GetPendingDefaultLocationChangesQuery, TError, TData>['queryKey'] },
      headers?: RequestInit['headers']
    ) => {
    
    return useQuery<GetPendingDefaultLocationChangesQuery, TError, TData>(
      {
    queryKey: variables === undefined ? ['getPendingDefaultLocationChanges'] : ['getPendingDefaultLocationChanges', variables],
    queryFn: fetcher<GetPendingDefaultLocationChangesQuery, GetPendingDefaultLocationChangesQueryVariables>(client, GetPendingDefaultLocationChangesDocument, variables, headers),
    ...options
  }
    )};

export const ResolveDefaultLocationChangeDocument = new TypedDocumentString(`
    mutation resolveDefaultLocationChange($id: ID!, $action: DefaultLocationChangeAction!) {
  resolveDefaultLocationChange(id: $id, action: $action) {
    id
    status
  }
}
    `);

export const useResolveDefaultLocationChangeMutation = <
      TError = unknown,
      TContext = unknown
    >(
      client: GraphQLClient,
      options?: UseMutationOptions<ResolveDefaultLocationChangeMutation, TError, ResolveDefaultLocationChangeMutationVariables, TContext>,
      headers?: RequestInit['headers']
    ) => {
    
    return useMutation<ResolveDefaultLocationChangeMutation, TError, ResolveDefaultLocationChangeMutationVariables, TContext>(
      {
    mutationKey: ['resolveDefaultLocationChange'],
    mutationFn: (variables?: ResolveDefaultLocationChangeMutationVariables) => fetcher<ResolveDefaultLocationChangeMutation, ResolveDefaultLocationChangeMutationVariables>(client, ResolveDefaultLocationChangeDocument, variables, headers)(),
    ...options
  }
    )};

export const CreateApiKeyDocument = new TypedDocumentString(`
    mutation CreateApiKey($input: CreateApiKeyInput!) {
  createApiKey(input: $input) {
    id
    provider
    maskedKey
    isValid
    createdAt
    updatedAt
  }
}
    `);

export const useCreateApiKeyMutation = <
      TError = unknown,
      TContext = unknown
    >(
      client: GraphQLClient,
      options?: UseMutationOptions<CreateApiKeyMutation, TError, CreateApiKeyMutationVariables, TContext>,
      headers?: RequestInit['headers']
    ) => {
    
    return useMutation<CreateApiKeyMutation, TError, CreateApiKeyMutationVariables, TContext>(
      {
    mutationKey: ['CreateApiKey'],
    mutationFn: (variables?: CreateApiKeyMutationVariables) => fetcher<CreateApiKeyMutation, CreateApiKeyMutationVariables>(client, CreateApiKeyDocument, variables, headers)(),
    ...options
  }
    )};

export const SubscribeToAccountDocument = new TypedDocumentString(`
    mutation SubscribeToAccount($input: SubscribeToAccountInput!) {
  subscribeToAccount(input: $input) {
    subscription {
      id
      accountId
      isNewlyAdded
      createdAt
    }
    alreadySubscribed
  }
}
    `);

export const useSubscribeToAccountMutation = <
      TError = unknown,
      TContext = unknown
    >(
      client: GraphQLClient,
      options?: UseMutationOptions<SubscribeToAccountMutation, TError, SubscribeToAccountMutationVariables, TContext>,
      headers?: RequestInit['headers']
    ) => {
    
    return useMutation<SubscribeToAccountMutation, TError, SubscribeToAccountMutationVariables, TContext>(
      {
    mutationKey: ['SubscribeToAccount'],
    mutationFn: (variables?: SubscribeToAccountMutationVariables) => fetcher<SubscribeToAccountMutation, SubscribeToAccountMutationVariables>(client, SubscribeToAccountDocument, variables, headers)(),
    ...options
  }
    )};

export const GetMyApiKeysDocument = new TypedDocumentString(`
    query GetMyApiKeys {
  myApiKeys {
    id
    provider
    maskedKey
    isValid
    createdAt
    updatedAt
  }
}
    `);

export const useGetMyApiKeysQuery = <
      TData = GetMyApiKeysQuery,
      TError = unknown
    >(
      client: GraphQLClient,
      variables?: GetMyApiKeysQueryVariables,
      options?: Omit<UseQueryOptions<GetMyApiKeysQuery, TError, TData>, 'queryKey'> & { queryKey?: UseQueryOptions<GetMyApiKeysQuery, TError, TData>['queryKey'] },
      headers?: RequestInit['headers']
    ) => {
    
    return useQuery<GetMyApiKeysQuery, TError, TData>(
      {
    queryKey: variables === undefined ? ['GetMyApiKeys'] : ['GetMyApiKeys', variables],
    queryFn: fetcher<GetMyApiKeysQuery, GetMyApiKeysQueryVariables>(client, GetMyApiKeysDocument, variables, headers),
    ...options
  }
    )};

export const MarkSubscriptionViewedDocument = new TypedDocumentString(`
    mutation markSubscriptionViewed($subscriptionId: ID!) {
  markSubscriptionViewed(subscriptionId: $subscriptionId) {
    id
    isNewlyAdded
  }
}
    `);

export const useMarkSubscriptionViewedMutation = <
      TError = unknown,
      TContext = unknown
    >(
      client: GraphQLClient,
      options?: UseMutationOptions<MarkSubscriptionViewedMutation, TError, MarkSubscriptionViewedMutationVariables, TContext>,
      headers?: RequestInit['headers']
    ) => {
    
    return useMutation<MarkSubscriptionViewedMutation, TError, MarkSubscriptionViewedMutationVariables, TContext>(
      {
    mutationKey: ['markSubscriptionViewed'],
    mutationFn: (variables?: MarkSubscriptionViewedMutationVariables) => fetcher<MarkSubscriptionViewedMutation, MarkSubscriptionViewedMutationVariables>(client, MarkSubscriptionViewedDocument, variables, headers)(),
    ...options
  }
    )};

export const GetPostsByAccountDocument = new TypedDocumentString(`
    query getPostsByAccount($accountId: ID!, $cursor: String, $limit: Int) {
  postsByAccount(accountId: $accountId, cursor: $cursor, limit: $limit) {
    items {
      id
      accountId
      content
      imageUrl
      postUrl
      originalPostUrl
      isExtracted
      publishedAt
    }
    nextCursor
    hasMore
  }
}
    `);

export const useGetPostsByAccountQuery = <
      TData = GetPostsByAccountQuery,
      TError = unknown
    >(
      client: GraphQLClient,
      variables: GetPostsByAccountQueryVariables,
      options?: Omit<UseQueryOptions<GetPostsByAccountQuery, TError, TData>, 'queryKey'> & { queryKey?: UseQueryOptions<GetPostsByAccountQuery, TError, TData>['queryKey'] },
      headers?: RequestInit['headers']
    ) => {
    
    return useQuery<GetPostsByAccountQuery, TError, TData>(
      {
    queryKey: ['getPostsByAccount', variables],
    queryFn: fetcher<GetPostsByAccountQuery, GetPostsByAccountQueryVariables>(client, GetPostsByAccountDocument, variables, headers),
    ...options
  }
    )};

export const MyReportsDocument = new TypedDocumentString(`
    query myReports {
  myReports {
    id
    reason
    status
    createdAt
    event {
      id
      slug
      eventName
      imageUrl
    }
  }
}
    `);

export const useMyReportsQuery = <
      TData = MyReportsQuery,
      TError = unknown
    >(
      client: GraphQLClient,
      variables?: MyReportsQueryVariables,
      options?: Omit<UseQueryOptions<MyReportsQuery, TError, TData>, 'queryKey'> & { queryKey?: UseQueryOptions<MyReportsQuery, TError, TData>['queryKey'] },
      headers?: RequestInit['headers']
    ) => {
    
    return useQuery<MyReportsQuery, TError, TData>(
      {
    queryKey: variables === undefined ? ['myReports'] : ['myReports', variables],
    queryFn: fetcher<MyReportsQuery, MyReportsQueryVariables>(client, MyReportsDocument, variables, headers),
    ...options
  }
    )};

export const DeleteApiKeyDocument = new TypedDocumentString(`
    mutation deleteApiKey($id: ID!, $action: SoftDeleteAction!) {
  deleteApiKey(id: $id, action: $action) {
    id
    provider
    maskedKey
    isValid
    createdAt
    updatedAt
  }
}
    `);

export const useDeleteApiKeyMutation = <
      TError = unknown,
      TContext = unknown
    >(
      client: GraphQLClient,
      options?: UseMutationOptions<DeleteApiKeyMutation, TError, DeleteApiKeyMutationVariables, TContext>,
      headers?: RequestInit['headers']
    ) => {
    
    return useMutation<DeleteApiKeyMutation, TError, DeleteApiKeyMutationVariables, TContext>(
      {
    mutationKey: ['deleteApiKey'],
    mutationFn: (variables?: DeleteApiKeyMutationVariables) => fetcher<DeleteApiKeyMutation, DeleteApiKeyMutationVariables>(client, DeleteApiKeyDocument, variables, headers)(),
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

export const RemoveSubscriptionDocument = new TypedDocumentString(`
    mutation removeSubscription($id: ID!, $action: SoftDeleteAction!) {
  removeSubscription(id: $id, action: $action) {
    id
  }
}
    `);

export const useRemoveSubscriptionMutation = <
      TError = unknown,
      TContext = unknown
    >(
      client: GraphQLClient,
      options?: UseMutationOptions<RemoveSubscriptionMutation, TError, RemoveSubscriptionMutationVariables, TContext>,
      headers?: RequestInit['headers']
    ) => {
    
    return useMutation<RemoveSubscriptionMutation, TError, RemoveSubscriptionMutationVariables, TContext>(
      {
    mutationKey: ['removeSubscription'],
    mutationFn: (variables?: RemoveSubscriptionMutationVariables) => fetcher<RemoveSubscriptionMutation, RemoveSubscriptionMutationVariables>(client, RemoveSubscriptionDocument, variables, headers)(),
    ...options
  }
    )};

export const SetAccountDefaultLocationDocument = new TypedDocumentString(`
    mutation setAccountDefaultLocation($accountId: ID!, $input: SetAccountDefaultLocationInput!) {
  setAccountDefaultLocation(accountId: $accountId, input: $input) {
    id
    defaultLocation {
      coordinates {
        lat
        lng
      }
      formattedAddress
      placeName
    }
  }
}
    `);

export const useSetAccountDefaultLocationMutation = <
      TError = unknown,
      TContext = unknown
    >(
      client: GraphQLClient,
      options?: UseMutationOptions<SetAccountDefaultLocationMutation, TError, SetAccountDefaultLocationMutationVariables, TContext>,
      headers?: RequestInit['headers']
    ) => {
    
    return useMutation<SetAccountDefaultLocationMutation, TError, SetAccountDefaultLocationMutationVariables, TContext>(
      {
    mutationKey: ['setAccountDefaultLocation'],
    mutationFn: (variables?: SetAccountDefaultLocationMutationVariables) => fetcher<SetAccountDefaultLocationMutation, SetAccountDefaultLocationMutationVariables>(client, SetAccountDefaultLocationDocument, variables, headers)(),
    ...options
  }
    )};

export const EditAccountDefaultLocationDocument = new TypedDocumentString(`
    mutation editAccountDefaultLocation($accountId: ID!, $input: SetAccountDefaultLocationInput!) {
  editAccountDefaultLocation(accountId: $accountId, input: $input) {
    id
    defaultLocation {
      coordinates {
        lat
        lng
      }
      formattedAddress
      placeName
    }
    hasPendingDefaultLocationReview
  }
}
    `);

export const useEditAccountDefaultLocationMutation = <
      TError = unknown,
      TContext = unknown
    >(
      client: GraphQLClient,
      options?: UseMutationOptions<EditAccountDefaultLocationMutation, TError, EditAccountDefaultLocationMutationVariables, TContext>,
      headers?: RequestInit['headers']
    ) => {
    
    return useMutation<EditAccountDefaultLocationMutation, TError, EditAccountDefaultLocationMutationVariables, TContext>(
      {
    mutationKey: ['editAccountDefaultLocation'],
    mutationFn: (variables?: EditAccountDefaultLocationMutationVariables) => fetcher<EditAccountDefaultLocationMutation, EditAccountDefaultLocationMutationVariables>(client, EditAccountDefaultLocationDocument, variables, headers)(),
    ...options
  }
    )};

export const GetMySubscriptionsDocument = new TypedDocumentString(`
    query getMySubscriptions {
  mySubscriptions {
    id
    accountId
    isNewlyAdded
    isInactive
    createdAt
    pendingExtractionCount
    account {
      id
      platform
      displayName
      username
      profileImageUrl
      defaultLocation {
        coordinates {
          lat
          lng
        }
        formattedAddress
        placeName
      }
      hasPendingDefaultLocationReview
    }
  }
}
    `);

export const useGetMySubscriptionsQuery = <
      TData = GetMySubscriptionsQuery,
      TError = unknown
    >(
      client: GraphQLClient,
      variables?: GetMySubscriptionsQueryVariables,
      options?: Omit<UseQueryOptions<GetMySubscriptionsQuery, TError, TData>, 'queryKey'> & { queryKey?: UseQueryOptions<GetMySubscriptionsQuery, TError, TData>['queryKey'] },
      headers?: RequestInit['headers']
    ) => {
    
    return useQuery<GetMySubscriptionsQuery, TError, TData>(
      {
    queryKey: variables === undefined ? ['getMySubscriptions'] : ['getMySubscriptions', variables],
    queryFn: fetcher<GetMySubscriptionsQuery, GetMySubscriptionsQueryVariables>(client, GetMySubscriptionsDocument, variables, headers),
    ...options
  }
    )};

export const ReportSystemErrorDocument = new TypedDocumentString(`
    mutation ReportSystemError($input: ReportSystemErrorInput!) {
  reportSystemError(input: $input)
}
    `);

export const useReportSystemErrorMutation = <
      TError = unknown,
      TContext = unknown
    >(
      client: GraphQLClient,
      options?: UseMutationOptions<ReportSystemErrorMutation, TError, ReportSystemErrorMutationVariables, TContext>,
      headers?: RequestInit['headers']
    ) => {
    
    return useMutation<ReportSystemErrorMutation, TError, ReportSystemErrorMutationVariables, TContext>(
      {
    mutationKey: ['ReportSystemError'],
    mutationFn: (variables?: ReportSystemErrorMutationVariables) => fetcher<ReportSystemErrorMutation, ReportSystemErrorMutationVariables>(client, ReportSystemErrorDocument, variables, headers)(),
    ...options
  }
    )};
