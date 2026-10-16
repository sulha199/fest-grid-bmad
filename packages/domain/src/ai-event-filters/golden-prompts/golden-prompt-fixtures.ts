import type { FilterNode } from '../filter-node.js';

/**
 * Story 9.7 AC1: the 8 required golden-prompt categories (`epics.md` AC1), covering AND/OR/NOT
 * boolean grammar, nesting, operator precedence, over-the-node-limit degradation, out-of-vocabulary
 * input, and off-topic prompts. `GOLDEN_PROMPT_FIXTURES`'s fixture-set-integrity meta-test
 * (`golden-prompt-fixtures.test.ts`) asserts every category is represented by at least 2 `en` and
 * 2 `id` fixtures.
 */
export const GOLDEN_PROMPT_CATEGORIES = [
  'AND',
  'OR',
  'NOT',
  'nesting',
  'precedence',
  'over-limit',
  'out-of-vocabulary',
  'off-topic',
] as const;
export type GoldenPromptCategory = (typeof GOLDEN_PROMPT_CATEGORIES)[number];

/**
 * One fixed golden-prompt fixture (Story 9.7 AC1). `prompt` is documentation/traceability for
 * this suite and the literal input the opt-in live-eval script (`compute-golden-prompt-drift.ts`
 * consumer, Task 4) sends to Gemini -- it is NOT consumed by this suite's own deterministic test
 * (`golden-prompt-fixtures.test.ts`), which feeds `geminiResponse` directly into
 * `transformGeminiResponseToFilterExpression` and never calls a model.
 */
export interface GoldenPromptFixture {
  /** Unique, stable, kebab-case id (e.g. `and-en-01`, `off-topic-id-03`). */
  id: string;
  lang: 'en' | 'id';
  category: GoldenPromptCategory;
  /** The human-readable prompt text this fixture represents. */
  prompt: string;
  /**
   * Hand-authored raw Gemini response payload for `prompt`, shaped exactly as
   * `buildFilterExtractionSystemInstruction`/`buildFilterExtractionResponseSchema`
   * (`apps/backend/src/lib/ai-event-filters/build-filter-extraction-request.ts`) specify:
   * `{ expression: <node>, caveats: string[] }` (tree shape) or `{ resolvedFilter: {...},
   * caveats: string[] }` (legacy flat shape -- `and-id-02` below exercises this branch).
   */
  geminiResponse: unknown;
  /**
   * The exact, byte-for-byte return value of
   * `transformGeminiResponseToFilterExpression(geminiResponse)` -- captured by actually running
   * the real function during authoring (never hand-derived; see this task's mandatory authoring
   * method in the story file).
   */
  expected: {
    expression: FilterNode;
    caveats: string[];
  };
}

// Cast at the array level (rather than annotating each literal with `GoldenPromptFixture`
// directly) -- `FilterLeaf`'s `type`/`category`/`dayOfWeek` fields are typed against the
// nominal `EventType`/`EventCategory`/`DayOfWeek` string enums, which TypeScript does not
// structurally accept plain string-literal array values against without a cast, even though
// every value here is byte-identical to its enum member's string value (confirmed by running
// each fixture's `geminiResponse` through the real, enum-typed `transformGeminiResponseToEventFilter`
// during authoring -- see the capture method in this file's module doc).
export const GOLDEN_PROMPT_FIXTURES = [
  {
    id: 'and-en-01',
    lang: 'en',
    category: 'AND',
    prompt: 'free jazz concerts in Sleman this weekend',
    geminiResponse: {
      expression: {
        op: 'AND',
        children: [
          { keyword: 'jazz' },
          { types: ['PERFORMANCE'] },
          { location: { adminArea: 'Sleman' } },
          { dateRange: { anchor: 'THIS_WEEK', offsetAmount: 0, offsetUnit: 'WEEK' }, dayOfWeek: ['SAT', 'SUN'] },
          { isFree: true },
        ],
      },
      caveats: [],
    },
    expected: {
      expression: {
        op: 'AND',
        children: [
          { field: 'keyword', value: 'jazz' },
          { field: 'type', value: ['PERFORMANCE'] },
          { field: 'locationAdminArea', value: 'Sleman' },
          { field: 'dateRange', value: { anchor: 'THIS_WEEK', offsetAmount: 0, offsetUnit: 'WEEK' } },
          { field: 'dayOfWeek', value: ['SAT', 'SUN'] },
          { field: 'isFree', value: true },
        ],
      },
      caveats: [],
    },
  },
  {
    id: 'or-id-01',
    lang: 'id',
    category: 'OR',
    prompt: 'konser jazz atau blues di Sleman akhir pekan ini',
    geminiResponse: {
      expression: { op: 'OR', children: [{ keyword: 'jazz' }, { keyword: 'blues' }] },
      caveats: [],
    },
    expected: {
      expression: {
        op: 'OR',
        children: [{ field: 'keyword', value: 'jazz' }, { field: 'keyword', value: 'blues' }],
      },
      caveats: [],
    },
  },
  {
    id: 'not-en-01',
    lang: 'en',
    category: 'NOT',
    prompt: 'music events this weekend, not workshops',
    geminiResponse: {
      expression: {
        op: 'AND',
        children: [
          { dateRange: { anchor: 'THIS_WEEK', offsetAmount: 0, offsetUnit: 'WEEK' }, dayOfWeek: ['SAT', 'SUN'] },
          { op: 'NOT', child: { types: ['WORKSHOP'] } },
        ],
      },
      caveats: [],
    },
    expected: {
      expression: {
        op: 'AND',
        children: [
          { field: 'dateRange', value: { anchor: 'THIS_WEEK', offsetAmount: 0, offsetUnit: 'WEEK' } },
          { field: 'dayOfWeek', value: ['SAT', 'SUN'] },
          { op: 'NOT', child: { field: 'type', value: ['WORKSHOP'] } },
        ],
      },
      caveats: [],
    },
  },
  {
    // Reuses the SPEC CAP-6 worked example verbatim (already proven correct by
    // transform-gemini-response-to-filter-expression.test.ts's first test case) -- the exact
    // same tree shape is claimed by buildFilterExtractionSystemInstruction's own Indonesian
    // few-shot example to apply "regardless of the prompt's language", so this fixture pairs
    // the Indonesian prompt text with that already-proven expected tree.
    id: 'nesting-id-01',
    lang: 'id',
    category: 'nesting',
    prompt: 'musik jazz atau blues di Sleman atau Bantul akhir pekan ini, bukan workshop',
    geminiResponse: {
      expression: {
        op: 'AND',
        children: [
          { op: 'OR', children: [{ keyword: 'jazz' }, { keyword: 'blues' }] },
          { op: 'OR', children: [{ location: { adminArea: 'Sleman' } }, { location: { adminArea: 'Bantul' } }] },
          { dateRange: { anchor: 'THIS_WEEK', offsetAmount: 0, offsetUnit: 'WEEK' }, dayOfWeek: ['SAT', 'SUN'] },
          { op: 'NOT', child: { types: ['WORKSHOP'] } },
        ],
      },
      caveats: [],
    },
    expected: {
      expression: {
        op: 'AND',
        children: [
          { op: 'OR', children: [{ field: 'keyword', value: 'jazz' }, { field: 'keyword', value: 'blues' }] },
          {
            op: 'OR',
            children: [
              { field: 'locationAdminArea', value: 'Sleman' },
              { field: 'locationAdminArea', value: 'Bantul' },
            ],
          },
          { field: 'dateRange', value: { anchor: 'THIS_WEEK', offsetAmount: 0, offsetUnit: 'WEEK' } },
          { field: 'dayOfWeek', value: ['SAT', 'SUN'] },
          { op: 'NOT', child: { field: 'type', value: ['WORKSHOP'] } },
        ],
      },
      caveats: [],
    },
  },
  {
    id: 'precedence-en-01',
    lang: 'en',
    category: 'precedence',
    prompt: 'jazz or blues in Sleman this weekend',
    geminiResponse: {
      expression: {
        op: 'AND',
        children: [
          { op: 'OR', children: [{ keyword: 'jazz' }, { keyword: 'blues' }] },
          { location: { adminArea: 'Sleman' } },
          { dateRange: { anchor: 'THIS_WEEK', offsetAmount: 0, offsetUnit: 'WEEK' }, dayOfWeek: ['SAT', 'SUN'] },
        ],
      },
      caveats: [],
    },
    expected: {
      expression: {
        op: 'AND',
        children: [
          { op: 'OR', children: [{ field: 'keyword', value: 'jazz' }, { field: 'keyword', value: 'blues' }] },
          { field: 'locationAdminArea', value: 'Sleman' },
          { field: 'dateRange', value: { anchor: 'THIS_WEEK', offsetAmount: 0, offsetUnit: 'WEEK' } },
          { field: 'dayOfWeek', value: ['SAT', 'SUN'] },
        ],
      },
      caveats: [],
    },
  },
  {
    // Deliberately synthetic, mirroring transform-gemini-response-to-filter-expression.test.ts's
    // own existing "trims a tree exceeding FILTER_NODE_MAX_NODES" precedent exactly (13 keyword
    // leaves under one OR -- real users don't type 13 alternatives, but this is the established,
    // already-proven way this repo exercises the trim algorithm). nodeCount starts at 1+13=14;
    // the trim loop removes the OR's LAST child twice (14 -> 13 -> 12), each time re-validating,
    // landing on exactly 11 surviving children (kw-0..kw-10) with nodeCount 1+11=12 (valid).
    id: 'over-limit-en-01',
    lang: 'en',
    category: 'over-limit',
    prompt: 'events about kw-0 or kw-1 or kw-2 or kw-3 or kw-4 or kw-5 or kw-6 or kw-7 or kw-8 or kw-9 or kw-10 or kw-11 or kw-12',
    geminiResponse: {
      expression: {
        op: 'OR',
        children: Array.from({ length: 13 }, (_, i) => ({ keyword: `kw-${i}` })),
      },
      caveats: [],
    },
    expected: {
      expression: {
        op: 'OR',
        children: Array.from({ length: 11 }, (_, i) => ({ field: 'keyword' as const, value: `kw-${i}` })),
      },
      caveats: ['Your prompt described more conditions than the filter supports, so some were dropped.'],
    },
  },
  {
    id: 'out-of-vocabulary-en-01',
    lang: 'en',
    category: 'out-of-vocabulary',
    prompt: 'jazz events under IDR 200K this weekend',
    geminiResponse: {
      expression: {
        op: 'AND',
        children: [
          { keyword: 'jazz' },
          { dateRange: { anchor: 'THIS_WEEK', offsetAmount: 0, offsetUnit: 'WEEK' }, dayOfWeek: ['SAT', 'SUN'] },
        ],
      },
      caveats: ['A specific price threshold ("under IDR 200K") is not supported yet, so it was ignored.'],
    },
    expected: {
      expression: {
        op: 'AND',
        children: [
          { field: 'keyword', value: 'jazz' },
          { field: 'dateRange', value: { anchor: 'THIS_WEEK', offsetAmount: 0, offsetUnit: 'WEEK' } },
          { field: 'dayOfWeek', value: ['SAT', 'SUN'] },
        ],
      },
      caveats: ['A specific price threshold ("under IDR 200K") is not supported yet, so it was ignored.'],
    },
  },
  {
    id: 'off-topic-id-01',
    lang: 'id',
    category: 'off-topic',
    prompt: 'siapa presiden Indonesia sekarang?',
    geminiResponse: {
      expression: { op: 'AND', children: [] },
      caveats: ['Prompt ini tidak terkait dengan pencarian acara, sehingga tidak ada filter yang diterapkan.'],
    },
    expected: {
      expression: { op: 'AND', children: [] },
      caveats: ['Prompt ini tidak terkait dengan pencarian acara, sehingga tidak ada filter yang diterapkan.'],
    },
  },

  // -- Additional fixtures below (Story 9.7 Task 1's remaining ≥32 entries, satisfying ≥40 total
  // / ≥15 en / ≥15 id / ≥2-per-category-per-language). Every `expected` value was captured by
  // actually running `transformGeminiResponseToFilterExpression` against the hand-authored
  // `geminiResponse` during authoring (the mandated capture-not-derive method), never hand-derived. --

  {
    "id": "and-en-02",
    "lang": "en",
    "category": "AND",
    "prompt": "food festivals in Yogyakarta over the next 2 weeks",
    "geminiResponse": {
      "expression": {
        "op": "AND",
        "children": [
          {
            "types": [
              "FESTIVAL"
            ]
          },
          {
            "categories": [
              "FOOD_AND_DRINK"
            ]
          },
          {
            "location": {
              "adminArea": "Yogyakarta"
            }
          },
          {
            "dateRange": {
              "anchor": "THIS_WEEK",
              "offsetAmount": 0,
              "offsetUnit": "WEEK",
              "spanAmount": 2,
              "spanUnit": "WEEK"
            }
          }
        ]
      },
      "caveats": []
    },
    "expected": {
      "expression": {
        "op": "AND",
        "children": [
          {
            "field": "type",
            "value": [
              "FESTIVAL"
            ]
          },
          {
            "field": "category",
            "value": [
              "FOOD_AND_DRINK"
            ]
          },
          {
            "field": "locationAdminArea",
            "value": "Yogyakarta"
          },
          {
            "field": "dateRange",
            "value": {
              "anchor": "THIS_WEEK",
              "offsetAmount": 0,
              "offsetUnit": "WEEK",
              "spanAmount": 2,
              "spanUnit": "WEEK"
            }
          }
        ]
      },
      "caveats": []
    }
  },
  {
    "id": "and-en-03",
    "lang": "en",
    "category": "AND",
    "prompt": "free workshops for families this weekend hosted by @dagadu_jogja",
    "geminiResponse": {
      "expression": {
        "op": "AND",
        "children": [
          {
            "types": [
              "WORKSHOP"
            ]
          },
          {
            "categories": [
              "FAMILY_AND_KIDS"
            ]
          },
          {
            "isFree": true
          },
          {
            "dateRange": {
              "anchor": "THIS_WEEK",
              "offsetAmount": 0,
              "offsetUnit": "WEEK"
            },
            "dayOfWeek": [
              "SAT",
              "SUN"
            ]
          },
          {
            "accountId": "@dagadu_jogja"
          }
        ]
      },
      "caveats": []
    },
    "expected": {
      "expression": {
        "op": "AND",
        "children": [
          {
            "field": "type",
            "value": [
              "WORKSHOP"
            ]
          },
          {
            "field": "category",
            "value": [
              "FAMILY_AND_KIDS"
            ]
          },
          {
            "field": "isFree",
            "value": true
          },
          {
            "field": "dateRange",
            "value": {
              "anchor": "THIS_WEEK",
              "offsetAmount": 0,
              "offsetUnit": "WEEK"
            }
          },
          {
            "field": "dayOfWeek",
            "value": [
              "SAT",
              "SUN"
            ]
          },
          {
            "field": "accountId",
            "value": "@dagadu_jogja"
          }
        ]
      },
      "caveats": []
    }
  },
  {
    "id": "and-id-01",
    "lang": "id",
    "category": "AND",
    "prompt": "pameran seni di Bantul minggu depan",
    "geminiResponse": {
      "expression": {
        "op": "AND",
        "children": [
          {
            "types": [
              "EXHIBITION"
            ]
          },
          {
            "location": {
              "adminArea": "Bantul"
            }
          },
          {
            "dateRange": {
              "anchor": "THIS_WEEK",
              "offsetAmount": 1,
              "offsetUnit": "WEEK"
            }
          }
        ]
      },
      "caveats": []
    },
    "expected": {
      "expression": {
        "op": "AND",
        "children": [
          {
            "field": "type",
            "value": [
              "EXHIBITION"
            ]
          },
          {
            "field": "locationAdminArea",
            "value": "Bantul"
          },
          {
            "field": "dateRange",
            "value": {
              "anchor": "THIS_WEEK",
              "offsetAmount": 1,
              "offsetUnit": "WEEK"
            }
          }
        ]
      },
      "caveats": []
    }
  },
  {
    "id": "and-id-02",
    "lang": "id",
    "category": "AND",
    "prompt": "acara olahraga gratis di kafe akhir pekan ini",
    "geminiResponse": {
      "resolvedFilter": {
        "categories": [
          "SPORTS_AND_FITNESS"
        ],
        "isFree": true,
        "venueType": "CAFE",
        "dateRange": {
          "anchor": "THIS_WEEK",
          "offsetAmount": 0,
          "offsetUnit": "WEEK"
        }
      },
      "caveats": []
    },
    "expected": {
      "expression": {
        "op": "AND",
        "children": [
          {
            "field": "category",
            "value": [
              "SPORTS_AND_FITNESS"
            ]
          },
          {
            "field": "dateRange",
            "value": {
              "anchor": "THIS_WEEK",
              "offsetAmount": 0,
              "offsetUnit": "WEEK"
            }
          },
          {
            "field": "venueType",
            "value": "CAFE"
          },
          {
            "field": "isFree",
            "value": true
          }
        ]
      },
      "caveats": []
    }
  },
  {
    "id": "or-en-01",
    "lang": "en",
    "category": "OR",
    "prompt": "events at a cafe or a mall this weekend",
    "geminiResponse": {
      "expression": {
        "op": "OR",
        "children": [
          {
            "venueType": "CAFE"
          },
          {
            "venueType": "MALL"
          }
        ]
      },
      "caveats": []
    },
    "expected": {
      "expression": {
        "op": "OR",
        "children": [
          {
            "field": "venueType",
            "value": "CAFE"
          },
          {
            "field": "venueType",
            "value": "MALL"
          }
        ]
      },
      "caveats": []
    }
  },
  {
    "id": "or-en-02",
    "lang": "en",
    "category": "OR",
    "prompt": "food or craft markets happening now",
    "geminiResponse": {
      "expression": {
        "op": "OR",
        "children": [
          {
            "types": [
              "MARKET"
            ],
            "categories": [
              "FOOD_AND_DRINK"
            ]
          },
          {
            "types": [
              "MARKET"
            ],
            "categories": [
              "HOBBIES_AND_INTERESTS"
            ]
          }
        ]
      },
      "caveats": []
    },
    "expected": {
      "expression": {
        "op": "OR",
        "children": [
          {
            "field": "type",
            "value": [
              "MARKET"
            ]
          },
          {
            "field": "category",
            "value": [
              "FOOD_AND_DRINK"
            ]
          },
          {
            "field": "category",
            "value": [
              "HOBBIES_AND_INTERESTS"
            ]
          }
        ]
      },
      "caveats": []
    }
  },
  {
    "id": "or-id-02",
    "lang": "id",
    "category": "OR",
    "prompt": "konser atau pameran gratis bulan ini",
    "geminiResponse": {
      "expression": {
        "op": "OR",
        "children": [
          {
            "types": [
              "PERFORMANCE"
            ],
            "isFree": true
          },
          {
            "types": [
              "EXHIBITION"
            ],
            "isFree": true
          }
        ]
      },
      "caveats": []
    },
    "expected": {
      "expression": {
        "op": "OR",
        "children": [
          {
            "field": "type",
            "value": [
              "PERFORMANCE"
            ]
          },
          {
            "field": "isFree",
            "value": true
          },
          {
            "field": "type",
            "value": [
              "EXHIBITION"
            ]
          }
        ]
      },
      "caveats": []
    }
  },
  {
    "id": "or-id-03",
    "lang": "id",
    "category": "OR",
    "prompt": "acara di Sleman atau dalam radius 5km dari pusat kota",
    "geminiResponse": {
      "expression": {
        "op": "OR",
        "children": [
          {
            "location": {
              "adminArea": "Sleman"
            }
          },
          {
            "location": {
              "coordinates": {
                "lat": -7.797,
                "lng": 110.37
              },
              "radiusMeters": 5000
            }
          }
        ]
      },
      "caveats": []
    },
    "expected": {
      "expression": {
        "op": "OR",
        "children": [
          {
            "field": "locationAdminArea",
            "value": "Sleman"
          },
          {
            "field": "locationProximity",
            "value": {
              "coordinates": {
                "lat": -7.797,
                "lng": 110.37
              },
              "radiusMeters": 5000
            }
          }
        ]
      },
      "caveats": []
    }
  },
  {
    "id": "not-en-02",
    "lang": "en",
    "category": "NOT",
    "prompt": "tech meetups this month, not seminars",
    "geminiResponse": {
      "expression": {
        "op": "AND",
        "children": [
          {
            "categories": [
              "TECHNOLOGY"
            ]
          },
          {
            "dateRange": {
              "anchor": "THIS_MONTH",
              "offsetAmount": 0,
              "offsetUnit": "MONTH"
            }
          },
          {
            "op": "NOT",
            "child": {
              "types": [
                "SEMINAR"
              ]
            }
          }
        ]
      },
      "caveats": []
    },
    "expected": {
      "expression": {
        "op": "AND",
        "children": [
          {
            "field": "category",
            "value": [
              "TECHNOLOGY"
            ]
          },
          {
            "field": "dateRange",
            "value": {
              "anchor": "THIS_MONTH",
              "offsetAmount": 0,
              "offsetUnit": "MONTH"
            }
          },
          {
            "op": "NOT",
            "child": {
              "field": "type",
              "value": [
                "SEMINAR"
              ]
            }
          }
        ]
      },
      "caveats": []
    }
  },
  {
    "id": "not-en-03",
    "lang": "en",
    "category": "NOT",
    "prompt": "free events in Sleman, not at a mall",
    "geminiResponse": {
      "expression": {
        "op": "AND",
        "children": [
          {
            "isFree": true
          },
          {
            "location": {
              "adminArea": "Sleman"
            }
          },
          {
            "op": "NOT",
            "child": {
              "venueType": "MALL"
            }
          }
        ]
      },
      "caveats": []
    },
    "expected": {
      "expression": {
        "op": "AND",
        "children": [
          {
            "field": "isFree",
            "value": true
          },
          {
            "field": "locationAdminArea",
            "value": "Sleman"
          },
          {
            "op": "NOT",
            "child": {
              "field": "venueType",
              "value": "MALL"
            }
          }
        ]
      },
      "caveats": []
    }
  },
  {
    "id": "not-id-01",
    "lang": "id",
    "category": "NOT",
    "prompt": "acara musik akhir pekan ini, bukan festival",
    "geminiResponse": {
      "expression": {
        "op": "AND",
        "children": [
          {
            "categories": [
              "MUSIC"
            ]
          },
          {
            "dateRange": {
              "anchor": "THIS_WEEK",
              "offsetAmount": 0,
              "offsetUnit": "WEEK"
            },
            "dayOfWeek": [
              "SAT",
              "SUN"
            ]
          },
          {
            "op": "NOT",
            "child": {
              "types": [
                "FESTIVAL"
              ]
            }
          }
        ]
      },
      "caveats": []
    },
    "expected": {
      "expression": {
        "op": "AND",
        "children": [
          {
            "field": "category",
            "value": [
              "MUSIC"
            ]
          },
          {
            "field": "dateRange",
            "value": {
              "anchor": "THIS_WEEK",
              "offsetAmount": 0,
              "offsetUnit": "WEEK"
            }
          },
          {
            "field": "dayOfWeek",
            "value": [
              "SAT",
              "SUN"
            ]
          },
          {
            "op": "NOT",
            "child": {
              "field": "type",
              "value": [
                "FESTIVAL"
              ]
            }
          }
        ]
      },
      "caveats": []
    }
  },
  {
    "id": "not-id-02",
    "lang": "id",
    "category": "NOT",
    "prompt": "acara gratis bulan ini, bukan seminar atau workshop",
    "geminiResponse": {
      "expression": {
        "op": "AND",
        "children": [
          {
            "isFree": true
          },
          {
            "dateRange": {
              "anchor": "THIS_MONTH",
              "offsetAmount": 0,
              "offsetUnit": "MONTH"
            }
          },
          {
            "op": "NOT",
            "child": {
              "types": [
                "SEMINAR",
                "WORKSHOP"
              ]
            }
          }
        ]
      },
      "caveats": []
    },
    "expected": {
      "expression": {
        "op": "AND",
        "children": [
          {
            "field": "isFree",
            "value": true
          },
          {
            "field": "dateRange",
            "value": {
              "anchor": "THIS_MONTH",
              "offsetAmount": 0,
              "offsetUnit": "MONTH"
            }
          },
          {
            "op": "NOT",
            "child": {
              "field": "type",
              "value": [
                "SEMINAR",
                "WORKSHOP"
              ]
            }
          }
        ]
      },
      "caveats": []
    }
  },
  {
    "id": "nesting-en-01",
    "lang": "en",
    "category": "nesting",
    "prompt": "jazz or blues in a cafe this weekend, not workshops",
    "geminiResponse": {
      "expression": {
        "op": "AND",
        "children": [
          {
            "op": "OR",
            "children": [
              {
                "keyword": "jazz"
              },
              {
                "keyword": "blues"
              }
            ]
          },
          {
            "venueType": "CAFE"
          },
          {
            "dateRange": {
              "anchor": "THIS_WEEK",
              "offsetAmount": 0,
              "offsetUnit": "WEEK"
            },
            "dayOfWeek": [
              "SAT",
              "SUN"
            ]
          },
          {
            "op": "NOT",
            "child": {
              "types": [
                "WORKSHOP"
              ]
            }
          }
        ]
      },
      "caveats": []
    },
    "expected": {
      "expression": {
        "op": "AND",
        "children": [
          {
            "op": "OR",
            "children": [
              {
                "field": "keyword",
                "value": "jazz"
              },
              {
                "field": "keyword",
                "value": "blues"
              }
            ]
          },
          {
            "field": "venueType",
            "value": "CAFE"
          },
          {
            "field": "dateRange",
            "value": {
              "anchor": "THIS_WEEK",
              "offsetAmount": 0,
              "offsetUnit": "WEEK"
            }
          },
          {
            "field": "dayOfWeek",
            "value": [
              "SAT",
              "SUN"
            ]
          },
          {
            "op": "NOT",
            "child": {
              "field": "type",
              "value": [
                "WORKSHOP"
              ]
            }
          }
        ]
      },
      "caveats": []
    }
  },
  {
    "id": "nesting-en-02",
    "lang": "en",
    "category": "nesting",
    "prompt": "tech or business events in Sleman or Bantul on weekdays next month, not seminars",
    "geminiResponse": {
      "expression": {
        "op": "AND",
        "children": [
          {
            "op": "OR",
            "children": [
              {
                "categories": [
                  "TECHNOLOGY"
                ]
              },
              {
                "categories": [
                  "BUSINESS_AND_NETWORKING"
                ]
              }
            ]
          },
          {
            "op": "OR",
            "children": [
              {
                "location": {
                  "adminArea": "Sleman"
                }
              },
              {
                "location": {
                  "adminArea": "Bantul"
                }
              }
            ]
          },
          {
            "dateRange": {
              "anchor": "THIS_MONTH",
              "offsetAmount": 1,
              "offsetUnit": "MONTH"
            },
            "dayOfWeek": [
              "MON",
              "TUE",
              "WED",
              "THU",
              "FRI"
            ]
          },
          {
            "op": "NOT",
            "child": {
              "types": [
                "SEMINAR"
              ]
            }
          }
        ]
      },
      "caveats": []
    },
    "expected": {
      "expression": {
        "op": "AND",
        "children": [
          {
            "op": "OR",
            "children": [
              {
                "field": "category",
                "value": [
                  "TECHNOLOGY"
                ]
              },
              {
                "field": "category",
                "value": [
                  "BUSINESS_AND_NETWORKING"
                ]
              }
            ]
          },
          {
            "op": "OR",
            "children": [
              {
                "field": "locationAdminArea",
                "value": "Sleman"
              },
              {
                "field": "locationAdminArea",
                "value": "Bantul"
              }
            ]
          },
          {
            "field": "dateRange",
            "value": {
              "anchor": "THIS_MONTH",
              "offsetAmount": 1,
              "offsetUnit": "MONTH"
            }
          },
          {
            "field": "dayOfWeek",
            "value": [
              "MON",
              "TUE",
              "WED",
              "THU",
              "FRI"
            ]
          },
          {
            "op": "NOT",
            "child": {
              "field": "type",
              "value": [
                "SEMINAR"
              ]
            }
          }
        ]
      },
      "caveats": []
    }
  },
  {
    "id": "nesting-id-02",
    "lang": "id",
    "category": "nesting",
    "prompt": "musik atau olahraga gratis di kafe atau mal akhir pekan ini, bukan seminar",
    "geminiResponse": {
      "expression": {
        "op": "AND",
        "children": [
          {
            "op": "OR",
            "children": [
              {
                "categories": [
                  "MUSIC"
                ]
              },
              {
                "categories": [
                  "SPORTS_AND_FITNESS"
                ]
              }
            ]
          },
          {
            "isFree": true
          },
          {
            "op": "OR",
            "children": [
              {
                "venueType": "CAFE"
              },
              {
                "venueType": "MALL"
              }
            ]
          },
          {
            "dateRange": {
              "anchor": "THIS_WEEK",
              "offsetAmount": 0,
              "offsetUnit": "WEEK"
            },
            "dayOfWeek": [
              "SAT",
              "SUN"
            ]
          },
          {
            "op": "NOT",
            "child": {
              "types": [
                "SEMINAR"
              ]
            }
          }
        ]
      },
      "caveats": []
    },
    "expected": {
      "expression": {
        "op": "AND",
        "children": [
          {
            "op": "OR",
            "children": [
              {
                "field": "category",
                "value": [
                  "MUSIC"
                ]
              },
              {
                "field": "category",
                "value": [
                  "SPORTS_AND_FITNESS"
                ]
              }
            ]
          },
          {
            "field": "isFree",
            "value": true
          },
          {
            "op": "OR",
            "children": [
              {
                "field": "venueType",
                "value": "CAFE"
              },
              {
                "field": "venueType",
                "value": "MALL"
              }
            ]
          },
          {
            "field": "dateRange",
            "value": {
              "anchor": "THIS_WEEK",
              "offsetAmount": 0,
              "offsetUnit": "WEEK"
            }
          },
          {
            "field": "dayOfWeek",
            "value": [
              "SAT",
              "SUN"
            ]
          },
          {
            "op": "NOT",
            "child": {
              "field": "type",
              "value": [
                "SEMINAR"
              ]
            }
          }
        ]
      },
      "caveats": []
    }
  },
  {
    "id": "nesting-id-03",
    "lang": "id",
    "category": "nesting",
    "prompt": "acara teknologi atau bisnis di Sleman atau Bantul bulan depan, bukan workshop",
    "geminiResponse": {
      "expression": {
        "op": "AND",
        "children": [
          {
            "op": "OR",
            "children": [
              {
                "categories": [
                  "TECHNOLOGY"
                ]
              },
              {
                "categories": [
                  "BUSINESS_AND_NETWORKING"
                ]
              }
            ]
          },
          {
            "op": "OR",
            "children": [
              {
                "location": {
                  "adminArea": "Sleman"
                }
              },
              {
                "location": {
                  "adminArea": "Bantul"
                }
              }
            ]
          },
          {
            "dateRange": {
              "anchor": "THIS_MONTH",
              "offsetAmount": 1,
              "offsetUnit": "MONTH"
            }
          },
          {
            "op": "NOT",
            "child": {
              "types": [
                "WORKSHOP"
              ]
            }
          }
        ]
      },
      "caveats": []
    },
    "expected": {
      "expression": {
        "op": "AND",
        "children": [
          {
            "op": "OR",
            "children": [
              {
                "field": "category",
                "value": [
                  "TECHNOLOGY"
                ]
              },
              {
                "field": "category",
                "value": [
                  "BUSINESS_AND_NETWORKING"
                ]
              }
            ]
          },
          {
            "op": "OR",
            "children": [
              {
                "field": "locationAdminArea",
                "value": "Sleman"
              },
              {
                "field": "locationAdminArea",
                "value": "Bantul"
              }
            ]
          },
          {
            "field": "dateRange",
            "value": {
              "anchor": "THIS_MONTH",
              "offsetAmount": 1,
              "offsetUnit": "MONTH"
            }
          },
          {
            "op": "NOT",
            "child": {
              "field": "type",
              "value": [
                "WORKSHOP"
              ]
            }
          }
        ]
      },
      "caveats": []
    }
  },
  {
    "id": "precedence-en-02",
    "lang": "en",
    "category": "precedence",
    "prompt": "concerts or exhibitions in Bantul this month",
    "geminiResponse": {
      "expression": {
        "op": "AND",
        "children": [
          {
            "op": "OR",
            "children": [
              {
                "types": [
                  "PERFORMANCE"
                ]
              },
              {
                "types": [
                  "EXHIBITION"
                ]
              }
            ]
          },
          {
            "location": {
              "adminArea": "Bantul"
            }
          },
          {
            "dateRange": {
              "anchor": "THIS_MONTH",
              "offsetAmount": 0,
              "offsetUnit": "MONTH"
            }
          }
        ]
      },
      "caveats": []
    },
    "expected": {
      "expression": {
        "op": "AND",
        "children": [
          {
            "op": "OR",
            "children": [
              {
                "field": "type",
                "value": [
                  "PERFORMANCE"
                ]
              },
              {
                "field": "type",
                "value": [
                  "EXHIBITION"
                ]
              }
            ]
          },
          {
            "field": "locationAdminArea",
            "value": "Bantul"
          },
          {
            "field": "dateRange",
            "value": {
              "anchor": "THIS_MONTH",
              "offsetAmount": 0,
              "offsetUnit": "MONTH"
            }
          }
        ]
      },
      "caveats": []
    }
  },
  {
    "id": "precedence-en-03",
    "lang": "en",
    "category": "precedence",
    "prompt": "free or family-friendly events happening now",
    "geminiResponse": {
      "expression": {
        "op": "AND",
        "children": [
          {
            "op": "OR",
            "children": [
              {
                "isFree": true
              },
              {
                "categories": [
                  "FAMILY_AND_KIDS"
                ]
              }
            ]
          },
          {
            "temporalFilter": "TODAY"
          }
        ]
      },
      "caveats": []
    },
    "expected": {
      "expression": {
        "op": "AND",
        "children": [
          {
            "op": "OR",
            "children": [
              {
                "field": "isFree",
                "value": true
              },
              {
                "field": "category",
                "value": [
                  "FAMILY_AND_KIDS"
                ]
              }
            ]
          },
          {
            "field": "temporalFilter",
            "value": "TODAY"
          }
        ]
      },
      "caveats": []
    }
  },
  {
    "id": "precedence-id-01",
    "lang": "id",
    "category": "precedence",
    "prompt": "pameran atau pasar di Sleman bulan ini",
    "geminiResponse": {
      "expression": {
        "op": "AND",
        "children": [
          {
            "op": "OR",
            "children": [
              {
                "types": [
                  "EXHIBITION"
                ]
              },
              {
                "types": [
                  "MARKET"
                ]
              }
            ]
          },
          {
            "location": {
              "adminArea": "Sleman"
            }
          },
          {
            "dateRange": {
              "anchor": "THIS_MONTH",
              "offsetAmount": 0,
              "offsetUnit": "MONTH"
            }
          }
        ]
      },
      "caveats": []
    },
    "expected": {
      "expression": {
        "op": "AND",
        "children": [
          {
            "op": "OR",
            "children": [
              {
                "field": "type",
                "value": [
                  "EXHIBITION"
                ]
              },
              {
                "field": "type",
                "value": [
                  "MARKET"
                ]
              }
            ]
          },
          {
            "field": "locationAdminArea",
            "value": "Sleman"
          },
          {
            "field": "dateRange",
            "value": {
              "anchor": "THIS_MONTH",
              "offsetAmount": 0,
              "offsetUnit": "MONTH"
            }
          }
        ]
      },
      "caveats": []
    }
  },
  {
    "id": "precedence-id-02",
    "lang": "id",
    "category": "precedence",
    "prompt": "acara teknologi atau bisnis gratis minggu ini",
    "geminiResponse": {
      "expression": {
        "op": "AND",
        "children": [
          {
            "op": "OR",
            "children": [
              {
                "categories": [
                  "TECHNOLOGY"
                ]
              },
              {
                "categories": [
                  "BUSINESS_AND_NETWORKING"
                ]
              }
            ]
          },
          {
            "isFree": true
          },
          {
            "dateRange": {
              "anchor": "THIS_WEEK",
              "offsetAmount": 0,
              "offsetUnit": "WEEK"
            }
          }
        ]
      },
      "caveats": []
    },
    "expected": {
      "expression": {
        "op": "AND",
        "children": [
          {
            "op": "OR",
            "children": [
              {
                "field": "category",
                "value": [
                  "TECHNOLOGY"
                ]
              },
              {
                "field": "category",
                "value": [
                  "BUSINESS_AND_NETWORKING"
                ]
              }
            ]
          },
          {
            "field": "isFree",
            "value": true
          },
          {
            "field": "dateRange",
            "value": {
              "anchor": "THIS_WEEK",
              "offsetAmount": 0,
              "offsetUnit": "WEEK"
            }
          }
        ]
      },
      "caveats": []
    }
  },
  {
    "id": "over-limit-en-02",
    "lang": "en",
    "category": "over-limit",
    "prompt": "events about artist-0 or artist-1 or artist-2 or artist-3 or artist-4 or artist-5 or artist-6 or artist-7 or artist-8 or artist-9 or artist-10 or artist-11 or artist-12",
    "geminiResponse": {
      "expression": {
        "op": "OR",
        "children": [
          {
            "keyword": "artist-0"
          },
          {
            "keyword": "artist-1"
          },
          {
            "keyword": "artist-2"
          },
          {
            "keyword": "artist-3"
          },
          {
            "keyword": "artist-4"
          },
          {
            "keyword": "artist-5"
          },
          {
            "keyword": "artist-6"
          },
          {
            "keyword": "artist-7"
          },
          {
            "keyword": "artist-8"
          },
          {
            "keyword": "artist-9"
          },
          {
            "keyword": "artist-10"
          },
          {
            "keyword": "artist-11"
          },
          {
            "keyword": "artist-12"
          }
        ]
      },
      "caveats": []
    },
    "expected": {
      "expression": {
        "op": "OR",
        "children": [
          {
            "field": "keyword",
            "value": "artist-0"
          },
          {
            "field": "keyword",
            "value": "artist-1"
          },
          {
            "field": "keyword",
            "value": "artist-2"
          },
          {
            "field": "keyword",
            "value": "artist-3"
          },
          {
            "field": "keyword",
            "value": "artist-4"
          },
          {
            "field": "keyword",
            "value": "artist-5"
          },
          {
            "field": "keyword",
            "value": "artist-6"
          },
          {
            "field": "keyword",
            "value": "artist-7"
          },
          {
            "field": "keyword",
            "value": "artist-8"
          },
          {
            "field": "keyword",
            "value": "artist-9"
          },
          {
            "field": "keyword",
            "value": "artist-10"
          }
        ]
      },
      "caveats": [
        "Your prompt described more conditions than the filter supports, so some were dropped."
      ]
    }
  },
  {
    "id": "over-limit-en-03",
    "lang": "en",
    "category": "over-limit",
    "prompt": "events in any of these categories: music, arts, food, sports, family, hobbies, business, health, holiday, charity, civic, religion, or technology",
    "geminiResponse": {
      "expression": {
        "op": "OR",
        "children": [
          {
            "categories": [
              "MUSIC"
            ]
          },
          {
            "categories": [
              "ARTS_AND_CULTURE"
            ]
          },
          {
            "categories": [
              "FOOD_AND_DRINK"
            ]
          },
          {
            "categories": [
              "SPORTS_AND_FITNESS"
            ]
          },
          {
            "categories": [
              "FAMILY_AND_KIDS"
            ]
          },
          {
            "categories": [
              "HOBBIES_AND_INTERESTS"
            ]
          },
          {
            "categories": [
              "BUSINESS_AND_NETWORKING"
            ]
          },
          {
            "categories": [
              "HEALTH_AND_WELLNESS"
            ]
          },
          {
            "categories": [
              "HOLIDAY"
            ]
          },
          {
            "categories": [
              "CHARITY_AND_CAUSES"
            ]
          },
          {
            "categories": [
              "CIVIC_AND_COMMUNITY"
            ]
          },
          {
            "categories": [
              "RELIGION_AND_SPIRITUALITY"
            ]
          },
          {
            "categories": [
              "TECHNOLOGY"
            ]
          }
        ]
      },
      "caveats": []
    },
    "expected": {
      "expression": {
        "op": "OR",
        "children": [
          {
            "field": "category",
            "value": [
              "MUSIC"
            ]
          },
          {
            "field": "category",
            "value": [
              "ARTS_AND_CULTURE"
            ]
          },
          {
            "field": "category",
            "value": [
              "FOOD_AND_DRINK"
            ]
          },
          {
            "field": "category",
            "value": [
              "SPORTS_AND_FITNESS"
            ]
          },
          {
            "field": "category",
            "value": [
              "FAMILY_AND_KIDS"
            ]
          },
          {
            "field": "category",
            "value": [
              "HOBBIES_AND_INTERESTS"
            ]
          },
          {
            "field": "category",
            "value": [
              "BUSINESS_AND_NETWORKING"
            ]
          },
          {
            "field": "category",
            "value": [
              "HEALTH_AND_WELLNESS"
            ]
          },
          {
            "field": "category",
            "value": [
              "HOLIDAY"
            ]
          },
          {
            "field": "category",
            "value": [
              "CHARITY_AND_CAUSES"
            ]
          },
          {
            "field": "category",
            "value": [
              "CIVIC_AND_COMMUNITY"
            ]
          }
        ]
      },
      "caveats": [
        "Your prompt described more conditions than the filter supports, so some were dropped."
      ]
    }
  },
  {
    "id": "over-limit-id-01",
    "lang": "id",
    "category": "over-limit",
    "prompt": "acara di venue-0 atau venue-1 atau venue-2 atau venue-3 atau venue-4 atau venue-5 atau venue-6 atau venue-7 atau venue-8 atau venue-9 atau venue-10 atau venue-11 atau venue-12",
    "geminiResponse": {
      "expression": {
        "op": "OR",
        "children": [
          {
            "keyword": "venue-0"
          },
          {
            "keyword": "venue-1"
          },
          {
            "keyword": "venue-2"
          },
          {
            "keyword": "venue-3"
          },
          {
            "keyword": "venue-4"
          },
          {
            "keyword": "venue-5"
          },
          {
            "keyword": "venue-6"
          },
          {
            "keyword": "venue-7"
          },
          {
            "keyword": "venue-8"
          },
          {
            "keyword": "venue-9"
          },
          {
            "keyword": "venue-10"
          },
          {
            "keyword": "venue-11"
          },
          {
            "keyword": "venue-12"
          }
        ]
      },
      "caveats": []
    },
    "expected": {
      "expression": {
        "op": "OR",
        "children": [
          {
            "field": "keyword",
            "value": "venue-0"
          },
          {
            "field": "keyword",
            "value": "venue-1"
          },
          {
            "field": "keyword",
            "value": "venue-2"
          },
          {
            "field": "keyword",
            "value": "venue-3"
          },
          {
            "field": "keyword",
            "value": "venue-4"
          },
          {
            "field": "keyword",
            "value": "venue-5"
          },
          {
            "field": "keyword",
            "value": "venue-6"
          },
          {
            "field": "keyword",
            "value": "venue-7"
          },
          {
            "field": "keyword",
            "value": "venue-8"
          },
          {
            "field": "keyword",
            "value": "venue-9"
          },
          {
            "field": "keyword",
            "value": "venue-10"
          }
        ]
      },
      "caveats": [
        "Your prompt described more conditions than the filter supports, so some were dropped."
      ]
    }
  },
  {
    "id": "over-limit-id-02",
    "lang": "id",
    "category": "over-limit",
    "prompt": "acara tentang pelaku-0 atau pelaku-1 atau pelaku-2 atau pelaku-3 atau pelaku-4 atau pelaku-5 atau pelaku-6 atau pelaku-7 atau pelaku-8 atau pelaku-9 atau pelaku-10 atau pelaku-11 atau pelaku-12",
    "geminiResponse": {
      "expression": {
        "op": "OR",
        "children": [
          {
            "keyword": "pelaku-0"
          },
          {
            "keyword": "pelaku-1"
          },
          {
            "keyword": "pelaku-2"
          },
          {
            "keyword": "pelaku-3"
          },
          {
            "keyword": "pelaku-4"
          },
          {
            "keyword": "pelaku-5"
          },
          {
            "keyword": "pelaku-6"
          },
          {
            "keyword": "pelaku-7"
          },
          {
            "keyword": "pelaku-8"
          },
          {
            "keyword": "pelaku-9"
          },
          {
            "keyword": "pelaku-10"
          },
          {
            "keyword": "pelaku-11"
          },
          {
            "keyword": "pelaku-12"
          }
        ]
      },
      "caveats": []
    },
    "expected": {
      "expression": {
        "op": "OR",
        "children": [
          {
            "field": "keyword",
            "value": "pelaku-0"
          },
          {
            "field": "keyword",
            "value": "pelaku-1"
          },
          {
            "field": "keyword",
            "value": "pelaku-2"
          },
          {
            "field": "keyword",
            "value": "pelaku-3"
          },
          {
            "field": "keyword",
            "value": "pelaku-4"
          },
          {
            "field": "keyword",
            "value": "pelaku-5"
          },
          {
            "field": "keyword",
            "value": "pelaku-6"
          },
          {
            "field": "keyword",
            "value": "pelaku-7"
          },
          {
            "field": "keyword",
            "value": "pelaku-8"
          },
          {
            "field": "keyword",
            "value": "pelaku-9"
          },
          {
            "field": "keyword",
            "value": "pelaku-10"
          }
        ]
      },
      "caveats": [
        "Your prompt described more conditions than the filter supports, so some were dropped."
      ]
    }
  },
  {
    "id": "out-of-vocabulary-en-02",
    "lang": "en",
    "category": "out-of-vocabulary",
    "prompt": "music events at Lantai 2 of the mall this weekend",
    "geminiResponse": {
      "expression": {
        "op": "AND",
        "children": [
          {
            "categories": [
              "MUSIC"
            ]
          },
          {
            "venueType": "MALL"
          },
          {
            "dateRange": {
              "anchor": "THIS_WEEK",
              "offsetAmount": 0,
              "offsetUnit": "WEEK"
            },
            "dayOfWeek": [
              "SAT",
              "SUN"
            ]
          }
        ]
      },
      "caveats": [
        "Floor/room-level location detail (\"Lantai 2\") is not supported yet, so it was ignored."
      ]
    },
    "expected": {
      "expression": {
        "op": "AND",
        "children": [
          {
            "field": "category",
            "value": [
              "MUSIC"
            ]
          },
          {
            "field": "venueType",
            "value": "MALL"
          },
          {
            "field": "dateRange",
            "value": {
              "anchor": "THIS_WEEK",
              "offsetAmount": 0,
              "offsetUnit": "WEEK"
            }
          },
          {
            "field": "dayOfWeek",
            "value": [
              "SAT",
              "SUN"
            ]
          }
        ]
      },
      "caveats": [
        "Floor/room-level location detail (\"Lantai 2\") is not supported yet, so it was ignored."
      ]
    }
  },
  {
    "id": "out-of-vocabulary-en-03",
    "lang": "en",
    "category": "out-of-vocabulary",
    "prompt": "events happening on Christmas day this year",
    "geminiResponse": {
      "expression": {
        "op": "AND",
        "children": []
      },
      "caveats": [
        "A specific holiday name (\"Christmas day\") is not supported yet, so it was ignored."
      ]
    },
    "expected": {
      "expression": {
        "op": "AND",
        "children": []
      },
      "caveats": [
        "A specific holiday name (\"Christmas day\") is not supported yet, so it was ignored."
      ]
    }
  },
  {
    "id": "out-of-vocabulary-id-01",
    "lang": "id",
    "category": "out-of-vocabulary",
    "prompt": "acara seni di bawah Rp 100.000 akhir pekan ini",
    "geminiResponse": {
      "expression": {
        "op": "AND",
        "children": [
          {
            "categories": [
              "ARTS_AND_CULTURE"
            ]
          },
          {
            "dateRange": {
              "anchor": "THIS_WEEK",
              "offsetAmount": 0,
              "offsetUnit": "WEEK"
            },
            "dayOfWeek": [
              "SAT",
              "SUN"
            ]
          }
        ]
      },
      "caveats": [
        "Ambang batas harga tertentu (\"di bawah Rp 100.000\") belum didukung, sehingga diabaikan."
      ]
    },
    "expected": {
      "expression": {
        "op": "AND",
        "children": [
          {
            "field": "category",
            "value": [
              "ARTS_AND_CULTURE"
            ]
          },
          {
            "field": "dateRange",
            "value": {
              "anchor": "THIS_WEEK",
              "offsetAmount": 0,
              "offsetUnit": "WEEK"
            }
          },
          {
            "field": "dayOfWeek",
            "value": [
              "SAT",
              "SUN"
            ]
          }
        ]
      },
      "caveats": [
        "Ambang batas harga tertentu (\"di bawah Rp 100.000\") belum didukung, sehingga diabaikan."
      ]
    }
  },
  {
    "id": "out-of-vocabulary-id-02",
    "lang": "id",
    "category": "out-of-vocabulary",
    "prompt": "konser jazz pada jam 8 malam besok",
    "geminiResponse": {
      "expression": {
        "op": "AND",
        "children": [
          {
            "keyword": "jazz"
          }
        ]
      },
      "caveats": [
        "Waktu spesifik (\"jam 8 malam\") belum didukung, sehingga diabaikan."
      ]
    },
    "expected": {
      "expression": {
        "field": "keyword",
        "value": "jazz"
      },
      "caveats": [
        "Waktu spesifik (\"jam 8 malam\") belum didukung, sehingga diabaikan."
      ]
    }
  },
  {
    "id": "off-topic-en-01",
    "lang": "en",
    "category": "off-topic",
    "prompt": "what's the weather like today?",
    "geminiResponse": {
      "expression": {
        "op": "AND",
        "children": []
      },
      "caveats": [
        "This prompt is not related to event search, so no filters were applied."
      ]
    },
    "expected": {
      "expression": {
        "op": "AND",
        "children": []
      },
      "caveats": [
        "This prompt is not related to event search, so no filters were applied."
      ]
    }
  },
  {
    "id": "off-topic-en-02",
    "lang": "en",
    "category": "off-topic",
    "prompt": "can you recommend a good recipe for nasi goreng?",
    "geminiResponse": {
      "expression": {
        "op": "AND",
        "children": []
      },
      "caveats": [
        "This prompt is not related to event search, so no filters were applied."
      ]
    },
    "expected": {
      "expression": {
        "op": "AND",
        "children": []
      },
      "caveats": [
        "This prompt is not related to event search, so no filters were applied."
      ]
    }
  },
  {
    "id": "off-topic-id-02",
    "lang": "id",
    "category": "off-topic",
    "prompt": "berapa harga bensin hari ini?",
    "geminiResponse": {
      "expression": {
        "op": "AND",
        "children": []
      },
      "caveats": [
        "Prompt ini tidak terkait dengan pencarian acara, sehingga tidak ada filter yang diterapkan."
      ]
    },
    "expected": {
      "expression": {
        "op": "AND",
        "children": []
      },
      "caveats": [
        "Prompt ini tidak terkait dengan pencarian acara, sehingga tidak ada filter yang diterapkan."
      ]
    }
  },
  {
    "id": "off-topic-id-03",
    "lang": "id",
    "category": "off-topic",
    "prompt": "ceritakan lelucon lucu",
    "geminiResponse": {
      "expression": {
        "op": "AND",
        "children": []
      },
      "caveats": [
        "Prompt ini tidak terkait dengan pencarian acara, sehingga tidak ada filter yang diterapkan."
      ]
    },
    "expected": {
      "expression": {
        "op": "AND",
        "children": []
      },
      "caveats": [
        "Prompt ini tidak terkait dengan pencarian acara, sehingga tidak ada filter yang diterapkan."
      ]
    }
  },
] as GoldenPromptFixture[];
