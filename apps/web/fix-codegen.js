const fs = require('fs');
const file = 'src/generated/graphql.ts';
let content = fs.readFileSync(file, 'utf8');

// Replace duplicate Incremental
content = content.replace(/export type Incremental<T> = T \| \{ \[P in keyof T\]\?: P extends ' \$fragmentName' \| '__typename' \? T\[P\] : never \};\r?\n/g, '');
// Re-insert once
content = "export type Incremental<T> = T | { [P in keyof T]?: P extends ' $fragmentName' | '__typename' ? T[P] : never };\n" + content;

// Replace duplicate Exact
content = content.replace(/export type Exact<T extends \{ \[key: string\]: unknown \}> = \{ \[K in keyof T\]: T\[K\] \};\r?\n/g, '');
content = content.replace(/\/\*\* Internal type\. DO NOT USE DIRECTLY\. \*\/\r?\ntype Exact<T extends \{ \[key: string\]: unknown \}> = \{ \[K in keyof T\]: T\[K\] \};\r?\n/g, '');
content = "export type Exact<T extends { [key: string]: unknown }> = { [K in keyof T]: T[K] };\n" + content;

// Fix graphql-request/dist/types.dom import issue
content = content.replace(/import \{ RequestInit \} from 'graphql-request\/dist\/types\.dom';\r?\n/g, "type RequestInit = any;\n");

// Fix generic return type for fetcher
content = content.replace(/client\.request\(\{/g, 'client.request<TData>({');

// Fix duplicate enum/type declarations
content = content.replace(/export type EventCategory =[\s\S]*?;\r?\n/g, '');
content = content.replace(/export type EventType =[\s\S]*?;\r?\n/g, '');
content = content.replace(/export type GeolocationProvider =[\s\S]*?;\r?\n/g, '');
content = content.replace(/export type SoftDeleteAction =[\s\S]*?;\r?\n/g, '');
content = content.replace(/export type EventQueryConditionInput = \{[\s\S]*?\};\r?\n/g, '');
content = "export type EventQueryConditionInput = { conditions?: InputMaybe<Array<EventQueryConditionInput>>; field?: InputMaybe<Scalars['String']['input']>; operator?: InputMaybe<Scalars['String']['input']>; value?: InputMaybe<Scalars['JSON']['input']>; };\n" + content;

// Replace duplicate CreateUserLocationInput and UpdateUserLocationInput
content = content.replace(/export type CreateUserLocationInput = \{\r?\n\s+address\?\: string[\s\S]*?\};\r?\n/g, '');
content = content.replace(/export type UpdateUserLocationInput = \{\r?\n\s+address\?\: string[\s\S]*?\};\r?\n/g, '');

// Replace duplicate UpdateUserSettingsInput
content = content.replace(/export type UpdateUserSettingsInput = \{\r?\n\s+hidePastEventsAfterDays\?\: number[\s\S]*?\};\r?\n/g, '');

// Replace duplicate CreateApiKeyInput and SubscribeToAccountInput
content = content.replace(/export type CreateApiKeyInput = \{\r?\n\s+key\:\s+string[\s\S]*?\};\r?\n/g, '');
content = content.replace(/export type SubscribeToAccountInput = \{\r?\n\s+accountId\:\s+string[\s\S]*?\};\r?\n/g, '');

// Replace duplicate SetAccountDefaultLocationInput
content = content.replace(/export type SetAccountDefaultLocationInput = \{\r?\n\s+latitude\?\: number[\s\S]*?\};\r?\n/g, '');

// Replace duplicate ReportSystemErrorInput
content = content.replace(/export type ReportSystemErrorInput = \{\r?\n\s+context\?\: string[\s\S]*?\};\r?\n/g, '');

// Replace duplicate CorrectionSource and CorrectionStatus
content = content.replace(/export type CorrectionSource =[\s\S]*?;\r?\n/g, '');
content = content.replace(/export type CorrectionStatus =[\s\S]*?;\r?\n/g, '');
content = content.replace(/export type ExtractionErrorCode =[\s\S]*?;\r?\n/g, '');

// Replace duplicate ReportOutcome, ReportReason and ReportStatus
content = content.replace(/export type ReportOutcome =[\s\S]*?;\r?\n/g, '');
content = content.replace(/export type ReportReason =[\s\S]*?;\r?\n/g, '');
content = content.replace(/export type ReportStatus =[\s\S]*?;\r?\n/g, '');

// Replace duplicate DefaultLocationChangeAction and DefaultLocationChangeRequestStatus
content = content.replace(/export type DefaultLocationChangeAction =[\s\S]*?;\r?\n/g, '');
content = content.replace(/export type DefaultLocationChangeRequestStatus =[\s\S]*?;\r?\n/g, '');

// Replace duplicate ProposedEventCorrectionInput and ProposedScheduleCorrectionInput
content = content.replace(/export type ProposedEventCorrectionInput = \{\r?\n\s+categories\:\s+Array<EventCategory>;\r?\n\s+contactInfo\?\:\s+string[\s\S]*?\};\r?\n/g, '');
content = content.replace(/export type ProposedScheduleCorrectionInput = \{\r?\n\s+eventEndDate\?\:\s+string\s\|[\s\S]*?\};\r?\n/g, '');

fs.writeFileSync(file, content);
