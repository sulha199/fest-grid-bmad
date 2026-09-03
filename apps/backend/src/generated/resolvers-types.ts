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
  DateTime: { input: any; output: any; }
  JSON: { input: any; output: any; }
};

export type AiEventFilter = {
  __typename?: 'AIEventFilter';
  createdAt: Scalars['String']['output'];
  deletedAt?: Maybe<Scalars['String']['output']>;
  id: Scalars['ID']['output'];
  ownerUserId: Scalars['ID']['output'];
  prompt: Scalars['String']['output'];
  resolvedFilter: EventFilter;
  updatedAt: Scalars['String']['output'];
};

export type AccountVote = {
  __typename?: 'AccountVote';
  accountId: Scalars['ID']['output'];
  createdAt: Scalars['String']['output'];
  deletedAt?: Maybe<Scalars['String']['output']>;
  id: Scalars['ID']['output'];
  userId: Scalars['ID']['output'];
};

export type ActorRunConnection = {
  __typename?: 'ActorRunConnection';
  edges: Array<ActorRunEdge>;
  pageInfo: PageInfo;
  totalCount: Scalars['Int']['output'];
};

export type ActorRunEdge = {
  __typename?: 'ActorRunEdge';
  cursor: Scalars['String']['output'];
  node: ScraperActorRun;
};

export type ActorRunFilters = {
  createdAfter?: InputMaybe<Scalars['DateTime']['input']>;
  createdBefore?: InputMaybe<Scalars['DateTime']['input']>;
  profileId?: InputMaybe<Scalars['ID']['input']>;
  status?: InputMaybe<ActorRunStatus>;
  vendor?: InputMaybe<ActorRunVendor>;
};

export type ActorRunStatus =
  | 'ABORTED'
  | 'FAILED'
  | 'PENDING'
  | 'SUCCEEDED'
  | 'TIMED_OUT';

export type ActorRunTriggerMode =
  | 'ASYNC'
  | 'SYNC';

export type ActorRunVendor =
  | 'APIFY'
  | 'BRIGHTDATA';

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

export type CastVoteInput = {
  accountId?: InputMaybe<Scalars['ID']['input']>;
  handleOrUrl?: InputMaybe<Scalars['String']['input']>;
  platform?: InputMaybe<Scalars['String']['input']>;
};

export type Coordinates = {
  __typename?: 'Coordinates';
  lat: Scalars['Float']['output'];
  lng: Scalars['Float']['output'];
};

export type CoordinatesInput = {
  lat: Scalars['Float']['input'];
  lng: Scalars['Float']['input'];
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

export type CorrectionSource =
  | 'ai_assisted'
  | 'manual';

export type CorrectionStatus =
  | 'applied'
  | 'pending'
  | 'rejected';

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

export type CreateWidgetInput = {
  displayMode?: InputMaybe<WidgetDisplayMode>;
  filters: EventFilterInput;
  theme?: InputMaybe<WidgetTheme>;
};

export type DateAnchor =
  | 'THIS_MONTH'
  | 'THIS_WEEK'
  | 'TODAY';

export type DateOffsetUnit =
  | 'DAY'
  | 'MONTH'
  | 'WEEK';

export type DateRangeFilter = {
  __typename?: 'DateRangeFilter';
  anchor: DateAnchor;
  offsetAmount: Scalars['Int']['output'];
  offsetUnit: DateOffsetUnit;
};

export type DateRangeFilterInput = {
  anchor: DateAnchor;
  offsetAmount: Scalars['Int']['input'];
  offsetUnit: DateOffsetUnit;
};

export type DayOfWeek =
  | 'FRI'
  | 'MON'
  | 'SAT'
  | 'SUN'
  | 'THU'
  | 'TUE'
  | 'WED';

export type DefaultLocationChangeAction =
  | 'ACCEPT'
  | 'APPROVE'
  | 'REJECT'
  | 'REVERT';

export type DefaultLocationChangeRequest = {
  __typename?: 'DefaultLocationChangeRequest';
  account: SocialMediaAccountProfile;
  accountId: Scalars['ID']['output'];
  changeSource: DefaultLocationChangeSource;
  changedByUserId?: Maybe<Scalars['ID']['output']>;
  confidenceScore?: Maybe<Scalars['Float']['output']>;
  createdAt: Scalars['String']['output'];
  id: Scalars['ID']['output'];
  newLocation: LocationDetails;
  previousLocation?: Maybe<LocationDetails>;
  reviewedAt?: Maybe<Scalars['String']['output']>;
  reviewedByModeratorId?: Maybe<Scalars['ID']['output']>;
  status: DefaultLocationChangeRequestStatus;
};

export type DefaultLocationChangeRequestStatus =
  | 'ACCEPTED'
  | 'AWAITING_APPROVAL'
  | 'PENDING_REVIEW'
  | 'REJECTED'
  | 'REVERTED'
  | 'SUPERSEDED';

export type DefaultLocationChangeSource =
  | 'AI_INFERENCE'
  | 'MODERATOR'
  | 'USER';

export type EmbedDomain = {
  __typename?: 'EmbedDomain';
  createdAt: Scalars['String']['output'];
  deletedAt?: Maybe<Scalars['String']['output']>;
  id: Scalars['ID']['output'];
  pattern: Scalars['String']['output'];
  widgetId: Scalars['ID']['output'];
};

export type Event = {
  __typename?: 'Event';
  categories?: Maybe<Array<EventCategory>>;
  contactInfo?: Maybe<Scalars['String']['output']>;
  createdAt: Scalars['String']['output'];
  deletedAt?: Maybe<Scalars['String']['output']>;
  description?: Maybe<Scalars['String']['output']>;
  durableImageUrl?: Maybe<Scalars['String']['output']>;
  eventName: Scalars['String']['output'];
  favoriteCount: Scalars['Int']['output'];
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
  videoUrl?: Maybe<Scalars['String']['output']>;
};

export type EventCategory =
  | 'ARTS_AND_CULTURE'
  | 'AUTOMOTIVE'
  | 'BUSINESS_AND_NETWORKING'
  | 'CAREER'
  | 'CHARITY_AND_CAUSES'
  | 'CIVIC_AND_COMMUNITY'
  | 'EDUCATION'
  | 'FAMILY_AND_KIDS'
  | 'FOOD_AND_DRINK'
  | 'HEALTH_AND_WELLNESS'
  | 'HOBBIES_AND_INTERESTS'
  | 'HOLIDAY'
  | 'MUSIC'
  | 'OTHER'
  | 'RELIGION_AND_SPIRITUALITY'
  | 'SPORTS_AND_FITNESS'
  | 'TECHNOLOGY'
  | 'TRAVEL_AND_TOURISM';

export type EventConnection = {
  __typename?: 'EventConnection';
  hasMore: Scalars['Boolean']['output'];
  items: Array<Event>;
  totalCount: Scalars['Int']['output'];
};

export type EventFilter = {
  __typename?: 'EventFilter';
  accountId?: Maybe<Scalars['ID']['output']>;
  categories?: Maybe<Array<EventCategory>>;
  dateRange?: Maybe<DateRangeFilter>;
  dayOfWeek?: Maybe<DayOfWeek>;
  isFree?: Maybe<Scalars['Boolean']['output']>;
  keyword?: Maybe<Scalars['String']['output']>;
  location?: Maybe<LocationFilter>;
  types?: Maybe<Array<EventType>>;
  venueType?: Maybe<Scalars['String']['output']>;
};

export type EventFilterInput = {
  accountId?: InputMaybe<Scalars['ID']['input']>;
  categories?: InputMaybe<Array<EventCategory>>;
  dateRange?: InputMaybe<DateRangeFilterInput>;
  dayOfWeek?: InputMaybe<DayOfWeek>;
  isFree?: InputMaybe<Scalars['Boolean']['input']>;
  keyword?: InputMaybe<Scalars['String']['input']>;
  location?: InputMaybe<LocationFilterInput>;
  types?: InputMaybe<Array<EventType>>;
  venueType?: InputMaybe<Scalars['String']['input']>;
};

export type EventQueryConditionInput = {
  conditions?: InputMaybe<Array<EventQueryConditionInput>>;
  field?: InputMaybe<Scalars['String']['input']>;
  operator?: InputMaybe<Scalars['String']['input']>;
  value?: InputMaybe<Scalars['JSON']['input']>;
};

export type EventType =
  | 'CIVIC'
  | 'COMPETITION'
  | 'EXHIBITION'
  | 'FESTIVAL'
  | 'FUNDRAISER'
  | 'GATHERING'
  | 'MARKET'
  | 'OTHER'
  | 'PERFORMANCE'
  | 'PROMOTION'
  | 'SEMINAR'
  | 'WORKSHOP';

export type ExtractEventDataFromUrlResult = {
  __typename?: 'ExtractEventDataFromUrlResult';
  data?: Maybe<ProposedEventCorrectionData>;
  errorCode?: Maybe<ExtractionErrorCode>;
  errorMessage?: Maybe<Scalars['String']['output']>;
};

export type ExtractionErrorCode =
  | 'EXTRACTION_FAILED'
  | 'NOT_FOUND'
  | 'NO_API_KEY'
  | 'QUOTA_EXHAUSTED'
  | 'SCRAPE_FAILED'
  | 'UNSUPPORTED_PLATFORM';

export type ExtractionQuota = {
  __typename?: 'ExtractionQuota';
  limit: Scalars['Int']['output'];
  remaining: Scalars['Int']['output'];
  used: Scalars['Int']['output'];
};

export type GeolocationProvider =
  | 'GEOAPIFY';

export type LocationDetails = {
  __typename?: 'LocationDetails';
  adminArea?: Maybe<Scalars['String']['output']>;
  city?: Maybe<Scalars['String']['output']>;
  coordinates: Coordinates;
  formattedAddress?: Maybe<Scalars['String']['output']>;
  placeId?: Maybe<Scalars['String']['output']>;
  placeName?: Maybe<Scalars['String']['output']>;
  provider?: Maybe<GeolocationProvider>;
  province?: Maybe<Scalars['String']['output']>;
  timezone?: Maybe<Scalars['String']['output']>;
  venueType?: Maybe<Scalars['String']['output']>;
};

export type LocationFilter = {
  __typename?: 'LocationFilter';
  adminArea?: Maybe<Scalars['String']['output']>;
  coordinates?: Maybe<Coordinates>;
  radiusMeters?: Maybe<Scalars['Int']['output']>;
};

export type LocationFilterInput = {
  adminArea?: InputMaybe<Scalars['String']['input']>;
  coordinates?: InputMaybe<CoordinatesInput>;
  radiusMeters?: InputMaybe<Scalars['Int']['input']>;
};

export type Me = {
  __typename?: 'Me';
  email: Scalars['String']['output'];
  id: Scalars['ID']['output'];
  role: Scalars['String']['output'];
};

export type Mutation = {
  __typename?: 'Mutation';
  castVote: AccountVote;
  createApiKey: ApiKey;
  createUserLocation: UserLocation;
  createWidget: Widget;
  deleteAIEventFilter: AiEventFilter;
  deleteApiKey: ApiKey;
  deleteEventPermanently: Scalars['Boolean']['output'];
  deleteUnprocessedPayload: Scalars['Boolean']['output'];
  deleteUserLocation: UserLocation;
  deleteWidget: Widget;
  deregisterEmbedDomain: EmbedDomain;
  editAccountDefaultLocation: SocialMediaAccountProfile;
  extractEventDataFromUrl: ExtractEventDataFromUrlResult;
  ignoreSubsequentReports: Report;
  markSubscriptionViewed: Subscription;
  registerEmbedDomain: EmbedDomain;
  registerFcmToken: Scalars['Boolean']['output'];
  removeSubscription: Subscription;
  replayActorRun: ReplayActorRunResult;
  reportSystemError: Scalars['Boolean']['output'];
  reprocessPayload: ReprocessResult;
  resolveDefaultLocationChange: DefaultLocationChangeRequest;
  resolvePromptToEventFilter: ResolvedAiEventFilterResult;
  resolveReport: Report;
  resolveReportsForEvent: Array<Report>;
  resolveScheduleTimezone: ResolveScheduleTimezoneResult;
  restoreEvent: Event;
  saveAIEventFilter: AiEventFilter;
  selectPostsForExtraction: Array<Post>;
  setAccountDefaultLocation: SocialMediaAccountProfile;
  submitCorrection: Correction;
  submitReport: Report;
  subscribeToAccount: SubscribeToAccountResult;
  toggleCalendarAddition: ToggleCalendarAdditionResult;
  toggleFavorite: ToggleFavoriteResult;
  triggerAccountScrape: TriggerAccountScrapeResult;
  unregisterFcmToken: Scalars['Boolean']['output'];
  updateUserLocation: UserLocation;
  updateUserSettings: UserSettings;
  updateUserTimezone: Scalars['Boolean']['output'];
  updateWidget: Widget;
  withdrawVote: AccountVote;
};


export type MutationCastVoteArgs = {
  input: CastVoteInput;
};


export type MutationCreateApiKeyArgs = {
  input: CreateApiKeyInput;
};


export type MutationCreateUserLocationArgs = {
  input: CreateUserLocationInput;
};


export type MutationCreateWidgetArgs = {
  input: CreateWidgetInput;
};


export type MutationDeleteAiEventFilterArgs = {
  action: SoftDeleteAction;
  id: Scalars['ID']['input'];
};


export type MutationDeleteApiKeyArgs = {
  action: SoftDeleteAction;
  id: Scalars['ID']['input'];
};


export type MutationDeleteEventPermanentlyArgs = {
  id: Scalars['ID']['input'];
};


export type MutationDeleteUnprocessedPayloadArgs = {
  payloadId: Scalars['ID']['input'];
};


export type MutationDeleteUserLocationArgs = {
  action: SoftDeleteAction;
  id: Scalars['ID']['input'];
};


export type MutationDeleteWidgetArgs = {
  action: SoftDeleteAction;
  id: Scalars['ID']['input'];
};


export type MutationDeregisterEmbedDomainArgs = {
  action: SoftDeleteAction;
  id: Scalars['ID']['input'];
};


export type MutationEditAccountDefaultLocationArgs = {
  accountId: Scalars['ID']['input'];
  asModeratorCorrection?: InputMaybe<Scalars['Boolean']['input']>;
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


export type MutationRegisterEmbedDomainArgs = {
  pattern: Scalars['String']['input'];
  widgetId: Scalars['ID']['input'];
};


export type MutationRegisterFcmTokenArgs = {
  token: Scalars['String']['input'];
};


export type MutationRemoveSubscriptionArgs = {
  action: SoftDeleteAction;
  id: Scalars['ID']['input'];
};


export type MutationReplayActorRunArgs = {
  actorRunId: Scalars['ID']['input'];
};


export type MutationReportSystemErrorArgs = {
  input: ReportSystemErrorInput;
};


export type MutationReprocessPayloadArgs = {
  parserVersion: Scalars['String']['input'];
  payloadId: Scalars['ID']['input'];
};


export type MutationResolveDefaultLocationChangeArgs = {
  action: DefaultLocationChangeAction;
  id: Scalars['ID']['input'];
};


export type MutationResolvePromptToEventFilterArgs = {
  prompt: Scalars['String']['input'];
};


export type MutationResolveReportArgs = {
  id: Scalars['ID']['input'];
  outcome: ReportOutcome;
};


export type MutationResolveReportsForEventArgs = {
  eventId: Scalars['ID']['input'];
};


export type MutationResolveScheduleTimezoneArgs = {
  scheduleId: Scalars['ID']['input'];
  timezone: Scalars['String']['input'];
};


export type MutationRestoreEventArgs = {
  action: SoftDeleteAction;
  id: Scalars['ID']['input'];
};


export type MutationSaveAiEventFilterArgs = {
  prompt: Scalars['String']['input'];
  resolvedFilter: EventFilterInput;
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


export type MutationTriggerAccountScrapeArgs = {
  accountId: Scalars['ID']['input'];
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


export type MutationUpdateUserTimezoneArgs = {
  timezone: Scalars['String']['input'];
};


export type MutationUpdateWidgetArgs = {
  id: Scalars['ID']['input'];
  input: UpdateWidgetInput;
};


export type MutationWithdrawVoteArgs = {
  action: SoftDeleteAction;
  id: Scalars['ID']['input'];
};

export type PageInfo = {
  __typename?: 'PageInfo';
  endCursor?: Maybe<Scalars['String']['output']>;
  hasNextPage: Scalars['Boolean']['output'];
};

export type ParserVersion = {
  __typename?: 'ParserVersion';
  createdAt: Scalars['DateTime']['output'];
  deployedAt: Scalars['DateTime']['output'];
  description?: Maybe<Scalars['String']['output']>;
  id: Scalars['ID']['output'];
  isActive: Scalars['Boolean']['output'];
  sourceFile?: Maybe<Scalars['String']['output']>;
  version: Scalars['String']['output'];
};

export type PayloadContext = {
  __typename?: 'PayloadContext';
  accountId?: Maybe<Scalars['String']['output']>;
  parserVersion: Scalars['String']['output'];
  postUrl?: Maybe<Scalars['String']['output']>;
  scraperVendor?: Maybe<Scalars['String']['output']>;
  source: UnprocessedPayloadSource;
  timestamp: Scalars['DateTime']['output'];
};

export type Post = {
  __typename?: 'Post';
  accountId: Scalars['ID']['output'];
  content?: Maybe<Scalars['String']['output']>;
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
  embedDomainsForWidget: Array<EmbedDomain>;
  event?: Maybe<Event>;
  eventBySlug?: Maybe<Event>;
  events: EventConnection;
  health: Scalars['Boolean']['output'];
  isOriginAllowedForWidget: Scalars['Boolean']['output'];
  me: Me;
  /**
   * Combined count of items awaiting moderator action across Moderator Items
   * (Section 3.9.3): pending Reports plus Default Location changes in
   * PENDING_REVIEW or AWAITING_APPROVAL status (Section 3.7/4.14). Powers the
   * Moderator Pending-Item Badge (added 2026-08-28). Moderator-gated like every
   * other Moderator Items query -- the frontend must already know to only call
   * this for a moderator (the same `me.role` check that gates the nav entry
   * itself, Story 0.7/2.8), not rely on this query to answer that question.
   */
  moderatorPendingItemCount: Scalars['Int']['output'];
  myAIEventFilters: Array<AiEventFilter>;
  myApiKeys: Array<ApiKey>;
  myExtractionQuota: ExtractionQuota;
  myLocations: Array<UserLocation>;
  myReports: Array<Report>;
  mySettings: UserSettings;
  mySubscriptions: Array<Subscription>;
  myWidgets: Array<Widget>;
  parserVersions: Array<ParserVersion>;
  pendingDefaultLocationChanges: Array<DefaultLocationChangeRequest>;
  postsByAccount: PostConnection;
  previewLocation: LocationDetails;
  queryActorRuns: ActorRunConnection;
  queryUnprocessedPayloads: UnprocessedPayloadConnection;
  rankedVoteAccounts: Array<RankedAccountVote>;
  reportedEvents: Array<Report>;
  socialMediaAccountProfileByAccountId?: Maybe<SocialMediaAccountProfile>;
  voteRegionBreakdown: Array<RegionVoteBucket>;
  votedAccountSuggestions: Array<RankedAccountVote>;
  widgetById?: Maybe<Widget>;
};


export type QueryAddressAutocompleteArgs = {
  input: Scalars['String']['input'];
};


export type QueryEmbedDomainsForWidgetArgs = {
  widgetId: Scalars['ID']['input'];
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
  filter?: InputMaybe<EventFilterInput>;
  includeMyArchived?: InputMaybe<Scalars['Boolean']['input']>;
  includeSoftDeleted?: InputMaybe<Scalars['Boolean']['input']>;
  limit?: InputMaybe<Scalars['Int']['input']>;
  offset?: InputMaybe<Scalars['Int']['input']>;
  query?: InputMaybe<EventQueryConditionInput>;
};


export type QueryIsOriginAllowedForWidgetArgs = {
  origin: Scalars['String']['input'];
  widgetId: Scalars['ID']['input'];
};


export type QueryParserVersionsArgs = {
  onlyActive?: InputMaybe<Scalars['Boolean']['input']>;
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


export type QueryQueryActorRunsArgs = {
  after?: InputMaybe<Scalars['String']['input']>;
  filters?: InputMaybe<ActorRunFilters>;
  first?: InputMaybe<Scalars['Int']['input']>;
};


export type QueryQueryUnprocessedPayloadsArgs = {
  after?: InputMaybe<Scalars['String']['input']>;
  filters?: InputMaybe<UnprocessedPayloadFilters>;
  first?: InputMaybe<Scalars['Int']['input']>;
};


export type QueryRankedVoteAccountsArgs = {
  locationPreferenceId?: InputMaybe<Scalars['ID']['input']>;
  nearMe?: InputMaybe<Scalars['Boolean']['input']>;
};


export type QueryReportedEventsArgs = {
  reason?: InputMaybe<ReportReason>;
  status?: InputMaybe<ReportStatus>;
};


export type QuerySocialMediaAccountProfileByAccountIdArgs = {
  accountId: Scalars['String']['input'];
  platform: Scalars['String']['input'];
};


export type QueryVoteRegionBreakdownArgs = {
  accountId: Scalars['ID']['input'];
};


export type QueryVotedAccountSuggestionsArgs = {
  query?: InputMaybe<Scalars['String']['input']>;
};


export type QueryWidgetByIdArgs = {
  id: Scalars['ID']['input'];
};

export type RankedAccountVote = {
  __typename?: 'RankedAccountVote';
  profile: SocialMediaAccountProfile;
  userVoteId?: Maybe<Scalars['ID']['output']>;
  voteCount: Scalars['Int']['output'];
};

export type RegionVoteBucket = {
  __typename?: 'RegionVoteBucket';
  label: Scalars['String']['output'];
  voterCount: Scalars['Int']['output'];
};

export type ReplayActorRunResult = {
  __typename?: 'ReplayActorRunResult';
  message: Scalars['String']['output'];
  postsPersisted: Scalars['Int']['output'];
  success: Scalars['Boolean']['output'];
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

export type ReportOutcome =
  | 'dismissed'
  | 'upheld';

export type ReportReason =
  | 'cancelled'
  | 'dangerous'
  | 'personal';

export type ReportStatus =
  | 'dismissed'
  | 'pending'
  | 'upheld';

export type ReportSystemErrorInput = {
  context?: InputMaybe<Scalars['String']['input']>;
  message: Scalars['String']['input'];
  source: Scalars['String']['input'];
};

export type ReprocessResult = {
  __typename?: 'ReprocessResult';
  message: Scalars['String']['output'];
  queueId?: Maybe<Scalars['String']['output']>;
  success: Scalars['Boolean']['output'];
};

export type ResolveScheduleTimezoneResult = {
  __typename?: 'ResolveScheduleTimezoneResult';
  scheduleId: Scalars['ID']['output'];
  timezone: Scalars['String']['output'];
  timezoneStatus: ScheduleTimezoneStatus;
};

export type ResolvedAiEventFilterResult = {
  __typename?: 'ResolvedAIEventFilterResult';
  caveats: Array<Scalars['String']['output']>;
  resolvedFilter: EventFilter;
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
  timezoneStatus?: Maybe<ScheduleTimezoneStatus>;
  title?: Maybe<Scalars['String']['output']>;
  updatedAt: Scalars['String']['output'];
};

export type ScheduleTimezoneStatus =
  | 'NEEDS_CLARIFICATION'
  | 'RESOLVED';

export type ScraperActorRun = {
  __typename?: 'ScraperActorRun';
  completedAt?: Maybe<Scalars['DateTime']['output']>;
  createdAt: Scalars['DateTime']['output'];
  errorMessage?: Maybe<Scalars['String']['output']>;
  id: Scalars['ID']['output'];
  itemCount?: Maybe<Scalars['Int']['output']>;
  pendingJobId?: Maybe<Scalars['String']['output']>;
  profileId: Scalars['ID']['output'];
  rawInput: Scalars['JSON']['output'];
  rawOutput?: Maybe<Scalars['JSON']['output']>;
  runId: Scalars['String']['output'];
  startedAt: Scalars['DateTime']['output'];
  status: ActorRunStatus;
  triggerMode: ActorRunTriggerMode;
  updatedAt: Scalars['DateTime']['output'];
  vendor: ActorRunVendor;
};

export type SetAccountDefaultLocationInput = {
  latitude?: InputMaybe<Scalars['Float']['input']>;
  longitude?: InputMaybe<Scalars['Float']['input']>;
  placeId?: InputMaybe<Scalars['String']['input']>;
};

export type SocialMediaAccountProfile = {
  __typename?: 'SocialMediaAccountProfile';
  accountId: Scalars['String']['output'];
  accountType?: Maybe<Scalars['String']['output']>;
  accountTypeStatus?: Maybe<Scalars['String']['output']>;
  defaultLocation?: Maybe<LocationDetails>;
  description?: Maybe<Scalars['String']['output']>;
  displayName: Scalars['String']['output'];
  hasPendingDefaultLocationReview: Scalars['Boolean']['output'];
  id: Scalars['ID']['output'];
  isScrapeInProgress: Scalars['Boolean']['output'];
  lastPostDate?: Maybe<Scalars['String']['output']>;
  lastScrapedAt?: Maybe<Scalars['String']['output']>;
  platform: Scalars['String']['output'];
  profileImageUrl?: Maybe<Scalars['String']['output']>;
  username: Scalars['String']['output'];
};

export type SoftDeleteAction =
  | 'DELETE'
  | 'RESTORE';

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

export type TriggerAccountScrapeResult = {
  __typename?: 'TriggerAccountScrapeResult';
  isInitialScrape: Scalars['Boolean']['output'];
  triggered: Scalars['Boolean']['output'];
};

export type UnprocessedPayloadConnection = {
  __typename?: 'UnprocessedPayloadConnection';
  edges: Array<UnprocessedPayloadEdge>;
  pageInfo: PageInfo;
  totalCount: Scalars['Int']['output'];
};

export type UnprocessedPayloadEdge = {
  __typename?: 'UnprocessedPayloadEdge';
  cursor: Scalars['String']['output'];
  node: UnprocessedScraperPayload;
};

export type UnprocessedPayloadFilters = {
  createdAfter?: InputMaybe<Scalars['DateTime']['input']>;
  createdBefore?: InputMaybe<Scalars['DateTime']['input']>;
  parserVersion?: InputMaybe<Scalars['String']['input']>;
  source?: InputMaybe<UnprocessedPayloadSource>;
};

export type UnprocessedPayloadSource =
  | 'APIFY'
  | 'BRIGHTDATA'
  | 'GEMINI';

export type UnprocessedScraperPayload = {
  __typename?: 'UnprocessedScraperPayload';
  context: PayloadContext;
  createdAt: Scalars['DateTime']['output'];
  deletedAt?: Maybe<Scalars['DateTime']['output']>;
  id: Scalars['ID']['output'];
  rawPayload: Scalars['JSON']['output'];
  validationError: Array<ValidationErrorDetail>;
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

export type UpdateWidgetInput = {
  displayMode?: InputMaybe<WidgetDisplayMode>;
  filters?: InputMaybe<EventFilterInput>;
  theme?: InputMaybe<WidgetTheme>;
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

export type ValidationErrorDetail = {
  __typename?: 'ValidationErrorDetail';
  instancePath?: Maybe<Scalars['String']['output']>;
  keyword?: Maybe<Scalars['String']['output']>;
  message: Scalars['String']['output'];
  params?: Maybe<Scalars['JSON']['output']>;
  schemaPath?: Maybe<Scalars['String']['output']>;
};

export type Widget = {
  __typename?: 'Widget';
  createdAt: Scalars['String']['output'];
  deletedAt?: Maybe<Scalars['String']['output']>;
  displayMode: WidgetDisplayMode;
  filters: EventFilter;
  id: Scalars['ID']['output'];
  ownerUserId: Scalars['ID']['output'];
  theme: WidgetTheme;
};

export type WidgetDisplayMode =
  | 'CALENDAR'
  | 'CARD';

export type WidgetTheme =
  | 'DARK'
  | 'LIGHT';

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
  AIEventFilter: ResolverTypeWrapper<AiEventFilter>;
  AccountVote: ResolverTypeWrapper<AccountVote>;
  ActorRunConnection: ResolverTypeWrapper<ActorRunConnection>;
  ActorRunEdge: ResolverTypeWrapper<ActorRunEdge>;
  ActorRunFilters: ActorRunFilters;
  ActorRunStatus: ActorRunStatus;
  ActorRunTriggerMode: ActorRunTriggerMode;
  ActorRunVendor: ActorRunVendor;
  AddressSuggestion: ResolverTypeWrapper<AddressSuggestion>;
  ApiKey: ResolverTypeWrapper<ApiKey>;
  Boolean: ResolverTypeWrapper<Scalars['Boolean']['output']>;
  CastVoteInput: CastVoteInput;
  Coordinates: ResolverTypeWrapper<Coordinates>;
  CoordinatesInput: CoordinatesInput;
  Correction: ResolverTypeWrapper<Correction>;
  CorrectionSource: CorrectionSource;
  CorrectionStatus: CorrectionStatus;
  CreateApiKeyInput: CreateApiKeyInput;
  CreateUserLocationInput: CreateUserLocationInput;
  CreateWidgetInput: CreateWidgetInput;
  DateAnchor: DateAnchor;
  DateOffsetUnit: DateOffsetUnit;
  DateRangeFilter: ResolverTypeWrapper<DateRangeFilter>;
  DateRangeFilterInput: DateRangeFilterInput;
  DateTime: ResolverTypeWrapper<Scalars['DateTime']['output']>;
  DayOfWeek: DayOfWeek;
  DefaultLocationChangeAction: DefaultLocationChangeAction;
  DefaultLocationChangeRequest: ResolverTypeWrapper<DefaultLocationChangeRequest>;
  DefaultLocationChangeRequestStatus: DefaultLocationChangeRequestStatus;
  DefaultLocationChangeSource: DefaultLocationChangeSource;
  EmbedDomain: ResolverTypeWrapper<EmbedDomain>;
  Event: ResolverTypeWrapper<Event>;
  EventCategory: EventCategory;
  EventConnection: ResolverTypeWrapper<EventConnection>;
  EventFilter: ResolverTypeWrapper<EventFilter>;
  EventFilterInput: EventFilterInput;
  EventQueryConditionInput: EventQueryConditionInput;
  EventType: EventType;
  ExtractEventDataFromUrlResult: ResolverTypeWrapper<ExtractEventDataFromUrlResult>;
  ExtractionErrorCode: ExtractionErrorCode;
  ExtractionQuota: ResolverTypeWrapper<ExtractionQuota>;
  Float: ResolverTypeWrapper<Scalars['Float']['output']>;
  GeolocationProvider: GeolocationProvider;
  ID: ResolverTypeWrapper<Scalars['ID']['output']>;
  Int: ResolverTypeWrapper<Scalars['Int']['output']>;
  JSON: ResolverTypeWrapper<Scalars['JSON']['output']>;
  LocationDetails: ResolverTypeWrapper<LocationDetails>;
  LocationFilter: ResolverTypeWrapper<LocationFilter>;
  LocationFilterInput: LocationFilterInput;
  Me: ResolverTypeWrapper<Me>;
  Mutation: ResolverTypeWrapper<{}>;
  PageInfo: ResolverTypeWrapper<PageInfo>;
  ParserVersion: ResolverTypeWrapper<ParserVersion>;
  PayloadContext: ResolverTypeWrapper<PayloadContext>;
  Post: ResolverTypeWrapper<Post>;
  PostConnection: ResolverTypeWrapper<PostConnection>;
  ProposedEventCorrectionData: ResolverTypeWrapper<ProposedEventCorrectionData>;
  ProposedEventCorrectionInput: ProposedEventCorrectionInput;
  ProposedScheduleCorrectionData: ResolverTypeWrapper<ProposedScheduleCorrectionData>;
  ProposedScheduleCorrectionInput: ProposedScheduleCorrectionInput;
  Query: ResolverTypeWrapper<{}>;
  RankedAccountVote: ResolverTypeWrapper<RankedAccountVote>;
  RegionVoteBucket: ResolverTypeWrapper<RegionVoteBucket>;
  ReplayActorRunResult: ResolverTypeWrapper<ReplayActorRunResult>;
  Report: ResolverTypeWrapper<Report>;
  ReportOutcome: ReportOutcome;
  ReportReason: ReportReason;
  ReportStatus: ReportStatus;
  ReportSystemErrorInput: ReportSystemErrorInput;
  ReprocessResult: ResolverTypeWrapper<ReprocessResult>;
  ResolveScheduleTimezoneResult: ResolverTypeWrapper<ResolveScheduleTimezoneResult>;
  ResolvedAIEventFilterResult: ResolverTypeWrapper<ResolvedAiEventFilterResult>;
  Schedule: ResolverTypeWrapper<Schedule>;
  ScheduleTimezoneStatus: ScheduleTimezoneStatus;
  ScraperActorRun: ResolverTypeWrapper<ScraperActorRun>;
  SetAccountDefaultLocationInput: SetAccountDefaultLocationInput;
  SocialMediaAccountProfile: ResolverTypeWrapper<SocialMediaAccountProfile>;
  SoftDeleteAction: SoftDeleteAction;
  String: ResolverTypeWrapper<Scalars['String']['output']>;
  SubscribeToAccountInput: SubscribeToAccountInput;
  SubscribeToAccountResult: ResolverTypeWrapper<SubscribeToAccountResult>;
  Subscription: ResolverTypeWrapper<{}>;
  ToggleCalendarAdditionResult: ResolverTypeWrapper<ToggleCalendarAdditionResult>;
  ToggleFavoriteResult: ResolverTypeWrapper<ToggleFavoriteResult>;
  TriggerAccountScrapeResult: ResolverTypeWrapper<TriggerAccountScrapeResult>;
  UnprocessedPayloadConnection: ResolverTypeWrapper<UnprocessedPayloadConnection>;
  UnprocessedPayloadEdge: ResolverTypeWrapper<UnprocessedPayloadEdge>;
  UnprocessedPayloadFilters: UnprocessedPayloadFilters;
  UnprocessedPayloadSource: UnprocessedPayloadSource;
  UnprocessedScraperPayload: ResolverTypeWrapper<UnprocessedScraperPayload>;
  UpdateUserLocationInput: UpdateUserLocationInput;
  UpdateUserSettingsInput: UpdateUserSettingsInput;
  UpdateWidgetInput: UpdateWidgetInput;
  UserLocation: ResolverTypeWrapper<UserLocation>;
  UserSettings: ResolverTypeWrapper<UserSettings>;
  ValidationError: ResolverTypeWrapper<ValidationError>;
  ValidationErrorDetail: ResolverTypeWrapper<ValidationErrorDetail>;
  Widget: ResolverTypeWrapper<Widget>;
  WidgetDisplayMode: WidgetDisplayMode;
  WidgetTheme: WidgetTheme;
}>;

/** Mapping between all available schema types and the resolvers parents */
export type ResolversParentTypes = ResolversObject<{
  AIEventFilter: AiEventFilter;
  AccountVote: AccountVote;
  ActorRunConnection: ActorRunConnection;
  ActorRunEdge: ActorRunEdge;
  ActorRunFilters: ActorRunFilters;
  AddressSuggestion: AddressSuggestion;
  ApiKey: ApiKey;
  Boolean: Scalars['Boolean']['output'];
  CastVoteInput: CastVoteInput;
  Coordinates: Coordinates;
  CoordinatesInput: CoordinatesInput;
  Correction: Correction;
  CreateApiKeyInput: CreateApiKeyInput;
  CreateUserLocationInput: CreateUserLocationInput;
  CreateWidgetInput: CreateWidgetInput;
  DateRangeFilter: DateRangeFilter;
  DateRangeFilterInput: DateRangeFilterInput;
  DateTime: Scalars['DateTime']['output'];
  DefaultLocationChangeRequest: DefaultLocationChangeRequest;
  EmbedDomain: EmbedDomain;
  Event: Event;
  EventConnection: EventConnection;
  EventFilter: EventFilter;
  EventFilterInput: EventFilterInput;
  EventQueryConditionInput: EventQueryConditionInput;
  ExtractEventDataFromUrlResult: ExtractEventDataFromUrlResult;
  ExtractionQuota: ExtractionQuota;
  Float: Scalars['Float']['output'];
  ID: Scalars['ID']['output'];
  Int: Scalars['Int']['output'];
  JSON: Scalars['JSON']['output'];
  LocationDetails: LocationDetails;
  LocationFilter: LocationFilter;
  LocationFilterInput: LocationFilterInput;
  Me: Me;
  Mutation: {};
  PageInfo: PageInfo;
  ParserVersion: ParserVersion;
  PayloadContext: PayloadContext;
  Post: Post;
  PostConnection: PostConnection;
  ProposedEventCorrectionData: ProposedEventCorrectionData;
  ProposedEventCorrectionInput: ProposedEventCorrectionInput;
  ProposedScheduleCorrectionData: ProposedScheduleCorrectionData;
  ProposedScheduleCorrectionInput: ProposedScheduleCorrectionInput;
  Query: {};
  RankedAccountVote: RankedAccountVote;
  RegionVoteBucket: RegionVoteBucket;
  ReplayActorRunResult: ReplayActorRunResult;
  Report: Report;
  ReportSystemErrorInput: ReportSystemErrorInput;
  ReprocessResult: ReprocessResult;
  ResolveScheduleTimezoneResult: ResolveScheduleTimezoneResult;
  ResolvedAIEventFilterResult: ResolvedAiEventFilterResult;
  Schedule: Schedule;
  ScraperActorRun: ScraperActorRun;
  SetAccountDefaultLocationInput: SetAccountDefaultLocationInput;
  SocialMediaAccountProfile: SocialMediaAccountProfile;
  String: Scalars['String']['output'];
  SubscribeToAccountInput: SubscribeToAccountInput;
  SubscribeToAccountResult: SubscribeToAccountResult;
  Subscription: {};
  ToggleCalendarAdditionResult: ToggleCalendarAdditionResult;
  ToggleFavoriteResult: ToggleFavoriteResult;
  TriggerAccountScrapeResult: TriggerAccountScrapeResult;
  UnprocessedPayloadConnection: UnprocessedPayloadConnection;
  UnprocessedPayloadEdge: UnprocessedPayloadEdge;
  UnprocessedPayloadFilters: UnprocessedPayloadFilters;
  UnprocessedScraperPayload: UnprocessedScraperPayload;
  UpdateUserLocationInput: UpdateUserLocationInput;
  UpdateUserSettingsInput: UpdateUserSettingsInput;
  UpdateWidgetInput: UpdateWidgetInput;
  UserLocation: UserLocation;
  UserSettings: UserSettings;
  ValidationError: ValidationError;
  ValidationErrorDetail: ValidationErrorDetail;
  Widget: Widget;
}>;

export type AiEventFilterResolvers<ContextType = GraphQLContext, ParentType extends ResolversParentTypes['AIEventFilter'] = ResolversParentTypes['AIEventFilter']> = ResolversObject<{
  createdAt?: Resolver<ResolversTypes['String'], ParentType, ContextType>;
  deletedAt?: Resolver<Maybe<ResolversTypes['String']>, ParentType, ContextType>;
  id?: Resolver<ResolversTypes['ID'], ParentType, ContextType>;
  ownerUserId?: Resolver<ResolversTypes['ID'], ParentType, ContextType>;
  prompt?: Resolver<ResolversTypes['String'], ParentType, ContextType>;
  resolvedFilter?: Resolver<ResolversTypes['EventFilter'], ParentType, ContextType>;
  updatedAt?: Resolver<ResolversTypes['String'], ParentType, ContextType>;
  __isTypeOf?: IsTypeOfResolverFn<ParentType, ContextType>;
}>;

export type AccountVoteResolvers<ContextType = GraphQLContext, ParentType extends ResolversParentTypes['AccountVote'] = ResolversParentTypes['AccountVote']> = ResolversObject<{
  accountId?: Resolver<ResolversTypes['ID'], ParentType, ContextType>;
  createdAt?: Resolver<ResolversTypes['String'], ParentType, ContextType>;
  deletedAt?: Resolver<Maybe<ResolversTypes['String']>, ParentType, ContextType>;
  id?: Resolver<ResolversTypes['ID'], ParentType, ContextType>;
  userId?: Resolver<ResolversTypes['ID'], ParentType, ContextType>;
  __isTypeOf?: IsTypeOfResolverFn<ParentType, ContextType>;
}>;

export type ActorRunConnectionResolvers<ContextType = GraphQLContext, ParentType extends ResolversParentTypes['ActorRunConnection'] = ResolversParentTypes['ActorRunConnection']> = ResolversObject<{
  edges?: Resolver<Array<ResolversTypes['ActorRunEdge']>, ParentType, ContextType>;
  pageInfo?: Resolver<ResolversTypes['PageInfo'], ParentType, ContextType>;
  totalCount?: Resolver<ResolversTypes['Int'], ParentType, ContextType>;
  __isTypeOf?: IsTypeOfResolverFn<ParentType, ContextType>;
}>;

export type ActorRunEdgeResolvers<ContextType = GraphQLContext, ParentType extends ResolversParentTypes['ActorRunEdge'] = ResolversParentTypes['ActorRunEdge']> = ResolversObject<{
  cursor?: Resolver<ResolversTypes['String'], ParentType, ContextType>;
  node?: Resolver<ResolversTypes['ScraperActorRun'], ParentType, ContextType>;
  __isTypeOf?: IsTypeOfResolverFn<ParentType, ContextType>;
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

export type DateRangeFilterResolvers<ContextType = GraphQLContext, ParentType extends ResolversParentTypes['DateRangeFilter'] = ResolversParentTypes['DateRangeFilter']> = ResolversObject<{
  anchor?: Resolver<ResolversTypes['DateAnchor'], ParentType, ContextType>;
  offsetAmount?: Resolver<ResolversTypes['Int'], ParentType, ContextType>;
  offsetUnit?: Resolver<ResolversTypes['DateOffsetUnit'], ParentType, ContextType>;
  __isTypeOf?: IsTypeOfResolverFn<ParentType, ContextType>;
}>;

export interface DateTimeScalarConfig extends GraphQLScalarTypeConfig<ResolversTypes['DateTime'], any> {
  name: 'DateTime';
}

export type DefaultLocationChangeRequestResolvers<ContextType = GraphQLContext, ParentType extends ResolversParentTypes['DefaultLocationChangeRequest'] = ResolversParentTypes['DefaultLocationChangeRequest']> = ResolversObject<{
  account?: Resolver<ResolversTypes['SocialMediaAccountProfile'], ParentType, ContextType>;
  accountId?: Resolver<ResolversTypes['ID'], ParentType, ContextType>;
  changeSource?: Resolver<ResolversTypes['DefaultLocationChangeSource'], ParentType, ContextType>;
  changedByUserId?: Resolver<Maybe<ResolversTypes['ID']>, ParentType, ContextType>;
  confidenceScore?: Resolver<Maybe<ResolversTypes['Float']>, ParentType, ContextType>;
  createdAt?: Resolver<ResolversTypes['String'], ParentType, ContextType>;
  id?: Resolver<ResolversTypes['ID'], ParentType, ContextType>;
  newLocation?: Resolver<ResolversTypes['LocationDetails'], ParentType, ContextType>;
  previousLocation?: Resolver<Maybe<ResolversTypes['LocationDetails']>, ParentType, ContextType>;
  reviewedAt?: Resolver<Maybe<ResolversTypes['String']>, ParentType, ContextType>;
  reviewedByModeratorId?: Resolver<Maybe<ResolversTypes['ID']>, ParentType, ContextType>;
  status?: Resolver<ResolversTypes['DefaultLocationChangeRequestStatus'], ParentType, ContextType>;
  __isTypeOf?: IsTypeOfResolverFn<ParentType, ContextType>;
}>;

export type EmbedDomainResolvers<ContextType = GraphQLContext, ParentType extends ResolversParentTypes['EmbedDomain'] = ResolversParentTypes['EmbedDomain']> = ResolversObject<{
  createdAt?: Resolver<ResolversTypes['String'], ParentType, ContextType>;
  deletedAt?: Resolver<Maybe<ResolversTypes['String']>, ParentType, ContextType>;
  id?: Resolver<ResolversTypes['ID'], ParentType, ContextType>;
  pattern?: Resolver<ResolversTypes['String'], ParentType, ContextType>;
  widgetId?: Resolver<ResolversTypes['ID'], ParentType, ContextType>;
  __isTypeOf?: IsTypeOfResolverFn<ParentType, ContextType>;
}>;

export type EventResolvers<ContextType = GraphQLContext, ParentType extends ResolversParentTypes['Event'] = ResolversParentTypes['Event']> = ResolversObject<{
  categories?: Resolver<Maybe<Array<ResolversTypes['EventCategory']>>, ParentType, ContextType>;
  contactInfo?: Resolver<Maybe<ResolversTypes['String']>, ParentType, ContextType>;
  createdAt?: Resolver<ResolversTypes['String'], ParentType, ContextType>;
  deletedAt?: Resolver<Maybe<ResolversTypes['String']>, ParentType, ContextType>;
  description?: Resolver<Maybe<ResolversTypes['String']>, ParentType, ContextType>;
  durableImageUrl?: Resolver<Maybe<ResolversTypes['String']>, ParentType, ContextType>;
  eventName?: Resolver<ResolversTypes['String'], ParentType, ContextType>;
  favoriteCount?: Resolver<ResolversTypes['Int'], ParentType, ContextType>;
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
  videoUrl?: Resolver<Maybe<ResolversTypes['String']>, ParentType, ContextType>;
  __isTypeOf?: IsTypeOfResolverFn<ParentType, ContextType>;
}>;

export type EventConnectionResolvers<ContextType = GraphQLContext, ParentType extends ResolversParentTypes['EventConnection'] = ResolversParentTypes['EventConnection']> = ResolversObject<{
  hasMore?: Resolver<ResolversTypes['Boolean'], ParentType, ContextType>;
  items?: Resolver<Array<ResolversTypes['Event']>, ParentType, ContextType>;
  totalCount?: Resolver<ResolversTypes['Int'], ParentType, ContextType>;
  __isTypeOf?: IsTypeOfResolverFn<ParentType, ContextType>;
}>;

export type EventFilterResolvers<ContextType = GraphQLContext, ParentType extends ResolversParentTypes['EventFilter'] = ResolversParentTypes['EventFilter']> = ResolversObject<{
  accountId?: Resolver<Maybe<ResolversTypes['ID']>, ParentType, ContextType>;
  categories?: Resolver<Maybe<Array<ResolversTypes['EventCategory']>>, ParentType, ContextType>;
  dateRange?: Resolver<Maybe<ResolversTypes['DateRangeFilter']>, ParentType, ContextType>;
  dayOfWeek?: Resolver<Maybe<ResolversTypes['DayOfWeek']>, ParentType, ContextType>;
  isFree?: Resolver<Maybe<ResolversTypes['Boolean']>, ParentType, ContextType>;
  keyword?: Resolver<Maybe<ResolversTypes['String']>, ParentType, ContextType>;
  location?: Resolver<Maybe<ResolversTypes['LocationFilter']>, ParentType, ContextType>;
  types?: Resolver<Maybe<Array<ResolversTypes['EventType']>>, ParentType, ContextType>;
  venueType?: Resolver<Maybe<ResolversTypes['String']>, ParentType, ContextType>;
  __isTypeOf?: IsTypeOfResolverFn<ParentType, ContextType>;
}>;

export type ExtractEventDataFromUrlResultResolvers<ContextType = GraphQLContext, ParentType extends ResolversParentTypes['ExtractEventDataFromUrlResult'] = ResolversParentTypes['ExtractEventDataFromUrlResult']> = ResolversObject<{
  data?: Resolver<Maybe<ResolversTypes['ProposedEventCorrectionData']>, ParentType, ContextType>;
  errorCode?: Resolver<Maybe<ResolversTypes['ExtractionErrorCode']>, ParentType, ContextType>;
  errorMessage?: Resolver<Maybe<ResolversTypes['String']>, ParentType, ContextType>;
  __isTypeOf?: IsTypeOfResolverFn<ParentType, ContextType>;
}>;

export type ExtractionQuotaResolvers<ContextType = GraphQLContext, ParentType extends ResolversParentTypes['ExtractionQuota'] = ResolversParentTypes['ExtractionQuota']> = ResolversObject<{
  limit?: Resolver<ResolversTypes['Int'], ParentType, ContextType>;
  remaining?: Resolver<ResolversTypes['Int'], ParentType, ContextType>;
  used?: Resolver<ResolversTypes['Int'], ParentType, ContextType>;
  __isTypeOf?: IsTypeOfResolverFn<ParentType, ContextType>;
}>;

export interface JsonScalarConfig extends GraphQLScalarTypeConfig<ResolversTypes['JSON'], any> {
  name: 'JSON';
}

export type LocationDetailsResolvers<ContextType = GraphQLContext, ParentType extends ResolversParentTypes['LocationDetails'] = ResolversParentTypes['LocationDetails']> = ResolversObject<{
  adminArea?: Resolver<Maybe<ResolversTypes['String']>, ParentType, ContextType>;
  city?: Resolver<Maybe<ResolversTypes['String']>, ParentType, ContextType>;
  coordinates?: Resolver<ResolversTypes['Coordinates'], ParentType, ContextType>;
  formattedAddress?: Resolver<Maybe<ResolversTypes['String']>, ParentType, ContextType>;
  placeId?: Resolver<Maybe<ResolversTypes['String']>, ParentType, ContextType>;
  placeName?: Resolver<Maybe<ResolversTypes['String']>, ParentType, ContextType>;
  provider?: Resolver<Maybe<ResolversTypes['GeolocationProvider']>, ParentType, ContextType>;
  province?: Resolver<Maybe<ResolversTypes['String']>, ParentType, ContextType>;
  timezone?: Resolver<Maybe<ResolversTypes['String']>, ParentType, ContextType>;
  venueType?: Resolver<Maybe<ResolversTypes['String']>, ParentType, ContextType>;
  __isTypeOf?: IsTypeOfResolverFn<ParentType, ContextType>;
}>;

export type LocationFilterResolvers<ContextType = GraphQLContext, ParentType extends ResolversParentTypes['LocationFilter'] = ResolversParentTypes['LocationFilter']> = ResolversObject<{
  adminArea?: Resolver<Maybe<ResolversTypes['String']>, ParentType, ContextType>;
  coordinates?: Resolver<Maybe<ResolversTypes['Coordinates']>, ParentType, ContextType>;
  radiusMeters?: Resolver<Maybe<ResolversTypes['Int']>, ParentType, ContextType>;
  __isTypeOf?: IsTypeOfResolverFn<ParentType, ContextType>;
}>;

export type MeResolvers<ContextType = GraphQLContext, ParentType extends ResolversParentTypes['Me'] = ResolversParentTypes['Me']> = ResolversObject<{
  email?: Resolver<ResolversTypes['String'], ParentType, ContextType>;
  id?: Resolver<ResolversTypes['ID'], ParentType, ContextType>;
  role?: Resolver<ResolversTypes['String'], ParentType, ContextType>;
  __isTypeOf?: IsTypeOfResolverFn<ParentType, ContextType>;
}>;

export type MutationResolvers<ContextType = GraphQLContext, ParentType extends ResolversParentTypes['Mutation'] = ResolversParentTypes['Mutation']> = ResolversObject<{
  castVote?: Resolver<ResolversTypes['AccountVote'], ParentType, ContextType, RequireFields<MutationCastVoteArgs, 'input'>>;
  createApiKey?: Resolver<ResolversTypes['ApiKey'], ParentType, ContextType, RequireFields<MutationCreateApiKeyArgs, 'input'>>;
  createUserLocation?: Resolver<ResolversTypes['UserLocation'], ParentType, ContextType, RequireFields<MutationCreateUserLocationArgs, 'input'>>;
  createWidget?: Resolver<ResolversTypes['Widget'], ParentType, ContextType, RequireFields<MutationCreateWidgetArgs, 'input'>>;
  deleteAIEventFilter?: Resolver<ResolversTypes['AIEventFilter'], ParentType, ContextType, RequireFields<MutationDeleteAiEventFilterArgs, 'action' | 'id'>>;
  deleteApiKey?: Resolver<ResolversTypes['ApiKey'], ParentType, ContextType, RequireFields<MutationDeleteApiKeyArgs, 'action' | 'id'>>;
  deleteEventPermanently?: Resolver<ResolversTypes['Boolean'], ParentType, ContextType, RequireFields<MutationDeleteEventPermanentlyArgs, 'id'>>;
  deleteUnprocessedPayload?: Resolver<ResolversTypes['Boolean'], ParentType, ContextType, RequireFields<MutationDeleteUnprocessedPayloadArgs, 'payloadId'>>;
  deleteUserLocation?: Resolver<ResolversTypes['UserLocation'], ParentType, ContextType, RequireFields<MutationDeleteUserLocationArgs, 'action' | 'id'>>;
  deleteWidget?: Resolver<ResolversTypes['Widget'], ParentType, ContextType, RequireFields<MutationDeleteWidgetArgs, 'action' | 'id'>>;
  deregisterEmbedDomain?: Resolver<ResolversTypes['EmbedDomain'], ParentType, ContextType, RequireFields<MutationDeregisterEmbedDomainArgs, 'action' | 'id'>>;
  editAccountDefaultLocation?: Resolver<ResolversTypes['SocialMediaAccountProfile'], ParentType, ContextType, RequireFields<MutationEditAccountDefaultLocationArgs, 'accountId' | 'input'>>;
  extractEventDataFromUrl?: Resolver<ResolversTypes['ExtractEventDataFromUrlResult'], ParentType, ContextType, RequireFields<MutationExtractEventDataFromUrlArgs, 'url'>>;
  ignoreSubsequentReports?: Resolver<ResolversTypes['Report'], ParentType, ContextType, RequireFields<MutationIgnoreSubsequentReportsArgs, 'reportId'>>;
  markSubscriptionViewed?: Resolver<ResolversTypes['Subscription'], ParentType, ContextType, RequireFields<MutationMarkSubscriptionViewedArgs, 'subscriptionId'>>;
  registerEmbedDomain?: Resolver<ResolversTypes['EmbedDomain'], ParentType, ContextType, RequireFields<MutationRegisterEmbedDomainArgs, 'pattern' | 'widgetId'>>;
  registerFcmToken?: Resolver<ResolversTypes['Boolean'], ParentType, ContextType, RequireFields<MutationRegisterFcmTokenArgs, 'token'>>;
  removeSubscription?: Resolver<ResolversTypes['Subscription'], ParentType, ContextType, RequireFields<MutationRemoveSubscriptionArgs, 'action' | 'id'>>;
  replayActorRun?: Resolver<ResolversTypes['ReplayActorRunResult'], ParentType, ContextType, RequireFields<MutationReplayActorRunArgs, 'actorRunId'>>;
  reportSystemError?: Resolver<ResolversTypes['Boolean'], ParentType, ContextType, RequireFields<MutationReportSystemErrorArgs, 'input'>>;
  reprocessPayload?: Resolver<ResolversTypes['ReprocessResult'], ParentType, ContextType, RequireFields<MutationReprocessPayloadArgs, 'parserVersion' | 'payloadId'>>;
  resolveDefaultLocationChange?: Resolver<ResolversTypes['DefaultLocationChangeRequest'], ParentType, ContextType, RequireFields<MutationResolveDefaultLocationChangeArgs, 'action' | 'id'>>;
  resolvePromptToEventFilter?: Resolver<ResolversTypes['ResolvedAIEventFilterResult'], ParentType, ContextType, RequireFields<MutationResolvePromptToEventFilterArgs, 'prompt'>>;
  resolveReport?: Resolver<ResolversTypes['Report'], ParentType, ContextType, RequireFields<MutationResolveReportArgs, 'id' | 'outcome'>>;
  resolveReportsForEvent?: Resolver<Array<ResolversTypes['Report']>, ParentType, ContextType, RequireFields<MutationResolveReportsForEventArgs, 'eventId'>>;
  resolveScheduleTimezone?: Resolver<ResolversTypes['ResolveScheduleTimezoneResult'], ParentType, ContextType, RequireFields<MutationResolveScheduleTimezoneArgs, 'scheduleId' | 'timezone'>>;
  restoreEvent?: Resolver<ResolversTypes['Event'], ParentType, ContextType, RequireFields<MutationRestoreEventArgs, 'action' | 'id'>>;
  saveAIEventFilter?: Resolver<ResolversTypes['AIEventFilter'], ParentType, ContextType, RequireFields<MutationSaveAiEventFilterArgs, 'prompt' | 'resolvedFilter'>>;
  selectPostsForExtraction?: Resolver<Array<ResolversTypes['Post']>, ParentType, ContextType, RequireFields<MutationSelectPostsForExtractionArgs, 'postIds'>>;
  setAccountDefaultLocation?: Resolver<ResolversTypes['SocialMediaAccountProfile'], ParentType, ContextType, RequireFields<MutationSetAccountDefaultLocationArgs, 'accountId' | 'input'>>;
  submitCorrection?: Resolver<ResolversTypes['Correction'], ParentType, ContextType, RequireFields<MutationSubmitCorrectionArgs, 'eventId' | 'proposedData' | 'source'>>;
  submitReport?: Resolver<ResolversTypes['Report'], ParentType, ContextType, RequireFields<MutationSubmitReportArgs, 'eventId' | 'reason'>>;
  subscribeToAccount?: Resolver<ResolversTypes['SubscribeToAccountResult'], ParentType, ContextType, RequireFields<MutationSubscribeToAccountArgs, 'input'>>;
  toggleCalendarAddition?: Resolver<ResolversTypes['ToggleCalendarAdditionResult'], ParentType, ContextType, RequireFields<MutationToggleCalendarAdditionArgs, 'eventId' | 'scheduleId'>>;
  toggleFavorite?: Resolver<ResolversTypes['ToggleFavoriteResult'], ParentType, ContextType, RequireFields<MutationToggleFavoriteArgs, 'eventId'>>;
  triggerAccountScrape?: Resolver<ResolversTypes['TriggerAccountScrapeResult'], ParentType, ContextType, RequireFields<MutationTriggerAccountScrapeArgs, 'accountId'>>;
  unregisterFcmToken?: Resolver<ResolversTypes['Boolean'], ParentType, ContextType, RequireFields<MutationUnregisterFcmTokenArgs, 'token'>>;
  updateUserLocation?: Resolver<ResolversTypes['UserLocation'], ParentType, ContextType, RequireFields<MutationUpdateUserLocationArgs, 'id' | 'input'>>;
  updateUserSettings?: Resolver<ResolversTypes['UserSettings'], ParentType, ContextType, RequireFields<MutationUpdateUserSettingsArgs, 'input'>>;
  updateUserTimezone?: Resolver<ResolversTypes['Boolean'], ParentType, ContextType, RequireFields<MutationUpdateUserTimezoneArgs, 'timezone'>>;
  updateWidget?: Resolver<ResolversTypes['Widget'], ParentType, ContextType, RequireFields<MutationUpdateWidgetArgs, 'id' | 'input'>>;
  withdrawVote?: Resolver<ResolversTypes['AccountVote'], ParentType, ContextType, RequireFields<MutationWithdrawVoteArgs, 'action' | 'id'>>;
}>;

export type PageInfoResolvers<ContextType = GraphQLContext, ParentType extends ResolversParentTypes['PageInfo'] = ResolversParentTypes['PageInfo']> = ResolversObject<{
  endCursor?: Resolver<Maybe<ResolversTypes['String']>, ParentType, ContextType>;
  hasNextPage?: Resolver<ResolversTypes['Boolean'], ParentType, ContextType>;
  __isTypeOf?: IsTypeOfResolverFn<ParentType, ContextType>;
}>;

export type ParserVersionResolvers<ContextType = GraphQLContext, ParentType extends ResolversParentTypes['ParserVersion'] = ResolversParentTypes['ParserVersion']> = ResolversObject<{
  createdAt?: Resolver<ResolversTypes['DateTime'], ParentType, ContextType>;
  deployedAt?: Resolver<ResolversTypes['DateTime'], ParentType, ContextType>;
  description?: Resolver<Maybe<ResolversTypes['String']>, ParentType, ContextType>;
  id?: Resolver<ResolversTypes['ID'], ParentType, ContextType>;
  isActive?: Resolver<ResolversTypes['Boolean'], ParentType, ContextType>;
  sourceFile?: Resolver<Maybe<ResolversTypes['String']>, ParentType, ContextType>;
  version?: Resolver<ResolversTypes['String'], ParentType, ContextType>;
  __isTypeOf?: IsTypeOfResolverFn<ParentType, ContextType>;
}>;

export type PayloadContextResolvers<ContextType = GraphQLContext, ParentType extends ResolversParentTypes['PayloadContext'] = ResolversParentTypes['PayloadContext']> = ResolversObject<{
  accountId?: Resolver<Maybe<ResolversTypes['String']>, ParentType, ContextType>;
  parserVersion?: Resolver<ResolversTypes['String'], ParentType, ContextType>;
  postUrl?: Resolver<Maybe<ResolversTypes['String']>, ParentType, ContextType>;
  scraperVendor?: Resolver<Maybe<ResolversTypes['String']>, ParentType, ContextType>;
  source?: Resolver<ResolversTypes['UnprocessedPayloadSource'], ParentType, ContextType>;
  timestamp?: Resolver<ResolversTypes['DateTime'], ParentType, ContextType>;
  __isTypeOf?: IsTypeOfResolverFn<ParentType, ContextType>;
}>;

export type PostResolvers<ContextType = GraphQLContext, ParentType extends ResolversParentTypes['Post'] = ResolversParentTypes['Post']> = ResolversObject<{
  accountId?: Resolver<ResolversTypes['ID'], ParentType, ContextType>;
  content?: Resolver<Maybe<ResolversTypes['String']>, ParentType, ContextType>;
  id?: Resolver<ResolversTypes['ID'], ParentType, ContextType>;
  imageUrl?: Resolver<Maybe<ResolversTypes['String']>, ParentType, ContextType>;
  isExtracted?: Resolver<ResolversTypes['Boolean'], ParentType, ContextType>;
  originalPostUrl?: Resolver<Maybe<ResolversTypes['String']>, ParentType, ContextType>;
  postUrl?: Resolver<ResolversTypes['String'], ParentType, ContextType>;
  publishedAt?: Resolver<ResolversTypes['String'], ParentType, ContextType>;
  __isTypeOf?: IsTypeOfResolverFn<ParentType, ContextType>;
}>;

export type PostConnectionResolvers<ContextType = GraphQLContext, ParentType extends ResolversParentTypes['PostConnection'] = ResolversParentTypes['PostConnection']> = ResolversObject<{
  hasMore?: Resolver<ResolversTypes['Boolean'], ParentType, ContextType>;
  items?: Resolver<Array<ResolversTypes['Post']>, ParentType, ContextType>;
  nextCursor?: Resolver<Maybe<ResolversTypes['String']>, ParentType, ContextType>;
  __isTypeOf?: IsTypeOfResolverFn<ParentType, ContextType>;
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
  embedDomainsForWidget?: Resolver<Array<ResolversTypes['EmbedDomain']>, ParentType, ContextType, RequireFields<QueryEmbedDomainsForWidgetArgs, 'widgetId'>>;
  event?: Resolver<Maybe<ResolversTypes['Event']>, ParentType, ContextType, RequireFields<QueryEventArgs, 'id'>>;
  eventBySlug?: Resolver<Maybe<ResolversTypes['Event']>, ParentType, ContextType, RequireFields<QueryEventBySlugArgs, 'slug'>>;
  events?: Resolver<ResolversTypes['EventConnection'], ParentType, ContextType, Partial<QueryEventsArgs>>;
  health?: Resolver<ResolversTypes['Boolean'], ParentType, ContextType>;
  isOriginAllowedForWidget?: Resolver<ResolversTypes['Boolean'], ParentType, ContextType, RequireFields<QueryIsOriginAllowedForWidgetArgs, 'origin' | 'widgetId'>>;
  me?: Resolver<ResolversTypes['Me'], ParentType, ContextType>;
  moderatorPendingItemCount?: Resolver<ResolversTypes['Int'], ParentType, ContextType>;
  myAIEventFilters?: Resolver<Array<ResolversTypes['AIEventFilter']>, ParentType, ContextType>;
  myApiKeys?: Resolver<Array<ResolversTypes['ApiKey']>, ParentType, ContextType>;
  myExtractionQuota?: Resolver<ResolversTypes['ExtractionQuota'], ParentType, ContextType>;
  myLocations?: Resolver<Array<ResolversTypes['UserLocation']>, ParentType, ContextType>;
  myReports?: Resolver<Array<ResolversTypes['Report']>, ParentType, ContextType>;
  mySettings?: Resolver<ResolversTypes['UserSettings'], ParentType, ContextType>;
  mySubscriptions?: Resolver<Array<ResolversTypes['Subscription']>, ParentType, ContextType>;
  myWidgets?: Resolver<Array<ResolversTypes['Widget']>, ParentType, ContextType>;
  parserVersions?: Resolver<Array<ResolversTypes['ParserVersion']>, ParentType, ContextType, Partial<QueryParserVersionsArgs>>;
  pendingDefaultLocationChanges?: Resolver<Array<ResolversTypes['DefaultLocationChangeRequest']>, ParentType, ContextType>;
  postsByAccount?: Resolver<ResolversTypes['PostConnection'], ParentType, ContextType, RequireFields<QueryPostsByAccountArgs, 'accountId'>>;
  previewLocation?: Resolver<ResolversTypes['LocationDetails'], ParentType, ContextType, Partial<QueryPreviewLocationArgs>>;
  queryActorRuns?: Resolver<ResolversTypes['ActorRunConnection'], ParentType, ContextType, Partial<QueryQueryActorRunsArgs>>;
  queryUnprocessedPayloads?: Resolver<ResolversTypes['UnprocessedPayloadConnection'], ParentType, ContextType, Partial<QueryQueryUnprocessedPayloadsArgs>>;
  rankedVoteAccounts?: Resolver<Array<ResolversTypes['RankedAccountVote']>, ParentType, ContextType, Partial<QueryRankedVoteAccountsArgs>>;
  reportedEvents?: Resolver<Array<ResolversTypes['Report']>, ParentType, ContextType, Partial<QueryReportedEventsArgs>>;
  socialMediaAccountProfileByAccountId?: Resolver<Maybe<ResolversTypes['SocialMediaAccountProfile']>, ParentType, ContextType, RequireFields<QuerySocialMediaAccountProfileByAccountIdArgs, 'accountId' | 'platform'>>;
  voteRegionBreakdown?: Resolver<Array<ResolversTypes['RegionVoteBucket']>, ParentType, ContextType, RequireFields<QueryVoteRegionBreakdownArgs, 'accountId'>>;
  votedAccountSuggestions?: Resolver<Array<ResolversTypes['RankedAccountVote']>, ParentType, ContextType, Partial<QueryVotedAccountSuggestionsArgs>>;
  widgetById?: Resolver<Maybe<ResolversTypes['Widget']>, ParentType, ContextType, RequireFields<QueryWidgetByIdArgs, 'id'>>;
}>;

export type RankedAccountVoteResolvers<ContextType = GraphQLContext, ParentType extends ResolversParentTypes['RankedAccountVote'] = ResolversParentTypes['RankedAccountVote']> = ResolversObject<{
  profile?: Resolver<ResolversTypes['SocialMediaAccountProfile'], ParentType, ContextType>;
  userVoteId?: Resolver<Maybe<ResolversTypes['ID']>, ParentType, ContextType>;
  voteCount?: Resolver<ResolversTypes['Int'], ParentType, ContextType>;
  __isTypeOf?: IsTypeOfResolverFn<ParentType, ContextType>;
}>;

export type RegionVoteBucketResolvers<ContextType = GraphQLContext, ParentType extends ResolversParentTypes['RegionVoteBucket'] = ResolversParentTypes['RegionVoteBucket']> = ResolversObject<{
  label?: Resolver<ResolversTypes['String'], ParentType, ContextType>;
  voterCount?: Resolver<ResolversTypes['Int'], ParentType, ContextType>;
  __isTypeOf?: IsTypeOfResolverFn<ParentType, ContextType>;
}>;

export type ReplayActorRunResultResolvers<ContextType = GraphQLContext, ParentType extends ResolversParentTypes['ReplayActorRunResult'] = ResolversParentTypes['ReplayActorRunResult']> = ResolversObject<{
  message?: Resolver<ResolversTypes['String'], ParentType, ContextType>;
  postsPersisted?: Resolver<ResolversTypes['Int'], ParentType, ContextType>;
  success?: Resolver<ResolversTypes['Boolean'], ParentType, ContextType>;
  __isTypeOf?: IsTypeOfResolverFn<ParentType, ContextType>;
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

export type ReprocessResultResolvers<ContextType = GraphQLContext, ParentType extends ResolversParentTypes['ReprocessResult'] = ResolversParentTypes['ReprocessResult']> = ResolversObject<{
  message?: Resolver<ResolversTypes['String'], ParentType, ContextType>;
  queueId?: Resolver<Maybe<ResolversTypes['String']>, ParentType, ContextType>;
  success?: Resolver<ResolversTypes['Boolean'], ParentType, ContextType>;
  __isTypeOf?: IsTypeOfResolverFn<ParentType, ContextType>;
}>;

export type ResolveScheduleTimezoneResultResolvers<ContextType = GraphQLContext, ParentType extends ResolversParentTypes['ResolveScheduleTimezoneResult'] = ResolversParentTypes['ResolveScheduleTimezoneResult']> = ResolversObject<{
  scheduleId?: Resolver<ResolversTypes['ID'], ParentType, ContextType>;
  timezone?: Resolver<ResolversTypes['String'], ParentType, ContextType>;
  timezoneStatus?: Resolver<ResolversTypes['ScheduleTimezoneStatus'], ParentType, ContextType>;
  __isTypeOf?: IsTypeOfResolverFn<ParentType, ContextType>;
}>;

export type ResolvedAiEventFilterResultResolvers<ContextType = GraphQLContext, ParentType extends ResolversParentTypes['ResolvedAIEventFilterResult'] = ResolversParentTypes['ResolvedAIEventFilterResult']> = ResolversObject<{
  caveats?: Resolver<Array<ResolversTypes['String']>, ParentType, ContextType>;
  resolvedFilter?: Resolver<ResolversTypes['EventFilter'], ParentType, ContextType>;
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
  timezoneStatus?: Resolver<Maybe<ResolversTypes['ScheduleTimezoneStatus']>, ParentType, ContextType>;
  title?: Resolver<Maybe<ResolversTypes['String']>, ParentType, ContextType>;
  updatedAt?: Resolver<ResolversTypes['String'], ParentType, ContextType>;
  __isTypeOf?: IsTypeOfResolverFn<ParentType, ContextType>;
}>;

export type ScraperActorRunResolvers<ContextType = GraphQLContext, ParentType extends ResolversParentTypes['ScraperActorRun'] = ResolversParentTypes['ScraperActorRun']> = ResolversObject<{
  completedAt?: Resolver<Maybe<ResolversTypes['DateTime']>, ParentType, ContextType>;
  createdAt?: Resolver<ResolversTypes['DateTime'], ParentType, ContextType>;
  errorMessage?: Resolver<Maybe<ResolversTypes['String']>, ParentType, ContextType>;
  id?: Resolver<ResolversTypes['ID'], ParentType, ContextType>;
  itemCount?: Resolver<Maybe<ResolversTypes['Int']>, ParentType, ContextType>;
  pendingJobId?: Resolver<Maybe<ResolversTypes['String']>, ParentType, ContextType>;
  profileId?: Resolver<ResolversTypes['ID'], ParentType, ContextType>;
  rawInput?: Resolver<ResolversTypes['JSON'], ParentType, ContextType>;
  rawOutput?: Resolver<Maybe<ResolversTypes['JSON']>, ParentType, ContextType>;
  runId?: Resolver<ResolversTypes['String'], ParentType, ContextType>;
  startedAt?: Resolver<ResolversTypes['DateTime'], ParentType, ContextType>;
  status?: Resolver<ResolversTypes['ActorRunStatus'], ParentType, ContextType>;
  triggerMode?: Resolver<ResolversTypes['ActorRunTriggerMode'], ParentType, ContextType>;
  updatedAt?: Resolver<ResolversTypes['DateTime'], ParentType, ContextType>;
  vendor?: Resolver<ResolversTypes['ActorRunVendor'], ParentType, ContextType>;
  __isTypeOf?: IsTypeOfResolverFn<ParentType, ContextType>;
}>;

export type SocialMediaAccountProfileResolvers<ContextType = GraphQLContext, ParentType extends ResolversParentTypes['SocialMediaAccountProfile'] = ResolversParentTypes['SocialMediaAccountProfile']> = ResolversObject<{
  accountId?: Resolver<ResolversTypes['String'], ParentType, ContextType>;
  accountType?: Resolver<Maybe<ResolversTypes['String']>, ParentType, ContextType>;
  accountTypeStatus?: Resolver<Maybe<ResolversTypes['String']>, ParentType, ContextType>;
  defaultLocation?: Resolver<Maybe<ResolversTypes['LocationDetails']>, ParentType, ContextType>;
  description?: Resolver<Maybe<ResolversTypes['String']>, ParentType, ContextType>;
  displayName?: Resolver<ResolversTypes['String'], ParentType, ContextType>;
  hasPendingDefaultLocationReview?: Resolver<ResolversTypes['Boolean'], ParentType, ContextType>;
  id?: Resolver<ResolversTypes['ID'], ParentType, ContextType>;
  isScrapeInProgress?: Resolver<ResolversTypes['Boolean'], ParentType, ContextType>;
  lastPostDate?: Resolver<Maybe<ResolversTypes['String']>, ParentType, ContextType>;
  lastScrapedAt?: Resolver<Maybe<ResolversTypes['String']>, ParentType, ContextType>;
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
  isInactive?: SubscriptionResolver<ResolversTypes['Boolean'], "isInactive", ParentType, ContextType>;
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

export type TriggerAccountScrapeResultResolvers<ContextType = GraphQLContext, ParentType extends ResolversParentTypes['TriggerAccountScrapeResult'] = ResolversParentTypes['TriggerAccountScrapeResult']> = ResolversObject<{
  isInitialScrape?: Resolver<ResolversTypes['Boolean'], ParentType, ContextType>;
  triggered?: Resolver<ResolversTypes['Boolean'], ParentType, ContextType>;
  __isTypeOf?: IsTypeOfResolverFn<ParentType, ContextType>;
}>;

export type UnprocessedPayloadConnectionResolvers<ContextType = GraphQLContext, ParentType extends ResolversParentTypes['UnprocessedPayloadConnection'] = ResolversParentTypes['UnprocessedPayloadConnection']> = ResolversObject<{
  edges?: Resolver<Array<ResolversTypes['UnprocessedPayloadEdge']>, ParentType, ContextType>;
  pageInfo?: Resolver<ResolversTypes['PageInfo'], ParentType, ContextType>;
  totalCount?: Resolver<ResolversTypes['Int'], ParentType, ContextType>;
  __isTypeOf?: IsTypeOfResolverFn<ParentType, ContextType>;
}>;

export type UnprocessedPayloadEdgeResolvers<ContextType = GraphQLContext, ParentType extends ResolversParentTypes['UnprocessedPayloadEdge'] = ResolversParentTypes['UnprocessedPayloadEdge']> = ResolversObject<{
  cursor?: Resolver<ResolversTypes['String'], ParentType, ContextType>;
  node?: Resolver<ResolversTypes['UnprocessedScraperPayload'], ParentType, ContextType>;
  __isTypeOf?: IsTypeOfResolverFn<ParentType, ContextType>;
}>;

export type UnprocessedScraperPayloadResolvers<ContextType = GraphQLContext, ParentType extends ResolversParentTypes['UnprocessedScraperPayload'] = ResolversParentTypes['UnprocessedScraperPayload']> = ResolversObject<{
  context?: Resolver<ResolversTypes['PayloadContext'], ParentType, ContextType>;
  createdAt?: Resolver<ResolversTypes['DateTime'], ParentType, ContextType>;
  deletedAt?: Resolver<Maybe<ResolversTypes['DateTime']>, ParentType, ContextType>;
  id?: Resolver<ResolversTypes['ID'], ParentType, ContextType>;
  rawPayload?: Resolver<ResolversTypes['JSON'], ParentType, ContextType>;
  validationError?: Resolver<Array<ResolversTypes['ValidationErrorDetail']>, ParentType, ContextType>;
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

export type ValidationErrorDetailResolvers<ContextType = GraphQLContext, ParentType extends ResolversParentTypes['ValidationErrorDetail'] = ResolversParentTypes['ValidationErrorDetail']> = ResolversObject<{
  instancePath?: Resolver<Maybe<ResolversTypes['String']>, ParentType, ContextType>;
  keyword?: Resolver<Maybe<ResolversTypes['String']>, ParentType, ContextType>;
  message?: Resolver<ResolversTypes['String'], ParentType, ContextType>;
  params?: Resolver<Maybe<ResolversTypes['JSON']>, ParentType, ContextType>;
  schemaPath?: Resolver<Maybe<ResolversTypes['String']>, ParentType, ContextType>;
  __isTypeOf?: IsTypeOfResolverFn<ParentType, ContextType>;
}>;

export type WidgetResolvers<ContextType = GraphQLContext, ParentType extends ResolversParentTypes['Widget'] = ResolversParentTypes['Widget']> = ResolversObject<{
  createdAt?: Resolver<ResolversTypes['String'], ParentType, ContextType>;
  deletedAt?: Resolver<Maybe<ResolversTypes['String']>, ParentType, ContextType>;
  displayMode?: Resolver<ResolversTypes['WidgetDisplayMode'], ParentType, ContextType>;
  filters?: Resolver<ResolversTypes['EventFilter'], ParentType, ContextType>;
  id?: Resolver<ResolversTypes['ID'], ParentType, ContextType>;
  ownerUserId?: Resolver<ResolversTypes['ID'], ParentType, ContextType>;
  theme?: Resolver<ResolversTypes['WidgetTheme'], ParentType, ContextType>;
  __isTypeOf?: IsTypeOfResolverFn<ParentType, ContextType>;
}>;

export type Resolvers<ContextType = GraphQLContext> = ResolversObject<{
  AIEventFilter?: AiEventFilterResolvers<ContextType>;
  AccountVote?: AccountVoteResolvers<ContextType>;
  ActorRunConnection?: ActorRunConnectionResolvers<ContextType>;
  ActorRunEdge?: ActorRunEdgeResolvers<ContextType>;
  AddressSuggestion?: AddressSuggestionResolvers<ContextType>;
  ApiKey?: ApiKeyResolvers<ContextType>;
  Coordinates?: CoordinatesResolvers<ContextType>;
  Correction?: CorrectionResolvers<ContextType>;
  DateRangeFilter?: DateRangeFilterResolvers<ContextType>;
  DateTime?: GraphQLScalarType;
  DefaultLocationChangeRequest?: DefaultLocationChangeRequestResolvers<ContextType>;
  EmbedDomain?: EmbedDomainResolvers<ContextType>;
  Event?: EventResolvers<ContextType>;
  EventConnection?: EventConnectionResolvers<ContextType>;
  EventFilter?: EventFilterResolvers<ContextType>;
  ExtractEventDataFromUrlResult?: ExtractEventDataFromUrlResultResolvers<ContextType>;
  ExtractionQuota?: ExtractionQuotaResolvers<ContextType>;
  JSON?: GraphQLScalarType;
  LocationDetails?: LocationDetailsResolvers<ContextType>;
  LocationFilter?: LocationFilterResolvers<ContextType>;
  Me?: MeResolvers<ContextType>;
  Mutation?: MutationResolvers<ContextType>;
  PageInfo?: PageInfoResolvers<ContextType>;
  ParserVersion?: ParserVersionResolvers<ContextType>;
  PayloadContext?: PayloadContextResolvers<ContextType>;
  Post?: PostResolvers<ContextType>;
  PostConnection?: PostConnectionResolvers<ContextType>;
  ProposedEventCorrectionData?: ProposedEventCorrectionDataResolvers<ContextType>;
  ProposedScheduleCorrectionData?: ProposedScheduleCorrectionDataResolvers<ContextType>;
  Query?: QueryResolvers<ContextType>;
  RankedAccountVote?: RankedAccountVoteResolvers<ContextType>;
  RegionVoteBucket?: RegionVoteBucketResolvers<ContextType>;
  ReplayActorRunResult?: ReplayActorRunResultResolvers<ContextType>;
  Report?: ReportResolvers<ContextType>;
  ReprocessResult?: ReprocessResultResolvers<ContextType>;
  ResolveScheduleTimezoneResult?: ResolveScheduleTimezoneResultResolvers<ContextType>;
  ResolvedAIEventFilterResult?: ResolvedAiEventFilterResultResolvers<ContextType>;
  Schedule?: ScheduleResolvers<ContextType>;
  ScraperActorRun?: ScraperActorRunResolvers<ContextType>;
  SocialMediaAccountProfile?: SocialMediaAccountProfileResolvers<ContextType>;
  SubscribeToAccountResult?: SubscribeToAccountResultResolvers<ContextType>;
  Subscription?: SubscriptionResolvers<ContextType>;
  ToggleCalendarAdditionResult?: ToggleCalendarAdditionResultResolvers<ContextType>;
  ToggleFavoriteResult?: ToggleFavoriteResultResolvers<ContextType>;
  TriggerAccountScrapeResult?: TriggerAccountScrapeResultResolvers<ContextType>;
  UnprocessedPayloadConnection?: UnprocessedPayloadConnectionResolvers<ContextType>;
  UnprocessedPayloadEdge?: UnprocessedPayloadEdgeResolvers<ContextType>;
  UnprocessedScraperPayload?: UnprocessedScraperPayloadResolvers<ContextType>;
  UserLocation?: UserLocationResolvers<ContextType>;
  UserSettings?: UserSettingsResolvers<ContextType>;
  ValidationError?: ValidationErrorResolvers<ContextType>;
  ValidationErrorDetail?: ValidationErrorDetailResolvers<ContextType>;
  Widget?: WidgetResolvers<ContextType>;
}>;

