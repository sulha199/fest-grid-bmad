const fs = require('fs');
const file = 'src/generated/graphql.ts';
let content = fs.readFileSync(file, 'utf8');

// Replace duplicate Incremental
content = content.replace(/export type Incremental<T> = T \| \{ \[P in keyof T\]\?: P extends ' \$fragmentName' \| '__typename' \? T\[P\] : never \};\r?\n/g, '');
// Re-insert once
content = "export type Incremental<T> = T | { [P in keyof T]?: P extends ' $fragmentName' | '__typename' ? T[P] : never };\n" + content;

// Replace duplicate Exact
content = content.replace(/export type Exact<T extends \{ \[key: string\]: unknown \}> = \{ \[K in keyof T\]: T\[K\] \};\r?\n/g, '');
content = "export type Exact<T extends { [key: string]: unknown }> = { [K in keyof T]: T[K] };\n" + content;

fs.writeFileSync(file, content);
